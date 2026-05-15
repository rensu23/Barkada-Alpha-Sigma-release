<?php
/**
 * Registration endpoint.
 * Creates one users row using only the columns in barkada_db.sql.
 */

require_once __DIR__ . "/../helpers/auth-guard.php";

requirePost();
$data = readRequestData();

$name = cleanText($data["name"] ?? "");
$email = cleanText($data["email"] ?? "");
$password = (string) ($data["password"] ?? "");
$confirmPassword = (string) ($data["confirm_password"] ?? $password);

if ($name === "" || $email === "" || $password === "") {
    jsonResponse(["success" => false, "message" => "All fields are required.", "error" => "All fields are required."], 422);
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse(["success" => false, "message" => "Invalid email format.", "error" => "Invalid email format."], 422);
}

if (strlen($password) < 8) {
    jsonResponse(["success" => false, "message" => "Password must be at least 8 characters.", "error" => "Password must be at least 8 characters."], 422);
}

if ($password !== $confirmPassword) {
    jsonResponse(["success" => false, "message" => "Passwords do not match.", "error" => "Passwords do not match."], 422);
}

$stmt = $conn->prepare("SELECT user_id FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$exists = $stmt->get_result()->num_rows > 0;
$stmt->close();

if ($exists) {
    jsonResponse(["success" => false, "message" => "Email already registered.", "error" => "Email already registered."], 409);
}

$hashedPassword = password_hash($password, PASSWORD_DEFAULT);

$stmt = $conn->prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $name, $email, $hashedPassword);
$stmt->execute();
$stmt->close();

jsonResponse([
    "success" => true,
    "message" => "Registration successful. You can now log in."
]);
?>
