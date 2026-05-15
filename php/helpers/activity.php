<?php
/**
 * Small activity logger for dashboard updates.
 * It records real actions without changing the main app flow.
 */

function logActivity(
    mysqli $conn,
    int $userId,
    ?int $groupId,
    ?int $contributionId,
    ?int $paymentId,
    string $action
): void {
    $stmt = $conn->prepare(
        "INSERT INTO activity_logs (user_id, group_id, contribution_id, payment_id, action)
         VALUES (?, ?, ?, ?, ?)"
    );
    $stmt->bind_param("iiiis", $userId, $groupId, $contributionId, $paymentId, $action);
    $stmt->execute();
    $stmt->close();
}
?>
