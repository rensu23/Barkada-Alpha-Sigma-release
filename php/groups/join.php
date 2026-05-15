<?php
/**
 * Joins the logged-in user to a group using groups.join_code.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();
$joinCode = cleanText($data["join_code"] ?? "");

if ($joinCode === "") {
    jsonResponse(["success" => false, "message" => "Enter a group code."], 422);
}

$stmt = $conn->prepare("SELECT group_id, group_name FROM `groups` WHERE join_code = ? LIMIT 1");
$stmt->bind_param("s", $joinCode);
$stmt->execute();
$group = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$group) {
    jsonResponse(["success" => false, "message" => "That group code was not found."], 404);
}

$groupId = (int) $group["group_id"];

if (isGroupMember($conn, $userId, $groupId)) {
    jsonResponse(["success" => false, "message" => "You are already a member of this group."], 409);
}

$conn->begin_transaction();

try {
    $role = "Member";
    $stmt = $conn->prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, ?)");
    $stmt->bind_param("iis", $userId, $groupId, $role);
    $stmt->execute();
    $stmt->close();

    // Existing contribution rows get a payment record for the new member.
    $stmt = $conn->prepare(
        "INSERT INTO payment_records (user_id, contribution_id, status, confirmed_by)
         SELECT ?, contribution_id, 'Not Paid', NULL
         FROM contributions
         WHERE group_id = ?"
    );
    $stmt->bind_param("ii", $userId, $groupId);
    $stmt->execute();
    $stmt->close();

    $conn->commit();
    startBarkadaSession();
    $_SESSION["active_group_id"] = $groupId;

    jsonResponse([
        "success" => true,
        "message" => "You joined " . $group["group_name"] . ".",
        "group_id" => $groupId,
        "user" => buildSessionPayload($conn, $userId),
        "data" => [
            "group_id" => $groupId,
            "group_name" => $group["group_name"]
        ]
    ]);
} catch (Throwable $e) {
    $conn->rollback();
    jsonResponse(["success" => false, "message" => "Could not join the group."], 500);
}
