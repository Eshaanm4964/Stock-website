const demoOtpCodes = {
  developer: "456789",
  user: "112233"
};

const adminCustomers = [
  {
    name: "Aarav Capital",
    holdings: [
      { symbol: "INFY", company: "Infosys", quantity: 120, buyPrice: 1460, currentPrice: 1512 },
      { symbol: "TCS", company: "Tata Consultancy Services", quantity: 60, buyPrice: 3710, currentPrice: 3654 }
    ]
  },
  {
    name: "Meera Holdings",
    holdings: [
      { symbol: "HDFCBANK", company: "HDFC Bank", quantity: 140, buyPrice: 1580, currentPrice: 1614 },
      { symbol: "RELIANCE", company: "Reliance Industries", quantity: 90, buyPrice: 2845, currentPrice: 2918 }
    ]
  },
  {
    name: "Shiv Portfolio",
    holdings: [
      { symbol: "ICICIBANK", company: "ICICI Bank", quantity: 110, buyPrice: 1086, currentPrice: 1114 },
      { symbol: "LT", company: "Larsen & Toubro", quantity: 40, buyPrice: 3540, currentPrice: 3482 }
    ]
  }
];

const adminHistory = [
  { month: "Nov", value: 125000 },
  { month: "Dec", value: 152000 },
  { month: "Jan", value: -35000 },
  { month: "Feb", value: 98000 },
  { month: "Mar", value: 126000 },
  { month: "Apr", value: 164000 }
];

const userHistory = [
  { month: "Year 1", value: 82000 },
  { month: "Year 2", value: 134000 },
  { month: "Year 3", value: 116000 },
  { month: "Year 4", value: 201000 },
  { month: "Year 5", value: 248000 }
];

const userPortfolio = [
  { symbol: "INFY", company: "Infosys", quantity: 80, buyPrice: 1420, currentPrice: 1512 },
  { symbol: "SBIN", company: "State Bank of India", quantity: 150, buyPrice: 710, currentPrice: 768 },
  { symbol: "TATAMOTORS", company: "Tata Motors", quantity: 75, buyPrice: 945, currentPrice: 904 }
];

const holdingsUniverse = [
  { symbol: "INFY", company: "Infosys" },
  { symbol: "TCS", company: "Tata Consultancy Services" },
  { symbol: "HDFCBANK", company: "HDFC Bank" },
  { symbol: "RELIANCE", company: "Reliance Industries" },
  { symbol: "ICICIBANK", company: "ICICI Bank" },
  { symbol: "LT", company: "Larsen & Toubro" },
  { symbol: "SBIN", company: "State Bank of India" },
  { symbol: "TATAMOTORS", company: "Tata Motors" }
];

const dom = {
  switches: document.querySelectorAll(".login-switch"),
  developerForm: document.getElementById("developerForm"),
  userForm: document.getElementById("userForm"),
  developerHint: document.getElementById("developerOtpHint"),
  userHint: document.getElementById("userOtpHint"),
  developerError: document.getElementById("developerError"),
  userError: document.getElementById("userError"),
  portalSection: document.getElementById("portalSection"),
  adminPortal: document.getElementById("adminPortal"),
  userPortal: document.getElementById("userPortal"),
  portalEyebrow: document.getElementById("portalEyebrow"),
  portalTitle: document.getElementById("portalTitle"),
  portalSubtitle: document.getElementById("portalSubtitle"),
  logoutBtn: document.getElementById("logoutBtn"),
  downloadPortfolioBtn: document.getElementById("downloadPortfolioBtn"),
  adminMetrics: document.getElementById("adminMetrics"),
  adminHoldingsBody: document.getElementById("adminHoldingsBody"),
  adminPortfolioList: document.getElementById("adminPortfolioList"),
  adminHistoryChart: document.getElementById("adminHistoryChart"),
  liveTicker: document.getElementById("liveTicker"),
  userMetrics: document.getElementById("userMetrics"),
  userPortfolioBody: document.getElementById("userPortfolioBody"),
  userPortfolioSummary: document.getElementById("userPortfolioSummary"),
  userHistoryChart: document.getElementById("userHistoryChart"),
  portfolioForm: document.getElementById("portfolioForm"),
  marketStatusValue: document.getElementById("marketStatusValue"),
  marketStatusText: document.getElementById("marketStatusText")
};

let currentPortal = null;
let tickerTimer = null;

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function calculateHoldingMetrics(holding) {
  const invested = holding.quantity * holding.buyPrice;
  const currentValue = holding.quantity * holding.currentPrice;
  const pnl = currentValue - invested;
  const pnlPct = invested ? (pnl / invested) * 100 : 0;
  return { invested, currentValue, pnl, pnlPct };
}

function renderMetricCards(target, cards) {
  target.innerHTML = cards
    .map(
      (card) => `
        <article class="metric-card">
          <strong>${card.label}</strong>
          <span>${card.value}</span>
          <small>${card.hint}</small>
        </article>
      `
    )
    .join("");
}

function renderHistoryChart(target, history) {
  const maxAbs = Math.max(...history.map((item) => Math.abs(item.value)));
  target.innerHTML = history
    .map((item) => {
      const height = Math.max((Math.abs(item.value) / maxAbs) * 180, 24);
      return `
        <div class="chart-bar">
          <div class="chart-value ${item.value >= 0 ? "profit" : "loss"}">${formatCurrency(item.value)}</div>
          <div class="chart-bar-fill ${item.value >= 0 ? "" : "negative"}" style="height:${height}px"></div>
          <div class="chart-label">${item.month}</div>
        </div>
      `;
    })
    .join("");
}

function getAdminSummary() {
  const allHoldings = adminCustomers.flatMap((customer) =>
    customer.holdings.map((holding) => ({ ...holding, customer: customer.name }))
  );

  return allHoldings.reduce(
    (acc, holding) => {
      const metrics = calculateHoldingMetrics(holding);
      acc.allHoldings.push({ ...holding, ...metrics });
      acc.invested += metrics.invested;
      acc.currentValue += metrics.currentValue;
      acc.pnl += metrics.pnl;
      return acc;
    },
    { allHoldings: [], invested: 0, currentValue: 0, pnl: 0 }
  );
}

function getUserSummary() {
  return userPortfolio.reduce(
    (acc, holding) => {
      const metrics = calculateHoldingMetrics(holding);
      acc.invested += metrics.invested;
      acc.currentValue += metrics.currentValue;
      acc.pnl += metrics.pnl;
      return acc;
    },
    { invested: 0, currentValue: 0, pnl: 0 }
  );
}

function renderAdminPortal() {
  const summary = getAdminSummary();
  const pnlPct = summary.invested ? (summary.pnl / summary.invested) * 100 : 0;

  renderMetricCards(dom.adminMetrics, [
    { label: "Customers", value: String(adminCustomers.length), hint: "Active client portfolios" },
    { label: "Total Invested", value: formatCurrency(summary.invested), hint: "Combined purchased value" },
    { label: "Current Value", value: formatCurrency(summary.currentValue), hint: "Live market-linked value" },
    { label: "Total Profit / Loss", value: formatPercent(pnlPct), hint: formatCurrency(summary.pnl) }
  ]);

  dom.adminHoldingsBody.innerHTML = summary.allHoldings
    .map(
      (holding) => `
        <tr>
          <td>${holding.customer}</td>
          <td>${holding.symbol}<br /><small>${holding.company}</small></td>
          <td>${holding.quantity}</td>
          <td>${formatCurrency(holding.buyPrice)}</td>
          <td>${formatCurrency(holding.currentPrice)}</td>
          <td class="${holding.pnl >= 0 ? "profit" : "loss"}">${formatCurrency(holding.pnl)}<br /><small>${formatPercent(holding.pnlPct)}</small></td>
        </tr>
      `
    )
    .join("");

  dom.adminPortfolioList.innerHTML = adminCustomers
    .map((customer) => {
      const customerTotals = customer.holdings.reduce(
        (acc, holding) => {
          const metrics = calculateHoldingMetrics(holding);
          acc.currentValue += metrics.currentValue;
          acc.pnl += metrics.pnl;
          return acc;
        },
        { currentValue: 0, pnl: 0 }
      );

      return `
        <article class="stack-item">
          <div>
            <strong>${customer.name}</strong>
            <small>${customer.holdings.length} stocks tracked</small>
          </div>
          <div>
            <strong>${formatCurrency(customerTotals.currentValue)}</strong>
            <small class="${customerTotals.pnl >= 0 ? "profit" : "loss"}">${formatCurrency(customerTotals.pnl)}</small>
          </div>
        </article>
      `;
    })
    .join("");

  renderHistoryChart(dom.adminHistoryChart, adminHistory);
  renderTicker();
}

function renderUserPortal() {
  const summary = getUserSummary();
  const percentage = summary.invested ? (summary.pnl / summary.invested) * 100 : 0;

  renderMetricCards(dom.userMetrics, [
    { label: "Total Invested", value: formatCurrency(summary.invested), hint: "Lifetime invested capital" },
    { label: "Current Value", value: formatCurrency(summary.currentValue), hint: "Latest live value" },
    { label: "Profit Amount", value: formatCurrency(summary.pnl), hint: "Overall gain or loss" },
    { label: "Profit Percentage", value: formatPercent(percentage), hint: "Lifetime return" }
  ]);

  dom.userPortfolioBody.innerHTML = userPortfolio
    .map((holding) => {
      const metrics = calculateHoldingMetrics(holding);
      return `
        <tr>
          <td>${holding.symbol}<br /><small>${holding.company}</small></td>
          <td>${holding.quantity}</td>
          <td>${formatCurrency(metrics.invested)}</td>
          <td>${formatCurrency(metrics.currentValue)}</td>
          <td class="${metrics.pnl >= 0 ? "profit" : "loss"}">${formatCurrency(metrics.pnl)}</td>
          <td>${metrics.pnl >= 0 ? "Profit" : "Loss"}</td>
        </tr>
      `;
    })
    .join("");

  dom.userPortfolioSummary.innerHTML = userPortfolio
    .map((holding) => {
      const metrics = calculateHoldingMetrics(holding);
      return `
        <article class="stack-item">
          <div>
            <strong>${holding.symbol}</strong>
            <small>${holding.quantity} shares</small>
          </div>
          <div>
            <strong>${formatCurrency(metrics.currentValue)}</strong>
            <small class="${metrics.pnl >= 0 ? "profit" : "loss"}">${formatPercent(metrics.pnlPct)}</small>
          </div>
        </article>
      `;
    })
    .join("");

  renderHistoryChart(dom.userHistoryChart, userHistory);
}

function renderTicker() {
  const symbols = [...new Set(adminCustomers.flatMap((customer) => customer.holdings.map((holding) => holding.symbol)))];
  dom.liveTicker.innerHTML = holdingsUniverse
    .filter((holding) => symbols.includes(holding.symbol))
    .map((holding) => {
      const refHolding = adminCustomers.flatMap((customer) => customer.holdings).find((item) => item.symbol === holding.symbol);
      const changePct = ((refHolding.currentPrice - refHolding.buyPrice) / refHolding.buyPrice) * 100;
      return `
        <article class="ticker-item">
          <div>
            <strong>${holding.symbol}</strong>
            <small>${holding.company}</small>
          </div>
          <div>
            <strong>${formatCurrency(refHolding.currentPrice)}</strong>
            <small class="${changePct >= 0 ? "profit" : "loss"}">${formatPercent(changePct)}</small>
          </div>
        </article>
      `;
    })
    .join("");

  const all = adminCustomers.flatMap((customer) => customer.holdings);
  const drift = all.reduce((acc, holding) => acc + ((holding.currentPrice - holding.buyPrice) / holding.buyPrice) * 100, 0) / all.length;
  dom.marketStatusValue.textContent = formatPercent(drift);
  dom.marketStatusText.textContent = drift >= 0 ? "Portfolio-linked stocks are advancing" : "Portfolio-linked stocks are under pressure";
}

function nudgePrices() {
  const update = (holding) => {
    const swing = (Math.random() - 0.48) * Math.max(holding.currentPrice * 0.012, 2);
    holding.currentPrice = Math.max(1, Number((holding.currentPrice + swing).toFixed(2)));
  };

  adminCustomers.forEach((customer) => customer.holdings.forEach(update));
  userPortfolio.forEach(update);

  if (currentPortal === "developer") {
    renderAdminPortal();
  }

  if (currentPortal === "user") {
    renderUserPortal();
  }
}

function activatePortal(type) {
  currentPortal = type;
  dom.portalSection.classList.remove("hidden");

  if (type === "developer") {
    dom.portalEyebrow.textContent = "Admin Portal";
    dom.portalTitle.textContent = "Customer Stock Dashboard";
    dom.portalSubtitle.textContent = "Track purchases, portfolio movement, live stock prices, and month-on-month P&L.";
    dom.adminPortal.classList.remove("hidden");
    dom.userPortal.classList.add("hidden");
    dom.downloadPortfolioBtn.classList.add("hidden");
    renderAdminPortal();
  } else {
    dom.portalEyebrow.textContent = "User Portal";
    dom.portalTitle.textContent = "Portfolio Performance Dashboard";
    dom.portalSubtitle.textContent = "Add stocks manually, monitor lifetime profit and loss, and export the dashboard.";
    dom.adminPortal.classList.add("hidden");
    dom.userPortal.classList.remove("hidden");
    dom.downloadPortfolioBtn.classList.remove("hidden");
    renderUserPortal();
  }

  document.getElementById("portalSection").scrollIntoView({ behavior: "smooth", block: "start" });

  if (tickerTimer) {
    clearInterval(tickerTimer);
  }
  tickerTimer = setInterval(nudgePrices, 2500);
}

function resetPortal() {
  currentPortal = null;
  dom.portalSection.classList.add("hidden");
  dom.adminPortal.classList.add("hidden");
  dom.userPortal.classList.add("hidden");
  if (tickerTimer) {
    clearInterval(tickerTimer);
    tickerTimer = null;
  }
}

function switchLogin(role) {
  dom.switches.forEach((button) => button.classList.toggle("active", button.dataset.roleTab === role));
  dom.developerForm.classList.toggle("hidden", role !== "developer");
  dom.userForm.classList.toggle("hidden", role !== "user");
}

document.querySelectorAll("[data-send-otp]").forEach((button) => {
  button.addEventListener("click", () => {
    if (button.dataset.sendOtp === "developer") {
      dom.developerHint.textContent = `Demo OTP sent successfully: ${demoOtpCodes.developer}`;
      dom.developerError.textContent = "";
    } else {
      dom.userHint.textContent = `Demo verification code sent successfully: ${demoOtpCodes.user}`;
      dom.userError.textContent = "";
    }
  });
});

dom.switches.forEach((button) => {
  button.addEventListener("click", () => switchLogin(button.dataset.roleTab));
});

dom.developerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(dom.developerForm);
  const valid =
    formData.get("username")?.trim() === "admin_dev" &&
    formData.get("password")?.trim() === "Admin@123" &&
    formData.get("phone")?.trim() === "9876543210" &&
    formData.get("otp")?.trim() === demoOtpCodes.developer;

  if (!valid) {
    dom.developerError.textContent = "Use demo credentials admin_dev / Admin@123 / 9876543210 and OTP 456789.";
    return;
  }

  dom.developerError.textContent = "";
  activatePortal("developer");
});

dom.userForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(dom.userForm);
  const valid =
    formData.get("userId")?.trim() === "CLIENT-1001" &&
    formData.get("password")?.trim() === "User@123" &&
    formData.get("phone")?.trim() === "9123456780" &&
    formData.get("otp")?.trim() === demoOtpCodes.user;

  if (!valid) {
    dom.userError.textContent = "Use demo credentials CLIENT-1001 / User@123 / 9123456780 and code 112233.";
    return;
  }

  dom.userError.textContent = "";
  activatePortal("user");
});

dom.portfolioForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(dom.portfolioForm);
  const symbol = String(formData.get("symbol")).toUpperCase().trim();
  const company = String(formData.get("company")).trim();
  const quantity = Number(formData.get("quantity"));
  const buyPrice = Number(formData.get("buyPrice"));
  const currentPrice = Number(formData.get("currentPrice"));

  if (!symbol || !company || quantity <= 0 || buyPrice <= 0 || currentPrice <= 0) {
    return;
  }

  userPortfolio.unshift({ symbol, company, quantity, buyPrice, currentPrice });
  userHistory.push({ month: `Entry ${userHistory.length - 3}`, value: Math.round((currentPrice - buyPrice) * quantity) });
  dom.portfolioForm.reset();
  renderUserPortal();
});

dom.downloadPortfolioBtn.addEventListener("click", () => window.print());

dom.logoutBtn.addEventListener("click", () => {
  resetPortal();
  document.getElementById("login").scrollIntoView({ behavior: "smooth", block: "start" });
});

renderAdminPortal();
renderUserPortal();
resetPortal();
