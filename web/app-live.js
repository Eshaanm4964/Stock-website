const STORAGE_KEY = "stock_trader_auth";
const APP_LIVE_VERSION = "2026-04-26-admin-database-view";
const SITE_CONTROL_KEY = "stock_trader_site_controls";
const REVIEW_STORAGE_KEY = "stock_trader_reviews";
let activeRole = null;
let activeUserId = null;
let liveTickerTimer = null;
let adminRefreshTimer = null;
let homeHeroTimer = null;
let userRenderInFlight = false;
let adminRenderInFlight = false;
let chatNudgeTimer = null;
let adminSearchRenderTimer = null;
let liveDashboardPriceTimer = null;
let adminDashboardRefreshTimer = null;
let userRefreshTimer = null;
let otpCountdownTimer = null;
const marketSymbolSearchCache = new Map();
let adminUiState = {
  search: "",
  clientFilter: "",
  stockFilter: "",
  dateFrom: "",
  dateTo: "",
  sortBy: "recent",
  revealedStocks: [],
  actionsMenuOpen: false,
  openDetailUserId: null
};
let adminSearchCache = { users: [], stocks: [] };
const boundHoldingButtons = new WeakSet();
let userUiState = {
  search: "",
  status: "all"
};
let siteControlsCache = {
  showFaqInsights: true,
  chatNudgesEnabled: false
};

const reviewsSeed = [
  {
    name: "Anika Rao",
    role: "AI-generated Investor Review",
    rating: 5,
    message: "The portfolio dashboard is clean, the gain-loss colors are easy to read, and the admin report export is genuinely useful for client calls."
  },
  {
    name: "Dev Malhotra",
    role: "AI-generated Advisor Review",
    rating: 5,
    message: "I like that the website feels like a proper fintech product instead of just a basic dashboard. The trust pages and login flow make it feel more complete."
  },
  {
    name: "Sara Nair",
    role: "AI-generated Wealth Ops Review",
    rating: 4,
    message: "The admin view gives a quick summary of client portfolios and the single-stock P&L view makes follow-up conversations much easier."
  }
];

const currency = (value) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value || 0));

const percent = (value) => `${value >= 0 ? "+" : ""}${Number(value || 0).toFixed(2)}%`;
const formatDate = (value) => {
  if (!value) return "No record";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No record";
  return parsed.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const formatDateTime = (value) => {
  if (!value) return "No activity yet";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No activity yet";
  return parsed.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

function formatDateInputValue(value) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function maskStockSymbol(symbol) {
  const safe = String(symbol || "").toUpperCase();
  if (!safe) return "Hidden";
  if (safe.length <= 2) return "••";
  return `${safe.slice(0, 1)}${"•".repeat(Math.max(safe.length - 2, 1))}${safe.slice(-1)}`;
}

function isAdminStockRevealed(symbol) {
  return adminUiState.revealedStocks.includes(String(symbol || "").toUpperCase());
}

function toggleAdminRevealedStock(symbol) {
  const safe = String(symbol || "").toUpperCase();
  if (!safe) return;
  if (isAdminStockRevealed(safe)) {
    adminUiState.revealedStocks = adminUiState.revealedStocks.filter((entry) => entry !== safe);
    return;
  }
  adminUiState.revealedStocks = [...adminUiState.revealedStocks, safe];
}

function refreshAdminStockVisibility(symbol) {
  const safe = String(symbol || "").toUpperCase();
  if (!safe) return;
  const isRevealed = isAdminStockRevealed(safe);
  document.querySelectorAll(`[data-stock-label="${safe}"]`).forEach((node) => {
    node.textContent = isRevealed ? safe : maskStockSymbol(safe);
  });
  document.querySelectorAll(`[data-stock-visibility-toggle="${safe}"]`).forEach((button) => {
    button.setAttribute("aria-label", isRevealed ? "Hide stock name" : "Show stock name");
    button.classList.toggle("is-active", isRevealed);
  });
}

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function setAuth(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function clearAuth() {
  localStorage.removeItem(STORAGE_KEY);
}

function isLoginPage() {
  return document.body?.dataset?.page === "login";
}

function isAdminDashboardPage() {
  return document.body?.dataset?.page === "admin-dashboard";
}

function isAdminCustomerPage() {
  return document.body?.dataset?.page === "admin-add-customer";
}

function isAdminDealPage() {
  return document.body?.dataset?.page === "admin-add-deal";
}

function isUserDashboardPage() {
  return document.body?.dataset?.page === "user-dashboard";
}

function isAdminDatabasePage() {
  return document.body?.dataset?.page === "admin-database";
}

function isAdminFundsPage() {
  return document.body?.dataset?.page === "admin-add-funds";
}

function stopAdminRefresh() {
  if (adminRefreshTimer) {
    window.clearInterval(adminRefreshTimer);
    adminRefreshTimer = null;
  }
}

function startAdminRefresh() {
  stopAdminRefresh();
  const intervalMs = isAdminDatabasePage() ? 30000 : 15000;
  adminRefreshTimer = window.setInterval(async () => {
    if (document.hidden) return;
    if (activeRole !== "admin") return;
    if (adminUiState.actionsMenuOpen) return;
    if (isAdminDashboardPage()) {
      await renderAdminPortal({ silent: true }).catch(() => {});
      return;
    }
    if (isAdminDatabasePage()) {
      await renderAdminDatabasePage({ silent: true }).catch(() => {});
    }
  }, intervalMs);
  return adminRefreshTimer;
}

function setButtonLoading(button, loadingText) {
  if (!button) return () => {};
  const originalText = button.textContent;
  button.disabled = true;
  button.dataset.loading = "true";
  button.textContent = loadingText;
  return () => {
    button.disabled = false;
    button.dataset.loading = "false";
    button.textContent = originalText;
  };
}

function hasRequiredFields(form, fieldNames) {
  return fieldNames.every((fieldName) => {
    const field = form.querySelector(`[name="${fieldName}"]`);
    return field && String(field.value || "").trim();
  });
}

function hidePortalMounts() {
  ["adminPortal", "userPortal"].forEach((id) => {
    const mount = document.getElementById(id);
    if (!mount) return;
    mount.classList.add("hidden");
    mount.classList.remove("portal-visible");
  });
}

function isHomePage() {
  return document.body?.dataset?.page === "home";
}

function revealPortal(target) {
  if (!target) return;
  target.classList.remove("hidden");
  target.classList.remove("portal-visible");
  target.classList.add("portal-ready");
  void target.offsetWidth;
  target.classList.remove("portal-ready");
  target.classList.add("portal-visible");
}

function showAuthLoading(title, text) {
  const overlay = document.getElementById("authLoadingOverlay");
  const titleNode = document.getElementById("authLoadingTitle");
  const textNode = document.getElementById("authLoadingText");
  if (!overlay) return;
  if (titleNode) titleNode.textContent = title || "Opening dashboard...";
  if (textNode) textNode.textContent = text || "Please wait while we verify access and load your workspace.";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideAuthLoading() {
  const overlay = document.getElementById("authLoadingOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function ensureDashboardLoadingOverlay() {
  let overlay = document.getElementById("dashboardLoadingOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "dashboardLoadingOverlay";
  overlay.className = "auth-loading-overlay hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="auth-loading-card">
      <div class="auth-loading-brand">Asset Yantra Portfolio Sync</div>
      <div class="auth-orbit-loader" aria-hidden="true">
        <span></span>
        <span></span>
        <img src="./assets/loading_logo.png" alt="Asset Yantra logo" />
      </div>
      <h2 id="dashboardLoadingTitle">Refreshing dashboard...</h2>
      <p id="dashboardLoadingText">Please wait while we update your holdings and realised profit.</p>
      <div class="auth-loading-progress"><span></span></div>
      <div class="auth-loading-steps">
        <span>Portfolio</span>
        <span>Pricing</span>
        <span>History</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function showDashboardLoading(title, text) {
  const overlay = ensureDashboardLoadingOverlay();
  const titleNode = document.getElementById("dashboardLoadingTitle");
  const textNode = document.getElementById("dashboardLoadingText");
  if (titleNode) titleNode.textContent = title || "Opening dashboard";
  if (textNode) textNode.textContent = text || "Loading your holdings, returns, and portfolio summary";
  overlay.style.opacity = "";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideDashboardLoading() {
  const overlay = document.getElementById("dashboardLoadingOverlay");
  if (!overlay) return;
  overlay.style.transition = "opacity 0.35s ease";
  overlay.style.opacity = "0";
  setTimeout(() => {
    overlay.classList.add("hidden");
    overlay.style.opacity = "";
    overlay.style.transition = "";
    overlay.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }, 360);
}

function getSiteControls() {
  return siteControlsCache;
}

function saveSiteControls(nextControls) {
  localStorage.setItem(SITE_CONTROL_KEY, JSON.stringify(nextControls));
  siteControlsCache = { ...siteControlsCache, ...nextControls };
}

function getApiBase() {
  const saved = localStorage.getItem("stock_trader_api_url");
  const isLocalHost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname === "::1";

  if (saved) {
    return saved;
  }

  return isLocalHost
    ? "http://localhost:8000/api/v1"
    : "https://stock-trader-demo-backend.onrender.com/api/v1";
}

function isNetworkError(error) {
  return error instanceof TypeError && /(fetch|network|load|failed|offline|connection)/i.test(error.message || "");
}

function formatError(error) {
  if (isNetworkError(error)) {
    return "Unable to reach the server. Please check your connection and try again.";
  }
  const msg = error.message || "";
  if (!msg || msg === "[object Object]") return "Something went wrong. Please try again.";
  return msg;
}

async function apiWithRetry(path, options = {}, errEl, retryMessage) {
  const maxRetries = 4;
  const retryDelaySec = 10;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await api(path, options);
    } catch (error) {
      if (!isNetworkError(error) || attempt === maxRetries) throw error;
      await new Promise((resolve) => {
        let sec = retryDelaySec;
        if (errEl) errEl.textContent = `${retryMessage} — retrying in ${sec}s…`;
        const tick = setInterval(() => {
          sec--;
          if (sec <= 0) {
            clearInterval(tick);
            if (errEl) errEl.textContent = "";
            resolve();
          } else {
            if (errEl) errEl.textContent = `${retryMessage} — retrying in ${sec}s…`;
          }
        }, 1000);
      });
    }
  }
}

function updateBackendStatus(message, state = "neutral") {
  const statusText = document.getElementById("backendStatusText");
  const statusPill = document.getElementById("backendStatusPill");
  if (statusText) {
    statusText.textContent = message;
    statusText.classList.remove("status-ok", "status-error");
    if (state === "ok") statusText.classList.add("status-ok");
    if (state === "error") statusText.classList.add("status-error");
  }
  if (statusPill) {
    statusPill.textContent =
      state === "ok" ? "Connected" : state === "error" ? "Offline" : state === "checking" ? "Checking" : "Not Checked";
    statusPill.classList.remove("ok", "error", "checking");
    if (state === "ok") statusPill.classList.add("ok");
    if (state === "error") statusPill.classList.add("error");
    if (state === "checking") statusPill.classList.add("checking");
  }
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const auth = getAuth();
  if (auth?.token) {
    headers.set("Authorization", `Bearer ${auth.token}`);
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeout_ms || 15000);
  let response;
  try {
    response = await fetch(`${getApiBase()}${path}`, { ...options, headers, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("The request timed out. Check the backend and try again.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg || d.message || JSON.stringify(d)).join("; ")
      : (typeof detail === "string" ? detail : null);
    throw new Error(msg || "Request failed");
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

function renderChart(history) {
  const maxAbs = Math.max(...history.map((item) => Math.abs(item.value || 0)), 1);
  return `
    <div class="chart">
      ${history
        .map((item) => {
          const value = Number(item.value || 0);
          const height = Math.max((Math.abs(value) / maxAbs) * 180, 24);
          return `
            <div class="bar">
              <div class="bar-value ${value >= 0 ? "profit" : "loss"}">${currency(value)}</div>
              <div class="bar-fill ${value >= 0 ? "" : "negative"}" style="height:${height}px"></div>
              <div class="bar-label">${item.label}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function showBalanceWarningPopup({ investorName, clientId, shortfall, investedValue, totalInvestment }) {
  const existing = document.getElementById("balanceWarningOverlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "balanceWarningOverlay";
  overlay.className = "sell-modal-overlay";
  overlay.innerHTML = `
    <div class="sell-modal balance-warning-modal" role="alertdialog" aria-modal="true" aria-labelledby="balanceWarnTitle">
      <div class="sell-modal-header balance-warning-header">
        <div class="sell-modal-badge" style="background:#e65100;">⚠ BALANCE ALERT</div>
        <h3 id="balanceWarnTitle" class="sell-modal-title">${escapeHtml(investorName)}</h3>
        <p class="sell-modal-owner">${escapeHtml(clientId)}</p>
      </div>
      <div class="sell-modal-body balance-warning-body">
        <p class="balance-warning-msg">This investor's <strong>Invested Value exceeds their Total Investment</strong>. The Balance Fund has gone negative.</p>
        <div class="balance-warning-row">
          <span>Total Investment</span><strong>${currency(totalInvestment)}</strong>
        </div>
        <div class="balance-warning-row">
          <span>Invested Value</span><strong class="loss">${currency(investedValue)}</strong>
        </div>
        <div class="balance-warning-row balance-warning-row--alert">
          <span>Balance Shortfall</span><strong class="loss">${currency(shortfall)}</strong>
        </div>
        <p class="balance-warning-action">Please add funds for this investor or reduce their holdings to restore a positive balance.</p>
      </div>
      <div class="sell-modal-actions">
        <button class="sell-modal-confirm" id="balanceWarnClose" type="button" style="background:#e65100;">Understood</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("sell-modal-visible"));

  const close = () => {
    overlay.classList.remove("sell-modal-visible");
    setTimeout(() => overlay.remove(), 220);
  };
  overlay.querySelector("#balanceWarnClose").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
}

function showDetailActionLoading(message) {
  const detailMount = document.getElementById("adminDetailMount");
  if (!detailMount) return;
  const existing = document.getElementById("detailActionLoadingOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "detailActionLoadingOverlay";
  overlay.style.cssText = "position:sticky;bottom:0;left:0;right:0;z-index:200;background:rgba(15,23,42,0.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;gap:12px;padding:18px 24px;border-radius:0 0 12px 12px;";
  overlay.innerHTML = `<span style="display:inline-block;width:18px;height:18px;border:2.5px solid rgba(255,255,255,0.25);border-top-color:#60a5fa;border-radius:50%;animation:orbitSpin 0.7s linear infinite;flex-shrink:0;"></span><span style="color:#e2e8f0;font-size:0.9rem;font-weight:600;">${escapeHtml(message)}</span>`;
  detailMount.appendChild(overlay);
}

function hideDetailActionLoading() {
  document.getElementById("detailActionLoadingOverlay")?.remove();
}

function showSellModal({ symbol, owner, availableQuantity, averageBuyPrice }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "sell-modal-overlay";
    overlay.innerHTML = `
      <div class="sell-modal" role="dialog" aria-modal="true" aria-labelledby="sellModalTitle">
        <div class="sell-modal-header">
          <div class="sell-modal-badge">SELL ORDER</div>
          <h3 id="sellModalTitle" class="sell-modal-title">${escapeHtml(symbol)}</h3>
          <p class="sell-modal-owner">${escapeHtml(owner)}</p>
        </div>
        <div class="sell-modal-info">
          <div class="sell-modal-info-item">
            <span class="sell-modal-info-label">Available Qty</span>
            <span class="sell-modal-info-value">${availableQuantity}</span>
          </div>
          <div class="sell-modal-info-item">
            <span class="sell-modal-info-label">Avg Buy Price</span>
            <span class="sell-modal-info-value">₹${Number(averageBuyPrice).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div class="sell-modal-body">
          <label class="sell-modal-field">
            <span>Quantity to Sell</span>
            <input id="sellModalQty" type="number" min="1" max="${availableQuantity}" value="${availableQuantity}" placeholder="Enter quantity" class="sell-modal-input" />
          </label>
          <label class="sell-modal-field">
            <span>Sell Price (₹ per share)</span>
            <input id="sellModalPrice" type="number" min="0.01" step="0.01" value="${averageBuyPrice ? averageBuyPrice.toFixed(2) : ""}" placeholder="Enter sell price" class="sell-modal-input" />
          </label>
          <p class="sell-modal-error" id="sellModalError"></p>
        </div>
        <div class="sell-modal-actions">
          <button class="sell-modal-cancel" id="sellModalCancel" type="button">Cancel</button>
          <button class="sell-modal-confirm" id="sellModalConfirm" type="button">Confirm Sell</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("sell-modal-visible"));

    const qtyInput = overlay.querySelector("#sellModalQty");
    const priceInput = overlay.querySelector("#sellModalPrice");
    const errorEl = overlay.querySelector("#sellModalError");
    const confirmBtn = overlay.querySelector("#sellModalConfirm");
    const cancelBtn = overlay.querySelector("#sellModalCancel");

    function close(result) {
      overlay.classList.remove("sell-modal-visible");
      setTimeout(() => overlay.remove(), 220);
      resolve(result);
    }

    cancelBtn.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });

    confirmBtn.addEventListener("click", () => {
      const qty = Number(qtyInput.value);
      const price = Number(priceInput.value);
      if (!Number.isFinite(qty) || qty <= 0) { errorEl.textContent = "Enter a valid quantity."; return; }
      if (qty > availableQuantity) { errorEl.textContent = `Cannot exceed available quantity of ${availableQuantity}.`; return; }
      if (!Number.isFinite(price) || price <= 0) { errorEl.textContent = "Enter a valid sell price."; return; }
      close({ sellQuantity: qty, sellPrice: price });
    });

    qtyInput.focus();
  });
}

function showEditHoldingModal({ symbol, owner, currentQty, currentBuyPrice, currentDate }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "sell-modal-overlay";
    const dateVal = currentDate ? currentDate.split("T")[0] : "";
    overlay.innerHTML = `
      <div class="sell-modal" role="dialog" aria-modal="true" aria-labelledby="editModalTitle">
        <div class="sell-modal-header">
          <div class="sell-modal-badge" style="background:#2c90f0;">EDIT HOLDING</div>
          <h3 id="editModalTitle" class="sell-modal-title">${escapeHtml(symbol)}</h3>
          <p class="sell-modal-owner">${escapeHtml(owner)}</p>
        </div>
        <div class="sell-modal-body">
          <label class="sell-modal-field">
            <span>Quantity</span>
            <input id="editModalQty" type="number" min="0.01" step="0.01" value="${Number(currentQty).toFixed(2)}" class="sell-modal-input" />
          </label>
          <label class="sell-modal-field">
            <span>Avg Buy Price (₹)</span>
            <input id="editModalPrice" type="number" min="0.01" step="0.01" value="${Number(currentBuyPrice).toFixed(2)}" class="sell-modal-input" />
          </label>
          <label class="sell-modal-field">
            <span>Purchase Date</span>
            <input id="editModalDate" type="date" value="${escapeHtml(dateVal)}" class="sell-modal-input" />
          </label>
          <p class="sell-modal-error" id="editModalError"></p>
        </div>
        <div class="sell-modal-actions">
          <button class="sell-modal-cancel" id="editModalCancel" type="button">Cancel</button>
          <button class="sell-modal-confirm" id="editModalConfirm" type="button" style="background:#2c90f0;">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("sell-modal-visible"));

    const qtyInput = overlay.querySelector("#editModalQty");
    const priceInput = overlay.querySelector("#editModalPrice");
    const dateInput = overlay.querySelector("#editModalDate");
    const errorEl = overlay.querySelector("#editModalError");
    const confirmBtn = overlay.querySelector("#editModalConfirm");
    const cancelBtn = overlay.querySelector("#editModalCancel");

    function close(result) {
      overlay.classList.remove("sell-modal-visible");
      setTimeout(() => overlay.remove(), 220);
      resolve(result);
    }

    cancelBtn.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });

    confirmBtn.addEventListener("click", () => {
      const qty = Number(qtyInput.value);
      const price = Number(priceInput.value);
      if (!Number.isFinite(qty) || qty <= 0) { errorEl.textContent = "Quantity must be greater than 0."; return; }
      if (!Number.isFinite(price) || price <= 0) { errorEl.textContent = "Avg price must be greater than 0."; return; }
      const dateStr = dateInput.value ? new Date(dateInput.value).toISOString() : null;
      close({ quantity: qty, buy_price: price, created_at: dateStr });
    });

    qtyInput.focus();
  });
}

function showBuyMoreModal({ symbol, owner, exchange, lastBuyPrice }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "sell-modal-overlay";
    const today = new Date().toISOString().split("T")[0];
    overlay.innerHTML = `
      <div class="sell-modal" role="dialog" aria-modal="true" aria-labelledby="buyMoreModalTitle">
        <div class="sell-modal-header">
          <div class="sell-modal-badge" style="background:#16a34a;">BUY MORE</div>
          <h3 id="buyMoreModalTitle" class="sell-modal-title">${escapeHtml(symbol)}</h3>
          <p class="sell-modal-owner">${escapeHtml(owner)}</p>
        </div>
        <div class="sell-modal-info">
          <div class="sell-modal-info-item">
            <span class="sell-modal-info-label">Exchange</span>
            <span class="sell-modal-info-value">${escapeHtml(exchange || "NSE")}</span>
          </div>
          <div class="sell-modal-info-item">
            <span class="sell-modal-info-label">Last Buy Price</span>
            <span class="sell-modal-info-value">₹${Number(lastBuyPrice || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
        <div class="sell-modal-body">
          <label class="sell-modal-field">
            <span>Quantity</span>
            <input id="buyMoreQty" type="number" min="0.01" step="0.01" placeholder="Enter quantity" class="sell-modal-input" />
          </label>
          <label class="sell-modal-field">
            <span>Buy Price (₹ per share)</span>
            <input id="buyMorePrice" type="number" min="0.01" step="0.01" value="${lastBuyPrice ? Number(lastBuyPrice).toFixed(2) : ""}" placeholder="Enter buy price" class="sell-modal-input" />
          </label>
          <label class="sell-modal-field">
            <span>Purchase Date</span>
            <input id="buyMoreDate" type="date" value="${today}" max="${today}" class="sell-modal-input" />
          </label>
          <p class="sell-modal-error" id="buyMoreError"></p>
        </div>
        <div class="sell-modal-actions">
          <button class="sell-modal-cancel" id="buyMoreCancel" type="button">Cancel</button>
          <button class="sell-modal-confirm" id="buyMoreConfirm" type="button" style="background:linear-gradient(135deg,#22c55e,#16a34a);box-shadow:0 6px 16px rgba(34,197,94,0.28);">Confirm Buy</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("sell-modal-visible"));

    const qtyInput = overlay.querySelector("#buyMoreQty");
    const priceInput = overlay.querySelector("#buyMorePrice");
    const dateInput = overlay.querySelector("#buyMoreDate");
    const errorEl = overlay.querySelector("#buyMoreError");
    const confirmBtn = overlay.querySelector("#buyMoreConfirm");
    const cancelBtn = overlay.querySelector("#buyMoreCancel");

    function close(result) {
      overlay.classList.remove("sell-modal-visible");
      setTimeout(() => overlay.remove(), 220);
      resolve(result);
    }

    cancelBtn.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });

    confirmBtn.addEventListener("click", () => {
      const qty = Number(qtyInput.value);
      const price = Number(priceInput.value);
      if (!Number.isFinite(qty) || qty <= 0) { errorEl.textContent = "Quantity must be greater than 0."; return; }
      if (!Number.isFinite(price) || price <= 0) { errorEl.textContent = "Buy price must be greater than 0."; return; }
      const dateStr = dateInput.value ? new Date(dateInput.value).toISOString() : new Date().toISOString();
      close({ quantity: qty, buy_price: price, created_at: dateStr });
    });

    qtyInput.focus();
  });
}

function showResetPasswordModal({ userId, userName }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "sell-modal-overlay";
    overlay.innerHTML = `
      <div class="sell-modal" role="dialog" aria-modal="true" aria-labelledby="resetPwdTitle">
        <div class="sell-modal-header">
          <div class="sell-modal-badge" style="background:#7c3aed;">RESET PASSWORD</div>
          <h3 id="resetPwdTitle" class="sell-modal-title">${escapeHtml(userName)}</h3>
          <p class="sell-modal-owner">Set a new login password for this investor</p>
        </div>
        <div class="sell-modal-body">
          <label class="sell-modal-field">
            <span>New Password</span>
            <input id="resetPwdInput" type="text" placeholder="Enter new password (min 6 chars)" class="sell-modal-input" autocomplete="off" />
          </label>
          <p class="sell-modal-error" id="resetPwdError"></p>
        </div>
        <div class="sell-modal-actions">
          <button class="sell-modal-cancel" id="resetPwdCancel" type="button">Cancel</button>
          <button class="sell-modal-confirm" id="resetPwdConfirm" type="button" style="background:linear-gradient(135deg,#7c3aed,#5b21b6);box-shadow:0 6px 16px rgba(124,58,237,0.28);">Reset Password</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("sell-modal-visible"));

    const pwdInput = overlay.querySelector("#resetPwdInput");
    const errorEl = overlay.querySelector("#resetPwdError");
    const confirmBtn = overlay.querySelector("#resetPwdConfirm");
    const cancelBtn = overlay.querySelector("#resetPwdCancel");

    function close(result) {
      overlay.classList.remove("sell-modal-visible");
      setTimeout(() => overlay.remove(), 220);
      resolve(result);
    }

    cancelBtn.addEventListener("click", () => close(null));
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(null); });

    confirmBtn.addEventListener("click", () => {
      const pwd = pwdInput.value.trim();
      if (!pwd || pwd.length < 6) { errorEl.textContent = "Password must be at least 6 characters."; return; }
      close(pwd);
    });

    pwdInput.focus();
  });
}

function getHoldingState(holding) {
  const profitLoss = Number(holding?.profit_loss || 0);
  if (profitLoss > 0) return "profit";
  if (profitLoss < 0) return "loss";
  return "flat";
}

function getFilteredUserPerformance(performance) {
  const search = userUiState.search.trim().toLowerCase();
  return performance.filter((holding) => {
    const state = getHoldingState(holding);
    const matchesSearch =
      !search ||
      String(holding.symbol || "")
        .toLowerCase()
        .includes(search) ||
      String(holding.sector || "")
        .toLowerCase()
        .includes(search);
    const matchesState =
      userUiState.status === "all" ||
      (userUiState.status === "profit" && state === "profit") ||
      (userUiState.status === "loss" && state === "loss") ||
      (userUiState.status === "flat" && state === "flat");
    return matchesSearch && matchesState;
  });
}

function buildAllocationMarkup(performance, totalPortfolioValue) {
  if (!performance.length) {
    return `<div class="empty-mini-state">Add your first stock to unlock portfolio allocation insights.</div>`;
  }
  return performance
    .slice()
    .sort((a, b) => Number(b.value || 0) - Number(a.value || 0))
    .slice(0, 5)
    .map((holding) => {
      const allocation = totalPortfolioValue ? (Number(holding.value || 0) / totalPortfolioValue) * 100 : 0;
      return `
        <article class="allocation-row">
          <div class="allocation-copy">
            <strong>${escapeHtml(holding.symbol)}</strong>
            <small>${escapeHtml(holding.sector || "Tracked holding")}</small>
          </div>
          <div class="allocation-meter">
            <div class="allocation-bar">
              <span style="width:${Math.min(Math.max(allocation, 4), 100)}%"></span>
            </div>
            <strong>${allocation.toFixed(1)}%</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildRecentActivityMarkup(performance) {
  if (!performance.length) {
    return `<div class="empty-mini-state">Recent activity will appear after the first stock is added.</div>`;
  }
  return performance
    .slice()
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 4)
    .map(
      (holding) => `
        <article class="activity-row">
          <div class="activity-icon ${getHoldingState(holding)}">${escapeHtml(String(holding.symbol || "?").slice(0, 2))}</div>
          <div>
            <strong>${escapeHtml(holding.symbol)}</strong>
            <small>${holding.quantity} shares added on ${formatDate(holding.created_at)}</small>
          </div>
          <span class="badge ${holding.profit_loss >= 0 ? "green" : "red"}">${currency(holding.profit_loss)}</span>
        </article>
      `
    )
    .join("");
}

function buildUserWatchlistMarkup(feed) {
  if (!feed.length) {
    return `<div class="empty-mini-state">Live market cards will appear for stocks in the portfolio.</div>`;
  }
  return feed
    .map(
      (quote) => `
        <article class="live-holding-card">
          <div>
            <strong>${escapeHtml(quote.symbol)}</strong>
            <small>${escapeHtml(quote.short_name || "Live market snapshot")}</small>
            <small>${quote.fetched_at ? `Updated ${formatDateTime(quote.fetched_at)}` : "Awaiting market update"}</small>
          </div>
          <div>
            <strong>${currency(quote.price)}</strong>
            <small class="${quote.change_percent >= 0 ? "profit" : "loss"}">${percent(quote.change_percent)}</small>
            <small class="${quote.is_fallback ? "loss" : ""}">${quote.is_fallback ? "Fallback quote" : "Live provider"}</small>
          </div>
        </article>
      `
    )
    .join("");
}

function setupUserPortfolioFilters() {
  const searchInput = document.getElementById("userPortfolioSearch");
  const statusFilter = document.getElementById("userPortfolioStatusFilter");

  if (searchInput) {
    searchInput.value = userUiState.search;
    searchInput.addEventListener("input", async () => {
      userUiState.search = searchInput.value;
      await renderUserPortal();
    });
  } else {
    userUiState.search = "";
  }

  if (statusFilter) {
    statusFilter.value = userUiState.status;
    statusFilter.addEventListener("change", async () => {
      userUiState.status = statusFilter.value;
      await renderUserPortal({
        showLoading: true,
        silent: true,
        loadingTitle: "Opening user dashboard...",
        loadingText: "Loading your holdings, returns, and portfolio summary"
      });
    });
  }
}

function setupFaq() {
  document.querySelectorAll(".faq-question").forEach((button) => {
    button.addEventListener("click", () => button.closest(".faq-item").classList.toggle("open"));
  });
  refreshFaqHighlightVisibility();
}

function refreshFaqHighlightVisibility() {
  const faqHighlights = document.getElementById("faqHighlightCards");
  if (faqHighlights) {
    faqHighlights.classList.toggle("hidden", !getSiteControls().showFaqInsights);
  }
}

function getStoredReviews() {
  const saved = localStorage.getItem(REVIEW_STORAGE_KEY);
  return saved ? [...reviewsSeed, ...JSON.parse(saved)] : reviewsSeed;
}

function saveReviewLocally(review) {
  const saved = localStorage.getItem(REVIEW_STORAGE_KEY);
  const reviews = saved ? JSON.parse(saved) : [];
  reviews.unshift(review);
  localStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(reviews));
}

function clearStoredReviews() {
  localStorage.removeItem(REVIEW_STORAGE_KEY);
}

async function loadSiteControls() {
  try {
    const response = await api("/site/settings");
    saveSiteControls({
      showFaqInsights: response.show_faq_insights,
      chatNudgesEnabled: response.chat_nudges_enabled
    });
  } catch {
    try {
      siteControlsCache = {
        showFaqInsights: true,
        chatNudgesEnabled: true,
        ...(JSON.parse(localStorage.getItem(SITE_CONTROL_KEY) || "{}"))
      };
    } catch {
      siteControlsCache = { showFaqInsights: true, chatNudgesEnabled: true };
    }
  }
  refreshFaqHighlightVisibility();
}

async function updateSiteControls(nextControls) {
  try {
    const response = await api("/site/settings", {
      method: "PUT",
      body: JSON.stringify({
        show_faq_insights: nextControls.showFaqInsights,
        chat_nudges_enabled: nextControls.chatNudgesEnabled
      })
    });
    saveSiteControls({
      showFaqInsights: response.show_faq_insights,
      chatNudgesEnabled: response.chat_nudges_enabled
    });
  } catch {
    saveSiteControls(nextControls);
  }
  refreshFaqHighlightVisibility();
}

async function loadReviews() {
  try {
    return await api("/site/reviews");
  } catch {
    return getStoredReviews();
  }
}

async function createReview(review) {
  try {
    return await api("/site/reviews", {
      method: "POST",
      body: JSON.stringify(review)
    });
  } catch {
    saveReviewLocally(review);
    return review;
  }
}

async function deleteCustomReviews() {
  try {
    await api("/site/reviews", { method: "DELETE" });
  } catch {
    clearStoredReviews();
  }
}

async function renderReviews() {
  const container = document.getElementById("reviewsList");
  if (!container) return;

  container.innerHTML = (await loadReviews())
    .map(
      (review) => `
        <article class="review-card">
          <div class="stars">${"&#9733;".repeat(review.rating)}${"&#9734;".repeat(5 - review.rating)}</div>
          <h3>${review.name}</h3>
          <p><strong>${review.role}</strong></p>
          <p>${review.message}</p>
        </article>
      `
    )
    .join("");
}

function setupReviewForm() {
  const form = document.getElementById("reviewForm");
  renderReviews().catch(() => {});
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    await createReview({
      name: String(data.get("name")).trim(),
      role: String(data.get("role")).trim(),
      rating: Number(data.get("rating")),
      message: String(data.get("message")).trim()
    });
    form.reset();
    form.querySelector('input[name="rating"]').value = "5";
    await renderReviews();
  });
}

function setupPageTransitions() {
  sessionStorage.removeItem("pageTransitionActive");
}

function setupMobileNav() {
  const navbar = document.querySelector(".public-navbar");
  if (!navbar) return;

  const toggleBtn = navbar.querySelector("[data-nav-toggle]");
  const navLinks = navbar.querySelectorAll(".site-nav a");
  const dropdownToggle = navbar.querySelector("[data-login-dropdown-toggle]");
  const dropdownContainer = dropdownToggle?.closest("[data-login-dropdown]");

  function openNav() {
    navbar.classList.add("nav-open");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "true");
  }
  function closeNav() {
    navbar.classList.remove("nav-open");
    if (toggleBtn) toggleBtn.setAttribute("aria-expanded", "false");
  }

  if (toggleBtn) {
    toggleBtn.setAttribute("aria-expanded", "false");
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      navbar.classList.contains("nav-open") ? closeNav() : openNav();
    });
  }

  navLinks.forEach((link) => link.addEventListener("click", closeNav));

  document.addEventListener("click", (e) => {
    if (navbar.classList.contains("nav-open") && !navbar.contains(e.target)) closeNav();
  });

  if (dropdownToggle && dropdownContainer) {
    dropdownToggle.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdownContainer.classList.contains("open");
      document.querySelectorAll("[data-login-dropdown].open").forEach((d) => d.classList.remove("open"));
      if (!isOpen) dropdownContainer.classList.add("open");
    });
    document.addEventListener("click", (e) => {
      if (!dropdownContainer.contains(e.target)) dropdownContainer.classList.remove("open");
    });
  }
}

async function checkBackendStatus() {
  const statusText = document.getElementById("backendStatusText");
  const checkBtn = document.getElementById("checkBackendBtn");
  if (!statusText) return;
  try {
    updateBackendStatus("Checking backend connection...", "checking");
    if (checkBtn) {
      checkBtn.disabled = true;
      checkBtn.textContent = "Checking...";
    }
    const response = await fetch(getApiBase().replace(/\/api\/v1$/, "") + "/health");
    if (!response.ok) {
      throw new Error("Backend health check failed.");
    }
    updateBackendStatus("Backend is reachable and responding.", "ok");
  } catch (error) {
    updateBackendStatus(formatError(error), "error");
  } finally {
    if (checkBtn) {
      checkBtn.disabled = false;
      checkBtn.textContent = "Check Backend";
    }
  }
}

function renderPortalError(target, title, message) {
  if (!target) return;
  target.innerHTML = `
    <article class="dashboard-card">
      <div class="panel-head"><h3>${title}</h3><span class="badge red">Connection Issue</span></div>
      <p>${message}</p>
      <div class="actions-row">
        <button class="secondary-btn" type="button" id="retryPortalBtn">Retry</button>
      </div>
    </article>
  `;
  revealPortal(target);
}

function setupHoldingDeleteButtons() {
  document.querySelectorAll("[data-delete-holding]").forEach((button) => {
    button.addEventListener("click", async () => {
      const holdingId = button.dataset.deleteHolding;
      const symbol = button.dataset.symbol || "this stock";
      const confirmed = window.confirm(`Remove ${symbol} from the portfolio?`);
      if (!confirmed) return;
      const stopLoading = setButtonLoading(button, "Removing...");
      try {
        await api(`/portfolio/${holdingId}`, { method: "DELETE" });
        await renderUserPortal();
      } catch (error) {
        alert(formatError(error));
      } finally {
        stopLoading();
      }
    });
  });
}

async function safeAdminUserDashboards(users) {
  const settled = await Promise.allSettled(users.map((user) => api(`/admin/users/${user.user_id}/dashboard?audit=false`)));
  return settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
}

function buildUserDownloadHtml(dashboard) {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${dashboard.full_name} Dashboard</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 28px; color: #11233f; }
          h1, h2 { margin-bottom: 8px; }
          .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
          .card { border: 1px solid #d9e3f2; border-radius: 16px; padding: 16px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; }
          th, td { border-bottom: 1px solid #d9e3f2; padding: 10px 8px; text-align: left; }
          .profit { color: #0f9f62; font-weight: bold; }
          .loss { color: #d64045; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>${dashboard.full_name} Portfolio Dashboard</h1>
        <p>${dashboard.fixed_user_id || dashboard.username}</p>
        <div class="grid">
          <div class="card"><strong>Total Holdings</strong><div>${dashboard.total_holdings}</div></div>
          <div class="card"><strong>Current Value</strong><div>${currency(dashboard.total_portfolio_value)}</div></div>
          <div class="card"><strong>Total P&amp;L</strong><div class="${dashboard.total_profit_loss >= 0 ? "profit" : "loss"}">${currency(dashboard.total_profit_loss)}</div></div>
        </div>
        <h2>Holdings</h2>
        <table>
          <thead><tr><th>Stock</th><th>Qty</th><th>Buy</th><th>Current</th><th>P&amp;L</th></tr></thead>
          <tbody>
            ${dashboard.holdings
              .map(
                (holding) =>
                  `<tr><td>${holding.symbol}</td><td>${holding.quantity}</td><td>${currency(holding.buy_price)}</td><td>${currency(holding.current_price)}</td><td class="${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}</td></tr>`
              )
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
}

function downloadHtmlFile(filename, html) {
  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadExcelFile(filename, html) {
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function buildAdminDatabaseExcelHtml(users = [], userDashboards = []) {
  const dashboardMap = new Map(userDashboards.map((dashboard) => [String(dashboard.user_id), dashboard]));
  const userRows = users
    .map((user) => {
      const dashboard = dashboardMap.get(String(user.user_id));
      return `
        <tr>
          <td>${escapeHtml(user.full_name || "Unknown Investor")}</td>
          <td>${escapeHtml(user.fixed_user_id || "")}</td>
          <td>${escapeHtml(user.username || "")}</td>
          <td>${escapeHtml(user.phone_number || "")}</td>
          <td>${escapeHtml(currency(user.balance_funds || 0))}</td>
          <td>${escapeHtml(currency(dashboard?.total_portfolio_value ?? user.portfolio_value ?? 0))}</td>
          <td>${escapeHtml(currency(Math.max(0, Number(user.balance_funds || 0) - (Array.isArray(dashboard?.holdings) ? dashboard.holdings : []).reduce((s, h) => s + Number(h.buy_price || 0) * Number(h.quantity || 0), 0))))}</td>
          <td>${escapeHtml(user.role || "user")}</td>
          <td>${user.is_active ? "Active" : "Inactive"}</td>
          <td>${user.is_demo ? "Demo" : "Live"}</td>
          <td>${escapeHtml(formatDateTime(user.created_at))}</td>
          <td>${escapeHtml(currency(dashboard?.total_portfolio_value ?? user.portfolio_value ?? 0))}</td>
          <td>${escapeHtml(String(dashboard?.total_holdings ?? user.total_holdings ?? 0))}</td>
          <td>${escapeHtml(currency(dashboard?.total_profit_loss ?? 0))}</td>
        </tr>
      `;
    })
    .join("");

  const holdingRows = userDashboards
    .flatMap((dashboard) =>
      (dashboard.holdings || []).map((holding) => `
        <tr>
          <td>${escapeHtml(dashboard.full_name || "Unknown Investor")}</td>
          <td>${escapeHtml(dashboard.fixed_user_id || "")}</td>
          <td>${escapeHtml(holding.symbol || "")}</td>
          <td>${escapeHtml(holding.exchange || "NSE")}</td>
          <td>${escapeHtml(String(holding.quantity ?? ""))}</td>
          <td>${escapeHtml(currency(holding.buy_price || 0))}</td>
          <td>${escapeHtml(currency(holding.current_price || 0))}</td>
          <td>${escapeHtml(currency(holding.value || 0))}</td>
          <td>${escapeHtml(currency(holding.profit_loss || 0))}</td>
          <td>${escapeHtml(percent(holding.percent_change || 0))}</td>
          <td>${escapeHtml(formatDateTime(holding.created_at))}</td>
        </tr>
      `)
    )
    .join("");

  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:x="urn:schemas-microsoft-com:office:excel"
          xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <style>
          body { font-family: Arial, sans-serif; color: #10251d; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 24px; }
          th, td { border: 1px solid #d5dfd9; padding: 8px 10px; text-align: left; }
          th { background: #edf6ef; }
          h1, h2 { margin: 0 0 12px; }
        </style>
      </head>
      <body>
        <h1>Asset Yantra Database Export</h1>
        <p>Generated on ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
        <h2>Investor Credentials</h2>
        <table>
          <thead>
            <tr>
              <th>Investor Name</th>
              <th>Client ID</th>
              <th>Username / Email</th>
              <th>Phone Number</th>
              <th>Total Investment</th>
              <th>Current Value</th>
              <th>Balance Fund</th>
              <th>Role</th>
              <th>Status</th>
              <th>Mode</th>
              <th>Created At</th>
              <th>Portfolio Value</th>
              <th>Total Holdings</th>
              <th>Total P&amp;L</th>
            </tr>
          </thead>
          <tbody>${userRows || `<tr><td colspan="13">No investors found.</td></tr>`}</tbody>
        </table>
        <h2>Portfolio Holdings</h2>
        <table>
          <thead>
            <tr>
              <th>Investor Name</th>
              <th>Client ID</th>
              <th>Symbol</th>
              <th>Exchange</th>
              <th>Quantity</th>
              <th>Avg Price</th>
              <th>Current Price</th>
              <th>Current Value</th>
              <th>Unrealised P&amp;L</th>
              <th>P&amp;L %</th>
              <th>Purchase Date</th>
            </tr>
          </thead>
          <tbody>${holdingRows || `<tr><td colspan="11">No holdings found.</td></tr>`}</tbody>
        </table>
      </body>
    </html>
  `;
}

function logoutAndResetPortals() {
  stopAdminRefresh();
  clearAuth();
  activeRole = null;
  activeUserId = null;
  window.clearInterval(adminDashboardRefreshTimer);
  adminDashboardRefreshTimer = null;
  window.clearInterval(userRefreshTimer);
  userRefreshTimer = null;
  stopLiveDashboardPrices();
  hidePortalMounts();
  hideAuthLoading();
  window.location.href = "./login.html";
}

function startOtpCountdown(elementId, minutes) {
  if (otpCountdownTimer) clearInterval(otpCountdownTimer);
  let remaining = minutes * 60;
  const el = document.getElementById(elementId);
  if (!el) return;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  el.textContent = `OTP sent — expires in ${fmt(remaining)}`;
  otpCountdownTimer = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(otpCountdownTimer);
      otpCountdownTimer = null;
      el.textContent = "OTP expired. Request a new one.";
      return;
    }
    el.textContent = `OTP sent — expires in ${fmt(remaining)}`;
  }, 1000);
}

function hideDashLoader() {
  const loader = document.getElementById("dashboardLoader");
  if (loader) {
    loader.style.opacity = "0";
    setTimeout(() => loader.remove(), 400);
  }
}

async function renderTicker(elementId, symbols) {
  const mount = document.getElementById(elementId);
  if (!mount || !symbols.length) return;

  const feed = await api(`/stocks/feed?symbols=${encodeURIComponent(symbols.join(","))}`).catch(() => []);
  const safeFeed = Array.isArray(feed) ? feed : [];
  mount.innerHTML = safeFeed
    .map(
      (quote) => `
        <article class="ticker-item">
          <div>
            <strong>${quote.symbol}</strong>
            <small>${quote.short_name || quote.symbol}</small>
            <small>${quote.fetched_at ? `As of ${formatDateTime(quote.fetched_at)}` : "Timestamp pending"}</small>
          </div>
          <div>
            <strong>${currency(quote.price)}</strong>
            <small class="${quote.change_percent >= 0 ? "profit" : "loss"}">${percent(quote.change_percent)}</small>
            <small class="${quote.is_fallback ? "loss" : ""}">${quote.is_fallback ? "Fallback" : "Provider"}</small>
          </div>
        </article>
      `
    )
    .join("");
}

async function renderHomeTicker() {
  const mount = document.getElementById("homeLiveTicker");
  if (!mount) return;

  const defaultSymbols = ["NIFTY50", "SENSEX", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN"];
  const feed = await api(`/stocks/feed?symbols=${encodeURIComponent(defaultSymbols.join(","))}`).catch(() => []);
  const safeFeed = Array.isArray(feed) ? feed.filter((quote) => quote?.symbol) : [];

  if (!safeFeed.length) {
    mount.innerHTML = `
      <div class="home-ticker-track">
        <article class="home-ticker-item">
          <span class="ticker-dot"></span>
          <strong>Live feed <em>Unavailable</em></strong>
          <small>Backend connection needed for market values</small>
        </article>
      </div>
    `;
    return;
  }

  const items = safeFeed.map((quote) => {
    const isDown = Number(quote.change_percent || 0) < 0;
    return `
      <article class="home-ticker-item ${isDown ? "is-down" : ""}">
        <span class="ticker-dot"></span>
        <strong>${escapeHtml(quote.symbol)} <em>${currency(quote.price)}</em></strong>
        <small class="${isDown ? "ticker-down" : ""}">${percent(quote.change_percent)}</small>
        <small>Live</small>
      </article>
    `;
  });

  mount.innerHTML = `<div class="home-ticker-track">${items.concat(items).join("")}</div>`;
}

function animateCountUp(node) {
  if (!node || node.dataset.counted === "true") return;
  const target = Number(node.dataset.countup || 0);
  const prefix = node.dataset.prefix || "";
  const suffix = node.dataset.suffix || "";
  const duration = 1200;
  const startTime = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const value = Math.round(target * eased);
    node.textContent = `${prefix}${value}${suffix}`;
    if (progress < 1) {
      window.requestAnimationFrame(tick);
    } else {
      node.dataset.counted = "true";
      node.textContent = `${prefix}${target}${suffix}`;
    }
  };

  window.requestAnimationFrame(tick);
}

function setupStatsCountUp() {
  const statNodes = Array.from(document.querySelectorAll(".stat-number[data-countup]"));
  if (!statNodes.length) return;

  if (!("IntersectionObserver" in window)) {
    statNodes.forEach(animateCountUp);
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        animateCountUp(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.35 }
  );

  statNodes.forEach((node) => observer.observe(node));
}

function setupHomeHeroCarousel() {
  const carousel = document.querySelector("[data-home-hero-carousel='true']");
  if (!carousel) return;

  const slides = Array.from(carousel.querySelectorAll("[data-hero-slide='true']"));
  const dots = Array.from(carousel.querySelectorAll("[data-hero-dot]"));
  const prev = carousel.querySelector("[data-hero-prev='true']");
  const next = carousel.querySelector("[data-hero-next='true']");
  if (!slides.length) return;

  let activeIndex = Math.max(0, slides.findIndex((slide) => slide.classList.contains("is-active")));
  if (activeIndex < 0) activeIndex = 0;

  const paint = (index) => {
    activeIndex = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("is-active", slideIndex === activeIndex));
    dots.forEach((dot, dotIndex) => dot.classList.toggle("is-active", dotIndex === activeIndex));
  };

  const restart = () => {
    if (homeHeroTimer) window.clearInterval(homeHeroTimer);
    homeHeroTimer = window.setInterval(() => paint(activeIndex + 1), 5000);
  };

  prev?.addEventListener("click", () => {
    paint(activeIndex - 1);
    restart();
  });

  next?.addEventListener("click", () => {
    paint(activeIndex + 1);
    restart();
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      paint(index);
      restart();
    });
  });

  carousel.addEventListener("mouseenter", () => {
    if (homeHeroTimer) window.clearInterval(homeHeroTimer);
  });

  carousel.addEventListener("mouseleave", restart);

  paint(activeIndex);
  restart();
}

function setupHomePage() {
  if (!isHomePage()) return;
  setupHomeHeroCarousel();
  setupStatsCountUp();
  renderHomeTicker().catch(() => {});
}

function setupDownloadButtons(userDashboards = []) {
  const dashboardMap = new Map(userDashboards.map((user) => [String(user.user_id), user]));
  document.querySelectorAll("[data-download-user-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const dashboard = dashboardMap.get(String(button.dataset.downloadUserId));
      if (!dashboard) return;
      downloadHtmlFile(`${(dashboard.fixed_user_id || dashboard.username).toLowerCase()}-dashboard.html`, buildUserDownloadHtml(dashboard));
    });
  });
}

function setupWebsiteControlButtons() {
  const toggleFaqBtn = document.getElementById("toggleFaqInsightsBtn");
  const clearReviewsBtn = document.getElementById("clearCustomReviewsBtn");
  const controlStatus = document.getElementById("siteControlStatus");
  const controls = getSiteControls();

  if (toggleFaqBtn) {
    toggleFaqBtn.textContent = controls.showFaqInsights ? "Hide FAQ Cards" : "Show FAQ Cards";
    toggleFaqBtn.addEventListener("click", async () => {
      const nextControls = { ...getSiteControls(), showFaqInsights: !getSiteControls().showFaqInsights };
      await updateSiteControls(nextControls);
      toggleFaqBtn.textContent = nextControls.showFaqInsights ? "Hide FAQ Cards" : "Show FAQ Cards";
      if (controlStatus) {
        controlStatus.textContent = nextControls.showFaqInsights
          ? "FAQ insight cards will be shown on the FAQ page."
          : "FAQ insight cards are hidden on the FAQ page.";
      }
    });
  }

  if (clearReviewsBtn) {
    clearReviewsBtn.addEventListener("click", async () => {
      await deleteCustomReviews();
      if (controlStatus) {
        controlStatus.textContent = "User-added reviews were deleted from backend storage.";
      }
      renderReviews().catch(() => {});
    });
  }
}

function showXirrCalculatorModal(userDashboards) {
  const overlay = document.createElement("div");
  overlay.className = "sell-modal-overlay";

  // Pre-build map of userId → { name, symbols, holdingsArray } to avoid any lookup bugs
  const userMap = new Map();
  const sortedUsers = userDashboards
    .slice()
    .sort((a, b) => String(a.full_name || a.name || "").localeCompare(String(b.full_name || b.name || "")));

  for (const u of sortedUsers) {
    const id = String(u.user_id);
    const holdings = Array.isArray(u.holdings) ? u.holdings : [];
    const symbols = [...new Set(holdings.map((h) => String(h.symbol || "").trim()).filter(Boolean))].sort();
    userMap.set(id, { name: u.full_name || u.name || id, symbols, holdings });
  }

  const userOptions = sortedUsers
    .map((u) => `<option value="${String(u.user_id)}">${escapeHtml(u.full_name || u.name || String(u.user_id))}</option>`)
    .join("");

  overlay.innerHTML = `
    <div class="sell-modal xirr-modal" role="dialog" aria-modal="true" aria-labelledby="xirrModalTitle">
      <div class="sell-modal-header" style="background:linear-gradient(135deg,#0a1628 0%,#0f2040 60%,#112952 100%);border-radius:20px 20px 0 0;padding:22px 24px 18px;">
        <div class="sell-modal-badge" style="background:rgba(44,144,240,0.18);color:#7ec4f8;border:1px solid rgba(44,144,240,0.3);font-size:0.68rem;letter-spacing:0.12em;">XIRR CALCULATOR</div>
        <h3 id="xirrModalTitle" class="sell-modal-title" style="color:#fff;margin:8px 0 4px;">Annualised Return</h3>
        <p class="sell-modal-owner" style="color:rgba(255,255,255,0.55);font-size:0.8rem;margin:0;">True time-weighted return using the XIRR method</p>
      </div>
      <div class="sell-modal-body" style="padding:20px 24px 8px;">
        <div style="display:grid;gap:14px;">
          <label class="sell-modal-field" style="margin:0;">
            <span style="font-size:0.75rem;font-weight:700;color:#44526b;letter-spacing:0.06em;text-transform:uppercase;">Investor</span>
            <select id="xirrInvestorSelect" class="sell-modal-input" style="margin-top:6px;">
              <option value="">— Select Investor —</option>
              ${userOptions}
            </select>
          </label>
          <label class="sell-modal-field" style="margin:0;">
            <span style="font-size:0.75rem;font-weight:700;color:#44526b;letter-spacing:0.06em;text-transform:uppercase;">Stock</span>
            <select id="xirrStockSelect" class="sell-modal-input" style="margin-top:6px;" disabled>
              <option value="">All Stocks</option>
            </select>
          </label>
          <label class="sell-modal-field" style="margin:0;">
            <span style="font-size:0.75rem;font-weight:700;color:#44526b;letter-spacing:0.06em;text-transform:uppercase;">Time Period</span>
            <select id="xirrTimeframeSelect" class="sell-modal-input" style="margin-top:6px;">
              <option value="30">Last 1 Month</option>
              <option value="90">Last 3 Months</option>
              <option value="180">Last 6 Months</option>
              <option value="365">Last 1 Year</option>
              <option value="all" selected>All Time</option>
            </select>
          </label>
        </div>

        <div id="xirrResult" style="margin-top:18px;border-radius:16px;overflow:hidden;display:none;">
          <div style="background:linear-gradient(135deg,#0a1628,#0f2040);padding:20px 24px;text-align:center;">
            <p style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;color:rgba(255,255,255,0.45);text-transform:uppercase;margin:0 0 8px;">XIRR — Annualised Return</p>
            <p id="xirrValue" style="font-size:2.6rem;font-weight:900;margin:0;letter-spacing:-0.02em;font-variant-numeric:tabular-nums;"></p>
            <p id="xirrSubtitle" style="font-size:0.75rem;color:rgba(255,255,255,0.5);margin:6px 0 0;"></p>
          </div>
          <div id="xirrStats" style="display:grid;grid-template-columns:1fr 1fr 1fr;background:#f5f9ff;border:1px solid rgba(15,32,64,0.1);border-top:none;border-radius:0 0 16px 16px;"></div>
        </div>
        <p class="sell-modal-error" id="xirrError" style="margin-top:12px;"></p>
      </div>
      <div class="sell-modal-actions" style="padding:16px 24px 20px;">
        <button class="sell-modal-cancel" id="xirrClose" type="button">Close</button>
        <button class="sell-modal-confirm" id="xirrCalculate" type="button" style="background:linear-gradient(135deg,#0f2040,#1a3a6e);">Calculate XIRR</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("sell-modal-visible"));

  const investorSelect = overlay.querySelector("#xirrInvestorSelect");
  const stockSelect = overlay.querySelector("#xirrStockSelect");
  const timeframeSelect = overlay.querySelector("#xirrTimeframeSelect");
  const resultBox = overlay.querySelector("#xirrResult");
  const xirrValueEl = overlay.querySelector("#xirrValue");
  const xirrSubtitleEl = overlay.querySelector("#xirrSubtitle");
  const xirrStatsEl = overlay.querySelector("#xirrStats");
  const errorEl = overlay.querySelector("#xirrError");
  const calcBtn = overlay.querySelector("#xirrCalculate");
  const closeBtn = overlay.querySelector("#xirrClose");

  investorSelect.addEventListener("change", () => {
    const entry = userMap.get(investorSelect.value);
    errorEl.textContent = "";
    resultBox.style.display = "none";
    if (entry && entry.symbols.length) {
      stockSelect.innerHTML = `<option value="">All Stocks (${entry.symbols.length})</option>` +
        entry.symbols.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
      stockSelect.disabled = false;
    } else {
      stockSelect.innerHTML = `<option value="">All Stocks</option>`;
      stockSelect.disabled = true;
    }
  });

  stockSelect.addEventListener("change", () => { resultBox.style.display = "none"; errorEl.textContent = ""; });
  timeframeSelect.addEventListener("change", () => { resultBox.style.display = "none"; errorEl.textContent = ""; });

  function close() {
    overlay.classList.remove("sell-modal-visible");
    setTimeout(() => overlay.remove(), 220);
  }
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  calcBtn.addEventListener("click", () => {
    errorEl.textContent = "";
    resultBox.style.display = "none";
    const userId = investorSelect.value;
    if (!userId) { errorEl.textContent = "Please select an investor first."; return; }
    const entry = userMap.get(userId);
    if (!entry) { errorEl.textContent = "Investor data not found."; return; }

    const selectedStock = stockSelect.value;
    const timeVal = timeframeSelect.value;
    const days = timeVal === "all" ? null : Number(timeVal);
    const cutoff = days ? Date.now() - days * 86400000 : 0;

    const holdings = entry.holdings.filter((h) => {
      if (selectedStock && String(h.symbol || "") !== selectedStock) return false;
      if (!cutoff) return true;
      return h.created_at ? new Date(h.created_at).getTime() >= cutoff : true;
    });

    if (!holdings.length) { errorEl.textContent = "No holdings match the selected filters."; return; }

    const xirr = calculateXIRR(holdings);
    if (xirr === null) { errorEl.textContent = "Not enough data to calculate XIRR (need at least one buy date and a current price)."; return; }

    const totalInvested = holdings.reduce((s, h) => s + Number(h.buy_price || 0) * Number(h.quantity || 0), 0);
    const totalCurrent = holdings.reduce((s, h) => s + Number(h.current_price || 0) * Number(h.quantity || 0), 0);
    const pnl = totalCurrent - totalInvested;
    const color = xirr >= 0 ? "#4ade80" : "#f87171";

    xirrValueEl.textContent = (xirr >= 0 ? "+" : "") + xirr.toFixed(2) + "%";
    xirrValueEl.style.color = color;
    xirrSubtitleEl.textContent = `${escapeHtml(entry.name)}${selectedStock ? " · " + selectedStock : " · All Stocks"} · ${timeVal === "all" ? "All Time" : `Last ${timeVal === "30" ? "1 Month" : timeVal === "90" ? "3 Months" : timeVal === "180" ? "6 Months" : "1 Year"}`}`;

    const statCell = (label, value, cls = "") =>
      `<div style="padding:14px 10px;text-align:center;border-right:1px solid rgba(15,32,64,0.08);">
        <p style="font-size:0.65rem;font-weight:700;letter-spacing:0.07em;color:#70809c;text-transform:uppercase;margin:0 0 4px;">${label}</p>
        <p style="font-size:0.9rem;font-weight:800;margin:0;${cls}">${value}</p>
      </div>`;

    xirrStatsEl.innerHTML =
      statCell("Invested", currency(totalInvested)) +
      statCell("Current Value", currency(totalCurrent)) +
      `<div style="padding:14px 10px;text-align:center;">
        <p style="font-size:0.65rem;font-weight:700;letter-spacing:0.07em;color:#70809c;text-transform:uppercase;margin:0 0 4px;">P&amp;L</p>
        <p style="font-size:0.9rem;font-weight:800;margin:0;color:${pnl >= 0 ? "#0f8a55" : "#c62828"};">${pnl >= 0 ? "+" : ""}${currency(pnl)}</p>
      </div>`;

    resultBox.style.display = "block";
  });
}

function setupAdminManagementButtons() {
  const statusMessage = document.getElementById("adminUserActionStatus");
  const searchInput = document.getElementById("adminUniversalSearch");
  const clientFilter = document.getElementById("adminClientFilter");
  const stockFilter = document.getElementById("adminStockFilter");
  const dateFromInput = document.getElementById("adminDateFrom");
  const dateToInput = document.getElementById("adminDateTo");
  const selectAll = document.getElementById("adminSelectAllUsers");
  const bulkActivate = document.getElementById("bulkActivateUsersBtn");
  const bulkDisable = document.getElementById("bulkDisableUsersBtn");

  const searchDropdown = document.getElementById("adminSearchDropdown");
  function hideSearchDropdown() {
    if (searchDropdown) searchDropdown.hidden = true;
  }
  function showSearchSuggestions(query) {
    if (!searchDropdown || !query) { hideSearchDropdown(); return; }
    const q = query.toLowerCase();
    const userMatches = adminSearchCache.users
      .filter((u) => u.full_name?.toLowerCase().includes(q) || String(u.fixed_user_id || "").toLowerCase().includes(q))
      .slice(0, 5)
      .map((u) => ({ label: u.full_name, sub: u.fixed_user_id || u.username, value: u.full_name }));
    const stockMatches = adminSearchCache.stocks
      .filter((s) => s.toLowerCase().includes(q))
      .slice(0, 4)
      .map((s) => ({ label: s, sub: "Stock", value: s }));
    const all = [...userMatches, ...stockMatches];
    if (!all.length) { hideSearchDropdown(); return; }
    searchDropdown.innerHTML = all.map((item) =>
      `<button type="button" class="admin-search-suggestion" data-value="${escapeHtml(item.value)}">
        <strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.sub)}</small>
      </button>`
    ).join("");
    searchDropdown.hidden = false;
    searchDropdown.querySelectorAll(".admin-search-suggestion").forEach((btn) => {
      btn.addEventListener("mousedown", async (e) => {
        e.preventDefault();
        searchInput.value = btn.dataset.value;
        adminUiState.search = btn.dataset.value;
        hideSearchDropdown();
        await renderAdminPortal();
      });
    });
  }
  if (searchInput) {
    searchInput.value = adminUiState.search;
    searchInput.addEventListener("input", () => {
      showSearchSuggestions(searchInput.value.trim());
    });
    searchInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        adminUiState.search = searchInput.value.trim();
        hideSearchDropdown();
        await renderAdminPortal();
      } else if (e.key === "Escape") {
        hideSearchDropdown();
      }
    });
    searchInput.addEventListener("blur", () => {
      setTimeout(hideSearchDropdown, 150);
    });
    searchInput.addEventListener("focus", () => {
      if (searchInput.value.trim()) showSearchSuggestions(searchInput.value.trim());
    });
  }

  if (clientFilter) {
    clientFilter.value = adminUiState.clientFilter;
    clientFilter.addEventListener("change", async () => {
      adminUiState.clientFilter = clientFilter.value;
      await renderAdminPortal();
    });
  }

  if (stockFilter) {
    stockFilter.value = adminUiState.stockFilter;
    stockFilter.addEventListener("change", async () => {
      adminUiState.stockFilter = stockFilter.value;
      await renderAdminPortal();
    });
  }

  if (dateFromInput) {
    dateFromInput.value = adminUiState.dateFrom;
    dateFromInput.addEventListener("change", async () => {
      adminUiState.dateFrom = dateFromInput.value;
      await renderAdminPortal();
    });
  }

  if (dateToInput) {
    dateToInput.value = adminUiState.dateTo;
    dateToInput.addEventListener("change", async () => {
      adminUiState.dateTo = dateToInput.value;
      await renderAdminPortal();
    });
  }

  document.querySelectorAll("[data-sort-by]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      adminUiState.sortBy = btn.dataset.sortBy;
      const dropdown = document.getElementById("adminSortDropdown");
      if (dropdown) dropdown.removeAttribute("open");
      await renderAdminPortal();
    });
  });

  const sortSelect = document.getElementById("adminSortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", async () => {
      adminUiState.sortBy = sortSelect.value;
      await renderAdminPortal();
    });
  }

  document.querySelectorAll("[data-stock-visibility-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleAdminRevealedStock(button.dataset.stockVisibilityToggle);
      refreshAdminStockVisibility(button.dataset.stockVisibilityToggle);
    });
  });

  if (selectAll) {
    selectAll.addEventListener("change", () => {
      document.querySelectorAll("[data-user-select]").forEach((checkbox) => {
        checkbox.checked = selectAll.checked;
      });
    });
  }

  const getSelectedIds = () =>
    Array.from(document.querySelectorAll("[data-user-select]:checked")).map((checkbox) => Number(checkbox.value));

  const runBulkAction = async (action, button, confirmMessage) => {
    const selectedIds = getSelectedIds();
    if (!selectedIds.length) {
      if (statusMessage) statusMessage.textContent = "Select at least one client first.";
      return;
    }
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    const stopLoading = setButtonLoading(button, "Working...");
    try {
      const response = await api("/admin/users/bulk-action", {
        method: "POST",
        body: JSON.stringify({ action, user_ids: selectedIds })
      });
      if (statusMessage) {
        statusMessage.textContent = `${response.processed_count} user(s) processed for ${action}.`;
      }
      await renderAdminPortal();
    } catch (error) {
      if (statusMessage) statusMessage.textContent = formatError(error);
    } finally {
      stopLoading();
    }
  };

  if (bulkActivate) {
    bulkActivate.addEventListener("click", async () => runBulkAction("activate", bulkActivate));
  }

  if (bulkDisable) {
    bulkDisable.addEventListener("click", async () => runBulkAction("disable", bulkDisable));
  }

  document.querySelectorAll("[data-user-status-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.userStatusAction;
      const nextState = button.dataset.nextActive === "true";
      const stopLoading = setButtonLoading(button, nextState ? "Activating..." : "Disabling...");
      try {
        const updated = await api(`/admin/users/${userId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ is_active: nextState })
        });
        if (statusMessage) {
          statusMessage.textContent = `${updated.full_name} is now ${updated.is_active ? "active" : "inactive"}.`;
        }
        await renderAdminPortal();
      } catch (error) {
        if (statusMessage) {
          statusMessage.textContent = formatError(error);
        }
      } finally {
        stopLoading();
      }
    });
  });

  document.querySelectorAll("[data-delete-review]").forEach((button) => {
    button.addEventListener("click", async () => {
      const reviewId = button.dataset.deleteReview;
      const reviewName = button.dataset.reviewName || "this review";
      if (!window.confirm(`Delete review from ${reviewName}?`)) return;
      const stopLoading = setButtonLoading(button, "Deleting...");
      try {
        await api(`/admin/reviews/${reviewId}`, { method: "DELETE" });
        if (statusMessage) statusMessage.textContent = `Review from ${reviewName} deleted.`;
        await renderAdminPortal();
      } catch (error) {
        if (statusMessage) statusMessage.textContent = formatError(error);
      } finally {
        stopLoading();
      }
    });
  });

  setupHoldingActionButtons(statusMessage);
}

function setupHoldingActionButtons(statusMessage) {
  document.querySelectorAll("[data-admin-sell-holding]").forEach((button) => {
    if (boundHoldingButtons.has(button)) return;
    boundHoldingButtons.add(button);
    button.addEventListener("click", async () => {
      const holdingId = button.dataset.adminSellHolding;
      const symbol = button.dataset.symbol || "this stock";
      const owner = button.dataset.owner || "this customer";
      const availableQuantity = Number(button.dataset.quantity || 0);
      const averageBuyPrice = Number(button.dataset.buyPrice || 0);

      const result = await showSellModal({ symbol, owner, availableQuantity, averageBuyPrice });
      if (!result) return;
      const { sellQuantity, sellPrice } = result;

      const stopLoading = setButtonLoading(button, "Selling...");
      showDetailActionLoading(`Selling ${symbol}… Please wait`);
      try {
        const sale = await api(`/admin/holdings/${holdingId}/sell`, {
          method: "POST",
          body: JSON.stringify({ quantity: sellQuantity, sell_price: sellPrice })
        });
        if (statusMessage) statusMessage.textContent = `${symbol} sale saved for ${owner}. Realised P/L: ${currency(sale?.profit_loss || 0)}.`;
        await renderAdminPortal({ silent: true, scrollToDetail: true });
      } catch (error) {
        hideDetailActionLoading();
        if (statusMessage) statusMessage.textContent = formatError(error);
      } finally {
        stopLoading();
      }
    });
  });

  document.querySelectorAll("[data-admin-edit-holding]").forEach((button) => {
    if (boundHoldingButtons.has(button)) return;
    boundHoldingButtons.add(button);
    button.addEventListener("click", async () => {
      const holdingId = button.dataset.adminEditHolding;
      const symbol = button.dataset.symbol || "this stock";
      const owner = button.dataset.owner || "this customer";
      const currentQty = Number(button.dataset.quantity || 0);
      const currentBuyPrice = Number(button.dataset.buyPrice || 0);
      const currentDate = button.dataset.createdAt || "";

      const result = await showEditHoldingModal({ symbol, owner, currentQty, currentBuyPrice, currentDate });
      if (!result) return;

      const stopLoading = setButtonLoading(button, "Saving...");
      showDetailActionLoading(`Saving changes for ${symbol}… Please wait`);
      try {
        await api(`/admin/holdings/${holdingId}`, {
          method: "PATCH",
          body: JSON.stringify(result)
        });
        if (statusMessage) statusMessage.textContent = `${symbol} holding updated for ${owner}.`;
        await renderAdminPortal({ silent: true, scrollToDetail: true });
      } catch (error) {
        hideDetailActionLoading();
        if (statusMessage) statusMessage.textContent = formatError(error);
      } finally {
        stopLoading();
      }
    });
  });

  document.querySelectorAll("[data-admin-buy-holding]").forEach((button) => {
    if (boundHoldingButtons.has(button)) return;
    boundHoldingButtons.add(button);
    button.addEventListener("click", async () => {
      const userId = button.dataset.userId;
      const symbol = button.dataset.symbol || "this stock";
      const owner = button.dataset.owner || "this customer";
      const exchange = button.dataset.exchange || "NSE";
      const lastBuyPrice = Number(button.dataset.buyPrice || 0);

      const result = await showBuyMoreModal({ symbol, owner, exchange, lastBuyPrice });
      if (!result) return;

      const stopLoading = setButtonLoading(button, "Buying...");
      showDetailActionLoading(`Buying ${symbol}… Please wait`);
      try {
        await api(`/admin/users/${userId}/holdings`, {
          method: "POST",
          body: JSON.stringify({
            symbol,
            exchange,
            quantity: result.quantity,
            buy_price: result.buy_price,
            created_at: result.created_at
          })
        });
        showAdminSuccessModal(`Buy Order — ${owner}`, [
          ["Investor", owner],
          ["Stock", symbol],
          ["Exchange", exchange],
          ["Quantity", String(result.quantity)],
          ["Buy Price", currency(result.buy_price)],
          ["Total Value", currency(result.quantity * result.buy_price)]
        ]);
        if (statusMessage) statusMessage.textContent = `${symbol} purchased for ${owner}.`;
        await renderAdminPortal({ silent: true, scrollToDetail: true });
      } catch (error) {
        hideDetailActionLoading();
        if (statusMessage) statusMessage.textContent = formatError(error);
      } finally {
        stopLoading();
      }
    });
  });
}

async function refreshAdminCurrentPage() {
  if (isAdminCustomerPage()) {
    await renderAdminCustomerPage();
    return;
  }
  if (isAdminDealPage()) {
    await renderAdminDealPage();
    return;
  }
  if (isAdminDatabasePage()) {
    await renderAdminDatabasePage();
    return;
  }
  await renderAdminPortal();
}

function setupAdminDatabaseExport(users = [], userDashboards = []) {
  const button = document.getElementById("adminDatabaseExportBtn");
  if (!button) return;
  button.addEventListener("click", () => {
    const html = buildAdminDatabaseExcelHtml(users, userDashboards);
    downloadExcelFile(`assetyantra-database-${new Date().toISOString().slice(0, 10)}.xls`, html);
  });
}

function setupAdminClearButtons() {
  const clearSoldBtn = document.getElementById("clearSoldHistoryBtn");
  const clearUsersBtn = document.getElementById("clearAllUsersBtn");

  if (clearSoldBtn) {
    clearSoldBtn.addEventListener("click", async () => {
      if (!confirm("Delete ALL sold history records? This cannot be undone.")) return;
      clearSoldBtn.disabled = true;
      clearSoldBtn.textContent = "Clearing...";
      try {
        const res = await api("/admin/clear/sold-history", { method: "DELETE" });
        alert(`Cleared ${res.deleted} sold history records.`);
        await renderAdminDatabasePage();
      } catch (e) {
        alert("Failed: " + formatError(e));
        clearSoldBtn.disabled = false;
        clearSoldBtn.textContent = "Clear Sold History";
      }
    });
  }

  if (clearUsersBtn) {
    clearUsersBtn.addEventListener("click", async () => {
      if (!confirm("Delete ALL users and their holdings? This cannot be undone.")) return;
      if (!confirm("Are you sure? This will remove every client account and all portfolio data permanently.")) return;
      clearUsersBtn.disabled = true;
      clearUsersBtn.textContent = "Clearing...";
      try {
        const res = await api("/admin/clear/users", { method: "DELETE" });
        alert(`Cleared ${res.deleted} users and all their data.`);
        await renderAdminDatabasePage();
      } catch (e) {
        alert("Failed: " + formatError(e));
        clearUsersBtn.disabled = false;
        clearUsersBtn.textContent = "Clear All Users";
      }
    });
  }
}

function setupAdminManagement() {
  const createBtn = document.getElementById("adminCreateAdminBtn");
  if (createBtn) {
    createBtn.addEventListener("click", () => showAdminCreateModal());
  }

  document.querySelectorAll("[data-admin-edit]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showAdminEditModal(
        btn.getAttribute("data-admin-edit"),
        btn.getAttribute("data-admin-name") || "",
        btn.getAttribute("data-admin-phone") || ""
      );
    });
  });

  document.querySelectorAll("[data-admin-reset-admin-password]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showAdminResetPasswordModal(
        btn.getAttribute("data-admin-reset-admin-password"),
        btn.getAttribute("data-admin-name") || "Admin"
      );
    });
  });
}

function showAdminCreateModal() {
  const existing = document.getElementById("adminCreateModalOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "adminCreateModalOverlay";
  overlay.className = "admin-pwd-modal-overlay";
  overlay.innerHTML = `
    <div class="admin-pwd-modal admin-pwd-modal--wide" role="dialog" aria-modal="true" aria-labelledby="createAdminModalTitle">
      <h3 id="createAdminModalTitle">Create New Admin</h3>
      <p>Fill in the details below to create a new admin account.</p>
      <div class="admin-inline-form-grid">
        <div class="admin-form-field">
          <label for="caf_full_name">Full Name</label>
          <input class="input-field" id="caf_full_name" type="text" placeholder="e.g. Rahul Sharma" />
        </div>
        <div class="admin-form-field">
          <label for="caf_email">Email / Username</label>
          <input class="input-field" id="caf_email" type="email" placeholder="e.g. rahul@assetyantra.com" />
        </div>
        <div class="admin-form-field">
          <label for="caf_phone">Phone Number</label>
          <input class="input-field" id="caf_phone" type="tel" placeholder="10-digit Indian mobile" />
        </div>
        <div class="admin-form-field">
          <label for="caf_password">Password</label>
          <input class="input-field" id="caf_password" type="password" placeholder="Minimum 6 characters" />
        </div>
      </div>
      <p id="cafErr" style="color:var(--loss);font-size:0.84rem;margin:0 0 12px;display:none;"></p>
      <div class="admin-pwd-modal-actions">
        <button class="secondary-btn compact-btn" type="button" id="cafCancel">Cancel</button>
        <button class="primary-btn compact-btn" type="button" id="cafSubmit">Create Admin</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const errEl = document.getElementById("cafErr");
  const submitBtn = document.getElementById("cafSubmit");
  const close = () => overlay.remove();

  document.getElementById("cafCancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  submitBtn.addEventListener("click", async () => {
    const full_name = document.getElementById("caf_full_name").value.trim();
    const email = document.getElementById("caf_email").value.trim();
    const phone_number = document.getElementById("caf_phone").value.trim();
    const password = document.getElementById("caf_password").value;

    if (!full_name || !email || !phone_number || !password) {
      errEl.textContent = "All fields are required."; errEl.style.display = "block"; return;
    }
    if (password.length < 6) {
      errEl.textContent = "Password must be at least 6 characters."; errEl.style.display = "block"; return;
    }
    submitBtn.disabled = true; submitBtn.textContent = "Creating..."; errEl.style.display = "none";
    try {
      await api("/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email, phone_number, password }),
      });
      overlay.remove();
      showAdminSuccessModal("Admin Created", [["Name", full_name], ["Email", email], ["Status", "Active"]]);
      setTimeout(() => renderAdminDatabasePage({ silent: true }), 900);
    } catch (err) {
      errEl.textContent = formatError(err); errEl.style.display = "block";
      submitBtn.disabled = false; submitBtn.textContent = "Create Admin";
    }
  });

  setTimeout(() => { const el = document.getElementById("caf_full_name"); if (el) el.focus(); }, 50);
}

function showAdminEditModal(adminId, currentName, currentPhone) {
  const existing = document.getElementById("adminEditModalOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "adminEditModalOverlay";
  overlay.className = "admin-pwd-modal-overlay";
  overlay.innerHTML = `
    <div class="admin-pwd-modal" role="dialog" aria-modal="true" aria-labelledby="editAdminModalTitle">
      <h3 id="editAdminModalTitle">Edit Admin Details</h3>
      <p>Update the name or phone number for this admin account.</p>
      <div class="admin-form-field" style="margin-bottom:14px;">
        <label for="eaf_name">Full Name</label>
        <input class="input-field" id="eaf_name" type="text" value="${escapeHtml(currentName)}" />
      </div>
      <div class="admin-form-field" style="margin-bottom:18px;">
        <label for="eaf_phone">Phone Number</label>
        <input class="input-field" id="eaf_phone" type="tel" value="${escapeHtml(currentPhone)}" />
      </div>
      <p id="eafErr" style="color:var(--loss);font-size:0.84rem;margin:0 0 12px;display:none;"></p>
      <div class="admin-pwd-modal-actions">
        <button class="secondary-btn compact-btn" type="button" id="eafCancel">Cancel</button>
        <button class="primary-btn compact-btn" type="button" id="eafSubmit">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const errEl = document.getElementById("eafErr");
  const submitBtn = document.getElementById("eafSubmit");
  const close = () => overlay.remove();

  document.getElementById("eafCancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  submitBtn.addEventListener("click", async () => {
    const full_name = document.getElementById("eaf_name").value.trim();
    const phone_number = document.getElementById("eaf_phone").value.trim();
    if (!full_name || !phone_number) {
      errEl.textContent = "Name and phone are required."; errEl.style.display = "block"; return;
    }
    submitBtn.disabled = true; submitBtn.textContent = "Saving..."; errEl.style.display = "none";
    try {
      await api(`/admin/admins/${adminId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, phone_number }),
      });
      overlay.remove();
      showAdminSuccessModal("Admin Updated", [["Name", full_name], ["Phone", phone_number]]);
      setTimeout(() => renderAdminDatabasePage({ silent: true }), 900);
    } catch (err) {
      errEl.textContent = formatError(err); errEl.style.display = "block";
      submitBtn.disabled = false; submitBtn.textContent = "Save Changes";
    }
  });

  setTimeout(() => { const el = document.getElementById("eaf_name"); if (el) el.focus(); }, 50);
}

function showAdminResetPasswordModal(adminId, adminName) {
  const existing = document.getElementById("adminPwdModalOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "adminPwdModalOverlay";
  overlay.className = "admin-pwd-modal-overlay";
  overlay.innerHTML = `
    <div class="admin-pwd-modal" role="dialog" aria-modal="true" aria-labelledby="pwdModalTitle">
      <h3 id="pwdModalTitle">Reset Admin Password</h3>
      <p>Set a new password for <strong>${escapeHtml(adminName)}</strong>. They will need to use this to log in.</p>
      <div class="admin-form-field">
        <label for="adminPwdInput">New Password</label>
        <input class="input-field" id="adminPwdInput" type="password" placeholder="Minimum 6 characters" minlength="6" autocomplete="new-password" />
      </div>
      <p id="adminPwdModalErr" style="color:var(--loss);font-size:0.84rem;margin:0 0 10px;display:none;"></p>
      <div class="admin-pwd-modal-actions">
        <button class="secondary-btn compact-btn" type="button" id="adminPwdModalCancel">Cancel</button>
        <button class="primary-btn compact-btn" type="button" id="adminPwdModalConfirm">Reset Password</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const input = document.getElementById("adminPwdInput");
  const confirmBtn = document.getElementById("adminPwdModalConfirm");
  const cancelBtn = document.getElementById("adminPwdModalCancel");
  const errMsg = document.getElementById("adminPwdModalErr");

  setTimeout(() => input && input.focus(), 50);

  const close = () => overlay.remove();
  cancelBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  confirmBtn.addEventListener("click", async () => {
    const pwd = input.value.trim();
    if (!pwd || pwd.length < 6) {
      errMsg.textContent = "Password must be at least 6 characters.";
      errMsg.style.display = "block";
      input.focus();
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Resetting...";
    errMsg.style.display = "none";
    try {
      await api(`/admin/admins/${adminId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwd }),
      });
      overlay.remove();
      showAdminSuccessModal("Password Reset", [["Admin", adminName], ["Status", "Password updated successfully"]]);
    } catch (err) {
      errMsg.textContent = formatError(err);
      errMsg.style.display = "block";
      confirmBtn.disabled = false;
      confirmBtn.textContent = "Reset Password";
    }
  });

  input.addEventListener("keydown", (e) => { if (e.key === "Enter") confirmBtn.click(); });
}

function showAdminSuccessModal(title, rows) {
  const existing = document.getElementById("adminSuccessOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "adminSuccessOverlay";
  overlay.className = "admin-success-overlay";
  overlay.innerHTML = `
    <div class="admin-success-modal">
      <div class="admin-success-icon">✓</div>
      <h3 class="admin-success-title">${escapeHtml(title)}</h3>
      <div class="admin-success-details">
        ${rows.map(([label, value]) => `<div class="admin-success-row"><span>${escapeHtml(label)}</span><strong>${escapeHtml(String(value || "—"))}</strong></div>`).join("")}
      </div>
      <button class="primary-btn" type="button" id="adminSuccessClose" style="width:100%">Done</button>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById("adminSuccessClose").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
}

async function setupAdminCustomerForm() {
  const form = document.getElementById("adminCustomerForm");
  const status = document.getElementById("adminCustomerStatus");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const stopLoading = setButtonLoading(submitButton, "Creating...");
    try {
      const data = new FormData(form);
      const payload = {
        full_name: String(data.get("full_name") || "").trim(),
        email: String(data.get("email") || "").trim(),
        phone_number: String(data.get("phone_number") || "").trim(),
        password: String(data.get("password") || ""),
        initial_funds: 0,
        balance_funds: Number(data.get("balance_funds") || 0)
      };

      if (!payload.full_name || !payload.email || !payload.phone_number || !payload.password) {
        throw new Error("Complete all customer fields before creating the account.");
      }
      if (payload.balance_funds < 0) {
        throw new Error("Total Investment must be zero or more.");
      }

      await api("/admin/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const users = await api("/admin/users");
      const createdUser = (Array.isArray(users) ? users : []).find(
        (user) =>
          String(user.phone_number || "") === payload.phone_number ||
          String(user.email || "").toLowerCase() === payload.email.toLowerCase()
      );

      showAdminSuccessModal("Customer Created Successfully", [
        ["Customer Name", payload.full_name],
        ["Client ID", createdUser?.fixed_user_id || "Generating..."],
        ["Email", payload.email],
        ["Phone", payload.phone_number],
        ["Password", payload.password]
      ]);
      if (status) status.textContent = "Customer created successfully.";
      form.reset();
      await refreshAdminCurrentPage();
    } catch (error) {
      if (status) status.textContent = formatError(error);
    } finally {
      stopLoading();
    }
  });
}

async function setupAdminDealForm() {
  const form = document.getElementById("adminDealForm");
  const status = document.getElementById("adminDealStatus");
  if (!form) return;

  const symbolInput = form.querySelector('[name="symbol"]');
  const exchangeInput = form.querySelector('[name="exchange"]');
  const suggestionsList = document.getElementById("adminDealSuggestions");
  const selectedExchangeInput = document.getElementById("adminDealSelectedExchange");
  const livePricePreview = document.getElementById("adminDealLivePricePreview");
  const balanceInfoDiv = document.getElementById("adminDealBalanceInfo");
  const balanceFundsEl = document.getElementById("adminDealBalanceFunds");
  const affordableEl = document.getElementById("adminDealAffordable");
  let searchTimer = null;
  let requestToken = 0;
  let quoteToken = 0;
  let currentBalanceFunds = 0;
  let currentLivePrice = 0;

  const updateAffordability = () => {
    if (!affordableEl) return;
    if (currentLivePrice > 0 && currentBalanceFunds > 0) {
      const n = Math.floor(currentBalanceFunds / currentLivePrice);
      affordableEl.textContent = `${n.toLocaleString("en-IN")} stocks`;
      affordableEl.className = n > 0 ? "can-afford" : "";
    } else {
      affordableEl.textContent = currentLivePrice > 0 ? "Select a customer first" : "Select a stock first";
      affordableEl.className = "";
    }
  };

  const customerSelect = form.querySelector('[name="customer_id"]');
  if (customerSelect) {
    customerSelect.addEventListener("change", () => {
      const opt = customerSelect.options[customerSelect.selectedIndex];
      const balance = Number(opt?.dataset?.balance || 0);
      currentBalanceFunds = balance;
      if (balanceInfoDiv && balance >= 0 && customerSelect.value) {
        balanceInfoDiv.style.display = "";
        if (balanceFundsEl) balanceFundsEl.textContent = currency(balance);
        updateAffordability();
      } else if (balanceInfoDiv) {
        balanceInfoDiv.style.display = "none";
      }
    });
  }

  const clearSuggestions = () => {
    if (suggestionsList) suggestionsList.innerHTML = "";
  };

  const setLivePricePreview = ({ state = "idle", title = "Live price preview", price = "Waiting for a stock selection", meta = "Choose a stock from the live search results.", exchange = "" } = {}) => {
    if (!livePricePreview) return;
    livePricePreview.dataset.state = state;
    livePricePreview.innerHTML = `
      <span>${escapeHtml(title)}</span>
      <strong>${escapeHtml(price)}</strong>
      <small>${escapeHtml([meta, exchange].filter(Boolean).join(" · "))}</small>
    `;
  };

  const loadLivePrice = async (symbol, exchange, companyName = "") => {
    if (!symbol) {
      setLivePricePreview();
      return;
    }
    const activeToken = ++quoteToken;
    setLivePricePreview({
      state: "loading",
      title: "Fetching live market price",
      price: "Loading...",
      meta: companyName || symbol,
      exchange
    });
    try {
      const detail = await api(`/stocks/${encodeURIComponent(symbol)}?exchange=${encodeURIComponent(exchange || "NSE")}`);
      if (activeToken !== quoteToken) return;
      const quote = detail?.quote || {};
      setLivePricePreview({
        state: "ready",
        title: "Live market price",
        price: `${currency(quote.price || 0)}`,
        meta: companyName || quote.short_name || symbol,
        exchange: quote.exchange || exchange || "NSE"
      });
      const buyPriceInput = form?.querySelector('[name="buy_price"]');
      if (buyPriceInput && Number(quote.price) > 0) {
        buyPriceInput.value = Number(quote.price).toFixed(2);
      }
      if (Number(quote.price) > 0) {
        currentLivePrice = Number(quote.price);
        updateAffordability();
      }
    } catch {
      if (activeToken !== quoteToken) return;
      setLivePricePreview({
        state: "error",
        title: "Live market price",
        price: "Unavailable",
        meta: companyName || symbol,
        exchange: exchange || "NSE"
      });
      currentLivePrice = 0;
      updateAffordability();
    }
  };

  const applySuggestion = (result) => {
    if (!symbolInput || !exchangeInput) return;
    // Cancel any pending debounced search so it doesn't reopen the dropdown
    if (searchTimer) { window.clearTimeout(searchTimer); searchTimer = null; }
    ++requestToken; // invalidate any in-flight search responses
    symbolInput.value = result.symbol;
    if (selectedExchangeInput) selectedExchangeInput.value = result.exchange || "NSE";
    exchangeInput.value = result.exchange || "NSE";
    clearSuggestions();
    void loadLivePrice(result.symbol, result.exchange || "NSE", result.name || result.symbol);
    if (status) {
      status.textContent = `${result.symbol} selected from ${result.exchange}.`;
    }
  };

  const renderSuggestions = (items) => {
    if (!suggestionsList) return;
    if (!items.length) {
      suggestionsList.innerHTML = `<div class="search-empty">No matching stocks found in the selected market search.</div>`;
      return;
    }
    suggestionsList.innerHTML = items
      .map(
        (item) => `
          <button class="symbol-suggestion-btn" type="button" data-symbol-pick="${escapeHtml(item.symbol)}" data-exchange-pick="${escapeHtml(item.exchange || "NSE")}">
            <span class="symbol-suggestion-main">
              <strong>${escapeHtml(item.symbol)}</strong>
              <small>${escapeHtml(item.name || item.symbol)}</small>
            </span>
            <span class="symbol-suggestion-meta">
              <strong>${escapeHtml(item.exchange || "NSE")}</strong>
              <small>${escapeHtml(item.sector || item.source || "Market search")}</small>
            </span>
          </button>
        `
      )
      .join("");

    suggestionsList.querySelectorAll("[data-symbol-pick]").forEach((button) => {
      // mousedown fires before blur so we can guard against dropdown closing prematurely
      button.addEventListener("mousedown", () => {
        pickingFromDropdown = true;
      });
      button.addEventListener("click", () => {
        pickingFromDropdown = false;
        applySuggestion({
          symbol: button.dataset.symbolPick || "",
          exchange: button.dataset.exchangePick || "NSE",
        });
        if (symbolInput) symbolInput.blur();
      });
    });
  };

  const runSearch = async () => {
    if (!symbolInput || !exchangeInput) return;
    const query = String(symbolInput.value || "").trim();
    const searchExchange = String(exchangeInput.value || "ALL").trim().toUpperCase();
    if (selectedExchangeInput) {
      selectedExchangeInput.value = searchExchange === "ALL" ? "" : searchExchange;
    }
    if (query.length < 3) {
      clearSuggestions();
      setLivePricePreview();
      return;
    }
    const activeToken = ++requestToken;
    try {
      const results = await api(
        `/stocks/search?q=${encodeURIComponent(query)}&exchange=${encodeURIComponent(searchExchange)}&limit=10`
      );
      if (activeToken !== requestToken) return;
      renderSuggestions(Array.isArray(results) ? results : []);
    } catch {
      if (activeToken !== requestToken) return;
      if (suggestionsList) {
        suggestionsList.innerHTML = `<div class="search-empty">Live stock search is unavailable right now. Try a direct symbol like RELIANCE or TCS.</div>`;
      }
    }
  };

  // Track whether user is mid-click on a suggestion so blur doesn't kill it first
  let pickingFromDropdown = false;

  const closeSuggestionsOnBlur = () => {
    // Delay so a mousedown on a suggestion button can set pickingFromDropdown first
    window.setTimeout(() => {
      if (!pickingFromDropdown) clearSuggestions();
    }, 150);
  };

  if (symbolInput) {
    symbolInput.setAttribute("autocomplete", "off");
    symbolInput.setAttribute("autocorrect", "off");
    symbolInput.setAttribute("autocapitalize", "off");
    symbolInput.setAttribute("spellcheck", "false");

    symbolInput.addEventListener("input", () => {
      if (selectedExchangeInput) selectedExchangeInput.value = "";
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(runSearch, 280);
    });

    // Close on blur only — no focus-triggered search (that caused the reopen flicker)
    symbolInput.addEventListener("blur", closeSuggestionsOnBlur);
  }

  if (exchangeInput) {
    exchangeInput.addEventListener("change", () => {
      if (selectedExchangeInput) {
        selectedExchangeInput.value = exchangeInput.value === "ALL" ? "" : exchangeInput.value;
      }
      if (symbolInput && String(symbolInput.value || "").trim().length >= 3) {
        setLivePricePreview();
      }
      void runSearch();
    });
  }

  // Single outside-click handler — use the form's own blur instead of document listener
  // to avoid stacking handlers across refresh cycles

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const stopLoading = setButtonLoading(submitButton, "Adding...");
    try {
      const data = new FormData(form);
      const userId = String(data.get("customer_id") || "").trim();
      const selectedExchange = String(data.get("selected_exchange") || "").trim().toUpperCase();
      const purchaseDateRaw = String(data.get("purchase_date") || "").trim();
      const rawExchange = String(data.get("exchange") || "").trim().toUpperCase();
      const resolvedExchange = selectedExchange || (["NSE", "BSE"].includes(rawExchange) ? rawExchange : "NSE");
      const payload = {
        symbol: String(data.get("symbol") || "").trim().toUpperCase(),
        quantity: Number(data.get("quantity") || 0),
        buy_price: Number(data.get("buy_price") || 0),
        exchange: resolvedExchange,
        created_at: purchaseDateRaw ? new Date(purchaseDateRaw).toISOString() : null
      };
      if (!userId || !payload.symbol || !payload.quantity || !payload.buy_price) {
        throw new Error("Complete all deal fields before adding the position.");
      }
      const customerSelect2 = form.querySelector('[name="customer_id"]');
      const customerOpt = customerSelect2?.options[customerSelect2.selectedIndex];
      const customerName = customerOpt ? customerOpt.text.split(" (")[0] : "Customer";
      await api(`/admin/users/${userId}/holdings`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showAdminSuccessModal(`Deal Added — ${customerName}`, [
        ["Customer", customerName],
        ["Stock Symbol", payload.symbol],
        ["Exchange", payload.exchange],
        ["Quantity", String(payload.quantity)],
        ["Buy Price", currency(payload.buy_price)],
        ["Total Value", currency(payload.quantity * payload.buy_price)]
      ]);
      if (status) status.textContent = `${payload.symbol} added to ${customerName}.`;
      form.reset();
      currentLivePrice = 0;
      if (balanceInfoDiv) balanceInfoDiv.style.display = "none";
      await refreshAdminCurrentPage();
    } catch (error) {
      if (status) status.textContent = formatError(error);
    } finally {
      stopLoading();
    }
  });
}

async function setupAdminFundsForm() {
  const form = document.getElementById("adminFundsForm");
  const status = document.getElementById("adminFundsStatus");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const stopLoading = setButtonLoading(submitButton, "Adding...");
    try {
      const data = new FormData(form);
      const userId = String(data.get("customer_id") || "").trim();
      const amount = Number(data.get("amount") || 0);
      const note = String(data.get("note") || "").trim();
      if (!userId || amount <= 0) {
        throw new Error("Select an investor and enter a valid fund amount.");
      }

      const updatedUser = await api(`/admin/users/${userId}/funds`, {
        method: "POST",
        body: JSON.stringify({ amount, note })
      });

      const fundsCustomerSelect = form.querySelector('[name="customer_id"]');
      const fundsOpt = fundsCustomerSelect?.options[fundsCustomerSelect.selectedIndex];
      const investorName = fundsOpt ? fundsOpt.text.split(" (")[0] : "Investor";
      showAdminSuccessModal(`Funds Added — ${investorName}`, [
        ["Investor", investorName],
        ["Amount Added", currency(amount)],
        ["New Balance", currency(updatedUser.balance_funds || 0)],
        ...(note ? [["Note", note]] : [])
      ]);
      if (status) status.textContent = `Funds added. New balance: ${currency(updatedUser.balance_funds || 0)}.`;
      form.reset();
    } catch (error) {
      if (status) status.textContent = formatError(error);
    } finally {
      stopLoading();
    }
  });
}

async function refreshTableLivePrices() {
  const cells = document.querySelectorAll("[data-live-price-cell]");
  if (!cells.length) return;

  // Group cells by exchange so each batch request uses the correct exchange
  const byExchange = new Map();
  cells.forEach((cell) => {
    const [symbol, exchange = "NSE"] = cell.dataset.livePriceCell.split("::");
    if (!symbol) return;
    const key = exchange.toUpperCase();
    if (!byExchange.has(key)) byExchange.set(key, { symbols: new Set(), cells: [] });
    byExchange.get(key).symbols.add(symbol.toUpperCase());
    byExchange.get(key).cells.push(cell);
  });

  // Fetch prices per exchange group in parallel
  const priceMap = new Map();
  await Promise.all(
    [...byExchange.entries()].map(async ([exchange, { symbols }]) => {
      const feed = await api(
        `/stocks/feed?symbols=${encodeURIComponent([...symbols].join(","))}&exchange=${encodeURIComponent(exchange)}`
      ).catch(() => []);
      (Array.isArray(feed) ? feed : []).forEach((q) => {
        if (q?.symbol && q?.price != null && q.price > 0) {
          priceMap.set(`${String(q.symbol).toUpperCase()}::${exchange}`, Number(q.price));
        }
      });
    })
  );

  cells.forEach((cell) => {
    const [symbol, exchange = "NSE"] = cell.dataset.livePriceCell.split("::");
    const price = priceMap.get(`${symbol}::${exchange.toUpperCase()}`);
    const avgPrice = parseFloat(cell.dataset.avgPrice) || 0;
    cell.classList.remove("live-price-fetching");
    if (price != null && price > 0) {
      cell.textContent = currency(price);
      cell.classList.add("live-price-loaded");
      if (avgPrice > 0) {
        cell.classList.add(price >= avgPrice ? "profit" : "loss");
      }
    } else {
      cell.textContent = "—";
    }
  });
}

function setupDetailEyeButtons(container) {
  (container || document).querySelectorAll("[data-stock-visibility-toggle]").forEach((button) => {
    if (button._eyeListenerAttached) return;
    button._eyeListenerAttached = true;
    button.addEventListener("click", () => {
      toggleAdminRevealedStock(button.dataset.stockVisibilityToggle);
      refreshAdminStockVisibility(button.dataset.stockVisibilityToggle);
    });
  });
}


function setupPortalActions() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => logoutAndResetPortals());
  });

  document.querySelectorAll("[data-refresh-admin]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Refreshing...";
      try {
        await renderAdminPortal();
      } finally {
        button.disabled = false;
        button.textContent = originalText || "Refresh";
      }
    });
  });

  document.querySelectorAll("[data-admin-action-nav]").forEach((select) => {
    select.addEventListener("change", () => {
      if (!select.value) return;
      window.location.href = select.value;
    });
  });

  document.querySelectorAll(".admin-dropdown-menu").forEach((dropdown) => {
    if (dropdown.dataset.outsideCloseBound === "true") return;
    dropdown.dataset.outsideCloseBound = "true";

    dropdown.addEventListener("toggle", () => {
      adminUiState.actionsMenuOpen = dropdown.open;
    });

    const closeDropdown = () => dropdown.removeAttribute("open");

    document.addEventListener("click", (event) => {
      if (dropdown.contains(event.target)) return;
      closeDropdown();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDropdown();
    });
  });

  document.querySelectorAll("[data-sold-history-toggle]").forEach((button) => {
    if (button.dataset.soldHistoryToggleBound === "true") return;
    button.dataset.soldHistoryToggleBound = "true";
    button.addEventListener("click", () => {
      const body = button.closest("article")?.querySelector(".sold-history-body");
      if (!body) return;
      const isHidden = body.classList.toggle("hidden");
      button.classList.toggle("is-active", !isHidden);
      button.title = isHidden ? "Show sold history" : "Hide sold history";
    });
  });

  document.querySelectorAll("[data-admin-reset-password]").forEach((button) => {
    if (button.dataset.resetPasswordBound === "true") return;
    button.dataset.resetPasswordBound = "true";
    button.addEventListener("click", async () => {
      const userId = button.dataset.adminResetPassword;
      const userName = button.dataset.userName || "this investor";
      const newPassword = await showResetPasswordModal({ userId, userName });
      if (!newPassword) return;
      const stopLoading = setButtonLoading(button, "Resetting...");
      try {
        await api(`/admin/users/${userId}/reset-password`, {
          method: "POST",
          body: JSON.stringify({ password: newPassword })
        });
        showAdminSuccessModal(`Password Reset — ${userName}`, [
          ["Investor", userName],
          ["New Password", newPassword],
          ["Status", "Reset successfully"]
        ]);
      } catch (error) {
        alert(formatError(error));
      } finally {
        stopLoading();
      }
    });
  });

  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    if (button.dataset.deleteBound === "true") return;
    button.dataset.deleteBound = "true";
    button.addEventListener("click", async () => {
      const userId = button.dataset.deleteUser;
      const userName = button.dataset.userName || "this investor";
      if (!confirm(`Delete ${userName}? This will remove all their holdings and data permanently.`)) return;
      const stopLoading = setButtonLoading(button, "Deleting...");
      try {
        await api(`/admin/users/${userId}`, { method: "DELETE" });
        await renderAdminDatabasePage({ silent: true });
      } catch (error) {
        alert(formatError(error));
      } finally {
        stopLoading();
      }
    });
  });

  document.querySelectorAll("[data-edit-investor]").forEach((button) => {
    if (button.dataset.editBound === "true") return;
    button.dataset.editBound = "true";
    button.addEventListener("click", () => {
      showInvestorEditModal({
        userId: button.dataset.editInvestor,
        name: button.dataset.editName || "",
        phone: button.dataset.editPhone || "",
        isActive: button.dataset.editActive === "1",
        initialFunds: parseFloat(button.dataset.editInitial || "0"),
        balanceFunds: parseFloat(button.dataset.editBalance || "0"),
      });
    });
  });
}

function showInvestorEditModal({ userId, name, phone, isActive, initialFunds, balanceFunds }) {
  const existing = document.getElementById("investorEditModalOverlay");
  if (existing) existing.remove();
  const overlay = document.createElement("div");
  overlay.id = "investorEditModalOverlay";
  overlay.className = "admin-pwd-modal-overlay";
  overlay.innerHTML = `
    <div class="admin-pwd-modal admin-pwd-modal--wide" role="dialog" aria-modal="true" aria-labelledby="investorEditTitle">
      <h3 id="investorEditTitle">Edit Investor Details</h3>
      <p>Update investor information. Changes apply immediately to the database.</p>
      <div class="admin-inline-form-grid" style="margin-bottom:18px;">
        <div class="admin-form-field">
          <label for="ief_name">Full Name</label>
          <input class="input-field" id="ief_name" type="text" value="${escapeHtml(name)}" />
        </div>
        <div class="admin-form-field">
          <label for="ief_phone">Phone Number</label>
          <input class="input-field" id="ief_phone" type="tel" value="${escapeHtml(phone)}" />
        </div>
        <div class="admin-form-field">
          <label for="ief_initial">Initial Funds (₹)</label>
          <input class="input-field" id="ief_initial" type="number" min="0" step="0.01" value="${initialFunds}" />
        </div>
        <div class="admin-form-field">
          <label for="ief_balance">Balance Funds (₹)</label>
          <input class="input-field" id="ief_balance" type="number" min="0" step="0.01" value="${balanceFunds}" />
        </div>
      </div>
      <div class="admin-form-field" style="margin-bottom:18px;">
        <label for="ief_status">Account Status</label>
        <select class="input-field" id="ief_status">
          <option value="1" ${isActive ? "selected" : ""}>Active</option>
          <option value="0" ${!isActive ? "selected" : ""}>Inactive</option>
        </select>
      </div>
      <p id="iefErr" style="color:var(--loss);font-size:0.84rem;margin:0 0 12px;display:none;"></p>
      <div class="admin-pwd-modal-actions">
        <button class="secondary-btn compact-btn" type="button" id="iefCancel">Cancel</button>
        <button class="primary-btn compact-btn" type="button" id="iefSubmit">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const errEl = document.getElementById("iefErr");
  const submitBtn = document.getElementById("iefSubmit");
  const close = () => overlay.remove();

  document.getElementById("iefCancel").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  submitBtn.addEventListener("click", async () => {
    const full_name = document.getElementById("ief_name").value.trim();
    const phone_number = document.getElementById("ief_phone").value.trim();
    const initial_funds = parseFloat(document.getElementById("ief_initial").value || "0");
    const balance_funds = parseFloat(document.getElementById("ief_balance").value || "0");
    const is_active = document.getElementById("ief_status").value === "1";

    if (!full_name || !phone_number) {
      errEl.textContent = "Name and phone are required."; errEl.style.display = "block"; return;
    }
    submitBtn.disabled = true; submitBtn.textContent = "Saving..."; errEl.style.display = "none";
    try {
      await api(`/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, phone_number, is_active, initial_funds, balance_funds }),
      });
      overlay.remove();
      showAdminSuccessModal("Investor Updated", [
        ["Name", full_name],
        ["Phone", phone_number],
        ["Status", is_active ? "Active" : "Inactive"],
        ["Balance Funds", `₹${balance_funds.toLocaleString("en-IN")}`],
      ]);
      setTimeout(() => renderAdminDatabasePage({ silent: true }), 900);
    } catch (err) {
      errEl.textContent = formatError(err); errEl.style.display = "block";
      submitBtn.disabled = false; submitBtn.textContent = "Save Changes";
    }
  });

  setTimeout(() => { const el = document.getElementById("ief_name"); if (el) el.focus(); }, 50);
}

function setupScrollSync(wrapId, scrollerId) {
  const wrap = document.getElementById(wrapId);
  const scroller = document.getElementById(scrollerId);
  const inner = scroller?.querySelector(".admin-table-bottom-scroll-inner");
  const table = wrap?.querySelector("table");
  if (!wrap || !scroller || !inner || !table) return;

  const syncWidths = () => {
    inner.style.width = `${table.scrollWidth}px`;
    scroller.classList.toggle("hidden", table.scrollWidth <= wrap.clientWidth + 4);
  };

  let syncingFromWrap = false;
  let syncingFromScroller = false;

  wrap.addEventListener("scroll", () => {
    if (syncingFromScroller) return;
    syncingFromWrap = true;
    scroller.scrollLeft = wrap.scrollLeft;
    syncingFromWrap = false;
  });

  scroller.addEventListener("scroll", () => {
    if (syncingFromWrap) return;
    syncingFromScroller = true;
    wrap.scrollLeft = scroller.scrollLeft;
    syncingFromScroller = false;
  });

  window.addEventListener("resize", syncWidths);
  // Defer first sync to let the browser finish layout before measuring widths
  requestAnimationFrame(() => requestAnimationFrame(syncWidths));
}

function buildAdminActionToolbar(selectedValue = "") {
  return `
    <header class="user-topbar admin-compact-topbar">
      <div class="admin-toolbar-left admin-toolbar-left--compact">
        <div class="brand admin-dashboard-brand admin-dashboard-brand--compact">
          <span class="brand-mark brand-logo brand-logo-lg"><img src="./assets/updated_logo.png" alt="Asset Yantra logo" /></span>
          <span class="public-brand-copy">
            <strong class="brand-wordmark">Asset Yantra</strong>
            <small class="brand-tagline">MARKETS. INSIGHTS. WEALTH.</small>
          </span>
        </div>
      </div>
      <div class="user-topbar-actions admin-toolbar-right">
        <a class="secondary-btn compact-btn" href="./admin-dashboard.html">← Dashboard</a>
        <details class="admin-dropdown-menu" ${adminUiState.actionsMenuOpen ? "open" : ""}>
          <summary class="secondary-btn compact-btn">Admin Actions</summary>
          <div class="admin-dropdown-panel">
            <p class="admin-dropdown-section-label">Quick Actions</p>
            <div class="admin-dropdown-links">
              <a class="secondary-btn compact-btn" href="./admin-add-customer.html"><strong>Add Customer</strong><small>Open the dedicated registration page</small></a>
              <a class="secondary-btn compact-btn" href="./admin-add-deal.html"><strong>Add Deal</strong><small>Open the separate deal entry page</small></a>
              <a class="secondary-btn compact-btn" href="./admin-add-funds.html"><strong>Add Funds</strong><small>Top up balance funds for an investor</small></a>
            </div>
          </div>
        </details>
        <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
      </div>
    </header>
  `;
}

async function renderAdminCustomerPage() {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  showDashboardLoading("Add Customer", "Loading the customer registration form");

  mount.innerHTML = `
    <section class="dashboard-stack admin-dashboard-stack">
      ${buildAdminActionToolbar("customer")}
      <article class="dashboard-card full-span-card admin-form-page-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Admin Only</p>
            <h3>Add Customer</h3>
            <p class="helper-text">Create customer access from admin only. The generated client ID is used for user login.</p>
          </div>
          <span class="badge green">Customer Access</span>
        </div>
        <form id="adminCustomerForm" class="admin-inline-form">
          <label><span>Customer Name</span><input name="full_name" type="text" placeholder="Customer full name" required /></label>
          <label><span>Email</span><input name="email" type="email" placeholder="client@email.com" required /></label>
          <label><span>Phone</span><input name="phone_number" type="tel" placeholder="Phone number" required /></label>
          <label><span>Password</span><input name="password" type="password" placeholder="Minimum 8 characters" required /></label>
          <label><span>Total Investment</span><input name="balance_funds" type="number" min="0" step="0.01" placeholder="1000000" /></label>
          <button class="primary-btn" type="submit">Create Customer</button>
        </form>
        <p class="helper-text" id="adminCustomerStatus">Client ID will be generated after the customer account is created.</p>
      </article>
    </section>
  `;

  hideDashboardLoading();
  revealPortal(mount);
  activeRole = "admin";
  activeUserId = null;
  setupPortalActions();
  await setupAdminCustomerForm();
}

async function renderAdminDealPage() {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  showDashboardLoading("Add Deal", "Loading deal entry form");

  let users = [];
  try {
    users = await api("/admin/users");
  } catch {
    users = [];
  }

  mount.innerHTML = `
    <section class="dashboard-stack admin-dashboard-stack">
      ${buildAdminActionToolbar("deal")}
      <article class="dashboard-card full-span-card admin-form-page-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Deal Entry</p>
            <h3>Add Deal</h3>
            <p class="helper-text">Add a stock position directly to a customer portfolio. Repeated buys for the same stock are merged into one averaged holding.</p>
          </div>
          <span class="badge">Workflow</span>
        </div>
        <form id="adminDealForm" class="admin-inline-form">
          <label>
            <span>Customer</span>
            <select name="customer_id">
              <option value="">Select customer</option>
              ${(Array.isArray(users) ? users : [])
                .map((user) => `<option value="${user.user_id}" data-balance="${Number(user.balance_funds || 0).toFixed(2)}">${escapeHtml(user.full_name)} (${escapeHtml(user.fixed_user_id || user.username || "")})</option>`)
                .join("")}
            </select>
          </label>
          <label class="portfolio-symbol-wrap">
            <span>Stock Name / Symbol</span>
            <input name="symbol" type="text" placeholder="Search NSE / BSE stocks" autocomplete="off" />
            <input type="hidden" name="selected_exchange" id="adminDealSelectedExchange" value="" />
            <div class="symbol-suggestion-list" id="adminDealSuggestions"></div>
          </label>
          <label><span>Quantity</span><input name="quantity" type="number" placeholder="100" /></label>
          <label><span>Buy Price</span><input name="buy_price" type="number" placeholder="1500" /></label>
          <label><span>Purchase Date</span><input name="purchase_date" type="date" max="${new Date().toISOString().split('T')[0]}" /></label>
          <label>
            <span>Search Market</span>
            <select name="exchange">
              <option value="" disabled selected>Select Exchange</option>
              <option value="ALL">All NSE / BSE</option>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
          </label>
          <div class="admin-deal-balance-info" id="adminDealBalanceInfo" style="display:none">
            <div class="admin-deal-balance-row"><span>Customer Balance Funds</span><strong id="adminDealBalanceFunds">—</strong></div>
            <div class="admin-deal-balance-row"><span>Max Stocks Purchasable</span><strong id="adminDealAffordable">Select a stock first</strong></div>
          </div>
          <div class="portfolio-live-price-preview" id="adminDealLivePricePreview" data-state="idle">
            <span>Live price preview</span>
            <strong>Waiting for a stock selection</strong>
            <small>Type at least 3 letters and choose a stock from the live search list.</small>
          </div>
          <button class="primary-btn" type="submit">Add Deal</button>
        </form>
        <p class="helper-text" id="adminDealStatus">Choose a customer, enter the position, and submit to add the deal.</p>
      </article>
    </section>
  `;

  hideDashboardLoading();
  revealPortal(mount);
  activeRole = "admin";
  activeUserId = null;
  setupPortalActions();
  await setupAdminDealForm();
}

async function renderAdminFundsPage() {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  showDashboardLoading("Add Funds", "Loading funds management form");

  let users = [];
  try {
    users = await api("/admin/users");
  } catch {
    users = [];
  }

  mount.innerHTML = `
    <section class="dashboard-stack admin-dashboard-stack">
      ${buildAdminActionToolbar("funds")}
      <article class="dashboard-card full-span-card admin-form-page-card">
        <div class="panel-head">
          <div>
            <p class="eyebrow">Funds Desk</p>
            <h3>Add Funds</h3>
            <p class="helper-text">Top up balance funds for an investor. Initial funds stay as the original opening amount.</p>
          </div>
          <span class="badge">Balance Update</span>
        </div>
        <form id="adminFundsForm" class="admin-inline-form">
          <label>
            <span>Investor</span>
            <select name="customer_id">
              <option value="">Select investor</option>
              ${(Array.isArray(users) ? users : [])
                .map((user) => `<option value="${user.user_id}">${escapeHtml(user.full_name)} (${escapeHtml(user.fixed_user_id || user.username || "")}) - Balance ${currency(user.balance_funds || 0)}</option>`)
                .join("")}
            </select>
          </label>
          <label><span>Fund Amount</span><input name="amount" type="number" min="0.01" step="0.01" placeholder="100000" required /></label>
          <label><span>Note</span><input name="note" type="text" placeholder="Optional note for this top-up" /></label>
          <button class="primary-btn" type="submit">Add Funds</button>
        </form>
        <p class="helper-text" id="adminFundsStatus">Choose an investor and enter the amount to top up balance funds.</p>
      </article>
    </section>
  `;

  hideDashboardLoading();
  revealPortal(mount);
  activeRole = "admin";
  activeUserId = null;
  setupPortalActions();
  await setupAdminFundsForm();
}

async function renderAdminDatabasePage(options = {}) {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  if (adminRenderInFlight) return;
  adminRenderInFlight = true;
  const { silent = false } = options;

  if (!silent) {
    showDashboardLoading("Loading Database", "Fetching investor records, holdings, and portfolio data");
  }

  try {
    const [users, adminUsers] = await Promise.all([api("/admin/users"), api("/admin/admins").catch(() => [])]);
    const safeUsers = Array.isArray(users) ? users : [];
    const safeAdmins = Array.isArray(adminUsers) ? adminUsers : [];
    const userDashboards = await safeAdminUserDashboards(safeUsers);
    const dashboardMap = new Map(userDashboards.map((dashboard) => [String(dashboard.user_id), dashboard]));
    const totalPortfolioValue = userDashboards.reduce((sum, dashboard) => sum + Number(dashboard.total_portfolio_value || 0), 0);
    const totalProfitLoss = userDashboards.reduce((sum, dashboard) => sum + Number(dashboard.total_profit_loss || 0), 0);
    const totalHoldings = userDashboards.reduce((sum, dashboard) => sum + Number(dashboard.total_holdings || 0), 0);
    const holdingsRows = userDashboards.flatMap((dashboard) =>
      (dashboard.holdings || []).map((holding) => ({
        full_name: dashboard.full_name,
        fixed_user_id: dashboard.fixed_user_id,
        username: dashboard.username,
        ...holding
      }))
    );

    mount.innerHTML = `
      <section class="user-shell admin-simple-shell no-sidebar-shell">
        <div class="user-shell-main admin-simple-main dashboard-stack admin-dashboard-stack">
          <header class="user-topbar admin-compact-topbar admin-simple-topbar">
            <div class="admin-toolbar-left admin-toolbar-left--compact">
              <div class="brand admin-dashboard-brand">
                <span class="brand-mark brand-logo brand-logo-lg"><img src="./assets/updated_logo.png" alt="Asset Yantra logo" /></span>
                <span class="public-brand-copy">
                  <strong class="brand-wordmark">Asset Yantra</strong>
                  <small class="brand-tagline">MARKETS. INSIGHTS. WEALTH.</small>
                </span>
              </div>
            </div>
            <div class="user-topbar-actions admin-toolbar-right admin-database-toolbar-right">
              <a class="secondary-btn compact-btn" href="./admin-dashboard.html">Back to Dashboard</a>
              <button class="secondary-btn compact-btn" type="button" id="adminDatabaseExportBtn">Download Excel</button>
              <a class="secondary-btn compact-btn" href="./admin-add-funds.html">Add Funds</a>
              <button class="danger-outline-btn compact-btn" type="button" id="clearSoldHistoryBtn">Clear Sold History</button>
              <button class="danger-outline-btn compact-btn" type="button" id="clearAllUsersBtn">Clear All Users</button>
              <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
            </div>
          </header>

          <article class="table-card admin-database-card full-span-card">
            <div class="panel-head">
              <div>
                <h3>Investor Credentials &amp; Portfolio Database</h3>
                <p class="helper-text admin-positions-helper">Simple database view of investor records and portfolio rows. Passwords are excluded. Refreshes every 10 seconds.</p>
              </div>
              <span class="badge green">${safeUsers.length} Investors / ${totalHoldings} Holdings</span>
            </div>
            <div class="admin-database-statline">
              <span><strong>${safeUsers.length}</strong> Investors</span>
              <span><strong>${safeUsers.filter((user) => user.is_active).length}</strong> Active</span>
              <span><strong>${totalHoldings}</strong> Holdings</span>
              <span><strong>${currency(safeUsers.reduce((sum, user) => sum + Number(user.balance_funds || 0), 0))}</strong> Total Investment</span>
              <span><strong>${currency(totalPortfolioValue)}</strong> Portfolio Value</span>
              <span class="${totalProfitLoss >= 0 ? "profit" : "loss"}"><strong>${currency(totalProfitLoss)}</strong> Total P&amp;L</span>
            </div>

            <div class="table-wrap admin-position-table-wrap admin-database-table-wrap" id="adminDatabaseUsersWrap">
              <table class="admin-position-table admin-database-table" id="adminDatabaseUsersTable">
                <thead>
                  <tr>
                    <th>Investor Name</th>
                    <th>Client ID</th>
                    <th>Username / Email</th>
                    <th>Phone Number</th>
                    <th>Total Investment</th>
                    <th>Current Value</th>
                    <th>Balance Fund</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Mode</th>
                    <th>Created At</th>
                    <th>Portfolio Value</th>
                    <th>Total Holdings</th>
                    <th>Total P&amp;L</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${safeUsers.length
                    ? safeUsers
                        .map((user) => {
                          const dashboard = dashboardMap.get(String(user.user_id));
                          const holdings = Array.isArray(dashboard?.holdings) ? dashboard.holdings : [];
                          return `
                            <tr>
                              <td><strong style="color:#2c90f0">${escapeHtml(user.full_name || "Unknown Investor")}</strong></td>
                              <td>${escapeHtml(user.fixed_user_id || "")}</td>
                              <td>${escapeHtml(user.username || "")}</td>
                              <td>${escapeHtml(user.phone_number || "")}</td>
                              <td>${currency(user.balance_funds || 0)}</td>
                              <td>${currency(dashboard?.total_portfolio_value ?? user.portfolio_value ?? 0)}</td>
                              <td>${currency(Math.max(0, Number(user.balance_funds || 0) - holdings.reduce((s, h) => s + Number(h.buy_price || 0) * Number(h.quantity || 0), 0)))}</td>
                              <td><span class="badge ${user.is_active ? "green" : "red"}">${user.is_active ? "Active" : "Inactive"}</span></td>
                              <td>${escapeHtml((user.role || "user").toUpperCase())}</td>
                              <td>${user.is_demo ? "Demo" : "Live"}</td>
                              <td>${formatDateTime(user.created_at)}</td>
                              <td>${currency(dashboard?.total_portfolio_value ?? user.portfolio_value ?? 0)}</td>
                              <td>${dashboard?.total_holdings ?? user.total_holdings ?? 0}</td>
                              <td class="${Number(dashboard?.total_profit_loss || 0) >= 0 ? "profit" : "loss"}">${currency(dashboard?.total_profit_loss || 0)}</td>
                              <td style="display:flex;gap:6px;">
                                <button class="secondary-btn compact-btn" type="button"
                                  data-edit-investor="${user.user_id}"
                                  data-edit-name="${escapeHtml(user.full_name || '')}"
                                  data-edit-phone="${escapeHtml(user.phone_number || '')}"
                                  data-edit-active="${user.is_active ? '1' : '0'}"
                                  data-edit-initial="${user.initial_funds || 0}"
                                  data-edit-balance="${user.balance_funds || 0}">Edit</button>
                                <button class="secondary-btn compact-btn" type="button" data-admin-reset-password="${user.user_id}" data-user-name="${escapeHtml(user.full_name || user.username || '')}">Reset Password</button>
                                <button class="danger-outline-btn compact-btn" type="button" data-delete-user="${user.user_id}" data-user-name="${escapeHtml(user.full_name || user.username || '')}">Delete</button>
                              </td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="16"><span class="helper-text">No investors found in the database.</span></td></tr>`}
                </tbody>
              </table>
            </div>
            <div class="admin-table-bottom-scroll" id="adminDatabaseUsersScroller" aria-label="Scroll users table horizontally">
              <div class="admin-table-bottom-scroll-inner"></div>
            </div>

            <div class="panel-head admin-database-subhead">
              <div>
                <h3>Portfolio Holdings</h3>
                <p class="helper-text admin-positions-helper">Each row below represents one live holding in the database.</p>
              </div>
              <span class="badge">${holdingsRows.length} Rows</span>
            </div>
            <div class="table-wrap admin-position-table-wrap admin-database-table-wrap" id="adminDatabaseHoldingsWrap">
              <table class="admin-position-table admin-database-table admin-database-holdings-table" id="adminDatabaseHoldingsTable">
                <thead>
                  <tr>
                    <th>Investor Name</th>
                    <th>Client ID</th>
                    <th>Username / Email</th>
                    <th>Symbol</th>
                    <th>Exchange</th>
                    <th>Purchase Date</th>
                    <th>Qty</th>
                    <th>Avg Price</th>
                    <th>Current Price</th>
                    <th>Current Value</th>
                    <th>Unrealised P&amp;L</th>
                    <th>P&amp;L %</th>
                  </tr>
                </thead>
                <tbody>
                  ${holdingsRows.length
                    ? holdingsRows
                        .map(
                          (holding) => `
                            <tr>
                              <td><strong style="color:#2c90f0">${escapeHtml(holding.full_name || "Unknown Investor")}</strong></td>
                              <td>${escapeHtml(holding.fixed_user_id || "")}</td>
                              <td>${escapeHtml(holding.username || "")}</td>
                              <td>${escapeHtml(holding.symbol || "")}</td>
                              <td>${escapeHtml(holding.exchange || "NSE")}</td>
                              <td>${formatDateTime(holding.created_at)}</td>
                              <td>${escapeHtml(String(holding.quantity ?? 0))}</td>
                              <td>${currency(holding.buy_price || 0)}</td>
                              <td>${currency(holding.current_price || 0)}</td>
                              <td>${currency(holding.value || 0)}</td>
                              <td class="${Number(holding.profit_loss || 0) >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss || 0)}</td>
                              <td class="${Number(holding.percent_change || 0) >= 0 ? "profit" : "loss"}">${percent(holding.percent_change || 0)}</td>
                            </tr>
                          `
                        )
                        .join("")
                    : `<tr><td colspan="12"><span class="helper-text">No portfolio holdings found.</span></td></tr>`}
                </tbody>
              </table>
            </div>
            <div class="admin-table-bottom-scroll" id="adminDatabaseHoldingsScroller" aria-label="Scroll holdings table horizontally">
              <div class="admin-table-bottom-scroll-inner"></div>
            </div>

            <div class="panel-head admin-database-subhead">
              <div>
                <h3>Admin Management</h3>
                <p class="helper-text admin-positions-helper">View, create, and manage admin accounts. Reset passwords directly from here.</p>
              </div>
              <button class="primary-btn compact-btn" type="button" id="adminCreateAdminBtn">+ New Admin</button>
            </div>

            <div class="table-wrap admin-position-table-wrap admin-database-table-wrap" id="adminDatabaseAdminsWrap">
              <table class="admin-position-table admin-database-table" id="adminDatabaseAdminsTable">
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Username / Email</th>
                    <th>Phone Number</th>
                    <th>Status</th>
                    <th>Created At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${safeAdmins.length
                    ? safeAdmins.map((admin) => `
                      <tr>
                        <td><strong style="color:#2c90f0">${escapeHtml(admin.full_name || "")}</strong></td>
                        <td>${escapeHtml(admin.username || "")}</td>
                        <td>${escapeHtml(admin.phone_number || "")}</td>
                        <td><span class="badge ${admin.is_active ? "green" : "red"}">${admin.is_active ? "Active" : "Inactive"}</span></td>
                        <td>${formatDateTime(admin.created_at)}</td>
                        <td style="display:flex;gap:6px;">
                          <button class="secondary-btn compact-btn" type="button"
                            data-admin-edit="${admin.admin_id}"
                            data-admin-name="${escapeHtml(admin.full_name || "")}"
                            data-admin-phone="${escapeHtml(admin.phone_number || "")}">Edit</button>
                          <button class="secondary-btn compact-btn" type="button"
                            data-admin-reset-admin-password="${admin.admin_id}"
                            data-admin-name="${escapeHtml(admin.full_name || admin.username || '')}">Reset Password</button>
                        </td>
                      </tr>
                    `).join("")
                    : `<tr><td colspan="6" class="text-center"><span class="helper-text">No admin accounts found.</span></td></tr>`}
                </tbody>
              </table>
            </div>
          </article>
        </div>
      </section>
    `;

    if (!silent) {
      hideDashboardLoading();
      revealPortal(mount);
    } else {
      mount.classList.remove("hidden");
    }
    activeRole = "admin";
    activeUserId = null;
    startAdminRefresh();
    setupPortalActions();
    setupScrollSync("adminDatabaseUsersWrap", "adminDatabaseUsersScroller");
    setupScrollSync("adminDatabaseHoldingsWrap", "adminDatabaseHoldingsScroller");
    setupAdminDatabaseExport(safeUsers, userDashboards);
    setupAdminClearButtons();
    setupAdminManagement();
  } catch (error) {
    hideDashboardLoading();
    renderPortalError(mount, "Database View", `The database view could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) {
      retry.addEventListener("click", () => renderAdminDatabasePage());
    }
  } finally {
    adminRenderInFlight = false;
  }
}

function maybeShowBalanceWarning(user) {
  const holdings = Array.isArray(user.holdings) ? user.holdings : [];
  const totalInvestment = Number(user.balance_funds || 0);
  const totalInvested = holdings.reduce((s, h) => s + Number(h.buy_price || 0) * Number(h.quantity || 0), 0);
  const balanceFund = totalInvestment - totalInvested;
  if (balanceFund < 0) {
    showBalanceWarningPopup({
      investorName: user.full_name || "This investor",
      clientId: user.fixed_user_id || user.username || "",
      shortfall: Math.abs(balanceFund),
      investedValue: totalInvested,
      totalInvestment,
    });
  }
}

function buildAdminClientDetail(user, soldHistory = [], focusSymbol = "") {
  const safeHoldings = Array.isArray(user.holdings) ? user.holdings : [];
  const userSoldHistory = soldHistory.filter((entry) => Number(entry.user_id) === Number(user.user_id));
  const detailRealizedMap = userSoldHistory.reduce((map, entry) => {
    const key = String(entry.symbol || "").toUpperCase();
    map.set(key, (map.get(key) || 0) + Number(entry.profit_loss || 0));
    return map;
  }, new Map());

  const totalInvested = safeHoldings.reduce((s, h) => s + Number(h.buy_price || 0) * Number(h.quantity || 0), 0);
  const totalCurrent = safeHoldings.reduce((s, h) => s + Number(h.current_price || 0) * Number(h.quantity || 0), 0);
  const totalUnrealized = safeHoldings.reduce((s, h) => s + Number(h.profit_loss || 0), 0);
  const totalToday = safeHoldings.reduce((s, h) => s + Number(h.today_profit || 0), 0);
  const totalRealized = userSoldHistory.reduce((s, e) => s + Number(e.profit_loss || 0), 0);
  const totalPnl = totalUnrealized + totalRealized;
  const totalQty = safeHoldings.reduce((s, h) => s + Number(h.quantity || 0), 0);
  const soldTotalQty = userSoldHistory.reduce((s, e) => s + Number(e.quantity || 0), 0);

  // Total Investment = lifetime funds deposited (stored as balance_funds in DB)
  const totalInvestment = Number(user.balance_funds || 0);
  const balanceFund = totalInvestment - totalInvested;
  const currentFunds = totalCurrent;
  const totalReturn = currentFunds + balanceFund - totalInvestment; // = totalCurrent - totalInvested
  const totalReturnPct = totalInvestment > 0 ? (totalReturn / totalInvestment) * 100 : 0;

  return `
    <article class="dashboard-card detail-card">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Investor Detail</p>
          <h3 style="color:#2c90f0">${escapeHtml(user.full_name)}</h3>
          <p class="detail-subtitle">${escapeHtml(user.fixed_user_id || user.username || "")}</p>
        </div>
      </div>
      <div class="detail-stat-grid detail-stat-grid--5">
        <article><strong>${currency(totalInvestment)}</strong><span>Total Investment</span></article>
        <article><strong class="${balanceFund >= 0 ? "" : "loss"}">${currency(balanceFund)}</strong><span>Balance Fund</span></article>
        <article><strong>${currency(currentFunds)}</strong><span>Current Funds</span></article>
        <article><strong class="${totalReturn >= 0 ? "profit" : "loss"}">${currency(totalReturn)}</strong><span>Total Return</span></article>
        <article><strong class="${totalReturnPct >= 0 ? "profit" : "loss"}">${percent(totalReturnPct)}</strong><span>Total Return %</span></article>
      </div>
      ${balanceFund < 0 ? `
      <div class="balance-negative-banner">
        ⚠ <strong>Balance Fund is negative.</strong> Invested value (${currency(totalInvested)}) exceeds Total Investment (${currency(totalInvestment)}) by ${currency(Math.abs(balanceFund))}. Please add funds or reduce holdings.
      </div>` : ""}

      <article class="table-card" style="margin-top:18px;">
        <div class="panel-head"><h3>Live Positions</h3><span class="badge">Realtime</span></div>
        <div class="table-wrap admin-position-table-wrap" id="adminDetailLiveWrap">
          <table class="admin-position-table">
            <thead>
              <tr>
                <th>Stock</th>
                <th>Purchase Date</th>
                <th>Qty</th>
                <th>Avg Price</th>
                <th>Invested Value</th>
                <th>Current Value</th>
                <th>Unrealised P&amp;L</th>
                <th>Today&apos;s P&amp;L</th>
                <th>Realised P&amp;L</th>
                <th>Total P&amp;L</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${safeHoldings.length
                ? safeHoldings.map((holding) => {
                    const investedValue = Number(holding.buy_price || 0) * Number(holding.quantity || 0);
                    const currentValue = Number(holding.current_price || 0) * Number(holding.quantity || 0);
                    const valueClass = currentValue >= investedValue ? "profit" : "loss";
                    const realizedProfit = detailRealizedMap.get(String(holding.symbol || "").toUpperCase()) || 0;
                    const totalProfit = Number(holding.profit_loss || 0) + realizedProfit;
                    const isFocus = focusSymbol && String(holding.symbol || "").toUpperCase() === String(focusSymbol || "").toUpperCase();
                    return `
                      <tr${isFocus ? ' class="admin-detail-highlight-row"' : ""}>
                        <td>
                          <div class="admin-stock-cell">
                            <button class="admin-eye-btn ${isAdminStockRevealed(holding.symbol) ? "is-active" : ""}" type="button" data-stock-visibility-toggle="${escapeHtml(String(holding.symbol || "").toUpperCase())}" aria-label="Toggle stock name">&#128065;</button>
                            <span class="sold-history-symbol" data-stock-label="${escapeHtml(String(holding.symbol || "").toUpperCase())}">${isAdminStockRevealed(holding.symbol) ? escapeHtml(holding.symbol) : maskStockSymbol(holding.symbol)}</span>
                          </div>
                          <small>${escapeHtml(holding.exchange || "NSE")}</small>
                        </td>
                        <td>${formatDate(holding.created_at)}</td>
                        <td>${holding.quantity}</td>
                        <td>${currency(holding.buy_price)}</td>
                        <td class="${valueClass}">${currency(investedValue)}</td>
                        <td class="${valueClass}">${currency(currentValue)}</td>
                        <td class="${Number(holding.profit_loss || 0) >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}<br /><small>${percent(holding.percent_change || 0)}</small></td>
                        <td class="${Number(holding.today_profit || 0) >= 0 ? "profit" : "loss"}">${currency(holding.today_profit || 0)}</td>
                        <td class="${realizedProfit >= 0 ? "profit" : "loss"}">${currency(realizedProfit)}</td>
                        <td class="${totalProfit >= 0 ? "profit" : "loss"}">${currency(totalProfit)}</td>
                        <td class="action-cell-duo">
                          <button class="buy-action-btn" type="button" data-admin-buy-holding="${holding.holding_id}" data-user-id="${user.user_id}" data-symbol="${escapeHtml(holding.symbol)}" data-owner="${escapeHtml(user.name || '')}" data-exchange="${escapeHtml(holding.exchange || 'NSE')}" data-buy-price="${holding.buy_price}">Buy</button>
                          <button class="edit-action-btn" type="button" data-admin-edit-holding="${holding.holding_id}" data-symbol="${escapeHtml(holding.symbol)}" data-owner="${escapeHtml(user.name || '')}" data-quantity="${holding.quantity}" data-buy-price="${holding.buy_price}" data-created-at="${escapeHtml(holding.created_at || '')}">Edit</button>
                          <button class="sell-action-btn" type="button" data-admin-sell-holding="${holding.holding_id}" data-symbol="${escapeHtml(holding.symbol)}" data-owner="${escapeHtml(user.name || '')}" data-quantity="${holding.quantity}" data-buy-price="${holding.buy_price}">Sell</button>
                        </td>
                      </tr>
                    `;
                  }).join("")
                : `<tr><td colspan="11"><span class="helper-text">No live positions for this investor.</span></td></tr>`}
            </tbody>
            <tfoot>
              <tr class="admin-total-row">
                <td colspan="2"><strong>Totals</strong></td>
                <td>—</td>
                <td>—</td>
                <td class="${totalCurrent >= totalInvested ? "profit" : "loss"}"><strong>${currency(totalInvested)}</strong></td>
                <td class="${totalCurrent >= totalInvested ? "profit" : "loss"}"><strong>${currency(totalCurrent)}</strong></td>
                <td class="${totalUnrealized >= 0 ? "profit" : "loss"}"><strong>${currency(totalUnrealized)}</strong></td>
                <td class="${totalToday >= 0 ? "profit" : "loss"}"><strong>${currency(totalToday)}</strong></td>
                <td class="${totalRealized >= 0 ? "profit" : "loss"}"><strong>${currency(totalRealized)}</strong></td>
                <td class="${totalPnl >= 0 ? "profit" : "loss"}"><strong>${currency(totalPnl)}</strong></td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="admin-table-bottom-scroll" id="adminDetailLiveScroller" aria-label="Scroll live positions table horizontally">
          <div class="admin-table-bottom-scroll-inner"></div>
        </div>
      </article>

      <article class="table-card" style="margin-top:18px;">
        <div class="panel-head">
          <h3>Sold History</h3>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="badge ${userSoldHistory.length ? "green" : ""}">${userSoldHistory.length} Record(s)</span>
            <button class="admin-eye-btn sold-history-eye-toggle" type="button" data-sold-history-toggle="detail" title="Show / hide sold history">&#128065;</button>
          </div>
        </div>
        <div class="sold-history-body" id="adminDetailSoldBody">
        <div class="table-wrap admin-position-table-wrap" id="adminDetailSoldWrap">
          <table class="admin-position-table">
            <thead>
              <tr><th>Stock</th><th>Purchase Date</th><th>Qty Sold</th><th>Avg Price</th><th>Sell Price</th><th>Sold Date</th><th>Realised P&amp;L</th><th>P&amp;L %</th></tr>
            </thead>
            <tbody>
              ${userSoldHistory.length
                ? userSoldHistory.map((entry) => `
                    <tr>
                      <td>
                        <div class="admin-stock-cell">
                          <button class="admin-eye-btn ${isAdminStockRevealed(entry.symbol) ? "is-active" : ""}" type="button" data-stock-visibility-toggle="${escapeHtml(String(entry.symbol || "").toUpperCase())}" aria-label="Toggle stock name">&#128065;</button>
                          <span class="sold-history-symbol" data-stock-label="${escapeHtml(String(entry.symbol || "").toUpperCase())}">${isAdminStockRevealed(entry.symbol) ? escapeHtml(entry.symbol) : maskStockSymbol(entry.symbol)}</span>
                        </div>
                      </td>
                      <td>${formatDate(entry.created_at)}</td>
                      <td>${entry.quantity}</td>
                      <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${currency(entry.buy_price)}</td>
                      <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${currency(entry.sell_price)}</td>
                      <td>${formatDate(entry.sold_at)}</td>
                      <td class="${Number(entry.profit_loss) >= 0 ? "profit" : "loss"}">${currency(entry.profit_loss)}</td>
                      <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${percent((((Number(entry.sell_price) - Number(entry.buy_price)) / Math.max(Number(entry.buy_price), 1)) * 100))}</td>
                    </tr>
                  `).join("")
                : `<tr><td colspan="8"><div class="dash-empty-state"><svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 48L32 20l16 28H16z" stroke="#2c90f0" stroke-width="2" stroke-linejoin="round" opacity="0.35"/><path d="M32 30v8M32 42v2" stroke="#2c90f0" stroke-width="2" stroke-linecap="round" opacity="0.6"/></svg><strong>No sold history yet</strong><span>Completed trades will appear here once a sale is processed.</span></div></td></tr>`}
            </tbody>
            <tfoot>
              <tr class="admin-total-row">
                <td colspan="2"><strong>Totals</strong></td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td class="${totalRealized >= 0 ? "profit" : "loss"}"><strong>${currency(totalRealized)}</strong></td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="admin-table-bottom-scroll" id="adminDetailSoldScroller" aria-label="Scroll sold history table horizontally">
          <div class="admin-table-bottom-scroll-inner"></div>
        </div>
        </div>
      </article>
    </article>
  `;
}

function buildAdminStockDetail(symbol, holdings) {
  const totalQty = holdings.reduce((sum, holding) => sum + Number(holding.quantity || 0), 0);
  const totalPnl = holdings.reduce((sum, holding) => sum + Number(holding.profit_loss || 0), 0);
  return `
    <article class="dashboard-card detail-card">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Stock Investor Breakdown</p>
          <h3 style="color:#2c90f0">${escapeHtml(symbol)}</h3>
          <p class="detail-subtitle">Click any investor name to open their dashboard. The table shows each investor's buy value, live value, and return on this stock.</p>
        </div>
        <span class="badge">${holdings.length} Holders</span>
      </div>
      <div class="detail-stat-grid">
        <article><strong>${holdings.length}</strong><span>Total Investors</span></article>
        <article><strong>${totalQty}</strong><span>Total Quantity</span></article>
        <article><strong class="${totalPnl >= 0 ? "profit" : "loss"}">${currency(totalPnl)}</strong><span>Combined P&amp;L</span></article>
      </div>
      <div class="table-wrap admin-position-table-wrap" style="border-radius:12px;">
        <table class="admin-position-table" style="min-width:unset;width:100%;">
          <thead><tr><th>Investor</th><th>Client ID</th><th>Purchase Date</th><th>Qty</th><th>Avg Price</th><th>Live Price</th><th>P&amp;L</th></tr></thead>
          <tbody>
            ${holdings.map((holding) => `
              <tr>
                <td><button class="table-link" type="button" data-user-detail="${holding.user_id}">${escapeHtml(holding.owner)}</button></td>
                <td>${holding.fixed_user_id || ""}</td>
                <td>${formatDate(holding.created_at)}</td>
                <td>${holding.quantity}</td>
                <td>${currency(holding.buy_price)}</td>
                <td>${currency(holding.current_price)}</td>
                <td class="${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function closeAdminViewDropdown(dropdownId) {
  const el = document.getElementById(dropdownId);
  if (el) el.removeAttribute("open");
}

function setupAdminDrilldowns(userDashboards, allHoldings, soldHistory = []) {
  const detailMount = document.getElementById("adminDetailMount");
  if (!detailMount) return;

  document.querySelectorAll("[data-user-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = Number(button.dataset.userDetail);
      const user = userDashboards.find((entry) => Number(entry.user_id) === userId);
      if (!user) return;
      const dropdownId = button.dataset.closeViewDropdown;
      if (dropdownId) closeAdminViewDropdown(dropdownId);
      adminUiState.openDetailUserId = userId;
      detailMount.innerHTML = buildAdminClientDetail(user, soldHistory);
      detailMount.classList.remove("hidden");
      detailMount.classList.add("portal-visible");
      setupDetailEyeButtons(detailMount);
      setupScrollSync("adminDetailLiveWrap", "adminDetailLiveScroller");
      setupScrollSync("adminDetailSoldWrap", "adminDetailSoldScroller");
      setupPortalActions();
      setupHoldingActionButtons(document.getElementById("adminUserActionStatus"));
      detailMount.scrollIntoView({ behavior: "smooth", block: "start" });
      maybeShowBalanceWarning(user);
    });
  });

  document.querySelectorAll("[data-stock-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const symbol = String(button.dataset.stockDetail || "").toUpperCase();
      const dropdownId = button.dataset.closeViewDropdown;
      if (dropdownId) closeAdminViewDropdown(dropdownId);
      const userId = Number(button.dataset.stockUserId || 0);
      const user = userDashboards.find((entry) => Number(entry.user_id) === userId);
      if (user) {
        detailMount.innerHTML = buildAdminClientDetail(user, soldHistory, symbol);
        setupDetailEyeButtons(detailMount);
        setupScrollSync("adminDetailLiveWrap", "adminDetailLiveScroller");
        setupScrollSync("adminDetailSoldWrap", "adminDetailSoldScroller");
        setupPortalActions();
        setupHoldingActionButtons(document.getElementById("adminUserActionStatus"));
        maybeShowBalanceWarning(user);
      } else {
        const holdings = allHoldings.filter((entry) => String(entry.symbol || "").toUpperCase() === symbol);
        if (!holdings.length) return;
        detailMount.innerHTML = buildAdminStockDetail(symbol, holdings);
      }
      detailMount.classList.remove("hidden");
      detailMount.classList.add("portal-visible");
      setupDetailEyeButtons(detailMount);
      detailMount.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function stopLiveDashboardPrices() {
  if (!liveDashboardPriceTimer) return;
  window.clearInterval(liveDashboardPriceTimer);
  liveDashboardPriceTimer = null;
}

function startAdminDashboardAutoRefresh() {
  if (!isAdminDashboardPage() || activeRole !== "admin") return;
  window.clearInterval(adminDashboardRefreshTimer);
  adminDashboardRefreshTimer = window.setInterval(() => {
    if (document.hidden) return;
    if (activeRole !== "admin") return;
    if (document.activeElement?.matches?.("input, select, textarea")) return;
    renderAdminPortal().catch(() => {});
  }, 5000);
}

function startUserRefresh() {
  window.clearInterval(userRefreshTimer);
  userRefreshTimer = window.setInterval(async () => {
    if (document.hidden) return;
    if (activeRole !== "user") return;
    if (document.activeElement?.matches?.("input, select, textarea")) return;
    await renderUserPortal({ silent: true }).catch(() => {});
  }, 10000);
}

async function refreshAdminCurrentView() {
  if (isAdminCustomerPage()) {
    await renderAdminCustomerPage();
    return;
  }
  if (isAdminDealPage()) {
    await renderAdminDealPage();
    return;
  }
  if (isAdminDashboardPage()) {
    await renderAdminPortal();
  }
}

function buildAdminActionPageShell({
  title,
  subtitle,
  badge,
  bodyMarkup,
  backHref = "./admin-dashboard.html"
}) {
  return `
    <section class="user-shell admin-shell admin-simple-shell no-sidebar-shell">
      <div class="user-shell-main admin-simple-main">
        <header class="user-topbar admin-simple-topbar admin-action-topbar">
          <div class="admin-action-topbar-copy">
            <p class="eyebrow">Admin Workspace</p>
            <h2>${title}</h2>
            <p class="detail-subtitle">${subtitle}</p>
          </div>
          <div class="admin-toolbar-row">
            <a class="secondary-btn" href="${backHref}">Back to Dashboard</a>
            <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
          </div>
        </header>
        <article class="dashboard-card full-span-card admin-deal-card admin-action-page-card">
          <div class="panel-head">
            <div>
              <h3>${title}</h3>
              <p class="detail-subtitle">${subtitle}</p>
            </div>
            <span class="badge green">${badge}</span>
          </div>
          ${bodyMarkup}
        </article>
      </div>
    </section>
  `;
}

async function renderAdminCustomerPage() {
  const mount = document.getElementById("adminCustomerPortal");
  if (!mount) return;
  showDashboardLoading("Add Customer", "Loading the customer registration form");
  const adminCustomerStatus =
    sessionStorage.getItem("assetyantra_admin_customer_status") ||
    "Client ID will be generated like ABC123 and shown here.";
  mount.innerHTML = buildAdminActionPageShell({
    title: "Add Customer",
    subtitle: "Create customer access from admin only. The generated client ID is used for user login.",
    badge: "Admin Only",
    bodyMarkup: `
      <form id="adminCustomerForm" class="portfolio-form admin-customer-form admin-action-form">
        <label><span>Customer Name</span><input name="full_name" type="text" placeholder="Customer full name" autocomplete="name" required /></label>
        <label><span>Email</span><input name="email" type="email" placeholder="client@email.com" autocomplete="email" required /></label>
        <label><span>Phone</span><input name="phone_number" type="tel" placeholder="Phone number" autocomplete="tel" required /></label>
        <label><span>Password</span><input name="password" type="password" placeholder="Minimum 8 characters" autocomplete="new-password" required /></label>
        <button class="primary-btn" type="submit">Create Customer</button>
        <p class="helper-text admin-deal-status" id="adminCustomerStatus">${escapeHtml(adminCustomerStatus)}</p>
      </form>
    `
  });
  hideDashboardLoading();
  revealPortal(mount);
  activeRole = "admin";
  setupAdminCustomerForm();
  setupPortalActions();
}

async function renderAdminDealPage() {
  const mount = document.getElementById("adminDealPortal");
  if (!mount) return;
  showDashboardLoading("Add Deal", "Loading deal entry form");
  let liveUserDashboards = [];
  try {
    const users = await api("/admin/users");
    liveUserDashboards = Array.isArray(users) ? users : [];
  } catch {
    liveUserDashboards = [];
  }
  mount.innerHTML = buildAdminActionPageShell({
    title: "Add Deal",
    subtitle: "Add a stock position directly to a customer portfolio.",
    badge: "Deal Entry",
    bodyMarkup: `
      <form id="adminDealForm" class="portfolio-form admin-deal-form admin-action-form">
        <label>
          <span>Customer</span>
          <select name="customer_id" required ${liveUserDashboards.length ? "" : "disabled"}>
            <option value="">Select customer</option>
            ${liveUserDashboards
              .slice()
              .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")))
              .map((user) => `<option value="${user.user_id}" data-balance="${Number(user.balance_funds || 0).toFixed(2)}">${escapeHtml(user.full_name)} (${escapeHtml(user.fixed_user_id || user.username || "Client")})</option>`)
              .join("")}
          </select>
        </label>
        <label class="portfolio-symbol-wrap">
          <span>Stock Name / Symbol</span>
          <input name="symbol" type="text" placeholder="Type 3 letters to search NSE / BSE" autocomplete="off" required />
          <input type="hidden" name="selected_exchange" id="adminDealSelectedExchange" value="" />
          <div id="adminDealSuggestions" class="symbol-suggestion-list"></div>
        </label>
        <label><span>Quantity</span><input name="quantity" type="number" min="1" step="1" placeholder="100" required /></label>
        <label><span>Buy Price</span><input name="buy_price" type="number" min="1" step="0.01" placeholder="1500" required /></label>
        <label><span>Purchase Date</span><input name="purchase_date" type="date" max="${new Date().toISOString().split('T')[0]}" /></label>
        <label>
          <span>Search Market</span>
          <select name="exchange">
            <option value="" disabled selected>Select Exchange</option>
            <option value="ALL">All NSE / BSE</option>
            <option value="NSE">NSE</option>
            <option value="BSE">BSE</option>
          </select>
        </label>
        <div class="admin-deal-balance-info" id="adminDealBalanceInfo" style="display:none">
          <div class="admin-deal-balance-row"><span>Customer Balance Funds</span><strong id="adminDealBalanceFunds">—</strong></div>
          <div class="admin-deal-balance-row"><span>Max Stocks Purchasable</span><strong id="adminDealAffordable">Select a stock first</strong></div>
        </div>
        <div class="portfolio-live-price-preview" id="adminDealLivePricePreview" data-state="idle">
          <span>Live price preview</span>
          <strong>Waiting for a stock selection</strong>
          <small>Type at least 3 letters and choose a stock from the live search list.</small>
        </div>
        <button class="primary-btn" type="submit" ${liveUserDashboards.length ? "" : "disabled"}>Add Deal</button>
        <p class="helper-text admin-deal-status" id="adminDealStatus">${liveUserDashboards.length ? "Choose customer, stock, quantity, and buy price." : "Create a customer first, then add a deal."}</p>
      </form>
    `
  });
  hideDashboardLoading();
  revealPortal(mount);
  activeRole = "admin";
  setupAdminDealForm();
  setupPortalActions();
}

async function renderAdminPortal() {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  revealPortal(mount);
  try {
    const [dashboard, users, auditLogs, authAttempts, systemStatus, reviews, operationsOverview, soldHistory] = await Promise.all([
      api("/admin/dashboard"),
      api("/admin/users"),
      api("/admin/audit-logs?limit=8"),
      api("/admin/auth-attempts?limit=8"),
      api("/admin/system-status"),
      api("/admin/reviews"),
      api("/admin/operations-overview"),
      api("/admin/sold-history?limit=100").catch(() => [])
    ]);
    const safeUsers = Array.isArray(users) ? users : [];
    const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
    const safeAuthAttempts = Array.isArray(authAttempts) ? authAttempts : [];
    const safeReviews = Array.isArray(reviews) ? reviews : [];
    const safeSoldHistory = Array.isArray(soldHistory) ? soldHistory : [];
    const userDashboards = await safeAdminUserDashboards(safeUsers);
    const baseHoldings = userDashboards.flatMap((user) =>
      (Array.isArray(user.holdings) ? user.holdings : []).map((holding) => ({
        ...holding,
        owner: user.full_name,
        fixed_user_id: user.fixed_user_id,
        user_id: user.user_id
      }))
    );
    const symbolsByExchange = {};
    for (const h of baseHoldings) {
      const ex = (h.exchange || "NSE").toUpperCase();
      if (!symbolsByExchange[ex]) symbolsByExchange[ex] = new Set();
      symbolsByExchange[ex].add(h.symbol);
    }
    const feedResults = await Promise.all(
      Object.entries(symbolsByExchange).map(([ex, syms]) =>
        api(`/stocks/feed?symbols=${encodeURIComponent([...syms].join(","))}&exchange=${ex}`).catch(() => [])
      )
    );
    const quoteMap = new Map(feedResults.flat().map((q) => [`${q.symbol}:${(q.exchange || "NSE").toUpperCase()}`, q]));
    const allHoldings = baseHoldings.map((holding) => {
      const ex = (holding.exchange || "NSE").toUpperCase();
      const quote = quoteMap.get(`${holding.symbol}:${ex}`);
      const currentPrice = Number(quote?.price ?? holding.current_price ?? holding.buy_price);
      const prevClose = quote?.previous_close ? Number(quote.previous_close) : null;
      const todayProfit = prevClose
        ? (currentPrice - prevClose) * Number(holding.quantity || 0)
        : Number(holding.today_profit || 0);
      return {
        ...holding,
        current_price: currentPrice,
        percent_change: Number(holding.percent_change ?? ((currentPrice - holding.buy_price) / Math.max(holding.buy_price, 1)) * 100),
        profit_loss: (currentPrice - Number(holding.buy_price || 0)) * Number(holding.quantity || 0),
        today_profit: Number.isFinite(todayProfit) ? todayProfit : 0
      };
    });
    const totalValue = userDashboards.reduce((sum, user) => sum + Number(user.total_portfolio_value), 0);
    const totalPnl = userDashboards.reduce((sum, user) => sum + Number(user.total_profit_loss), 0);
    const todayProfit = allHoldings.reduce((sum, holding) => sum + Number(holding.today_profit || 0), 0);
    const inactiveUsers = safeUsers.filter((user) => !user.is_active).length;
    const failedAttempts = safeAuthAttempts.filter((attempt) => !attempt.success).length;
    const searchText = adminUiState.search.toLowerCase();
    const selectedClient = adminUiState.clientFilter;
    const fromDate = adminUiState.dateFrom ? new Date(`${adminUiState.dateFrom}T00:00:00`) : null;
    const toDate = adminUiState.dateTo ? new Date(`${adminUiState.dateTo}T23:59:59`) : null;
    const filteredUsers = safeUsers.filter((user) => {
      return (
        !searchText ||
        user.full_name.toLowerCase().includes(searchText) ||
        String(user.fixed_user_id || user.username).toLowerCase().includes(searchText) ||
        String(user.phone_number || "").toLowerCase().includes(searchText)
      );
    });
    const selectedStock = String(adminUiState.stockFilter || "").toUpperCase();
    const filteredHoldings = allHoldings.filter((holding) => {
      const createdAt = holding.created_at ? new Date(holding.created_at) : null;
      const matchesSearch =
        !searchText ||
        String(holding.owner || "").toLowerCase().includes(searchText) ||
        String(holding.fixed_user_id || "").toLowerCase().includes(searchText) ||
        String(holding.symbol || "").toLowerCase().includes(searchText) ||
        String(holding.sector || "").toLowerCase().includes(searchText) ||
        String(holding.exchange || "").toLowerCase().includes(searchText);
      const matchesClient = !selectedClient || String(holding.fixed_user_id || holding.user_id) === String(selectedClient);
      const matchesStock = !selectedStock || String(holding.symbol || "").toUpperCase() === selectedStock;
      const matchesDate =
        (!fromDate || (createdAt && createdAt >= fromDate)) &&
        (!toDate || (createdAt && createdAt <= toDate));
      return matchesSearch && matchesClient && matchesStock && matchesDate;
    });

    const sortKey = adminUiState.sortBy || "recent";
    filteredHoldings.sort((a, b) => {
      if (sortKey === "alpha") return String(a.owner || "").localeCompare(String(b.owner || ""));
      if (sortKey === "investment") return (Number(b.buy_price || 0) * Number(b.quantity || 0)) - (Number(a.buy_price || 0) * Number(a.quantity || 0));
      if (sortKey === "profit") return Number(b.profit_loss || 0) - Number(a.profit_loss || 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    const filteredSoldHistory = safeSoldHistory.filter((entry) => {
      const soldAt = entry.sold_at ? new Date(entry.sold_at) : null;
      const matchesSearch =
        !searchText ||
        String(entry.full_name || "").toLowerCase().includes(searchText) ||
        String(entry.fixed_user_id || "").toLowerCase().includes(searchText) ||
        String(entry.symbol || "").toLowerCase().includes(searchText);
      const matchesClient = !selectedClient || String(entry.fixed_user_id || entry.user_id) === String(selectedClient);
      const matchesStock = !selectedStock || String(entry.symbol || "").toUpperCase() === selectedStock;
      const matchesDate =
        (!fromDate || (soldAt && soldAt >= fromDate)) &&
        (!toDate || (soldAt && soldAt <= toDate));
      return matchesSearch && matchesClient && matchesStock && matchesDate;
    });
    const filteredUnrealizedProfit = filteredHoldings.reduce((sum, holding) => sum + Number(holding.profit_loss || 0), 0);
    const filteredRealizedProfit = filteredSoldHistory.reduce((sum, entry) => sum + Number(entry.profit_loss || 0), 0);
    const filteredPeriodProfit = filteredUnrealizedProfit + filteredRealizedProfit;
    const filteredInvestedValue = filteredHoldings.reduce((sum, holding) => sum + Number(holding.buy_price || 0) * Number(holding.quantity || 0), 0);
    const filteredCurrentValue = filteredHoldings.reduce((sum, holding) => sum + Number(holding.current_price || 0) * Number(holding.quantity || 0), 0);
    const filteredTotalQuantity = filteredHoldings.reduce((sum, holding) => sum + Number(holding.quantity || 0), 0);
    const filteredSoldQuantity = filteredSoldHistory.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
    const availableStockOptions = [...new Set([...allHoldings.map((holding) => String(holding.symbol || "").toUpperCase()), ...safeSoldHistory.map((entry) => String(entry.symbol || "").toUpperCase())].filter(Boolean))].sort();
    const pendingModerationCount = safeReviews.filter((review) => !review.is_seeded).length;
    const stockConcentration = Array.isArray(operationsOverview?.stock_concentration) ? operationsOverview.stock_concentration : [];
    const recentUserActivity = Array.isArray(operationsOverview?.recent_user_activity) ? operationsOverview.recent_user_activity : [];
    const loginIssueBreakdown = Array.isArray(operationsOverview?.login_issue_breakdown) ? operationsOverview.login_issue_breakdown : [];

    mount.innerHTML = `
    <section class="user-shell admin-simple-shell no-sidebar-shell">
      <div class="user-shell-main admin-simple-main dashboard-stack admin-dashboard-stack">
      <header class="user-topbar admin-compact-topbar admin-simple-topbar">
        <div class="admin-toolbar-left">
          <input class="user-search admin-universal-search" id="adminUniversalSearch" type="text" placeholder="Search user, client ID, or stock" />
          <p class="live-price-status admin-auto-refresh-label">Live sync enabled</p>
        </div>
        <div class="user-topbar-actions admin-toolbar-right">
          <select class="user-search admin-action-select" data-admin-action-nav="true">
            <option value="">Admin Actions</option>
            <option value="./admin-add-customer.html">Add Customer</option>
            <option value="./admin-add-deal.html">Add Deal</option>
          </select>
          <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
        </div>
      </header>
      <div id="adminOverviewCard">
    <div class="metrics-grid admin-simple-metrics">
      <article class="metric-card"><strong>${dashboard?.total_users ?? safeUsers.length}</strong><span>Investors</span><small>Persisted registered users</small></article>
      <article class="metric-card"><strong>${dashboard?.newly_registered_users ?? 0}</strong><span>New This Week</span><small>Non-demo client registrations</small></article>
      <article class="metric-card"><strong>${dashboard?.total_holdings ?? baseHoldings.length}</strong><span>Total Holdings</span><small>Stocks stored in the database</small></article>
      <article class="metric-card"><strong class="${todayProfit >= 0 ? "profit" : "loss"}">${currency(todayProfit)}</strong><span>Today Profit</span><small>Intraday movement across tracked holdings</small></article>
      <article class="metric-card"><strong class="${totalPnl >= 0 ? "profit" : "loss"}">${currency(totalPnl)}</strong><span>Total Profit Till Now</span><small>Current tracked value ${currency(totalValue)}</small></article>
    </div>
    <div class="admin-position-summary">
      <span><strong>${currency(filteredInvestedValue)}</strong> Invested Value</span>
      <span><strong>${currency(filteredCurrentValue)}</strong> Current Value</span>
      <span class="${filteredUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredUnrealizedProfit)}</strong> Unrealised P&amp;L</span>
      <span class="${filteredRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredRealizedProfit)}</strong> Realised P&amp;L</span>
      <span class="${filteredPeriodProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredPeriodProfit)}</strong> Combined P&amp;L</span>
    </div>
    <div class="metrics-grid admin-status-grid">
      <article class="metric-card"><strong>${systemStatus.backend_status}</strong><span>Backend</span><small>Environment ${systemStatus.environment}</small></article>
      <article class="metric-card"><strong>${systemStatus.database_status}</strong><span>Database</span><small>Connection health</small></article>
      <article class="metric-card"><strong>${systemStatus.redis_status}</strong><span>Redis</span><small>Cache and queue state</small></article>
      <article class="metric-card"><strong class="${systemStatus.otp_debug_mode ? "loss" : "profit"}">${systemStatus.otp_debug_mode ? "On" : "Off"}</strong><span>OTP Debug</span><small>${systemStatus.environment === "production" ? "Must stay off in production" : "Development-only testing mode"}</small></article>
      <article class="metric-card"><strong>${pendingModerationCount}</strong><span>Reviews To Moderate</span><small>Non-seeded public reviews</small></article>
    </div>
    <div class="dashboard-grid">
      <article class="table-card">
        <div class="panel-head">
          <h3>All Investor Positions</h3>
          <div class="table-actions">
            <span class="badge">Admin View</span>
          </div>
        </div>
        <div class="admin-filter-bar">
          <select class="user-search admin-filter-select" id="adminClientFilter">
            <option value="">All Investors</option>
            ${safeUsers
              .map((user) => `<option value="${escapeHtml(user.fixed_user_id || String(user.user_id))}" ${String(adminUiState.clientFilter) === String(user.fixed_user_id || user.user_id) ? "selected" : ""}>${escapeHtml(user.full_name)} (${escapeHtml(user.fixed_user_id || user.username)})</option>`)
              .join("")}
          </select>
          <select class="user-search admin-filter-select" id="adminStockFilter">
            <option value="">All Stocks</option>
            ${availableStockOptions
              .map((symbol) => `<option value="${escapeHtml(symbol)}" ${adminUiState.stockFilter === symbol ? "selected" : ""}>${escapeHtml(symbol)}</option>`)
              .join("")}
          </select>
          <input class="user-search admin-filter-date" id="adminDateFrom" type="date" value="${escapeHtml(adminUiState.dateFrom)}" />
          <input class="user-search admin-filter-date" id="adminDateTo" type="date" value="${escapeHtml(adminUiState.dateTo)}" />
          <span class="badge ${filteredPeriodProfit >= 0 ? "green" : "red"}">Range P/L ${currency(filteredPeriodProfit)}</span>
        </div>
        <div class="table-wrap admin-position-table-wrap" id="adminPositionsTableWrap">
          <table>
            <thead><tr><th>Investor</th><th>Stock</th><th>Purchase Date</th><th>Qty</th><th>Avg Price</th><th>Invested Value</th><th>Live Price</th><th>Current Value</th><th>Unrealised P&amp;L</th><th>Action</th></tr></thead>
            <tbody>
              ${filteredHoldings.length
                ? filteredHoldings
                .map(
                  (holding) => `
                    <tr>
                      <td><button class="table-link" type="button" data-user-detail="${holding.user_id}">${holding.owner}</button><br /><small>${holding.fixed_user_id || ""}</small></td>
                      <td>
                        <div class="admin-stock-cell">
                          <button class="admin-eye-btn" type="button" data-stock-visibility-toggle="${escapeHtml(holding.symbol)}" aria-label="${isAdminStockRevealed(holding.symbol) ? "Hide stock name" : "Show stock name"}">${isAdminStockRevealed(holding.symbol) ? "🙈" : "👁"}</button>
                          <button class="table-link" type="button" data-stock-detail="${holding.symbol}">${isAdminStockRevealed(holding.symbol) ? holding.symbol : maskStockSymbol(holding.symbol)}</button>
                        </div>
                        <small>${holding.sector || "Tracked holding"}</small>
                      </td>
                      <td>${formatDate(holding.created_at)}</td>
                      <td>${holding.quantity}</td>
                      <td>${currency(holding.buy_price)}</td>
                      <td>${currency(Number(holding.buy_price || 0) * Number(holding.quantity || 0))}</td>
                      <td>${currency(holding.current_price)}</td>
                      <td>${currency(Number(holding.current_price || 0) * Number(holding.quantity || 0))}</td>
                      <td class="${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}<br /><small>${percent(holding.percent_change)}</small></td>
                      <td class="action-cell-duo">
                        <button class="secondary-btn compact-btn buy-holding-btn" type="button" data-admin-buy-holding="${holding.holding_id}" data-user-id="${holding.user_id}" data-symbol="${holding.symbol}" data-owner="${holding.owner}" data-exchange="${escapeHtml(holding.exchange || 'NSE')}" data-buy-price="${holding.buy_price}">Buy</button>
                        <button class="secondary-btn compact-btn edit-holding-btn" type="button" data-admin-edit-holding="${holding.holding_id}" data-symbol="${holding.symbol}" data-owner="${holding.owner}" data-quantity="${holding.quantity}" data-buy-price="${holding.buy_price}" data-created-at="${escapeHtml(holding.created_at || '')}">Edit</button>
                        <button class="secondary-btn compact-btn" type="button" data-admin-sell-holding="${holding.holding_id}" data-symbol="${holding.symbol}" data-owner="${holding.owner}" data-quantity="${holding.quantity}" data-buy-price="${holding.buy_price}">Sell</button>
                      </td>
                    </tr>
                  `
                )
                .join("")
                : `<tr><td colspan="10"><div class="dash-empty-state">${searchText || adminUiState.clientFilter || adminUiState.stockFilter ? `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="28" stroke="#2c90f0" stroke-width="2" stroke-dasharray="6 4" opacity="0.4"/><path d="M20 38l8-8 6 6 10-12" stroke="#2c90f0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/></svg><strong>No results for filters</strong><span>Try clearing the search or filters.</span>` : `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="20" width="40" height="28" rx="6" stroke="#2c90f0" stroke-width="2" opacity="0.35"/><path d="M20 32h24M20 38h16" stroke="#2c90f0" stroke-width="2" stroke-linecap="round" opacity="0.5"/><circle cx="44" cy="18" r="8" fill="#edf5ff" stroke="#2c90f0" stroke-width="2"/><path d="M44 15v3l2 2" stroke="#2c90f0" stroke-width="1.8" stroke-linecap="round"/></svg><strong>No holdings yet</strong><span>Use Add Deal to record investor positions.</span>`}</div></td></tr>`}
            </tbody>
            <tfoot>
              <tr class="admin-total-row">
                <td colspan="3"><strong>Totals</strong></td>
                <td>—</td>
                <td>—</td>
                <td><strong>${currency(filteredInvestedValue)}</strong></td>
                <td>—</td>
                <td><strong>${currency(filteredCurrentValue)}</strong></td>
                <td class="${filteredUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredUnrealizedProfit)}</strong></td>
                <td>—</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="admin-table-bottom-scroll" id="adminPositionsTableScroller" aria-label="Scroll positions table horizontally">
          <div class="admin-table-bottom-scroll-inner"></div>
        </div>
      </article>
      <article class="dashboard-card" id="adminClientOpsCard">
        <div class="panel-head"><h3>Investor Downloads</h3><span class="badge green">Export</span></div>
        <div class="stack-list">
          ${userDashboards
            .map(
              (user) => `
                <article class="stack-item">
                  <div>
                    <strong>${user.full_name}</strong>
                    <small>${user.fixed_user_id || user.username}</small>
                  </div>
                  <div class="actions-row">
                    <span class="${user.total_profit_loss >= 0 ? "profit" : "loss"}">${currency(user.total_profit_loss)}</span>
                    <button class="download-btn" type="button" data-download-user-id="${user.user_id}">Download Dashboard</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </article>
    </div>
    <div class="dashboard-grid">
      <article class="dashboard-card full-span-card">
        <div class="panel-head">
          <h3>Sold History</h3>
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="badge ${filteredSoldHistory.length ? "green" : ""}">${filteredSoldHistory.length} Records</span>
            <button class="admin-eye-btn sold-history-eye-toggle" type="button" data-sold-history-toggle="main1" title="Show / hide sold history">&#128065;</button>
          </div>
        </div>
        <div class="sold-history-body">
        <div class="table-wrap admin-position-table-wrap" id="adminSoldHistoryWrap">
          <table class="admin-position-table">
            <thead><tr><th>User</th><th>Stock</th><th>Purchase Date</th><th>Qty Sold</th><th>Avg Price</th><th>Sell Price</th><th>Realised P&amp;L</th><th>Sold At (IST)</th><th>Sold By</th></tr></thead>
            <tbody>
              ${filteredSoldHistory.length
                ? filteredSoldHistory
                    .map(
                      (entry) => `
                        <tr>
                          <td><button class="table-link" type="button" data-user-detail="${entry.user_id}">${escapeHtml(entry.full_name)}</button><br /><small>${escapeHtml(entry.fixed_user_id || "")}</small></td>
                          <td>
                            <div class="admin-stock-cell">
                              <button class="admin-eye-btn ${isAdminStockRevealed(entry.symbol) ? "is-active" : ""}" type="button" data-stock-visibility-toggle="${escapeHtml(String(entry.symbol || "").toUpperCase())}" aria-label="${isAdminStockRevealed(entry.symbol) ? "Hide stock name" : "Show stock name"}">&#128065;</button>
                              <span class="sold-history-symbol" data-stock-label="${escapeHtml(String(entry.symbol || "").toUpperCase())}">${isAdminStockRevealed(entry.symbol) ? escapeHtml(entry.symbol) : maskStockSymbol(entry.symbol)}</span>
                            </div>
                          </td>
                          <td>${formatDate(entry.created_at)}</td>
                          <td>${entry.quantity}</td>
                          <td>${currency(entry.buy_price)}</td>
                          <td>${currency(entry.sell_price)}</td>
                          <td class="${Number(entry.profit_loss) >= 0 ? "profit" : "loss"}">${currency(entry.profit_loss)}</td>
                          <td>${formatDateTime(entry.sold_at)}</td>
                          <td><small>${escapeHtml(entry.sold_by_identifier || entry.sold_by_role || "System")}</small></td>
                        </tr>
                      `
                    )
                    .join("")
                : `<tr><td colspan="9"><div class="dash-empty-state"><svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 48L32 20l16 28H16z" stroke="#2c90f0" stroke-width="2" stroke-linejoin="round" opacity="0.35"/><path d="M32 30v8M32 42v2" stroke="#2c90f0" stroke-width="2" stroke-linecap="round" opacity="0.6"/></svg><strong>No records match the filters</strong><span>Try clearing filters to see all sold history.</span></div></td></tr>`}
            </tbody>
            <tfoot>
              <tr class="admin-total-row">
                <td colspan="3"><strong>Totals</strong></td>
                <td>—</td>
                <td>—</td>
                <td>—</td>
                <td class="${filteredRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredRealizedProfit)}</strong></td>
                <td colspan="2">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="admin-table-bottom-scroll" id="adminSoldHistoryScroller" aria-label="Scroll sold history table horizontally">
          <div class="admin-table-bottom-scroll-inner"></div>
        </div>
        </div>
      </article>
    </div>
    <div class="dashboard-grid">
      <article class="dashboard-card">
        <div class="panel-head"><h3>Backend Operations</h3><span class="badge">Owner View</span></div>
        <div class="detail-stat-grid">
          <article><strong>${operationsOverview.active_users}</strong><span>Active Users</span></article>
          <article><strong>${operationsOverview.users_with_holdings}</strong><span>Users With Holdings</span></article>
          <article><strong>${currency(operationsOverview.average_portfolio_value)}</strong><span>Avg Portfolio Value</span></article>
        </div>
        <div class="stack-list">
          <article class="stack-item stack-item-compact">
            <div>
              <strong>Largest Client Portfolio</strong>
              <small>Highest invested value across tracked users</small>
            </div>
            <div>
              <strong>${currency(operationsOverview.largest_client_value)}</strong>
              <small>Current backend snapshot</small>
            </div>
          </article>
          <article class="stack-item stack-item-compact">
            <div>
              <strong>Issue Hotspots</strong>
              <small>${loginIssueBreakdown.length ? loginIssueBreakdown.map((item) => `${item.reason.replaceAll("_", " ")} (${item.count})`).join(", ") : "No recent login issues"}</small>
            </div>
          </article>
        </div>
      </article>
      <article class="dashboard-card" id="adminUsersCard">
        <div class="panel-head"><h3>User Management</h3><span class="badge">Control</span></div>
        <div class="admin-bulk-bar">
          <label class="bulk-select-all"><input id="adminSelectAllUsers" type="checkbox" /> Select visible users</label>
          <div class="table-actions">
            <button class="secondary-btn compact-btn" type="button" id="bulkActivateUsersBtn">Bulk Activate</button>
            <button class="secondary-btn compact-btn" type="button" id="bulkDisableUsersBtn">Bulk Disable</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
          <thead><tr><th></th><th>Investor</th><th>Status</th><th>Joined</th><th>Value</th><th>Actions</th></tr></thead>
            <tbody>
              ${filteredUsers.length
                ? filteredUsers
                .map(
                  (user) => `
                    <tr>
                      <td><input type="checkbox" data-user-select value="${user.user_id}" /></td>
                      <td><strong>${user.full_name}</strong><br /><small>${user.fixed_user_id || user.username}${user.is_demo ? " | Demo" : ""}</small></td>
                      <td><span class="badge ${user.is_active ? "green" : "red"}">${user.is_active ? "Active" : "Inactive"}</span></td>
                      <td>${formatDate(user.created_at)}</td>
                      <td>${currency(user.portfolio_value)}</td>
                      <td>
                        <div class="table-actions">
                          <button class="secondary-btn compact-btn" type="button" data-user-status-action="${user.user_id}" data-next-active="${(!user.is_active).toString()}">${user.is_active ? "Disable" : "Activate"}</button>
                        </div>
                      </td>
                    </tr>
                  `
                )
                .join("")
                : `<tr><td colspan="6"><span class="helper-text">No users match the current search or filter.</span></td></tr>`}
            </tbody>
          </table>
        </div>
        <p class="helper-text" id="adminUserActionStatus">${inactiveUsers} non-demo user account(s) are currently inactive. Showing ${filteredUsers.length} result(s).</p>
      </article>
      <article class="dashboard-card" id="adminControlsCard">
        <div class="panel-head"><h3>Website Controls</h3><span class="badge">Manage</span></div>
        <div class="stack-list">
          <article class="stack-item">
            <div><strong>FAQ Insight Cards</strong><small>Show or hide the extra cards on the FAQ page.</small></div>
            <button class="secondary-btn" type="button" id="toggleFaqInsightsBtn">Hide FAQ Cards</button>
          </article>
          <article class="stack-item">
            <div><strong>Delete User Reviews</strong><small>Remove all user-submitted reviews from website storage.</small></div>
            <button class="secondary-btn danger-btn" type="button" id="clearCustomReviewsBtn">Delete Reviews</button>
          </article>
        </div>
        <p class="helper-text" id="siteControlStatus">Website controls are available for admin actions.</p>
      </article>
    </div>
    <div class="dashboard-grid">
      <article class="dashboard-card" id="adminModerationCard">
        <div class="panel-head"><h3>Month-on-Month P&amp;L</h3><span class="badge">Trend</span></div>
        ${renderChart([
          { label: "Nov", value: totalPnl * 0.48 },
          { label: "Dec", value: totalPnl * 0.61 },
          { label: "Jan", value: totalPnl * -0.12 },
          { label: "Feb", value: totalPnl * 0.39 },
          { label: "Mar", value: totalPnl * 0.57 },
          { label: "Apr", value: totalPnl || totalValue * 0.05 }
        ])}
      </article>
      <article class="dashboard-card" id="adminSecurityCard">
        <div class="panel-head"><h3>Review Moderation</h3><span class="badge">${pendingModerationCount} Pending</span></div>
        <div class="stack-list">
          ${safeReviews.length
            ? safeReviews
                .slice(0, 8)
                .map(
                  (review) => `
                    <article class="stack-item stack-item-compact">
                      <div>
                        <strong>${review.name}</strong>
                        <small>${review.role} · ${"★".repeat(review.rating)}</small>
                        <small>${review.message}</small>
                      </div>
                      <div class="table-actions">
                        <span class="badge ${review.is_seeded ? "green" : ""}">${review.is_seeded ? "Seeded" : "Public"}</span>
                        ${review.is_seeded
                          ? `<span class="helper-chip">Protected</span>`
                          : `<button class="secondary-btn danger-btn compact-btn" type="button" data-delete-review="${review.id}" data-review-name="${review.name}">Remove</button>`}
                      </div>
                    </article>
                  `
                )
                .join("")
            : `<article class="stack-item"><div><strong>No reviews available</strong><small>Submitted reviews will appear here.</small></div></article>`}
        </div>
      </article>
    </div>
    <div class="dashboard-grid">
      <article class="dashboard-card">
        <div class="panel-head"><h3>User Activity View</h3><span class="badge">Recent</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Status</th><th>Holdings</th><th>Last Holding</th><th>Last Auth</th></tr></thead>
            <tbody>
              ${recentUserActivity.length
                ? recentUserActivity
                    .map(
                      (activity) => `
                        <tr>
                          <td><strong>${activity.full_name}</strong><br /><small>${activity.fixed_user_id || ""}</small></td>
                          <td><span class="badge ${activity.is_active ? "green" : "red"}">${activity.is_active ? "Active" : "Inactive"}</span></td>
                          <td>${activity.holding_count}</td>
                          <td>${formatDate(activity.last_holding_at)}</td>
                          <td>${formatDateTime(activity.last_auth_attempt_at)}</td>
                        </tr>
                      `
                    )
                    .join("")
                : `<tr><td colspan="5"><span class="helper-text">No recent user activity to display.</span></td></tr>`}
            </tbody>
          </table>
        </div>
      </article>
      <article class="dashboard-card">
        <div class="panel-head"><h3>Stock Concentration</h3><span class="badge">Exposure</span></div>
        <div class="stack-list">
          ${stockConcentration.length
            ? stockConcentration
                .map(
                  (item) => `
                    <article class="stack-item stack-item-compact">
                      <div>
                        <strong>${item.symbol}</strong>
                <small>${item.client_count} investor(s) holding this stock</small>
                      </div>
                      <div>
                        <strong>${currency(item.invested_value)}</strong>
                        <small>${item.total_quantity} shares</small>
                      </div>
                    </article>
                  `
                )
                .join("")
            : `<article class="stack-item"><div><strong>No concentration data</strong><small>Portfolio exposure will appear here.</small></div></article>`}
        </div>
      </article>
    </div>
    <div class="dashboard-grid">
      <article class="dashboard-card">
        <div class="panel-head"><h3>Security Activity</h3><span class="badge ${failedAttempts ? "red" : "green"}">${failedAttempts} Failed</span></div>
        <div class="stack-list">
          ${safeAuthAttempts.length
            ? safeAuthAttempts
                .map(
                  (attempt) => `
                    <article class="stack-item stack-item-compact">
                      <div>
                        <strong>${attempt.stage === "request_otp" ? "OTP Request" : "Login"} · ${attempt.identifier}</strong>
                        <small>${attempt.role} ${attempt.failure_reason ? `· ${attempt.failure_reason.replaceAll("_", " ")}` : "· successful"}</small>
                      </div>
                      <div>
                        <strong class="${attempt.success ? "profit" : "loss"}">${attempt.success ? "Success" : "Failed"}</strong>
                        <small>${formatDateTime(attempt.created_at)}</small>
                      </div>
                    </article>
                  `
                )
                .join("")
            : `<article class="stack-item"><div><strong>No recent auth activity</strong><small>Login and OTP events will appear here.</small></div></article>`}
        </div>
      </article>
      <article class="dashboard-card">
        <div class="panel-head"><h3>Admin Audit Trail</h3><span class="badge">Tracked</span></div>
        <div class="stack-list">
          ${safeAuditLogs.length
            ? safeAuditLogs
                .map(
                  (log) => `
                    <article class="stack-item stack-item-compact">
                      <div>
                        <strong>${log.action.replaceAll("_", " ")}</strong>
                        <small>${log.entity_type}${log.entity_id ? ` · ${log.entity_id}` : ""}</small>
                      </div>
                      <div>
                        <strong>${log.ip_address || "local"}</strong>
                        <small>${formatDateTime(log.created_at)}</small>
                      </div>
                    </article>
                  `
                )
                .join("")
            : `<article class="stack-item"><div><strong>No admin actions yet</strong><small>Management activity will appear here.</small></div></article>`}
        </div>
      </article>
      <article class="dashboard-card">
        <div class="panel-head"><h3>System Settings Overview</h3><span class="badge">Config</span></div>
        <div class="stack-list">
          <article class="stack-item stack-item-compact">
            <div><strong>FAQ Insights</strong><small>Extra FAQ cards on public FAQ page</small></div>
            <div><strong>${operationsOverview.settings_overview.show_faq_insights ? "Enabled" : "Disabled"}</strong></div>
          </article>
          <article class="stack-item stack-item-compact">
            <div><strong>Chat Nudges</strong><small>Finance assistant popup prompts</small></div>
            <div><strong>${operationsOverview.settings_overview.chat_nudges_enabled ? "Enabled" : "Disabled"}</strong></div>
          </article>
          <article class="stack-item stack-item-compact">
            <div><strong>OTP Debug Mode</strong><small>Must be off in production</small></div>
            <div><strong class="${operationsOverview.settings_overview.otp_debug_mode ? "loss" : "profit"}">${operationsOverview.settings_overview.otp_debug_mode ? "Enabled" : "Disabled"}</strong></div>
          </article>
          <article class="stack-item stack-item-compact">
            <div><strong>Rate Limit Window</strong><small>Failed auth throttling window</small></div>
            <div><strong>${operationsOverview.settings_overview.auth_rate_limit_window_minutes} min</strong></div>
          </article>
          <article class="stack-item stack-item-compact">
            <div><strong>Max Failed Attempts</strong><small>Allowed before throttling</small></div>
            <div><strong>${operationsOverview.settings_overview.auth_max_failed_attempts}</strong></div>
          </article>
        </div>
      </article>
    </div>
    <section id="adminDetailMount" class="dashboard-section hidden"></section>
    </div>
    </section>
  `;

    revealPortal(mount);
    activeRole = "admin";
    activeUserId = null;
    startAdminRefresh();
    setupDownloadButtons(userDashboards);
    setupWebsiteControlButtons();
    setupAdminManagementButtons();
    setupAdminDrilldowns(userDashboards, allHoldings, filteredSoldHistory);
    document.getElementById("adminXirrCalcBtn")?.addEventListener("click", () => showXirrCalculatorModal(userDashboards));
    setupScrollSync("adminPositionsTableWrap", "adminPositionsTableScroller");
    setupScrollSync("adminSoldHistoryWrap", "adminSoldHistoryScroller");
    setupPortalActions();
  } catch (error) {
    renderPortalError(mount, "Admin Dashboard", `Login succeeded, but admin dashboard data could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) {
      retry.addEventListener("click", () => renderAdminPortal());
    }
  }
}

async function renderAdminPortal(options = {}) {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  if (adminRenderInFlight) return;
  adminRenderInFlight = true;
  const { silent = false, scrollToDetail = false } = options;
  if (!silent) {
    showDashboardLoading("Loading Dashboard", "Fetching investor portfolios and live market prices");
  }
  try {
    const [users, soldHistory] = await Promise.all([
      api("/admin/users"),
      api("/admin/sold-history?limit=100").catch(() => [])
    ]);
    const safeUsers = Array.isArray(users) ? users : [];
    const safeSoldHistory = Array.isArray(soldHistory) ? soldHistory : [];
    const userDashboards = await safeAdminUserDashboards(safeUsers);
    const baseHoldings = userDashboards.flatMap((user) =>
      (Array.isArray(user.holdings) ? user.holdings : []).map((holding) => ({
        ...holding,
        owner: user.full_name,
        fixed_user_id: user.fixed_user_id,
        user_id: user.user_id
      }))
    );
    const symbolsByExchange2 = {};
    for (const h of baseHoldings) {
      const ex = (h.exchange || "NSE").toUpperCase();
      if (!symbolsByExchange2[ex]) symbolsByExchange2[ex] = new Set();
      symbolsByExchange2[ex].add(h.symbol);
    }
    const feedResults2 = await Promise.all(
      Object.entries(symbolsByExchange2).map(([ex, syms]) =>
        api(`/stocks/feed?symbols=${encodeURIComponent([...syms].join(","))}&exchange=${ex}`).catch(() => [])
      )
    );
    const quoteMap = new Map(feedResults2.flat().map((q) => [`${q.symbol}:${(q.exchange || "NSE").toUpperCase()}`, q]));
    const allHoldings = baseHoldings.map((holding) => {
      const ex = (holding.exchange || "NSE").toUpperCase();
      const quote = quoteMap.get(`${holding.symbol}:${ex}`);
      const currentPrice = Number(quote?.price ?? holding.current_price ?? holding.buy_price);
      const prevClose = quote?.previous_close ? Number(quote.previous_close) : null;
      const todayProfit = prevClose
        ? (currentPrice - prevClose) * Number(holding.quantity || 0)
        : Number(holding.today_profit || 0);
      return {
        ...holding,
        current_price: currentPrice,
        percent_change: Number(holding.percent_change ?? ((currentPrice - holding.buy_price) / Math.max(holding.buy_price, 1)) * 100),
        profit_loss: (currentPrice - Number(holding.buy_price || 0)) * Number(holding.quantity || 0),
        today_profit: Number.isFinite(todayProfit) ? todayProfit : 0
      };
    });

    const searchText = adminUiState.search.toLowerCase();
    const selectedClient = adminUiState.clientFilter;
    const selectedStock = String(adminUiState.stockFilter || "").toUpperCase();
    const fromDate = adminUiState.dateFrom ? new Date(`${adminUiState.dateFrom}T00:00:00`) : null;
    const toDate = adminUiState.dateTo ? new Date(`${adminUiState.dateTo}T23:59:59`) : null;

    const filteredHoldings = allHoldings.filter((holding) => {
      const createdAt = holding.created_at ? new Date(holding.created_at) : null;
      const matchesSearch =
        !searchText ||
        String(holding.owner || "").toLowerCase().includes(searchText) ||
        String(holding.fixed_user_id || "").toLowerCase().includes(searchText) ||
        String(holding.symbol || "").toLowerCase().includes(searchText) ||
        String(holding.exchange || "").toLowerCase().includes(searchText);
      const matchesClient = !selectedClient || String(holding.fixed_user_id || holding.user_id) === String(selectedClient);
      const matchesStock = !selectedStock || String(holding.symbol || "").toUpperCase() === selectedStock;
      const matchesDate =
        (!fromDate || (createdAt && createdAt >= fromDate)) &&
        (!toDate || (createdAt && createdAt <= toDate));
      return matchesSearch && matchesClient && matchesStock && matchesDate;
    });

    const sortKey = adminUiState.sortBy || "recent";
    filteredHoldings.sort((a, b) => {
      if (sortKey === "alpha") return String(a.owner || "").localeCompare(String(b.owner || ""));
      if (sortKey === "investment") return (Number(b.buy_price || 0) * Number(b.quantity || 0)) - (Number(a.buy_price || 0) * Number(a.quantity || 0));
      if (sortKey === "profit") return Number(b.profit_loss || 0) - Number(a.profit_loss || 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    const filteredSoldHistory = safeSoldHistory.filter((entry) => {
      const soldAt = entry.sold_at ? new Date(entry.sold_at) : null;
      const matchesSearch =
        !searchText ||
        String(entry.full_name || "").toLowerCase().includes(searchText) ||
        String(entry.fixed_user_id || "").toLowerCase().includes(searchText) ||
        String(entry.symbol || "").toLowerCase().includes(searchText);
      const matchesClient = !selectedClient || String(entry.fixed_user_id || entry.user_id) === String(selectedClient);
      const matchesStock = !selectedStock || String(entry.symbol || "").toUpperCase() === selectedStock;
      const matchesDate =
        (!fromDate || (soldAt && soldAt >= fromDate)) &&
        (!toDate || (soldAt && soldAt <= toDate));
      return matchesSearch && matchesClient && matchesStock && matchesDate;
    });

    const filteredInvestedValue = filteredHoldings.reduce((sum, holding) => sum + Number(holding.buy_price || 0) * Number(holding.quantity || 0), 0);
    const filteredCurrentValue = filteredHoldings.reduce((sum, holding) => sum + Number(holding.current_price || 0) * Number(holding.quantity || 0), 0);
    const filteredUnrealizedProfit = filteredHoldings.reduce((sum, holding) => sum + Number(holding.profit_loss || 0), 0);
    const filteredTodayProfit = filteredHoldings.reduce((sum, holding) => sum + Number(holding.today_profit || 0), 0);
    const filteredRealizedProfit = filteredSoldHistory.reduce((sum, entry) => sum + Number(entry.profit_loss || 0), 0);
    const filteredPeriodProfit = filteredUnrealizedProfit + filteredRealizedProfit;
    const filteredTotalQuantity = filteredHoldings.reduce((sum, holding) => sum + Number(holding.quantity || 0), 0);
    const filteredSoldQuantity = filteredSoldHistory.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
    const availableStockOptions = [
      ...new Set(
        [...allHoldings.map((holding) => String(holding.symbol || "").toUpperCase()), ...safeSoldHistory.map((entry) => String(entry.symbol || "").toUpperCase())].filter(Boolean)
      )
    ].sort();
    const activeStockOptions = [...new Set(allHoldings.map((h) => String(h.symbol || "").toUpperCase()).filter(Boolean))].sort();
    adminSearchCache.users = safeUsers;
    adminSearchCache.stocks = availableStockOptions;
    const realizedMap = safeSoldHistory.reduce((map, entry) => {
      const key = `${entry.user_id}::${String(entry.symbol || "").toUpperCase()}`;
      map.set(key, (map.get(key) || 0) + Number(entry.profit_loss || 0));
      return map;
    }, new Map());

    const filteredPositionsRealizedProfit = filteredHoldings.reduce((sum, h) => {
      return sum + (realizedMap.get(`${h.user_id}::${String(h.symbol || "").toUpperCase()}`) || 0);
    }, 0);
    const filteredPositionsTotalProfit = filteredUnrealizedProfit + filteredPositionsRealizedProfit;

    // Snapshot detail before re-render to avoid flicker on silent refresh
    let _savedDetailHtml = null;
    let _detailWasOpen = false;
    if (silent && adminUiState.openDetailUserId) {
      const _existingDetail = document.getElementById("adminDetailMount");
      if (_existingDetail && !_existingDetail.classList.contains("hidden") && _existingDetail.innerHTML.trim()) {
        _savedDetailHtml = _existingDetail.innerHTML;
        _detailWasOpen = true;
      }
    }

    mount.innerHTML = `
    <section class="user-shell admin-simple-shell no-sidebar-shell">
      <div class="user-shell-main admin-simple-main dashboard-stack admin-dashboard-stack">
        <header class="user-topbar admin-compact-topbar admin-simple-topbar">
          <div class="admin-toolbar-left">
            <div class="brand admin-dashboard-brand">
              <span class="brand-mark brand-logo brand-logo-lg"><img src="./assets/updated_logo.png" alt="Asset Yantra logo" /></span>
              <span class="public-brand-copy">
                <strong class="brand-wordmark">Asset Yantra</strong>
                <small class="brand-tagline">MARKETS. INSIGHTS. WEALTH.</small>
              </span>
            </div>
          </div>
          <div class="user-topbar-actions admin-toolbar-right">
            <a class="secondary-btn compact-btn admin-nav-btn" href="./admin-add-customer.html">Add Customer</a>
            <a class="secondary-btn compact-btn admin-nav-btn" href="./admin-add-deal.html">Add Deal</a>
            <a class="secondary-btn compact-btn admin-nav-btn" href="./admin-add-funds.html">Add Funds</a>
            <div class="admin-search-wrap">
              <input class="user-search admin-universal-search" id="adminUniversalSearch" type="text" placeholder="Search client or stock…" autocomplete="off" value="${escapeHtml(adminUiState.search)}" />
              <div class="admin-search-dropdown" id="adminSearchDropdown" hidden></div>
            </div>
            <details class="admin-dropdown-menu" ${adminUiState.actionsMenuOpen ? "open" : ""}>
              <summary class="secondary-btn compact-btn admin-nav-btn">Actions & Filters</summary>
              <div class="admin-dropdown-panel">
                <p class="admin-dropdown-section-label">Quick Actions</p>
                <div class="admin-quick-grid">
                  <button class="secondary-btn compact-btn admin-quick-action-btn" id="adminXirrCalcBtn" type="button">XIRR Calculator</button>
                  <a class="secondary-btn compact-btn admin-quick-action-btn" href="./admin-database.html">View Database</a>
                  <label class="admin-quick-action-btn admin-sort-label">
                    <span>Order By</span>
                    <select id="adminSortSelect" class="admin-sort-select">
                      <option value="recent"     ${adminUiState.sortBy === "recent"     ? "selected" : ""}>Recent Investment</option>
                      <option value="alpha"      ${adminUiState.sortBy === "alpha"      ? "selected" : ""}>Alphabetically</option>
                      <option value="investment" ${adminUiState.sortBy === "investment" ? "selected" : ""}>Total Investment</option>
                      <option value="profit"     ${adminUiState.sortBy === "profit"     ? "selected" : ""}>Most Profit</option>
                    </select>
                  </label>
                </div>
                <p class="admin-dropdown-section-label" style="margin-top:10px;">Filters</p>
                <div class="admin-dropdown-filters">
                  <label class="toolbar-field">
                    <span>Investor</span>
                    <select class="user-search admin-filter-select" id="adminClientFilter">
                      <option value="">All Investors</option>
                      ${safeUsers
                        .map((user) => `<option value="${escapeHtml(user.fixed_user_id || String(user.user_id))}" ${String(adminUiState.clientFilter) === String(user.fixed_user_id || user.user_id) ? "selected" : ""}>${escapeHtml(user.full_name)} (${escapeHtml(user.fixed_user_id || user.username)})</option>`)
                        .join("")}
                    </select>
                  </label>
                  <label class="toolbar-field">
                    <span>Stock</span>
                    <select class="user-search admin-filter-select" id="adminStockFilter">
                      <option value="">All Stocks</option>
                      ${availableStockOptions
                        .map((symbol) => `<option value="${escapeHtml(symbol)}" ${adminUiState.stockFilter === symbol ? "selected" : ""}>${escapeHtml(symbol)}</option>`)
                        .join("")}
                    </select>
                  </label>
                  <label class="toolbar-field toolbar-field--compact">
                    <span>From</span>
                    <input class="user-search admin-filter-date" id="adminDateFrom" type="date" value="${escapeHtml(adminUiState.dateFrom)}" />
                  </label>
                  <label class="toolbar-field toolbar-field--compact">
                    <span>To</span>
                    <input class="user-search admin-filter-date" id="adminDateTo" type="date" value="${escapeHtml(adminUiState.dateTo)}" />
                  </label>
                </div>
                <p class="helper-text admin-filter-summary">Filtered P&amp;L window: <strong class="${filteredPositionsTotalProfit >= 0 ? "profit" : "loss"}">${currency(filteredPositionsTotalProfit)}</strong></p>
              </div>
            </details>
            <details class="admin-dropdown-menu" id="adminInvestorViewDropdown">
              <summary class="secondary-btn compact-btn admin-nav-btn">Investor View</summary>
              <div class="admin-dropdown-panel">
                <p class="admin-dropdown-section-label">Jump to Investor</p>
                <div class="admin-view-list">
                  ${safeUsers.length
                    ? safeUsers
                        .slice()
                        .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")))
                        .map((user) => `<button class="admin-view-list-btn" type="button" data-user-detail="${user.user_id}" data-close-view-dropdown="adminInvestorViewDropdown">${escapeHtml(user.full_name)}<small>${escapeHtml(user.fixed_user_id || user.username || "")}</small></button>`)
                        .join("")
                    : `<p class="helper-text">No investors yet.</p>`}
                </div>
              </div>
            </details>
            <details class="admin-dropdown-menu" id="adminStockViewDropdown">
              <summary class="secondary-btn compact-btn admin-nav-btn">Stock View</summary>
              <div class="admin-dropdown-panel">
                <p class="admin-dropdown-section-label">Jump to Stock</p>
                <div class="admin-view-list">
                  ${activeStockOptions.length
                    ? activeStockOptions
                        .map((symbol) => `<button class="admin-view-list-btn" type="button" data-stock-detail="${escapeHtml(symbol)}" data-close-view-dropdown="adminStockViewDropdown">${escapeHtml(symbol)}</button>`)
                        .join("")
                    : `<p class="helper-text">No stocks yet.</p>`}
                </div>
              </div>
            </details>
            <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
          </div>
        </header>

        <section class="simple-summary-strip admin-summary-strip">
          <span><strong>${currency(filteredInvestedValue)}</strong> Invested Value</span>
          <span><strong>${currency(filteredCurrentValue)}</strong> Current Value</span>
          <span class="${filteredUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredUnrealizedProfit)}</strong> Unrealised P&amp;L</span>
          <span class="${filteredTodayProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredTodayProfit)}</strong> Today&apos;s P&amp;L</span>
          <span class="${filteredPositionsRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredPositionsRealizedProfit)}</strong> Realised P&amp;L</span>
        </section>

        <article class="table-card admin-positions-card full-span-card">
          <div class="panel-head">
            <div>
              <h3>All Investor Positions</h3>
              <p class="helper-text admin-positions-helper">Filters are available from the dropdown above. Stock names remain masked until you reveal them.</p>
            </div>
            <span class="badge">Protected View</span>
          </div>
          <div class="table-wrap admin-position-table-wrap" id="adminPositionsTableWrap">
            <table class="admin-position-table" id="adminPositionsTable">
              <thead>
                <tr>
                  <th>Investor</th>
                  <th>Symbol</th>
                  <th>Purchase Date</th>
                  <th>Qty</th>
                  <th>Avg Price</th>
                  <th>Live Price</th>
                  <th>Invested Value</th>
                  <th>Current Value</th>
                  <th>Unrealised P&amp;L</th>
                  <th>Today&apos;s P&amp;L</th>
                  <th>Realised P&amp;L</th>
                  <th>Total P&amp;L</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${filteredHoldings.length
                  ? filteredHoldings
                      .map((holding) => {
                        const investedValue = Number(holding.buy_price || 0) * Number(holding.quantity || 0);
                        const currentValue = Number(holding.current_price || 0) * Number(holding.quantity || 0);
                        const valueClass = currentValue >= investedValue ? "profit" : "loss";
                        const realizedProfit = realizedMap.get(`${holding.user_id}::${String(holding.symbol || "").toUpperCase()}`) || 0;
                        const totalProfit = Number(holding.profit_loss || 0) + Number(realizedProfit || 0);
                        return `
                        <tr>
                          <td><button class="table-link" type="button" data-user-detail="${holding.user_id}">${holding.owner}</button><br /><small>${holding.fixed_user_id || ""}</small></td>
                          <td>
                            <div class="admin-stock-cell">
                              <button class="admin-eye-btn ${isAdminStockRevealed(holding.symbol) ? "is-active" : ""}" type="button" data-stock-visibility-toggle="${escapeHtml(String(holding.symbol || "").toUpperCase())}" aria-label="${isAdminStockRevealed(holding.symbol) ? "Hide stock name" : "Show stock name"}">&#128065;</button>
                              <button class="table-link" type="button" data-stock-detail="${holding.symbol}" data-stock-user-id="${holding.user_id}" data-stock-label="${escapeHtml(String(holding.symbol || "").toUpperCase())}">${isAdminStockRevealed(holding.symbol) ? holding.symbol : maskStockSymbol(holding.symbol)}</button>
                            </div>
                            <small>${holding.exchange || "NSE"}</small>
                          </td>
                          <td>${formatDate(holding.created_at)}</td>
                          <td>${holding.quantity}</td>
                          <td>${currency(holding.buy_price)}</td>
                          <td data-live-price-cell="${escapeHtml(String(holding.symbol || "").toUpperCase())}::${escapeHtml(holding.exchange || "NSE")}" data-avg-price="${Number(holding.buy_price || 0)}" class="live-price-fetching">—</td>
                          <td class="${valueClass}">${currency(investedValue)}</td>
                          <td class="${valueClass}">${currency(currentValue)}</td>
                          <td class="${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}<br /><small>${percent(holding.percent_change)}</small></td>
                          <td class="${Number(holding.today_profit) >= 0 ? "profit" : "loss"}">${currency(holding.today_profit)}</td>
                          <td class="${Number(realizedProfit) >= 0 ? "profit" : "loss"}">${currency(realizedProfit)}</td>
                          <td class="${Number(totalProfit) >= 0 ? "profit" : "loss"}">${currency(totalProfit)}</td>
                          <td class="action-cell-duo">
                            <button class="buy-action-btn" type="button" data-admin-buy-holding="${holding.holding_id}" data-user-id="${holding.user_id}" data-symbol="${holding.symbol}" data-owner="${holding.owner}" data-exchange="${escapeHtml(holding.exchange || 'NSE')}" data-buy-price="${holding.buy_price}">Buy</button>
                            <button class="edit-action-btn" type="button" data-admin-edit-holding="${holding.holding_id}" data-symbol="${holding.symbol}" data-owner="${holding.owner}" data-quantity="${holding.quantity}" data-buy-price="${holding.buy_price}" data-created-at="${escapeHtml(holding.created_at || '')}">Edit</button>
                            <button class="sell-action-btn" type="button" data-admin-sell-holding="${holding.holding_id}" data-symbol="${holding.symbol}" data-owner="${holding.owner}" data-quantity="${holding.quantity}" data-buy-price="${holding.buy_price}">Sell</button>
                          </td>
                        </tr>
                      `;
                      })
                      .join("")
                  : `<tr><td colspan="13"><div class="dash-empty-state">${searchText || adminUiState.clientFilter || adminUiState.stockFilter ? `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="28" stroke="#2c90f0" stroke-width="2" stroke-dasharray="6 4" opacity="0.4"/><path d="M20 38l8-8 6 6 10-12" stroke="#2c90f0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/></svg><strong>No results for filters</strong><span>Try clearing the search or filters.</span>` : `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="20" width="40" height="28" rx="6" stroke="#2c90f0" stroke-width="2" opacity="0.35"/><path d="M20 32h24M20 38h16" stroke="#2c90f0" stroke-width="2" stroke-linecap="round" opacity="0.5"/><circle cx="44" cy="18" r="8" fill="#edf5ff" stroke="#2c90f0" stroke-width="2"/><path d="M44 15v3l2 2" stroke="#2c90f0" stroke-width="1.8" stroke-linecap="round"/></svg><strong>No holdings yet</strong><span>Use Add Deal to record investor positions.</span>`}</div></td></tr>`}
              </tbody>
              <tfoot>
                <tr class="admin-total-row">
                  <td colspan="3"><strong>Totals</strong></td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td class="${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}"><strong>${currency(filteredInvestedValue)}</strong></td>
                  <td class="${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}"><strong>${currency(filteredCurrentValue)}</strong></td>
                  <td class="${filteredUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredUnrealizedProfit)}</strong></td>
                  <td class="${filteredTodayProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredTodayProfit)}</strong></td>
                  <td class="${filteredPositionsRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredPositionsRealizedProfit)}</strong></td>
                  <td class="${filteredPositionsTotalProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredPositionsTotalProfit)}</strong></td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="admin-table-bottom-scroll" id="adminPositionsTableScroller" aria-label="Scroll positions table horizontally">
            <div class="admin-table-bottom-scroll-inner"></div>
          </div>
        </article>

        <article class="dashboard-card full-span-card">
          <div class="panel-head">
            <h3>Sold History</h3>
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="badge ${filteredSoldHistory.length ? "green" : ""}">${filteredSoldHistory.length} Records</span>
              <button class="admin-eye-btn sold-history-eye-toggle" type="button" data-sold-history-toggle="main2" title="Show / hide sold history">&#128065;</button>
            </div>
          </div>
          <div class="sold-history-body">
          <div class="table-wrap admin-position-table-wrap" id="adminSoldHistoryWrap">
            <table class="admin-position-table">
              <thead><tr><th>Investor Name</th><th>Stock</th><th>Purchase Date</th><th>Qty Sold</th><th>Avg Price</th><th>Sell Price</th><th>Sold Date</th><th>Realised P&amp;L</th><th>P&amp;L %</th></tr></thead>
              <tbody>
                ${filteredSoldHistory.length
                  ? filteredSoldHistory
                      .map(
                        (entry) => `
                          <tr>
                            <td><button class="table-link" type="button" data-user-detail="${entry.user_id}">${escapeHtml(entry.full_name)}</button><br /><small>${escapeHtml(entry.fixed_user_id || "")}</small></td>
                            <td>
                              <div class="admin-stock-cell">
                                <button class="admin-eye-btn ${isAdminStockRevealed(entry.symbol) ? "is-active" : ""}" type="button" data-stock-visibility-toggle="${escapeHtml(String(entry.symbol || "").toUpperCase())}" aria-label="${isAdminStockRevealed(entry.symbol) ? "Hide stock name" : "Show stock name"}">&#128065;</button>
                                <span class="sold-history-symbol" data-stock-label="${escapeHtml(String(entry.symbol || "").toUpperCase())}">${isAdminStockRevealed(entry.symbol) ? escapeHtml(entry.symbol) : maskStockSymbol(entry.symbol)}</span>
                              </div>
                            </td>
                            <td>${formatDate(entry.created_at)}</td>
                            <td>${entry.quantity}</td>
                            <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${currency(entry.buy_price)}</td>
                            <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${currency(entry.sell_price)}</td>
                            <td>${formatDate(entry.sold_at)}</td>
                            <td class="${Number(entry.profit_loss) >= 0 ? "profit" : "loss"}">${currency(entry.profit_loss)}</td>
                            <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${percent((((Number(entry.sell_price) - Number(entry.buy_price)) / Math.max(Number(entry.buy_price), 1)) * 100))}</td>
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="9"><div class="dash-empty-state"><svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 48L32 20l16 28H16z" stroke="#2c90f0" stroke-width="2" stroke-linejoin="round" opacity="0.35"/><path d="M32 30v8M32 42v2" stroke="#2c90f0" stroke-width="2" stroke-linecap="round" opacity="0.6"/></svg><strong>No records match the filters</strong><span>Try clearing filters to see all sold history.</span></div></td></tr>`}
              </tbody>
              <tfoot>
                <tr class="admin-total-row">
                  <td colspan="3"><strong>Totals</strong></td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td>—</td>
                  <td class="${filteredRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredRealizedProfit)}</strong></td>
                  <td>—</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="admin-table-bottom-scroll" id="adminSoldHistoryScroller" aria-label="Scroll sold history table horizontally">
            <div class="admin-table-bottom-scroll-inner"></div>
          </div>
          </div>
        </article>

        <section id="adminDetailMount" class="dashboard-section hidden"></section>
      </div>
    </section>
  `;

    if (!silent) {
      hideDashboardLoading();
      revealPortal(mount);
    } else {
      mount.classList.remove("hidden");
    }
    activeRole = "admin";
    activeUserId = null;
    startAdminRefresh();
    setupDownloadButtons(userDashboards);
    setupAdminManagementButtons();
    setupAdminDrilldowns(userDashboards, allHoldings, filteredSoldHistory);
    document.getElementById("adminXirrCalcBtn")?.addEventListener("click", () => showXirrCalculatorModal(userDashboards));
    setupScrollSync("adminPositionsTableWrap", "adminPositionsTableScroller");
    setupScrollSync("adminSoldHistoryWrap", "adminSoldHistoryScroller");
    if (adminUiState.openDetailUserId) {
      const openUser = userDashboards.find((u) => Number(u.user_id) === Number(adminUiState.openDetailUserId));
      const detailMount = document.getElementById("adminDetailMount");
      if (openUser && detailMount) {
        if (_detailWasOpen && _savedDetailHtml && !scrollToDetail) {
          detailMount.innerHTML = _savedDetailHtml;
        } else {
          detailMount.innerHTML = buildAdminClientDetail(openUser, filteredSoldHistory);
        }
        detailMount.classList.remove("hidden");
        detailMount.classList.add("portal-visible");
        setupDetailEyeButtons(detailMount);
        setupScrollSync("adminDetailLiveWrap", "adminDetailLiveScroller");
        setupScrollSync("adminDetailSoldWrap", "adminDetailSoldScroller");
        setupHoldingActionButtons(document.getElementById("adminUserActionStatus"));
        if (scrollToDetail) {
          requestAnimationFrame(() => detailMount.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
      }
    }
    setupPortalActions();
    void refreshTableLivePrices();
  } catch (error) {
    hideDashboardLoading();
    renderPortalError(mount, "Admin Dashboard", `Login succeeded, but admin dashboard data could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) {
      retry.addEventListener("click", () => renderAdminPortal());
    }
  } finally {
    adminRenderInFlight = false;
  }
}

let portfolioChartInstances = {};

const STOCK_SECTOR_MAP = {
  'KPIL': 'Infrastructure', 'KALIND': 'IT', 'INFY': 'IT', 'TCS': 'IT', 'WIPRO': 'IT',
  'HDFCBANK': 'Banking', 'ICICIBANK': 'Banking', 'SBIN': 'Banking', 'AXISBANK': 'Banking',
  'RELIANCE': 'Energy', 'ONGC': 'Energy', 'NTPC': 'Energy', 'POWERGRID': 'Energy',
  'SUNPHARMA': 'Pharma', 'DRREDDY': 'Pharma', 'CIPLA': 'Pharma', 'DIVISLAB': 'Pharma',
  'MARUTI': 'Auto', 'TATAMOTORS': 'Auto', 'BAJAJ-AUTO': 'Auto', 'EICHERMOT': 'Auto',
  'HINDUNILVR': 'FMCG', 'ITC': 'FMCG', 'NESTLEIND': 'FMCG', 'DABUR': 'FMCG'
};
const CHART_PALETTE = ['#2c90f0','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899','#84cc16','#f97316','#a78bfa'];

function destroyExistingCharts() {
  Object.values(portfolioChartInstances).forEach(c => c?.destroy());
  portfolioChartInstances = {};
}

function buildSectorAllocationData(holdings) {
  const map = {};
  holdings.forEach(h => {
    const sector = h.sector || STOCK_SECTOR_MAP[String(h.symbol || '').toUpperCase()] || 'Others';
    const val = Number(h.current_price || 0) * Number(h.quantity || 0);
    map[sector] = (map[sector] || 0) + val;
  });
  return map;
}

function buildStockAllocationData(holdings) {
  const map = {};
  holdings.forEach(h => {
    const key = String(h.symbol || 'Unknown').toUpperCase();
    const val = Number(h.current_price || 0) * Number(h.quantity || 0);
    map[key] = (map[key] || 0) + val;
  });
  const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
  if (entries.length <= 6) return Object.fromEntries(entries);
  const top5 = entries.slice(0, 5);
  const othersVal = entries.slice(5).reduce((s, [, v]) => s + v, 0);
  return Object.fromEntries([...top5, ['Others', othersVal]]);
}

function buildExchangeAllocationData(holdings) {
  const map = {};
  holdings.forEach(h => {
    const ex = String(h.exchange || 'Unknown').toUpperCase() || 'Unknown';
    const val = Number(h.current_price || 0) * Number(h.quantity || 0);
    map[ex] = (map[ex] || 0) + val;
  });
  return map;
}

function buildPnlContributionData(holdings) {
  const map = {};
  holdings.forEach(h => {
    const key = String(h.symbol || 'Unknown').toUpperCase();
    map[key] = (map[key] || 0) + Number(h.profit_loss || 0);
  });
  return map;
}

function calculateXIRR(holdings) {
  if (!holdings.length) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  // Build cash flows: outflow at each buy date, single inflow of current value today
  const flows = [];
  let totalCurrent = 0;
  for (const h of holdings) {
    const invested = Number(h.buy_price || 0) * Number(h.quantity || 0);
    const current = Number(h.current_price || 0) * Number(h.quantity || 0);
    if (invested <= 0) continue;
    const buyDate = h.created_at ? new Date(h.created_at) : today;
    buyDate.setHours(0, 0, 0, 0);
    flows.push({ ms: buyDate.getTime(), amount: -invested });
    totalCurrent += current;
  }
  if (!flows.length || totalCurrent <= 0) return null;
  flows.push({ ms: todayMs, amount: totalCurrent });
  flows.sort((a, b) => a.ms - b.ms);

  const d0 = flows[0].ms;
  const years = flows.map((f) => (f.ms - d0) / 86400000 / 365);

  // NPV(r) = sum( CF_i / (1+r)^t_i )
  const npv = (r) => flows.reduce((s, f, i) => s + f.amount / Math.pow(1 + r, years[i]), 0);
  // dNPV/dr
  const dnpv = (r) => flows.reduce((s, f, i) => s - years[i] * f.amount / Math.pow(1 + r, years[i] + 1), 0);

  // Newton-Raphson, starting at 10%
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const n = npv(r);
    const dn = dnpv(r);
    if (Math.abs(dn) < 1e-12) break;
    const r2 = r - n / dn;
    if (Math.abs(r2 - r) < 1e-8) { r = r2; break; }
    r = r2;
    if (r <= -1) r = -0.999;
  }
  if (!isFinite(r) || r <= -1) return null;
  return r * 100;
}

function renderPortfolioCharts(holdings) {
  if (typeof Chart === 'undefined') return;
  const donutOpts = () => ({
    type: 'doughnut',
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
        title: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ₹${Number(ctx.raw).toLocaleString('en-IN', { maximumFractionDigits: 0 })} (${ctx.parsed > 0 ? ((ctx.parsed / ctx.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1) : 0}%)`
          }
        }
      },
      cutout: '60%'
    }
  });

  const sectorCanvas = document.getElementById('sectorAllocationChart');
  if (sectorCanvas) {
    const data = buildSectorAllocationData(holdings);
    const labels = Object.keys(data), values = Object.values(data);
    portfolioChartInstances.sector = new Chart(sectorCanvas, {
      ...donutOpts(),
      data: { labels, datasets: [{ data: values, backgroundColor: CHART_PALETTE.slice(0, labels.length), borderWidth: 2, borderColor: '#fff' }] }
    });
  }

  const stockCanvas = document.getElementById('stockAllocationChart');
  if (stockCanvas) {
    const data = buildStockAllocationData(holdings);
    const labels = Object.keys(data), values = Object.values(data);
    portfolioChartInstances.stock = new Chart(stockCanvas, {
      ...donutOpts(),
      data: { labels, datasets: [{ data: values, backgroundColor: CHART_PALETTE.slice(0, labels.length), borderWidth: 2, borderColor: '#fff' }] }
    });
  }

  const exCanvas = document.getElementById('exchangeAllocationChart');
  if (exCanvas) {
    const data = buildExchangeAllocationData(holdings);
    const labels = Object.keys(data), values = Object.values(data);
    portfolioChartInstances.exchange = new Chart(exCanvas, {
      type: 'pie',
      data: { labels, datasets: [{ data: values, backgroundColor: ['#2c90f0', '#10b981', '#f59e0b', '#ef4444'], borderWidth: 2, borderColor: '#fff' }] },
      options: {
        responsive: true, maintainAspectRatio: true,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ₹${Number(ctx.raw).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` } }
        }
      }
    });
  }

  const pnlCanvas = document.getElementById('pnlContributionChart');
  if (pnlCanvas) {
    const data = buildPnlContributionData(holdings);
    const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
    const labels = entries.map(([k]) => k), values = entries.map(([, v]) => v);
    portfolioChartInstances.pnl = new Chart(pnlCanvas, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'P&L', data: values, backgroundColor: values.map(v => v >= 0 ? '#10b981' : '#ef4444'), borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ₹${Number(ctx.raw).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: { grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 10 }, callback: v => '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 }) } }
        }
      }
    });
  }
}

async function renderUserPortal(options = {}) {
  const mount = document.getElementById("userPortal");
  if (!mount) return;
  if (userRenderInFlight) return;
  userRenderInFlight = true;
  const { showLoading = false, silent = false, loadingTitle, loadingText } = options;
  if (!silent) revealPortal(mount);
  if (showLoading) showDashboardLoading(loadingTitle, loadingText);
  try {
    const [profile, summary, soldHistory] = await Promise.all([
      api("/auth/me"),
      api("/portfolio/summary"),
      api("/portfolio/sold-history").catch(() => [])
    ]);
    const rawPerformance = Array.isArray(summary.performance) ? summary.performance : [];
    const safeSoldHistory = Array.isArray(soldHistory) ? soldHistory : [];
    const totalInvested = rawPerformance.reduce((sum, item) => sum + Number(item.buy_price || 0) * Number(item.quantity || 0), 0);
    const overallPct = totalInvested ? (summary.total_profit_loss / totalInvested) * 100 : 0;
    const realizedMap = safeSoldHistory.reduce((map, entry) => {
      const key = String(entry.symbol || "").toUpperCase();
      map.set(key, (map.get(key) || 0) + Number(entry.profit_loss || 0));
      return map;
    }, new Map());
    const performance = rawPerformance.map((holding) => {
      const symbolKey = String(holding.symbol || "").toUpperCase();
      const currentPrice = Number(holding.current_price ?? holding.buy_price ?? 0);
      const todayProfit = Number(holding.today_profit ?? 0);
      const realizedProfit = Number(realizedMap.get(symbolKey) || 0);
      return { ...holding, current_price: currentPrice, today_profit: todayProfit, realized_profit: realizedProfit, total_profit: Number(holding.profit_loss || 0) + realizedProfit };
    });
    const filteredPerformance = getFilteredUserPerformance(performance);
    const profitableCount = performance.filter((h) => Number(h.profit_loss || 0) > 0).length;
    const filteredSoldHistory = safeSoldHistory.filter((entry) => {
      const search = userUiState.search.trim().toLowerCase();
      if (!search) return true;
      return String(entry.symbol || "").toLowerCase().includes(search) || String(entry.exchange || "").toLowerCase().includes(search);
    });
    const gainRate = performance.length ? (profitableCount / performance.length) * 100 : 0;
    const totalTodayProfit = filteredPerformance.reduce((sum, h) => sum + Number(h.today_profit || 0), 0);
    const totalRealizedProfit = filteredPerformance.reduce((sum, h) => sum + Number(h.realized_profit || 0), 0);
    const totalCombinedProfit = filteredPerformance.reduce((sum, h) => sum + Number(h.total_profit || 0), 0);
    const totalUnrealizedProfit = filteredPerformance.reduce((sum, h) => sum + Number(h.profit_loss || 0), 0);
    const filteredTotalQuantity = filteredPerformance.reduce((sum, h) => sum + Number(h.quantity || 0), 0);
    const filteredInvestedValue = filteredPerformance.reduce((sum, h) => sum + Number(h.buy_price || 0) * Number(h.quantity || 0), 0);
    const filteredCurrentValue = filteredPerformance.reduce((sum, h) => sum + Number(h.current_price || 0) * Number(h.quantity || 0), 0);

    const xirr = calculateXIRR(performance);
    const bestPerformer = performance.length ? performance.reduce((best, h) => Number(h.percent_change || 0) > Number(best.percent_change || 0) ? h : best, performance[0]) : null;
    const availableBalance = Math.max(0, Number(profile.balance_funds || 0) - filteredInvestedValue);

    mount.innerHTML = `
    <section class="user-shell no-sidebar-shell user-clean-shell">
      <div class="user-shell-main user-dashboard-stack">

        <header class="user-topbar admin-compact-topbar admin-simple-topbar">
          <div class="admin-toolbar-left">
            <div class="brand admin-dashboard-brand">
              <span class="brand-mark brand-logo brand-logo-lg"><img src="./assets/updated_logo.png" alt="Asset Yantra logo" /></span>
              <span class="public-brand-copy">
                <strong class="brand-wordmark">Asset Yantra</strong>
                <small class="brand-tagline">MARKETS. INSIGHTS. WEALTH.</small>
              </span>
              <span class="user-brand-divider"></span>
              <span class="user-investor-identity">
                <strong class="user-investor-name" id="investorNameAnimated">${escapeHtml(profile.full_name)}</strong>
                <small class="helper-text">Client ID: ${escapeHtml(profile.fixed_user_id || profile.username || "Not assigned")}</small>
              </span>
            </div>
          </div>
          <div class="user-topbar-actions admin-toolbar-right">
            <button class="secondary-btn compact-btn" type="button" id="userMetricsBtn">Metrics</button>
            <button class="secondary-btn compact-btn" type="button" id="userPdfBtn">Download PDF</button>
            <select class="user-search user-holdings-filter" id="userPortfolioStatusFilter">
              <option value="all">All Holdings</option>
              <option value="profit">In profit</option>
              <option value="loss">In loss</option>
              <option value="flat">Flat</option>
            </select>
            <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
          </div>
        </header>

        <section class="simple-summary-strip admin-summary-strip" style="grid-template-columns: repeat(4, minmax(0, 1fr))">
          <span class="${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}"><strong>${currency(filteredCurrentValue)}</strong> Portfolio Value</span>
          <span class="${totalUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalUnrealizedProfit)}</strong> Unrealised P&amp;L</span>
          <span class="${totalRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalRealizedProfit)}</strong> Lifetime Realised P&amp;L</span>
          <span class="${totalTodayProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalTodayProfit)}</strong> Today&apos;s P&amp;L</span>
        </section>

        <article class="table-card full-span-card user-charts-card">
          <div class="panel-head">
            <div>
              <h3>Portfolio Allocation &amp; Risk Insights</h3>
              <p class="helper-text">Real-time breakdown of your portfolio composition and performance.</p>
            </div>
          </div>
          ${performance.length ? `
          <div class="portfolio-charts-grid">
            <div class="chart-card">
              <h4 class="chart-title">Sector Allocation</h4>
              <p class="chart-subtitle">Distribution by sector based on current value</p>
              <div class="chart-canvas-wrap"><canvas id="sectorAllocationChart"></canvas></div>
            </div>
            <div class="chart-card">
              <h4 class="chart-title">Stock Allocation</h4>
              <p class="chart-subtitle">Top holdings by current portfolio value</p>
              <div class="chart-canvas-wrap"><canvas id="stockAllocationChart"></canvas></div>
            </div>
            <div class="chart-card">
              <h4 class="chart-title">NSE vs BSE Allocation</h4>
              <p class="chart-subtitle">Exchange distribution by current value</p>
              <div class="chart-canvas-wrap"><canvas id="exchangeAllocationChart"></canvas></div>
            </div>
            <div class="chart-card">
              <h4 class="chart-title">P&amp;L Contribution</h4>
              <p class="chart-subtitle">Unrealised profit &amp; loss by stock</p>
              <div class="chart-canvas-wrap chart-canvas-wrap--bar"><canvas id="pnlContributionChart"></canvas></div>
            </div>
          </div>
          ` : `<p class="helper-text" style="padding:20px 0">No holdings available to chart yet.</p>`}
        </article>

        <article class="table-card full-span-card user-holdings-card">
          <div class="panel-head">
            <div><h3>Portfolio Holdings</h3></div>
            <span class="badge green">Live Portfolio</span>
          </div>
          <div class="table-wrap admin-position-table-wrap" id="userPositionsTableWrap">
            <table class="admin-position-table user-position-table" id="userPositionsTable">
              <thead>
                <tr>
                  <th>Symbol</th><th>Purchase Date</th><th>Qty</th><th>Avg Price</th>
                  <th>Total Investment</th><th>Current Value</th>
                  <th>Unrealised P&amp;L</th><th>Today&apos;s P&amp;L</th><th>Realised P&amp;L</th><th>Total P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                ${filteredPerformance.length
                  ? filteredPerformance.map((holding) => {
                      const investedValue = Number(holding.buy_price || 0) * Number(holding.quantity || 0);
                      const currentValue = Number(holding.current_price || 0) * Number(holding.quantity || 0);
                      const vsc = currentValue >= investedValue ? "profit" : "loss";
                      return `<tr>
                        <td><strong>${escapeHtml(holding.symbol)}</strong></td>
                        <td>${formatDate(holding.created_at)}</td>
                        <td>${Number(holding.quantity || 0).toFixed(2)}</td>
                        <td>${currency(holding.buy_price)}</td>
                        <td class="${vsc} user-invested-cell">${currency(investedValue)}</td>
                        <td class="${vsc} user-current-cell">${currency(currentValue)}</td>
                        <td class="${Number(holding.profit_loss) >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}<br /><small>${percent(holding.percent_change)}</small></td>
                        <td class="${Number(holding.today_profit) >= 0 ? "profit" : "loss"}">${currency(holding.today_profit)}</td>
                        <td class="${Number(holding.realized_profit) >= 0 ? "profit" : "loss"}">${currency(holding.realized_profit)}</td>
                        <td class="${Number(holding.total_profit) >= 0 ? "profit" : "loss"}">${currency(holding.total_profit)}</td>
                      </tr>`;
                    }).join("")
                  : `<tr><td colspan="10"><div class="dash-empty-state">${performance.length ? `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="32" cy="32" r="28" stroke="#2c90f0" stroke-width="2" stroke-dasharray="6 4" opacity="0.4"/><path d="M20 38l8-8 6 6 10-12" stroke="#2c90f0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/></svg><strong>No results for filters</strong><span>Try clearing filters to see all holdings.</span>` : `<svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="20" width="40" height="28" rx="6" stroke="#2c90f0" stroke-width="2" opacity="0.35"/><path d="M20 32h24M20 38h16" stroke="#2c90f0" stroke-width="2" stroke-linecap="round" opacity="0.5"/><circle cx="44" cy="18" r="8" fill="#edf5ff" stroke="#2c90f0" stroke-width="2"/><path d="M44 15v3l2 2" stroke="#2c90f0" stroke-width="1.8" stroke-linecap="round"/></svg><strong>No holdings yet</strong><span>Once the admin adds your first stock, it will appear here.</span>`}</div></td></tr>`}
              </tbody>
              <tfoot>
                <tr class="admin-total-row">
                  <td colspan="2"><strong>Totals</strong></td>
                  <td><strong>${filteredTotalQuantity.toFixed(2)}</strong></td>
                  <td>—</td>
                  <td><strong>${currency(filteredInvestedValue)}</strong></td>
                  <td class="${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}"><strong>${currency(filteredCurrentValue)}</strong></td>
                  <td class="${totalUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalUnrealizedProfit)}</strong></td>
                  <td class="${totalTodayProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalTodayProfit)}</strong></td>
                  <td class="${totalRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalRealizedProfit)}</strong></td>
                  <td class="${totalCombinedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalCombinedProfit)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div class="admin-table-bottom-scroll" id="userPositionsTableScroller" aria-label="Scroll portfolio holdings table horizontally">
            <div class="admin-table-bottom-scroll-inner"></div>
          </div>
        </article>

        <article class="table-card full-span-card user-lifetime-card">
          <div class="panel-head">
            <div>
              <h3>Lifetime P&amp;L</h3>
              <p class="helper-text">Every admin sale is reflected here with the original buy date and realised profit or loss.</p>
            </div>
            <span class="badge ${filteredSoldHistory.length ? "green" : ""}">${filteredSoldHistory.length} Records</span>
          </div>
          <div class="table-wrap admin-position-table-wrap">
            <table class="admin-position-table user-lifetime-table">
              <thead>
                <tr>
                  <th>Stock</th><th>Exchange</th><th>Qty Sold</th><th>Avg Price</th>
                  <th>Sell Price</th><th>Purchase Date</th><th>Date of Sale</th><th>Realised P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                ${filteredSoldHistory.length
                  ? filteredSoldHistory.map((entry) => `
                    <tr>
                      <td><strong>${escapeHtml(entry.symbol)}</strong></td>
                      <td>${escapeHtml(entry.exchange || "—")}</td>
                      <td>${Number(entry.quantity || 0).toFixed(2)}</td>
                      <td>${currency(entry.buy_price)}</td>
                      <td>${currency(entry.sell_price)}</td>
                      <td>${formatDate(entry.created_at)}</td>
                      <td>${formatDateTime(entry.sold_at)}</td>
                      <td class="${Number(entry.profit_loss) >= 0 ? "profit" : "loss"}">${currency(entry.profit_loss)}</td>
                    </tr>`).join("")
                  : `<tr><td colspan="8"><div class="dash-empty-state"><svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 48L32 20l16 28H16z" stroke="#2c90f0" stroke-width="2" stroke-linejoin="round" opacity="0.35"/><path d="M32 30v8M32 42v2" stroke="#2c90f0" stroke-width="2" stroke-linecap="round" opacity="0.6"/></svg><strong>No sold history yet</strong><span>Completed trades will appear here once a sale is processed.</span></div></td></tr>`}
              </tbody>
            </table>
          </div>
        </article>

      </div>
    </section>

    <div class="user-metrics-overlay hidden" id="userMetricsOverlay">
      <div class="user-metrics-modal">
        <div class="user-metrics-modal-head">
          <div>
            <h3>Portfolio Metrics</h3>
            <p class="helper-text">Key performance indicators for your portfolio</p>
          </div>
          <button class="user-metrics-close" id="userMetricsClose" type="button">&times;</button>
        </div>
        <div class="user-metrics-grid">
          <div class="user-metric-card">
            <p class="user-metric-label">Total Investment</p>
            <p class="user-metric-value neutral">${currency(filteredInvestedValue)}</p>
            <p class="user-metric-note">Lifetime invested amount</p>
          </div>
          <div class="user-metric-card">
            <p class="user-metric-label">Portfolio Value</p>
            <p class="user-metric-value ${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}">${currency(filteredCurrentValue)}</p>
            <p class="user-metric-note">${overallPct >= 0 ? "+" : ""}${overallPct.toFixed(2)}% overall</p>
          </div>
          <div class="user-metric-card">
            <p class="user-metric-label">Available Balance</p>
            <p class="user-metric-value neutral">${currency(availableBalance)}</p>
            <p class="user-metric-note">Remaining deployable balance</p>
          </div>
          <div class="user-metric-card">
            <p class="user-metric-label">Total Return</p>
            <p class="user-metric-value ${totalCombinedProfit >= 0 ? "profit" : "loss"}">${currency(totalCombinedProfit)}</p>
            <p class="user-metric-note">${percent(overallPct)} overall return</p>
          </div>
          <div class="user-metric-card">
            <p class="user-metric-label">XIRR</p>
            <p class="user-metric-value ${xirr === null ? "neutral" : xirr >= 0 ? "profit" : "loss"}">${xirr !== null ? xirr.toFixed(2) + "%" : "—"}</p>
            <p class="user-metric-note">Annualised return estimate</p>
          </div>
          <div class="user-metric-card">
            <p class="user-metric-label">Win Rate</p>
            <p class="user-metric-value ${gainRate >= 50 ? "profit" : "loss"}">${gainRate.toFixed(1)}%</p>
            <p class="user-metric-note">${profitableCount} of ${performance.length} positions profitable</p>
          </div>
          <div class="user-metric-card">
            <p class="user-metric-label">Best Performer</p>
            <p class="user-metric-value profit">${bestPerformer ? escapeHtml(bestPerformer.symbol) : "—"}</p>
            <p class="user-metric-note">${bestPerformer ? percent(bestPerformer.percent_change) : "No holdings"}</p>
          </div>
        </div>
      </div>
    </div>
  `;

    revealPortal(mount);
    activeRole = "user";
    activeUserId = profile.id;
    startUserRefresh();
    setupUserPortfolioFilters();
    setupScrollSync("userPositionsTableWrap", "userPositionsTableScroller");
    setupPortalActions();

    destroyExistingCharts();
    if (performance.length) renderPortfolioCharts(performance);

    const nameEl = document.getElementById("investorNameAnimated");
    if (nameEl) nameEl.classList.add("user-investor-name--animate");

    const metricsBtn = document.getElementById("userMetricsBtn");
    const metricsOverlay = document.getElementById("userMetricsOverlay");
    const metricsClose = document.getElementById("userMetricsClose");
    if (metricsBtn && metricsOverlay) {
      metricsBtn.addEventListener("click", () => metricsOverlay.classList.remove("hidden"));
      if (metricsClose) metricsClose.addEventListener("click", () => metricsOverlay.classList.add("hidden"));
      metricsOverlay.addEventListener("click", (e) => { if (e.target === metricsOverlay) metricsOverlay.classList.add("hidden"); });
    }

    const pdfBtn = document.getElementById("userPdfBtn");
    if (pdfBtn) pdfBtn.addEventListener("click", () => window.print());

  } catch (error) {
    renderPortalError(mount, "User Dashboard", `Login succeeded, but portfolio data could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) retry.addEventListener("click", () => renderUserPortal());
  } finally {
    hideDashboardLoading();
    userRenderInFlight = false;
  }
}

function setupPortfolioForm() {
  const form = document.getElementById("portfolioForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      await api("/portfolio", {
        method: "POST",
        body: JSON.stringify({
          symbol: String(data.get("symbol")).trim().toUpperCase(),
          quantity: Number(data.get("quantity")),
          buy_price: Number(data.get("buyPrice")),
          exchange: String(data.get("exchange")).trim().toUpperCase()
        })
      });
      form.reset();
      form.querySelector('[name="exchange"]').value = "NSE";
      await renderUserPortal();
    } catch (error) {
      alert(error.message);
    }
  });
}

function setupLogin() {
  const adminForm = document.getElementById("adminForm");
  const userFormWrap = document.getElementById("userFormWrap");
  const userFormIdPwd = document.getElementById("userFormIdPwd");
  const userFormPhoneOtp = document.getElementById("userFormPhoneOtp");
  const registerForm = document.getElementById("registerForm");
  if (!adminForm || !userFormWrap) return;

  const toggles = document.querySelectorAll(".role-toggle");
  const adminPortal = document.getElementById("adminPortal");
  const userPortal = document.getElementById("userPortal");
  const apiBaseUrlInput = document.getElementById("apiBaseUrlInput");
  const saveApiUrlBtn = document.getElementById("saveApiUrlBtn");
  const checkBackendBtn = document.getElementById("checkBackendBtn");
  const authHeroTitle = document.getElementById("authHeroTitle");
  const authHeroText = document.getElementById("authHeroText");
  const authAsideEyebrow = document.getElementById("authAsideEyebrow");
  const authAsideTitle = document.getElementById("authAsideTitle");
  const authAsideMetrics = document.getElementById("authAsideMetrics");
  const authAsideListEyebrow = document.getElementById("authAsideListEyebrow");
  const authAsideList = document.getElementById("authAsideList");
  const authDynamicCard = document.getElementById("authDynamicCard");
  const authDynamicListCard = document.getElementById("authDynamicListCard");

  const asideContent = {
    admin: {
      heroTitle: "Login as admin.",
      heroText: "Review clients, portfolio performance, and export-ready dashboards.",
      eyebrow: "Admin View",
      title: "Control client portfolios and exports.",
      metrics: [
        ["Clients", "Track all registered users"],
        ["Reports", "Download dashboard snapshots"],
        ["Live", "Review current P&L movement"]
      ],
      listEyebrow: "Admin Tools",
      items: [
        "Client holdings overview",
        "Portfolio-level profit and loss",
        "User dashboard downloads",
        "Centralized reporting flow"
      ]
    },
    user: {
      heroTitle: "Login as user.",
      heroText: "Track holdings, monitor returns, and manage your portfolio in one place.",
      eyebrow: "User View",
      title: "Monitor your portfolio with less friction.",
      metrics: [
        ["Portfolio", "Track current holdings"],
        ["Returns", "Review profit and loss"],
        ["Updates", "Add stocks manually"]
      ],
      listEyebrow: "User Tools",
      items: [
        "Fixed ID login flow",
        "Manual stock entry",
        "Lifetime portfolio view",
        "Simple performance tracking"
      ]
    },
    register: {
      heroTitle: "Create a new account.",
      heroText: "Register once, receive a fixed user ID, and start building a tracked portfolio.",
      eyebrow: "New Account",
      title: "Create a client profile in minutes.",
      metrics: [
        ["Secure", "Stored in the backend DB"],
        ["ID", "Fixed user ID generated"],
        ["Ready", "Portfolio can be added after signup"]
      ],
      listEyebrow: "Signup Flow",
      items: [
        "Full name and contact details",
        "Password-based secure access",
        "Backend persistence",
        "Immediate platform entry"
      ]
    }
  };

  const updateAside = (role) => {
    const content = asideContent[role];
    if (
      !content ||
      !authAsideEyebrow ||
      !authAsideTitle ||
      !authAsideMetrics ||
      !authAsideListEyebrow ||
      !authAsideList ||
      !authDynamicCard ||
      !authDynamicListCard
    ) {
      return;
    }

    if (authHeroTitle) authHeroTitle.textContent = content.heroTitle;
    if (authHeroText) authHeroText.textContent = content.heroText;

    authDynamicCard.classList.remove("admin-theme", "user-theme", "register-theme", "panel-animate");
    authDynamicListCard.classList.remove("panel-animate");
    void authDynamicCard.offsetWidth;
    authDynamicCard.classList.add(`${role}-theme`, "panel-animate");
    authDynamicListCard.classList.add("panel-animate");

    authAsideEyebrow.textContent = content.eyebrow;
    authAsideTitle.textContent = content.title;
    authAsideMetrics.innerHTML = content.metrics
      .map(([title, text]) => `<div><strong>${title}</strong><span>${text}</span></div>`)
      .join("");
    authAsideListEyebrow.textContent = content.listEyebrow;
    authAsideList.innerHTML = content.items.map((item) => `<li>${item}</li>`).join("");
  };

  if (apiBaseUrlInput) {
    apiBaseUrlInput.value = getApiBase();
  }
  if (saveApiUrlBtn && apiBaseUrlInput) {
    saveApiUrlBtn.addEventListener("click", () => {
      localStorage.setItem("stock_trader_api_url", apiBaseUrlInput.value.trim());
      updateBackendStatus("API URL saved successfully.", "ok");
    });
  }
  if (checkBackendBtn) {
    checkBackendBtn.addEventListener("click", () => {
      checkBackendStatus();
    });
  }

  // Method switcher within the user form (Client ID+Password vs Phone+OTP)
  document.querySelectorAll("[data-user-method]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const method = btn.dataset.userMethod;
      document.querySelectorAll("[data-user-method]").forEach((b) => b.classList.toggle("active", b === btn));
      if (userFormIdPwd) userFormIdPwd.classList.toggle("hidden", method !== "id-password");
      if (userFormPhoneOtp) userFormPhoneOtp.classList.toggle("hidden", method !== "phone-otp");
    });
  });

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const role = toggle.dataset.roleTab;
      if (!role) return;
      toggles.forEach((entry) => entry.classList.toggle("active", entry === toggle));
      adminForm.classList.toggle("hidden", role !== "admin");
      userFormWrap.classList.toggle("hidden", role !== "user");
      if (registerForm) registerForm.classList.toggle("hidden", role !== "register");
      hidePortalMounts();
      hideAuthLoading();
      activeRole = null;
      activeUserId = null;
      updateAside(role);
    });
  });

  document.querySelectorAll("[data-send-otp]").forEach((button) => {
    button.addEventListener("click", async () => {
      const stopLoading = setButtonLoading(button, button.dataset.sendOtp === "admin" ? "Sending..." : "Sending...");
      try {
        if (button.dataset.sendOtp === "admin") {
          if (!hasRequiredFields(adminForm, ["username", "password", "phone"])) {
            document.getElementById("adminError").textContent = "Fill username, password, and phone number before requesting OTP.";
            return;
          }
          hidePortalMounts();
          const payload = {
            role: "admin",
            identifier: String(adminForm.querySelector('[name="username"]').value).trim(),
            password: String(adminForm.querySelector('[name="password"]').value),
            phone_number: String(adminForm.querySelector('[name="phone"]').value).trim()
          };
          const response = await api("/auth/request-otp", { method: "POST", body: JSON.stringify(payload) });
          if (response.otp_preview) {
            document.getElementById("adminOtpHint").textContent = `Testing OTP: ${response.otp_preview}`;
          } else {
            startOtpCountdown("adminOtpHint", 3);
          }
          document.getElementById("adminError").textContent = "";
        } else {
          const phoneInput = userFormPhoneOtp?.querySelector('[name="phone"]');
          const phoneVal = phoneInput?.value?.trim() || "";
          if (!phoneVal) {
            document.getElementById("userPhoneOtpError").textContent = "Enter your registered phone number before requesting OTP.";
            return;
          }
          hidePortalMounts();
          const payload = { role: "user", phone_number: phoneVal };
          const response = await api("/auth/request-otp", { method: "POST", body: JSON.stringify(payload) });
          startOtpCountdown("userOtpHint", 3);
          if (response.otp_preview) {
            const hint = document.getElementById("userOtpHint");
            if (hint) hint.textContent += ` (Test code: ${response.otp_preview})`;
          }
          const userErrEl = document.getElementById("userPhoneOtpError");
          if (userErrEl) userErrEl.textContent = "";
        }
      } catch (error) {
        if (button.dataset.sendOtp === "admin") {
          document.getElementById("adminError").textContent = formatError(error);
        } else {
          const errEl = document.getElementById("userPhoneOtpError");
          if (errEl) errEl.textContent = formatError(error);
        }
      } finally {
        stopLoading();
      }
    });
  });

  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = adminForm.querySelector('button[type="submit"]');
    const errEl = document.getElementById("adminError");
    const stopLoading = setButtonLoading(submitButton, "Opening Dashboard...");
    try {
      if (!hasRequiredFields(adminForm, ["username", "password", "phone"])) {
        errEl.textContent = "Complete username, password, and phone number before opening the dashboard.";
        return;
      }
      const data = new FormData(adminForm);
      hidePortalMounts();
      showAuthLoading("Opening admin dashboard...", "Verifying credentials, loading client data, and preparing admin controls.");
      const response = await apiWithRetry(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            role: "admin",
            identifier: String(data.get("username")).trim(),
            password: String(data.get("password")),
            phone_number: String(data.get("phone")).trim(),
            otp: null
          })
        },
        errEl,
        "Connecting to server"
      );
      setAuth({ token: response.access_token, role: response.role });
      errEl.textContent = "";
      hideAuthLoading();
      window.location.href = "./admin-dashboard.html";
    } catch (error) {
      errEl.textContent = formatError(error);
      hidePortalMounts();
      hideAuthLoading();
    } finally {
      stopLoading();
    }
  });

  // Method 1: Client ID + Password login
  if (userFormIdPwd) {
    userFormIdPwd.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = userFormIdPwd.querySelector('button[type="submit"]');
      const stopLoading = setButtonLoading(submitButton, "Opening Dashboard...");
      const errEl = document.getElementById("userIdPwdError");
      try {
        if (!hasRequiredFields(userFormIdPwd, ["userId", "password"])) {
          if (errEl) errEl.textContent = "Enter your Client ID and password to continue.";
          return;
        }
        const data = new FormData(userFormIdPwd);
        hidePortalMounts();
        showAuthLoading("Opening user dashboard...", "Loading your holdings, returns, and portfolio summary.");
        const response = await apiWithRetry(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              role: "user",
              identifier: String(data.get("userId") || "").trim().toUpperCase(),
              password: String(data.get("password"))
            })
          },
          errEl,
          "Connecting to server"
        );
        setAuth({ token: response.access_token, role: response.role });
        if (errEl) errEl.textContent = "";
        hideAuthLoading();
        window.location.href = "./user-dashboard.html";
      } catch (error) {
        if (errEl) errEl.textContent = formatError(error);
        hidePortalMounts();
        hideAuthLoading();
      } finally {
        stopLoading();
      }
    });
  }

  // Method 2: Phone + OTP login
  if (userFormPhoneOtp) {
    userFormPhoneOtp.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = userFormPhoneOtp.querySelector('button[type="submit"]');
      const stopLoading = setButtonLoading(submitButton, "Opening Dashboard...");
      const errEl = document.getElementById("userPhoneOtpError");
      try {
        if (!hasRequiredFields(userFormPhoneOtp, ["phone", "otp"])) {
          if (errEl) errEl.textContent = "Enter your phone number and the OTP sent to it.";
          return;
        }
        const data = new FormData(userFormPhoneOtp);
        hidePortalMounts();
        showAuthLoading("Opening user dashboard...", "Loading your holdings, returns, and portfolio summary.");
        const response = await apiWithRetry(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              role: "user",
              phone_number: String(data.get("phone")).trim(),
              otp: String(data.get("otp")).trim()
            })
          },
          errEl,
          "Connecting to server"
        );
        setAuth({ token: response.access_token, role: response.role });
        if (errEl) errEl.textContent = "";
        hideAuthLoading();
        window.location.href = "./user-dashboard.html";
      } catch (error) {
        if (errEl) errEl.textContent = formatError(error);
        hidePortalMounts();
        hideAuthLoading();
      } finally {
        stopLoading();
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = registerForm.querySelector('button[type="submit"]');
      const stopLoading = setButtonLoading(submitButton, "Creating Account...");
      try {
        if (!hasRequiredFields(registerForm, ["full_name", "email", "phone_number", "password"])) {
          document.getElementById("registerError").textContent = "Complete all registration fields before creating the account.";
          return;
        }
        const data = new FormData(registerForm);
        hidePortalMounts();
        showAuthLoading("Creating secure account...", "Saving user details and preparing the first portfolio workspace.");
        const response = await api("/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            full_name: String(data.get("full_name")).trim(),
            email: String(data.get("email")).trim(),
            phone_number: String(data.get("phone_number")).trim(),
            password: String(data.get("password"))
          })
        });
        setAuth({ token: response.access_token, role: response.role });
        let profile = null;
        try {
          profile = await api("/auth/me");
        } catch {
          profile = null;
        }
        document.getElementById("registerError").textContent = "";
        document.getElementById("registerHint").textContent = profile?.fixed_user_id
          ? `Account created successfully. Your fixed user ID is ${profile.fixed_user_id}.`
          : "Account created successfully. Your fixed user ID is available once the profile loads.";
        await renderUserPortal();
        hideAuthLoading();
      } catch (error) {
        document.getElementById("registerError").textContent = formatError(error);
        hidePortalMounts();
        hideAuthLoading();
      } finally {
        stopLoading();
      }
    });
  }

  fetch(getApiBase().replace(/\/api\/v1$/, "") + "/health").catch(() => {});

  if (isLoginPage()) {
    clearAuth();
    hidePortalMounts();
    hideAuthLoading();
  } else {
    const auth = getAuth();
    if (!auth?.token && (isAdminDashboardPage() || isAdminCustomerPage() || isAdminDealPage() || isAdminDatabasePage() || isAdminFundsPage() || isUserDashboardPage())) {
      window.location.href = "./login.html";
    }
  }

  updateAside("admin");
  checkBackendStatus();

  liveTickerTimer = setInterval(async () => {
    if (document.hidden) return;
    if (activeRole === "user" && activeUserId && isUserDashboardPage()) {
      await renderUserPortal({ silent: true }).catch(() => {});
      return;
    }
  }, 3000);
}

function setupDashboardPages() {
  const auth = getAuth();

  if (isAdminDashboardPage()) {
    if (!auth?.token) {
      window.location.href = "./login.html";
      return;
    }
    if (auth.role !== "admin") {
      window.location.href = "./login.html";
      return;
    }
    renderAdminPortal().then(hideDashLoader).catch(() => {
      hideDashLoader();
      clearAuth();
      renderPortalError(
        document.getElementById("adminPortal"),
        "Admin Dashboard",
        "The dashboard could not load yet. Please check that the backend is running and try again."
      );
    });
  }

  if (isUserDashboardPage()) {
    if (!auth?.token) {
      window.location.href = "./login.html";
      return;
    }
    if (auth.role !== "user") {
      window.location.href = "./login.html";
      return;
    }
    renderUserPortal({ showLoading: true, loadingTitle: "Loading Portfolio", loadingText: "Fetching your holdings, returns, and market prices" }).then(hideDashLoader).catch(() => {
      hideDashLoader();
      clearAuth();
      renderPortalError(
        document.getElementById("userPortal"),
        "User Dashboard",
        "The portfolio could not load yet. Please check that the backend is running and try again."
      );
    });
  }

  if (isAdminDatabasePage()) {
    if (!auth?.token) {
      window.location.href = "./login.html";
      return;
    }
    if (auth.role !== "admin") {
      window.location.href = "./login.html";
      return;
    }
    renderAdminDatabasePage().then(hideDashLoader).catch(() => {
      hideDashLoader();
      renderPortalError(
        document.getElementById("adminPortal"),
        "Database View",
        "The database view could not load yet. Please check that the backend is running and try again."
      );
    });
  }

  if (isAdminCustomerPage() || isAdminDealPage() || isAdminFundsPage()) {
    if (!auth?.token) {
      window.location.href = "./login.html";
      return;
    }
    if (auth.role !== "admin") {
      window.location.href = "./login.html";
      return;
    }
    if (isAdminCustomerPage()) {
      renderAdminCustomerPage().then(hideDashLoader).catch(() => {
        hideDashLoader();
        renderPortalError(
          document.getElementById("adminPortal"),
          "Add Customer",
          "The add customer page could not load yet. Please try again."
        );
      });
    }
    if (isAdminDealPage()) {
      renderAdminDealPage().then(hideDashLoader).catch(() => {
        hideDashLoader();
        renderPortalError(
          document.getElementById("adminDealPortal"),
          "Add Deal",
          "The add deal page could not load yet. Please try again."
        );
      });
    }
    if (isAdminFundsPage()) {
      renderAdminFundsPage().then(hideDashLoader).catch(() => {
        hideDashLoader();
        renderPortalError(
          document.getElementById("adminPortal"),
          "Add Funds",
          "The add funds page could not load yet. Please try again."
        );
      });
    }
  }
}

function setupPublicPageVisibility() {
  if (!document.body.classList.contains("public-page")) return;
  const nodes = document.querySelectorAll(".fade-up");
  if (!nodes.length) return;

  const CHILD_SELECTORS = [
    ".stat-card", ".product-card", ".team-card", ".testimonial-card",
    ".returns-tier-card", ".story-step", ".feature-card", ".service-card",
    ".safety-clean-card", ".algo-edge-card", ".algo-pricing-card",
    ".values-grid > article", ".usp-grid > div", ".leader-card"
  ].join(",");

  // Inject skeleton shimmer into each section-card
  nodes.forEach((n) => {
    if ((n.classList.contains("section-card") || n.classList.contains("hero-shell")) && !n.classList.contains("is-visible")) {
      const skel = document.createElement("div");
      skel.className = "card-skeleton";
      n.style.position = n.style.position || "relative";
      n.prepend(skel);
    }
  });

  if (!("IntersectionObserver" in window)) {
    nodes.forEach((n) => {
      n.classList.add("is-visible");
      n.querySelector(".card-skeleton")?.remove();
    });
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add("is-visible");

        // Fade out and remove skeleton
        const skel = el.querySelector(":scope > .card-skeleton");
        if (skel) {
          skel.classList.add("is-fading");
          setTimeout(() => skel.remove(), 380);
        }

        // Stagger-animate direct child cards
        const children = Array.from(el.querySelectorAll(CHILD_SELECTORS));
        children.forEach((child, i) => {
          if (!child.classList.contains("stagger-child")) {
            child.style.setProperty("--child-delay", `${50 + i * 85}ms`);
            child.classList.add("stagger-child");
          }
        });

        io.unobserve(el);
      });
    },
    { threshold: 0.06, rootMargin: "0px 0px -32px 0px" }
  );

  nodes.forEach((n) => io.observe(n));
}

function setupScrollToTop() {
  if (!document.body.classList.contains("public-page")) return;
  const btn = document.createElement("button");
  btn.className = "scroll-top-btn";
  btn.setAttribute("aria-label", "Scroll to top");
  btn.innerHTML = "&#8963;";
  document.body.appendChild(btn);

  const onScroll = () => {
    const pct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
    btn.classList.toggle("is-visible", pct > 0.55);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  btn.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function setupProgressBar() {
  if (!document.body.classList.contains("public-page")) return;
  const bar = document.getElementById("pageProgress");
  if (!bar) return;

  // Sweep to 80% while page resources load
  requestAnimationFrame(() => {
    bar.style.transition = "width 700ms cubic-bezier(0.1, 0.9, 0.2, 1)";
    bar.style.width = "80%";
  });

  const complete = () => {
    bar.style.transition = "width 220ms ease";
    bar.style.width = "100%";
    setTimeout(() => {
      bar.style.transition = "opacity 280ms ease";
      bar.style.opacity = "0";
      setTimeout(() => {
        bar.style.width = "0%";
        bar.style.opacity = "1";
        bar.style.transition = "";
      }, 320);
    }, 260);
  };

  if (document.readyState === "complete") {
    setTimeout(complete, 180);
  } else {
    window.addEventListener("load", complete, { once: true });
  }
}

function setupHeroSplitText() {
  if (!document.body.classList.contains("public-page")) return;
  const h1 = document.querySelector(".hero-carousel-slide.is-active .hero-carousel-copy h1");
  if (!h1) return;

  const words = h1.textContent.trim().split(/\s+/);
  h1.setAttribute("aria-label", h1.textContent.trim());
  h1.innerHTML = words
    .map((w, i) => `<span class="word-reveal" aria-hidden="true" style="--wi:${i}">${w}</span>`)
    .join(" ");

  setTimeout(() => {
    h1.querySelectorAll(".word-reveal").forEach((span, i) => {
      setTimeout(() => span.classList.add("is-revealed"), i * 65);
    });
  }, 90);
}

function setupFloatingWhatsApp() {
  const publicPages = new Set(["home", "about", "products", "contact", "trust-safety", "legal", "forex", "faq", "reviews"]);
  const page = document.body?.dataset?.page;
  const existing = document.querySelector(".floating-whatsapp");

  if (!publicPages.has(page)) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const anchor = document.createElement("a");
  anchor.className = "floating-whatsapp";
  anchor.href = "https://wa.me/919885800023";
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.setAttribute("aria-label", "Chat with Asset Yantra on WhatsApp");
  anchor.innerHTML = `
    <span class="floating-whatsapp-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="presentation" focusable="false">
        <path d="M19.05 4.94A9.82 9.82 0 0 0 12.04 2C6.63 2 2.24 6.39 2.24 11.8c0 1.73.45 3.42 1.31 4.91L2 22l5.45-1.51a9.75 9.75 0 0 0 4.58 1.16h.01c5.4 0 9.8-4.39 9.8-9.8a9.73 9.73 0 0 0-2.79-6.91zm-7.01 15.06h-.01a8.13 8.13 0 0 1-4.14-1.13l-.3-.18-3.24.9.87-3.16-.2-.32a8.13 8.13 0 0 1-1.25-4.32c0-4.48 3.64-8.13 8.13-8.13 2.17 0 4.2.84 5.73 2.38a8.06 8.06 0 0 1 2.38 5.75c0 4.48-3.65 8.11-8.13 8.11zm4.46-6.08c-.24-.12-1.41-.7-1.63-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.95-1.21-.72-.64-1.2-1.44-1.34-1.68-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.31-.74-1.79-.2-.48-.4-.42-.54-.43h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.68 2.57 4.06 3.61.57.24 1.01.39 1.36.5.57.18 1.08.15 1.49.09.45-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z"></path>
      </svg>
    </span>
    <span class="floating-whatsapp-copy">
      <strong>WhatsApp</strong>
      <small>Chat now</small>
    </span>
  `;
  document.body.appendChild(anchor);
}

function setupFooterSocials() {
  const publicPages = new Set(["home", "about", "products", "contact", "trust-safety", "legal", "login"]);
  const page = document.body?.dataset?.page;
  if (!publicPages.has(page)) return;

  document.querySelectorAll(".footer-legal").forEach((container) => {
    if (container.querySelector(".footer-socials")) return;

    const socials = document.createElement("div");
    socials.className = "footer-socials";
    socials.innerHTML = `
      <span class="footer-social-icon" aria-label="Instagram placeholder" title="Instagram link coming soon">
        <svg viewBox="0 0 24 24" role="presentation" focusable="false">
          <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2zm0 1.75A4 4 0 0 0 3.75 7.75v8.5a4 4 0 0 0 4 4h8.5a4 4 0 0 0 4-4v-8.5a4 4 0 0 0-4-4zm8.88 1.5a1.12 1.12 0 1 1 0 2.25 1.12 1.12 0 0 1 0-2.25zM12 6.5A5.5 5.5 0 1 1 6.5 12 5.5 5.5 0 0 1 12 6.5zm0 1.75A3.75 3.75 0 1 0 15.75 12 3.75 3.75 0 0 0 12 8.25z"></path>
        </svg>
      </span>
      <span class="footer-social-icon" aria-label="Twitter placeholder" title="Twitter link coming soon">
        <svg viewBox="0 0 24 24" role="presentation" focusable="false">
          <path d="M18.9 2H22l-6.77 7.74L23 22h-6.1l-4.78-6.27L6.64 22H3.53l7.24-8.27L1.5 2h6.25l4.31 5.68L18.9 2zm-1.08 18h1.72L6.82 3.9H4.98z"></path>
        </svg>
      </span>
      <a class="footer-social-link" href="https://wa.me/919885800023" target="_blank" rel="noreferrer" aria-label="WhatsApp">
        <svg viewBox="0 0 24 24" role="presentation" focusable="false">
          <path d="M19.05 4.94A9.82 9.82 0 0 0 12.04 2C6.63 2 2.24 6.39 2.24 11.8c0 1.73.45 3.42 1.31 4.91L2 22l5.45-1.51a9.75 9.75 0 0 0 4.58 1.16h.01c5.4 0 9.8-4.39 9.8-9.8a9.73 9.73 0 0 0-2.79-6.91zm-7.01 15.06h-.01a8.13 8.13 0 0 1-4.14-1.13l-.3-.18-3.24.9.87-3.16-.2-.32a8.13 8.13 0 0 1-1.25-4.32c0-4.48 3.64-8.13 8.13-8.13 2.17 0 4.2.84 5.73 2.38a8.06 8.06 0 0 1 2.38 5.75c0 4.48-3.65 8.11-8.13 8.11zm4.46-6.08c-.24-.12-1.41-.7-1.63-.77-.22-.08-.38-.12-.54.12-.16.24-.62.77-.76.93-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.95-1.21-.72-.64-1.2-1.44-1.34-1.68-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.31-.74-1.79-.2-.48-.4-.42-.54-.43h-.46c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.68 2.57 4.06 3.61.57.24 1.01.39 1.36.5.57.18 1.08.15 1.49.09.45-.07 1.41-.58 1.61-1.14.2-.56.2-1.04.14-1.14-.06-.1-.22-.16-.46-.28z"></path>
        </svg>
      </a>
    `;

    const copy = container.querySelector(".footer-copy");
    if (copy) {
      copy.before(socials);
    } else {
      container.appendChild(socials);
    }
  });
}

function isFinancialQuestion(message) {
  const text = message.toLowerCase();
  const keywords = [
    "stock", "share", "market", "profit", "loss", "portfolio", "invest", "investing", "risk", "return",
    "valuation", "pe ratio", "dividend", "revenue", "earnings", "nifty", "sensex", "equity", "mutual fund",
    "sip", "bank", "finance", "trading", "allocation", "sector", "capital", "price", "inflation", "interest"
  ];
  return keywords.some((keyword) => text.includes(keyword));
}

function financeFallbackReply(message) {
  const text = message.toLowerCase();
  if (text.includes("how to login") || text.includes("login") || text.includes("sign in")) {
    return "Choose Admin or User login, enter your credentials, request the OTP, then submit the code to open the dashboard.";
  }
  if (text.includes("register") || text.includes("new user") || text.includes("create account")) {
    return "Use the Register User option on the login page. A fixed client ID is generated after signup and your details are saved in the backend database.";
  }
  if (text.includes("otp")) {
    return "OTP is used as an added login verification step. Click Send OTP, use the displayed code in local testing, and then complete login.";
  }
  if (text.includes("admin") && text.includes("download")) {
    return "Admins can open the admin dashboard and use Download Dashboard for a selected client portfolio snapshot.";
  }
  if (text.includes("faq") || text.includes("question") || text.includes("help")) {
    return "I can help with login steps, portfolio basics, admin dashboard actions, OTP flow, finance terms, and stock-related questions.";
  }
  if (text.includes("portfolio")) {
    return "A portfolio is the collection of investments you hold. Focus on allocation, concentration, return, and risk when reviewing it.";
  }
  if (text.includes("profit") || text.includes("loss")) {
    return "Profit or loss is calculated as current value minus invested amount. Profit percentage is profit divided by invested amount, multiplied by 100.";
  }
  if (text.includes("risk")) {
    return "Portfolio risk usually comes from over-concentration, volatility, weak diversification, leverage, and a mismatch between investments and time horizon.";
  }
  if (text.includes("dividend")) {
    return "A dividend is a cash distribution paid by a company to shareholders. Yield should be reviewed alongside payout sustainability and earnings quality.";
  }
  if (text.includes("pe ratio") || text.includes("valuation")) {
    return "The P/E ratio compares stock price to earnings per share. Use it with growth, debt, margins, and peer comparisons rather than as a standalone signal.";
  }
  if (text.includes("sip") || text.includes("mutual fund")) {
    return "A SIP is a periodic investment approach often used with mutual funds to average buying costs over time and reduce timing pressure.";
  }
  return "I can help with financial topics such as stocks, portfolios, diversification, profit and loss, valuation, risk, and market basics.";
}

setupFaq();
loadSiteControls().catch(() => {});
setupReviewForm();
setupPageTransitions();
setupMobileNav();
setupScrollToTop();
setupProgressBar();
setupPublicPageVisibility();
setupHeroSplitText();
setupFloatingWhatsApp();
setupFooterSocials();
setupHomePage();
setupLogin();
setupDashboardPages();


