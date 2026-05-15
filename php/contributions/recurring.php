<?php
/**
 * Returns simple recurring contribution rows.
 * The SQL has no cycle table, so frequency is the only schedule source.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();

$stmt = $conn->prepare(
    "SELECT c.contribution_id, c.group_id, c.title, c.amount, c.type, c.frequency, c.due_date, c.notes,
            g.group_name, gm.role AS member_role
     FROM contributions c
     INNER JOIN `groups` g ON g.group_id = c.group_id
     INNER JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = ?
     WHERE c.type = 'Recurring'
     ORDER BY c.frequency ASC, c.title ASC"
);
$stmt->bind_param("i", $userId);
$stmt->execute();
$cycles = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

jsonResponse([
    "success" => true,
    "cycles" => $cycles,
    "data" => $cycles
]);
