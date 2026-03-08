const API = "/api";
let token = localStorage.getItem("reserv_token");
let user = null;

// Pagination
let rPage = 1,
  resPage = 1,
  uPage = 1;
const rLimit = 15,
  resLimit = 15,
  uLimit = 15;

// Current data
let currentResources = [];
let currentReservations = [];
let currentUsers = [];

// Delete callback
let deleteCallback = null;

// Notifications - simple flag for new reservation
let hasNewReservation = false;

// Notification system variables
let notifications = [];
let unreadCount = 0;
let lastCheckTime = null;
let notificationInterval = null;

// Types mapping
const TYPES = {
  salle_reunion: "Salle de réunion",
  terrain_sport: "Terrain de sport",
  coworking: "Coworking",
  coiffeur: "Coiffeur",
  restaurant: "Restaurant",
  hotel: "Hôtel",
};

const TYPE_ICONS = {
  salle_reunion: "🏢",
  terrain_sport: "⚽",
  coworking: "💻",
  coiffeur: "✂️",
  restaurant: "🍽️",
  hotel: "🏨",
};

const STATUS = {
  confirmed: "Confirmée",
  pending: "En attente",
  cancelled: "Annulée",
};

// ── API Helpers ───────────────────────────────────────
async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    ...opts,
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.message || "Erreur serveur");
  return d;
}

const post = (p, b) => api(p, { method: "POST", body: JSON.stringify(b) });
const put = (p, b) => api(p, { method: "PUT", body: JSON.stringify(b) });
const del = (p) => api(p, { method: "DELETE" });

// ── DOM Helpers ───────────────────────────────────────
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "<")
    .replace(/>/g, ">");

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

const fmtDate = (d) => {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const empty = (msg) =>
  `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>${msg}</p></div>`;

// ── Toast ─────────────────────────────────────────────
let toastT;
function toast(msg, err) {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast${err ? " error" : ""}`;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 3000);
}

// ── Modals ───────────────────────────────────────────
function closeModal(id) {
  $(id)?.classList.add("hidden");
}

document
  .querySelectorAll(".modal-close[data-close]")
  .forEach((b) =>
    b.addEventListener("click", () => closeModal(b.dataset.close))
  );

document.querySelectorAll(".modal-overlay").forEach((o) =>
  o.addEventListener("click", (e) => {
    if (e.target === o) closeModal(o.id);
  })
);

// ── Auth ─────────────────────────────────────────────
async function checkAuth() {
  if (!token) {
    showAuth();
    return false;
  }
  try {
    const d = await api("/auth/me");
    user = d.user || d.data;
    if (user.role !== "admin") {
      toast("Accès restreint aux administrateurs", true);
      localStorage.removeItem("reserv_token");
      token = null;
      showAuth();
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem("reserv_token");
    token = null;
    showAuth();
    return false;
  }
}

function showAuth() {
  $("auth-screen").classList.remove("hidden");
  $("app-screen").classList.add("hidden");
}

function showApp() {
  $("auth-screen").classList.add("hidden");
  $("app-screen").classList.remove("hidden");
  updateSidebarUser();
}

function updateSidebarUser() {
  const name = user.username || user.name || "A";
  const avatar = user.avatar ? `/uploads/${user.avatar}` : null;
  const el = $("sidebar-avatar");
  el.innerHTML = avatar
    ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
    : name[0].toUpperCase();
  $("sidebar-username").textContent = name;
  $("sidebar-role").textContent =
    user.role === "admin" ? "administrateur" : "membre";
}

// Login
$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("login-error");
  const btn = e.target.querySelector("button[type=submit]");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.querySelector("span").textContent = "Connexion…";

  try {
    const d = await post("/auth/login", {
      email: $("login-email").value,
      password: $("login-password").value,
    });
    token = d.token;
    localStorage.setItem("reserv_token", token);
    user = d.user || d.data;

    if (user.role !== "admin") {
      throw new Error("Accès restreint aux administrateurs");
    }

    showApp();
    loadDashboard();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "Se connecter";
  }
});

// Logout
$("logout-btn").addEventListener("click", () => {
  stopNotificationPolling();
  token = null;
  user = null;
  localStorage.removeItem("reserv_token");
  showAuth();
});

// ── Navigation ────────────────────────────────────────
document.querySelectorAll(".nav-item").forEach((item) =>
  item.addEventListener("click", () => {
    document
      .querySelectorAll(".nav-item")
      .forEach((i) => i.classList.remove("active"));
    item.classList.add("active");
    switchView(item.dataset.view);
  })
);

document.querySelectorAll(".link-btn[data-goto]").forEach((btn) =>
  btn.addEventListener("click", () => {
    const v = btn.dataset.goto;
    document
      .querySelectorAll(".nav-item")
      .forEach((i) => i.classList.remove("active"));
    document
      .querySelector(`.nav-item[data-view="${v}"]`)
      ?.classList.add("active");
    switchView(v);
  })
);

function switchView(name) {
  document
    .querySelectorAll(".view")
    .forEach((v) => v.classList.remove("active"));
  $(`view-${name}`)?.classList.add("active");

  if (name === "dashboard") loadDashboard();
  if (name === "resources") loadResources();
  if (name === "reservations") loadReservations();
  if (name === "users") loadUsers();
}

// ── DASHBOARD ────────────────────────────────────────
async function loadDashboard() {
  try {
    const d = await api("/admin/dashboard");
    const data = d.data;

    // Stats - utilise totalReservations pour les réservations
    $("stat-users").textContent = data.stats.totalUsers || 0;
    $("stat-resources").textContent = data.stats.totalResources || 0;
    $("stat-available").textContent = data.stats.availableResources || 0;
    $("stat-reservations").textContent = data.stats.totalReservations || 0;

    // Recent users
    const recentUsers = data.recentUsers || [];
    $("recent-users").innerHTML =
      recentUsers.length === 0
        ? empty("Aucun utilisateur")
        : recentUsers
            .map(
              (u) => `
          <div class="recent-item">
            <div class="recent-item-icon">${(u.username ||
              "U")[0].toUpperCase()}</div>
            <div class="recent-item-info">
              <div class="recent-item-name">${esc(u.username)}</div>
              <div class="recent-item-meta">${esc(u.email)}</div>
            </div>
          </div>`
            )
            .join("");

    // Recent resources
    const recentResources = data.recentResources || [];
    $("recent-resources").innerHTML =
      recentResources.length === 0
        ? empty("Aucune ressource")
        : recentResources
            .map(
              (r) => `
          <div class="recent-item">
            <div class="recent-item-icon">${TYPE_ICONS[r.type] || "📦"}</div>
            <div class="recent-item-info">
              <div class="recent-item-name">${esc(r.name)}</div>
              <div class="recent-item-meta">${TYPES[r.type] || r.type}</div>
            </div>
            <span class="status-badge ${
              r.available !== false ? "available" : "unavailable"
            }">${r.available !== false ? "Dispo" : "Indispo"}</span>
          </div>`
            )
            .join("");

    // Resources by type
    const byType = data.stats.resourcesByType || [];
    $("resources-by-type").innerHTML = byType
      .map(
        (t) => `
        <div class="type-stat-item">
          <div class="type-stat-icon">${TYPE_ICONS[t._id] || "📦"}</div>
          <div class="type-stat-label">${TYPES[t._id] || t._id}</div>
          <div class="type-stat-value">${t.count}</div>
        </div>`
      )
      .join("");

    // Header date
    const now = new Date();
    $("header-date").innerHTML = `${now.toLocaleDateString("fr-FR", {
      weekday: "long",
    })}<br>${now.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })}`;
  } catch (e) {
    console.error(e);
    toast(e.message, true);
  }
}

// ── RESOURCES ────────────────────────────────────────
const rFilters = { search: "", type: "", available: "" };
let rDebT;

$("resource-search").addEventListener("input", (e) => {
  clearTimeout(rDebT);
  rDebT = setTimeout(() => {
    rFilters.search = e.target.value;
    rPage = 1;
    loadResources();
  }, 350);
});

$("resource-type-filter").addEventListener("change", (e) => {
  rFilters.type = e.target.value;
  rPage = 1;
  loadResources();
});

$("resource-avail-filter").addEventListener("change", (e) => {
  rFilters.available = e.target.value;
  rPage = 1;
  loadResources();
});

$("btn-add-resource").addEventListener("click", () => openResourceModal(null));

async function loadResources() {
  const el = $("resources-list");
  el.innerHTML =
    '<div class="skeleton" style="height:300px;border-radius:12px"></div>';

  const p = new URLSearchParams({ page: rPage, limit: rLimit });
  if (rFilters.search) p.set("search", rFilters.search);
  if (rFilters.type) p.set("type", rFilters.type);
  if (rFilters.available) p.set("available", rFilters.available);

  try {
    const d = await api(`/resources?${p}`);
    const list = d.data || d.resources || [];
    const total = d.total || list.length;
    const pages = Math.ceil(total / rLimit);
    currentResources = list;

    if (list.length === 0) {
      el.innerHTML = empty("Aucune ressource trouvée");
      renderPages("resources-pagination", rPage, pages, "resources");
      return;
    }

    el.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Nom</th>
            <th>Type</th>
            <th>Capacité</th>
            <th>Prix/h</th>
            <th>Disponibilité</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (r, i) => `
            <tr>
              <td style="font-weight:500;color:var(--white)">${esc(r.name)}</td>
              <td>${TYPES[r.type] || r.type}</td>
              <td>${r.capacity || "—"}</td>
              <td>${r.pricePerHour != null ? `${r.pricePerHour}€` : "—"}</td>
              <td><span class="status-badge ${
                r.available !== false ? "available" : "unavailable"
              }">${
                r.available !== false ? "Disponible" : "Indisponible"
              }</span></td>
              <td>
                <button class="action-btn edit-res-btn" data-index="${i}" title="Modifier">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button class="action-btn danger del-res-btn" data-index="${i}" title="Supprimer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    // Events
    el.querySelectorAll(".edit-res-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        openResourceModal(currentResources[parseInt(btn.dataset.index)])
      );
    });

    el.querySelectorAll(".del-res-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        deleteResource(currentResources[parseInt(btn.dataset.index)])
      );
    });

    renderPages("resources-pagination", rPage, pages, "resources");
  } catch (e) {
    el.innerHTML = empty(e.message);
  }
}

// Resource Modal
function openResourceModal(r) {
  const isEdit = !!r;
  $("resource-modal-title").textContent = isEdit
    ? "Modifier la ressource"
    : "Ajouter une ressource";
  $("resource-form-btn").textContent = isEdit ? "Modifier" : "Ajouter";
  $("resource-form").reset();
  $("resource-form-error").classList.add("hidden");

  if (r) {
    $("resource-id").value = r._id;
    $("rf-name").value = r.name || "";
    $("rf-type").value = r.type || "";
    $("rf-capacity").value = r.capacity || "";
    $("rf-price").value = r.pricePerHour ?? "";
    $("rf-description").value = r.description || "";
    $("rf-available").value = r.available !== false ? "true" : "false";
  } else {
    $("resource-id").value = "";
  }

  $("modal-resource").classList.remove("hidden");
}

$("resource-form-cancel").addEventListener("click", () =>
  closeModal("modal-resource")
);

$("resource-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("resource-form-error");
  const btn = e.target.querySelector("button[type=submit]");
  errEl.classList.add("hidden");
  btn.disabled = true;

  const id = $("resource-id").value;
  const body = {
    name: $("rf-name").value,
    type: $("rf-type").value,
    capacity: $("rf-capacity").value
      ? parseInt($("rf-capacity").value)
      : undefined,
    pricePerHour:
      $("rf-price").value !== "" ? parseFloat($("rf-price").value) : undefined,
    description: $("rf-description").value || undefined,
    available: $("rf-available").value === "true",
  };

  try {
    if (id) {
      await put(`/resources/${id}`, body);
      toast("Ressource modifiée !");
    } else {
      await post("/resources", body);
      toast("Ressource ajoutée !");
    }
    closeModal("modal-resource");
    loadResources();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

function deleteResource(r) {
  $(
    "delete-message"
  ).textContent = `Voulez-vous vraiment supprimer "${r.name}" ? Cette action est irréversible.`;
  deleteCallback = async () => {
    try {
      await del(`/resources/${r._id}`);
      toast("Ressource supprimée");
      closeModal("modal-delete");
      loadResources();
    } catch (e) {
      toast(e.message, true);
    }
  };
  $("modal-delete").classList.remove("hidden");
}

$("cancel-delete-btn").addEventListener("click", () =>
  closeModal("modal-delete")
);

$("confirm-delete-btn").addEventListener("click", () => {
  if (deleteCallback) {
    deleteCallback();
    deleteCallback = null;
  }
});

// ── RESERVATIONS ─────────────────────────────────────
const resFilters = { search: "", status: "" };
let resDebT;

$("reservation-search").addEventListener("input", (e) => {
  clearTimeout(resDebT);
  resDebT = setTimeout(() => {
    resFilters.search = e.target.value;
    resPage = 1;
    loadReservations();
  }, 350);
});

$("reservation-status-filter").addEventListener("change", (e) => {
  resFilters.status = e.target.value;
  resPage = 1;
  loadReservations();
});

async function loadReservations() {
  const el = $("reservations-list");
  el.innerHTML =
    '<div class="skeleton" style="height:300px;border-radius:12px"></div>';

  const p = new URLSearchParams({ page: resPage, limit: resLimit });
  if (resFilters.search) p.set("search", resFilters.search);
  if (resFilters.status) p.set("status", resFilters.status);

  try {
    const d = await api(`/reservations?${p}`);
    const list = d.data || d.reservations || [];
    const total = d.total || list.length;
    const pages = Math.ceil(total / resLimit);
    currentReservations = list;

    if (list.length === 0) {
      el.innerHTML = empty("Aucune réservation trouvée");
      renderPages("reservations-pagination", resPage, pages, "reservations");
      return;
    }

    el.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Titre</th>
            <th>Utilisateur</th>
            <th>Ressource</th>
            <th>Date</th>
            <th>Horaire</th>
            <th>Statut</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (r) => `
            <tr>
              <td style="font-weight:500;color:var(--white)">${esc(
                r.title || "—"
              )}</td>
              <td>
                <div class="user-cell">
                  <div class="user-cell-avatar">${(r.user?.username ||
                    "U")[0].toUpperCase()}</div>
                  <div class="user-cell-info">
                    <span class="user-cell-name">${esc(
                      r.user?.username || "—"
                    )}</span>
                    <span class="user-cell-email">${esc(
                      r.user?.email || ""
                    )}</span>
                  </div>
                </div>
              </td>
              <td>${esc(r.resource?.name || "—")}</td>
              <td style="font-family:var(--font-mono)">${fmt(r.date)}</td>
              <td style="font-family:var(--font-mono)">${r.startTime}–${
                r.endTime
              }</td>
              <td><span class="status-badge ${r.status}">${
                STATUS[r.status] || r.status
              }</span></td>
              <td>
                <button class="action-btn danger del-res-btn" data-id="${
                  r._id
                }" title="Supprimer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    // Add delete events for reservations
    el.querySelectorAll(".del-res-btn").forEach((btn) => {
      btn.addEventListener("click", () => deleteReservation(btn.dataset.id));
    });

    renderPages("reservations-pagination", resPage, pages, "reservations");
  } catch (e) {
    el.innerHTML = empty(e.message);
  }
}

// Supprimer une réservation
async function deleteReservation(id) {
  if (!confirm("Voulez-vous vraiment supprimer cette réservation ?")) return;

  try {
    await del(`/reservations/${id}`);
    toast("Réservation supprimée");
    loadReservations();
  } catch (e) {
    toast(e.message, true);
  }
}

// ── USERS ────────────────────────────────────────────
const uFilters = { search: "", role: "" };
let uDebT;

$("user-search").addEventListener("input", (e) => {
  clearTimeout(uDebT);
  uDebT = setTimeout(() => {
    uFilters.search = e.target.value;
    uPage = 1;
    loadUsers();
  }, 350);
});

$("user-role-filter").addEventListener("change", (e) => {
  uFilters.role = e.target.value;
  uPage = 1;
  loadUsers();
});

async function loadUsers() {
  const el = $("users-list");
  el.innerHTML =
    '<div class="skeleton" style="height:300px;border-radius:12px"></div>';

  const p = new URLSearchParams({ page: uPage, limit: uLimit });
  if (uFilters.search) p.set("search", uFilters.search);
  if (uFilters.role) p.set("role", uFilters.role);

  try {
    const d = await api(`/admin/users?${p}`);
    const list = d.data || [];
    const total = d.pagination?.total || list.length;
    const pages = d.pagination?.pages || Math.ceil(total / uLimit);
    currentUsers = list;

    if (list.length === 0) {
      el.innerHTML = empty("Aucun utilisateur trouvé");
      renderPages("users-pagination", uPage, pages, "users");
      return;
    }

    el.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Utilisateur</th>
            <th>Rôle</th>
            <th>Créé le</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list
            .map(
              (u, i) => `
            <tr>
              <td>
                <div class="user-cell">
                  <div class="user-cell-avatar">${(u.username ||
                    "U")[0].toUpperCase()}</div>
                  <div class="user-cell-info">
                    <span class="user-cell-name">${esc(u.username)}</span>
                    <span class="user-cell-email">${esc(u.email)}</span>
                  </div>
                </div>
              </td>
              <td><span class="role-badge ${u.role}">${
                u.role === "admin" ? "Admin" : "Utilisateur"
              }</span></td>
              <td style="font-family:var(--font-mono)">${fmt(u.createdAt)}</td>
              <td>
                ${
                  u.role !== "admin"
                    ? `
                <button class="action-btn success promote-btn" data-index="${i}" title="Promouvoir admin">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                </button>
                `
                    : ""
                }
                ${
                  u.role === "admin" && u._id !== user._id
                    ? `
                <button class="action-btn demote-btn" data-index="${i}" title="Rétrograder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>
                </button>
                `
                    : ""
                }
                ${
                  u.role !== "admin"
                    ? `
                <button class="action-btn danger del-user-btn" data-index="${i}" title="Supprimer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
                `
                    : ""
                }
              </td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>`;

    // Events
    el.querySelectorAll(".promote-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        changeUserRole(parseInt(btn.dataset.index), "admin")
      );
    });

    el.querySelectorAll(".demote-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        changeUserRole(parseInt(btn.dataset.index), "user")
      );
    });

    el.querySelectorAll(".del-user-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        deleteUser(currentUsers[parseInt(btn.dataset.index)])
      );
    });

    renderPages("users-pagination", uPage, pages, "users");
  } catch (e) {
    el.innerHTML = empty(e.message);
  }
}

async function changeUserRole(index, newRole) {
  const u = currentUsers[index];
  const action = newRole === "admin" ? "promouvoir" : "rétrograder";

  if (!confirm(`Voulez-vous ${action} "${u.username}" en ${newRole} ?`)) return;

  try {
    await put(`/admin/users/${u._id}/role`, { role: newRole });
    toast(`Utilisateur ${newRole === "admin" ? "promu" : "rétrogradé"} !`);
    loadUsers();
  } catch (e) {
    toast(e.message, true);
  }
}

function deleteUser(u) {
  $(
    "delete-message"
  ).textContent = `Voulez-vous vraiment supprimer l'utilisateur "${u.username}" ? Toutes ses réservations seront également supprimées.`;
  deleteCallback = async () => {
    try {
      await del(`/admin/users/${u._id}`);
      toast("Utilisateur supprimé");
      closeModal("modal-delete");
      loadUsers();
    } catch (e) {
      toast(e.message, true);
    }
  };
  $("modal-delete").classList.remove("hidden");
}

// ── Pagination ────────────────────────────────────────
function renderPages(containerId, cur, total, type) {
  const el = $(containerId);
  if (!el || total <= 1) {
    if (el) el.innerHTML = "";
    return;
  }

  let h = `<button class="page-btn" ${cur === 1 ? "disabled" : ""} data-page="${
    cur - 1
  }" data-type="${type}">‹</button>`;
  for (let i = 1; i <= total; i++)
    h += `<button class="page-btn ${
      i === cur ? "active" : ""
    }" data-page="${i}" data-type="${type}">${i}</button>`;
  h += `<button class="page-btn" ${
    cur === total ? "disabled" : ""
  } data-page="${cur + 1}" data-type="${type}">›</button>`;
  el.innerHTML = h;

  el.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const page = parseInt(btn.dataset.page);
      if (btn.dataset.type === "resources") {
        rPage = page;
        loadResources();
      } else if (btn.dataset.type === "reservations") {
        resPage = page;
        loadReservations();
      } else if (btn.dataset.type === "users") {
        uPage = page;
        loadUsers();
      }
    });
  });
}

// ── Init ─────────────────────────────────────────────
(async () => {
  const ok = await checkAuth();
  if (ok) {
    showApp();
    loadDashboard();
    // Démarrer le polling des notifications
    startNotificationPolling();
  }
})();

// ── NOTIFICATIONS SYSTEM ───────────────────────────────
// Basculer le dropdown des notifications
$("notification-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  $("notification-dropdown").classList.toggle("hidden");
});

// Fermer le dropdown en cliquant ailleurs
document.addEventListener("click", (e) => {
  const dropdown = $("notification-dropdown");
  const btn = $("notification-btn");
  if (
    !dropdown.classList.contains("hidden") &&
    !dropdown.contains(e.target) &&
    !btn.contains(e.target)
  ) {
    dropdown.classList.add("hidden");
  }
});

// Effacer toutes les notifications
$("clear-notifications").addEventListener("click", () => {
  notifications = [];
  unreadCount = 0;
  updateNotificationBadge();
  renderNotifications();
});

// Démarrer le polling des notifications (toutes les 30 secondes)
function startNotificationPolling() {
  // Première vérification immédiate
  checkNewReservations();

  // Puis toutes les 30 secondes
  notificationInterval = setInterval(checkNewReservations, 30000);
}

// Arrêter le polling (lors de la déconnexion)
function stopNotificationPolling() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}

// Vérifier les nouvelles réservations
async function checkNewReservations() {
  try {
    const params = new URLSearchParams();
    if (lastCheckTime) {
      params.set("since", lastCheckTime);
    }

    const d = await api(`/reservations/recent?${params}`);
    const newReservations = d.data || [];

    if (newReservations.length > 0) {
      // Marquer le dernier temps de vérification
      lastCheckTime = new Date().toISOString();

      // Ajouter les nouvelles réservations aux notifications
      const newNotifs = newReservations.map((r) => ({
        id: r._id,
        type: "reservation",
        title: "Nouvelle réservation",
        description: `${r.user?.username || "Un utilisateur"} a réservé "${
          r.resource?.name || "une ressource"
        }"`,
        time: r.createdAt,
        read: false,
      }));

      // Ajouter au début de la liste (éviter les doublons)
      const existingIds = notifications.map((n) => n.id);
      newNotifs.forEach((n) => {
        if (!existingIds.includes(n.id)) {
          notifications.unshift(n);
        }
      });

      // Garder seulement les 50 dernières notifications
      if (notifications.length > 50) {
        notifications = notifications.slice(0, 50);
      }

      // Compter les non lus
      unreadCount = notifications.filter((n) => !n.read).length;

      // Mettre à jour l'affichage
      updateNotificationBadge();
      renderNotifications();

      // Toast pour les nouvelles réservations
      if (newNotifs.length === 1) {
        toast(`📅 ${newNotifs[0].description}`);
      } else if (newNotifs.length > 1) {
        toast(`📅 ${newNotifs.length} nouvelles réservations`);
      }
    }
  } catch (e) {
    console.error("Erreur lors de la vérification des notifications:", e);
  }
}

// Mettre à jour le badge de notification
function updateNotificationBadge() {
  const badge = $("notification-badge");
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 99 ? "99+" : unreadCount;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// Afficher la liste des notifications
function renderNotifications() {
  const list = $("notification-list");

  if (notifications.length === 0) {
    list.innerHTML = `<div class="notification-empty">Aucune notification</div>`;
    return;
  }

  list.innerHTML = notifications
    .map(
      (n) => `
    <div class="notification-item ${n.read ? "" : "unread"}" data-id="${n.id}">
      <div class="notification-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <div class="notification-content">
        <div class="notification-title">${esc(n.title)}</div>
        <div class="notification-desc">${esc(n.description)}</div>
        <div class="notification-time">${fmtDate(n.time)}</div>
      </div>
    </div>
  `
    )
    .join("");

  // Ajouter les événements de clic pour marquer comme lu et naviguer
  list.querySelectorAll(".notification-item").forEach((item) => {
    item.addEventListener("click", () => {
      const id = item.dataset.id;
      const notif = notifications.find((n) => n.id === id);
      if (notif && !notif.read) {
        notif.read = true;
        unreadCount = Math.max(0, unreadCount - 1);
        updateNotificationBadge();
        item.classList.remove("unread");
      }
      // Fermer le dropdown et aller à la page des réservations
      $("notification-dropdown").classList.add("hidden");
      // Activer le bouton reservations dans la sidebar
      document
        .querySelectorAll(".nav-item")
        .forEach((i) => i.classList.remove("active"));
      document
        .querySelector('.nav-item[data-view="reservations"]')
        ?.classList.add("active");
      switchView("reservations");
    });
  });
}
