/*
  Thin API adapter for the PHP/MySQL migration.
  Keep this file free of sample records and local persistence.
*/

export function apiUrl(endpoint) {
  return new URL(`../../php/${endpoint}`, import.meta.url).href;
}

export async function fetchJson(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    credentials: "same-origin",
    headers: { Accept: "application/json", ...(options.headers || {}) },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!Object.keys(data).length) {
    throw new Error("The server returned an invalid response. Please try again.");
  }

  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed with HTTP ${response.status}.`);
  }

  if (data.success === false) {
    throw new Error(data.message || data.error || "Request failed.");
  }

  return data;
}

export async function postJson(endpoint, payload = {}) {
  return fetchJson(apiUrl(endpoint), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
