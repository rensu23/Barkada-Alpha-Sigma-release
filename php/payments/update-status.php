<?php
/**
 * Treasurer payment status editor.
 * Member confirmation review still uses confirm.php and reject.php.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";
require_once __DIR__ . "/../helpers/activity.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();
$paymentId = getIntValue($data["payment_id"] ?? 0);
$status = cleanText($data["status"] ?? "");

if ($paymentId <= 0) {
    jsonResponse(["success" => false, "message" => "Valid payment_id is required."], 422);
}

$allowedStatuses = ["Not Paid", "Paid", "Rejected"];
if (!in_array($status, $allowedStatuses, true)) {
    jsonResponse(["success" => false, "message" => "Choose a valid payment status."], 422);
}

$stmt = $conn->prepare(
    "SELECT pr.payment_id, pr.user_id, pr.contribution_id, c.group_id
     FROM payment_records pr
     INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
     WHERE pr.payment_id = ?
     LIMIT 1"
);
$stmt->bind_param("i", $paymentId);
$stmt->execute();
$payment = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$payment) {
    jsonResponse(["success" => false, "message" => "Payment record not found."], 404);
}

$groupId = (int) $payment["group_id"];
$targetUserId = (int) $payment["user_id"];
$actorRole = requireGroupMember($conn, $userId, $groupId);
$isOwnRecord = $targetUserId === $userId;
$isTreasurer = strtolower($actorRole) === "treasurer" || getGroupTreasurerId($conn, $groupId) === $userId;

if (!$isTreasurer) {
    jsonResponse(["success" => false, "message" => "Only the group treasurer can update payment statuses here."], 403);
}

if ($isOwnRecord && $status === "Rejected") {
    jsonResponse(["success" => false, "message" => "Use paid or not paid for your own treasurer status."], 422);
}

$confirmedAtSql = $status === "Paid" || $status === "Rejected" ? "NOW()" : "NULL";
$confirmedBy = $status === "Paid" || $status === "Rejected" ? $userId : null;
$markedAtSql = $status === "Not Paid" ? "marked_at = NOW()," : "";

$stmt = $conn->prepare(
    "UPDATE payment_records
     SET status = ?,
         {$markedAtSql}
         confirmed_at = {$confirmedAtSql},
         confirmed_by = ?
     WHERE payment_id = ?"
);
$stmt->bind_param("sii", $status, $confirmedBy, $paymentId);
$stmt->execute();
$stmt->close();

if ($isOwnRecord) {
    $action = $status === "Paid" ? "payment_self_marked_paid" : "payment_self_marked_unpaid";
} elseif ($status === "Paid") {
    $action = "payment_member_marked_paid";
} elseif ($status === "Rejected") {
    $action = "payment_rejected";
} else {
    $action = "payment_member_marked_unpaid";
}

logActivity($conn, $userId, $groupId, (int) $payment["contribution_id"], $paymentId, $action);

jsonResponse([
    "success" => true,
    "message" => $isOwnRecord ? "Your payment status was updated." : "Member payment status was updated."
]);
