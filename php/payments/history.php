<?php
/**
 * Returns payment history joined with users, contributions, groups, and member summaries.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$groupId = getIntValue($_GET["group_id"] ?? 0);
$sort = cleanText($_GET["sort"] ?? "newest");
$sortSql = $sort === "oldest" ? "ASC" : "DESC";

$sql =
    "SELECT pr.payment_id, pr.user_id, pr.contribution_id, pr.status,
            pr.marked_at, pr.confirmed_at, pr.confirmed_by,
            CASE
                WHEN pr.status IN ('Paid', 'Rejected') AND pr.confirmed_at IS NOT NULL THEN pr.confirmed_at
                ELSE pr.marked_at
            END AS latest_update,
            payer.name AS user_name, payer.email AS user_email,
            confirmer.name AS confirmed_by_name,
            c.title, c.amount, c.type, c.frequency, c.due_date, c.notes,
            g.group_id, g.group_name, g.treasurer_id,
            creator.name AS creator_name,
            viewer.role AS viewer_role
     FROM payment_records pr
     INNER JOIN users payer ON payer.user_id = pr.user_id
     LEFT JOIN users confirmer ON confirmer.user_id = pr.confirmed_by
     INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
     INNER JOIN `groups` g ON g.group_id = c.group_id
     LEFT JOIN users creator ON creator.user_id = g.treasurer_id
     INNER JOIN group_members viewer ON viewer.group_id = g.group_id AND viewer.user_id = ?
     WHERE (pr.user_id = ? OR g.treasurer_id = ? OR LOWER(viewer.role) = 'treasurer')";

$params = [$userId, $userId, $userId];
$types = "iii";

if ($groupId > 0) {
    $sql .= " AND g.group_id = ?";
    $params[] = $groupId;
    $types .= "i";
}

$sql .= " ORDER BY latest_update $sortSql, pr.payment_id $sortSql";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();
$rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$contributionIds = array_values(array_unique(array_map(fn($row) => (int) $row["contribution_id"], $rows)));
$memberStatus = [];

if (count($contributionIds) > 0) {
    $placeholders = implode(",", array_fill(0, count($contributionIds), "?"));
    $memberTypes = str_repeat("i", count($contributionIds));

    $stmt = $conn->prepare(
        "SELECT pr.contribution_id, pr.status, u.name, u.email
         FROM payment_records pr
         INNER JOIN users u ON u.user_id = pr.user_id
         WHERE pr.contribution_id IN ($placeholders)
         ORDER BY u.name ASC"
    );
    $stmt->bind_param($memberTypes, ...$contributionIds);
    $stmt->execute();
    $memberRows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($memberRows as $member) {
        $id = (int) $member["contribution_id"];
        if (!isset($memberStatus[$id])) {
            $memberStatus[$id] = [
                "paid" => [],
                "pending" => [],
                "not_paid" => [],
                "rejected" => []
            ];
        }

        $person = [
            "name" => $member["name"],
            "email" => $member["email"]
        ];

        if ($member["status"] === "Paid") {
            $memberStatus[$id]["paid"][] = $person;
        } elseif ($member["status"] === "Pending") {
            $memberStatus[$id]["pending"][] = $person;
        } elseif ($member["status"] === "Rejected") {
            $memberStatus[$id]["rejected"][] = $person;
        } else {
            $memberStatus[$id]["not_paid"][] = $person;
        }
    }
}

$history = array_map(function ($row) use ($memberStatus) {
    $contributionId = (int) $row["contribution_id"];

    return [
        "payment_id" => (int) $row["payment_id"],
        "user_id" => (int) $row["user_id"],
        "contribution_id" => $contributionId,
        "status" => $row["status"],
        "marked_at" => $row["marked_at"],
        "confirmed_at" => $row["confirmed_at"],
        "confirmed_by" => $row["confirmed_by"] ? (int) $row["confirmed_by"] : null,
        "confirmed_by_name" => $row["confirmed_by_name"],
        "latest_update" => $row["latest_update"],
        "user" => [
            "name" => $row["user_name"],
            "email" => $row["user_email"]
        ],
        "contribution" => [
            "title" => $row["title"],
            "amount" => $row["amount"],
            "type" => $row["type"],
            "frequency" => $row["frequency"],
            "due_date" => $row["due_date"],
            "notes" => $row["notes"]
        ],
        "group" => [
            "group_id" => (int) $row["group_id"],
            "group_name" => $row["group_name"],
            "creator_name" => $row["creator_name"] ?: "No assigned treasurer"
        ],
        "members" => $memberStatus[$contributionId] ?? [
            "paid" => [],
            "pending" => [],
            "not_paid" => [],
            "rejected" => []
        ]
    ];
}, $rows);

jsonResponse([
    "success" => true,
    "history" => $history,
    "data" => $history
]);
?>
