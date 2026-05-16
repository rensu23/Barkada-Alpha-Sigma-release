<?php

function allowedContributionFrequencies(): array
{
    return ["One-time", "Daily", "Weekly", "Monthly"];
}

function contributionTypeFromFrequency(string $frequency): string
{
    return $frequency === "One-time" ? "One-time" : "Recurring";
}

function validateContributionFrequency(string $frequency): void
{
    if (!in_array($frequency, allowedContributionFrequencies(), true)) {
        jsonResponse(["success" => false, "message" => "Invalid frequency."], 422);
    }
}

function normalizeContributionType(string $type, string $frequency): string
{
    $derivedType = contributionTypeFromFrequency($frequency);

    if ($type === "") {
        return $derivedType;
    }

    if (!in_array($type, ["One-time", "Recurring"], true) || $type !== $derivedType) {
        jsonResponse(["success" => false, "message" => "Invalid contribution type for the selected frequency."], 422);
    }

    return $type;
}
