<?php
/**
 * Current user submits their own payment record for review.
 * Treasurers are payers too, so they can use this for their own row.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";
require_once __DIR__ . "/../helpers/activity.php";
require_once __DIR__ . "/../helpers/payment-records.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();
$paymentId = getIntValue($data["payment_id"] ?? 0);
$contributionId = getIntValue($data["contribution_id"] ?? 0);

if ($paymentId <= 0 && $contributionId <= 0) {
    jsonResponse(["success" => false, "message" => "Valid payment or contribution is required."], 422);
}

if ($paymentId <= 0) {
    $stmt = $conn->prepare(
        "SELECT c.contribution_id, c.group_id
         FROM contributions c
         INNER JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = ?
         WHERE c.contribution_id = ?
         LIMIT 1"
    );
    $stmt->bind_param("ii", $userId, $contributionId);
    $stmt->execute();
    $contribution = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$contribution) {
        jsonResponse(["success" => false, "message" => "Contribution not found for your group."], 404);
    }

    ensurePaymentRecordsForGroup($conn, (int) $contribution["group_id"], $contributionId);
    $ownPayment = findOwnPaymentRecord($conn, $userId, $contributionId);

    if (!$ownPayment) {
        jsonResponse(["success" => false, "message" => "Payment record was not created for your account."], 500);
    }

    $paymentId = (int) $ownPayment["payment_id"];
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

if ((int) $payment["user_id"] !== $userId) {
    jsonResponse(["success" => false, "message" => "You can only mark your own payment."], 403);
}

requireGroupMember($conn, $userId, (int) $payment["group_id"]);

$role = getMemberRole($conn, $userId, (int) $payment["group_id"]);
$isTreasurerPayer = strtolower($role ?? "") === "treasurer" || getGroupTreasurerId($conn, (int) $payment["group_id"]) === $userId;

if ($isTreasurerPayer) {
    $status = "Paid";
    $stmt = $conn->prepare("UPDATE payment_records SET status = ?, confirmed_at = COALESCE(confirmed_at, NOW()), confirmed_by = COALESCE(confirmed_by, ?) WHERE payment_id = ?");
    $stmt->bind_param("sii", $status, $userId, $paymentId);
    $stmt->execute();
    $stmt->close();

    logActivity($conn, $userId, (int) $payment["group_id"], (int) $payment["contribution_id"], $paymentId, "payment_self_auto_paid");

    jsonResponse([
        "success" => true,
        "message" => "Treasurer payment is automatically paid."
    ]);
}

$status = "Pending";
$stmt = $conn->prepare("UPDATE payment_records SET status = ?, marked_at = NOW(), confirmed_at = NULL, confirmed_by = NULL WHERE payment_id = ?");
$stmt->bind_param("si", $status, $paymentId);
$stmt->execute();
$stmt->close();

logActivity($conn, $userId, (int) $payment["group_id"], (int) $payment["contribution_id"], $paymentId, "payment_marked_paid");

jsonResponse([
    "success" => true,
    "message" => "Payment submitted for review."
]);
