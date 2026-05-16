<?php
/**
 * Payment records for the group detail screen.
 * Treasurers see every member row; members see only their own rows.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$groupId = getIntValue($_GET["group_id"] ?? 0);

if ($groupId <= 0) {
    $groupId = getActiveGroupId($conn, $userId) ?? 0;
}

if ($groupId <= 0) {
    jsonResponse(["success" => true, "records" => []]);
}

$viewerRole = requireGroupMember($conn, $userId, $groupId);
$isTreasurer = strtolower($viewerRole) === "treasurer" || getGroupTreasurerId($conn, $groupId) === $userId;

$sql =
    "SELECT pr.payment_id, pr.user_id, pr.contribution_id, pr.status, pr.marked_at, pr.confirmed_at, pr.confirmed_by,
            u.name AS user_name, u.email AS user_email,
            CASE
                WHEN g.treasurer_id = u.user_id OR LOWER(gm.role) = 'treasurer' THEN 'Treasurer'
                ELSE 'Member'
            END AS user_role,
            c.title, c.amount, c.type, c.frequency, c.due_date, c.notes,
            g.group_id, g.group_name
     FROM payment_records pr
     INNER JOIN users u ON u.user_id = pr.user_id
     INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
     INNER JOIN `groups` g ON g.group_id = c.group_id
     INNER JOIN group_members gm ON gm.group_id = g.group_id AND gm.user_id = pr.user_id
     WHERE c.group_id = ?";

$params = [$groupId];
$types = "i";

if (!$isTreasurer) {
    $sql .= " AND pr.user_id = ?";
    $params[] = $userId;
    $types .= "i";
}

$sql .= " ORDER BY c.due_date IS NULL ASC, c.due_date ASC, c.title ASC, user_role DESC, u.name ASC";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$records = array_map(function ($row) use ($userId) {
    return [
        "payment_id" => (int) $row["payment_id"],
        "user_id" => (int) $row["user_id"],
        "contribution_id" => (int) $row["contribution_id"],
        "status" => $row["status"] ?: "Not Paid",
        "marked_at" => $row["marked_at"],
        "confirmed_at" => $row["confirmed_at"],
        "confirmed_by" => $row["confirmed_by"] ? (int) $row["confirmed_by"] : null,
        "is_self" => (int) $row["user_id"] === $userId,
        "user" => [
            "name" => $row["user_name"],
            "email" => $row["user_email"],
            "role" => $row["user_role"] ?: "Member"
        ],
        "contribution" => [
            "contribution_id" => (int) $row["contribution_id"],
            "title" => $row["title"],
            "amount" => $row["amount"],
            "type" => $row["type"],
            "frequency" => $row["frequency"],
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
    "viewer_role" => $viewerRole,
    "can_manage" => $isTreasurer,
    "records" => $records,
    "data" => $records
]);
