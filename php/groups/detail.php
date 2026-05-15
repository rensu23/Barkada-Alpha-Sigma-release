<?php
/**
 * Returns one group after checking membership.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$groupId = getIntValue($_GET["group_id"] ?? 0);

if ($groupId <= 0) {
    jsonResponse(["success" => false, "message" => "Valid group_id is required."], 422);
}

$role = requireGroupMember($conn, $userId, $groupId);

$stmt = $conn->prepare(
    "SELECT group_id, group_name, description, treasurer_id, target_amount, deadline, join_code, created_at
     FROM `groups`
     WHERE group_id = ?
     LIMIT 1"
);
$stmt->bind_param("i", $groupId);
$stmt->execute();
$group = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$group) {
    jsonResponse(["success" => false, "message" => "Group not found."], 404);
}

$group["member_role"] = $role;
if ($role !== "Treasurer") {
    $group["join_code"] = "";
}

jsonResponse([
    "success" => true,
    "group" => $group
]);
