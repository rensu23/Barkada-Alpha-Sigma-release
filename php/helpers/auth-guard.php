<?php
/**
 * Session and authorization helpers.
 * Pages call these before reading private data or changing records.
 */

require_once __DIR__ . "/../config/database.php";
require_once __DIR__ . "/response.php";

function startBarkadaSession(): void
{
    if (session_status() === PHP_SESSION_NONE) {
        session_name("barkada_session");
        session_start([
            "cookie_path" => "/",
            "cookie_httponly" => true,
            "cookie_samesite" => "Lax"
        ]);
    }
}

function getLoggedInUserId(): int
{
    startBarkadaSession();
    return isset($_SESSION["user_id"]) ? (int) $_SESSION["user_id"] : 0;
}

function requireLogin(): int
{
    $userId = getLoggedInUserId();

    if ($userId <= 0) {
        jsonResponse([
            "success" => false,
            "message" => "Please log in first."
        ], 401);
    }

    return $userId;
}

function fetchSessionUser(mysqli $conn, int $userId): ?array
{
    $stmt = $conn->prepare("SELECT user_id, name, email, created_at FROM users WHERE user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $user = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    return $user ?: null;
}

function fetchUserGroups(mysqli $conn, int $userId): array
{
    $stmt = $conn->prepare(
        "SELECT g.group_id, g.group_name, g.description, g.treasurer_id, g.target_amount,
                g.deadline, g.join_code, g.created_at,
                CASE
                    WHEN g.treasurer_id = ? OR LOWER(gm.role) = 'treasurer' THEN 'Treasurer'
                    ELSE 'Member'
                END AS member_role
         FROM group_members gm
         INNER JOIN `groups` g ON g.group_id = gm.group_id
         WHERE gm.user_id = ?
         ORDER BY g.created_at DESC"
    );
    $stmt->bind_param("ii", $userId, $userId);
    $stmt->execute();
    $groups = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    return $groups;
}

function getEffectiveRole(array $groups): string
{
    $hasTreasurer = false;
    $hasMember = false;

    foreach ($groups as $group) {
        $role = strtolower($group["member_role"] ?? "");
        if ($role === "treasurer") {
            $hasTreasurer = true;
        }
        if ($role === "member") {
            $hasMember = true;
        }
    }

    if ($hasTreasurer && $hasMember) return "hybrid";
    if ($hasTreasurer) return "treasurer";
    return "member";
}

function getActiveGroupId(mysqli $conn, int $userId): ?int
{
    startBarkadaSession();

    if (!empty($_SESSION["active_group_id"])) {
        $groupId = (int) $_SESSION["active_group_id"];
        if (isGroupMember($conn, $userId, $groupId)) {
            return $groupId;
        }
    }

    $stmt = $conn->prepare("SELECT group_id FROM group_members WHERE user_id = ? ORDER BY joined_at DESC LIMIT 1");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if ($row) {
        $_SESSION["active_group_id"] = (int) $row["group_id"];
        return (int) $row["group_id"];
    }

    return null;
}

function isGroupMember(mysqli $conn, int $userId, int $groupId): bool
{
    $stmt = $conn->prepare("SELECT member_id FROM group_members WHERE user_id = ? AND group_id = ? LIMIT 1");
    $stmt->bind_param("ii", $userId, $groupId);
    $stmt->execute();
    $exists = $stmt->get_result()->num_rows > 0;
    $stmt->close();

    return $exists;
}

function getMemberRole(mysqli $conn, int $userId, int $groupId): ?string
{
    $stmt = $conn->prepare("SELECT role FROM group_members WHERE user_id = ? AND group_id = ? LIMIT 1");
    $stmt->bind_param("ii", $userId, $groupId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row || !isset($row["role"])) {
        return null;
    }

    return strtolower($row["role"]) === "treasurer" ? "Treasurer" : "Member";
}

function getGroupTreasurerId(mysqli $conn, int $groupId): ?int
{
    $stmt = $conn->prepare("SELECT treasurer_id FROM `groups` WHERE group_id = ? LIMIT 1");
    $stmt->bind_param("i", $groupId);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        return null;
    }

    return $row["treasurer_id"] === null ? null : (int) $row["treasurer_id"];
}

function requireGroupMember(mysqli $conn, int $userId, int $groupId): string
{
    $role = getMemberRole($conn, $userId, $groupId);

    if (!$role) {
        jsonResponse(["success" => false, "message" => "You are not a member of this group."], 403);
    }

    if (getGroupTreasurerId($conn, $groupId) === $userId) {
        return "Treasurer";
    }

    return $role;
}

function requireTreasurer(mysqli $conn, int $userId, int $groupId): void
{
    $role = requireGroupMember($conn, $userId, $groupId);
    $treasurerId = getGroupTreasurerId($conn, $groupId);
    $hasTreasurerRole = strtolower($role) === "treasurer";
    $isAssignedTreasurer = $treasurerId !== null && $treasurerId === $userId;

    if ($treasurerId === null && !$hasTreasurerRole) {
        jsonResponse(["success" => false, "message" => "This group has no assigned treasurer right now."], 403);
    }

    if (!$isAssignedTreasurer && !$hasTreasurerRole) {
        jsonResponse(["success" => false, "message" => "Only the group treasurer can do this action."], 403);
    }
}

function validateDateOrNull(string $date): ?string
{
    if ($date === "") {
        return null;
    }

    $parts = explode("-", $date);
    if (count($parts) !== 3 || !checkdate((int) $parts[1], (int) $parts[2], (int) $parts[0])) {
        jsonResponse(["success" => false, "message" => "Use a valid date."], 422);
    }

    return $date;
}

function buildSessionPayload(mysqli $conn, int $userId): array
{
    $user = fetchSessionUser($conn, $userId);

    if (!$user) {
        jsonResponse(["success" => false, "message" => "Session user was not found."], 401);
    }

    $groups = fetchUserGroups($conn, $userId);
    $activeGroupId = getActiveGroupId($conn, $userId);
    $role = getEffectiveRole($groups);

    return [
        "user_id" => (int) $user["user_id"],
        "name" => $user["name"],
        "email" => $user["email"],
        "active_group_id" => $activeGroupId,
        "role" => $role,
        "effective_role" => $role,
        "groups" => $groups
    ];
}
