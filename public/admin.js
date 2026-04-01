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
let currentUnits = [];

// Filters
const rFilters = { search: "", type: "", available: "" };
const uFilters = { search: "", resource: "", available: "" };
const uFiltersUsers = { search: "", role: "" };
let rDebT;
let uDebT;

// Delete callback
let deleteCallback = null;

// Notifications
let notifications = [];
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
  t.classList.remove("hidden");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 3000);
}

// ── Modals ───────────────────────────────────────────
function closeModal(id) {
  $(id)?.classList.add("hidden");
}

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

// ── RESERVATIONS (COMPLETE) ───────────────────────────
const resFilters = { search: "", status: "" };
let resDebT;

async function loadReservations() {
  try {
    const params = new URLSearchParams({
      page: resPage,
      limit: resLimit,
      search: resFilters.search,
      status: resFilters.status,
    });
    const d = await api(`/admin/reservations?${params}`);
    currentReservations = d.data || [];
    renderReservations();
    renderReservationsPagination(d.total);
  } catch (e) {
    console.error(e);
    toast(e.message, true);
  }
}

function renderReservations() {
  const list = $("reservations-list");
  if (!currentReservations.length) {
    list.innerHTML = empty("Aucune réservation");
    return;
  }
  list.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Utilisateur</th><th>Ressource</th><th>Date</th><th>Durée</th><th>Statut</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${currentReservations
          .map((res) => {
            const startDate = new Date(res.startTime);
            const endDate = new Date(res.endTime);
            const duration = Math.round(
              (endDate - startDate) / (1000 * 60 * 60)
            );
            return `
              <tr>
                <td>${esc(
                  res.user?.name || res.user?.username || "Utilisateur"
                )}</td>
                <td>${esc(res.resource?.name || "Ressource")}</td>
                <td>${fmtDate(res.startTime)}</td>
                <td>${duration}h</td>
                <td><span class="status-badge ${res.status}">${
              STATUS[res.status] || res.status
            }</span></td>
                <td class="actions">
                  ${
                    res.status === "pending"
                      ? `<button class="btn-confirm" data-id="${res._id}" title="Confirmer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: 16px; height: 16px;">
                      <polyline points="20 6 9 17 4 17"/>
                      <path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7"/>
                    </svg>
                  </button>`
                      : ""
                  }
                  ${
                    res.status !== "cancelled"
                      ? `<button class="btn-cancel" data-id="${res._id}" title="Annuler">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="width: 16px; height: 16px;">
                      <line x1="18" y1="6" x2="6" y2="18"/>
                      <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>`
                      : ""
                  }
                  ${res.status === "cancelled" ? `<button class="btn-delete" data-id="${res._id}" title="Supprimer">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="width: 16px; height: 16px;">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>` : ""}
                </td>
              </tr>`;
          })
          .join("")}
      </tbody>
    </table>
  `;

  // Event listeners
  list.querySelectorAll(".btn-confirm").forEach((btn) => {
    btn.addEventListener("click", () => confirmReservation(btn.dataset.id));
  });
  list.querySelectorAll(".btn-cancel").forEach((btn) => {
    btn.addEventListener("click", () => cancelReservation(btn.dataset.id));
  });
  list.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteReservation(btn.dataset.id));
  });
}

function renderReservationsPagination(total) {
  const pages = Math.ceil(total / resLimit);
  const pagination = $("reservations-pagination");
  if (pages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  pagination.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
    .map(
      (p) =>
        `<button class="page-btn ${
          p === resPage ? "active" : ""
        }" data-page="${p}">${p}</button>`
    )
    .join("");

  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      changeReservationsPage(parseInt(btn.dataset.page))
    );
  });
}

function changeReservationsPage(page) {
  resPage = page;
  loadReservations();
}

async function confirmReservation(id) {
  try {
    await put(`/admin/reservations/${id}/confirm`);
    toast("Réservation confirmée");
    loadReservations();
  } catch (e) {
    toast(e.message, true);
  }
}

async function cancelReservation(id) {
  try {
    await put(`/admin/reservations/${id}/cancel`);
    toast("Réservation annulée");
    loadReservations();
  } catch (e) {
    toast(e.message, true);
  }
}

async function deleteReservation(id) {
  const res = currentReservations.find((r) => r._id === id);
  if (!res) return;
  $("delete-message").textContent = `Voulez-vous vraiment supprimer la réservation "${res.resource?.name || "Ressource"}" ?`;
  deleteCallback = async () => {
    try {
      await del(`/admin/reservations/${id}`);
      toast("Réservation supprimée");
      loadReservations();
    } catch (e) {
      toast(e.message, true);
    }
  };
  $("modal-delete").classList.remove("hidden");
}

// Filters
$("reservation-search")?.addEventListener("input", (e) => {
  resFilters.search = e.target.value;
  clearTimeout(resDebT);
  resDebT = setTimeout(loadReservations, 300);
});

$("reservation-status-filter")?.addEventListener("change", (e) => {
  resFilters.status = e.target.value;
  resPage = 1;
  loadReservations();
});

// ── USERS (COMPLETE) ──────────────────────────────────
async function loadUsers() {
  try {
    const params = new URLSearchParams({
      page: uPage,
      limit: uLimit,
      search: uFiltersUsers.search,
      role: uFiltersUsers.role,
    });
    const d = await api(`/admin/users?${params}`);
    currentUsers = d.data || [];
    renderUsers();
    renderUsersPagination(d.total);
  } catch (e) {
    console.error(e);
    toast(e.message, true);
  }
}

function renderUsers() {
  const list = $("users-list");
  if (!currentUsers.length) {
    list.innerHTML = empty("Aucun utilisateur");
    return;
  }
  list.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Nom</th><th>Email</th><th>Rôle</th><th>2FA</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${currentUsers
          .map(
            (u) => `
            <tr>
              <td>${esc(u.username || u.name || "")}</td>
              <td>${esc(u.email)}</td>
              <td><span class="role-badge ${u.role}">${
              u.role === "admin" ? "Admin" : "User"
            }</span></td>
              <td><span class="status-badge ${
                u.twoFactorEnabled ? "enabled" : "disabled"
              }">${u.twoFactorEnabled ? "Actif" : "Inactif"}</span></td>
              <td class="actions">
                <button class="btn-view" data-id="${u._id}" title="Voir">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: 16px; height: 16px;">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11 8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                </button>
                <button class="btn-delete" data-id="${u._id}" title="Supprimer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="width: 16px; height: 16px;">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  // Event listeners
  list.querySelectorAll(".btn-view").forEach((btn) => {
    btn.addEventListener("click", () => viewUser(btn.dataset.id));
  });
  list.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteUser(btn.dataset.id));
  });
}

function renderUsersPagination(total) {
  const pages = Math.ceil(total / uLimit);
  const pagination = $("users-pagination");
  if (pages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  pagination.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
    .map(
      (p) =>
        `<button class="page-btn ${
          p === uPage ? "active" : ""
        }" data-page="${p}">${p}</button>`
    )
    .join("");

  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      changeUsersPage(parseInt(btn.dataset.page))
    );
  });
}

function changeUsersPage(page) {
  uPage = page;
  loadUsers();
}

// User functions
async function viewUser(id) {
  try {
    const d = await api(`/admin/users/${id}`);
    const u = d.data;
    $("user-details").innerHTML = `
      <div class="user-detail-card">
        <div class="user-detail-header">
          <div class="user-detail-avatar">${(u.username ||
            u.name ||
            "U")[0].toUpperCase()}</div>
          <div class="user-detail-info">
            <h3>${esc(u.username || u.name || "")}</h3>
            <p>${esc(u.email)}</p>
          </div>
        </div>
        <div class="user-detail-fields">
          <div class="field-row">
            <label>Rôle:</label>
            <span class="role-badge ${u.role}">${
      u.role === "admin" ? "Administrateur" : "Utilisateur"
    }</span>
          </div>
          <div class="field-row">
            <label>2FA:</label>
            <span class="status-badge ${
              u.twoFactorEnabled ? "enabled" : "disabled"
            }">${u.twoFactorEnabled ? "Activé" : "Désactivé"}</span>
          </div>
          <div class="field-row">
            <label>Inscrit le:</label>
            <span>${fmt(u.createdAt)}</span>
          </div>
        </div>
      </div>
    `;
    $("modal-user").classList.remove("hidden");
  } catch (e) {
    toast(e.message, true);
  }
}

async function deleteUser(id) {
  const u = currentUsers.find((u) => u._id === id);
  if (!u) return;
  $(
    "delete-message"
  ).textContent = `Voulez-vous vraiment supprimer l'utilisateur "${
    u.username || u.name || u.email
  }" ?`;
  deleteCallback = async () => {
    try {
      await del(`/admin/users/${id}`);
      toast("Utilisateur supprimé");
      loadUsers();
    } catch (e) {
      toast(e.message, true);
    }
  };
  $("modal-delete").classList.remove("hidden");
}

// Filters
$("user-search")?.addEventListener("input", (e) => {
  uFiltersUsers.search = e.target.value;
  clearTimeout(uDebT);
  uDebT = setTimeout(loadUsers, 300);
});

$("user-role-filter")?.addEventListener("change", (e) => {
  uFiltersUsers.role = e.target.value;
  uPage = 1;
  loadUsers();
});

// ── RESOURCES ─────────────────────────────────────────
async function loadResources() {
  try {
    const params = new URLSearchParams({
      page: rPage,
      limit: rLimit,
      search: rFilters.search,
      type: rFilters.type,
      ...(rFilters.available && { available: rFilters.available }),
    });
    const d = await api(`/admin/resources?${params}`);
    currentResources = d.data || [];
    renderResources();
    renderResourcesPagination(d.total || 0);
  } catch (e) {
    console.error("Error loading resources:", e);
    toast(e.message, true);
  }
}

function renderResources() {
  const list = $("resources-list");
  if (!currentResources.length) {
    list.innerHTML = empty("Aucune ressource");
    return;
  }
  list.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Nom</th><th>Type</th><th>Capacité</th><th>Prix/heure</th><th>Dispo</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${currentResources
          .map(
            (r) => `
            <tr>
              <td>${esc(r.name)}</td>
              <td>${TYPES[r.type] || r.type}</td>
              <td>${r.capacity || "—"}</td>
              <td>${r.pricePerHour ? r.pricePerHour + "€" : "—"}</td>
              <td><span class="status-badge ${
                r.available !== false ? "available" : "unavailable"
              }">${r.available !== false ? "Dispo" : "Indispo"}</span></td>
              <td class="actions">
                <button class="btn-edit" data-id="${r._id}" title="Modifier">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: 16px; height: 16px;">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-delete" data-id="${r._id}" title="Supprimer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" style="width: 16px; height: 16px;">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                  </svg>
                </button>
              </td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>
  `;

  list.querySelectorAll(".btn-edit").forEach((btn) => {
    btn.addEventListener("click", () => editResource(btn.dataset.id));
  });
  list.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteResource(btn.dataset.id));
  });
}

// ── RESOURCES CRUD ───────────────────────────────────────
async function editResource(id) {
  try {
    const d = await api(`/admin/resources/${id}`);
    const resource = d.data;
    
    $("resource-form").dataset.id = id;
    
    // Vérifier si les éléments existent avant de les manipuler
    if ($("rf-name")) $("rf-name").value = resource.name;
    if ($("rf-type")) $("rf-type").value = resource.type;
    if ($("rf-description")) $("rf-description").value = resource.description || "";
    if ($("rf-capacity")) $("rf-capacity").value = resource.capacity || "";
    if ($("rf-price")) $("rf-price").value = resource.pricePerHour || "";
    if ($("rf-available")) $("rf-available").value = resource.available ? "true" : "false";
    
    const titleElement = document.querySelector("#resource-modal-title");
    if (titleElement) titleElement.textContent = "Modifier la ressource";
    
    const btnElement = $("resource-form-btn");
    if (btnElement) btnElement.textContent = "Mettre à jour";
    
    const modalElement = $("modal-resource");
    if (modalElement) modalElement.classList.remove("hidden");
  } catch (e) {
    console.error("Edit resource error:", e);
    toast(e.message, true);
  }
}

async function deleteResource(id) {
  const resource = currentResources.find((r) => r._id === id);
  if (!resource) return;
  
  $("delete-message").textContent = `Voulez-vous vraiment supprimer la ressource "${resource.name}" ?`;
  deleteCallback = async () => {
    try {
      await del(`/admin/resources/${id}`);
      toast("Ressource supprimée");
      loadResources();
    } catch (e) {
      toast(e.message, true);
    }
  };
  $("modal-delete").classList.remove("hidden");
}

// ── RESOURCES PAGINATION ───────────────────────────────────
function renderResourcesPagination(total) {
  const pages = Math.ceil(total / rLimit);
  const pagination = $("resources-pagination");
  if (pages <= 1) {
    pagination.innerHTML = "";
    return;
  }
  pagination.innerHTML = Array.from({ length: pages }, (_, i) => i + 1)
    .map(
      (p) =>
        `<button class="page-btn ${
          p === rPage ? "active" : ""
        }" data-page="${p}">${p}</button>`
    )
    .join("");

  pagination.querySelectorAll(".page-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      changeResourcesPage(parseInt(btn.dataset.page))
    );
  });
}

function changeResourcesPage(page) {
  rPage = page;
  loadResources();
}

// Resource form submission
$("resource-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const errEl = $("resource-form-error");
  const btn = e.target.querySelector("button[type=submit]");
  const btnSpan = btn ? btn.querySelector("span") : null;
  
  if (errEl) errEl.classList.add("hidden");
  if (btn) btn.disabled = true;
  if (btnSpan) btnSpan.textContent = "Enregistrement...";

  try {
    const formData = {
      name: $("rf-name")?.value || "",
      type: $("rf-type")?.value || "",
      description: $("rf-description")?.value || "",
      capacity: parseInt($("rf-capacity")?.value) || undefined,
      pricePerHour: parseFloat($("rf-price")?.value) || undefined,
      available: ($("rf-available")?.value) === "true",
    };

    const isEdit = $("resource-form")?.dataset.id;
    console.log("Form data:", formData, "Is edit:", isEdit); // Debug
    
    const d = isEdit 
      ? await put(`/admin/resources/${$("resource-form").dataset.id}`, formData)
      : await post("/admin/resources", formData);

    console.log("API response:", d); // Debug

    // Créer une notification immédiatement
    if (d.notification) {
      notifications.unshift(d.notification);
      updateNotificationBadge();
    }

    toast(isEdit ? "Ressource mise à jour" : "Ressource créée");
    closeModal("modal-resource");
    loadResources();
  } catch (err) {
    console.error("Form submission error:", err);
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  } finally {
    if (btn) btn.disabled = false;
    if (btnSpan) btnSpan.textContent = isEdit ? "Mettre à jour" : "Ajouter";
  }
});

// Add resource button
$("btn-add-resource")?.addEventListener("click", () => {
  if ($("resource-form")) {
    $("resource-form").reset();
    delete $("resource-form").dataset.id;
  }
  
  const titleElement = document.querySelector("#resource-modal-title");
  if (titleElement) titleElement.textContent = "Ajouter une ressource";
  
  const btnElement = $("resource-form-btn");
  if (btnElement) btnElement.textContent = "Ajouter";
  
  const modalElement = $("modal-resource");
  if (modalElement) modalElement.classList.remove("hidden");
});

// Cancel resource form
$("resource-form-cancel")?.addEventListener("click", () => {
  closeModal("modal-resource");
});

// Resource filters
$("resource-search")?.addEventListener("input", (e) => {
  rFilters.search = e.target.value;
  clearTimeout(rDebT);
  rDebT = setTimeout(loadResources, 300);
});

$("resource-type-filter")?.addEventListener("change", (e) => {
  rFilters.type = e.target.value;
  rPage = 1;
  loadResources();
});

$("resource-avail-filter")?.addEventListener("change", (e) => {
  rFilters.available = e.target.value;
  rPage = 1;
  loadResources();
});

// ── DASHBOARD ─────────────────────────────────────────
async function loadDashboard() {
  try {
    const d = await api("/admin/dashboard");
    const data = d.data;

    $("stat-users").textContent = data.stats.totalUsers || 0;
    $("stat-resources").textContent = data.stats.totalResources || 0;
    $("stat-available").textContent = data.stats.availableResources || 0;
    $("stat-reservations").textContent = data.stats.totalReservations || 0;

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

// ── AUTH & INIT ───────────────────────────────────────
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
    // Attendre que le DOM soit prêt avant de montrer l'app
    if (document.readyState === 'loading') {
      await new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', resolve);
      });
    }
    showApp();
    return true;
  } catch (e) {
    console.error("Auth error:", e);
    localStorage.removeItem("reserv_token");
    token = null;
    showAuth();
    return false;
  }
}

function showAuth() {
  console.log("showAuth called"); // Debug
  $("auth-screen")?.classList.remove("hidden");
  $("app-screen")?.classList.add("hidden");
  $("login-password")?.classList.remove("hidden");
  if ($("login-form-btn span")) {
    $("login-form-btn span").textContent = "Se connecter";
  }
  if ($("login-error")) {
    $("login-error").classList.add("hidden");
  }
  if ($("login-password")) {
    $("login-password").value = ""; // Vider le champ
    $("login-password").focus();
  }
  if ($("login-email")) {
    $("login-email").value = ""; // Vider le champ
  }
}

function showApp() {
  $("auth-screen")?.classList.add("hidden");
  $("app-screen")?.classList.remove("hidden");
  updateSidebarUser();
}

function updateSidebarUser() {
  const name = user.username || user.name || "A";
  const avatar = user.avatar ? `/uploads/${user.avatar}` : null;
  const el = $("sidebar-avatar");
  if (el) {
    el.innerHTML = avatar
      ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
      : name[0].toUpperCase();
  }
  if ($("sidebar-username")) {
    $("sidebar-username").textContent = name;
  }
  if ($("sidebar-role")) {
    $("sidebar-role").textContent =
      user.role === "admin" ? "administrateur" : "membre";
  }
}

// Login form
$("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  console.log("Login form submitted"); // Debug
  
  const errEl = $("login-error");
  const btn = e.target.querySelector("button[type=submit]");
  const btnSpan = btn.querySelector("span");
  
  errEl.classList.add("hidden");
  btn.disabled = true;
  btnSpan.textContent = "Connexion…";

  try {
    const d = await post("/auth/login", {
      email: $("login-email").value,
      password: $("login-password").value,
    });

    console.log("Login response:", d); // Debug

    token = d.token;
    localStorage.setItem("reserv_token", token);
    user = d.user;
    if (user.role !== "admin") {
      throw new Error("Accès restreint aux administrateurs");
    }
    showApp();
    loadDashboard();
    startNotificationPolling();
  } catch (e) {
    console.error("Login error:", e); // Debug
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btnSpan.textContent = "Se connecter";
  }
});

// Profile button
const profileBtn = $("open-profile-btn");
console.log("Profile button found:", !!profileBtn); // Debug

// Créer le modal profil dynamiquement s'il n'existe pas
function createProfileModal() {
  if (document.getElementById("modal-profile")) {
    return; // Le modal existe déjà
  }

  // Structure exacte du modal profil
  const modalHTML = `
    <div id="modal-profile" class="modal-overlay hidden">
      <div class="modal modal-profile">
        <button class="modal-close" data-close="modal-profile">✕</button>
        <div class="profile-modal-header">
          <div class="profile-avatar-wrap">
            <div class="profile-avatar-big" id="profile-avatar-display">U</div>
            <label class="avatar-upload-btn" title="Changer la photo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
              <input type="file" id="avatar-input" accept="image/*" style="display:none" />
            </label>
          </div>
          <div>
            <div class="profile-name" id="profile-name-display">—</div>
            <div class="profile-email-display" id="profile-email-display">—</div>
            <span class="badge confirmed" id="profile-role-display">membre</span>
          </div>
        </div>
        <div class="profile-section-title">Informations du compte</div>
        <div class="profile-info-row"><span class="profile-info-label">Nom d'utilisateur</span><span class="profile-info-value" id="info-username">—</span></div>
        <div class="profile-info-row"><span class="profile-info-label">Email</span><span class="profile-info-value" id="info-email">—</span></div>
        <div class="profile-info-row"><span class="profile-info-label">Rôle</span><span class="profile-info-value" id="info-role">—</span></div>
        <div class="profile-info-row" style="border:none"><span class="profile-info-label">Membre depuis</span><span class="profile-info-value" id="info-created">—</span></div>
        <div class="profile-section-title" style="margin-top:24px">Zone dangereuse</div>
        <div class="danger-zone">
          <div>
            <div style="font-size:.875rem;font-weight:500;color:var(--white)">Supprimer le compte</div>
            <div style="font-size:.8rem;color:var(--gray-400);margin-top:2px">Action irréversible. Toutes vos données seront supprimées.</div>
          </div>
          <button class="btn-danger" id="delete-account-btn">Supprimer</button>
        </div>
      </div>
    </div>

    <div id="modal-confirm" class="modal-overlay hidden">
      <div class="modal modal-sm">
        <h2 class="modal-title" style="color:var(--danger)">Supprimer le compte</h2>
        <p style="color:var(--gray-400);font-size:.9rem;margin-bottom:20px;line-height:1.6">Action <strong style="color:var(--white)">irréversible</strong>. Toutes vos réservations seront perdues.</p>
        <p style="color:var(--gray-400);font-size:.85rem;margin-bottom:12px">Tapez <strong style="color:var(--white)">SUPPRIMER</strong> pour confirmer :</p>
        <div class="field-group" style="margin-bottom:20px"><input type="text" id="confirm-delete-input" placeholder="SUPPRIMER" /></div>
        <div class="modal-actions">
          <button class="btn-secondary" id="cancel-delete-btn">Annuler</button>
          <button class="btn-danger" id="confirm-delete-btn">Supprimer définitivement</button>
        </div>
      </div>
    </div>
  `;

  // Ajouter le modal à la fin du body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  console.log("Profile modal created dynamically!"); // Debug
  
  // Attacher les event listeners pour le modal profil
  attachProfileModalListeners();
}

// Attacher les event listeners pour le modal profil
function attachProfileModalListeners() {
  // Fermeture du modal profil
  const profileCloseBtn = document.querySelector('[data-close="modal-profile"]');
  if (profileCloseBtn) {
    profileCloseBtn.addEventListener("click", () => {
      console.log("Profile modal close clicked"); // Debug
      closeModal("modal-profile");
    });
  }
  
  // Bouton supprimer compte
  const deleteAccountBtn = $("delete-account-btn");
  if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", () => {
      console.log("Delete account clicked"); // Debug
      $("modal-confirm").classList.remove("hidden");
    });
  }
  
  // Modal confirmation - annuler
  const cancelDeleteBtn = $("cancel-delete-btn");
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener("click", () => {
      console.log("Cancel delete clicked"); // Debug
      closeModal("modal-confirm");
    });
  }
  
  // Modal confirmation - confirmer
  const confirmDeleteBtn = $("confirm-delete-btn");
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener("click", () => {
      console.log("Confirm delete clicked"); // Debug
      const input = $("confirm-delete-input");
      if (input && input.value === "SUPPRIMER") {
        // Logique de suppression du compte
        toast("Fonctionnalité de suppression non implémentée");
        closeModal("modal-confirm");
        closeModal("modal-profile");
      } else {
        toast("Veuillez taper SUPPRIMER pour confirmer", true);
      }
    });
  }
}

if (profileBtn) {
  profileBtn.addEventListener("click", (e) => {
    console.log("Profile button clicked"); // Debug
    e.preventDefault();
    e.stopPropagation();
    
    // Créer le modal si nécessaire
    createProfileModal();
    
    // Rechercher le modal (devrait maintenant exister)
    let modalProfile = $("modal-profile");
    console.log("Modal profile found after creation:", !!modalProfile); // Debug
    
    loadProfile();
    
    if (modalProfile) {
      modalProfile.classList.remove("hidden");
      console.log("Modal opened successfully!"); // Debug
    } else {
      console.error("Modal profile still not found!");
    }
  });
} else {
  console.error("Profile button not found!");
}

// Debug global click handler
document.addEventListener("click", (e) => {
  if (e.target.closest("#open-profile-btn")) {
    console.log("Profile button clicked via delegation"); // Debug
    loadProfile();
    
    const modalProfile = $("modal-profile");
    console.log("Modal profile found (delegation):", !!modalProfile); // Debug
    
    if (modalProfile) {
      modalProfile.classList.remove("hidden");
    } else {
      console.error("Modal profile not found (delegation)!");
    }
  }
});

// Load profile data
function loadProfile() {
  console.log("Loading profile for user:", user); // Debug
  
  // Mettre à jour les informations du profil
  const nameDisplay = $("profile-name-display");
  const emailDisplay = $("profile-email-display");
  const roleDisplay = $("profile-role-display");
  const avatarDisplay = $("profile-avatar-display");
  
  if (nameDisplay) {
    nameDisplay.textContent = user.username || user.name || "—";
  }
  if (emailDisplay) {
    emailDisplay.textContent = user.email || "—";
  }
  if (roleDisplay) {
    roleDisplay.textContent = user.role === "admin" ? "administrateur" : "membre";
    roleDisplay.className = user.role === "admin" ? "badge confirmed" : "badge confirmed";
  }
  
  // Mettre à jour l'avatar
  if (avatarDisplay) {
    if (user.avatar) {
      avatarDisplay.innerHTML = `<img src="/uploads/${user.avatar}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" />`;
    } else {
      avatarDisplay.textContent = (user.username || user.name || "U")[0].toUpperCase();
      avatarDisplay.innerHTML = avatarDisplay.textContent;
    }
  }
  
  // Mettre à jour les informations détaillées
  if ($("info-username")) {
    $("info-username").textContent = user.username || user.name || "—";
  }
  if ($("info-email")) {
    $("info-email").textContent = user.email || "—";
  }
  if ($("info-role")) {
    $("info-role").textContent = user.role === "admin" ? "administrateur" : "membre";
  }
  if ($("info-created")) {
    const createdDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : "—";
    $("info-created").textContent = createdDate;
  }
}

// Change avatar button
$("change-avatar-btn")?.addEventListener("click", () => {
  $("avatar-input")?.click();
});

// Avatar input change
$("avatar-input")?.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const avatarDisplay = $("profile-avatar-display");
      if (avatarDisplay) {
        avatarDisplay.innerHTML = `<img src="${e.target.result}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" />`;
      }
    };
    reader.readAsDataURL(file);
    
    // Uploader l'avatar
    uploadAvatar(file);
  }
});

// Upload avatar function
async function uploadAvatar(file) {
  try {
    const formData = new FormData();
    formData.append("avatar", file);
    
    const response = await fetch("/api/admin/profile", {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      user = result.data;
      localStorage.setItem("reserv_token", token);
      updateSidebarUser();
      toast("Photo de profil mise à jour");
    } else {
      throw new Error(result.message || "Erreur lors de la mise à jour");
    }
  } catch (err) {
    console.error("Avatar upload error:", err);
    toast(err.message, true);
  }
}

// Profile form submission
$("profile-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const errEl = $("profile-form-error");
  const btn = e.target.querySelector("button[type=submit]");
  
  if (errEl) errEl.classList.add("hidden");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Enregistrement...";
  }

  try {
    const formData = new FormData();
    formData.append("username", $("profile-username")?.value || "");
    formData.append("email", $("profile-email")?.value || "");
    
    const avatarInput = $("avatar-input");
    if (avatarInput && avatarInput.files[0]) {
      formData.append("avatar", avatarInput.files[0]);
    }
    
    const response = await fetch("/api/admin/profile", {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${token}`
      },
      body: formData
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message || "Erreur lors de la mise à jour");
    }
    
    // Update local user data
    user = result.data;
    localStorage.setItem("reserv_token", token); // Keep token
    
    // Update UI
    updateSidebarUser();
    toast("Profil mis à jour avec succès");
    closeModal("modal-profile");
  } catch (err) {
    console.error("Profile update error:", err);
    if (errEl) {
      errEl.textContent = err.message;
      errEl.classList.remove("hidden");
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Enregistrer";
    }
  }
});

// Profile form cancel
$("profile-form-cancel")?.addEventListener("click", () => {
  closeModal("modal-profile");
});

// Logout
const logoutBtn = $("logout-btn");
console.log("Logout button found:", !!logoutBtn); // Debug

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    console.log("Logout clicked"); // Debug
    stopNotificationPolling();
    token = null;
    user = null;
    localStorage.removeItem("reserv_token");
    showAuth();
    toast("Déconnecté avec succès");
  });
} else {
  console.error("Logout button not found!");
}

// ── NOTIFICATIONS ─────────────────────────────────────
function startNotificationPolling() {
  if (notificationInterval) return;
  
  // Charger les notifications immédiatement au démarrage
  loadNotifications();
  
  notificationInterval = setInterval(async () => {
    try {
      const d = await api("/admin/notifications");
      const newNotifications = d.data || [];
      
      if (newNotifications.length > notifications.length) {
        updateNotificationBadge();
      }
      
      notifications = newNotifications;
      console.log("Notifications loaded:", notifications.length); // Debug
    } catch (e) {
      console.error("Notification polling error:", e);
    }
  }, 30000); // Check every 30 seconds
}

async function loadNotifications() {
  try {
    const d = await api("/admin/notifications");
    notifications = d.data || [];
    updateNotificationBadge();
    console.log("Initial notifications loaded:", notifications.length); // Debug
  } catch (e) {
    console.error("Error loading notifications:", e);
  }
}

function stopNotificationPolling() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}

function updateNotificationBadge() {
  const badge = $("notification-badge");
  if (badge) {
    const count = notifications.filter(n => !n.read).length;
    badge.textContent = count > 0 ? count : "";
    badge.classList.toggle("hidden", count === 0);
    console.log("Badge updated with count:", count); // Debug
  }
}

// Notification dropdown
$("notification-btn")?.addEventListener("click", () => {
  const dropdown = $("notification-dropdown");
  dropdown?.classList.toggle("hidden");
  
  if (!dropdown?.classList.contains("hidden")) {
    renderNotifications();
  }
});

function renderNotifications() {
  const list = $("notification-list");
  
  if (!notifications.length) {
    list.innerHTML = `<div class="notification-empty">Aucune notification</div>`;
    return;
  }
  
  console.log("Rendering notifications:", notifications.length); // Debug
  
  list.innerHTML = notifications
    .map(n => `
      <div class="notification-item ${n.read ? 'read' : 'unread'}">
        <div class="notification-content">
          <div class="notification-title">${esc(n.title)}</div>
          <div class="notification-message">${esc(n.message)}</div>
          <div class="notification-time">${fmtDate(n.createdAt)}</div>
        </div>
        ${!n.read ? `<button class="notification-mark-read" data-id="${n._id}">
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width: 14px; height: 14px;">
                    <polyline points="20 6 9 17 4 17"/>
                    <path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7"/>
                  </svg>
                </button>` : ''}
      </div>
    `)
    .join("");
    
  // Add event listeners for notification buttons
  list.querySelectorAll('.notification-mark-read').forEach(btn => {
    btn.addEventListener('click', () => markNotificationRead(btn.dataset.id));
  });
}

async function markNotificationRead(id) {
  try {
    await put(`/admin/notifications/${id}/read`);
    const notification = notifications.find(n => n._id === id);
    if (notification) {
      notification.read = true;
    }
    updateNotificationBadge();
    renderNotifications();
  } catch (e) {
    toast(e.message, true);
  }
}

// Close notification dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = $("notification-dropdown");
  const btn = $("notification-btn");
  
  if (dropdown && !dropdown.contains(e.target) && !btn.contains(e.target)) {
    dropdown.classList.add("hidden");
  }
});

// Clear all notifications
$("clear-notifications")?.addEventListener("click", async () => {
  try {
    await put("/admin/notifications/clear");
    notifications = [];
    updateNotificationBadge();
    renderNotifications();
    toast("Notifications effacées");
  } catch (e) {
    toast(e.message, true);
  }
});
function startNotificationPolling() {
  if (notificationInterval) return;

  notificationInterval = setInterval(async () => {
    try {
      const d = await api("/admin/notifications");
      notifications = d.data || [];
      updateNotificationBadge();
    } catch (e) {
      console.error("Notification polling error:", e);
    }
  }, 30000);
}

function stopNotificationPolling() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
}

function updateNotificationBadge() {
  const badge = $("notification-badge");
  if (badge) {
    const count = notifications.filter((n) => !n.read).length;
    badge.textContent = count > 0 ? count : "";
    badge.classList.toggle("hidden", count === 0);
  }
}

// ── MODALS & CLEANUP ──────────────────────────────────
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

$("cancel-delete-btn")?.addEventListener("click", () => {
  closeModal("modal-delete");
  deleteCallback = null;
});

$("confirm-delete-btn")?.addEventListener("click", async () => {
  if (deleteCallback) {
    await deleteCallback();
    closeModal("modal-delete");
    deleteCallback = null;
  }
});

$("user-form-cancel")?.addEventListener("click", () => {
  closeModal("modal-user");
});

// ── INIT ─────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  document
    .querySelectorAll(".modal-close[data-close]")
    .forEach((b) =>
      b.addEventListener("click", () => closeModal(b.dataset.close))
    );

  // Vérifier l'authentification immédiatement
  const isAuthenticated = await checkAuth();
  if (isAuthenticated) {
    loadDashboard();
    startNotificationPolling();
  }
});
