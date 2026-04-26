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
let adminUiState = {
  search: "",
  clientFilter: "",
  stockFilter: "",
  dateFrom: "",
  dateTo: "",
  revealedStocks: [],
  actionsMenuOpen: false
};
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
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value || 0));

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

function isUserDashboardPage() {
  return document.body?.dataset?.page === "user-dashboard";
}

function isAdminCustomerPage() {
  return document.body?.dataset?.page === "admin-add-customer";
}

function isAdminDealPage() {
  return document.body?.dataset?.page === "admin-add-deal";
}

function isAdminDatabasePage() {
  return document.body?.dataset?.page === "admin-database";
}

function stopAdminRefresh() {
  if (adminRefreshTimer) {
    window.clearInterval(adminRefreshTimer);
    adminRefreshTimer = null;
  }
}

function startAdminRefresh() {
  stopAdminRefresh();
  const intervalMs = isAdminDatabasePage() ? 10000 : 2000;
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
  void target.offsetWidth;
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
      <div class="auth-loading-brand">AssetYantra Portfolio Sync</div>
      <div class="auth-orbit-loader" aria-hidden="true">
        <span></span>
        <span></span>
        <img src="./assets/assetyantra-logo.svg" alt="AssetYantra logo" />
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
  if (titleNode) titleNode.textContent = title || "Opening user dashboard...";
  if (textNode) textNode.textContent = text || "Loading your holdings, returns, and portfolio summary.";
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideDashboardLoading() {
  const overlay = document.getElementById("dashboardLoadingOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
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

function formatError(error) {
  if (
    error instanceof TypeError &&
    /(fetch|network|load|failed|offline|connection)/i.test(error.message || "")
  ) {
    return "Unable to reach the backend server. Start the API and check the API Base URL.";
  }
  return error.message || "Something went wrong.";
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
    throw new Error(data.detail || "Request failed");
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
        loadingText: "Loading your holdings, returns, and portfolio summary."
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
  let overlay = document.getElementById("pageTransitionOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "pageTransitionOverlay";
    overlay.className = "page-transition-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.innerHTML = `
      <div class="page-transition-card">
        <span class="page-transition-logo" aria-hidden="true">
          <img src="./assets/assetyantra-logo.svg" alt="AssetYantra logo" />
        </span>
        <strong>Loading AssetYantra...</strong>
        <p>Please wait while we move you to the next page.</p>
        <div class="page-transition-bar" aria-hidden="true"><span></span></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  document.body.classList.add("page-enter");

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.body.classList.add("page-ready");
      document.body.classList.remove("page-enter");
    });
  });

  document.querySelectorAll('a[href]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (link.target && link.target !== "_self") return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const url = new URL(href, window.location.href);
      const isSameOrigin = url.origin === window.location.origin;
      const isHtmlPage = /\.(html)?$/i.test(url.pathname.split("/").pop() || "");
      if (!isSameOrigin || !isHtmlPage) return;
      if (url.href === window.location.href) return;

      event.preventDefault();
      overlay.classList.add("is-visible");
      overlay.setAttribute("aria-hidden", "false");
      document.body.classList.add("page-transitioning");
      window.setTimeout(() => {
        window.location.href = url.href;
      }, 260);
    });
  });
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
          <td>${escapeHtml(user.full_name || "Unknown User")}</td>
          <td>${escapeHtml(user.fixed_user_id || "")}</td>
          <td>${escapeHtml(user.username || "")}</td>
          <td>${escapeHtml(user.phone_number || "")}</td>
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
          <td>${escapeHtml(dashboard.full_name || "Unknown User")}</td>
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
        <h1>AssetYantra Database Export</h1>
        <p>Generated on ${escapeHtml(formatDateTime(new Date().toISOString()))}</p>
        <h2>User Credentials</h2>
        <table>
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Client ID</th>
              <th>Username / Email</th>
              <th>Phone Number</th>
              <th>Role</th>
              <th>Status</th>
              <th>Mode</th>
              <th>Created At</th>
              <th>Portfolio Value</th>
              <th>Total Holdings</th>
              <th>Total P&amp;L</th>
            </tr>
          </thead>
          <tbody>${userRows || `<tr><td colspan="11">No users found.</td></tr>`}</tbody>
        </table>
        <h2>Portfolio Holdings</h2>
        <table>
          <thead>
            <tr>
              <th>Full Name</th>
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
  hidePortalMounts();
  hideAuthLoading();
  window.scrollTo({ top: 0, behavior: "smooth" });
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

  if (searchInput) {
    searchInput.value = adminUiState.search;
    searchInput.addEventListener("input", async () => {
      adminUiState.search = searchInput.value.trim();
      await renderAdminPortal();
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

  document.querySelectorAll("[data-admin-sell-holding]").forEach((button) => {
    button.addEventListener("click", async () => {
      const holdingId = button.dataset.adminSellHolding;
      const symbol = button.dataset.symbol || "this stock";
      const owner = button.dataset.owner || "this customer";
      const availableQuantity = Number(button.dataset.quantity || 0);
      const averageBuyPrice = Number(button.dataset.buyPrice || 0);
      const quantityInput = window.prompt(
        `Enter quantity to sell for ${symbol} (${owner}). Available quantity: ${availableQuantity}`,
        String(availableQuantity)
      );
      if (quantityInput === null) return;

      const sellQuantity = Number(quantityInput);
      if (!Number.isFinite(sellQuantity) || sellQuantity <= 0) {
        if (statusMessage) statusMessage.textContent = "Enter a valid quantity to sell.";
        return;
      }
      if (sellQuantity > availableQuantity) {
        if (statusMessage) statusMessage.textContent = "Sell quantity cannot exceed the available holding quantity.";
        return;
      }

      const sellPriceInput = window.prompt(
        `Enter the sell price for ${symbol}. Average buy price: ${currency(averageBuyPrice)}`,
        averageBuyPrice ? averageBuyPrice.toFixed(2) : ""
      );
      if (sellPriceInput === null) return;

      const sellPrice = Number(sellPriceInput);
      if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
        if (statusMessage) statusMessage.textContent = "Enter a valid sell price.";
        return;
      }

      const stopLoading = setButtonLoading(button, "Selling...");
      try {
        const sale = await api(`/admin/holdings/${holdingId}/sell`, {
          method: "POST",
          body: JSON.stringify({
            quantity: sellQuantity,
            sell_price: sellPrice
          })
        });
        if (statusMessage) {
          statusMessage.textContent = `${symbol} sale saved for ${owner}. Realised P/L: ${currency(sale?.profit_loss || 0)}.`;
        }
        await renderAdminPortal();
      } catch (error) {
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
        password: String(data.get("password") || "")
      };

      if (!payload.full_name || !payload.email || !payload.phone_number || !payload.password) {
        throw new Error("Complete all customer fields before creating the account.");
      }

      await api("/auth/signup", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      const users = await api("/admin/users");
      const createdUser = (Array.isArray(users) ? users : []).find(
        (user) =>
          String(user.phone_number || "") === payload.phone_number ||
          String(user.email || "").toLowerCase() === payload.email.toLowerCase()
      );

      if (status) {
        status.textContent = createdUser?.fixed_user_id
          ? `Customer created successfully. Client ID: ${createdUser.fixed_user_id}`
          : "Customer created successfully.";
      }
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
  let searchTimer = null;
  let requestToken = 0;
  let quoteToken = 0;

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
    } catch {
      if (activeToken !== quoteToken) return;
      setLivePricePreview({
        state: "error",
        title: "Live market price",
        price: "Unavailable",
        meta: companyName || symbol,
        exchange: exchange || "NSE"
      });
    }
  };

  const applySuggestion = (result) => {
    if (!symbolInput || !exchangeInput) return;
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
      button.addEventListener("click", () => {
        applySuggestion({
          symbol: button.dataset.symbolPick || "",
          exchange: button.dataset.exchangePick || "NSE",
        });
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

  if (symbolInput) {
    symbolInput.addEventListener("input", () => {
      if (selectedExchangeInput) selectedExchangeInput.value = "";
      if (searchTimer) window.clearTimeout(searchTimer);
      searchTimer = window.setTimeout(runSearch, 220);
    });
    symbolInput.addEventListener("focus", () => {
      void runSearch();
    });
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

  document.addEventListener("click", (event) => {
    if (!form.contains(event.target)) {
      clearSuggestions();
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const stopLoading = setButtonLoading(submitButton, "Adding...");
    try {
      const data = new FormData(form);
      const userId = String(data.get("customer_id") || "").trim();
      const selectedExchange = String(data.get("selected_exchange") || "").trim().toUpperCase();
      const payload = {
        symbol: String(data.get("symbol") || "").trim().toUpperCase(),
        quantity: Number(data.get("quantity") || 0),
        buy_price: Number(data.get("buy_price") || 0),
        exchange: (selectedExchange || String(data.get("exchange") || "NSE")).trim().toUpperCase()
      };
      if (!userId || !payload.symbol || !payload.quantity || !payload.buy_price) {
        throw new Error("Complete all deal fields before adding the position.");
      }
      if (!["NSE", "BSE"].includes(payload.exchange)) {
        throw new Error("Choose a valid NSE or BSE stock from the live search suggestions before adding the deal.");
      }
      await api(`/admin/users/${userId}/holdings`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (status) status.textContent = `${payload.symbol} was added successfully.`;
      form.reset();
      await refreshAdminCurrentPage();
    } catch (error) {
      if (status) status.textContent = formatError(error);
    } finally {
      stopLoading();
    }
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
  syncWidths();
}

function buildAdminActionToolbar(selectedValue = "") {
  return `
    <header class="user-topbar admin-compact-topbar">
      <div class="admin-toolbar-left admin-toolbar-left--compact">
        <div class="brand admin-dashboard-brand admin-dashboard-brand--compact">
          <span class="brand-mark brand-logo brand-logo-lg"><img src="./assets/assetyantra-logo.svg" alt="AssetYantra logo" /></span>
          <span class="public-brand-copy">
            <strong class="brand-wordmark">AssetYantra</strong>
            <small class="brand-tagline">${selectedValue === "customer" ? "Add Customer" : "Add Deal"}</small>
          </span>
        </div>
      </div>
      <div class="user-topbar-actions admin-toolbar-right">
        <details class="admin-dropdown-menu" ${adminUiState.actionsMenuOpen ? "open" : ""}>
          <summary class="secondary-btn compact-btn">Admin Actions</summary>
          <div class="admin-dropdown-panel">
            <p class="admin-dropdown-section-label">Quick Actions</p>
            <div class="admin-dropdown-links">
              <a class="secondary-btn compact-btn" href="./admin-add-customer.html"><strong>Add Customer</strong><small>Open the dedicated registration page</small></a>
              <a class="secondary-btn compact-btn" href="./admin-add-deal.html"><strong>Add Deal</strong><small>Open the separate deal entry page</small></a>
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
  revealPortal(mount);

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
          <button class="primary-btn" type="submit">Create Customer</button>
        </form>
        <p class="helper-text" id="adminCustomerStatus">Client ID will be generated after the customer account is created.</p>
      </article>
    </section>
  `;

  revealPortal(mount);
  activeRole = "admin";
  activeUserId = null;
  setupPortalActions();
  await setupAdminCustomerForm();
}

async function renderAdminDealPage() {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  revealPortal(mount);

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
                .map((user) => `<option value="${user.user_id}">${escapeHtml(user.full_name)} (${escapeHtml(user.fixed_user_id || user.username || "")})</option>`)
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
          <label>
            <span>Search Market</span>
            <select name="exchange">
              <option value="ALL">All NSE / BSE</option>
              <option value="NSE">NSE</option>
              <option value="BSE">BSE</option>
            </select>
          </label>
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

  revealPortal(mount);
  activeRole = "admin";
  activeUserId = null;
  setupPortalActions();
  await setupAdminDealForm();
}

async function renderAdminDatabasePage(options = {}) {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  if (adminRenderInFlight) return;
  adminRenderInFlight = true;
  const { silent = false } = options;

  try {
    const users = await api("/admin/users");
    const safeUsers = Array.isArray(users) ? users : [];
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
                <span class="brand-mark brand-logo brand-logo-lg"><img src="./assets/assetyantra-logo.svg" alt="AssetYantra logo" /></span>
                <span class="public-brand-copy">
                  <strong class="brand-wordmark">AssetYantra</strong>
                  <small class="brand-tagline">Database View</small>
                </span>
              </div>
            </div>
            <div class="user-topbar-actions admin-toolbar-right admin-database-toolbar-right">
              <a class="secondary-btn compact-btn" href="./admin-dashboard.html">Back to Dashboard</a>
              <button class="secondary-btn compact-btn" type="button" id="adminDatabaseExportBtn">Download Excel</button>
              <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
            </div>
          </header>

          <article class="table-card admin-database-card full-span-card">
            <div class="panel-head">
              <div>
                <h3>User Credentials &amp; Portfolio Database</h3>
                <p class="helper-text admin-positions-helper">Simple database view of user records and portfolio rows. Passwords are excluded. Refreshes every 10 seconds.</p>
              </div>
              <span class="badge green">${safeUsers.length} Users / ${totalHoldings} Holdings</span>
            </div>
            <div class="admin-database-statline">
              <span><strong>${safeUsers.length}</strong> Users</span>
              <span><strong>${safeUsers.filter((user) => user.is_active).length}</strong> Active</span>
              <span><strong>${totalHoldings}</strong> Holdings</span>
              <span><strong>${currency(totalPortfolioValue)}</strong> Portfolio Value</span>
              <span class="${totalProfitLoss >= 0 ? "profit" : "loss"}"><strong>${currency(totalProfitLoss)}</strong> Total P&amp;L</span>
            </div>

            <div class="table-wrap admin-position-table-wrap admin-database-table-wrap" id="adminDatabaseUsersWrap">
              <table class="admin-position-table admin-database-table" id="adminDatabaseUsersTable">
                <thead>
                  <tr>
                    <th>Full Name</th>
                    <th>Client ID</th>
                    <th>Username / Email</th>
                    <th>Phone Number</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Mode</th>
                    <th>Created At</th>
                    <th>Portfolio Value</th>
                    <th>Total Holdings</th>
                    <th>Total P&amp;L</th>
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
                              <td><strong>${escapeHtml(user.full_name || "Unknown User")}</strong></td>
                              <td>${escapeHtml(user.fixed_user_id || "")}</td>
                              <td>${escapeHtml(user.username || "")}</td>
                              <td>${escapeHtml(user.phone_number || "")}</td>
                              <td><span class="badge ${user.is_active ? "green" : "red"}">${user.is_active ? "Active" : "Inactive"}</span></td>
                              <td>${escapeHtml((user.role || "user").toUpperCase())}</td>
                              <td>${user.is_demo ? "Demo" : "Live"}</td>
                              <td>${formatDateTime(user.created_at)}</td>
                              <td>${currency(dashboard?.total_portfolio_value ?? user.portfolio_value ?? 0)}</td>
                              <td>${dashboard?.total_holdings ?? user.total_holdings ?? 0}</td>
                              <td class="${Number(dashboard?.total_profit_loss || 0) >= 0 ? "profit" : "loss"}">${currency(dashboard?.total_profit_loss || 0)}</td>
                            </tr>
                          `;
                        })
                        .join("")
                    : `<tr><td colspan="11"><span class="helper-text">No users found in the database.</span></td></tr>`}
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
                    <th>Full Name</th>
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
                              <td>${escapeHtml(holding.full_name || "Unknown User")}</td>
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
          </article>
        </div>
      </section>
    `;

    if (!silent) {
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
  } catch (error) {
    renderPortalError(mount, "Database View", `The database view could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) {
      retry.addEventListener("click", () => renderAdminDatabasePage());
    }
  } finally {
    adminRenderInFlight = false;
  }
}

function buildAdminClientDetail(user, soldHistory = [], focusSymbol = "") {
  const userSoldHistory = soldHistory.filter((entry) => Number(entry.user_id) === Number(user.user_id));
  return `
    <article class="dashboard-card detail-card">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Client Detail</p>
          <h3>${user.full_name}</h3>
          <p class="detail-subtitle">${user.fixed_user_id || user.username}</p>
        </div>
        <span class="badge ${user.total_profit_loss >= 0 ? "green" : "red"}">${currency(user.total_profit_loss)}</span>
      </div>
      <div class="detail-stat-grid">
        <article><strong>${escapeHtml(user.phone_number || "No phone")}</strong><span>Phone Number</span></article>
        <article><strong>${escapeHtml(user.username || "No username")}</strong><span>Username / Email</span></article>
        <article><strong>${user.is_active ? "Active" : "Inactive"}</strong><span>Account Status</span></article>
      </div>
      <div class="detail-stat-grid">
        <article><strong>${user.total_holdings}</strong><span>Live Stocks</span></article>
        <article><strong>${currency(user.total_portfolio_value)}</strong><span>Current Value</span></article>
        <article><strong class="${user.total_profit_loss >= 0 ? "profit" : "loss"}">${percent((user.total_profit_loss / Math.max(user.total_portfolio_value - user.total_profit_loss, 1)) * 100)}</strong><span>Total Return</span></article>
      </div>
      <div class="dashboard-grid detail-grid">
        <article class="table-card">
          <div class="panel-head"><h3>Live Stock View</h3><span class="badge">Realtime</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Stock</th><th>Purchase Date</th><th>Qty</th><th>Avg Price</th><th>Live Price</th><th>P&amp;L</th></tr></thead>
              <tbody>
                ${user.holdings.map((holding) => `
                  <tr ${focusSymbol && String(holding.symbol || "").toUpperCase() === String(focusSymbol || "").toUpperCase() ? 'class="admin-detail-highlight-row"' : ""}>
                    <td>${isAdminStockRevealed(holding.symbol) ? holding.symbol : maskStockSymbol(holding.symbol)}<br /><small>${holding.sector || "Tracked holding"}</small></td>
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
        <article class="table-card">
          <div class="panel-head"><h3>Sold History</h3><span class="badge ${userSoldHistory.length ? "green" : ""}">${userSoldHistory.length} Record(s)</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Purchase Date</th><th>Sold Date</th><th>Stock</th><th>Qty</th><th>Avg Price</th><th>Sell Price</th><th>Realised P&amp;L</th><th>P&amp;L %</th></tr></thead>
              <tbody>
                ${userSoldHistory.length
                  ? userSoldHistory.map((entry) => `
                    <tr>
                      <td>${formatDate(entry.created_at)}</td>
                      <td>${formatDateTime(entry.sold_at)}</td>
                      <td>${isAdminStockRevealed(entry.symbol) ? escapeHtml(entry.symbol) : maskStockSymbol(entry.symbol)}</td>
                      <td>${entry.quantity}</td>
                      <td>${currency(entry.buy_price)}</td>
                      <td>${currency(entry.sell_price)}</td>
                      <td class="${Number(entry.profit_loss) >= 0 ? "profit" : "loss"}">${currency(entry.profit_loss)}</td>
                      <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${percent((((Number(entry.sell_price) - Number(entry.buy_price)) / Math.max(Number(entry.buy_price), 1)) * 100))}</td>
                    </tr>
                  `).join("")
                  : `<tr><td colspan="8"><span class="helper-text">No sold history for this client yet.</span></td></tr>`}
              </tbody>
            </table>
          </div>
        </article>
      </div>
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
          <p class="eyebrow">Stock Detail</p>
          <h3>${symbol}</h3>
          <p class="detail-subtitle">Clients currently holding this stock</p>
        </div>
        <span class="badge">${holdings.length} Holders</span>
      </div>
      <div class="detail-stat-grid">
        <article><strong>${holdings.length}</strong><span>Total Clients</span></article>
        <article><strong>${totalQty}</strong><span>Total Quantity</span></article>
        <article><strong class="${totalPnl >= 0 ? "profit" : "loss"}">${currency(totalPnl)}</strong><span>Combined P&amp;L</span></article>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Customer</th><th>Client ID</th><th>Purchase Date</th><th>Qty</th><th>Avg Price</th><th>Live Price</th><th>P&amp;L</th></tr></thead>
          <tbody>
            ${holdings.map((holding) => `
              <tr>
                <td>${holding.owner}</td>
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

function setupAdminDrilldowns(userDashboards, allHoldings, soldHistory = []) {
  const detailMount = document.getElementById("adminDetailMount");
  if (!detailMount) return;

  document.querySelectorAll("[data-user-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = Number(button.dataset.userDetail);
      const user = userDashboards.find((entry) => Number(entry.user_id) === userId);
      if (!user) return;
      detailMount.innerHTML = buildAdminClientDetail(user, soldHistory);
      detailMount.classList.remove("hidden");
      detailMount.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-stock-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const symbol = String(button.dataset.stockDetail || "").toUpperCase();
      const userId = Number(button.dataset.stockUserId || 0);
      const user = userDashboards.find((entry) => Number(entry.user_id) === userId);
      if (user) {
        detailMount.innerHTML = buildAdminClientDetail(user, soldHistory, symbol);
      } else {
        const holdings = allHoldings.filter((entry) => entry.symbol === symbol);
        if (!holdings.length) return;
        detailMount.innerHTML = buildAdminStockDetail(symbol, holdings);
      }
      detailMount.classList.remove("hidden");
      detailMount.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
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
    const symbols = [...new Set(baseHoldings.map((holding) => holding.symbol))];
    const feed = symbols.length
      ? await api(`/stocks/feed?symbols=${encodeURIComponent(symbols.join(","))}`).catch(() => [])
      : [];
    const safeFeed = Array.isArray(feed) ? feed : [];
    const quoteMap = new Map(safeFeed.map((quote) => [quote.symbol, quote]));
    const allHoldings = baseHoldings.map((holding) => {
      const quote = quoteMap.get(holding.symbol);
      const currentPrice = Number(quote?.price ?? holding.current_price ?? holding.buy_price);
      const changePercent = Number(quote?.change_percent ?? 0);
      const previousClose = changePercent === -100 ? currentPrice : currentPrice / (1 + changePercent / 100 || 1);
      const todayProfit = (currentPrice - previousClose) * Number(holding.quantity || 0);
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
      <article class="metric-card"><strong>${dashboard?.total_users ?? safeUsers.length}</strong><span>Clients</span><small>Persisted registered users</small></article>
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
          <h3>All Client Positions</h3>
          <div class="table-actions">
            <span class="badge">Admin View</span>
          </div>
        </div>
        <div class="admin-filter-bar">
          <select class="user-search admin-filter-select" id="adminClientFilter">
            <option value="">All Clients</option>
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
        <div class="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Stock</th><th>Purchase Date</th><th>Qty</th><th>Avg Price</th><th>Invested Value</th><th>Live Price</th><th>Current Value</th><th>Unrealised P&amp;L</th><th>Action</th></tr></thead>
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
                      <td><button class="secondary-btn compact-btn" type="button" data-admin-sell-holding="${holding.holding_id}" data-symbol="${holding.symbol}" data-owner="${holding.owner}" data-quantity="${holding.quantity}" data-buy-price="${holding.buy_price}">Sell</button></td>
                    </tr>
                  `
                )
                .join("")
                : `<tr><td colspan="10"><span class="helper-text">No client or stock matched this search.</span></td></tr>`}
            </tbody>
            <tfoot>
              <tr class="admin-total-row">
                <td colspan="3"><strong>Totals</strong></td>
                <td><strong>${filteredTotalQuantity.toFixed(2)}</strong></td>
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
      </article>
      <article class="dashboard-card" id="adminClientOpsCard">
        <div class="panel-head"><h3>Client Downloads</h3><span class="badge green">Export</span></div>
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
        <div class="panel-head"><h3>Sold History</h3><span class="badge ${filteredSoldHistory.length ? "green" : ""}">${filteredSoldHistory.length} Records</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Stock</th><th>Purchase Date</th><th>Qty Sold</th><th>Avg Price</th><th>Sell Price</th><th>Realised P&amp;L</th><th>Sold At (IST)</th><th>Sold By</th></tr></thead>
            <tbody>
              ${filteredSoldHistory.length
                ? filteredSoldHistory
                    .map(
                      (entry) => `
                        <tr>
                          <td><strong>${escapeHtml(entry.full_name)}</strong><br /><small>${escapeHtml(entry.fixed_user_id || "")}</small></td>
                          <td>
                            <div class="admin-stock-cell">
                              <button class="admin-eye-btn" type="button" data-stock-visibility-toggle="${escapeHtml(entry.symbol)}" aria-label="${isAdminStockRevealed(entry.symbol) ? "Hide stock name" : "Show stock name"}">${isAdminStockRevealed(entry.symbol) ? "🙈" : "👁"}</button>
                              <span>${isAdminStockRevealed(entry.symbol) ? escapeHtml(entry.symbol) : maskStockSymbol(entry.symbol)}</span>
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
                : `<tr><td colspan="9"><span class="helper-text">No sold history for the selected filters yet.</span></td></tr>`}
            </tbody>
            <tfoot>
              <tr class="admin-total-row">
                <td colspan="3"><strong>Totals</strong></td>
                <td><strong>${filteredSoldQuantity.toFixed(2)}</strong></td>
                <td>—</td>
                <td>—</td>
                <td class="${filteredRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredRealizedProfit)}</strong></td>
                <td colspan="2">—</td>
              </tr>
            </tfoot>
          </table>
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
            <thead><tr><th></th><th>Client</th><th>Status</th><th>Joined</th><th>Value</th><th>Actions</th></tr></thead>
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
                        <small>${item.client_count} client(s) holding this stock</small>
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
  const { silent = false } = options;
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
    const symbols = [...new Set(baseHoldings.map((holding) => holding.symbol).filter(Boolean))];
    const feed = symbols.length
      ? await api(`/stocks/feed?symbols=${encodeURIComponent(symbols.join(","))}`).catch(() => [])
      : [];
    const safeFeed = Array.isArray(feed) ? feed : [];
    const quoteMap = new Map(safeFeed.map((quote) => [quote.symbol, quote]));
    const allHoldings = baseHoldings.map((holding) => {
      const quote = quoteMap.get(holding.symbol);
      const currentPrice = Number(quote?.price ?? holding.current_price ?? holding.buy_price);
      const changePercent = Number(quote?.change_percent ?? 0);
      const previousClose = changePercent === -100 ? currentPrice : currentPrice / (1 + changePercent / 100 || 1);
      const todayProfit = (currentPrice - previousClose) * Number(holding.quantity || 0);
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
    const filteredTotalProfit = filteredTodayProfit + filteredRealizedProfit;
    const filteredTotalQuantity = filteredHoldings.reduce((sum, holding) => sum + Number(holding.quantity || 0), 0);
    const filteredSoldQuantity = filteredSoldHistory.reduce((sum, entry) => sum + Number(entry.quantity || 0), 0);
    const availableStockOptions = [
      ...new Set(
        [...allHoldings.map((holding) => String(holding.symbol || "").toUpperCase()), ...safeSoldHistory.map((entry) => String(entry.symbol || "").toUpperCase())].filter(Boolean)
      )
    ].sort();
    const realizedMap = safeSoldHistory.reduce((map, entry) => {
      const key = `${entry.user_id}::${String(entry.symbol || "").toUpperCase()}`;
      map.set(key, (map.get(key) || 0) + Number(entry.profit_loss || 0));
      return map;
    }, new Map());

    mount.innerHTML = `
    <section class="user-shell admin-simple-shell no-sidebar-shell">
      <div class="user-shell-main admin-simple-main dashboard-stack admin-dashboard-stack">
        <header class="user-topbar admin-compact-topbar admin-simple-topbar">
          <div class="admin-toolbar-left">
            <div class="brand admin-dashboard-brand">
              <span class="brand-mark brand-logo brand-logo-lg"><img src="./assets/assetyantra-logo.svg" alt="AssetYantra logo" /></span>
              <span class="public-brand-copy">
                <strong class="brand-wordmark">AssetYantra</strong>
                <small class="brand-tagline">Admin Portfolio Dashboard</small>
              </span>
            </div>
          </div>
          <div class="user-topbar-actions admin-toolbar-right">
            <input class="user-search admin-universal-search" id="adminUniversalSearch" type="text" placeholder="Search user, client ID, or stock" />
            <details class="admin-dropdown-menu" ${adminUiState.actionsMenuOpen ? "open" : ""}>
              <summary class="secondary-btn compact-btn">Actions & Filters</summary>
              <div class="admin-dropdown-panel">
                <p class="admin-dropdown-section-label">Quick Actions</p>
                <div class="admin-dropdown-links">
                  <a class="secondary-btn compact-btn" href="./admin-add-customer.html"><strong>Add Customer</strong><small>Open the dedicated registration page</small></a>
                  <a class="secondary-btn compact-btn" href="./admin-add-deal.html"><strong>Add Deal</strong><small>Open the separate deal entry page</small></a>
                </div>
                <p class="admin-dropdown-section-label">Filters</p>
                <div class="admin-dropdown-filters">
                  <label class="toolbar-field">
                    <span>Client</span>
                    <select class="user-search admin-filter-select" id="adminClientFilter">
                      <option value="">All Clients</option>
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
                <p class="helper-text admin-filter-summary">Filtered P&amp;L window: <strong class="${filteredPeriodProfit >= 0 ? "profit" : "loss"}">${currency(filteredPeriodProfit)}</strong></p>
              </div>
            </details>
            <a class="secondary-btn compact-btn" href="./admin-database.html">View Database</a>
            <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
          </div>
        </header>

        <section class="simple-summary-strip admin-summary-strip">
          <span><strong>${currency(filteredInvestedValue)}</strong> Invested Value</span>
          <span><strong>${currency(filteredCurrentValue)}</strong> Current Value</span>
          <span class="${filteredUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredUnrealizedProfit)}</strong> Unrealised P&amp;L</span>
          <span class="${filteredTodayProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredTodayProfit)}</strong> Today&apos;s P&amp;L</span>
          <span class="${filteredRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredRealizedProfit)}</strong> Realised P&amp;L</span>
        </section>

        <article class="table-card admin-positions-card full-span-card">
          <div class="panel-head">
            <div>
              <h3>All Client Positions</h3>
              <p class="helper-text admin-positions-helper">Filters are available from the dropdown above. Stock names remain masked until you reveal them.</p>
            </div>
            <span class="badge">Protected View</span>
          </div>
          <div class="table-wrap admin-position-table-wrap" id="adminPositionsTableWrap">
            <table class="admin-position-table" id="adminPositionsTable">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Symbol</th>
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
                          <td class="${valueClass}">${currency(investedValue)}</td>
                          <td class="${valueClass}">${currency(currentValue)}</td>
                          <td class="${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}<br /><small>${percent(holding.percent_change)}</small></td>
                          <td class="${Number(holding.today_profit) >= 0 ? "profit" : "loss"}">${currency(holding.today_profit)}</td>
                          <td class="${Number(realizedProfit) >= 0 ? "profit" : "loss"}">${currency(realizedProfit)}</td>
                          <td class="${Number(totalProfit) >= 0 ? "profit" : "loss"}">${currency(totalProfit)}</td>
                          <td><button class="sell-action-btn" type="button" data-admin-sell-holding="${holding.holding_id}" data-symbol="${holding.symbol}" data-owner="${holding.owner}" data-quantity="${holding.quantity}" data-buy-price="${holding.buy_price}">Sell</button></td>
                        </tr>
                      `;
                      })
                      .join("")
                  : `<tr><td colspan="12"><span class="helper-text">No client or stock matched this search.</span></td></tr>`}
              </tbody>
              <tfoot>
                <tr class="admin-total-row">
                  <td colspan="3"><strong>Totals</strong></td>
                  <td><strong>${filteredTotalQuantity.toFixed(2)}</strong></td>
                  <td>—</td>
                  <td class="${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}"><strong>${currency(filteredInvestedValue)}</strong></td>
                  <td class="${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}"><strong>${currency(filteredCurrentValue)}</strong></td>
                  <td class="${filteredUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredUnrealizedProfit)}</strong></td>
                  <td class="${filteredTodayProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredTodayProfit)}</strong></td>
                  <td class="${filteredRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredRealizedProfit)}</strong></td>
                  <td class="${filteredTotalProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredTotalProfit)}</strong></td>
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
          <div class="panel-head"><h3>Sold History</h3><span class="badge ${filteredSoldHistory.length ? "green" : ""}">${filteredSoldHistory.length} Records</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>User</th><th>Stock</th><th>Purchase Date</th><th>Qty Sold</th><th>Avg Price</th><th>Sell Price</th><th>Realised P&amp;L</th><th>P&amp;L %</th><th>Sold At (IST)</th><th>Sold By</th></tr></thead>
              <tbody>
                ${filteredSoldHistory.length
                  ? filteredSoldHistory
                      .map(
                        (entry) => `
                          <tr>
                            <td><strong>${escapeHtml(entry.full_name)}</strong><br /><small>${escapeHtml(entry.fixed_user_id || "")}</small></td>
                            <td>
                              <div class="admin-stock-cell">
                                <button class="admin-eye-btn ${isAdminStockRevealed(entry.symbol) ? "is-active" : ""}" type="button" data-stock-visibility-toggle="${escapeHtml(String(entry.symbol || "").toUpperCase())}" aria-label="${isAdminStockRevealed(entry.symbol) ? "Hide stock name" : "Show stock name"}">&#128065;</button>
                                <span data-stock-label="${escapeHtml(String(entry.symbol || "").toUpperCase())}">${isAdminStockRevealed(entry.symbol) ? escapeHtml(entry.symbol) : maskStockSymbol(entry.symbol)}</span>
                              </div>
                            </td>
                            <td>${formatDate(entry.created_at)}</td>
                            <td>${entry.quantity}</td>
                            <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${currency(entry.buy_price)}</td>
                            <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${currency(entry.sell_price)}</td>
                            <td class="${Number(entry.profit_loss) >= 0 ? "profit" : "loss"}">${currency(entry.profit_loss)}</td>
                            <td class="${Number(entry.sell_price) >= Number(entry.buy_price) ? "profit" : "loss"}">${percent((((Number(entry.sell_price) - Number(entry.buy_price)) / Math.max(Number(entry.buy_price), 1)) * 100))}</td>
                            <td>${formatDateTime(entry.sold_at)}</td>
                            <td><small>${escapeHtml(entry.sold_by_identifier || entry.sold_by_role || "System")}</small></td>
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="10"><span class="helper-text">No sold history for the selected filters yet.</span></td></tr>`}
              </tbody>
              <tfoot>
                <tr class="admin-total-row">
                  <td colspan="3"><strong>Totals</strong></td>
                  <td><strong>${filteredSoldQuantity.toFixed(2)}</strong></td>
                  <td>—</td>
                  <td>—</td>
                  <td class="${filteredRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(filteredRealizedProfit)}</strong></td>
                  <td colspan="2">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </article>

        <section id="adminDetailMount" class="dashboard-section hidden"></section>
      </div>
    </section>
  `;

    if (!silent) {
      revealPortal(mount);
    } else {
      mount.classList.remove("hidden");
    }
    activeRole = "admin";
    activeUserId = null;
    startAdminRefresh();
    setupDownloadButtons(userDashboards);
    setupAdminManagementButtons();
    setupAdminDrilldowns(userDashboards, allHoldings);
    setupScrollSync("adminPositionsTableWrap", "adminPositionsTableScroller");
    setupPortalActions();
  } catch (error) {
    renderPortalError(mount, "Admin Dashboard", `Login succeeded, but admin dashboard data could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) {
      retry.addEventListener("click", () => renderAdminPortal());
    }
  } finally {
    adminRenderInFlight = false;
  }
}

async function renderUserPortal(options = {}) {
  const mount = document.getElementById("userPortal");
  if (!mount) return;
  if (userRenderInFlight) return;
  userRenderInFlight = true;
  const { showLoading = false, silent = false, loadingTitle, loadingText } = options;
  if (!silent) {
    revealPortal(mount);
  }
  if (showLoading) {
    showDashboardLoading(loadingTitle, loadingText);
  }
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
      const quantity = Number(holding.quantity || 0);
      const currentPrice = Number(holding.current_price ?? holding.buy_price ?? 0);
      const todayProfit = Number(holding.today_profit ?? 0);
      const realizedProfit = Number(realizedMap.get(symbolKey) || 0);
      return {
        ...holding,
        current_price: currentPrice,
        today_profit: todayProfit,
        realized_profit: realizedProfit,
        total_profit: Number(holding.profit_loss || 0) + realizedProfit
      };
    });
    const filteredPerformance = getFilteredUserPerformance(performance);
    const profitableCount = performance.filter((holding) => Number(holding.profit_loss || 0) > 0).length;
    const filteredSoldHistory = safeSoldHistory.filter((entry) => {
      const search = userUiState.search.trim().toLowerCase();
      if (!search) return true;
      return String(entry.symbol || "").toLowerCase().includes(search) || String(entry.exchange || "").toLowerCase().includes(search);
    });
    const totalVisibleValue = filteredPerformance.reduce((sum, holding) => sum + Number(holding.current_price || holding.value || 0) * Number(holding.quantity || 0), 0);
    const gainRate = performance.length ? (profitableCount / performance.length) * 100 : 0;
    const totalTodayProfit = filteredPerformance.reduce((sum, holding) => sum + Number(holding.today_profit || 0), 0);
    const totalRealizedProfit = filteredPerformance.reduce((sum, holding) => sum + Number(holding.realized_profit || 0), 0);
    const totalCombinedProfit = filteredPerformance.reduce((sum, holding) => sum + Number(holding.total_profit || 0), 0);
    const totalUnrealizedProfit = filteredPerformance.reduce((sum, holding) => sum + Number(holding.profit_loss || 0), 0);
    const filteredTotalQuantity = filteredPerformance.reduce((sum, holding) => sum + Number(holding.quantity || 0), 0);
    const filteredInvestedValue = filteredPerformance.reduce((sum, holding) => sum + Number(holding.buy_price || 0) * Number(holding.quantity || 0), 0);
    const filteredCurrentValue = filteredPerformance.reduce((sum, holding) => sum + Number(holding.current_price || 0) * Number(holding.quantity || 0), 0);

    mount.innerHTML = `
    <section class="user-shell no-sidebar-shell user-clean-shell">
      <div class="user-shell-main user-dashboard-stack">
        <header class="user-topbar user-clean-topbar">
          <div>
            <p class="eyebrow">Investor Portfolio</p>
            <h2>${profile.full_name}</h2>
            <p class="helper-text">Client ID: ${escapeHtml(profile.fixed_user_id || profile.username || "Not assigned")}</p>
          </div>
          <div class="user-topbar-actions">
            <select class="user-search user-holdings-filter" id="userPortfolioStatusFilter">
              <option value="all">All Holdings</option>
              <option value="profit">In profit</option>
              <option value="loss">In loss</option>
              <option value="flat">Flat</option>
            </select>
            <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
          </div>
        </header>

        <section class="simple-summary-strip user-summary-strip">
          <span class="${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}"><strong>${currency(filteredCurrentValue)}</strong> Portfolio Value</span>
          <span class="${totalUnrealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalUnrealizedProfit)}</strong> Unrealised P&amp;L</span>
          <span class="${totalRealizedProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalRealizedProfit)}</strong> Lifetime Realised P&amp;L</span>
          <span class="${totalTodayProfit >= 0 ? "profit" : "loss"}"><strong>${currency(totalTodayProfit)}</strong> Today&apos;s P&amp;L</span>
        </section>

        <article class="table-card full-span-card user-holdings-card">
          <div class="panel-head">
            <div>
              <h3>Portfolio Holdings</h3>
            </div>
            <span class="badge green">Live Portfolio</span>
          </div>
          <div class="table-wrap admin-position-table-wrap" id="userPositionsTableWrap">
            <table class="admin-position-table user-position-table" id="userPositionsTable">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Purchase Date</th>
                  <th>Qty</th>
                  <th>Avg Price</th>
                  <th>Invested Value</th>
                  <th>Current Value</th>
                  <th>Unrealised P&amp;L</th>
                  <th>Today&apos;s P&amp;L</th>
                  <th>Realised P&amp;L</th>
                  <th>Total P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                ${filteredPerformance.length
                  ? filteredPerformance
                      .map(
                        (holding) => {
                          const investedValue = Number(holding.buy_price || 0) * Number(holding.quantity || 0);
                          const currentValue = Number(holding.current_price || 0) * Number(holding.quantity || 0);
                          const valueStateClass = currentValue >= investedValue ? "profit" : "loss";
                          return `
                          <tr>
                            <td><strong>${escapeHtml(holding.symbol)}</strong></td>
                            <td>${formatDate(holding.created_at)}</td>
                            <td>${Number(holding.quantity || 0).toFixed(2)}</td>
                            <td>${currency(holding.buy_price)}</td>
                            <td class="${valueStateClass} user-invested-cell">${currency(investedValue)}</td>
                            <td class="${valueStateClass} user-current-cell">${currency(currentValue)}</td>
                            <td class="${Number(holding.profit_loss) >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}<br /><small>${percent(holding.percent_change)}</small></td>
                            <td class="${Number(holding.today_profit) >= 0 ? "profit" : "loss"}">${currency(holding.today_profit)}</td>
                            <td class="${Number(holding.realized_profit) >= 0 ? "profit" : "loss"}">${currency(holding.realized_profit)}</td>
                            <td class="${Number(holding.total_profit) >= 0 ? "profit" : "loss"}">${currency(holding.total_profit)}</td>
                          </tr>
                        `;
                        }
                      )
                      .join("")
                  : `<tr><td colspan="10"><span class="helper-text">${performance.length ? "No holdings match the active filters." : "No portfolio holdings are available yet."}</span></td></tr>`}
              </tbody>
              <tfoot>
                <tr class="admin-total-row">
                  <td colspan="2"><strong>Totals</strong></td>
                  <td><strong>${filteredTotalQuantity.toFixed(2)}</strong></td>
                  <td>—</td>
                  <td><strong>${currency(filteredInvestedValue)}</strong></td>
                  <td class="${filteredCurrentValue >= filteredInvestedValue ? "profit" : "loss"}"><strong>${currency(filteredCurrentValue)}</strong></td>
                  <td class="${filteredPerformance.reduce((sum, holding) => sum + Number(holding.profit_loss || 0), 0) >= 0 ? "profit" : "loss"}"><strong>${currency(filteredPerformance.reduce((sum, holding) => sum + Number(holding.profit_loss || 0), 0))}</strong></td>
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
                  <th>Stock Name</th>
                  <th>Date of Purchase</th>
                  <th>Date of Profit</th>
                  <th>P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                ${filteredSoldHistory.length
                  ? filteredSoldHistory
                      .map(
                        (entry) => `
                          <tr>
                            <td><strong>${escapeHtml(entry.symbol)}</strong></td>
                            <td>${formatDate(entry.created_at)}</td>
                            <td>${formatDateTime(entry.sold_at)}</td>
                            <td class="${Number(entry.profit_loss) >= 0 ? "profit" : "loss"}">${currency(entry.profit_loss)}</td>
                          </tr>
                        `
                      )
                      .join("")
                  : `<tr><td colspan="4"><span class="helper-text">No realised profit or loss entries are available yet.</span></td></tr>`}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  `;

    revealPortal(mount);
    activeRole = "user";
    activeUserId = profile.id;
    setupUserPortfolioFilters();
    setupScrollSync("userPositionsTableWrap", "userPositionsTableScroller");
    setupPortalActions();
  } catch (error) {
    renderPortalError(mount, "User Dashboard", `Login succeeded, but portfolio data could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) {
      retry.addEventListener("click", () => renderUserPortal());
    }
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
  const userForm = document.getElementById("userForm");
  const registerForm = document.getElementById("registerForm");
  if (!adminForm || !userForm) return;

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

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const role = toggle.dataset.roleTab;
      toggles.forEach((entry) => entry.classList.toggle("active", entry === toggle));
      adminForm.classList.toggle("hidden", role !== "admin");
      userForm.classList.toggle("hidden", role !== "user");
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
          document.getElementById("adminOtpHint").textContent = response.otp_preview ? `Testing OTP: ${response.otp_preview}` : response.message;
          document.getElementById("adminError").textContent = "";
        } else {
          if (!hasRequiredFields(userForm, ["password", "phone"])) {
            document.getElementById("userError").textContent = "Fill password and phone number before requesting verification code. Client ID is optional.";
            return;
          }
          hidePortalMounts();
          const payload = {
            role: "user",
            identifier: String(userForm.querySelector('[name="userId"]').value || "").trim().toUpperCase(),
            password: String(userForm.querySelector('[name="password"]').value),
            phone_number: String(userForm.querySelector('[name="phone"]').value).trim()
          };
          const response = await api("/auth/request-otp", { method: "POST", body: JSON.stringify(payload) });
          document.getElementById("userOtpHint").textContent = response.otp_preview ? `Testing code: ${response.otp_preview}` : response.message;
          document.getElementById("userError").textContent = "";
        }
      } catch (error) {
        if (button.dataset.sendOtp === "admin") {
          document.getElementById("adminError").textContent = formatError(error);
        } else {
          document.getElementById("userError").textContent = formatError(error);
        }
      } finally {
        stopLoading();
      }
    });
  });

  adminForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = adminForm.querySelector('button[type="submit"]');
    const stopLoading = setButtonLoading(submitButton, "Opening Dashboard...");
    try {
      if (!hasRequiredFields(adminForm, ["username", "password", "phone", "otp"])) {
        document.getElementById("adminError").textContent = "Complete username, password, phone number, and OTP before opening the dashboard.";
        return;
      }
      const data = new FormData(adminForm);
      hidePortalMounts();
      showAuthLoading("Opening admin dashboard...", "Verifying credentials, loading client data, and preparing admin controls.");
      const response = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          role: "admin",
          identifier: String(data.get("username")).trim(),
          password: String(data.get("password")),
          phone_number: String(data.get("phone")).trim(),
          otp: String(data.get("otp")).trim()
        })
      });
      setAuth({ token: response.access_token, role: response.role });
      document.getElementById("adminError").textContent = "";
      hideAuthLoading();
      window.location.href = "./admin-dashboard.html";
    } catch (error) {
      document.getElementById("adminError").textContent = formatError(error);
      hidePortalMounts();
      hideAuthLoading();
    } finally {
      stopLoading();
    }
  });

  userForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = userForm.querySelector('button[type="submit"]');
    const stopLoading = setButtonLoading(submitButton, "Opening Dashboard...");
    try {
      if (!hasRequiredFields(userForm, ["password", "phone", "otp"])) {
        document.getElementById("userError").textContent = "Complete password, phone number, and verification code before opening the dashboard. Client ID is optional.";
        return;
      }
      const data = new FormData(userForm);
      hidePortalMounts();
      showAuthLoading("Opening user dashboard...", "Loading your holdings, returns, and portfolio summary.");
      const response = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          role: "user",
          identifier: String(data.get("userId") || "").trim().toUpperCase(),
          password: String(data.get("password")),
          phone_number: String(data.get("phone")).trim(),
          otp: String(data.get("otp")).trim()
        })
      });
      setAuth({ token: response.access_token, role: response.role });
      document.getElementById("userError").textContent = "";
      hideAuthLoading();
      window.location.href = "./user-dashboard.html";
    } catch (error) {
      document.getElementById("userError").textContent = formatError(error);
      hidePortalMounts();
      hideAuthLoading();
    } finally {
      stopLoading();
    }
  });

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

  if (isLoginPage()) {
    clearAuth();
    hidePortalMounts();
    hideAuthLoading();
  } else {
    const auth = getAuth();
    if (!auth?.token && (isAdminDashboardPage() || isAdminCustomerPage() || isAdminDealPage() || isAdminDatabasePage() || isUserDashboardPage())) {
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
    renderAdminPortal().catch(() => {
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
    renderUserPortal().catch(() => {
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
    renderAdminDatabasePage().catch(() => {
      renderPortalError(
        document.getElementById("adminPortal"),
        "Database View",
        "The database view could not load yet. Please check that the backend is running and try again."
      );
    });
  }

  if (isAdminCustomerPage() || isAdminDealPage()) {
    if (!auth?.token) {
      window.location.href = "./login.html";
      return;
    }
    if (auth.role !== "admin") {
      window.location.href = "./login.html";
      return;
    }
    if (isAdminCustomerPage()) {
      renderAdminCustomerPage().catch(() => {
        renderPortalError(
          document.getElementById("adminPortal"),
          "Add Customer",
          "The add customer page could not load yet. Please try again."
        );
      });
    }
    if (isAdminDealPage()) {
      renderAdminDealPage().catch(() => {
        renderPortalError(
          document.getElementById("adminPortal"),
          "Add Deal",
          "The add deal page could not load yet. Please try again."
        );
      });
    }
  }
}

function setupPublicPageVisibility() {
  document.querySelectorAll(".fade-up").forEach((node) => node.classList.add("in-view"));
}

function setupFloatingWhatsApp() {
  const publicPages = new Set(["home", "about", "products", "contact", "trust-safety", "legal"]);
  const page = document.body?.dataset?.page;
  const existing = document.querySelector(".floating-whatsapp");

  if (!publicPages.has(page)) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const anchor = document.createElement("a");
  anchor.className = "floating-whatsapp";
  anchor.href = "https://wa.me/919089080505";
  anchor.target = "_blank";
  anchor.rel = "noreferrer";
  anchor.setAttribute("aria-label", "Chat with AssetYantra on WhatsApp");
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
      <a class="footer-social-link" href="https://wa.me/919089080505" target="_blank" rel="noreferrer" aria-label="WhatsApp">
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
setupPublicPageVisibility();
setupFloatingWhatsApp();
setupFooterSocials();
setupHomePage();
setupLogin();
setupDashboardPages();
