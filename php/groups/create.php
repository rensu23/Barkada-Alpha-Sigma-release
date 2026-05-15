<?php
/**
 * Creates a group and adds the creator as Treasurer.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";
require_once __DIR__ . "/../helpers/activity.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();

$groupName = cleanText($data["group_name"] ?? "");
$description = cleanText($data["description"] ?? "");
$targetAmount = toMoney($data["target_amount"] ?? 0);
$deadline = cleanText($data["deadline"] ?? "");
$joinCode = cleanText($data["join_code"] ?? "");

if ($groupName === "") {
    jsonResponse(["success" => false, "message" => "Group name is required."], 422);
}

if ($targetAmount < 0) {
    jsonResponse(["success" => false, "message" => "Target amount cannot be negative."], 422);
}

if ($deadline !== "" && !preg_match("/^\d{4}-\d{2}-\d{2}$/", $deadline)) {
    jsonResponse(["success" => false, "message" => "Use a valid deadline date."], 422);
}

if ($joinCode === "") {
    $joinCode = "BRK-" . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
}

$stmt = $conn->prepare("SELECT group_id FROM `groups` WHERE join_code = ? LIMIT 1");
$stmt->bind_param("s", $joinCode);
$stmt->execute();
$exists = $stmt->get_result()->num_rows > 0;
$stmt->close();

if ($exists) {
    jsonResponse(["success" => false, "message" => "Join code is already used. Please choose another code."], 409);
}

$conn->begin_transaction();

try {
    $stmt = $conn->prepare(
        "INSERT INTO `groups` (group_name, description, treasurer_id, target_amount, deadline, join_code)
         VALUES (?, ?, ?, ?, ?, ?)"
    );
    $deadlineValue = $deadline === "" ? null : $deadline;
    $stmt->bind_param("ssidss", $groupName, $description, $userId, $targetAmount, $deadlineValue, $joinCode);
    $stmt->execute();
    $groupId = $stmt->insert_id;
    $stmt->close();

    $role = "Treasurer";
    $stmt = $conn->prepare("INSERT INTO group_members (user_id, group_id, role) VALUES (?, ?, ?)");
    $stmt->bind_param("iis", $userId, $groupId, $role);
    $stmt->execute();
    $stmt->close();

    logActivity($conn, $userId, $groupId, null, null, "group_created");

    $conn->commit();
    startBarkadaSession();
    $_SESSION["active_group_id"] = $groupId;

    jsonResponse([
        "success" => true,
        "message" => "Group created.",
        "group" => [
            "group_id" => $groupId,
            "group_name" => $groupName,
            "description" => $description,
            "treasurer_id" => $userId,
            "target_amount" => $targetAmount,
            "deadline" => $deadlineValue,
            "join_code" => $joinCode,
            "member_role" => $role
        ]
    ]);
} catch (Throwable $e) {
    $conn->rollback();
    jsonResponse(["success" => false, "message" => "Group was not created."], 500);
}
