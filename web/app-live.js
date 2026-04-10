const STORAGE_KEY = "stock_trader_auth";
const SITE_CONTROL_KEY = "stock_trader_site_controls";
const REVIEW_STORAGE_KEY = "stock_trader_reviews";
const USER_RECOMMENDATION_SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "LT", "ITC", "AXISBANK", "KOTAKBANK", "BHARTIARTL", "ASIANPAINT"];
let activeRole = null;
let activeUserId = null;
let liveTickerTimer = null;
let chatNudgeTimer = null;
let adminUiState = {
  search: "",
  status: "all"
};
let userUiState = {
  search: "",
  status: "all"
};
let siteControlsCache = {
  showFaqInsights: true,
  chatNudgesEnabled: true
};
let userDashboardCache = {
  performance: [],
  recommendationFeed: [],
  symbolCatalog: []
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
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

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

function goToDashboard(role) {
  const target = role === "admin" ? "./admin-dashboard.html" : "./user-dashboard.html";
  window.location.href = target;
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

function getSiteControls() {
  return siteControlsCache;
}

function saveSiteControls(nextControls) {
  localStorage.setItem(SITE_CONTROL_KEY, JSON.stringify(nextControls));
  siteControlsCache = { ...siteControlsCache, ...nextControls };
}

function getApiBase() {
  return localStorage.getItem("stock_trader_api_url") || "https://stock-trader-demo-backend.onrender.com/api/v1";
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

function normalizeSearchText(value) {
  return String(value || "").trim().toLowerCase();
}

function buildUserSymbolCatalog(performance = [], recommendationFeed = []) {
  const map = new Map();
  const pushCandidate = (symbol, label, sector, price) => {
    const safeSymbol = String(symbol || "").trim().toUpperCase();
    if (!safeSymbol || map.has(safeSymbol)) return;
    map.set(safeSymbol, {
      symbol: safeSymbol,
      label: label || safeSymbol,
      sector: sector || "Suggested",
      price: Number(price || 0)
    });
  };

  performance.forEach((holding) => {
    pushCandidate(
      holding.symbol,
      `${holding.symbol} · ${holding.sector || "Tracked holding"}`,
      holding.sector || "Tracked holding",
      holding.current_price || holding.buy_price
    );
  });
  recommendationFeed.forEach((quote) => {
    pushCandidate(
      quote.symbol,
      `${quote.symbol} · ${quote.short_name || "Suggested stock"}`,
      quote.short_name || "Suggested stock",
      quote.price
    );
  });
  USER_RECOMMENDATION_SYMBOLS.forEach((symbol) => {
    pushCandidate(symbol, `${symbol} · Suggested stock`, "Suggested stock", 0);
  });

  return [...map.values()];
}

function getClosestSymbolMatches(query, candidates, limit = 6) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return candidates.slice(0, limit);
  }

  return candidates
    .map((candidate) => {
      const symbol = normalizeSearchText(candidate.symbol);
      const label = normalizeSearchText(candidate.label);
      const sector = normalizeSearchText(candidate.sector);
      let score = 0;

      if (symbol === normalizedQuery) score += 120;
      if (symbol.startsWith(normalizedQuery)) score += 95;
      if (label.startsWith(normalizedQuery)) score += 80;
      if (symbol.includes(normalizedQuery)) score += 64 - symbol.indexOf(normalizedQuery);
      if (label.includes(normalizedQuery)) score += 52 - label.indexOf(normalizedQuery);
      if (sector.includes(normalizedQuery)) score += 26;

      const overlap = [...normalizedQuery].filter((char) => symbol.includes(char)).length;
      score += overlap;

      return { candidate, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.symbol.localeCompare(b.candidate.symbol))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

function buildUserRecommendationsMarkup(feed, performance) {
  const heldSymbols = new Set(performance.map((holding) => String(holding.symbol || "").toUpperCase()));
  const candidates = feed
    .filter((quote) => quote && quote.symbol && !heldSymbols.has(String(quote.symbol).toUpperCase()))
    .sort((a, b) => Number(b.change_percent || 0) - Number(a.change_percent || 0))
    .slice(0, 6);

  if (!candidates.length) {
    return `<div class="empty-mini-state">Recommendations will appear as soon as more market ideas are available.</div>`;
  }

  return candidates
    .map(
      (quote) => `
        <button class="recommendation-card" type="button" data-recommend-symbol="${escapeHtml(quote.symbol)}" data-recommend-price="${Number(quote.price || 0).toFixed(2)}">
          <div>
            <strong>${escapeHtml(quote.symbol)}</strong>
            <small>${escapeHtml(quote.short_name || "Suggested stock")}</small>
          </div>
          <div class="recommendation-metrics">
            <span>${currency(quote.price)}</span>
            <small class="${Number(quote.change_percent || 0) >= 0 ? "profit" : "loss"}">${percent(Number(quote.change_percent || 0))}</small>
          </div>
        </button>
      `
    )
    .join("");
}

function renderHoldingsSearchSuggestions(rows) {
  const mount = document.getElementById("userSearchSuggestions");
  if (!mount) return;

  const query = normalizeSearchText(userUiState.search);
  if (!query) {
    mount.innerHTML = "";
    return;
  }

  const matches = rows.slice(0, 5).map((row) => ({
    symbol: row.dataset.symbol || "",
    sector: row.dataset.sector || ""
  }));

  mount.innerHTML = matches.length
    ? matches
        .map(
          (match) => `<button class="search-chip" type="button" data-search-chip="${escapeHtml(match.symbol)}">${escapeHtml(match.symbol)}<small>${escapeHtml(match.sector || "Tracked")}</small></button>`
        )
        .join("")
    : `<span class="search-empty">No close holding matches yet.</span>`;

  mount.querySelectorAll("[data-search-chip]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = document.getElementById("userPortfolioSearch");
      if (!input) return;
      input.value = button.dataset.searchChip || "";
      userUiState.search = input.value;
      applyUserPortfolioFilters();
      input.focus();
    });
  });
}

function applyUserPortfolioFilters() {
  const tbody = document.getElementById("userHoldingsTableBody");
  if (!tbody) return;

  const rows = [...tbody.querySelectorAll("tr[data-symbol]")];
  const query = normalizeSearchText(userUiState.search);
  const status = userUiState.status;
  let visibleCount = 0;
  let visibleValue = 0;

  rows.forEach((row) => {
    const symbol = normalizeSearchText(row.dataset.symbol);
    const sector = normalizeSearchText(row.dataset.sector);
    const state = row.dataset.state || "flat";
    const value = Number(row.dataset.value || 0);
    const matchesSearch = !query || symbol.includes(query) || sector.includes(query);
    const matchesStatus = status === "all" || status === state;
    const visible = matchesSearch && matchesStatus;
    row.hidden = !visible;
    if (visible) {
      visibleCount += 1;
      visibleValue += value;
    }
  });

  const emptyRow = document.getElementById("userHoldingsEmptyRow");
  if (emptyRow) emptyRow.hidden = visibleCount > 0;

  const summary = document.getElementById("userSearchSummary");
  if (summary) {
    summary.textContent = visibleCount
      ? `${visibleCount} holding${visibleCount === 1 ? "" : "s"} visible · ${currency(visibleValue)} in view`
      : "No holdings match the current search or filter.";
  }

  renderHoldingsSearchSuggestions(rows.filter((row) => !row.hidden));
}

function setupPortfolioSymbolSuggestions() {
  const input = document.querySelector('#portfolioForm [name="symbol"]');
  const suggestions = document.getElementById("portfolioSymbolSuggestions");
  const buyPriceInput = document.querySelector('#portfolioForm [name="buyPrice"]');
  if (!input || !suggestions) return;

  const renderSuggestions = () => {
    const matches = getClosestSymbolMatches(input.value, userDashboardCache.symbolCatalog, 6);
    suggestions.innerHTML = matches.length
      ? matches
          .map(
            (candidate) => `
              <button class="symbol-suggestion-btn" type="button" data-symbol-suggestion="${escapeHtml(candidate.symbol)}" data-symbol-price="${Number(candidate.price || 0).toFixed(2)}">
                <strong>${escapeHtml(candidate.symbol)}</strong>
                <small>${escapeHtml(candidate.sector)}</small>
              </button>
            `
          )
          .join("")
      : `<span class="search-empty">Keep typing to find the nearest stock symbol.</span>`;
  };

  input.addEventListener("focus", renderSuggestions);
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase();
    renderSuggestions();
  });

  suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-symbol-suggestion]");
    if (!button) return;
    input.value = button.dataset.symbolSuggestion || "";
    if (buyPriceInput && !String(buyPriceInput.value || "").trim() && Number(button.dataset.symbolPrice || 0) > 0) {
      buyPriceInput.value = Number(button.dataset.symbolPrice).toFixed(2);
    }
    renderSuggestions();
    input.focus();
  });

  renderSuggestions();
}

function setupUserRecommendationButtons() {
  document.querySelectorAll("[data-recommend-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.getElementById("portfolioForm");
      const symbolInput = form?.querySelector('[name="symbol"]');
      const buyPriceInput = form?.querySelector('[name="buyPrice"]');
      if (!form || !symbolInput) return;
      symbolInput.value = String(button.dataset.recommendSymbol || "").toUpperCase();
      if (buyPriceInput && !String(buyPriceInput.value || "").trim() && Number(button.dataset.recommendPrice || 0) > 0) {
        buyPriceInput.value = Number(button.dataset.recommendPrice).toFixed(2);
      }
      form.scrollIntoView({ behavior: "smooth", block: "center" });
      symbolInput.focus();
    });
  });
}

function setupUserPortfolioFilters() {
  const searchInput = document.getElementById("userPortfolioSearch");
  const statusFilter = document.getElementById("userPortfolioStatusFilter");

  if (searchInput) {
    searchInput.value = userUiState.search;
    searchInput.addEventListener("input", () => {
      userUiState.search = searchInput.value;
      applyUserPortfolioFilters();
    });
  }

  if (statusFilter) {
    statusFilter.value = userUiState.status;
    statusFilter.addEventListener("change", () => {
      userUiState.status = statusFilter.value;
      applyUserPortfolioFilters();
    });
  }

  applyUserPortfolioFilters();
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
      document.body.classList.add("page-transitioning");
      window.setTimeout(() => {
        window.location.href = url.href;
      }, 220);
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

function logoutAndResetPortals() {
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
  const toggleNudgeBtn = document.getElementById("toggleChatNudgesBtn");
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

  if (toggleNudgeBtn) {
    toggleNudgeBtn.textContent = controls.chatNudgesEnabled ? "Disable Chat Popups" : "Enable Chat Popups";
    toggleNudgeBtn.addEventListener("click", async () => {
      const nextControls = { ...getSiteControls(), chatNudgesEnabled: !getSiteControls().chatNudgesEnabled };
      await updateSiteControls(nextControls);
      toggleNudgeBtn.textContent = nextControls.chatNudgesEnabled ? "Disable Chat Popups" : "Enable Chat Popups";
      if (controlStatus) {
        controlStatus.textContent = nextControls.chatNudgesEnabled
          ? "Finance chatbot nudges are enabled."
          : "Finance chatbot nudges are disabled.";
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
  const searchInput = document.getElementById("adminUserSearch");
  const statusFilter = document.getElementById("adminUserStatusFilter");
  const selectAll = document.getElementById("adminSelectAllUsers");
  const bulkActivate = document.getElementById("bulkActivateUsersBtn");
  const bulkDisable = document.getElementById("bulkDisableUsersBtn");
  const bulkDelete = document.getElementById("bulkDeleteUsersBtn");

  if (searchInput) {
    searchInput.value = adminUiState.search;
    searchInput.addEventListener("input", async () => {
      adminUiState.search = searchInput.value.trim();
      await renderAdminPortal();
    });
  }

  if (statusFilter) {
    statusFilter.value = adminUiState.status;
    statusFilter.addEventListener("change", async () => {
      adminUiState.status = statusFilter.value;
      await renderAdminPortal();
    });
  }

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

  if (bulkDelete) {
    bulkDelete.addEventListener("click", async () =>
      runBulkAction("delete", bulkDelete, "Delete all selected users and their portfolio data?")
    );
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

  document.querySelectorAll("[data-delete-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.deleteUser;
      const userName = button.dataset.userName || "this user";
      const confirmed = window.confirm(`Delete ${userName} and all linked portfolio data? This cannot be undone.`);
      if (!confirmed) return;
      const stopLoading = setButtonLoading(button, "Deleting...");
      try {
        await api(`/admin/users/${userId}`, { method: "DELETE" });
        if (statusMessage) {
          statusMessage.textContent = `${userName} was deleted successfully.`;
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
}

function setupPortalActions() {
  document.querySelectorAll("[data-logout]").forEach((button) => {
    button.addEventListener("click", () => logoutAndResetPortals());
  });

  document.querySelectorAll("[data-open-finance-chat]").forEach((button) => {
    button.addEventListener("click", () => {
      const launcher = document.getElementById("chatLauncher");
      if (launcher) launcher.click();
    });
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

  document.querySelectorAll("[data-refresh-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      const originalText = button.textContent;
      button.textContent = "Refreshing...";
      try {
        await renderUserPortal();
      } finally {
        button.disabled = false;
        button.textContent = originalText || "Refresh";
      }
    });
  });
}

function buildAdminClientDetail(user) {
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
        <article><strong>${user.total_holdings}</strong><span>Live Stocks</span></article>
        <article><strong>${currency(user.total_portfolio_value)}</strong><span>Current Value</span></article>
        <article><strong class="${user.total_profit_loss >= 0 ? "profit" : "loss"}">${percent((user.total_profit_loss / Math.max(user.total_portfolio_value - user.total_profit_loss, 1)) * 100)}</strong><span>Total Return</span></article>
      </div>
      <div class="dashboard-grid detail-grid">
        <article class="table-card">
          <div class="panel-head"><h3>Live Stock View</h3><span class="badge">Realtime</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Stock</th><th>Qty</th><th>Buy Price</th><th>Live Price</th><th>P&amp;L</th></tr></thead>
              <tbody>
                ${user.holdings.map((holding) => `
                  <tr>
                    <td>${holding.symbol}<br /><small>${holding.sector || "Tracked holding"}</small></td>
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
          <div class="panel-head"><h3>Old Stock History</h3><span class="badge green">Purchase Records</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Stock</th><th>Qty</th><th>Buy Price</th><th>Status</th></tr></thead>
              <tbody>
                ${user.holdings.map((holding) => `
                  <tr>
                    <td>${formatDate(holding.created_at)}</td>
                    <td>${holding.symbol}</td>
                    <td>${holding.quantity}</td>
                    <td>${currency(holding.buy_price)}</td>
                    <td>${holding.current_price >= holding.buy_price ? "In Profit" : "Under Watch"}</td>
                  </tr>
                `).join("")}
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
          <thead><tr><th>Customer</th><th>Client ID</th><th>Qty</th><th>Buy Price</th><th>Live Price</th><th>P&amp;L</th></tr></thead>
          <tbody>
            ${holdings.map((holding) => `
              <tr>
                <td>${holding.owner}</td>
                <td>${holding.fixed_user_id || ""}</td>
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

function setupAdminDrilldowns(userDashboards, allHoldings) {
  const detailMount = document.getElementById("adminDetailMount");
  if (!detailMount) return;

  document.querySelectorAll("[data-user-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = Number(button.dataset.userDetail);
      const user = userDashboards.find((entry) => Number(entry.user_id) === userId);
      if (!user) return;
      detailMount.innerHTML = buildAdminClientDetail(user);
      detailMount.classList.remove("hidden");
      detailMount.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  document.querySelectorAll("[data-stock-detail]").forEach((button) => {
    button.addEventListener("click", () => {
      const symbol = String(button.dataset.stockDetail || "").toUpperCase();
      const holdings = allHoldings.filter((entry) => entry.symbol === symbol);
      if (!holdings.length) return;
      detailMount.innerHTML = buildAdminStockDetail(symbol, holdings);
      detailMount.classList.remove("hidden");
      detailMount.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

async function renderAdminPortal() {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  try {
    const [dashboard, users, auditLogs, authAttempts, systemStatus, reviews, operationsOverview] = await Promise.all([
      api("/admin/dashboard"),
      api("/admin/users"),
      api("/admin/audit-logs?limit=8"),
      api("/admin/auth-attempts?limit=8"),
      api("/admin/system-status"),
      api("/admin/reviews"),
      api("/admin/operations-overview")
    ]);
    const safeUsers = Array.isArray(users) ? users : [];
    const safeAuditLogs = Array.isArray(auditLogs) ? auditLogs : [];
    const safeAuthAttempts = Array.isArray(authAttempts) ? authAttempts : [];
    const safeReviews = Array.isArray(reviews) ? reviews : [];
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
    const filteredUsers = safeUsers.filter((user) => {
      const matchesSearch =
        !searchText ||
        user.full_name.toLowerCase().includes(searchText) ||
        String(user.fixed_user_id || user.username).toLowerCase().includes(searchText) ||
        String(user.phone_number || "").toLowerCase().includes(searchText);
      const matchesStatus =
        adminUiState.status === "all" ||
        (adminUiState.status === "active" && user.is_active) ||
        (adminUiState.status === "inactive" && !user.is_active);
      return matchesSearch && matchesStatus;
    });
    const pendingModerationCount = safeReviews.filter((review) => !review.is_seeded).length;
    const stockConcentration = Array.isArray(operationsOverview?.stock_concentration) ? operationsOverview.stock_concentration : [];
    const recentUserActivity = Array.isArray(operationsOverview?.recent_user_activity) ? operationsOverview.recent_user_activity : [];
    const loginIssueBreakdown = Array.isArray(operationsOverview?.login_issue_breakdown) ? operationsOverview.login_issue_breakdown : [];
    const adminTickerMarkup = safeFeed
      .map(
        (quote) => `
          <article>
            <strong>${escapeHtml(quote.symbol)}</strong>
            <small>${escapeHtml(quote.short_name || quote.symbol)}</small>
            <small class="${Number(quote.change_percent || 0) >= 0 ? "profit" : "loss"}">${percent(Number(quote.change_percent || 0))}</small>
          </article>
        `
      )
      .join("");

    mount.innerHTML = `
    <section class="user-shell admin-shell">
      <aside class="user-sidebar">
        <div class="brand">
          <span class="brand-mark">ST</span>
          <span>
            <strong>Stock Trader Web</strong>
            <small>Admin workspace</small>
          </span>
        </div>
        <article class="user-balance-card">
          <span class="user-sidebar-label">Platform Value</span>
          <strong>${currency(totalValue)}</strong>
          <span>Total tracked across client portfolios</span>
        </article>
        <div class="user-sidebar-section">
          <span class="user-sidebar-label">Main</span>
          <nav class="user-sidebar-nav">
            <a class="user-nav-item active" href="#adminOverviewCard">Dashboard <span>${dashboard?.total_users ?? safeUsers.length}</span></a>
            <a class="user-nav-item" href="#adminClientOpsCard">Operations <span>Live</span></a>
            <a class="user-nav-item" href="#adminUsersCard">Users <span>${safeUsers.length}</span></a>
            <a class="user-nav-item" href="#adminSecurityCard">Security <span>${failedAttempts}</span></a>
          </nav>
        </div>
        <div class="user-sidebar-section">
          <span class="user-sidebar-label">Controls</span>
          <nav class="user-sidebar-nav">
            <a class="user-nav-item" href="#adminControlsCard">Site <span>Manage</span></a>
            <a class="user-nav-item" href="#adminModerationCard">Reviews <span>${pendingModerationCount}</span></a>
            <a class="user-nav-item" href="#adminTickerCard">Markets <span>${symbols.length}</span></a>
            <a class="user-nav-item" href="#adminDetailMount">Details <span>Drill</span></a>
          </nav>
        </div>
        <article class="user-reward-card">
          <strong>Export investor-ready reports</strong>
          <span>Monitor portfolios, review activity, and download clean client snapshots from one place.</span>
          <div class="actions-row" style="margin-top:14px;">
            <button class="download-btn" type="button" data-refresh-admin="true">Refresh Data</button>
          </div>
        </article>
        <article class="user-profile-card">
          <strong>Admin View</strong>
          <small>${systemStatus.backend_status} backend</small>
          <small>${systemStatus.database_status} database</small>
        </article>
      </aside>

      <div class="user-shell-main">
        <header class="user-topbar">
          <div>
            <p class="eyebrow">Admin Workspace</p>
            <h2>Client operations and portfolio oversight</h2>
          </div>
          <div class="user-topbar-actions">
            <input class="user-search" id="adminUserSearch" type="text" placeholder="Search clients, IDs, or phone" />
            <select class="user-search" id="adminUserStatusFilter" style="max-width:180px;">
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <button class="assistant-btn" type="button" data-open-finance-chat="true">AI Assistant</button>
            <button class="secondary-btn" type="button" data-refresh-admin="true">Refresh</button>
            <button class="secondary-btn" type="button" data-logout="true">Logout</button>
          </div>
        </header>

        <div class="user-ticker-strip" id="adminTickerCard">
          ${adminTickerMarkup || `<article><strong>Market feed</strong><small>No tracked symbols yet</small><small>Client holdings will appear here</small></article>`}
        </div>

        <div id="adminOverviewCard">
    <div class="metrics-grid">
      <article class="metric-card"><strong>${dashboard?.total_users ?? safeUsers.length}</strong><span>Clients</span><small>Persisted registered users</small></article>
      <article class="metric-card"><strong>${dashboard?.newly_registered_users ?? 0}</strong><span>New This Week</span><small>Non-demo client registrations</small></article>
      <article class="metric-card"><strong>${dashboard?.total_holdings ?? baseHoldings.length}</strong><span>Total Holdings</span><small>Stocks stored in the database</small></article>
      <article class="metric-card"><strong class="${todayProfit >= 0 ? "profit" : "loss"}">${currency(todayProfit)}</strong><span>Today Profit</span><small>Intraday movement across tracked holdings</small></article>
      <article class="metric-card"><strong class="${totalPnl >= 0 ? "profit" : "loss"}">${currency(totalPnl)}</strong><span>Total Profit Till Now</span><small>Current tracked value ${currency(totalValue)}</small></article>
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
        <div class="panel-head"><h3>Customer Stock Purchases</h3><span class="badge">Admin View</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Stock</th><th>Qty</th><th>Buy Price</th><th>Live Price</th><th>P&amp;L</th></tr></thead>
            <tbody>
              ${allHoldings
                .map(
                  (holding) => `
                    <tr>
                      <td><button class="table-link" type="button" data-user-detail="${holding.user_id}">${holding.owner}</button><br /><small>${holding.fixed_user_id || ""}</small></td>
                      <td><button class="table-link" type="button" data-stock-detail="${holding.symbol}">${holding.symbol}</button><br /><small>${holding.sector || "Tracked holding"}</small></td>
                      <td>${holding.quantity}</td>
                      <td>${currency(holding.buy_price)}</td>
                      <td>${currency(holding.current_price)}</td>
                      <td class="${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}<br /><small>${percent(holding.percent_change)}</small></td>
                    </tr>
                  `
                )
                .join("")}
            </tbody>
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
            <button class="secondary-btn danger-btn compact-btn" type="button" id="bulkDeleteUsersBtn">Bulk Delete</button>
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
                          <button class="secondary-btn danger-btn compact-btn" type="button" data-delete-user="${user.user_id}" data-user-name="${user.full_name}">Delete</button>
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
            <div><strong>Chatbot Popups</strong><small>Control the 5-second finance assistant popup prompts.</small></div>
            <button class="secondary-btn" type="button" id="toggleChatNudgesBtn">Disable Chat Popups</button>
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
    <div class="dashboard-grid">
      <article class="dashboard-card full-span-card">
        <div class="panel-head"><h3>Live Market Numbers</h3><span class="badge red">Moving</span></div>
        <div class="ticker-list" id="adminTicker"></div>
      </article>
    </div>
    </div>
    </section>
  `;

    revealPortal(mount);
    activeRole = "admin";
    activeUserId = null;
    setupDownloadButtons(userDashboards);
    setupWebsiteControlButtons();
    setupAdminManagementButtons();
    setupAdminDrilldowns(userDashboards, allHoldings);
    setupPortalActions();
    await renderTicker("adminTicker", symbols);
  } catch (error) {
    renderPortalError(mount, "Admin Dashboard", `Login succeeded, but admin dashboard data could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) {
      retry.addEventListener("click", () => renderAdminPortal());
    }
  }
}

async function renderUserPortal() {
  const mount = document.getElementById("userPortal");
  if (!mount) return;
  try {
    const [profile, holdings, summary] = await Promise.all([api("/auth/me"), api("/portfolio"), api("/portfolio/summary")]);
    const performance = Array.isArray(summary.performance) ? summary.performance : [];
    const totalInvested = performance.reduce((sum, item) => sum + Number(item.buy_price || 0) * Number(item.quantity || 0), 0);
    const overallPct = totalInvested ? (summary.total_profit_loss / totalInvested) * 100 : 0;
    const symbols = [...new Set(performance.map((holding) => holding.symbol).filter(Boolean))];
    const liveFeed = symbols.length
      ? await api(`/stocks/feed?symbols=${encodeURIComponent(symbols.join(","))}`).catch(() => [])
      : [];
    const recommendationFeed = await api(`/stocks/feed?symbols=${encodeURIComponent(USER_RECOMMENDATION_SYMBOLS.join(","))}`).catch(() => []);
    const profitableCount = performance.filter((holding) => Number(holding.profit_loss || 0) > 0).length;
    const sectorCount = new Set(performance.map((holding) => holding.sector || "Tracked")).size;
    const topPerformer = performance.length
      ? performance.slice().sort((a, b) => Number(b.profit_loss || 0) - Number(a.profit_loss || 0))[0]
      : null;
    const laggard = performance.length
      ? performance.slice().sort((a, b) => Number(a.profit_loss || 0) - Number(b.profit_loss || 0))[0]
      : null;
    const filteredPerformance = getFilteredUserPerformance(performance);
    const totalVisibleValue = filteredPerformance.reduce((sum, holding) => sum + Number(holding.value || 0), 0);
    const gainRate = performance.length ? (profitableCount / performance.length) * 100 : 0;
    const exposureEntries = Object.entries(summary.sector_exposure || {})
      .sort((a, b) => Number(b[1]) - Number(a[1]))
      .slice(0, 5);
    const tickerMarkup = (Array.isArray(liveFeed) ? liveFeed : [])
      .map(
        (quote) => `
          <article>
            <strong>${escapeHtml(quote.symbol)}</strong>
            <small>${escapeHtml(quote.short_name || quote.symbol)}</small>
            <small class="${quote.change_percent >= 0 ? "profit" : "loss"}">${percent(quote.change_percent)}</small>
          </article>
        `
      )
      .join("");

    userDashboardCache = {
      performance,
      recommendationFeed: Array.isArray(recommendationFeed) ? recommendationFeed : [],
      symbolCatalog: buildUserSymbolCatalog(performance, Array.isArray(recommendationFeed) ? recommendationFeed : [])
    };

    mount.innerHTML = `
    <section class="user-shell">
      <aside class="user-sidebar">
        <div class="brand">
          <span class="brand-mark">ST</span>
          <span>
            <strong>Stock Trader Web</strong>
            <small>Investor workspace</small>
          </span>
        </div>
        <article class="user-balance-card">
          <span class="user-sidebar-label">Balance</span>
          <strong>${currency(summary.total_portfolio_value)}</strong>
          <span>Latest portfolio value</span>
        </article>
        <div class="user-sidebar-section">
          <span class="user-sidebar-label">Main</span>
          <nav class="user-sidebar-nav">
            <a class="user-nav-item active" href="#userPerformanceCard">Dashboard <span>${performance.length}</span></a>
            <a class="user-nav-item" href="#userPortfolioCard">Portfolio <span>${filteredPerformance.length}</span></a>
            <a class="user-nav-item" href="#userAllocationCard">Allocation <span>${sectorCount}</span></a>
            <a class="user-nav-item" href="#userActivityCard">History <span>${performance.length ? "Live" : "New"}</span></a>
          </nav>
        </div>
        <div class="user-sidebar-section">
          <span class="user-sidebar-label">Explore</span>
          <nav class="user-sidebar-nav">
            <a class="user-nav-item" href="#userSignalsCard">Signals <span>${summary.risk_level || "Moderate"}</span></a>
            <a class="user-nav-item" href="#userRecommendationsCard">Ideas <span>Live</span></a>
            <a class="user-nav-item" href="#portfolioForm">Add Stock <span>Now</span></a>
          </nav>
        </div>
        <article class="user-reward-card">
          <strong>Get investor-ready reporting</strong>
          <span>Download your dashboard and keep a clean portfolio snapshot for every review.</span>
          <div class="actions-row" style="margin-top:14px;">
            <button class="download-btn" type="button" id="userPrintBtn">Download Dashboard</button>
          </div>
        </article>
        <article class="user-profile-card">
          <strong>${profile.full_name}</strong>
          <small>${profile.fixed_user_id || profile.username}</small>
          <small>${profile.phone_number || "Client access"}</small>
        </article>
      </aside>

      <div class="user-shell-main">
        <header class="user-topbar">
          <div>
            <p class="eyebrow">Welcome Back</p>
            <h2>${profile.full_name}</h2>
          </div>
          <div class="user-topbar-actions">
            <input class="user-search" id="userPortfolioSearch" type="text" placeholder="Search holdings or sectors" />
            <select class="user-search" id="userPortfolioStatusFilter" style="max-width:180px;">
              <option value="all">All holdings</option>
              <option value="profit">In profit</option>
              <option value="loss">In loss</option>
              <option value="flat">Flat</option>
            </select>
            <button class="assistant-btn" type="button" data-open-finance-chat="true">AI Assistant</button>
            <button class="secondary-btn" type="button" data-refresh-user="true">Refresh</button>
            <button class="secondary-btn" type="button" data-logout="true">Logout</button>
          </div>
        </header>

        <div class="user-ticker-strip">
          ${tickerMarkup || `<article><strong>Market feed</strong><small>No tracked symbols yet</small><small>Add a stock to begin</small></article>`}
        </div>

        <div class="user-app-grid">
          <article class="user-app-card" id="userPerformanceCard">
            <div class="panel-head">
              <h3>Portfolio Performance</h3>
              <div class="chart-range">
                <span>1D</span>
                <span>1M</span>
                <span class="active">1Y</span>
                <span>All</span>
              </div>
            </div>
            <div class="chart-card-main">
              <div class="chart-metric-panel">
                <div class="chart-figure">
                  <span>Your portfolio is <strong class="${summary.total_profit_loss >= 0 ? "profit" : "loss"}">${summary.total_profit_loss >= 0 ? "up" : "down"} ${Math.abs(overallPct).toFixed(1)}%</strong> overall</span>
                  <strong class="chart-value">${currency(summary.total_portfolio_value)}</strong>
                  <small>Current investment value across tracked holdings</small>
                </div>
                <article class="mini-stat-box">
                  <strong class="${summary.total_profit_loss >= 0 ? "profit" : "loss"}">${currency(summary.total_profit_loss)}</strong>
                  <small>Total profit and loss</small>
                </article>
                <div class="chart-inline-grid">
                  <article>
                    <strong>${currency(totalInvested)}</strong>
                    <small>Total invested</small>
                  </article>
                  <article>
                    <strong>${currency(totalVisibleValue || summary.total_portfolio_value)}</strong>
                    <small>Visible value</small>
                  </article>
                  <article>
                    <strong>${performance.length}</strong>
                    <small>Active positions</small>
                  </article>
                  <article>
                    <strong>${gainRate.toFixed(0)}%</strong>
                    <small>Positions in profit</small>
                  </article>
                </div>
              </div>
              <div class="chart-display">
                <svg viewBox="0 0 700 360" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="userPerformanceFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stop-color="rgba(15,159,98,0.28)" />
                      <stop offset="100%" stop-color="rgba(15,159,98,0.03)" />
                    </linearGradient>
                  </defs>
                  <path d="M0,230 C40,210 70,240 110,214 C160,182 190,132 236,148 C278,162 312,82 362,96 C404,108 426,196 472,202 C520,208 540,120 584,116 C626,112 658,76 700,66 L700,360 L0,360 Z" fill="url(#userPerformanceFill)"></path>
                  <path d="M0,230 C40,210 70,240 110,214 C160,182 190,132 236,148 C278,162 312,82 362,96 C404,108 426,196 472,202 C520,208 540,120 584,116 C626,112 658,76 700,66" fill="none" stroke="#22b573" stroke-width="4" stroke-linecap="round"></path>
                </svg>
                <div class="chart-tooltip">
                  <small>${topPerformer ? escapeHtml(topPerformer.symbol) : "Portfolio View"}</small>
                  <strong>${topPerformer ? currency(topPerformer.value) : currency(summary.total_portfolio_value)}</strong>
                  <small>${topPerformer ? percent(topPerformer.percent_change) : percent(overallPct)}</small>
                </div>
              </div>
            </div>
          </article>

          <article class="user-app-card" id="userAllocationCard">
            <div class="panel-head"><h3>Portfolio Allocation</h3><span class="badge">Sector View</span></div>
            <div class="allocation-summary-bar">
              ${exposureEntries.length
                ? exposureEntries.map(([, value]) => `<span style="width:${Math.max(Number(value), 8)}%"></span>`).join("")
                : `<span style="width:100%"></span>`}
            </div>
            <div class="allocation-grid">
              ${exposureEntries.length
                ? exposureEntries
                    .map(
                      ([sector, value]) => `
                        <article class="allocation-pill">
                          <strong>${escapeHtml(sector)}</strong>
                          <span>${Number(value).toFixed(0)}%</span>
                          <small>Estimated portfolio exposure</small>
                        </article>
                      `
                    )
                    .join("")
                : `<article class="allocation-pill"><strong>No allocation data</strong><small>Add a stock to populate your sector mix.</small></article>`}
            </div>
          </article>
        </div>

        <div class="user-app-grid">
          <article class="user-app-card" id="userPortfolioCard">
            <div class="panel-head"><h3>Portfolio Holdings</h3><span class="badge green">Live</span></div>
            <div class="search-helper-row">
              <small id="userSearchSummary">${filteredPerformance.length} holdings visible</small>
              <div id="userSearchSuggestions" class="search-chip-list"></div>
            </div>
            <div class="table-wrap">
              <table class="compact-table">
                <thead><tr><th>Asset</th><th>Invested</th><th>Live Value</th><th>P&amp;L</th><th>Action</th></tr></thead>
                <tbody id="userHoldingsTableBody">
                  ${performance.length
                    ? performance
                        .map(
                          (holding) => `
                            <tr data-symbol="${escapeHtml(holding.symbol)}" data-sector="${escapeHtml(holding.sector || "Tracked holding")}" data-state="${getHoldingState(holding)}" data-value="${Number(holding.value || 0)}">
                              <td>${holding.symbol}<br /><small>${holding.sector || "Tracked holding"}</small></td>
                              <td>${currency(holding.buy_price * holding.quantity)}</td>
                              <td>${currency(holding.value)}</td>
                              <td><strong class="${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}</strong><br /><small>${percent(holding.percent_change)}</small></td>
                              <td><button class="secondary-btn compact-btn" type="button" data-delete-holding="${holding.holding_id}" data-symbol="${holding.symbol}">Remove</button></td>
                            </tr>
                          `
                        )
                        .join("")
                    : ""}
                  <tr id="userHoldingsEmptyRow" ${performance.length ? "hidden" : ""}><td colspan="5"><span class="helper-text">${performance.length ? "No holdings match the active filters." : "No stocks added yet. Use the form to build the portfolio."}</span></td></tr>
                </tbody>
              </table>
            </div>
          </article>

          <article class="user-app-card">
            <div class="panel-head"><h3>Add To Portfolio</h3><span class="badge">Smart Assist</span></div>
            <form id="portfolioForm" class="portfolio-form">
              <label class="portfolio-symbol-wrap"><span>Stock Symbol</span><input name="symbol" type="text" autocomplete="off" required /><div id="portfolioSymbolSuggestions" class="symbol-suggestion-list"></div></label>
              <label><span>Quantity</span><input name="quantity" type="number" min="1" required /></label>
              <label><span>Buy Price</span><input name="buyPrice" type="number" min="1" step="0.01" required /></label>
              <label><span>Exchange</span><input name="exchange" type="text" value="NSE" required /></label>
              <button class="primary-btn" type="submit">Add Stock</button>
            </form>
          </article>
        </div>

        <div class="user-app-grid">
          <article class="user-app-card" id="userRecommendationsCard">
            <div class="panel-head"><h3>Recommended To Add</h3><span class="badge">Refreshing Live</span></div>
            <div class="recommendation-grid">
              ${buildUserRecommendationsMarkup(userDashboardCache.recommendationFeed, performance)}
            </div>
          </article>

          <article class="user-app-card" id="userSignalsCard">
            <div class="panel-head"><h3>Performance Signals</h3><span class="badge">Insights</span></div>
            <div class="performance-grid">
              <article class="note-card">
                <strong>Best performer</strong>
                <span>${topPerformer ? topPerformer.symbol : "Pending"}</span>
                <small class="${topPerformer && topPerformer.profit_loss >= 0 ? "profit" : ""}">${topPerformer ? `${currency(topPerformer.profit_loss)} · ${percent(topPerformer.percent_change)}` : "No data yet"}</small>
              </article>
              <article class="note-card">
                <strong>Needs attention</strong>
                <span>${laggard ? laggard.symbol : "Pending"}</span>
                <small class="${laggard && laggard.profit_loss < 0 ? "loss" : ""}">${laggard ? `${currency(laggard.profit_loss)} · ${percent(laggard.percent_change)}` : "No data yet"}</small>
              </article>
              <article class="note-card">
                <strong>Risk level</strong>
                <span>${summary.risk_level || "Moderate"}</span>
                <small>${summary.diversification_analysis || "Diversification insight will appear here."}</small>
              </article>
              <article class="note-card">
                <strong>Winning positions</strong>
                <span>${profitableCount}/${performance.length || 0}</span>
                <small>${gainRate.toFixed(0)}% of tracked holdings are in profit.</small>
              </article>
            </div>
          </article>

          <article class="user-app-card" id="userActivityCard">
            <div class="panel-head"><h3>Recent Activity</h3><span class="badge">Timeline</span></div>
            <div class="stack-list">
              ${buildRecentActivityMarkup(performance)}
            </div>
          </article>
        </div>
      </div>
    </section>
  `;

    revealPortal(mount);
    activeRole = "user";
    activeUserId = profile.id;
    document.getElementById("userPrintBtn").addEventListener("click", () => window.print());
    setupPortfolioForm();
    setupPortfolioSymbolSuggestions();
    setupUserRecommendationButtons();
    setupHoldingDeleteButtons();
    setupUserPortfolioFilters();
    setupPortalActions();
  } catch (error) {
    renderPortalError(mount, "User Dashboard", `Login succeeded, but portfolio data could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) {
      retry.addEventListener("click", () => renderUserPortal());
    }
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
      const suggestions = document.getElementById("portfolioSymbolSuggestions");
      if (suggestions) suggestions.innerHTML = "";
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
  if (!adminForm || !userForm || !registerForm) return;

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
      registerForm.classList.toggle("hidden", role !== "register");
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
          if (!hasRequiredFields(userForm, ["userId", "password", "phone"])) {
            document.getElementById("userError").textContent = "Fill user ID, password, and phone number before requesting verification code.";
            return;
          }
          hidePortalMounts();
          const payload = {
            role: "user",
            identifier: String(userForm.querySelector('[name="userId"]').value).trim().toUpperCase(),
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
      goToDashboard("admin");
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
      if (!hasRequiredFields(userForm, ["userId", "password", "phone", "otp"])) {
        document.getElementById("userError").textContent = "Complete user ID, password, phone number, and verification code before opening the dashboard.";
        return;
      }
      const data = new FormData(userForm);
      hidePortalMounts();
      showAuthLoading("Opening user dashboard...", "Loading your holdings, returns, and portfolio summary.");
      const response = await api("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          role: "user",
          identifier: String(data.get("userId")).trim().toUpperCase(),
          password: String(data.get("password")),
          phone_number: String(data.get("phone")).trim(),
          otp: String(data.get("otp")).trim()
        })
      });
      setAuth({ token: response.access_token, role: response.role });
      document.getElementById("userError").textContent = "";
      goToDashboard("user");
    } catch (error) {
      document.getElementById("userError").textContent = formatError(error);
      hidePortalMounts();
      hideAuthLoading();
    } finally {
      stopLoading();
    }
  });

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
      goToDashboard("user");
    } catch (error) {
      document.getElementById("registerError").textContent = formatError(error);
      hidePortalMounts();
      hideAuthLoading();
    } finally {
      stopLoading();
    }
  });

  if (isLoginPage()) {
    clearAuth();
    hidePortalMounts();
    hideAuthLoading();
  } else {
    const auth = getAuth();
    if (auth?.token && auth.role === "admin") {
      renderAdminPortal().catch(() => clearAuth());
    } else if (auth?.token && auth.role === "user") {
      renderUserPortal().catch(() => clearAuth());
    }
  }

  updateAside("admin");
  checkBackendStatus();

  liveTickerTimer = setInterval(async () => {
    if (activeRole === "admin") {
      await renderAdminPortal();
    }
    if (activeRole === "user" && activeUserId) {
      await renderUserPortal();
    }
  }, 15000);
}

function setupDashboardPages() {
  const adminPortal = document.getElementById("adminPortal");
  const userPortal = document.getElementById("userPortal");
  const auth = getAuth();

  if (isAdminDashboardPage()) {
    if (!auth?.token) {
      window.location.href = "./login.html";
      return;
    }
    if (auth.role !== "admin") {
      goToDashboard(auth.role === "user" ? "user" : "admin");
      return;
    }
    renderAdminPortal().catch(() => {
      clearAuth();
      window.location.href = "./login.html";
    });
  }

  if (isUserDashboardPage()) {
    if (!auth?.token) {
      window.location.href = "./login.html";
      return;
    }
    if (auth.role !== "user") {
      goToDashboard(auth.role === "admin" ? "admin" : "user");
      return;
    }
    renderUserPortal().catch(() => {
      clearAuth();
      window.location.href = "./login.html";
    });
  }

  if ((isAdminDashboardPage() && adminPortal) || (isUserDashboardPage() && userPortal)) {
    liveTickerTimer = setInterval(async () => {
      if (isAdminDashboardPage() && activeRole === "admin") {
        await renderAdminPortal();
      }
      if (isUserDashboardPage() && activeRole === "user" && activeUserId) {
        await renderUserPortal();
      }
    }, 15000);
  }
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

function setupFinanceChatbot() {
  const wrapper = document.createElement("div");
  wrapper.className = "finance-chat";
  wrapper.innerHTML = `
    <div class="chat-nudge" id="financeChatNudge">How may I help you?</div>
    <div class="chat-panel hidden" id="financeChatPanel">
      <div class="chat-head">
        <div>
          <h3>Finance Assistant</h3>
          <p>Ask finance questions, customer FAQs, or platform queries.</p>
        </div>
        <button class="chat-close" type="button" id="chatCloseBtn">x</button>
      </div>
      <div class="chat-log" id="financeChatLog">
        <div class="chat-msg bot">Ask me about stocks, portfolio metrics, login steps, OTP flow, admin downloads, FAQs, diversification, valuation, or investing basics.</div>
      </div>
      <form class="chat-form" id="financeChatForm">
        <input id="financeChatInput" type="text" placeholder="Ask a finance or platform question" />
        <button class="primary-btn" type="submit">Send</button>
      </form>
    </div>
    <button class="chat-launcher" id="chatLauncher" type="button">AI</button>
  `;
  document.body.appendChild(wrapper);

  const panel = document.getElementById("financeChatPanel");
  const launcher = document.getElementById("chatLauncher");
  const closeBtn = document.getElementById("chatCloseBtn");
  const nudge = document.getElementById("financeChatNudge");
  const form = document.getElementById("financeChatForm");
  const input = document.getElementById("financeChatInput");
  const log = document.getElementById("financeChatLog");

  const appendMessage = (type, message) => {
    const node = document.createElement("div");
    node.className = `chat-msg ${type}`;
    node.textContent = message;
    log.appendChild(node);
    log.scrollTop = log.scrollHeight;
  };

  launcher.addEventListener("click", () => {
    panel.classList.toggle("hidden");
    if (nudge) nudge.classList.add("hidden");
    if (!panel.classList.contains("hidden")) {
      input.focus();
    }
  });

  closeBtn.addEventListener("click", () => panel.classList.add("hidden"));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;

    appendMessage("user", message);
    input.value = "";

    const auth = getAuth();
    if (auth?.token && isFinancialQuestion(message)) {
      try {
        const symbolMatch = message.match(/\b[A-Z]{2,15}\b/);
        const response = await api("/ai/chat", {
          method: "POST",
          body: JSON.stringify({
            message,
            symbol: symbolMatch ? symbolMatch[0] : null
          })
        });
        appendMessage("bot", response.answer);
        return;
      } catch {
        appendMessage("bot", financeFallbackReply(message));
        return;
      }
    }

    appendMessage("bot", financeFallbackReply(message));
  });

  const rotateNudge = () => {
    if (!nudge || !panel.classList.contains("hidden") || !getSiteControls().chatNudgesEnabled) {
      if (nudge) nudge.classList.add("hidden");
      return;
    }
    nudge.classList.remove("hidden");
    nudge.textContent = "How may I help you?";
    window.setTimeout(() => {
      nudge.classList.add("hidden");
    }, 2200);
  };

  rotateNudge();
  chatNudgeTimer = window.setInterval(rotateNudge, 5000);
}

setupFaq();
loadSiteControls().catch(() => {});
setupReviewForm();
setupPageTransitions();
setupLogin();
setupDashboardPages();
setupFinanceChatbot();







