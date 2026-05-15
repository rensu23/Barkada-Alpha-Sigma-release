export async function initProfilePage() {
  if (document.body.dataset.appPage !== "profile") return;
  window.location.replace("./settings.html");
}
