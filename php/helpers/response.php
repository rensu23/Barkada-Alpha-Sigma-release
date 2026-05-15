<?php
/**
 * Small helpers for JSON endpoints.
 * These keep request reading and responses consistent across the project.
 */

function jsonResponse(array $data, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header("Content-Type: application/json");
    echo json_encode($data);
    exit;
}

function readRequestData(): array
{
    $raw = file_get_contents("php://input");
    $json = json_decode($raw, true);

    if (is_array($json)) {
        return $json;
    }

    return $_POST;
}

function requirePost(): void
{
    if ($_SERVER["REQUEST_METHOD"] !== "POST") {
        jsonResponse(["success" => false, "message" => "POST request required."], 405);
    }
}

function cleanText(?string $value): string
{
    return trim((string) $value);
}

function toMoney($value): float
{
    return round((float) $value, 2);
}

function getIntValue($value): int
{
    return filter_var($value, FILTER_VALIDATE_INT, ["options" => ["min_range" => 1]]) ? (int) $value : 0;
}
