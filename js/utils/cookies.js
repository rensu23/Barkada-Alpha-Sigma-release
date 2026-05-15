export function setCookie(name, value, maxAgeSeconds = 86400) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}`;
}

export function getCookie(name) {
  const target = `${encodeURIComponent(name)}=`;
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith(target))
    ?.slice(target.length) || "";
}

export function clearCookie(name) {
  document.cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;
}
