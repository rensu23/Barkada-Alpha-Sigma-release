export const CONTRIBUTION_FREQUENCIES = ["One-time", "Daily", "Weekly", "Monthly"];

export function isValidContributionFrequency(frequency) {
  return CONTRIBUTION_FREQUENCIES.includes(frequency);
}

export function contributionTypeFromFrequency(frequency) {
  return frequency === "One-time" ? "One-time" : "Recurring";
}

export function formatContributionFrequency(frequency) {
  return isValidContributionFrequency(frequency) ? frequency : "Unknown frequency";
}
