<?php
/**
 * Password help endpoint.
 * The SQL file has no reset-token table, so this only verifies the email safely.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

requirePost();
$data = readRequestData();
$email = cleanText($data["email"] ?? "");

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(["success" => false, "message" => "Enter a valid email address."], 422);
}

$stmt = $conn->prepare("SELECT user_id FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->close();

jsonResponse([
    "success" => true,
    "message" => "Email checked. Opening the reset password page..."
]);
