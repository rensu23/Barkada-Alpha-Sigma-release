<?php
/**
 * Updates group details. Treasurer only.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();

$groupId = getIntValue($data["group_id"] ?? ($_GET["group_id"] ?? 0));
$groupName = cleanText($data["group_name"] ?? "");
$description = cleanText($data["description"] ?? "");
$targetAmount = toMoney($data["target_amount"] ?? 0);
$deadline = cleanText($data["deadline"] ?? "");
$joinCode = cleanText($data["join_code"] ?? "");

if ($groupId <= 0 || $groupName === "" || $joinCode === "") {
    jsonResponse(["success" => false, "message" => "Group ID, name, and join code are required."], 422);
}

if ($targetAmount < 0) {
    jsonResponse(["success" => false, "message" => "Target amount cannot be negative."], 422);
}

requireTreasurer($conn, $userId, $groupId);

$stmt = $conn->prepare("SELECT group_id FROM `groups` WHERE join_code = ? AND group_id <> ? LIMIT 1");
$stmt->bind_param("si", $joinCode, $groupId);
$stmt->execute();
$exists = $stmt->get_result()->num_rows > 0;
$stmt->close();

if ($exists) {
    jsonResponse(["success" => false, "message" => "Join code is already used by another group."], 409);
}

$deadlineValue = $deadline === "" ? null : $deadline;
$stmt = $conn->prepare(
    "UPDATE `groups`
     SET group_name = ?, description = ?, target_amount = ?, deadline = ?, join_code = ?
     WHERE group_id = ?"
);
$stmt->bind_param("ssdssi", $groupName, $description, $targetAmount, $deadlineValue, $joinCode, $groupId);
$stmt->execute();
$stmt->close();

jsonResponse([
    "success" => true,
    "message" => "Group updated."
]);
