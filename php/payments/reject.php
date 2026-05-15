<?php
/**
 * Treasurer rejects a payment claim.
 * Rejection notes are not stored because the SQL file has no note column.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";
require_once __DIR__ . "/../helpers/activity.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();
$paymentId = getIntValue($data["payment_id"] ?? 0);

if ($paymentId <= 0) {
    jsonResponse(["success" => false, "message" => "Valid payment_id is required."], 422);
}

$stmt = $conn->prepare(
    "SELECT pr.payment_id, pr.contribution_id, c.group_id
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

requireTreasurer($conn, $userId, (int) $payment["group_id"]);

$status = "Rejected";
$stmt = $conn->prepare("UPDATE payment_records SET status = ?, confirmed_at = NOW(), confirmed_by = ? WHERE payment_id = ?");
$stmt->bind_param("sii", $status, $userId, $paymentId);
$stmt->execute();
$stmt->close();

logActivity($conn, $userId, (int) $payment["group_id"], (int) $payment["contribution_id"], $paymentId, "payment_rejected");

jsonResponse([
    "success" => true,
    "message" => "Payment rejected."
]);
