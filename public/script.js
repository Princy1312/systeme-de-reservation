const API = "/api";
let token = localStorage.getItem("reserv_token");
let user = null;
let rPage = 1,
  resPage = 1;
let currentResources = [];
let currentReservations = [];
let currentDetailResource = null;
let editingResourceId = null;

const TYPES = {
  salle_reunion: "Salle de réunion",
  terrain_sport: "Terrain de sport",
  coworking: "Coworking",
  coiffeur: "Coiffeur",
};
const ICONS = {
  salle_reunion: "🏢",
  terrain_sport: "⚽",
  coworking: "💻",
  coiffeur: "✂️",
};
const STATUS = {
  confirmed: "Confirmée",
  pending: "En attente",
  cancelled: "Annulée",
};

// ── API ──────────────────────────────────────────────
async function api(path, opts = {}) {
  // Utiliser le token stocké (peut venir de la page de code)
  const currentToken = localStorage.getItem("token") || localStorage.getItem("reserv_token");
  
  const res = await fetch(API + path, {
    headers: {
      "Content-Type": "application/json",
      ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
    },
    ...opts,
  });
  const d = await res.json();
  if (!res.ok) throw new Error(d.message || "Erreur serveur");
  return d;
}
const post = (p, b) => api(p, { method: "POST", body: JSON.stringify(b) });
const put = (p, b) => api(p, { method: "PUT", body: JSON.stringify(b) });
const patch = (p, b = {}) =>
  api(p, { method: "PATCH", body: JSON.stringify(b) });
const del = (p) => api(p, { method: "DELETE" });

// ── Helpers ──────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";
const empty = (msg) =>
  `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>${msg}</p></div>`;
const isAdmin = () => user?.role === "admin";

let toastT;
function toast(msg, err) {
  const t = $("toast");
  t.textContent = msg;
  t.className = `toast${err ? " error" : ""}`;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add("hidden"), 3000);
}

function closeModal(id) {
  $(id)?.classList.add("hidden");
}

// ── Auth tabs ────────────────────────────────────────
document.querySelectorAll(".tab-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".auth-form")
      .forEach((f) => f.classList.remove("active"));
    btn.classList.add("active");
    $(`${btn.dataset.tab}-form`).classList.add("active");
  })
);

// ── Auth submit ──────────────────────────────────────
async function authSubmit(formId, endpoint, getBody, btnText, loadingText) {
  const form = $(formId);
  const errEl = form.querySelector(".form-error");
  const btn = form.querySelector("button[type=submit]");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.querySelector("span").textContent = loadingText;
  try {
    const d = await post(endpoint, getBody());
    token = d.token;
    localStorage.setItem("reserv_token", token);
    user = d.user || d.data;
    launchApp();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = btnText;
  }
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = $("login-form");
  const errEl = form.querySelector(".form-error");
  const btn = form.querySelector("#login-btn");
  const email = $("login-email").value;
  const password = $("login-password").value;
  const codeGroup = $("code-group");
  const codeInputs = document.querySelectorAll('.code-input');
  
  errEl.classList.add("hidden");
  btn.disabled = true;
  
  // Si le groupe de code est visible, vérifier le code
  if (codeGroup.style.display !== 'none') {
    btn.querySelector("span").textContent = "Vérification...";
    
    const code = Array.from(codeInputs).map(input => input.value).join('');
    
    if (code.length !== 6) {
      errEl.textContent = "Veuillez entrer les 6 chiffres du code";
      errEl.classList.remove("hidden");
      btn.disabled = false;
      btn.querySelector("span").textContent = "Se connecter";
      return;
    }
    
    try {
      const response = await fetch(API + "/auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        token = data.token;
        localStorage.setItem("token", token);
        localStorage.removeItem("pendingEmail");
        user = data.user || data.data;
        launchApp();
      } else {
        errEl.textContent = data.message || "Code invalide";
        errEl.classList.remove("hidden");
        clearCodeInputs();
      }
    } catch (error) {
      errEl.textContent = "Erreur de connexion. Veuillez réessayer.";
      errEl.classList.remove("hidden");
    }
  } else {
    // Vérifier les identifiants et envoyer le code
    btn.querySelector("span").textContent = "Connexion...";
    
    try {
      // D'abord vérifier les identifiants
      const response = await fetch(API + "/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Email ou mot de passe incorrect");
      }
      
      // Si l'utilisateur existe, envoyer le code
      if (data.success || data.user) {
        // Sauvegarder l'email pour la suite
        localStorage.setItem('pendingEmail', email);
        
        // Envoyer le code
        const codeResponse = await fetch(API + "/auth/send-code", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });
        
        const codeData = await codeResponse.json();
        
        if (!codeResponse.ok) {
          throw new Error(codeData.message || "Erreur lors de l'envoi du code");
        }
        
        // Afficher le champ de code
        codeGroup.style.display = 'block';
        btn.querySelector("span").textContent = "Vérifier";
        clearCodeInputs();
        codeInputs[0].focus();
        toast("Code envoyé à votre email");
      }
    } catch (error) {
      errEl.textContent = error.message;
      errEl.classList.remove("hidden");
    }
  }
  
  btn.disabled = false;
  if (codeGroup.style.display === 'none') {
    btn.querySelector("span").textContent = "Se connecter";
  }
});

// Gérer la saisie des champs de code
document.querySelectorAll('.code-input').forEach((input, index) => {
  input.addEventListener('input', function(e) {
    const value = e.target.value;
    
    // N'accepter que les chiffres
    if (!/^\d$/.test(value)) {
      e.target.value = '';
      return;
    }
    
    // Passer au champ suivant
    if (value && index < 5) {
      document.getElementById(`code-${index + 2}`).focus();
    }
  });
  
  input.addEventListener('keydown', function(e) {
    // Gérer la touche Retour arrière
    if (e.key === 'Backspace' && !e.target.value && index > 0) {
      document.getElementById(`code-${index}`).focus();
      document.getElementById(`code-${index}`).value = '';
    }
  });
  
  input.addEventListener('paste', function(e) {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const digits = pastedData.replace(/\D/g, '').slice(0, 6);
    
    digits.split('').forEach((digit, i) => {
      if (i < 6) {
        document.getElementById(`code-${i + 1}`).value = digit;
      }
    });
    
    // Focus sur le dernier champ rempli
    const lastIndex = Math.min(digits.length, 6);
    if (lastIndex > 0) {
      document.getElementById(`code-${lastIndex}`).focus();
    }
  });
});

// Bouton renvoyer le code
$("resend-code-btn")?.addEventListener("click", async function() {
  const email = $("login-email").value;
  
  if (!email) {
    toast("Veuillez d'abord entrer votre email");
    return;
  }
  
  try {
    const response = await fetch(API + "/auth/send-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });
    
    const data = await response.json();
    
    if (data.success) {
      toast("Nouveau code envoyé");
      clearCodeInputs();
      document.getElementById('code-1').focus();
    } else {
      toast(data.message || "Erreur lors de l'envoi");
    }
  } catch (error) {
    toast("Erreur de connexion");
  }
});

function clearCodeInputs() {
  document.querySelectorAll('.code-input').forEach(input => {
    input.value = '';
  });
}

$("register-form").addEventListener("submit", (e) => {
  e.preventDefault();
  authSubmit(
    "register-form",
    "/auth/register",
    () => ({
      username: $("reg-username").value,
      email: $("reg-email").value,
      password: $("reg-password").value,
    }),
    "Créer le compte",
    "Création…"
  );
});

// ── App launch ───────────────────────────────────────
async function launchApp() {
  // Utiliser le token stocké (peut venir de la page de code)
  token = localStorage.getItem("token") || localStorage.getItem("reserv_token");
  
  if (!token) {
    showAuth();
    return;
  }
  if (!user) {
    try {
      const d = await api("/auth/me");
      user = d.user || d.data;
    } catch {
      localStorage.removeItem("token");
      localStorage.removeItem("reserv_token");
      token = null;
      showAuth();
      return;
    }
  }

  // Si admin, rediriger directement vers admin.html
  if (user.role === "admin") {
    window.location.href = "admin.html";
    return;
  }

  $("auth-screen").classList.add("hidden");
  $("app-screen").classList.remove("hidden");
  updateSidebarUser();

  const now = new Date();
  $("header-date").innerHTML = `${now.toLocaleDateString("fr-FR", {
    weekday: "long",
  })}<br>${now.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
  $("welcome-msg").textContent = `Bonjour, ${
    user.username || user.name || "vous"
  }.`;
  loadDashboard();
}

function showAuth() {
  $("auth-screen").classList.remove("hidden");
  $("app-screen").classList.add("hidden");
}

function updateSidebarUser() {
  const name = user.username || user.name || "U";
  const avatar = user.avatar ? `/uploads/${user.avatar}` : null;
  const el = $("sidebar-avatar");
  el.innerHTML = avatar
    ? `<img src="${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" />`
    : name[0].toUpperCase();
  $("sidebar-username").textContent = name;
  $("sidebar-role").textContent = user.role || "membre";
}

$("logout-btn").addEventListener("click", () => {
  token = null;
  user = null;
  localStorage.removeItem("reserv_token");
  showAuth();
});

// ── Navigation ───────────────────────────────────────
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
  if (name === "resources") loadResources();
  if (name === "reservations") loadMyReservations();
  if (name === "admin") loadAdminPanel();
}

// ── Dashboard ────────────────────────────────────────
async function loadDashboard() {
  try {
    const [rd, rv] = await Promise.all([
      api("/resources?limit=100"),
      api("/reservations/my?limit=100"),
    ]);
    const resources = rd.data || rd.resources || [];
    const reservations = rv.data || rv.reservations || [];

    $("stat-resources").textContent = resources.filter(
      (r) => r.available !== false
    ).length;
    $("stat-my-reservations").textContent = reservations.length;
    $("stat-active").textContent = reservations.filter(
      (r) => r.status === "confirmed"
    ).length;

    $("recent-reservations").innerHTML =
      reservations.length === 0
        ? empty("Aucune réservation")
        : reservations
            .slice(0, 5)
            .map(
              (r) => `
        <div class="reservation-item">
          <div class="res-dot ${r.status}"></div>
          <div class="res-info">
            <div class="res-title">${esc(r.title || "Sans titre")}</div>
            <div class="res-meta">${fmt(r.date)} · ${r.startTime}–${
                r.endTime
              }</div>
          </div>
          <span class="badge ${r.status}">${STATUS[r.status] || r.status}</span>
        </div>`
            )
            .join("");

    $("popular-resources").innerHTML = resources
      .slice(0, 5)
      .map(
        (r) => `
      <div class="resource-mini-item">
        <div>
          <div style="font-size:.875rem;font-weight:500;color:var(--white)">${esc(
            r.name
          )}</div>
          <div style="font-size:.75rem;color:var(--gray-400);margin-top:2px">${
            TYPES[r.type] || r.type
          }</div>
        </div>
        <span class="res-type-tag">${ICONS[r.type] || "📦"}</span>
      </div>`
      )
      .join("");
  } catch (e) {
    console.error(e);
  }
}

// ── Resources ────────────────────────────────────────
const filters = { search: "", type: "", available: "" };
let debT;

$("resource-search").addEventListener("input", (e) => {
  clearTimeout(debT);
  debT = setTimeout(() => {
    filters.search = e.target.value;
    rPage = 1;
    loadResources();
  }, 350);
});
$("resource-type-filter").addEventListener("change", (e) => {
  filters.type = e.target.value;
  rPage = 1;
  loadResources();
});
$("resource-avail-filter").addEventListener("change", (e) => {
  filters.available = e.target.value;
  rPage = 1;
  loadResources();
});

async function loadResources() {
  const grid = $("resources-grid");
  grid.innerHTML =
    '<div class="skeleton" style="height:200px;border-radius:12px;grid-column:1/-1"></div>';
  const p = new URLSearchParams({ page: rPage, limit: 9 });
  if (filters.search) p.set("search", filters.search);
  if (filters.type) p.set("type", filters.type);
  if (filters.available) p.set("available", filters.available);
  try {
    const d = await api(`/resources?${p}`);
    const list = d.data || d.resources || [];
    const pages = d.totalPages || Math.ceil((d.total || list.length) / 9);
    currentResources = list;
    grid.innerHTML =
      list.length === 0
        ? `<div style="grid-column:1/-1">${empty(
            "Aucune ressource trouvée"
          )}</div>`
        : list.map((r, i) => resCard(r, i)).join("");
    grid.querySelectorAll(".resource-card").forEach((card, i) => {
      card.addEventListener("click", () => openDetail(currentResources[i]));
      card.querySelector(".btn-book")?.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openBook(currentResources[i]);
      });
    });
    renderPages("resources-pagination", rPage, pages, "resources");
  } catch (e) {
    grid.innerHTML = `<div style="grid-column:1/-1">${empty(e.message)}</div>`;
  }
}

function resCard(r, i) {
  const ok = r.available !== false;
  return `<div class="resource-card" data-index="${i}">
    <div class="resource-card-top">
      <span class="resource-card-icon">${ICONS[r.type] || "📦"}</span>
      <div class="resource-avail-pill ${
        ok ? "available" : "unavailable"
      }"></div>
    </div>
    <div class="resource-card-body">
      <div class="resource-card-name">${esc(r.name)}</div>
      <div class="resource-card-type">${TYPES[r.type] || r.type}</div>
      ${
        r.capacity
          ? `<div class="resource-card-capacity"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>${r.capacity} personnes</div>`
          : ""
      }
    </div>
    <div class="resource-card-footer">
      <span class="resource-price">${
        r.pricePerHour ? `${r.pricePerHour}€/h` : "Gratuit"
      }</span>
      <button class="btn-book" ${ok ? "" : "disabled"}>${
    ok ? "Réserver" : "Indisponible"
  }</button>
    </div>
  </div>`;
}

function openDetail(r) {
  currentDetailResource = r;
  const ok = r.available !== false;
  $("modal-resource-content").innerHTML = `
    <div class="resource-detail-header">
      <div class="resource-detail-icon-big">${ICONS[r.type] || "📦"}</div>
      <div>
        <div class="resource-detail-name">${esc(r.name)}</div>
        <div style="color:var(--gray-400);font-size:.875rem;margin-top:4px">${
          TYPES[r.type] || r.type
        }</div>
      </div>
    </div>
    <div class="resource-detail-attrs">
      <div class="attr-item"><div class="attr-label">Disponibilité</div><div class="attr-value" style="color:${
        ok ? "var(--success)" : "var(--gray-400)"
      }">${ok ? "✓ Disponible" : "✗ Indisponible"}</div></div>
      ${
        r.capacity
          ? `<div class="attr-item"><div class="attr-label">Capacité</div><div class="attr-value">${r.capacity} personnes</div></div>`
          : ""
      }
      ${
        r.pricePerHour != null
          ? `<div class="attr-item"><div class="attr-label">Tarif</div><div class="attr-value">${
              r.pricePerHour ? `${r.pricePerHour}€/h` : "Gratuit"
            }</div></div>`
          : ""
      }
      ${
        r.location
          ? `<div class="attr-item"><div class="attr-label">Emplacement</div><div class="attr-value">${esc(
              r.location
            )}</div></div>`
          : ""
      }
    </div>
    ${
      r.description
        ? `<p style="color:var(--gray-400);font-size:.9rem;margin-bottom:24px;line-height:1.6">${esc(
            r.description
          )}</p>`
        : ""
    }
    ${
      ok
        ? `<button class="btn-primary" id="btn-reserver-maintenant"><span>Réserver maintenant</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg></button>`
        : ""
    }`;
  const btnR = $("btn-reserver-maintenant");
  if (btnR)
    btnR.addEventListener("click", () => {
      closeModal("modal-resource");
      openBook(currentDetailResource);
    });
  $("modal-resource").classList.remove("hidden");
}

function openBook(r) {
  $("book-resource-id").value = r._id;
  $("modal-book").querySelector(
    ".modal-title"
  ).textContent = `Réserver — ${r.name}`;
  $("book-form").reset();
  $("avail-status").classList.add("hidden");
  $("book-error").classList.add("hidden");
  $("book-date").min = new Date().toISOString().split("T")[0];
  $("modal-book").classList.remove("hidden");
}

$("check-avail-btn").addEventListener("click", async () => {
  const s = $("avail-status");
  const date = $("book-date").value,
    start = $("book-start").value,
    end = $("book-end").value;
  if (!date || !start || !end) {
    toast("Remplissez la date et les horaires", true);
    return;
  }
  try {
    const d = await post("/reservations/check-availability", {
      resourceId: $("book-resource-id").value,
      date,
      startTime: start,
      endTime: end,
    });
    s.className = `avail-status ${d.available ? "available" : "unavailable"}`;
    s.textContent = d.available
      ? "✓ Créneau disponible"
      : "✗ Créneau déjà réservé";
    s.classList.remove("hidden");
  } catch (e) {
    s.className = "avail-status unavailable";
    s.textContent = e.message;
    s.classList.remove("hidden");
  }
});

$("book-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("book-error"),
    btn = e.target.querySelector("button[type=submit]");
  errEl.classList.add("hidden");
  btn.disabled = true;
  btn.querySelector("span").textContent = "Réservation…";
  try {
    await post("/reservations", {
      resourceId: $("book-resource-id").value,
      title: $("book-title").value,
      date: $("book-date").value,
      startTime: $("book-start").value,
      endTime: $("book-end").value,
      notes: $("book-notes").value,
    });
    closeModal("modal-book");
    toast("Réservation créée !");
    loadDashboard();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.querySelector("span").textContent = "Confirmer";
  }
});

// ── My Reservations ──────────────────────────────────
async function loadMyReservations() {
  const el = $("reservations-list");
  el.innerHTML =
    '<div class="skeleton" style="height:300px;border-radius:12px"></div>';
  try {
    const d = await api(`/reservations/my?page=${resPage}&limit=10`);
    const list = d.data || d.reservations || [];
    const pages = d.totalPages || Math.ceil((d.total || list.length) / 10);
    currentReservations = list;
    if (list.length === 0) {
      el.innerHTML = empty("Aucune réservation");
      return;
    }
    el.innerHTML = `
      <div class="reservations-table-wrap"><table class="res-table">
        <thead><tr><th>Titre</th><th>Ressource</th><th>Date</th><th>Horaire</th><th>Statut</th><th>Actions</th></tr></thead>
        <tbody>${list
          .map(
            (r, i) => `
          <tr>
            <td style="font-weight:500;color:var(--white)">${esc(
              r.title || "—"
            )}</td>
            <td>${esc(r.resource?.name || "—")}</td>
            <td style="font-family:var(--font-mono)">${fmt(r.date)}</td>
            <td style="font-family:var(--font-mono)">${r.startTime}–${
              r.endTime
            }</td>
            <td><span class="badge ${r.status}">${
              STATUS[r.status] || r.status
            }</span></td>
            <td>${
              r.status !== "cancelled"
                ? `<button class="action-btn danger" data-index="${i}" title="Annuler"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg></button>`
                : '<span style="color:var(--gray-600)">—</span>'
            }</td>
          </tr>`
          )
          .join("")}
        </tbody>
      </table></div>`;
    el.querySelectorAll(".action-btn.danger").forEach((btn) => {
      btn.addEventListener("click", () =>
        cancelRes(currentReservations[parseInt(btn.dataset.index)]._id)
      );
    });
    renderPages("reservations-pagination", resPage, pages, "reservations");
  } catch (e) {
    el.innerHTML = empty(e.message);
  }
}

async function cancelRes(id) {
  if (!confirm("Annuler cette réservation ?")) return;
  try {
    await patch(`/reservations/${id}/cancel`);
    toast("Réservation annulée");
    loadMyReservations();
    loadDashboard();
  } catch (e) {
    toast(e.message, true);
  }
}

// ── ADMIN PANEL ──────────────────────────────────────
// Tabs admin
document.querySelectorAll(".admin-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document
      .querySelectorAll(".admin-tab")
      .forEach((t) => t.classList.remove("active"));
    document
      .querySelectorAll(".admin-panel")
      .forEach((p) => p.classList.remove("active"));
    tab.classList.add("active");
    $(`admin-${tab.dataset.adminTab}`).classList.add("active");
    if (tab.dataset.adminTab === "all-reservations") loadAllReservations();
  });
});

async function loadAdminPanel() {
  await loadAdminResources();
}

// ── Admin : liste ressources ──────────────────────────
async function loadAdminResources() {
  const el = $("admin-resources");
  el.innerHTML =
    '<div class="skeleton" style="height:300px;border-radius:12px"></div>';
  try {
    const d = await api("/resources?limit=100");
    const list = d.data || d.resources || [];
    if (list.length === 0) {
      el.innerHTML = empty("Aucune ressource");
      return;
    }
    el.innerHTML = `
      <div class="admin-resource-table">
        <table class="res-table">
          <thead><tr><th>Nom</th><th>Type</th><th>Capacité</th><th>Prix/h</th><th>Disponibilité</th><th>Actions</th></tr></thead>
          <tbody>${list
            .map(
              (r, i) => `
            <tr>
              <td style="font-weight:500;color:var(--white)">${esc(r.name)}</td>
              <td>${TYPES[r.type] || r.type}</td>
              <td>${r.capacity || "—"}</td>
              <td>${r.pricePerHour != null ? `${r.pricePerHour}€` : "—"}</td>
              <td><span class="badge ${
                r.available !== false ? "confirmed" : "cancelled"
              }">${
                r.available !== false ? "Disponible" : "Indisponible"
              }</span></td>
              <td style="display:flex;gap:6px">
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
        </table>
      </div>`;

    // Stocker pour référence
    currentResources = list;

    // Modifier
    el.querySelectorAll(".edit-res-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        openResourceForm(currentResources[parseInt(btn.dataset.index)])
      );
    });
    // Supprimer
    el.querySelectorAll(".del-res-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        deleteResource(currentResources[parseInt(btn.dataset.index)])
      );
    });
  } catch (e) {
    el.innerHTML = empty(e.message);
  }
}

// ── Admin : toutes les réservations ──────────────────
async function loadAllReservations() {
  const el = $("admin-all-reservations");
  el.innerHTML =
    '<div class="skeleton" style="height:300px;border-radius:12px"></div>';
  try {
    const d = await api("/reservations?limit=100");
    const list = d.data || d.reservations || [];
    if (list.length === 0) {
      el.innerHTML = empty("Aucune réservation");
      return;
    }
    el.innerHTML = `
      <div class="reservations-table-wrap">
        <table class="res-table">
          <thead><tr><th>Titre</th><th>Utilisateur</th><th>Ressource</th><th>Date</th><th>Horaire</th><th>Statut</th></tr></thead>
          <tbody>${list
            .map(
              (r) => `
            <tr>
              <td style="font-weight:500;color:var(--white)">${esc(
                r.title || "—"
              )}</td>
              <td style="font-family:var(--font-mono);font-size:.8rem">${esc(
                r.user?.username || r.user?.email || "—"
              )}</td>
              <td>${esc(r.resource?.name || "—")}</td>
              <td style="font-family:var(--font-mono)">${fmt(r.date)}</td>
              <td style="font-family:var(--font-mono)">${r.startTime}–${
                r.endTime
              }</td>
              <td><span class="badge ${r.status}">${
                STATUS[r.status] || r.status
              }</span></td>
            </tr>`
            )
            .join("")}
          </tbody>
        </table>
      </div>`;
  } catch (e) {
    el.innerHTML = empty(e.message);
  }
}

// ── Admin : formulaire ressource ──────────────────────
$("btn-add-resource").addEventListener("click", () => openResourceForm(null));

function openResourceForm(r) {
  editingResourceId = r ? r._id : null;
  $("resource-form-title").textContent = r
    ? "Modifier la ressource"
    : "Ajouter une ressource";
  $("resource-form-btn-text").textContent = r ? "Modifier" : "Ajouter";
  $("resource-form").reset();
  $("resource-form-error").classList.add("hidden");
  if (r) {
    $("rf-name").value = r.name || "";
    $("rf-type").value = r.type || "";
    $("rf-capacity").value = r.capacity || "";
    $("rf-price").value = r.pricePerHour ?? "";
    $("rf-location").value = r.location || "";
    $("rf-description").value = r.description || "";
    $("rf-available").value = r.available !== false ? "true" : "false";
  }
  $("modal-resource-form").classList.remove("hidden");
}

$("resource-form-cancel").addEventListener("click", () =>
  closeModal("modal-resource-form")
);

$("resource-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = $("resource-form-error");
  const btn = e.target.querySelector("button[type=submit]");
  errEl.classList.add("hidden");
  btn.disabled = true;

  const body = {
    name: $("rf-name").value,
    type: $("rf-type").value,
    capacity: $("rf-capacity").value
      ? parseInt($("rf-capacity").value)
      : undefined,
    pricePerHour:
      $("rf-price").value !== "" ? parseFloat($("rf-price").value) : undefined,
    location: $("rf-location").value || undefined,
    description: $("rf-description").value || undefined,
    available: $("rf-available").value === "true",
  };

  try {
    if (editingResourceId) {
      await put(`/resources/${editingResourceId}`, body);
      toast("Ressource modifiée !");
    } else {
      await post("/resources", body);
      toast("Ressource ajoutée !");
    }
    closeModal("modal-resource-form");
    loadAdminResources();
    loadResources();
  } catch (e) {
    errEl.textContent = e.message;
    errEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
  }
});

async function deleteResource(r) {
  if (!confirm(`Supprimer "${r.name}" ? Cette action est irréversible.`))
    return;
  try {
    await del(`/resources/${r._id}`);
    toast("Ressource supprimée");
    loadAdminResources();
    loadResources();
  } catch (e) {
    toast(e.message, true);
  }
}

// ── Profil modal ─────────────────────────────────────
function loadProfile() {
  if (!user) return;
  const name = user.username || user.name || "U";
  const avatar = user.avatar ? `/uploads/${user.avatar}` : null;
  const el = $("profile-avatar-display");
  el.innerHTML = avatar
    ? `<img src="${avatar}" alt="avatar" style="width:100%;height:100%;object-fit:cover" />`
    : name[0].toUpperCase();
  $("profile-name-display").textContent = name;
  $("profile-email-display").textContent = user.email || "—";
  $("profile-role-display").textContent = user.role || "membre";
  $("info-username").textContent = name;
  $("info-email").textContent = user.email || "—";
  $("info-role").textContent = user.role || "membre";
  $("info-created").textContent = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";
}

$("open-profile-btn").addEventListener("click", () => {
  loadProfile();
  $("modal-profile").classList.remove("hidden");
});

$("avatar-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const fd = new FormData();
  fd.append("avatar", file);
  try {
    const res = await fetch("/api/auth/avatar", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const d = await res.json();
    if (!res.ok) throw new Error(d.message);
    user = d.user || d.data;
    updateSidebarUser();
    loadProfile();
    toast("Photo mise à jour !");
  } catch (e) {
    toast(e.message, true);
  }
});

$("delete-account-btn").addEventListener("click", () => {
  $("confirm-delete-input").value = "";
  closeModal("modal-profile");
  $("modal-confirm").classList.remove("hidden");
});

$("cancel-delete-btn").addEventListener("click", () =>
  closeModal("modal-confirm")
);

$("confirm-delete-btn").addEventListener("click", async () => {
  if ($("confirm-delete-input").value !== "SUPPRIMER") {
    toast("Tapez SUPPRIMER pour confirmer", true);
    return;
  }
  try {
    const res = await fetch("/api/auth/me", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.message || "Route non disponible");
    }
    closeModal("modal-confirm");
    toast("Compte supprimé. Au revoir !");
    setTimeout(() => {
      token = null;
      user = null;
      localStorage.removeItem("reserv_token");
      showAuth();
    }, 1500);
  } catch (e) {
    toast(e.message, true);
  }
});

// ── Modals fermeture ─────────────────────────────────
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

// ── Pagination ───────────────────────────────────────
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
      } else {
        resPage = page;
        loadMyReservations();
      }
    });
  });
}

// ── Admin Link ───────────────────────────────────────────
function addAdminLink() {
  const sidebarNav = document.querySelector(".sidebar-nav");
  if (!sidebarNav) return;

  // Créer le bouton admin (pas un lien direct)
  const adminBtn = document.createElement("button");
  adminBtn.className = "nav-item";
  adminBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
    <span>Administration</span>
  `;

  // Ajouter l'événement click
  adminBtn.addEventListener("click", function (e) {
    e.preventDefault();
    // Rediriger vers admin.html (le token est déjà dans localStorage)
    window.location.href = "admin.html";
  });

  // Ajouter après le dernier bouton de navigation
  const lastNavItem = sidebarNav.querySelector(".nav-item:last-of-type");
  if (lastNavItem) {
    lastNavItem.parentNode.insertBefore(adminBtn, lastNavItem.nextSibling);
  } else {
    sidebarNav.appendChild(adminBtn);
  }
}

// ── Init ─────────────────────────────────────────────
// Toujours afficher la page de connexion au chargement
showAuth();
