<?php
/**
 * Login endpoint.
 * Checks users.email, verifies the password, and stores the user in PHP session.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

requirePost();
$data = readRequestData();

$email = cleanText($data["email"] ?? "");
$password = (string) ($data["password"] ?? "");

if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $password === "") {
    jsonResponse(["success" => false, "message" => "Enter a valid email and password."], 422);
}

$stmt = $conn->prepare("SELECT user_id, name, email, password FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user) {
    jsonResponse(["success" => false, "message" => "Invalid email or password."], 401);
}

$storedPassword = $user["password"];
$passwordOk = password_verify($password, $storedPassword);

// Some old student test data may be plain text. If it matches, upgrade it to a hash.
if (!$passwordOk && hash_equals($storedPassword, $password)) {
    $passwordOk = true;
    $newHash = password_hash($password, PASSWORD_DEFAULT);
    $update = $conn->prepare("UPDATE users SET password = ? WHERE user_id = ?");
    $update->bind_param("si", $newHash, $user["user_id"]);
    $update->execute();
    $update->close();
}

if (!$passwordOk) {
    jsonResponse(["success" => false, "message" => "Invalid email or password."], 401);
}

startBarkadaSession();
session_regenerate_id(true);
$_SESSION["user_id"] = (int) $user["user_id"];
$_SESSION["user_name"] = $user["name"];
$_SESSION["user_email"] = $user["email"];
$_SESSION["active_group_id"] = getActiveGroupId($conn, (int) $user["user_id"]);

jsonResponse([
    "success" => true,
    "message" => "Login successful.",
    "user" => buildSessionPayload($conn, (int) $user["user_id"])
]);
