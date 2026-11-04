const $ = (selector) => document.querySelector(selector);
const authModal = $("#authModal");
const dashboard = $("#dashboard");
let authMode = "login";
let toastTimer;

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    credentials: "same-origin"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Wystąpił nieoczekiwany błąd.");
  return data;
}
function openAuth(mode = "login") {
  setAuthMode(mode);
  authModal.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeAuth() {
  authModal.hidden = true;
  document.body.style.overflow = "";
}
function setAuthMode(mode) {
  authMode = mode;
  document.querySelectorAll(".auth-tabs button").forEach(btn => btn.classList.toggle("active", btn.dataset.mode === mode));
  $("#nameField").hidden = mode !== "register";
  $("#authTitle").innerHTML = mode === "login" ? "Witaj <em>ponownie.</em>" : "Dołącz <em>do nas.</em>";
  $("#authSubmit").innerHTML = mode === "login" ? "Zaloguj się <span>↗</span>" : "Utwórz konto <span>↗</span>";
  $("#authForm").elements.password.autocomplete = mode === "login" ? "current-password" : "new-password";
  $("#authStatus").textContent = mode === "register" ? "Hasło powinno mieć co najmniej 10 znaków." : "";
}
function openDashboard(user) {
  $("#userName").textContent = user.name;
  $("#userEmail").textContent = user.email;
  $("#memberSince").textContent = user.createdAt ? `Konto utworzone: ${new Date(user.createdAt.replace(" ", "T") + "Z").toLocaleDateString("pl-PL")}` : "";
  dashboard.hidden = false;
  document.body.style.overflow = "hidden";
}
function closeDashboard() {
  dashboard.hidden = true;
  document.body.style.overflow = "";
}

$("#openLogin").addEventListener("click", async () => {
  try {
    const { user } = await api("/api/me");
    if (user) openDashboard(user);
    else openAuth("login");
  } catch { openAuth("login"); }
});
$("#closeModal").addEventListener("click", closeAuth);
$("#closeDashboard").addEventListener("click", closeDashboard);
authModal.addEventListener("click", e => { if (e.target === authModal) closeAuth(); });
dashboard.addEventListener("click", e => { if (e.target === dashboard) closeDashboard(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { closeAuth(); closeDashboard(); } });
document.querySelectorAll(".auth-tabs button").forEach(btn => btn.addEventListener("click", () => setAuthMode(btn.dataset.mode)));

$("#authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  const payload = Object.fromEntries(form.entries());
  const status = $("#authStatus");
  const submit = $("#authSubmit");
  submit.disabled = true;
  status.textContent = "Proszę czekać…";
  try {
    const result = await api(authMode === "login" ? "/api/login" : "/api/register", { method: "POST", body: JSON.stringify(payload) });
    closeAuth();
    e.currentTarget.reset();
    openDashboard(result.user);
    toast(authMode === "login" ? "Zalogowano pomyślnie." : "Konto zostało utworzone.");
  } catch (error) {
    status.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

$("#logoutButton").addEventListener("click", async () => {
  try {
    await api("/api/logout", { method: "POST", body: "{}" });
    closeDashboard();
    toast("Wylogowano.");
  } catch (error) { toast(error.message); }
});

$("#contactForm").addEventListener("submit", async e => {
  e.preventDefault();
  const form = e.currentTarget;
  const button = form.querySelector("button");
  const status = $("#contactStatus");
  button.disabled = true;
  status.textContent = "Wysyłanie wiadomości…";
  try {
    const payload = Object.fromEntries(new FormData(form).entries());
    const result = await api("/api/contact", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    status.textContent = result.message;
    toast("Wiadomość została zapisana.");
  } catch (error) { status.textContent = error.message; }
  finally { button.disabled = false; }
});

$("#menuToggle").addEventListener("click", () => $("#nav").classList.toggle("open"));
$("#nav").querySelectorAll("a").forEach(link => link.addEventListener("click", () => $("#nav").classList.remove("open")));
$("#year").textContent = new Date().getFullYear();

(async () => {
  try {
    const { user } = await api("/api/me");
    if (user) $("#openLogin").textContent = "Moje konto";
  } catch {}
})();
