<?php
/**
 * Returns members for a group, with simple payment count summaries.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$groupId = getIntValue($_GET["group_id"] ?? 0);
$search = cleanText($_GET["search"] ?? "");
$roleFilter = cleanText($_GET["role"] ?? "");
$statusFilter = cleanText($_GET["status"] ?? "");

if ($groupId <= 0) {
    $groupId = getActiveGroupId($conn, $userId) ?? 0;
}

if ($groupId <= 0) {
    jsonResponse(["success" => true, "members" => []]);
}

requireGroupMember($conn, $userId, $groupId);

$sql =
    "SELECT gm.member_id, gm.user_id, gm.group_id,
            CASE
                WHEN g.treasurer_id = gm.user_id OR LOWER(gm.role) = 'treasurer' THEN 'Treasurer'
                ELSE 'Member'
            END AS role,
            gm.joined_at,
            u.name, u.email,
            SUM(CASE WHEN pr.status = 'Paid' THEN 1 ELSE 0 END) AS paid_count,
            SUM(CASE WHEN pr.status = 'Pending' THEN 1 ELSE 0 END) AS pending_count,
            SUM(CASE WHEN pr.status = 'Rejected' THEN 1 ELSE 0 END) AS rejected_count,
            SUM(CASE WHEN c.contribution_id IS NOT NULL AND (pr.status = 'Not Paid' OR pr.status IS NULL) THEN 1 ELSE 0 END) AS unpaid_count,
            COUNT(DISTINCT c.contribution_id) AS contribution_count
     FROM group_members gm
     INNER JOIN `groups` g ON g.group_id = gm.group_id
     INNER JOIN users u ON u.user_id = gm.user_id
     LEFT JOIN contributions c ON c.group_id = gm.group_id
     LEFT JOIN payment_records pr ON pr.contribution_id = c.contribution_id AND pr.user_id = gm.user_id
     WHERE gm.group_id = ?";

$params = [$groupId];
$types = "i";

if ($search !== "") {
    $sql .= " AND (u.name LIKE ? OR u.email LIKE ?)";
    $like = "%" . $search . "%";
    $params[] = $like;
    $params[] = $like;
    $types .= "ss";
}

$sql .= " GROUP BY gm.member_id, gm.user_id, gm.group_id, role, gm.joined_at, u.name, u.email";

$having = [];
$allowedRoles = ["Treasurer", "Member"];
if ($roleFilter !== "" && $roleFilter !== "All" && in_array($roleFilter, $allowedRoles, true)) {
    $having[] = "role = ?";
    $params[] = $roleFilter;
    $types .= "s";
}

$statusMap = [
    "Paid" => "paid_count > 0",
    "Pending" => "pending_count > 0",
    "Rejected" => "rejected_count > 0",
    "Not Paid" => "unpaid_count > 0"
];
if ($statusFilter !== "" && $statusFilter !== "All" && isset($statusMap[$statusFilter])) {
    $having[] = $statusMap[$statusFilter];
}

if (count($having) > 0) {
    $sql .= " HAVING " . implode(" AND ", $having);
}

$sql .= " ORDER BY role DESC, u.name ASC";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$members = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

jsonResponse([
    "success" => true,
    "members" => $members,
    "data" => $members
]);
