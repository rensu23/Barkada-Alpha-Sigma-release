export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return [...scope.querySelectorAll(selector)];
}

export function byId(id) {
  return document.getElementById(id);
}

export function wait(ms = 320) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function setText(selector, value, scope = document) {
  const element = qs(selector, scope);
  if (element) {
    element.textContent = value;
  }
}

export function initialsFromName(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function slugToTitle(slug = "") {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
