<?php
/**
 * Reset password endpoint.
 * Since barkada_db.sql has no reset-token table, this updates by email only.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

requirePost();
$data = readRequestData();

$email = cleanText($data["email"] ?? "");
$password = (string) ($data["password"] ?? "");
$confirmPassword = (string) ($data["confirm_password"] ?? $password);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(["success" => false, "message" => "Enter the email tied to your account."], 422);
}

if (strlen($password) < 8) {
    jsonResponse(["success" => false, "message" => "Password must be at least 8 characters."], 422);
}

if ($password !== $confirmPassword) {
    jsonResponse(["success" => false, "message" => "Passwords do not match."], 422);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $conn->prepare("UPDATE users SET password = ? WHERE email = ?");
$stmt->bind_param("ss", $hash, $email);
$stmt->execute();
$affected = $stmt->affected_rows;
$stmt->close();

if ($affected < 1) {
    jsonResponse(["success" => false, "message" => "Account email not found."], 404);
}

jsonResponse([
    "success" => true,
    "message" => "Password updated. You can now log in."
]);
