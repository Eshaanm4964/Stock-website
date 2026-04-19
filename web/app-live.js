const STORAGE_KEY = "stock_trader_auth";
const SITE_CONTROL_KEY = "stock_trader_site_controls";
const REVIEW_STORAGE_KEY = "stock_trader_reviews";
const USER_RECOMMENDATION_SYMBOLS = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "LT", "ITC", "AXISBANK", "KOTAKBANK", "BHARTIARTL", "ASIANPAINT"];
const STOCK_SEARCH_CATALOG = [
  { symbol: "RELIANCE", name: "Reliance Industries Ltd", sector: "Energy" },
  { symbol: "TCS", name: "Tata Consultancy Services Ltd", sector: "Technology" },
  { symbol: "INFY", name: "Infosys Ltd", sector: "Technology" },
  { symbol: "HDFCBANK", name: "HDFC Bank Ltd", sector: "Financial Services" },
  { symbol: "ICICIBANK", name: "ICICI Bank Ltd", sector: "Financial Services" },
  { symbol: "SBIN", name: "State Bank of India", sector: "Financial Services" },
  { symbol: "LT", name: "Larsen & Toubro Ltd", sector: "Industrials" },
  { symbol: "ITC", name: "ITC Ltd", sector: "Consumer Defensive" },
  { symbol: "AXISBANK", name: "Axis Bank Ltd", sector: "Financial Services" },
  { symbol: "KOTAKBANK", name: "Kotak Mahindra Bank Ltd", sector: "Financial Services" },
  { symbol: "BHARTIARTL", name: "Bharti Airtel Ltd", sector: "Telecom" },
  { symbol: "ASIANPAINT", name: "Asian Paints Ltd", sector: "Consumer Cyclical" },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd", sector: "Automotive" },
  { symbol: "SUNPHARMA", name: "Sun Pharmaceutical Industries Ltd", sector: "Healthcare" },
  { symbol: "MARUTI", name: "Maruti Suzuki India Ltd", sector: "Automotive" },
  { symbol: "HINDUNILVR", name: "Hindustan Unilever Ltd", sector: "Consumer Defensive" },
  { symbol: "BAJFINANCE", name: "Bajaj Finance Ltd", sector: "Financial Services" },
  { symbol: "HCLTECH", name: "HCL Technologies Ltd", sector: "Technology" },
  { symbol: "WIPRO", name: "Wipro Ltd", sector: "Technology" },
  { symbol: "TECHM", name: "Tech Mahindra Ltd", sector: "Technology" },
  { symbol: "ADANIENT", name: "Adani Enterprises Ltd", sector: "Industrials" },
  { symbol: "ADANIPORTS", name: "Adani Ports and SEZ Ltd", sector: "Industrials" },
  { symbol: "ULTRACEMCO", name: "UltraTech Cement Ltd", sector: "Materials" },
  { symbol: "TITAN", name: "Titan Company Ltd", sector: "Consumer Cyclical" },
  { symbol: "POWERGRID", name: "Power Grid Corporation of India Ltd", sector: "Utilities" },
  { symbol: "NTPC", name: "NTPC Ltd", sector: "Utilities" },
  { symbol: "ONGC", name: "Oil and Natural Gas Corporation Ltd", sector: "Energy" },
  { symbol: "COALINDIA", name: "Coal India Ltd", sector: "Energy" },
  { symbol: "JSWSTEEL", name: "JSW Steel Ltd", sector: "Materials" },
  { symbol: "TATASTEEL", name: "Tata Steel Ltd", sector: "Materials" },
  { symbol: "HINDALCO", name: "Hindalco Industries Ltd", sector: "Materials" },
  { symbol: "NESTLEIND", name: "Nestle India Ltd", sector: "Consumer Defensive" },
  { symbol: "BRITANNIA", name: "Britannia Industries Ltd", sector: "Consumer Defensive" },
  { symbol: "CIPLA", name: "Cipla Ltd", sector: "Healthcare" },
  { symbol: "DRREDDY", name: "Dr Reddy's Laboratories Ltd", sector: "Healthcare" },
  { symbol: "APOLLOHOSP", name: "Apollo Hospitals Enterprise Ltd", sector: "Healthcare" },
  { symbol: "GRASIM", name: "Grasim Industries Ltd", sector: "Materials" },
  { symbol: "M&M", name: "Mahindra & Mahindra Ltd", sector: "Automotive" },
  { symbol: "EICHERMOT", name: "Eicher Motors Ltd", sector: "Automotive" },
  { symbol: "HEROMOTOCO", name: "Hero MotoCorp Ltd", sector: "Automotive" },
  { symbol: "BAJAJ-AUTO", name: "Bajaj Auto Ltd", sector: "Automotive" },
  { symbol: "SHRIRAMFIN", name: "Shriram Finance Ltd", sector: "Financial Services" },
  { symbol: "SBILIFE", name: "SBI Life Insurance Company Ltd", sector: "Financial Services" },
  { symbol: "HDFCLIFE", name: "HDFC Life Insurance Company Ltd", sector: "Financial Services" },
  { symbol: "BAJAJFINSV", name: "Bajaj Finserv Ltd", sector: "Financial Services" }
];
const HOME_TICKER_SYMBOLS = ["NIFTY50", "SENSEX", "RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "LT", "TATAMOTORS", "SUNPHARMA"];
const HOME_TICKER_FALLBACK = {
  NIFTY50: { symbol: "NIFTY 50", price: 22580.35, change_percent: 0.42, is_fallback: true },
  SENSEX: { symbol: "SENSEX", price: 74221.06, change_percent: 0.36, is_fallback: true },
  RELIANCE: { symbol: "RELIANCE", price: 2910, change_percent: 1.12, is_fallback: true },
  TCS: { symbol: "TCS", price: 3660, change_percent: -0.34, is_fallback: true },
  INFY: { symbol: "INFY", price: 1512, change_percent: 0.82, is_fallback: true },
  HDFCBANK: { symbol: "HDFCBANK", price: 1618, change_percent: -0.76, is_fallback: true },
  ICICIBANK: { symbol: "ICICIBANK", price: 1112, change_percent: 1.45, is_fallback: true },
  SBIN: { symbol: "SBIN", price: 768, change_percent: 0.28, is_fallback: true },
  LT: { symbol: "LT", price: 3475, change_percent: -0.18, is_fallback: true },
  TATAMOTORS: { symbol: "TATAMOTORS", price: 904, change_percent: 2.04, is_fallback: true },
  SUNPHARMA: { symbol: "SUNPHARMA", price: 1710, change_percent: -0.41, is_fallback: true }
};
let activeRole = null;
let activeUserId = null;
let liveTickerTimer = null;
let chatNudgeTimer = null;
let adminSearchRenderTimer = null;
let liveDashboardPriceTimer = null;
const marketSymbolSearchCache = new Map();
let adminUiState = {
  search: "",
  scriptSearch: "",
  status: "all",
  detailType: "",
  detailKey: ""
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
    minute: "2-digit",
    timeZone: "Asia/Kolkata"
  });
};
const formatIndianSoldDateTime = (value) => {
  if (!value) return "No sale time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "No sale time";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
    timeZoneName: "short"
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
  try {
    localStorage.setItem(
      "stock_trader_dashboard_launch",
      JSON.stringify({ role, at: Date.now() })
    );
  } catch {
    // Navigation should never fail because localStorage is unavailable.
  }
  if (isLoginPage()) {
    const overlay = document.getElementById("authLoadingOverlay");
    document.body.classList.add("dashboard-launching");
    if (overlay && !overlay.classList.contains("hidden")) {
      overlay.classList.add("auth-loading-success");
    }
    window.setTimeout(() => {
      window.location.href = target;
    }, 620);
    return;
  }
  window.location.href = target;
}

function setupSmartLoginLinks() {
  document.querySelectorAll('a[href="./login.html"]').forEach((link) => {
    link.addEventListener("click", (event) => {
      const auth = getAuth();
      if (!auth?.token || !auth.role) return;
      event.preventDefault();
      goToDashboard(auth.role);
    });
  });
}

function removeDeprecatedPublicNavigation() {
  const blockedTargets = ["products.html", "trust-safety.html", "legal.html"];
  document.querySelectorAll("a[href]").forEach((link) => {
    const href = String(link.getAttribute("href") || "").toLowerCase();
    if (blockedTargets.some((target) => href.includes(target))) {
      link.remove();
    }
  });
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
  target.classList.add("portal-visible");
}

function showAuthLoading(title, text) {
  const overlay = document.getElementById("authLoadingOverlay");
  const titleNode = document.getElementById("authLoadingTitle");
  const textNode = document.getElementById("authLoadingText");
  if (!overlay) return;
  if (titleNode) titleNode.textContent = title || "Opening dashboard...";
  if (textNode) textNode.textContent = text || "Please wait while we verify access and load your workspace.";
  overlay.classList.remove("auth-loading-success");
  overlay.classList.remove("hidden");
  overlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function hideAuthLoading() {
  const overlay = document.getElementById("authLoadingOverlay");
  if (!overlay) return;
  overlay.classList.add("hidden");
  overlay.classList.remove("auth-loading-success");
  document.body.classList.remove("dashboard-launching");
  overlay.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setupDashboardLaunchReveal() {
  if (!isAdminDashboardPage() && !isUserDashboardPage()) return;
  let launch = null;
  try {
    launch = JSON.parse(localStorage.getItem("stock_trader_dashboard_launch") || "null");
    localStorage.removeItem("stock_trader_dashboard_launch");
  } catch {
    launch = null;
  }
  const isFreshLaunch = launch && Date.now() - Number(launch.at || 0) < 8000;
  if (!isFreshLaunch) return;
  document.body.classList.add("dashboard-arriving");
  document.body.dataset.launchRole = launch.role || "";
  window.setTimeout(() => {
    document.body.classList.remove("dashboard-arriving");
    delete document.body.dataset.launchRole;
  }, 2600);
}

function getSiteControls() {
  return siteControlsCache;
}

function saveSiteControls(nextControls) {
  localStorage.setItem(SITE_CONTROL_KEY, JSON.stringify(nextControls));
  siteControlsCache = { ...siteControlsCache, ...nextControls };
}

function getApiBase() {
  const savedApiUrl = localStorage.getItem("stock_trader_api_url");
  const host = window.location.hostname;
  const isLocalFrontend = host === "localhost" || host === "127.0.0.1";
  if (isLocalFrontend) {
    const isLocalApi = savedApiUrl && /localhost|127\.0\.0\.1/i.test(savedApiUrl);
    return isLocalApi ? savedApiUrl : "http://localhost:8000/api/v1";
  }
  return savedApiUrl || "https://stock-trader-demo-backend.onrender.com/api/v1";
}

function notifyPortfolioChanged() {
  try {
    localStorage.setItem("stock_trader_portfolio_updated", String(Date.now()));
  } catch {
    // Ignore storage errors; polling still keeps dashboards fresh.
  }
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

function humanizeApiField(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeApiErrorDetail(detail) {
  if (!detail) return "Request failed";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        const field = Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : "";
        const message = item?.msg || "Invalid value";
        return field ? `${humanizeApiField(field)}: ${message}` : message;
      })
      .join(" ");
  }
  if (typeof detail === "object") {
    return detail.msg || detail.message || JSON.stringify(detail);
  }
  return String(detail);
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
    throw new Error(normalizeApiErrorDetail(data.detail));
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
          <div class="activity-copy">
            <strong>${escapeHtml(holding.symbol)}</strong>
            <small>${Number(holding.quantity || 0).toLocaleString("en-IN")} shares added on ${formatDate(holding.created_at)}</small>
          </div>
          <span class="activity-pnl ${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}</span>
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
  const pushCandidate = (symbol, label, sector, price, name = "") => {
    const safeSymbol = String(symbol || "").trim().toUpperCase();
    if (!safeSymbol) return;
    if (map.has(safeSymbol)) {
      const existing = map.get(safeSymbol);
      map.set(safeSymbol, {
        ...existing,
        label: label || existing.label,
        name: name || existing.name,
        sector: sector || existing.sector,
        price: Number(price || 0) || existing.price
      });
      return;
    }
    map.set(safeSymbol, {
      symbol: safeSymbol,
      label: label || name || safeSymbol,
      name: name || label || safeSymbol,
      sector: sector || "Suggested",
      price: Number(price || 0)
    });
  };

  STOCK_SEARCH_CATALOG.forEach((stock) => {
    pushCandidate(stock.symbol, stock.name, stock.sector, 0, stock.name);
  });
  performance.forEach((holding) => {
    pushCandidate(
      holding.symbol,
      holding.symbol,
      holding.sector || "Tracked holding",
      holding.current_price || holding.buy_price,
      holding.name || `${holding.symbol} holding`
    );
  });
  recommendationFeed.forEach((quote) => {
    pushCandidate(
      quote.symbol,
      quote.short_name || quote.symbol,
      quote.short_name || quote.symbol,
      quote.price,
      quote.short_name || quote.symbol
    );
  });
  USER_RECOMMENDATION_SYMBOLS.forEach((symbol) => {
    pushCandidate(symbol, symbol, "NSE", 0, symbol);
  });

  return [...map.values()];
}

function getLooseSearchScore(query, value) {
  const normalizedQuery = normalizeSearchText(query).replace(/[^a-z0-9]/g, "");
  const normalizedValue = normalizeSearchText(value).replace(/[^a-z0-9]/g, "");
  if (!normalizedQuery || !normalizedValue) return 0;
  let score = 0;
  let cursor = 0;
  for (const char of normalizedQuery) {
    const foundAt = normalizedValue.indexOf(char, cursor);
    if (foundAt === -1) continue;
    score += Math.max(1, 12 - (foundAt - cursor));
    cursor = foundAt + 1;
  }
  return score >= normalizedQuery.length ? score : 0;
}

function getAlphabetSearchScore(query, candidate) {
  const normalizedQuery = normalizeSearchText(query).replace(/[^a-z0-9]/g, "");
  const symbol = normalizeSearchText(candidate.symbol).replace(/[^a-z0-9]/g, "");
  const name = normalizeSearchText(candidate.name || candidate.label).replace(/[^a-z0-9]/g, "");
  const sector = normalizeSearchText(candidate.sector).replace(/[^a-z0-9]/g, "");
  if (!normalizedQuery) return 0;
  const hasDirectMatch = symbol.includes(normalizedQuery) || name.includes(normalizedQuery) || sector.includes(normalizedQuery);
  if (normalizedQuery.length >= 3 && !hasDirectMatch) return 0;

  let score = 0;
  if (symbol === normalizedQuery) score += 1000;
  if (symbol.startsWith(normalizedQuery)) score += 840;
  if (name.startsWith(normalizedQuery)) score += 720;
  if (symbol.includes(normalizedQuery)) score += 560 - symbol.indexOf(normalizedQuery);
  if (name.includes(normalizedQuery)) score += 460 - name.indexOf(normalizedQuery);
  if (sector.includes(normalizedQuery)) score += 140;
  if (normalizedQuery.length <= 2) {
    score += getLooseSearchScore(normalizedQuery, candidate.symbol);
    score += Math.round(getLooseSearchScore(normalizedQuery, candidate.name || candidate.label) * 0.6);
  }
  return score;
}

function getClosestSymbolMatches(query, candidates, limit = 6) {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return candidates.slice(0, limit);
  }

  return candidates
    .map((candidate) => {
      return { candidate, score: getAlphabetSearchScore(normalizedQuery, candidate) };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.symbol.localeCompare(b.candidate.symbol))
    .slice(0, limit)
    .map((entry) => entry.candidate);
}

function mergeSymbolCandidates(...candidateGroups) {
  const map = new Map();
  candidateGroups.flat().forEach((candidate) => {
    const symbol = String(candidate?.symbol || "").trim().toUpperCase();
    if (!symbol) return;
    const current = map.get(symbol);
    map.set(symbol, {
      ...current,
      ...candidate,
      symbol,
      label: candidate.label || candidate.name || current?.label || symbol,
      name: candidate.name || candidate.label || current?.name || symbol,
      sector: candidate.sector || current?.sector || "NSE equity",
      price: Number(candidate.price || 0) || Number(current?.price || 0)
    });
  });
  return [...map.values()];
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
            <small>${escapeHtml(quote.short_name || quote.symbol)}</small>
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
      ? `${visibleCount} holding${visibleCount === 1 ? "" : "s"} visible  -  ${currency(visibleValue)} in view`
      : "No holdings match the current search or filter.";
  }

  renderHoldingsSearchSuggestions(rows.filter((row) => !row.hidden));
}

function setupPortfolioSymbolSuggestions() {
  const input = document.querySelector('#portfolioForm [name="symbol"]');
  const suggestions = document.getElementById("portfolioSymbolSuggestions");
  const buyPriceInput = document.querySelector('#portfolioForm [name="buyPrice"]');
  const livePriceBox = document.getElementById("portfolioLivePricePreview");
  const livePriceValue = document.getElementById("portfolioLivePriceValue");
  const livePriceMeta = document.getElementById("portfolioLivePriceMeta");
  if (!input || !suggestions) return;
  let quoteLookupTimer;
  let marketSearchTimer;
  let activeSuggestionIndex = -1;
  let remoteSearchResults = [];

  const setLivePricePreview = (message, state = "idle", meta = "") => {
    if (livePriceBox) livePriceBox.dataset.state = state;
    if (livePriceValue) livePriceValue.textContent = message;
    if (livePriceMeta) livePriceMeta.textContent = meta;
  };

  const applyQuotePrice = (symbol, price, source = "live market") => {
    const livePrice = Number(price || 0);
    if (!livePrice) return;
    setLivePricePreview(currency(livePrice), "ready", `${symbol.toUpperCase()} ${source}`);
    if (buyPriceInput) buyPriceInput.value = livePrice.toFixed(2);
  };

  const fetchAndApplyQuote = async (symbol) => {
    const safeSymbol = String(symbol || "").trim().toUpperCase();
    if (safeSymbol.length < 2) {
      setLivePricePreview("Select a stock", "idle", "Live price will appear here.");
      return;
    }
    setLivePricePreview("Fetching...", "loading", `Checking ${safeSymbol}`);
    try {
      const quote = await api(`/stocks/${encodeURIComponent(safeSymbol)}?exchange=NSE`);
      const price = Number(quote?.quote?.price ?? quote?.price ?? 0);
      applyQuotePrice(safeSymbol, price, quote?.quote?.data_source ? `${quote.quote.data_source} price` : "live price");
    } catch {
      const cached = getClosestSymbolMatches(safeSymbol, userDashboardCache.symbolCatalog, 1)[0];
      if (cached?.price) {
        applyQuotePrice(safeSymbol, cached.price, "cached price");
      } else {
        setLivePricePreview("Price unavailable", "error", "Enter buy price manually.");
      }
    }
  };

  const scheduleQuoteLookup = () => {
    window.clearTimeout(quoteLookupTimer);
    quoteLookupTimer = window.setTimeout(() => fetchAndApplyQuote(input.value), 450);
  };

  const searchMarketSymbols = async (query) => {
    const safeQuery = String(query || "").trim();
    if (!safeQuery) {
      remoteSearchResults = [];
      return;
    }
    const cacheKey = safeQuery.toLowerCase();
    if (marketSymbolSearchCache.has(cacheKey)) {
      remoteSearchResults = marketSymbolSearchCache.get(cacheKey);
      renderSuggestions();
      return;
    }
    try {
      const results = await api(`/stocks/search?q=${encodeURIComponent(safeQuery)}&exchange=NSE&limit=12`);
      remoteSearchResults = Array.isArray(results)
        ? results.map((item) => ({
            symbol: item.symbol,
            label: item.name || item.symbol,
            name: item.name || item.symbol,
            sector: item.sector || item.exchange || "NSE equity",
            price: Number(item.price || 0),
            source: item.source || "market_search"
          }))
        : [];
      marketSymbolSearchCache.set(cacheKey, remoteSearchResults);
      renderSuggestions();
    } catch {
      remoteSearchResults = [];
    }
  };

  const scheduleMarketSearch = () => {
    window.clearTimeout(marketSearchTimer);
    marketSearchTimer = window.setTimeout(() => searchMarketSymbols(input.value), 220);
  };

  const getSuggestionButtons = () => [...suggestions.querySelectorAll("[data-symbol-suggestion]")];

  const setActiveSuggestion = (index) => {
    const buttons = getSuggestionButtons();
    if (!buttons.length) {
      activeSuggestionIndex = -1;
      return;
    }
    activeSuggestionIndex = (index + buttons.length) % buttons.length;
    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === activeSuggestionIndex);
      button.setAttribute("aria-selected", buttonIndex === activeSuggestionIndex ? "true" : "false");
    });
    buttons[activeSuggestionIndex]?.scrollIntoView({ block: "nearest" });
  };

  const selectSymbol = (symbol, price = 0, source = "suggested price") => {
    input.value = String(symbol || "").toUpperCase();
    if (Number(price || 0) > 0) {
      applyQuotePrice(input.value, Number(price), source);
    }
    fetchAndApplyQuote(input.value);
    suggestions.innerHTML = "";
    activeSuggestionIndex = -1;
    buyPriceInput?.focus();
  };

  const renderSuggestions = () => {
    const combinedCandidates = mergeSymbolCandidates(remoteSearchResults, userDashboardCache.symbolCatalog);
    const matches = getClosestSymbolMatches(input.value, combinedCandidates, 8);
    activeSuggestionIndex = -1;
    suggestions.innerHTML = matches.length
      ? matches
          .map(
            (candidate) => `
              <button class="symbol-suggestion-btn" type="button" data-symbol-suggestion="${escapeHtml(candidate.symbol)}" data-symbol-price="${Number(candidate.price || 0).toFixed(2)}">
                <span class="symbol-suggestion-main">
                  <strong>${escapeHtml(candidate.symbol)}</strong>
                  <small>${escapeHtml(candidate.name || candidate.label || "")}</small>
                </span>
                ${Number(candidate.price || 0) > 0 ? `<span class="symbol-suggestion-meta"><strong>${currency(candidate.price)}</strong></span>` : ""}
              </button>
            `
          )
          .join("")
      : `<span class="search-empty">No close match yet. Try company name like Tata, bank, ITC, Infosys.</span>`;
  };

  input.setAttribute("placeholder", "Search stock or company name");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");

  input.addEventListener("focus", renderSuggestions);
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase();
    renderSuggestions();
    input.setAttribute("aria-expanded", suggestions.innerHTML ? "true" : "false");
    scheduleMarketSearch();
    scheduleQuoteLookup();
  });
  input.addEventListener("keydown", (event) => {
    const buttons = getSuggestionButtons();
    if (!buttons.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex - 1);
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const button = buttons[activeSuggestionIndex];
      selectSymbol(button.dataset.symbolSuggestion, Number(button.dataset.symbolPrice || 0));
    } else if (event.key === "Escape") {
      suggestions.innerHTML = "";
      activeSuggestionIndex = -1;
      input.setAttribute("aria-expanded", "false");
    }
  });

  suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-symbol-suggestion]");
    if (!button) return;
    selectSymbol(button.dataset.symbolSuggestion, Number(button.dataset.symbolPrice || 0));
  });

  document.addEventListener("click", (event) => {
    if (event.target === input || suggestions.contains(event.target)) return;
    suggestions.innerHTML = "";
    activeSuggestionIndex = -1;
    input.setAttribute("aria-expanded", "false");
  });

  renderSuggestions();
  setLivePricePreview("Select a stock", "idle", "Live price will appear here.");
}

function setupUserRecommendationButtons() {
  document.querySelectorAll("[data-recommend-symbol]").forEach((button) => {
    button.addEventListener("click", () => {
      const form = document.getElementById("portfolioForm");
      const symbolInput = form?.querySelector('[name="symbol"]');
      const buyPriceInput = form?.querySelector('[name="buyPrice"]');
      const livePriceValue = document.getElementById("portfolioLivePriceValue");
      const livePriceMeta = document.getElementById("portfolioLivePriceMeta");
      const livePriceBox = document.getElementById("portfolioLivePricePreview");
      if (!form || !symbolInput) return;
      symbolInput.value = String(button.dataset.recommendSymbol || "").toUpperCase();
      if (buyPriceInput && Number(button.dataset.recommendPrice || 0) > 0) {
        const price = Number(button.dataset.recommendPrice);
        buyPriceInput.value = price.toFixed(2);
        if (livePriceBox) livePriceBox.dataset.state = "ready";
        if (livePriceValue) livePriceValue.textContent = currency(price);
        if (livePriceMeta) livePriceMeta.textContent = `${symbolInput.value} suggested price`;
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
  if (document.body.classList.contains("dashboard-page")) return;

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

async function safeAdminUserDashboards(users) {
  const settled = await Promise.allSettled(users.map((user) => api(`/admin/users/${user.user_id}/dashboard?audit=false`)));
  return settled
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
}

async function loadAdminPortalData() {
  try {
    const [overview, archivedUsers] = await Promise.all([
      api("/admin/portfolio-overview"),
      api("/admin/users/archived").catch(() => [])
    ]);
    return {
      dashboard: overview.dashboard || {},
      users: Array.isArray(overview.users) ? overview.users : [],
      archivedUsers: Array.isArray(archivedUsers) ? archivedUsers : [],
      systemStatus: overview.system_status || {},
      userDashboards: Array.isArray(overview.user_dashboards) ? overview.user_dashboards : []
    };
  } catch {
    const [dashboard, users, archivedUsers, systemStatus] = await Promise.all([
      api("/admin/dashboard"),
      api("/admin/users"),
      api("/admin/users/archived").catch(() => []),
      api("/admin/system-status")
    ]);
    const safeUsers = Array.isArray(users) ? users : [];
    return {
      dashboard,
      users: safeUsers,
      archivedUsers: Array.isArray(archivedUsers) ? archivedUsers : [],
      systemStatus,
      userDashboards: await safeAdminUserDashboards(safeUsers)
    };
  }
}

function buildUserDownloadHtml(dashboard) {
  const investedValue = (dashboard.holdings || []).reduce(
    (sum, holding) => sum + Number(holding.buy_price || 0) * Number(holding.quantity || 0),
    0
  );
  const holdings = Array.isArray(dashboard.holdings) ? dashboard.holdings : [];
  const sales = Array.isArray(dashboard.sales) ? dashboard.sales : [];
  const bookedPnl = Number(dashboard.booked_profit_loss || 0);
  const lifetimePnl = Number(dashboard.lifetime_profit_loss ?? dashboard.total_profit_loss ?? 0);
  const lifetimeReturn = investedValue ? (lifetimePnl / investedValue) * 100 : 0;
  const generatedAt = new Date().toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
    timeZoneName: "short"
  });
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <base href="${window.location.href.replace(/[^/]*$/, "")}" />
        <title>${escapeHtml(dashboard.full_name)} Profile PDF</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #0b172f; background: #eef5f1; }
          .page { max-width: 1120px; margin: 0 auto; padding: 28px; }
          .report { border: 1px solid #d9e5df; border-radius: 24px; padding: 26px; background: #ffffff; }
          .header { display: flex; justify-content: space-between; gap: 18px; align-items: flex-start; border-bottom: 1px solid #e5ece8; padding-bottom: 18px; }
          .header-copy { position: relative; z-index: 1; }
          .brand { color: #0f766e; font-family: Poppins, Arial, sans-serif; font-weight: 900; letter-spacing: 0.08em; text-transform: uppercase; }
          .pdf-market-mark { width: 142px; height: 82px; display: block; object-fit: contain; opacity: 0.95; }
          h1, h2 { margin: 8px 0; }
          h1 { font-size: 2rem; letter-spacing: -0.04em; }
          h2 { margin-top: 24px; font-size: 1.15rem; }
          .subtle { color: #53645e; margin: 0; line-height: 1.55; }
          .pill { display: inline-flex; border: 1px solid #d9e5df; border-radius: 999px; padding: 8px 12px; color: #0f2f28; background: #f6fbf8; font-weight: 800; }
          .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
          .card { border: 1px solid #d9e5df; border-radius: 18px; padding: 16px; background: #fbfdfc; }
          .card strong { display: block; color: #53645e; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.08em; }
          .card div { margin-top: 8px; font-size: 1.35rem; font-weight: 900; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; background: #fff; font-size: 0.92rem; }
          th, td { border-bottom: 1px solid #e5ece8; padding: 10px 8px; text-align: left; vertical-align: top; }
          th { color: #53645e; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.08em; background: #f3f8f5; }
          .profit { color: #0f9f62; font-weight: bold; }
          .loss { color: #d64045; font-weight: bold; }
          .note { margin-top: 18px; color: #53645e; font-size: 0.9rem; line-height: 1.55; }
          .actions { margin: 18px 0; text-align: right; }
          button { border: 0; border-radius: 999px; padding: 12px 18px; color: #fff; background: #0f766e; font-weight: 800; cursor: pointer; }
          @media print {
            body { background: #ffffff; }
            .page { max-width: none; padding: 0; }
            .report { border: 0; border-radius: 0; padding: 0; }
            .actions { display: none; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        <div class="page">
          <div class="actions"><button type="button" onclick="window.print()">Save As PDF</button></div>
          <section class="report">
            <div class="header">
              <div class="header-copy">
                <div class="brand">AssetYantra</div>
                <h1>${escapeHtml(dashboard.full_name)} Profile</h1>
                <p class="subtle">${escapeHtml(dashboard.fixed_user_id || dashboard.username || "Client")} | ${escapeHtml(dashboard.phone_number || "Phone not available")}</p>
              </div>
              <div>
                <img class="pdf-market-mark" src="./assets/bull-bear-market.svg?v=3" alt="" />
                <div class="pill">Generated ${generatedAt}</div>
              </div>
            </div>
            <div class="grid">
              <div class="card"><strong>Total Holdings</strong><div>${Number(dashboard.total_holdings || holdings.length).toLocaleString("en-IN")}</div></div>
              <div class="card"><strong>Invested Value</strong><div>${currency(investedValue)}</div></div>
              <div class="card"><strong>Current Value</strong><div>${currency(dashboard.total_portfolio_value)}</div></div>
              <div class="card"><strong>Lifetime P&amp;L</strong><div class="${lifetimePnl >= 0 ? "profit" : "loss"}">${currency(lifetimePnl)} (${percent(lifetimeReturn)})</div></div>
            </div>
            <h2>Current Equity Holdings</h2>
            <table>
              <thead><tr><th>Script</th><th>Exchange</th><th>Quantity</th><th>Buy Price</th><th>Buy Value</th><th>Live Price</th><th>Live Value</th><th>Unrealised P&amp;L</th><th>Return</th></tr></thead>
              <tbody>
                ${holdings.length
                  ? holdings
                      .map((holding) => {
                        const buyValue = Number(holding.buy_price || 0) * Number(holding.quantity || 0);
                        const returnPct = buyValue ? (Number(holding.profit_loss || 0) / buyValue) * 100 : 0;
                        return `<tr><td>${escapeHtml(holding.symbol)}</td><td>${escapeHtml(holding.exchange || "NSE")}</td><td>${Number(holding.quantity || 0).toLocaleString("en-IN")}</td><td>${currency(holding.buy_price)}</td><td>${currency(buyValue)}</td><td>${currency(holding.current_price)}</td><td>${currency(holding.value)}</td><td class="${holding.profit_loss >= 0 ? "profit" : "loss"}">${currency(holding.profit_loss)}</td><td class="${returnPct >= 0 ? "profit" : "loss"}">${percent(returnPct)}</td></tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="9">No current holdings.</td></tr>`}
              </tbody>
            </table>
            <h2>Sold / Booked Deals</h2>
            <table>
              <thead><tr><th>Script</th><th>Qty Sold</th><th>Buy Price</th><th>Sell Price</th><th>Booked P&amp;L</th><th>Sold Time</th></tr></thead>
              <tbody>
                ${sales.length
                  ? sales
                      .map((sale) => `<tr><td>${escapeHtml(sale.symbol)}</td><td>${Number(sale.quantity || 0).toLocaleString("en-IN")}</td><td>${currency(sale.buy_price)}</td><td>${currency(sale.sell_price)}</td><td class="${Number(sale.profit_loss || 0) >= 0 ? "profit" : "loss"}">${currency(sale.profit_loss)}</td><td>${formatIndianSoldDateTime(sale.sold_at)}</td></tr>`)
                      .join("")
                  : `<tr><td colspan="6">No sold deals recorded yet.</td></tr>`}
              </tbody>
            </table>
            <p class="note">This profile is generated from the admin dashboard. Live values depend on the latest market quote available to AssetYantra at the time of generation. Booked P&amp;L shown: ${currency(bookedPnl)}.</p>
          </section>
        </div>
      </body>
    </html>
  `;
}

function safeFilename(value) {
  return String(value || "client-profile")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "client-profile";
}

function openUserProfilePdf(dashboard) {
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    alert("Allow popups to open the PDF profile.");
    return;
  }
  const html = buildUserDownloadHtml(dashboard);
  const filename = `${safeFilename(dashboard.fixed_user_id || dashboard.username || dashboard.full_name)}-profile-pdf`;
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.document.title = filename;
  window.setTimeout(() => {
    reportWindow.focus();
    reportWindow.print();
  }, 350);
}

function logoutAndResetPortals() {
  clearAuth();
  activeRole = null;
  activeUserId = null;
  stopLiveDashboardPrices();
  hidePortalMounts();
  hideAuthLoading();
  window.location.href = "./login.html";
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

async function setupHomeLiveTicker() {
  const mount = document.getElementById("homeLiveTicker");
  if (!mount) return;

  const renderHomeTicker = async () => {
    const fallbackFeed = HOME_TICKER_SYMBOLS.map((symbol) => HOME_TICKER_FALLBACK[symbol]);
    const feed = await api(`/stocks/feed?symbols=${encodeURIComponent(HOME_TICKER_SYMBOLS.join(","))}`).catch(() => fallbackFeed);
    const quotes = Array.isArray(feed) && feed.length ? feed : fallbackFeed;
    const latestFetch = quotes.find((quote) => quote.fetched_at)?.fetched_at;
    const tickerItems = quotes
      .map((quote) => {
        const change = Number(quote.change_percent || 0);
        const symbol = quote.symbol === "NIFTY50" ? "NIFTY 50" : quote.symbol;
        return `
          <article class="home-ticker-item ${change >= 0 ? "is-up" : "is-down"}">
            <span class="ticker-dot"></span>
            <strong>${escapeHtml(symbol)} <em>${currency(quote.price)}</em></strong>
            <small>${percent(change)} ${quote.is_fallback ? "Backup" : "Live"}</small>
          </article>
      `;
      })
      .join("");
    mount.innerHTML = `
      <div class="home-ticker-track">${tickerItems}${tickerItems}</div>
      <span class="home-live-status">Updated ${latestFetch ? formatDateTime(latestFetch) : new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
    `;
  };

  window.clearInterval(liveTickerTimer);
  await renderHomeTicker();
  liveTickerTimer = window.setInterval(() => {
    renderHomeTicker().catch(() => {});
  }, 30000);
}

function setPriceClass(node, value) {
  if (!node) return;
  node.classList.toggle("profit", Number(value || 0) >= 0);
  node.classList.toggle("loss", Number(value || 0) < 0);
  node.classList.toggle("price-up", Number(value || 0) >= 0);
  node.classList.toggle("price-down", Number(value || 0) < 0);
}

async function refreshVisibleDashboardPrices() {
  const rows = [...document.querySelectorAll("[data-live-symbol]")];
  if (!rows.length) return;

  const symbols = [...new Set(rows.map((row) => row.dataset.liveSymbol).filter(Boolean))];
  if (!symbols.length) return;

  const feed = await api(`/stocks/feed?symbols=${encodeURIComponent(symbols.join(","))}`).catch(() => []);
  const quoteMap = new Map(
    (Array.isArray(feed) ? feed : []).map((quote) => [String(quote.symbol || "").toUpperCase(), quote])
  );
  const summaryRows = rows.filter((row) => row.dataset.liveSummary === "true");
  let totalLiveValue = 0;
  let totalBuyValue = 0;

  rows.forEach((row) => {
    const symbol = String(row.dataset.liveSymbol || "").toUpperCase();
    const quote = quoteMap.get(symbol);
    if (!quote) return;

    const quantity = Number(row.dataset.quantity || 0);
    const buyPrice = Number(row.dataset.buyPrice || 0);
    const buyValue = buyPrice * quantity;
    const livePrice = Number(quote.price || 0);
    const liveValue = livePrice * quantity;
    const pnl = liveValue - buyValue;
    const returnPct = buyValue ? (pnl / buyValue) * 100 : 0;

    row.dataset.currentPrice = String(livePrice);
    row.dataset.value = String(liveValue);
    if (summaryRows.length ? row.dataset.liveSummary === "true" : true) {
      totalLiveValue += liveValue;
      totalBuyValue += buyValue;
    }

    const livePriceCell = row.querySelector("[data-live-price-cell]");
    const liveValueCell = row.querySelector("[data-live-value-cell]");
    const pnlCell = row.querySelector("[data-pnl-cell]");
    const returnCell = row.querySelector("[data-return-cell]");
    const sellButton = row.querySelector("[data-admin-sell-holding]");

    if (livePriceCell) {
      livePriceCell.textContent = currency(livePrice);
      setPriceClass(livePriceCell, Number(quote.change_percent || 0));
    }
    if (liveValueCell) {
      liveValueCell.textContent = currency(liveValue);
      setPriceClass(liveValueCell, pnl);
    }
    if (pnlCell) {
      pnlCell.textContent = currency(pnl);
      setPriceClass(pnlCell, pnl);
    }
    if (returnCell) {
      returnCell.textContent = percent(returnPct);
      setPriceClass(returnCell, returnPct);
    }
    if (sellButton) sellButton.dataset.livePrice = String(livePrice);
  });

  const bookedPnl = Number(document.querySelector("[data-live-booked-pnl]")?.dataset.liveBookedPnl || 0);
  const totalPnl = totalLiveValue - totalBuyValue + bookedPnl;
  document.querySelectorAll("[data-live-total-value]").forEach((node) => {
    node.textContent = currency(totalLiveValue);
    setPriceClass(node, totalLiveValue - totalBuyValue);
  });
  document.querySelectorAll("[data-live-total-pnl]").forEach((node) => {
    node.textContent = currency(totalPnl);
    setPriceClass(node, totalPnl);
  });
  document.querySelectorAll("[data-live-total-return]").forEach((node) => {
    node.textContent = percent(totalBuyValue ? (totalPnl / totalBuyValue) * 100 : 0);
    setPriceClass(node, totalPnl);
  });

  const status = document.querySelector("[data-live-price-status]");
  if (status) {
    status.textContent = `Live prices updated ${new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
  }
}

function startLiveDashboardPrices() {
  stopLiveDashboardPrices();
  refreshVisibleDashboardPrices().catch(() => {});
  liveDashboardPriceTimer = window.setInterval(() => {
    refreshVisibleDashboardPrices().catch(() => {});
  }, 20000);
}

function stopLiveDashboardPrices() {
  if (!liveDashboardPriceTimer) return;
  window.clearInterval(liveDashboardPriceTimer);
  liveDashboardPriceTimer = null;
}

function todayLabel() {
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date());
}

async function setupHomeLiveNews() {
  const mount = document.getElementById("homeLiveNews");
  const dateBadge = document.getElementById("homeNewsDate");
  if (!mount) return;

  const today = todayLabel();
  if (dateBadge) dateBadge.textContent = today;

  const fallbackNews = [
    { title: "NIFTY 50 and SENSEX remain the key market indicators to watch today.", source: "Market Desk" },
    { title: "Banking and IT stocks are being tracked closely for portfolio movement.", source: "Live Watch" },
    { title: "Client portfolio P/L updates as live prices move through the session.", source: "Portfolio Feed" },
    { title: "Admins can review stock-wise client exposure directly from the dashboard.", source: "Dashboard Update" }
  ];

  const newsResponse = await api("/stocks/market/news").catch(() => []);
  const liveNews = (Array.isArray(newsResponse) ? newsResponse : [])
    .filter((article) => article?.title)
    .slice(0, 6);
  const news = liveNews.length ? liveNews : fallbackNews;
  let index = 0;

  const showNews = () => {
    const item = news[index % news.length];
    mount.innerHTML = `
      <article class="home-news-item">
        <span>${escapeHtml(item.source || "Market News")} · ${today}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${liveNews.length ? "Alpha Vantage news feed" : "Market brief while Alpha Vantage is rate-limited"}</small>
      </article>
    `;
    index += 1;
  };

  showNews();
  window.setInterval(showNews, 3200);
}

function setupDownloadButtons(userDashboards = []) {
  const dashboardMap = new Map(userDashboards.map((user) => [String(user.user_id), user]));
  document.querySelectorAll("[data-download-user-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const dashboard = dashboardMap.get(String(button.dataset.downloadUserId));
      if (!dashboard) return;
      openUserProfilePdf(dashboard);
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
  const scriptSearchInput = document.getElementById("adminScriptSearch");
  const statusFilter = document.getElementById("adminUserStatusFilter");
  const selectAll = document.getElementById("adminSelectAllUsers");
  const bulkActivate = document.getElementById("bulkActivateUsersBtn");
  const bulkDisable = document.getElementById("bulkDisableUsersBtn");
  const bulkDelete = document.getElementById("bulkDeleteUsersBtn");
  const bulkArchive = document.getElementById("bulkArchiveUsersBtn");

  if (searchInput) {
    searchInput.value = adminUiState.search;
    searchInput.addEventListener("input", () => {
      adminUiState.search = searchInput.value.trim();
      window.clearTimeout(adminSearchRenderTimer);
      adminSearchRenderTimer = window.setTimeout(() => renderAdminPortal().catch(() => {}), 450);
    });
  }

  if (scriptSearchInput) {
    scriptSearchInput.value = adminUiState.scriptSearch;
    scriptSearchInput.addEventListener("input", () => {
      adminUiState.scriptSearch = scriptSearchInput.value.trim();
      window.clearTimeout(adminSearchRenderTimer);
      adminSearchRenderTimer = window.setTimeout(() => renderAdminPortal().catch(() => {}), 450);
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
      runBulkAction("archive", bulkDelete, "Archive all selected clients? Their data will be kept, but they will be hidden from active views.")
    );
  }

  if (bulkArchive) {
    bulkArchive.addEventListener("click", async () =>
      runBulkAction("archive", bulkArchive, "Archive all selected clients? Their data will be kept, but they will be hidden from active views.")
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
      const confirmed = window.confirm(`Archive ${userName}? Their login will be disabled and portfolio data will be kept.`);
      if (!confirmed) return;
      const stopLoading = setButtonLoading(button, "Archiving...");
      try {
        await api(`/admin/users/${userId}`, { method: "DELETE" });
        if (statusMessage) {
          statusMessage.textContent = `${userName} was archived successfully.`;
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

  document.querySelectorAll("[data-archive-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.archiveUser;
      const userName = button.dataset.userName || "this client";
      const confirmed = window.confirm(`Archive ${userName}? Their login will be disabled and they will be hidden from active admin views, but portfolio data will be kept.`);
      if (!confirmed) return;
      const stopLoading = setButtonLoading(button, "Archiving...");
      try {
        const archived = await api(`/admin/users/${userId}/archive`, { method: "PATCH" });
        if (statusMessage) {
          statusMessage.textContent = `${archived.full_name} was archived. Portfolio records are still stored.`;
        }
        if (Number(adminUiState.detailKey) === Number(userId)) {
          adminUiState.detailType = null;
          adminUiState.detailKey = null;
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

  document.querySelectorAll("[data-permanent-delete-user]").forEach((button) => {
    button.addEventListener("click", async () => {
      const userId = button.dataset.permanentDeleteUser;
      const userName = button.dataset.userName || "this archived client";
      const confirmed = window.confirm(`Permanently delete ${userName}? This is only allowed for archived clients and will remove their portfolio records forever.`);
      if (!confirmed) return;
      const stopLoading = setButtonLoading(button, "Deleting...");
      try {
        await api(`/admin/users/${userId}/permanent`, { method: "DELETE" });
        if (statusMessage) {
          statusMessage.textContent = `${userName} was permanently deleted.`;
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
  const holdings = Array.isArray(user.holdings) ? user.holdings : [];
  const investedValue = holdings.reduce((sum, holding) => sum + Number(holding.buy_price || 0) * Number(holding.quantity || 0), 0);
  const currentValue = holdings.reduce((sum, holding) => sum + Number(holding.value || 0), 0);
  const openPnl = currentValue - investedValue;
  const sales = Array.isArray(user.sales) ? user.sales : [];
  const bookedPnl = sales.reduce((sum, sale) => sum + Number(sale.profit_loss || 0), 0);
  const totalPnl = openPnl + bookedPnl;
  const lifetimeReturn = investedValue ? (totalPnl / investedValue) * 100 : 0;
  return `
    <article class="dashboard-card detail-card admin-simple-detail-card">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Client Portfolio</p>
          <h3>${escapeHtml(user.full_name)}</h3>
          <p class="detail-subtitle">${escapeHtml(user.fixed_user_id || user.username || "Client")}</p>
        </div>
        <div class="admin-detail-actions">
          <span class="badge ${totalPnl >= 0 ? "green" : "red"}">Lifetime ${currency(totalPnl)}</span>
          <button class="secondary-btn compact-btn archive-client-btn" type="button" data-archive-user="${user.user_id}" data-user-name="${escapeHtml(user.full_name)}">Archive Client</button>
        </div>
      </div>
      <div class="detail-stat-grid admin-simple-stats">
        <article><strong>${holdings.length}</strong><span>Stocks Holding</span></article>
        <article><strong>${currency(investedValue)}</strong><span>Total Buy Value</span></article>
        <article><strong>${currency(currentValue)}</strong><span>Live Value</span></article>
        <article><strong class="${openPnl >= 0 ? "profit" : "loss"}">${currency(openPnl)}</strong><span>Open Profit / Loss</span></article>
        <article><strong class="${bookedPnl >= 0 ? "profit" : "loss"}">${currency(bookedPnl)}</strong><span>Booked Profit / Loss</span></article>
        <article><strong class="${totalPnl >= 0 ? "profit" : "loss"}">${currency(totalPnl)}</strong><span>Lifetime Profit / Loss</span></article>
        <article><strong class="${lifetimeReturn >= 0 ? "profit" : "loss"}">${percent(lifetimeReturn)}</strong><span>Lifetime Return</span></article>
      </div>
      <div class="table-wrap admin-position-table-wrap">
        <table class="compact-table admin-position-table">
          <thead><tr><th>Stock</th><th>Qty</th><th>Buy Price</th><th>Buy Value</th><th>Live Price</th><th>Live Value</th><th>Profit / Loss</th><th>Return</th><th>Action</th></tr></thead>
          <tbody>
            ${holdings.length
              ? holdings.map((holding) => {
                  const buyValue = Number(holding.buy_price || 0) * Number(holding.quantity || 0);
                  const liveValue = Number(holding.value || 0);
                  const pnl = liveValue - buyValue;
                  const returnPct = buyValue ? (pnl / buyValue) * 100 : 0;
                  return `
                    <tr data-live-symbol="${escapeHtml(holding.symbol)}" data-quantity="${Number(holding.quantity || 0)}" data-buy-price="${Number(holding.buy_price || 0)}" data-current-price="${Number(holding.current_price || 0)}" data-value="${Number(holding.value || 0)}">
                      <td><button class="table-link" type="button" data-stock-detail="${escapeHtml(holding.symbol)}">${escapeHtml(holding.symbol)}</button><br /><small>${escapeHtml(holding.sector || "Tracked holding")}</small></td>
                      <td>${Number(holding.quantity || 0).toLocaleString("en-IN")}</td>
                      <td>${currency(holding.buy_price)}</td>
                      <td>${currency(buyValue)}</td>
                      <td><strong class="${pnl >= 0 ? "price-up" : "price-down"}" data-live-price-cell>${currency(holding.current_price)}</strong></td>
                      <td><strong class="${pnl >= 0 ? "price-up" : "price-down"}" data-live-value-cell>${currency(liveValue)}</strong></td>
                      <td class="${pnl >= 0 ? "profit" : "loss"}" data-pnl-cell>${currency(pnl)}</td>
                      <td class="${returnPct >= 0 ? "profit" : "loss"}" data-return-cell>${percent(returnPct)}</td>
                      <td><button class="sell-action-btn compact-btn" type="button" data-admin-sell-holding="${holding.holding_id}" data-symbol="${escapeHtml(holding.symbol)}" data-quantity="${Number(holding.quantity || 0)}" data-live-price="${Number(holding.current_price || 0)}">Sell</button></td>
                    </tr>
                  `;
                }).join("")
              : `<tr><td colspan="9"><span class="helper-text">This client has not added stocks yet.</span></td></tr>`}
          </tbody>
        </table>
      </div>
    </article>
  `;
}

function setupAdminDealForm() {
  const form = document.getElementById("adminDealForm");
  const statusMessage = document.getElementById("adminDealStatus");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const userId = String(data.get("userId") || "").trim();
    const symbol = String(data.get("symbol") || "").trim().toUpperCase();
    const quantity = Number(data.get("quantity"));
    const buyPrice = Number(data.get("buyPrice"));
    const exchange = String(data.get("exchange") || "NSE").trim().toUpperCase() || "NSE";

    if (!userId || !symbol || !quantity || !buyPrice) {
      if (statusMessage) statusMessage.textContent = "Select customer and enter stock, quantity, and buy price.";
      return;
    }

    const stopLoading = setButtonLoading(submitButton, "Adding...");
    try {
      await api(`/admin/users/${encodeURIComponent(userId)}/deals`, {
        method: "POST",
        body: JSON.stringify({
          symbol,
          quantity,
          buy_price: buyPrice,
          exchange
        })
      });
      if (statusMessage) statusMessage.textContent = `${symbol} deal added successfully. Refreshing dashboard...`;
      notifyPortfolioChanged();
      await renderAdminPortal();
    } catch (error) {
      if (statusMessage) statusMessage.textContent = formatError(error);
    } finally {
      stopLoading();
    }
  });
}

function setupAdminCustomerForm() {
  const form = document.getElementById("adminCustomerForm");
  const statusMessage = document.getElementById("adminCustomerStatus");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const payload = {
      full_name: String(data.get("full_name") || "").trim(),
      email: String(data.get("email") || "").trim(),
      phone_number: String(data.get("phone_number") || "").trim(),
      password: String(data.get("password") || "")
    };
    if (!payload.full_name || !payload.email || !payload.phone_number || payload.password.length < 8) {
      if (statusMessage) statusMessage.textContent = "Enter name, email, phone, and a password with at least 8 characters.";
      return;
    }
    const stopLoading = setButtonLoading(submitButton, "Creating...");
    try {
      const created = await api("/admin/users", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      if (statusMessage) {
        statusMessage.textContent = `${created.full_name} created. Client ID: ${created.fixed_user_id}. Share this ID for user login.`;
      }
      sessionStorage.setItem(
        "assetyantra_admin_customer_status",
        `${created.full_name} created. Client ID: ${created.fixed_user_id}. Share this ID for user login.`
      );
      form.reset();
      await renderAdminPortal();
    } catch (error) {
      if (statusMessage) statusMessage.textContent = formatError(error);
    } finally {
      stopLoading();
    }
  });
}

function setupAdminDealSymbolSuggestions() {
  const form = document.getElementById("adminDealForm");
  const input = form?.querySelector('[name="symbol"]');
  const suggestions = document.getElementById("adminDealSymbolSuggestions");
  const buyPriceInput = form?.querySelector('[name="buyPrice"]');
  const exchangeInput = form?.querySelector('[name="exchange"]');
  const statusMessage = document.getElementById("adminDealStatus");
  if (!form || !input || !suggestions) return;

  let marketSearchTimer;
  let quoteLookupTimer;
  let activeSuggestionIndex = -1;
  let remoteSearchResults = [];

  const safeExchange = () => String(exchangeInput?.value || "NSE").trim().toUpperCase() || "NSE";

  const setDealStatus = (message) => {
    if (statusMessage) statusMessage.textContent = message;
  };

  const fetchAndApplyQuote = async (symbol) => {
    const safeSymbol = String(symbol || "").trim().toUpperCase();
    if (safeSymbol.length < 2) return;
    try {
      setDealStatus(`Fetching live price for ${safeSymbol}...`);
      const quote = await api(`/stocks/${encodeURIComponent(safeSymbol)}?exchange=${encodeURIComponent(safeExchange())}`);
      const price = Number(quote?.quote?.price ?? quote?.price ?? 0);
      if (price > 0 && buyPriceInput) {
        buyPriceInput.value = price.toFixed(2);
        setDealStatus(`${safeSymbol} live price loaded: ${currency(price)}.`);
      }
    } catch {
      setDealStatus("Live price unavailable right now. Enter buy price manually.");
    }
  };

  const searchMarketSymbols = async (query) => {
    const safeQuery = String(query || "").trim();
    if (safeQuery.length < 3) {
      remoteSearchResults = [];
      renderSuggestions();
      return;
    }
    const cacheKey = `admin:${safeExchange()}:${safeQuery.toLowerCase()}`;
    if (marketSymbolSearchCache.has(cacheKey)) {
      remoteSearchResults = marketSymbolSearchCache.get(cacheKey);
      renderSuggestions();
      return;
    }
    try {
      const results = await api(`/stocks/search?q=${encodeURIComponent(safeQuery)}&exchange=${encodeURIComponent(safeExchange())}&limit=15`);
      remoteSearchResults = Array.isArray(results)
        ? results.map((item) => ({
            symbol: item.symbol,
            label: item.name || item.symbol,
            name: item.name || item.symbol,
            sector: item.sector || item.exchange || `${safeExchange()} equity`,
            price: Number(item.price || 0),
            source: item.source || "market_search"
          }))
        : [];
      marketSymbolSearchCache.set(cacheKey, remoteSearchResults);
      renderSuggestions();
    } catch {
      remoteSearchResults = [];
      renderSuggestions();
    }
  };

  const scheduleMarketSearch = () => {
    window.clearTimeout(marketSearchTimer);
    marketSearchTimer = window.setTimeout(() => searchMarketSymbols(input.value), 240);
  };

  const scheduleQuoteLookup = () => {
    window.clearTimeout(quoteLookupTimer);
    quoteLookupTimer = window.setTimeout(() => fetchAndApplyQuote(input.value), 500);
  };

  const getSuggestionButtons = () => [...suggestions.querySelectorAll("[data-symbol-suggestion]")];

  const setActiveSuggestion = (index) => {
    const buttons = getSuggestionButtons();
    if (!buttons.length) {
      activeSuggestionIndex = -1;
      return;
    }
    activeSuggestionIndex = (index + buttons.length) % buttons.length;
    buttons.forEach((button, buttonIndex) => {
      button.classList.toggle("is-active", buttonIndex === activeSuggestionIndex);
      button.setAttribute("aria-selected", buttonIndex === activeSuggestionIndex ? "true" : "false");
    });
  };

  const selectSymbol = (symbol, price = 0) => {
    input.value = String(symbol || "").toUpperCase();
    if (Number(price || 0) > 0 && buyPriceInput) buyPriceInput.value = Number(price).toFixed(2);
    suggestions.innerHTML = "";
    activeSuggestionIndex = -1;
    fetchAndApplyQuote(input.value);
    buyPriceInput?.focus();
  };

  function renderSuggestions() {
    const localCandidates = mergeSymbolCandidates(userDashboardCache.symbolCatalog, HOME_TICKER_SYMBOLS.map((symbol) => ({ symbol, name: symbol, sector: "NSE equity" })));
    const matches = getClosestSymbolMatches(input.value, mergeSymbolCandidates(remoteSearchResults, localCandidates), 8);
    suggestions.innerHTML = matches.length
      ? matches
          .map((candidate) => `
            <button class="symbol-suggestion-btn" type="button" data-symbol-suggestion="${escapeHtml(candidate.symbol)}" data-symbol-price="${Number(candidate.price || 0).toFixed(2)}">
              <span class="symbol-suggestion-main">
                <strong>${escapeHtml(candidate.symbol)}</strong>
                <small>${escapeHtml(candidate.name || candidate.label || "")}</small>
              </span>
              ${Number(candidate.price || 0) > 0 ? `<span class="symbol-suggestion-meta"><strong>${currency(candidate.price)}</strong></span>` : ""}
            </button>
          `)
          .join("")
      : `<span class="search-empty">Type at least 3 letters, for example ITC, Tata, Reliance, bank.</span>`;
  }

  input.setAttribute("placeholder", "Type 3 letters of stock or company");
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");

  input.addEventListener("focus", renderSuggestions);
  input.addEventListener("input", () => {
    input.value = input.value.toUpperCase();
    renderSuggestions();
    scheduleMarketSearch();
    scheduleQuoteLookup();
  });
  input.addEventListener("keydown", (event) => {
    const buttons = getSuggestionButtons();
    if (!buttons.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion(activeSuggestionIndex - 1);
    } else if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      const button = buttons[activeSuggestionIndex];
      selectSymbol(button.dataset.symbolSuggestion, Number(button.dataset.symbolPrice || 0));
    } else if (event.key === "Escape") {
      suggestions.innerHTML = "";
      activeSuggestionIndex = -1;
    }
  });

  suggestions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-symbol-suggestion]");
    if (!button) return;
    selectSymbol(button.dataset.symbolSuggestion, Number(button.dataset.symbolPrice || 0));
  });

  exchangeInput?.addEventListener("change", () => {
    suggestions.innerHTML = "";
    scheduleMarketSearch();
    scheduleQuoteLookup();
  });

  document.addEventListener("click", (event) => {
    if (event.target === input || suggestions.contains(event.target)) return;
    suggestions.innerHTML = "";
    activeSuggestionIndex = -1;
  });
}

function setupAdminSellButtons() {
  const statusMessage = document.getElementById("adminUserActionStatus");
  document.querySelectorAll("[data-admin-sell-holding]").forEach((button) => {
    if (button.dataset.adminSellBound === "true") return;
    button.dataset.adminSellBound = "true";
    button.addEventListener("click", async () => {
      const holdingId = button.dataset.adminSellHolding;
      const symbol = button.dataset.symbol || "this stock";
      const maxQuantity = Number(button.dataset.quantity || 0);
      const livePrice = Number(button.dataset.livePrice || 0);
      const quantityInput = window.prompt(`How many shares of ${symbol} should admin sell?`, String(maxQuantity || 1));
      if (quantityInput === null) return;
      const sellQuantity = Number(quantityInput);
      if (!sellQuantity || sellQuantity <= 0 || sellQuantity > maxQuantity) {
        alert(`Enter a sell quantity between 1 and ${maxQuantity}.`);
        return;
      }
      const priceInput = window.prompt(`Sell price for ${symbol}`, livePrice ? String(livePrice.toFixed(2)) : "");
      if (priceInput === null) return;
      const sellPrice = Number(priceInput);
      if (!sellPrice || sellPrice <= 0) {
        alert("Enter a valid sell price.");
        return;
      }
      const stopLoading = setButtonLoading(button, "Selling...");
      try {
        const sale = await api(`/admin/holdings/${encodeURIComponent(holdingId)}/sell`, {
          method: "POST",
          body: JSON.stringify({ quantity: sellQuantity, sell_price: sellPrice })
        });
        if (statusMessage) {
          statusMessage.textContent = `${symbol} sold. Booked P/L: ${currency(sale.profit_loss)}.`;
        }
        notifyPortfolioChanged();
        await renderAdminPortal();
      } catch (error) {
        if (statusMessage) statusMessage.textContent = formatError(error);
      } finally {
        stopLoading();
      }
    });
  });
}

function buildAdminStockDetail(symbol, holdings) {
  const safeHoldings = Array.isArray(holdings) ? holdings : [];
  const totalQty = safeHoldings.reduce((sum, holding) => sum + Number(holding.quantity || 0), 0);
  const investedValue = safeHoldings.reduce((sum, holding) => sum + Number(holding.buy_price || 0) * Number(holding.quantity || 0), 0);
  const currentValue = safeHoldings.reduce((sum, holding) => sum + Number(holding.value || 0), 0);
  const totalPnl = currentValue - investedValue;
  const returnPct = investedValue ? (totalPnl / investedValue) * 100 : 0;
  return `
    <article class="dashboard-card detail-card admin-simple-detail-card">
      <div class="panel-head">
        <div>
          <p class="eyebrow">Stock Holders</p>
          <h3>${escapeHtml(symbol)}</h3>
          <p class="detail-subtitle">Every client currently holding this stock</p>
        </div>
        <span class="badge ${totalPnl >= 0 ? "green" : "red"}">${safeHoldings.length} Client${safeHoldings.length === 1 ? "" : "s"}</span>
      </div>
      <div class="detail-stat-grid admin-simple-stats">
        <article><strong>${safeHoldings.length}</strong><span>Users Holding</span></article>
        <article><strong>${Number(totalQty || 0).toLocaleString("en-IN")}</strong><span>Total Quantity</span></article>
        <article><strong>${currency(investedValue)}</strong><span>Total Buy Value</span></article>
        <article><strong>${currency(currentValue)}</strong><span>Live Value</span></article>
        <article><strong class="${totalPnl >= 0 ? "profit" : "loss"}">${currency(totalPnl)}</strong><span>Total Profit / Loss</span></article>
        <article><strong class="${returnPct >= 0 ? "profit" : "loss"}">${percent(returnPct)}</strong><span>Total Return</span></article>
      </div>
      <div class="table-wrap admin-position-table-wrap">
        <table class="compact-table admin-position-table">
          <thead><tr><th>Client</th><th>Client ID</th><th>Qty</th><th>Buy Price</th><th>Live Price</th><th>Buy Value</th><th>Live Value</th><th>Profit / Loss</th><th>Return</th></tr></thead>
          <tbody>
            ${safeHoldings.length
              ? safeHoldings.map((holding) => {
                  const buyValue = Number(holding.buy_price || 0) * Number(holding.quantity || 0);
                  const liveValue = Number(holding.value || 0);
                  const pnl = liveValue - buyValue;
                  const holdingReturn = buyValue ? (pnl / buyValue) * 100 : 0;
                  return `
                    <tr data-live-symbol="${escapeHtml(holding.symbol)}" data-quantity="${Number(holding.quantity || 0)}" data-buy-price="${Number(holding.buy_price || 0)}" data-current-price="${Number(holding.current_price || 0)}" data-value="${Number(holding.value || 0)}">
                      <td><button class="table-link" type="button" data-user-detail="${holding.user_id}">${escapeHtml(holding.owner || "Client")}</button></td>
                      <td>${escapeHtml(holding.fixed_user_id || "")}</td>
                      <td>${Number(holding.quantity || 0).toLocaleString("en-IN")}</td>
                      <td>${currency(holding.buy_price)}</td>
                      <td><strong class="${pnl >= 0 ? "price-up" : "price-down"}" data-live-price-cell>${currency(holding.current_price)}</strong></td>
                      <td>${currency(buyValue)}</td>
                      <td><strong class="${pnl >= 0 ? "price-up" : "price-down"}" data-live-value-cell>${currency(liveValue)}</strong></td>
                      <td class="${pnl >= 0 ? "profit" : "loss"}" data-pnl-cell>${currency(pnl)}</td>
                      <td class="${holdingReturn >= 0 ? "profit" : "loss"}" data-return-cell>${percent(holdingReturn)}</td>
                    </tr>
                  `;
                }).join("")
              : `<tr><td colspan="9"><span class="helper-text">No clients currently hold this stock.</span></td></tr>`}
          </tbody>
        </table>
      </div>
    </article>
  `;
}
function renderAdminSelectedDetail(userDashboards, allHoldings, shouldScroll = false) {
  const detailMount = document.getElementById("adminDetailMount");
  if (!detailMount || !adminUiState.detailType || !adminUiState.detailKey) return;

  if (adminUiState.detailType === "user") {
    const user = userDashboards.find((entry) => Number(entry.user_id) === Number(adminUiState.detailKey));
    if (!user) return;
    detailMount.innerHTML = buildAdminClientDetail(user);
  }

  if (adminUiState.detailType === "stock") {
    const symbol = String(adminUiState.detailKey || "").toUpperCase();
    const holdings = allHoldings.filter((entry) => String(entry.symbol || "").toUpperCase() === symbol);
    if (!holdings.length) return;
    detailMount.innerHTML = buildAdminStockDetail(symbol, holdings);
  }

  detailMount.classList.remove("hidden");
  setupAdminSellButtons();
  if (shouldScroll) detailMount.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupAdminDrilldowns(userDashboards, allHoldings) {
  const portal = document.getElementById("adminPortal");
  const detailMount = document.getElementById("adminDetailMount");
  if (!portal || !detailMount) return;

  portal.__adminDrilldownData = { userDashboards, allHoldings };
  if (portal.__adminDrilldownBound) return;
  portal.__adminDrilldownBound = true;

  portal.addEventListener("click", (event) => {
    const button = event.target.closest("[data-user-detail], [data-stock-detail]");
    if (!button) return;
    const data = portal.__adminDrilldownData || { userDashboards: [], allHoldings: [] };

    if (button.dataset.userDetail) {
      adminUiState.detailType = "user";
      adminUiState.detailKey = String(button.dataset.userDetail || "");
      renderAdminSelectedDetail(data.userDashboards, data.allHoldings, true);
      return;
    }

    adminUiState.detailType = "stock";
    adminUiState.detailKey = String(button.dataset.stockDetail || "").toUpperCase();
    renderAdminSelectedDetail(data.userDashboards, data.allHoldings, true);
  });
}
async function renderAdminPortal() {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;
  try {
    const { dashboard, users, archivedUsers, systemStatus, userDashboards } = await loadAdminPortalData();
    const safeUsers = Array.isArray(users) ? users : [];
    const safeArchivedUsers = Array.isArray(archivedUsers) ? archivedUsers : [];
    const baseHoldings = userDashboards.flatMap((user) =>
      (Array.isArray(user.holdings) ? user.holdings : []).map((holding) => ({
        ...holding,
        owner: user.full_name,
        fixed_user_id: user.fixed_user_id,
        username: user.username,
        user_id: user.user_id
      }))
    );
    const symbols = [...new Set(baseHoldings.map((holding) => String(holding.symbol || "").toUpperCase()).filter(Boolean))];
    const feed = symbols.length
      ? await api(`/stocks/feed?symbols=${encodeURIComponent(symbols.join(","))}`).catch(() => [])
      : [];
    const safeFeed = Array.isArray(feed) ? feed : [];
    const quoteMap = new Map(safeFeed.map((quote) => [String(quote.symbol || "").toUpperCase(), quote]));
    const allHoldings = baseHoldings.map((holding) => {
      const symbol = String(holding.symbol || "").toUpperCase();
      const quantity = Number(holding.quantity || 0);
      const buyPrice = Number(holding.buy_price || 0);
      const quote = quoteMap.get(symbol);
      const currentPrice = Number(quote?.price ?? holding.current_price ?? buyPrice);
      const value = currentPrice * quantity;
      const investedValue = buyPrice * quantity;
      const profitLoss = value - investedValue;
      const percentChange = investedValue ? (profitLoss / investedValue) * 100 : 0;
      return {
        ...holding,
        symbol,
        quantity,
        buy_price: buyPrice,
        current_price: currentPrice,
        value,
        invested_value: investedValue,
        profit_loss: profitLoss,
        percent_change: percentChange,
        quote_change_percent: Number(quote?.change_percent ?? 0),
        sector: quote?.sector || holding.sector || "Tracked holding",
        exchange: holding.exchange || quote?.exchange || "NSE"
      };
    });
    const holdingsByUser = allHoldings.reduce((map, holding) => {
      const key = Number(holding.user_id);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(holding);
      return map;
    }, new Map());
    const liveUserDashboards = userDashboards.map((user) => {
      const holdings = holdingsByUser.get(Number(user.user_id)) || [];
      const totalPortfolioValue = holdings.reduce((sum, holding) => sum + Number(holding.value || 0), 0);
      const totalInvestedValue = holdings.reduce((sum, holding) => sum + Number(holding.invested_value || 0), 0);
      const openProfitLoss = totalPortfolioValue - totalInvestedValue;
      const bookedProfitLoss = Number(user.booked_profit_loss || 0);
      const lifetimeProfitLoss = openProfitLoss + bookedProfitLoss;
      return {
        ...user,
        holdings,
        sales: Array.isArray(user.sales) ? user.sales : [],
        total_portfolio_value: totalPortfolioValue,
        total_invested_value: totalInvestedValue,
        open_profit_loss: openProfitLoss,
        booked_profit_loss: bookedProfitLoss,
        total_profit_loss: lifetimeProfitLoss,
        lifetime_profit_loss: lifetimeProfitLoss,
        total_holdings: holdings.length
      };
    });
    const searchText = adminUiState.search.trim().toLowerCase();
    const scriptSearchText = adminUiState.scriptSearch.trim().toLowerCase();
    const totalInvested = allHoldings.reduce((sum, holding) => sum + Number(holding.invested_value || 0), 0);
    const totalValue = allHoldings.reduce((sum, holding) => sum + Number(holding.value || 0), 0);
    const totalPnl = allHoldings.reduce((sum, holding) => sum + Number(holding.profit_loss || 0), 0);
    const totalBookedPnl = liveUserDashboards.reduce((sum, user) => sum + Number(user.booked_profit_loss || 0), 0);
    const totalPnlPct = totalInvested ? (totalPnl / totalInvested) * 100 : 0;
    const todayPnl = allHoldings.reduce((sum, holding) => {
      const livePrice = Number(holding.current_price || holding.buy_price || 0);
      const changePct = Number(holding.quote_change_percent || 0);
      const previousPrice = changePct ? livePrice / (1 + changePct / 100) : livePrice;
      return sum + (livePrice - previousPrice) * Number(holding.quantity || 0);
    }, 0);
    const todayPnlPct = totalValue ? (todayPnl / totalValue) * 100 : 0;
    const filteredPositionHoldings = allHoldings.filter((holding) => {
      const matchesInvestor =
        !searchText ||
        String(holding.owner || "").toLowerCase().includes(searchText) ||
        String(holding.fixed_user_id || holding.username || "").toLowerCase().includes(searchText);
      const matchesScript =
        !scriptSearchText ||
        String(holding.symbol || "").toLowerCase().includes(scriptSearchText) ||
        String(holding.sector || "").toLowerCase().includes(scriptSearchText) ||
        String(holding.exchange || "").toLowerCase().includes(scriptSearchText);
      return matchesInvestor && matchesScript;
    });
    const clientRows = liveUserDashboards
      .slice()
      .sort((a, b) => Number(b.total_portfolio_value || 0) - Number(a.total_portfolio_value || 0));
    const stockRows = symbols
      .map((symbol) => {
        const holdings = allHoldings.filter((holding) => holding.symbol === symbol);
        const invested = holdings.reduce((sum, holding) => sum + Number(holding.invested_value || 0), 0);
        const value = holdings.reduce((sum, holding) => sum + Number(holding.value || 0), 0);
        const pnl = value - invested;
        return { symbol, holdings, invested, value, pnl };
      })
      .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl));
    const adminCustomerStatus =
      sessionStorage.getItem("assetyantra_admin_customer_status") ||
      "Client ID will be generated like ABC123 and shown here.";
    mount.innerHTML = `
      <section class="user-shell admin-shell admin-simple-shell no-sidebar-shell">
        <div class="user-shell-main admin-simple-main">
          <header class="user-topbar admin-simple-topbar">
            <div>
              <p class="eyebrow">Admin Portfolio Dashboard</p>
              <h2>Admin Dashboard</h2>
              <p class="detail-subtitle">Manage customers, deals, portfolio views, and booked sell records.</p>
              <p class="live-price-status" data-live-price-status>Live prices updating...</p>
            </div>
            <div class="user-topbar-actions">
              <input class="user-search" id="adminUserSearch" type="text" placeholder="Search user or client ID" />
              <input class="user-search" id="adminScriptSearch" type="text" placeholder="Search stock" />
              <button class="secondary-btn" type="button" data-refresh-admin="true">Refresh</button>
              <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
            </div>
            <p class="helper-text admin-action-status" id="adminUserActionStatus">Archive keeps client records safe while removing the client from active views.</p>
          </header>

          <article class="dashboard-card full-span-card portfolio-ledger-card admin-equity-ledger-card">
            <nav class="portfolio-ledger-tabs" aria-label="Admin portfolio section">
              <button class="active" type="button">Equity</button>
            </nav>
            <div class="portfolio-ledger-metrics">
              <article>
                <span>Invested Value</span>
                <strong>${currency(totalInvested)}</strong>
              </article>
              <article>
                <span>Current Value</span>
                <strong class="${totalValue >= totalInvested ? "profit" : "loss"}" data-live-total-value>${currency(totalValue)}</strong>
              </article>
              <article>
                <span>Unrealised P&amp;L</span>
                <strong class="${totalPnl >= 0 ? "profit" : "loss"}" data-live-total-pnl>${currency(totalPnl)} <small data-live-total-return>${percent(totalPnlPct)}</small></strong>
              </article>
              <article>
                <span>Today's P&amp;L</span>
                <strong class="${todayPnl >= 0 ? "profit" : "loss"}">${currency(todayPnl)} <small>${percent(todayPnlPct)}</small></strong>
              </article>
              <article>
                <span>Realised P&amp;L</span>
                <strong class="${totalBookedPnl >= 0 ? "profit" : "loss"}">${currency(totalBookedPnl)}</strong>
              </article>
            </div>
          </article>

          <article class="dashboard-card full-span-card admin-deal-card admin-customer-card" id="adminCustomerCard">
            <div class="panel-head">
              <div>
                <h3>Add Customer</h3>
                <p class="detail-subtitle">Create customer access from admin only. The generated client ID is used for user login.</p>
              </div>
              <span class="badge green">Admin Only</span>
            </div>
            <form id="adminCustomerForm" class="portfolio-form admin-customer-form">
              <label><span>Customer Name</span><input name="full_name" type="text" placeholder="Customer full name" autocomplete="name" required /></label>
              <label><span>Email</span><input name="email" type="email" placeholder="client@email.com" autocomplete="email" required /></label>
              <label><span>Phone</span><input name="phone_number" type="tel" placeholder="Phone number" autocomplete="tel" required /></label>
              <label><span>Password</span><input name="password" type="password" placeholder="Minimum 8 characters" autocomplete="new-password" required /></label>
              <button class="primary-btn" type="submit">Create Customer</button>
              <p class="helper-text admin-deal-status" id="adminCustomerStatus">${escapeHtml(adminCustomerStatus)}</p>
            </form>
          </article>

          <article class="dashboard-card full-span-card admin-deal-card" id="adminDealCard">
            <div class="panel-head">
              <div>
                <h3>Add Deal</h3>
                <p class="detail-subtitle">Add a stock position directly to a customer portfolio.</p>
              </div>
              <span class="badge green">Deal Entry</span>
            </div>
            <form id="adminDealForm" class="portfolio-form admin-deal-form">
              <label>
                <span>Customer</span>
                <select name="userId" required ${liveUserDashboards.length ? "" : "disabled"}>
                  <option value="">Select customer</option>
                  ${liveUserDashboards
                    .slice()
                    .sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || "")))
                    .map((user) => `<option value="${user.user_id}">${escapeHtml(user.full_name)} (${escapeHtml(user.fixed_user_id || user.username || "Client")})</option>`)
                    .join("")}
                </select>
              </label>
              <label class="portfolio-symbol-wrap">
                <span>Stock Name / Symbol</span>
                <input name="symbol" type="text" placeholder="Type 3 letters" autocomplete="off" required />
                <div id="adminDealSymbolSuggestions" class="symbol-suggestion-list"></div>
              </label>
              <label><span>Quantity</span><input name="quantity" type="number" min="1" step="1" placeholder="100" required /></label>
              <label><span>Buy Price</span><input name="buyPrice" type="number" min="1" step="0.01" placeholder="1500" required /></label>
              <label>
                <span>Exchange</span>
                <select name="exchange" required>
                  <option value="NSE" selected>NSE</option>
                  <option value="BSE">BSE</option>
                </select>
              </label>
              <button class="primary-btn" type="submit" ${liveUserDashboards.length ? "" : "disabled"}>Add Deal</button>
              <p class="helper-text admin-deal-status" id="adminDealStatus">${liveUserDashboards.length ? "Choose customer, stock, quantity, and buy price." : "Create a customer first, then add a deal."}</p>
            </form>
          </article>

          <article class="table-card full-span-card admin-positions-card" id="adminPositionsCard">
            <div class="panel-head">
              <div>
                <h3>All Client Positions</h3>
                <p class="detail-subtitle">Click a user or stock name to open the detailed view below.</p>
              </div>
              <span class="badge">${filteredPositionHoldings.length} shown</span>
            </div>
            <div class="table-wrap admin-position-table-wrap">
              <table class="compact-table admin-position-table">
                <thead><tr><th>User</th><th>Stock</th><th>Qty</th><th>Buy Price</th><th>Buy Value</th><th>Live Price</th><th>Live Value</th><th>Lifetime P/L</th><th>Return</th><th>Actions</th></tr></thead>
                <tbody>
                  ${filteredPositionHoldings.length
                    ? filteredPositionHoldings.map((holding) => {
                        const pnl = Number(holding.profit_loss || 0);
                        const returnPct = Number(holding.invested_value || 0) ? (pnl / Number(holding.invested_value || 0)) * 100 : 0;
                        return `
                          <tr data-live-summary="true" data-live-symbol="${escapeHtml(holding.symbol)}" data-quantity="${Number(holding.quantity || 0)}" data-buy-price="${Number(holding.buy_price || 0)}" data-current-price="${Number(holding.current_price || 0)}" data-value="${Number(holding.value || 0)}">
                            <td><button class="table-link" type="button" data-user-detail="${holding.user_id}">${escapeHtml(holding.owner || "Client")}</button><br /><small>${escapeHtml(holding.fixed_user_id || "")}</small></td>
                            <td><button class="table-link" type="button" data-stock-detail="${escapeHtml(holding.symbol)}">${escapeHtml(holding.symbol)}</button><br /><small>${escapeHtml(holding.sector || "Tracked holding")}</small></td>
                            <td>${Number(holding.quantity || 0).toLocaleString("en-IN")}</td>
                            <td>${currency(holding.buy_price)}</td>
                            <td>${currency(holding.invested_value)}</td>
                            <td><strong class="${pnl >= 0 ? "price-up" : "price-down"}" data-live-price-cell>${currency(holding.current_price)}</strong></td>
                            <td><strong class="${pnl >= 0 ? "price-up" : "price-down"}" data-live-value-cell>${currency(holding.value)}</strong></td>
                            <td class="${pnl >= 0 ? "profit" : "loss"}" data-pnl-cell>${currency(pnl)}</td>
                            <td class="${returnPct >= 0 ? "profit" : "loss"}" data-return-cell>${percent(returnPct)}</td>
                            <td class="admin-row-actions">
                              <button class="sell-action-btn compact-btn" type="button" data-admin-sell-holding="${holding.holding_id}" data-symbol="${escapeHtml(holding.symbol)}" data-quantity="${Number(holding.quantity || 0)}" data-live-price="${Number(holding.current_price || 0)}">Sell</button>
                              <button class="secondary-btn compact-btn" type="button" data-download-user-id="${holding.user_id}">PDF</button>
                            </td>
                          </tr>
                        `;
                      }).join("")
                    : `<tr><td colspan="10"><span class="helper-text">No positions match the search.</span></td></tr>`}
                </tbody>
              </table>
            </div>
          </article>

          <div class="dashboard-grid admin-simple-grid">
            <article class="dashboard-card admin-simple-list-card">
              <div class="panel-head"><h3>Clients</h3><span class="badge">Click user</span></div>
              <div class="stack-list admin-simple-list">
                ${clientRows.length
                  ? clientRows.map((user) => {
                      const returnPct = Number(user.total_invested_value || 0) ? (Number(user.total_profit_loss || 0) / Number(user.total_invested_value || 0)) * 100 : 0;
                      return `
                        <article class="stack-item">
                          <div>
                            <button class="table-link admin-entity-link" type="button" data-user-detail="${user.user_id}">${escapeHtml(user.full_name)}</button>
                            <small>${escapeHtml(user.fixed_user_id || user.username || "Client")} | ${user.total_holdings} stock(s)</small>
                          </div>
                          <div class="admin-list-values">
                            <strong>${currency(user.total_portfolio_value)}</strong>
                            <small class="${user.total_profit_loss >= 0 ? "profit" : "loss"}">${currency(user.total_profit_loss)} | ${percent(returnPct)}</small>
                          </div>
                        </article>
                      `;
                    }).join("")
                  : `<article class="stack-item"><div><strong>No clients yet</strong><small>Registered users will appear here.</small></div></article>`}
              </div>
            </article>

            <article class="dashboard-card admin-simple-list-card">
              <div class="panel-head"><h3>Stocks</h3><span class="badge green">Click stock</span></div>
              <div class="stack-list admin-simple-list">
                ${stockRows.length
                  ? stockRows.map((stock) => {
                      const returnPct = stock.invested ? (stock.pnl / stock.invested) * 100 : 0;
                      return `
                        <article class="stack-item">
                          <div>
                            <button class="table-link admin-entity-link" type="button" data-stock-detail="${escapeHtml(stock.symbol)}">${escapeHtml(stock.symbol)}</button>
                            <small>${stock.holdings.length} client(s) holding</small>
                          </div>
                          <div class="admin-list-values">
                            <strong>${currency(stock.value)}</strong>
                            <small class="${stock.pnl >= 0 ? "profit" : "loss"}">${currency(stock.pnl)} | ${percent(returnPct)}</small>
                          </div>
                        </article>
                      `;
                    }).join("")
                  : `<article class="stack-item"><div><strong>No stocks yet</strong><small>Client holdings will appear here.</small></div></article>`}
              </div>
            </article>

            <article class="dashboard-card admin-simple-list-card">
              <div class="panel-head"><h3>Archived Clients</h3><span class="badge red">Permanent delete</span></div>
              <div class="stack-list admin-simple-list">
                ${safeArchivedUsers.length
                  ? safeArchivedUsers.map((user) => `
                    <article class="stack-item archived-client-item">
                      <div>
                        <strong>${escapeHtml(user.full_name)}</strong>
                        <small>${escapeHtml(user.fixed_user_id || user.username || "Client")} | archived client</small>
                      </div>
                      <button class="secondary-btn compact-btn danger-btn" type="button" data-permanent-delete-user="${user.user_id}" data-user-name="${escapeHtml(user.full_name)}">Delete permanently</button>
                    </article>
                  `).join("")
                  : `<article class="stack-item"><div><strong>No archived clients</strong><small>Permanent delete appears here only after a client is archived.</small></div></article>`}
              </div>
            </article>
          </div>

          <section id="adminDetailMount" class="dashboard-section admin-detail-mount">
            <article class="dashboard-card detail-card admin-simple-detail-card">
              <div class="panel-head">
                <div>
                  <p class="eyebrow">Details</p>
                  <h3>Select a user or stock</h3>
                  <p class="detail-subtitle">Click a user name to view their full portfolio. Click a stock name to view every client holding that stock.</p>
                </div>
              </div>
              <div class="admin-market-empty-art" aria-hidden="true">
                <img src="./assets/bull-bear-market.svg?v=3" alt="" />
                <span>Market movement appears here once you choose a client or stock.</span>
              </div>
            </article>
          </section>
        </div>
      </section>
    `;

    revealPortal(mount);
    activeRole = "admin";
    activeUserId = null;
    setupDownloadButtons(liveUserDashboards);
    setupAdminManagementButtons();
    setupAdminCustomerForm();
    setupAdminDealForm();
    setupAdminDealSymbolSuggestions();
    setupAdminSellButtons();
    setupAdminDrilldowns(liveUserDashboards, allHoldings);
    renderAdminSelectedDetail(liveUserDashboards, allHoldings, false);
    setupPortalActions();
    startLiveDashboardPrices();
  } catch (error) {
    renderPortalError(mount, "Admin Dashboard", `Login succeeded, but admin dashboard data could not load yet. ${formatError(error)}`);
    const retry = document.getElementById("retryPortalBtn");
    if (retry) retry.addEventListener("click", () => renderAdminPortal());
  }
}
async function renderUserPortal() {
  const mount = document.getElementById("userPortal");
  if (!mount) return;
  try {
    const [profile, holdings, summary] = await Promise.all([api("/auth/me"), api("/portfolio"), api("/portfolio/summary")]);
    const performance = Array.isArray(summary.performance) ? summary.performance : [];
    const sales = Array.isArray(summary.sales) ? summary.sales : [];
    const totalBookedPnl = Number(summary.booked_profit_loss || 0);
    const totalLifetimePnl = Number(summary.lifetime_profit_loss ?? (Number(summary.total_profit_loss || 0) + totalBookedPnl));
    const totalInvested = performance.reduce((sum, item) => sum + Number(item.buy_price || 0) * Number(item.quantity || 0), 0);
    const symbols = [...new Set(performance.map((holding) => holding.symbol).filter(Boolean))];
    const liveFeed = symbols.length
      ? await api(`/stocks/feed?symbols=${encodeURIComponent(symbols.join(","))}`).catch(() => [])
      : [];
    const liveQuoteMap = new Map(
      (Array.isArray(liveFeed) ? liveFeed : []).map((quote) => [String(quote.symbol || "").toUpperCase(), quote])
    );
    const unrealisedPnl = Number(summary.total_profit_loss || 0);
    const unrealisedPct = totalInvested ? (unrealisedPnl / totalInvested) * 100 : 0;
    const todayPnl = performance.reduce((sum, holding) => {
      const quote = liveQuoteMap.get(String(holding.symbol || "").toUpperCase());
      const quantity = Number(holding.quantity || 0);
      const livePrice = Number(quote?.price || holding.current_price || 0);
      const changePct = Number(quote?.change_percent || 0);
      const previousPrice = changePct ? livePrice / (1 + changePct / 100) : livePrice;
      return sum + (livePrice - previousPrice) * quantity;
    }, 0);
    const todayPnlPct = Number(summary.total_portfolio_value || 0) ? (todayPnl / Number(summary.total_portfolio_value || 0)) * 100 : 0;
    const filteredPerformance = getFilteredUserPerformance(performance);
    userDashboardCache = {
      performance,
      recommendationFeed: [],
      symbolCatalog: buildUserSymbolCatalog(performance, [])
    };
    const newClientId = sessionStorage.getItem("stock_trader_new_client_id");

    mount.innerHTML = `
    <section class="user-shell no-sidebar-shell">
      <div class="user-shell-main">
        <header class="user-topbar">
          <div>
            <p class="eyebrow">Welcome Back</p>
            <h2>${profile.full_name}</h2>
            <p class="detail-subtitle">${profile.fixed_user_id || profile.username} | ${profile.phone_number || "Client access"}</p>
            <p class="live-price-status" data-live-price-status>Live prices updating...</p>
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
            <button class="download-btn" type="button" id="userPrintBtn">Download</button>
            <button class="secondary-btn" type="button" data-refresh-user="true">Refresh</button>
            <button class="logout-btn" type="button" data-logout="true">Secure Logout</button>
          </div>
        </header>
        ${
          newClientId
            ? `<div class="client-id-confirmation"><span>Account created</span><strong>Your Client ID: ${escapeHtml(newClientId)}</strong><small>Use this ID with your password and phone number when logging in as User.</small></div>`
            : ""
        }

        <div class="user-app-grid">
          <article class="user-app-card full-span-card portfolio-ledger-card" id="portfolioLedgerCard">
            <nav class="portfolio-ledger-tabs" aria-label="Portfolio sections">
              <button class="active" type="button">Equity</button>
            </nav>
            <div class="portfolio-ledger-metrics">
              <article>
                <span>Invested Value</span>
                <strong>${currency(totalInvested)}</strong>
              </article>
              <article>
                <span>Current Value</span>
                <strong class="${summary.total_portfolio_value >= totalInvested ? "profit" : "loss"}" data-live-total-value>${currency(summary.total_portfolio_value)}</strong>
              </article>
              <article>
                <span>Unrealised P&amp;L</span>
                <strong class="${unrealisedPnl >= 0 ? "profit" : "loss"}">${currency(unrealisedPnl)} <small>${percent(unrealisedPct)}</small></strong>
              </article>
              <article>
                <span>Lifetime P&amp;L</span>
                <strong class="${totalLifetimePnl >= 0 ? "profit" : "loss"}" data-live-total-pnl>${currency(totalLifetimePnl)} <small data-live-total-return>${percent(totalInvested ? (totalLifetimePnl / totalInvested) * 100 : 0)}</small></strong>
              </article>
              <article>
                <span>Today's P&amp;L</span>
                <strong class="${todayPnl >= 0 ? "profit" : "loss"}">${currency(todayPnl)} <small>${percent(todayPnlPct)}</small></strong>
              </article>
              <article>
                <span>Realised P&amp;L</span>
                <strong class="${totalBookedPnl >= 0 ? "profit" : "loss"}" data-live-booked-pnl="${Number(totalBookedPnl || 0)}">${currency(totalBookedPnl)}</strong>
              </article>
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
                <thead><tr><th>Asset</th><th>Qty</th><th>Invested</th><th>Live Value</th><th>P&amp;L</th></tr></thead>
                <tbody id="userHoldingsTableBody">
                  ${performance.length
                    ? performance
                        .map(
                          (holding) => `
                            <tr data-live-summary="true" data-symbol="${escapeHtml(holding.symbol)}" data-live-symbol="${escapeHtml(holding.symbol)}" data-sector="${escapeHtml(holding.sector || "Tracked holding")}" data-state="${getHoldingState(holding)}" data-quantity="${Number(holding.quantity || 0)}" data-buy-price="${Number(holding.buy_price || 0)}" data-current-price="${Number(holding.current_price || 0)}" data-value="${Number(holding.value || 0)}">
                              <td>${holding.symbol}<br /><small>${holding.sector || "Tracked holding"}</small></td>
                              <td><strong>${Number(holding.quantity || 0).toLocaleString("en-IN")}</strong><br /><small>shares</small></td>
                              <td><strong class="price-buy">${currency(holding.buy_price * holding.quantity)}</strong><br /><small>Avg ${currency(holding.buy_price)}</small></td>
                              <td><strong class="${holding.profit_loss >= 0 ? "price-up" : "price-down"}" data-live-value-cell>${currency(holding.value)}</strong><br /><small>Live <span data-live-price-cell>${currency(holding.current_price)}</span></small></td>
                              <td><strong class="${holding.profit_loss >= 0 ? "profit" : "loss"}" data-pnl-cell>${currency(holding.profit_loss)}</strong><br /><small data-return-cell>${percent(holding.percent_change)}</small></td>
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
            <div class="panel-head"><h3>Add To Portfolio</h3></div>
            <form id="portfolioForm" class="portfolio-form">
              <label class="portfolio-symbol-wrap"><span>Stock Symbol</span><input name="symbol" type="text" autocomplete="off" required /><div id="portfolioSymbolSuggestions" class="symbol-suggestion-list"></div></label>
              <label><span>Quantity</span><input name="quantity" type="number" min="1" required /></label>
              <div class="portfolio-live-price-preview" id="portfolioLivePricePreview" data-state="idle">
                <span>Live Price</span>
                <strong id="portfolioLivePriceValue">Select a stock</strong>
                <small id="portfolioLivePriceMeta">Live price will appear here.</small>
              </div>
              <label><span>Buy Price</span><input name="buyPrice" type="number" min="1" step="0.01" required /></label>
              <label><span>Exchange</span><input name="exchange" type="text" value="NSE" disabled /></label>
              <button class="primary-btn" type="submit">Add Stock</button>
            </form>
          </article>
        </div>

        <div class="user-app-grid">
          <article class="user-app-card full-span-card" id="userSoldHistoryCard">
            <div class="panel-head"><h3>Sold History</h3><span class="badge">Booked P&amp;L</span></div>
            <div class="table-wrap">
              <table class="compact-table">
                <thead><tr><th>Stock</th><th>Qty Sold</th><th>Buy Price</th><th>Sell Price</th><th>Booked P&amp;L</th><th>Sold Date &amp; Time</th></tr></thead>
                <tbody>
                  ${sales.length
                    ? sales.map((sale) => `
                      <tr>
                        <td>${escapeHtml(sale.symbol)}<br /><small>${escapeHtml(sale.exchange || "NSE")}</small></td>
                        <td>${Number(sale.quantity || 0).toLocaleString("en-IN")}</td>
                        <td>${currency(sale.buy_price)}</td>
                        <td>${currency(sale.sell_price)}</td>
                        <td class="${Number(sale.profit_loss || 0) >= 0 ? "profit" : "loss"}">${currency(sale.profit_loss)}</td>
                        <td>${formatIndianSoldDateTime(sale.sold_at)}</td>
                      </tr>
                    `).join("")
                    : `<tr><td colspan="6"><span class="helper-text">No sold stocks yet. Sold stocks will appear here with booked profit/loss.</span></td></tr>`}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <div class="user-app-grid">
          <article class="user-app-card full-span-card" id="userActivityCard">
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
    mount.dataset.liveBookedPnl = String(totalBookedPnl);
    mount.setAttribute("data-live-booked-pnl", String(totalBookedPnl));
    activeRole = "user";
    activeUserId = profile.id;
    document.getElementById("userPrintBtn").addEventListener("click", () => window.print());
    setupPortfolioForm();
    setupPortfolioSymbolSuggestions();
    setupUserPortfolioFilters();
    setupPortalActions();
    startLiveDashboardPrices();
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
          exchange: "NSE"
        })
      });
      form.reset();
      const exchangeInput = form.querySelector('[name="exchange"]');
      if (exchangeInput) exchangeInput.value = "NSE";
      notifyPortfolioChanged();
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
    register: null
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
      hidePortalMounts();
      hideAuthLoading();
      activeRole = null;
      activeUserId = null;
      updateAside(role);
    });
  });

  document.querySelectorAll("[data-send-otp]").forEach((button) => {
    button.addEventListener("click", async () => {
      const stopLoading = setButtonLoading(button, "Sending...");
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
          const response = await api("/auth/request-otp", { method: "POST", body: JSON.stringify(payload), timeout_ms: 60000 });
          document.getElementById("adminOtpHint").textContent = response.otp_preview ? `Testing OTP: ${response.otp_preview}` : response.message;
          document.getElementById("adminError").textContent = "";
        } else if (button.dataset.sendOtp === "user") {
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
          const response = await api("/auth/request-otp", { method: "POST", body: JSON.stringify(payload), timeout_ms: 60000 });
          document.getElementById("userOtpHint").textContent = response.otp_preview ? `Testing code: ${response.otp_preview}` : response.message;
          document.getElementById("userError").textContent = "";
        }
      } catch (error) {
        if (button.dataset.sendOtp === "admin") {
          document.getElementById("adminError").textContent = formatError(error);
        } else if (button.dataset.sendOtp === "user") {
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
        timeout_ms: 60000,
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
        timeout_ms: 60000,
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

  if (isLoginPage()) {
    stopLiveDashboardPrices();
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

  // Dashboard auto-refresh disabled to prevent flicker. Use Refresh or portfolio actions to update.
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

  // Dashboard auto-refresh disabled to prevent flicker. Use Refresh or portfolio actions to update.
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
    return "New customers are created by the admin inside the admin dashboard. The system generates a client ID like ABC123, which the customer uses to login as User.";
  }
  if (text.includes("otp")) {
    return "OTP is used as an added login verification step. Click Send OTP, use the displayed code in local testing, and then complete login.";
  }
  if (text.includes("admin") && text.includes("download")) {
    return "Admins can open the admin dashboard and use Download for a selected client portfolio snapshot.";
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

  // Automatic chatbot nudges disabled to prevent page flicker.
}

setupFaq();
loadSiteControls().catch(() => {});
setupReviewForm();
window.addEventListener("storage", (event) => {
  if (event.key !== "stock_trader_portfolio_updated") return;
  if (isAdminDashboardPage() && activeRole === "admin") {
    renderAdminPortal().catch(() => {});
  }
});
setupPageTransitions();
removeDeprecatedPublicNavigation();
setupHomeLiveTicker().catch(() => {});
setupHomeLiveNews().catch(() => {});
setupSmartLoginLinks();
setupLogin();
setupDashboardLaunchReveal();
setupDashboardPages();
setupFinanceChatbot();
