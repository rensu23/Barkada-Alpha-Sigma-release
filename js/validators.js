export function isRequired(value) {
  return String(value || "").trim().length > 0;
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function hasStrongEnoughPassword(value) {
  return String(value || "").length >= 8;
}

export function passwordsMatch(first, second) {
  return first === second;
}
