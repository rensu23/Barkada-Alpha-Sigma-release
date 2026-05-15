<?php
/**
 * Session endpoint used by static HTML pages after refresh.
 * It also returns a small state object for dashboard calculations.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$sessionUser = buildSessionPayload($conn, $userId);

$groups = $sessionUser["groups"];
$groupIds = array_map(fn($group) => (int) $group["group_id"], $groups);
$state = [
    "users" => [],
    "groups" => $groups,
    "group_members" => [],
    "contributions" => [],
    "payment_records" => [],
    "activity_logs" => []
];

if (count($groupIds) > 0) {
    $placeholders = implode(",", array_fill(0, count($groupIds), "?"));
    $types = str_repeat("i", count($groupIds));

    $stmt = $conn->prepare("SELECT member_id, user_id, group_id, role, joined_at FROM group_members WHERE group_id IN ($placeholders)");
    $stmt->bind_param($types, ...$groupIds);
    $stmt->execute();
    $state["group_members"] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $stmt = $conn->prepare("SELECT contribution_id, group_id, title, amount, type, frequency, due_date, notes FROM contributions WHERE group_id IN ($placeholders)");
    $stmt->bind_param($types, ...$groupIds);
    $stmt->execute();
    $state["contributions"] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $paymentSql =
        "SELECT pr.payment_id, pr.user_id, pr.contribution_id, pr.status, pr.marked_at, pr.confirmed_at, pr.confirmed_by
         FROM payment_records pr
         INNER JOIN contributions c ON c.contribution_id = pr.contribution_id
         INNER JOIN group_members gm ON gm.group_id = c.group_id AND gm.user_id = ?
         WHERE c.group_id IN ($placeholders)
           AND (pr.user_id = ? OR LOWER(gm.role) = 'treasurer')
         ORDER BY pr.marked_at DESC";
    $stmt = $conn->prepare($paymentSql);
    $paymentTypes = "i" . $types . "i";
    $paymentParams = array_merge([$userId], $groupIds, [$userId]);
    $stmt->bind_param($paymentTypes, ...$paymentParams);
    $stmt->execute();
    $state["payment_records"] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    $activitySql =
        "SELECT al.activity_id, al.user_id, al.group_id, al.contribution_id, al.payment_id,
                al.action, al.created_at,
                u.name AS user_name,
                g.group_name,
                c.title AS contribution_title,
                c.amount AS contribution_amount,
                pr.status AS payment_status
         FROM activity_logs al
         LEFT JOIN users u ON u.user_id = al.user_id
         LEFT JOIN `groups` g ON g.group_id = al.group_id
         LEFT JOIN contributions c ON c.contribution_id = al.contribution_id
         LEFT JOIN payment_records pr ON pr.payment_id = al.payment_id
         WHERE al.group_id IN ($placeholders)
         ORDER BY al.created_at DESC, al.activity_id DESC
         LIMIT 60";
    $stmt = $conn->prepare($activitySql);
    $stmt->bind_param($types, ...$groupIds);
    $stmt->execute();
    $state["activity_logs"] = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
}

jsonResponse([
    "success" => true,
    "user" => $sessionUser,
    "state" => $state
]);
