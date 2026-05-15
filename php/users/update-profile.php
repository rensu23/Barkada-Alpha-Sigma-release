<?php
/**
 * Updates the current user's name and email.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

requirePost();
$userId = requireLogin();
$data = readRequestData();

$name = cleanText($data["name"] ?? "");
$email = cleanText($data["email"] ?? "");

if ($name === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(["success" => false, "message" => "Enter a valid name and email."], 422);
}

$stmt = $conn->prepare("SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1");
$stmt->bind_param("si", $email, $userId);
$stmt->execute();
$exists = $stmt->get_result()->num_rows > 0;
$stmt->close();

if ($exists) {
    jsonResponse(["success" => false, "message" => "Email already belongs to another account."], 409);
}

$stmt = $conn->prepare("UPDATE users SET name = ?, email = ? WHERE user_id = ?");
$stmt->bind_param("ssi", $name, $email, $userId);
$stmt->execute();
$stmt->close();

startBarkadaSession();
$_SESSION["user_name"] = $name;
$_SESSION["user_email"] = $email;

jsonResponse([
    "success" => true,
    "message" => "Profile updated.",
    "profile" => fetchSessionUser($conn, $userId)
]);
