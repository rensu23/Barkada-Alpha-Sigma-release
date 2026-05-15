<?php
/**
 * Logout endpoint.
 */
require_once __DIR__ . "/../helpers/auth-guard.php";

startBarkadaSession();
session_unset();
session_destroy();

jsonResponse([
    "success" => true,
    "message" => "Logged out."
]);
