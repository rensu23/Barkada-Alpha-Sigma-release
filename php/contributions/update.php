<?php
/**
 * Updates contribution fields that exist in barkada_db.sql. Treasurer only.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";
require_once __DIR__ . "/../helpers/activity.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();

$contributionId = getIntValue($data["contribution_id"] ?? 0);
$title = cleanText($data["title"] ?? "");
$amount = toMoney($data["amount"] ?? 0);
$type = cleanText($data["type"] ?? "");
$frequency = cleanText($data["frequency"] ?? "");
$dueDate = validateDateOrNull(cleanText($data["due_date"] ?? ""));
$notes = cleanText($data["notes"] ?? "");

if ($contributionId <= 0 || $title === "" || $amount <= 0) {
    jsonResponse(["success" => false, "message" => "Contribution, title, and amount are required."], 422);
}

$allowedTypes = ["One-time", "Recurring"];
$allowedFrequency = ["One-time", "Weekly", "Monthly", "Custom"];

if (!in_array($type, $allowedTypes, true)) {
    jsonResponse(["success" => false, "message" => "Invalid contribution type."], 422);
}

if (!in_array($frequency, $allowedFrequency, true)) {
    jsonResponse(["success" => false, "message" => "Invalid frequency."], 422);
}

$stmt = $conn->prepare("SELECT group_id FROM contributions WHERE contribution_id = ? LIMIT 1");
$stmt->bind_param("i", $contributionId);
$stmt->execute();
$row = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$row) {
    jsonResponse(["success" => false, "message" => "Contribution not found."], 404);
}

requireTreasurer($conn, $userId, (int) $row["group_id"]);

$stmt = $conn->prepare(
    "UPDATE contributions
     SET title = ?, amount = ?, type = ?, frequency = ?, due_date = ?, notes = ?
     WHERE contribution_id = ?"
);
$stmt->bind_param("sdssssi", $title, $amount, $type, $frequency, $dueDate, $notes, $contributionId);
$stmt->execute();
$stmt->close();

logActivity($conn, $userId, (int) $row["group_id"], $contributionId, null, "contribution_updated");

jsonResponse([
    "success" => true,
    "message" => "Contribution updated."
]);
