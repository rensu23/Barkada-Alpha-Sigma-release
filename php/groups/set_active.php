<?php
/**
 * Stores the selected active group in the PHP session.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();
$groupId = getIntValue($data["group_id"] ?? 0);

if ($groupId <= 0) {
    jsonResponse(["success" => false, "message" => "Valid group_id is required."], 422);
}

requireGroupMember($conn, $userId, $groupId);

startBarkadaSession();
$_SESSION["active_group_id"] = $groupId;

jsonResponse([
    "success" => true,
    "message" => "Active group changed.",
    "user" => buildSessionPayload($conn, $userId)
]);
