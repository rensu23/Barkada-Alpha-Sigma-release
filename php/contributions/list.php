<?php
/**
 * Lists contributions visible to the logged-in user.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$groupId = getIntValue($_GET["group_id"] ?? 0);
$search = cleanText($_GET["search"] ?? "");
$type = cleanText($_GET["type"] ?? "");
$status = cleanText($_GET["status"] ?? "");
$sort = cleanText($_GET["sort"] ?? "title");

$sql =
    "SELECT c.contribution_id, c.group_id, c.title, c.amount, c.type, c.frequency, c.due_date, c.notes,
            g.group_name, g.deadline, gm.role AS member_role,
            pr.payment_id, pr.status, pr.marked_at, pr.confirmed_at, pr.confirmed_by
     FROM contributions c
     INNER JOIN `groups` g ON g.group_id = c.group_id
     INNER JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = ?
     LEFT JOIN payment_records pr ON pr.contribution_id = c.contribution_id AND pr.user_id = ?
     WHERE 1 = 1";

$params = [$userId, $userId];
$paramTypes = "ii";

if ($groupId > 0) {
    $sql .= " AND c.group_id = ?";
    $params[] = $groupId;
    $paramTypes .= "i";
}

if ($search !== "") {
    $like = "%" . $search . "%";
    $sql .= " AND (c.title LIKE ? OR g.group_name LIKE ?)";
    $params[] = $like;
    $params[] = $like;
    $paramTypes .= "ss";
}

if ($type !== "" && $type !== "All") {
    $sql .= " AND c.type = ?";
    $params[] = $type;
    $paramTypes .= "s";
}

$allowedStatuses = ["Not Paid", "Pending", "Paid", "Rejected"];
if ($status !== "" && $status !== "All" && in_array($status, $allowedStatuses, true)) {
    $sql .= " AND COALESCE(pr.status, 'Not Paid') = ?";
    $params[] = $status;
    $paramTypes .= "s";
}

$sortSql = [
    "due-soon" => "c.due_date IS NULL ASC, c.due_date ASC, c.title ASC",
    "due-latest" => "c.due_date IS NULL ASC, c.due_date DESC, c.title ASC",
    "amount-high" => "c.amount DESC, c.title ASC",
    "amount-low" => "c.amount ASC, c.title ASC",
    "latest" => "c.contribution_id DESC",
    "oldest" => "c.contribution_id ASC",
    "status" => "COALESCE(pr.status, 'Not Paid') ASC, c.title ASC",
    "title" => "c.title ASC"
];

$sql .= " ORDER BY " . ($sortSql[$sort] ?? $sortSql["title"]);

$stmt = $conn->prepare($sql);
$stmt->bind_param($paramTypes, ...$params);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$contributions = array_map(function ($row) {
    return [
        "contribution_id" => (int) $row["contribution_id"],
        "group_id" => (int) $row["group_id"],
        "title" => $row["title"],
        "amount" => $row["amount"],
        "type" => $row["type"],
        "frequency" => $row["frequency"],
        "due_date" => $row["due_date"],
        "notes" => $row["notes"],
        "member_role" => $row["member_role"],
        "payment_id" => $row["payment_id"] ? (int) $row["payment_id"] : null,
        "status" => $row["status"] ?: "Not Paid",
        "marked_at" => $row["marked_at"],
        "confirmed_at" => $row["confirmed_at"],
        "confirmed_by" => $row["confirmed_by"],
        "group" => [
            "group_id" => (int) $row["group_id"],
            "group_name" => $row["group_name"],
            "deadline" => $row["deadline"]
        ]
    ];
}, $rows);

jsonResponse([
    "success" => true,
    "contributions" => $contributions,
    "data" => $contributions
]);
