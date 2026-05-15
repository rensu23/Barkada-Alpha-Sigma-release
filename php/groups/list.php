<?php
/**
 * Returns the groups joined by the logged-in user.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();

jsonResponse([
    "success" => true,
    "groups" => fetchUserGroups($conn, $userId)
]);
