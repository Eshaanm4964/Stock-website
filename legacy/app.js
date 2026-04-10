const OTP = {
  admin: "456789",
  users: {
    "CLIENT-1001": "112233",
    "CLIENT-2002": "223344",
    "CLIENT-3003": "334455"
  }
};

let activeRole = null;
let activeUserId = null;

const users = [
  {
    id: "CLIENT-1001",
    name: "Aarav Mehta",
    password: "User@123",
    phone: "9123456780",
    portfolio: [
      { symbol: "INFY", company: "Infosys", quantity: 80, buyPrice: 1420, currentPrice: 1512 },
      { symbol: "SBIN", company: "State Bank of India", quantity: 150, buyPrice: 710, currentPrice: 768 },
      { symbol: "TATAMOTORS", company: "Tata Motors", quantity: 75, buyPrice: 945, currentPrice: 904 }
    ],
    history: [
      { label: "2021", value: 52000 },
      { label: "2022", value: 88000 },
      { label: "2023", value: 114000 },
      { label: "2024", value: 162000 },
      { label: "2025", value: 205000 }
    ]
  },
  {
    id: "CLIENT-2002",
    name: "Meera Kapoor",
    password: "User@123",
    phone: "9234567890",
    portfolio: [
      { symbol: "HDFCBANK", company: "HDFC Bank", quantity: 100, buyPrice: 1570, currentPrice: 1618 },
      { symbol: "RELIANCE", company: "Reliance Industries", quantity: 64, buyPrice: 2845, currentPrice: 2910 },
      { symbol: "LT", company: "Larsen & Toubro", quantity: 40, buyPrice: 3530, currentPrice: 3475 }
    ],
    history: [
      { label: "2021", value: 64000 },
      { label: "2022", value: 74000 },
      { label: "2023", value: 120000 },
      { label: "2024", value: 97000 },
      { label: "2025", value: 144000 }
    ]
  },
  {
    id: "CLIENT-3003",
    name: "Rohan Iyer",
    password: "User@123",
    phone: "9345678901",
    portfolio: [
      { symbol: "ICICIBANK", company: "ICICI Bank", quantity: 130, buyPrice: 1086, currentPrice: 1112 },
      { symbol: "TCS", company: "TCS", quantity: 38, buyPrice: 3720, currentPrice: 3660 },
      { symbol: "SUNPHARMA", company: "Sun Pharma", quantity: 55, buyPrice: 1655, currentPrice: 1710 }
    ],
    history: [
      { label: "2021", value: 47000 },
      { label: "2022", value: 92000 },
      { label: "2023", value: 105000 },
      { label: "2024", value: 121000 },
      { label: "2025", value: 138000 }
    ]
  }
];

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
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const percent = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

function holdingMetrics(holding) {
  const invested = holding.quantity * holding.buyPrice;
  const currentValue = holding.quantity * holding.currentPrice;
  const pnl = currentValue - invested;
  const pnlPct = invested ? (pnl / invested) * 100 : 0;
  return { invested, currentValue, pnl, pnlPct };
}

function portfolioTotals(portfolio) {
  return portfolio.reduce(
    (acc, holding) => {
      const metrics = holdingMetrics(holding);
      acc.invested += metrics.invested;
      acc.currentValue += metrics.currentValue;
      acc.pnl += metrics.pnl;
      return acc;
    },
    { invested: 0, currentValue: 0, pnl: 0 }
  );
}

function renderChart(history) {
  const maxAbs = Math.max(...history.map((item) => Math.abs(item.value)));
  return `
    <div class="chart">
      ${history
        .map((item) => {
          const height = Math.max((Math.abs(item.value) / maxAbs) * 180, 24);
          return `
            <div class="bar">
              <div class="bar-value ${item.value >= 0 ? "profit" : "loss"}">${currency(item.value)}</div>
              <div class="bar-fill ${item.value >= 0 ? "" : "negative"}" style="height:${height}px"></div>
              <div class="bar-label">${item.label}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;
}

function setupFaq() {
  document.querySelectorAll(".faq-question").forEach((button) => {
    button.addEventListener("click", () => button.closest(".faq-item").classList.toggle("open"));
  });
}

function getReviews() {
  const saved = localStorage.getItem("stock_trader_reviews");
  return saved ? [...reviewsSeed, ...JSON.parse(saved)] : reviewsSeed;
}

function saveReview(review) {
  const existing = localStorage.getItem("stock_trader_reviews");
  const parsed = existing ? JSON.parse(existing) : [];
  parsed.unshift(review);
  localStorage.setItem("stock_trader_reviews", JSON.stringify(parsed));
}

function renderReviews() {
  const container = document.getElementById("reviewsList");
  if (!container) return;

  container.innerHTML = getReviews()
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
  if (!form) return;

  renderReviews();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    saveReview({
      name: String(formData.get("name")).trim(),
      role: String(formData.get("role")).trim(),
      rating: Number(formData.get("rating")),
      message: String(formData.get("message")).trim()
    });
    form.reset();
    form.querySelector('input[name="rating"]').value = "5";
    renderReviews();
  });
}

function renderAdminPortal() {
  const mount = document.getElementById("adminPortal");
  if (!mount) return;

  const allHoldings = users.flatMap((user) => user.portfolio.map((holding) => ({ ...holding, owner: user.name, id: user.id })));
  const overall = allHoldings.reduce(
    (acc, holding) => {
      const metrics = holdingMetrics(holding);
      acc.invested += metrics.invested;
      acc.currentValue += metrics.currentValue;
      acc.pnl += metrics.pnl;
      return acc;
    },
    { invested: 0, currentValue: 0, pnl: 0 }
  );

  mount.innerHTML = `
    <div class="metrics-grid">
      <article class="metric-card"><strong>${users.length}</strong><span>Clients</span><small>Portfolios visible to admin</small></article>
      <article class="metric-card"><strong>${currency(overall.invested)}</strong><span>Total Invested</span><small>Combined client purchases</small></article>
      <article class="metric-card"><strong>${currency(overall.currentValue)}</strong><span>Current Value</span><small>Live moving market value</small></article>
      <article class="metric-card"><strong class="${overall.pnl >= 0 ? "profit" : "loss"}">${currency(overall.pnl)}</strong><span>Total P&amp;L</span><small>${percent(overall.invested ? (overall.pnl / overall.invested) * 100 : 0)}</small></article>
    </div>

    <div class="dashboard-grid">
      <article class="table-card">
        <div class="panel-head"><h3>Customer Stock Purchases</h3><span class="badge">Admin View</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Customer</th><th>Stock</th><th>Qty</th><th>Buy Price</th><th>Live Price</th><th>P&amp;L</th></tr></thead>
            <tbody>
              ${allHoldings
                .map((holding) => {
                  const metrics = holdingMetrics(holding);
                  return `
                    <tr>
                      <td>${holding.owner}<br /><small>${holding.id}</small></td>
                      <td>${holding.symbol}<br /><small>${holding.company}</small></td>
                      <td>${holding.quantity}</td>
                      <td>${currency(holding.buyPrice)}</td>
                      <td>${currency(holding.currentPrice)}</td>
                      <td class="${metrics.pnl >= 0 ? "profit" : "loss"}">${currency(metrics.pnl)}<br /><small>${percent(metrics.pnlPct)}</small></td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </article>

      <article class="dashboard-card">
        <div class="panel-head"><h3>Client Downloads</h3><span class="badge green">Export</span></div>
        <div class="stack-list">
          ${users
            .map((user) => {
              const totals = portfolioTotals(user.portfolio);
              return `
                <article class="stack-item">
                  <div>
                    <strong>${user.name}</strong>
                    <small>${user.id}</small>
                  </div>
                  <div class="actions-row">
                    <span class="${totals.pnl >= 0 ? "profit" : "loss"}">${currency(totals.pnl)}</span>
                    <button class="download-btn" type="button" data-download-user="${user.id}">Download Dashboard</button>
                  </div>
                </article>
              `;
            })
            .join("")}
        </div>
      </article>
    </div>

    <div class="dashboard-grid">
      <article class="dashboard-card">
        <div class="panel-head"><h3>Month-on-Month P&amp;L</h3><span class="badge">Trend</span></div>
        ${renderChart([
          { label: "Nov", value: 92000 },
          { label: "Dec", value: 132000 },
          { label: "Jan", value: -28000 },
          { label: "Feb", value: 87000 },
          { label: "Mar", value: 111000 },
          { label: "Apr", value: 146000 }
        ])}
      </article>

      <article class="dashboard-card">
        <div class="panel-head"><h3>Live Market Numbers</h3><span class="badge red">Moving</span></div>
        <div class="ticker-list" id="adminTicker"></div>
      </article>
    </div>
  `;

  mount.classList.remove("hidden");
  activeRole = "admin";
  activeUserId = null;
  setupDownloadButtons();
  renderTicker("adminTicker");
}

function renderUserPortal(user) {
  const mount = document.getElementById("userPortal");
  if (!mount) return;

  const totals = portfolioTotals(user.portfolio);
  const overallPct = totals.invested ? (totals.pnl / totals.invested) * 100 : 0;

  mount.innerHTML = `
    <div class="metrics-grid">
      <article class="metric-card"><strong>${currency(totals.invested)}</strong><span>Total Invested</span><small>Lifetime capital deployed</small></article>
      <article class="metric-card"><strong>${currency(totals.currentValue)}</strong><span>Current Value</span><small>Latest portfolio valuation</small></article>
      <article class="metric-card"><strong class="${totals.pnl >= 0 ? "profit" : "loss"}">${currency(totals.pnl)}</strong><span>Profit Amount</span><small>Total gain or loss</small></article>
      <article class="metric-card"><strong>${percent(overallPct)}</strong><span>Return</span><small>Lifetime profit percentage</small></article>
    </div>

    <div class="dashboard-grid">
      <article class="dashboard-card">
        <div class="panel-head"><h3>Add Stocks To Portfolio</h3><span class="badge">Manual Entry</span></div>
        <form id="portfolioForm" class="portfolio-form">
          <label><span>Stock Symbol</span><input name="symbol" type="text" required /></label>
          <label><span>Company Name</span><input name="company" type="text" required /></label>
          <label><span>Quantity</span><input name="quantity" type="number" min="1" required /></label>
          <label><span>Buy Price</span><input name="buyPrice" type="number" min="1" step="0.01" required /></label>
          <label><span>Current Price</span><input name="currentPrice" type="number" min="1" step="0.01" required /></label>
          <button class="primary-btn" type="submit">Add Stock</button>
        </form>
      </article>

      <article class="table-card">
        <div class="panel-head"><h3>Current Portfolio</h3><span class="badge green">Client View</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Stock</th><th>Qty</th><th>Invested</th><th>Live Value</th><th>P&amp;L</th><th>Status</th></tr></thead>
            <tbody>
              ${user.portfolio
                .map((holding) => {
                  const metrics = holdingMetrics(holding);
                  return `
                    <tr>
                      <td>${holding.symbol}<br /><small>${holding.company}</small></td>
                      <td>${holding.quantity}</td>
                      <td>${currency(metrics.invested)}</td>
                      <td>${currency(metrics.currentValue)}</td>
                      <td class="${metrics.pnl >= 0 ? "profit" : "loss"}">${currency(metrics.pnl)}</td>
                      <td>${metrics.pnl >= 0 ? "Profit" : "Loss"}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </article>
    </div>

    <div class="dashboard-grid">
      <article class="dashboard-card">
        <div class="panel-head"><h3>Lifetime Profit &amp; Loss History</h3><span class="badge">Trend</span></div>
        ${renderChart(user.history)}
      </article>
      <article class="dashboard-card">
        <div class="panel-head"><h3>Portfolio Snapshot</h3><span class="badge green">Summary</span></div>
        <div class="stack-list">
          ${user.portfolio
            .map((holding) => {
              const metrics = holdingMetrics(holding);
              return `
                <article class="stack-item">
                  <div><strong>${holding.symbol}</strong><small>${holding.quantity} shares</small></div>
                  <div><strong>${currency(metrics.currentValue)}</strong><small class="${metrics.pnl >= 0 ? "profit" : "loss"}">${percent(metrics.pnlPct)}</small></div>
                </article>
              `;
            })
            .join("")}
        </div>
        <div class="actions-row" style="margin-top:16px;">
          <button class="download-btn" type="button" id="userPrintBtn">Download Dashboard</button>
        </div>
      </article>
    </div>
  `;

  mount.classList.remove("hidden");
  activeRole = "user";
  activeUserId = user.id;
  document.getElementById("userPrintBtn").addEventListener("click", () => window.print());
  setupPortfolioForm(user);
}

function renderTicker(elementId) {
  const mount = document.getElementById(elementId);
  if (!mount) return;

  const rows = users
    .flatMap((user) => user.portfolio)
    .slice(0, 6)
    .map((holding) => {
      const changePct = ((holding.currentPrice - holding.buyPrice) / holding.buyPrice) * 100;
      return `
        <article class="ticker-item">
          <div><strong>${holding.symbol}</strong><small>${holding.company}</small></div>
          <div><strong>${currency(holding.currentPrice)}</strong><small class="${changePct >= 0 ? "profit" : "loss"}">${percent(changePct)}</small></div>
        </article>
      `;
    });

  mount.innerHTML = rows.join("");
}

function tickMarket() {
  users.forEach((user) => {
    user.portfolio.forEach((holding) => {
      const swing = (Math.random() - 0.48) * Math.max(holding.currentPrice * 0.012, 2);
      holding.currentPrice = Math.max(1, Number((holding.currentPrice + swing).toFixed(2)));
    });
  });
}

function setupPortfolioForm(user) {
  const form = document.getElementById("portfolioForm");
  if (!form) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    user.portfolio.unshift({
      symbol: String(data.get("symbol")).trim().toUpperCase(),
      company: String(data.get("company")).trim(),
      quantity: Number(data.get("quantity")),
      buyPrice: Number(data.get("buyPrice")),
      currentPrice: Number(data.get("currentPrice"))
    });
    user.history.push({
      label: `Entry ${user.history.length - 3}`,
      value: Math.round((Number(data.get("currentPrice")) - Number(data.get("buyPrice"))) * Number(data.get("quantity")))
    });
    renderUserPortal(user);
  });
}

function downloadUserDashboard(userId) {
  const user = users.find((entry) => entry.id === userId);
  if (!user) return;
  const totals = portfolioTotals(user.portfolio);
  const html = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>${user.name} Dashboard</title>
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
        <h1>${user.name} Portfolio Dashboard</h1>
        <p>${user.id}</p>
        <div class="grid">
          <div class="card"><strong>Total Invested</strong><div>${currency(totals.invested)}</div></div>
          <div class="card"><strong>Current Value</strong><div>${currency(totals.currentValue)}</div></div>
          <div class="card"><strong>Total P&amp;L</strong><div class="${totals.pnl >= 0 ? "profit" : "loss"}">${currency(totals.pnl)}</div></div>
        </div>
        <h2>Holdings</h2>
        <table>
          <thead><tr><th>Stock</th><th>Qty</th><th>Invested</th><th>Current</th><th>P&amp;L</th></tr></thead>
          <tbody>
            ${user.portfolio
              .map((holding) => {
                const metrics = holdingMetrics(holding);
                return `<tr><td>${holding.symbol}</td><td>${holding.quantity}</td><td>${currency(metrics.invested)}</td><td>${currency(metrics.currentValue)}</td><td class="${metrics.pnl >= 0 ? "profit" : "loss"}">${currency(metrics.pnl)}</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${user.id.toLowerCase()}-dashboard.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function setupDownloadButtons() {
  document.querySelectorAll("[data-download-user]").forEach((button) => {
    button.addEventListener("click", () => downloadUserDashboard(button.dataset.downloadUser));
  });
}

function setupLogin() {
  const adminForm = document.getElementById("adminForm");
  const userForm = document.getElementById("userForm");
  if (!adminForm || !userForm) return;

  const toggles = document.querySelectorAll(".role-toggle");
  const adminPortal = document.getElementById("adminPortal");
  const userPortal = document.getElementById("userPortal");

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const role = toggle.dataset.roleTab;
      toggles.forEach((entry) => entry.classList.toggle("active", entry === toggle));
      adminForm.classList.toggle("hidden", role !== "admin");
      userForm.classList.toggle("hidden", role !== "user");
      adminPortal.classList.add("hidden");
      userPortal.classList.add("hidden");
      activeRole = null;
      activeUserId = null;
    });
  });

  document.querySelectorAll("[data-send-otp]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.sendOtp === "admin") {
        document.getElementById("adminOtpHint").textContent = `Demo OTP: ${OTP.admin}`;
      } else {
        const userId = String(userForm.querySelector('[name="userId"]').value).trim().toUpperCase();
        document.getElementById("userOtpHint").textContent = `Demo code: ${OTP.users[userId] || "No code for this ID"}`;
      }
    });
  });

  adminForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(adminForm);
    const valid =
      data.get("username") === "admin_dev" &&
      data.get("password") === "Admin@123" &&
      data.get("phone") === "9876543210" &&
      data.get("otp") === OTP.admin;

    if (!valid) {
      document.getElementById("adminError").textContent = "Use admin_dev / Admin@123 / 9876543210 / 456789.";
      return;
    }

    document.getElementById("adminError").textContent = "";
    renderAdminPortal();
    userPortal.classList.add("hidden");
    window.scrollTo({ top: adminPortal.offsetTop - 20, behavior: "smooth" });
  });

  userForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(userForm);
    const id = String(data.get("userId")).trim().toUpperCase();
    const user = users.find((entry) => entry.id === id);

    const valid =
      user &&
      data.get("password") === user.password &&
      data.get("phone") === user.phone &&
      data.get("otp") === OTP.users[id];

    if (!valid) {
      document.getElementById("userError").textContent = "Use a fixed ID like CLIENT-1001 with User@123, matching phone, and the shown code.";
      return;
    }

    document.getElementById("userError").textContent = "";
    renderUserPortal(user);
    adminPortal.classList.add("hidden");
    window.scrollTo({ top: userPortal.offsetTop - 20, behavior: "smooth" });
  });

  setInterval(() => {
    tickMarket();
    if (activeRole === "admin") {
      renderAdminPortal();
    }
    if (activeRole === "user" && activeUserId) {
      const user = users.find((entry) => entry.id === activeUserId);
      if (user) {
        renderUserPortal(user);
      }
    }
  }, 2500);
}

setupFaq();
setupReviewForm();
setupLogin();
