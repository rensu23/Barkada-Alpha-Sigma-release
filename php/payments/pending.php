<?php
/**
 * Treasurer view of pending payment claims.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$groupId = getIntValue($_GET["group_id"] ?? 0);

$sql =
    "SELECT pr.payment_id, pr.user_id, pr.contribution_id, pr.status, pr.marked_at, pr.confirmed_at,
            u.name AS user_name, u.email AS user_email,
            c.title, c.amount, c.due_date, c.notes, c.group_id,
            g.group_name
     FROM payment_records pr
     INNER JOIN users u ON u.user_id = pr.user_id
     INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
     INNER JOIN `groups` g ON g.group_id = c.group_id
     INNER JOIN group_members gm ON gm.group_id = g.group_id AND gm.user_id = ?
     WHERE pr.status = 'Pending'";

$params = [$userId];
$types = "i";

$sql .= " AND (g.treasurer_id = ? OR LOWER(gm.role) = 'treasurer')";
$params[] = $userId;
$types .= "i";

if ($groupId > 0) {
    $sql .= " AND g.group_id = ?";
    $params[] = $groupId;
    $types .= "i";
}

$sql .= " ORDER BY pr.marked_at DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$payments = array_map(function ($row) {
    return [
        "payment_id" => (int) $row["payment_id"],
        "status" => $row["status"],
        "marked_at" => $row["marked_at"],
        "confirmed_at" => $row["confirmed_at"],
        "user" => [
            "user_id" => (int) $row["user_id"],
            "name" => $row["user_name"],
            "email" => $row["user_email"]
        ],
        "contribution" => [
            "contribution_id" => (int) $row["contribution_id"],
            "title" => $row["title"],
            "amount" => $row["amount"],
            "due_date" => $row["due_date"],
            "notes" => $row["notes"]
        ],
        "group" => [
            "group_id" => (int) $row["group_id"],
            "group_name" => $row["group_name"]
        ]
    ];
}, $rows);

jsonResponse([
    "success" => true,
    "payments" => $payments,
    "data" => $payments
]);
