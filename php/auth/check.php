<?php
session_start();
header("Content-Type: application/json");

if (isset($_SESSION["user_id"])) {
    echo json_encode([
        "logged_in" => true,
        "user_id" => $_SESSION["user_id"]
    ]);
    exit();
}

//fallback: remember me
if (isset($_COOKIE["remember_user"])) {
    $_SESSION["user_id"] = $_COOKIE["remember_user"];

    echo json_encode([
        "logged_in" => true,
        "user_id" => $_SESSION["user_id"]
    ]);
    exit();
}

echo json_encode(["logged_in" => false]);