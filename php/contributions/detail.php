<?php
/**
 * Returns one contribution after checking group membership.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$contributionId = getIntValue($_GET["contribution_id"] ?? 0);

if ($contributionId <= 0) {
    jsonResponse(["success" => false, "message" => "Valid contribution_id is required."], 422);
}

$stmt = $conn->prepare(
    "SELECT c.contribution_id, c.group_id, c.title, c.amount, c.type, c.frequency, c.due_date, c.notes,
            g.group_name, gm.role AS member_role
     FROM contributions c
     INNER JOIN `groups` g ON g.group_id = c.group_id
     INNER JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = ?
     WHERE c.contribution_id = ?
     LIMIT 1"
);
$stmt->bind_param("ii", $userId, $contributionId);
$stmt->execute();
$contribution = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$contribution) {
    jsonResponse(["success" => false, "message" => "Contribution not found."], 404);
}

jsonResponse([
    "success" => true,
    "contribution" => $contribution,
    "data" => $contribution
]);
