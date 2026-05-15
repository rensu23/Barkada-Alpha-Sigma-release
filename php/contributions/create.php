<?php
/**
 * Creates a contribution and starter payment rows for each group member.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";
require_once __DIR__ . "/../helpers/activity.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();

$groupId = getIntValue($data["group_id"] ?? 0);
$title = cleanText($data["title"] ?? "");
$amount = toMoney($data["amount"] ?? 0);
$type = cleanText($data["type"] ?? "");
$frequency = cleanText($data["frequency"] ?? "");
$dueDate = validateDateOrNull(cleanText($data["due_date"] ?? ""));
$notes = cleanText($data["notes"] ?? "");

$allowedTypes = ["One-time", "Recurring"];
$allowedFrequency = ["One-time", "Weekly", "Monthly", "Custom"];

if ($groupId <= 0 || $title === "" || $amount <= 0) {
    jsonResponse(["success" => false, "message" => "Group, title, and amount are required."], 422);
}

if (!in_array($type, $allowedTypes, true)) {
    jsonResponse(["success" => false, "message" => "Invalid contribution type."], 422);
}

if (!in_array($frequency, $allowedFrequency, true)) {
    jsonResponse(["success" => false, "message" => "Invalid frequency."], 422);
}

requireTreasurer($conn, $userId, $groupId);

$conn->begin_transaction();

try {
    $stmt = $conn->prepare(
        "INSERT INTO contributions (group_id, title, amount, type, frequency, due_date, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("isdssss", $groupId, $title, $amount, $type, $frequency, $dueDate, $notes);
    $stmt->execute();
    $contributionId = $stmt->insert_id;
    $stmt->close();

    $stmt = $conn->prepare(
        "INSERT INTO payment_records (user_id, contribution_id, status, confirmed_by)
         SELECT user_id, ?, 'Not Paid', NULL
         FROM group_members
         WHERE group_id = ?"
    );
    $stmt->bind_param("ii", $contributionId, $groupId);
    $stmt->execute();
    $stmt->close();

    logActivity($conn, $userId, $groupId, $contributionId, null, "contribution_created");

    $conn->commit();

    jsonResponse([
        "success" => true,
        "message" => "Contribution created.",
        "contribution_id" => $contributionId,
        "data" => [
            "contribution_id" => $contributionId,
            "group_id" => $groupId,
            "title" => $title,
            "amount" => $amount,
            "type" => $type,
            "frequency" => $frequency,
            "due_date" => $dueDate,
            "notes" => $notes
        ]
    ]);
} catch (Throwable $e) {
    $conn->rollback();
    jsonResponse(["success" => false, "message" => "Contribution was not created."], 500);
}
