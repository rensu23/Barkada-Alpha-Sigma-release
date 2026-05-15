<?php
/**
 * Returns the current user's profile without password data.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

$userId = requireLogin();
$user = fetchSessionUser($conn, $userId);

jsonResponse([
    "success" => true,
    "profile" => $user
]);
