/* =========================================================
   Smart Expense Tracker — Vanilla JS (modular IIFE pattern)
   Data persistence: Local Storage. No backend.
   Modules: Store | Utils | Charts | Toast | UI
   ========================================================= */

/* ----------------------- Constants ----------------------- */
const STORAGE_KEY = "set.transactions.v1";
const THEME_KEY = "set.theme";
const PAGE_SIZE = 6;

const CATEGORIES = [
  { name: "Food", icon: "🍔", color: "#F97316" },
  { name: "Shopping", icon: "🛍️", color: "#EC4899" },
  { name: "Travel", icon: "✈️", color: "#0EA5E9" },
  { name: "Bills", icon: "🧾", color: "#8B5CF6" },
  { name: "Entertainment", icon: "🎬", color: "#F43F5E" },
  { name: "Education", icon: "🎓", color: "#6366F1" },
  { name: "Health", icon: "🩺", color: "#14B8A6" },
  { name: "Salary", icon: "💼", color: "#10B981" },
  { name: "Freelancing", icon: "💻", color: "#22C55E" },
  { name: "Others", icon: "✨", color: "#64748B" },
];

const catMeta = (name) => CATEGORIES.find((c) => c.name === name) || CATEGORIES[9];

/* ----------------------- Utils --------------------------- */
const Utils = {
  money(n) {
    const sign = n < 0 ? "-" : "";
    return (
      sign +
      "₹" +
      Math.abs(Number(n) || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })
    );
  },
  monthKey(dateStr) {
    return String(dateStr).slice(0, 7); // YYYY-MM
  },
  monthLabel(key) {
    const [y, m] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleString("en-US", { month: "short", year: "numeric" });
  },
  dateLabel(dateStr) {
    const d = new Date(dateStr + "T00:00:00");
    return isNaN(d) ? dateStr : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  },
  today() {
    return new Date().toISOString().slice(0, 10);
  },
  uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  },
  debounce(fn, ms = 250) {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  },
  escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },
};

/* ----------------------- Store (Local Storage) ----------- */
const Store = {
  items: [],
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(this.items)) this.items = [];
    } catch {
      this.items = [];
    }
    return this.items;
  },
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items));
    } catch {
      Toast.show("Could not save data locally", "error");
    }
  },
  add(tx) {
    this.items.push({ ...tx, id: Utils.uid(), createdAt: Date.now() });
    this.save();
  },
  update(id, patch) {
    const i = this.items.findIndex((t) => t.id === id);
    if (i > -1) {
      this.items[i] = { ...this.items[i], ...patch };
      this.save();
    }
  },
  remove(id) {
    this.items = this.items.filter((t) => t.id !== id);
    this.save();
  },
  clear() {
    this.items = [];
    this.save();
  },
  get(id) {
    return this.items.find((t) => t.id === id);
  },
  /* -------- derived analytics -------- */
  totals() {
    let income = 0,
      expense = 0;
    this.items.forEach((t) => (t.type === "income" ? (income += t.amount) : (expense += t.amount)));
    return { income, expense, balance: income - expense };
  },
  monthTotals(key) {
    let income = 0,
      expense = 0;
    this.items
      .filter((t) => Utils.monthKey(t.date) === key)
      .forEach((t) => (t.type === "income" ? (income += t.amount) : (expense += t.amount)));
    return { income, expense, savings: income - expense };
  },
  monthsSorted() {
    return [...new Set(this.items.map((t) => Utils.monthKey(t.date)))].sort().reverse();
  },
  lastMonths(n) {
    const out = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
      out.push(`${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`);
    }
    return out;
  },
  byCategory(type = "expense") {
    const map = {};
    this.items.filter((t) => t.type === type).forEach((t) => (map[t.category] = (map[t.category] || 0) + t.amount));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  },
};

/* ----------------------- Toast --------------------------- */
const Toast = {
  el: null,
  show(message, variant = "info") {
    if (!this.el) this.el = document.getElementById("toasts");
    const t = document.createElement("div");
    t.className = `toast toast--${variant}`;
    t.textContent = message;
    this.el.appendChild(t);
    setTimeout(() => {
      t.classList.add("is-out");
      t.addEventListener("animationend", () => t.remove());
    }, 2600);
  },
};

/* ----------------------- Charts (canvas, no libs) -------- */
const Charts = {
  css(v) {
    return getComputedStyle(document.body).getPropertyValue(v).trim();
  },
  prep(canvas, cssHeight) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 400;
    canvas.width = w * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.height = cssHeight + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, cssHeight);
    return { ctx, w, h: cssHeight };
  },
  bar(canvas, labels, values) {
    const { ctx, w, h } = this.prep(canvas, 260);
    const pad = { l: 44, r: 10, t: 14, b: 30 };
    const max = Math.max(...values, 1);
    const muted = this.css("--muted") || "#64748b";
    const border = this.css("--border") || "rgba(0,0,0,.08)";

    // grid + y axis labels
    ctx.font = "11px Inter, sans-serif";
    ctx.fillStyle = muted;
    ctx.strokeStyle = border;
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + ((h - pad.t - pad.b) * i) / 4;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      const val = Math.round(max - (max * i) / 4);
      ctx.fillText(val >= 1000 ? Math.round(val / 1000) + "k" : String(val), 6, y + 4);
    }

    // bars
    const zone = (w - pad.l - pad.r) / labels.length;
    const bw = Math.min(38, zone * 0.5);
    values.forEach((v, i) => {
      const bh = ((h - pad.t - pad.b) * v) / max;
      const x = pad.l + zone * i + (zone - bw) / 2;
      const y = h - pad.b - bh;
      const g = ctx.createLinearGradient(0, y, 0, h - pad.b);
      g.addColorStop(0, "#6366F1");
      g.addColorStop(1, "rgba(99,102,241,0.25)");
      ctx.fillStyle = g;
      const r = Math.min(8, bw / 2, Math.max(bh, 0.1));
      ctx.beginPath();
      ctx.moveTo(x, h - pad.b);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.lineTo(x + bw - r, y);
      ctx.quadraticCurveTo(x + bw, y, x + bw, y + r);
      ctx.lineTo(x + bw, h - pad.b);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = muted;
      ctx.textAlign = "center";
      ctx.fillText(labels[i], x + bw / 2, h - 10);
      ctx.textAlign = "left";
    });
  },
  pie(canvas, entries) {
    const size = 220;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
    let start = -Math.PI / 2;
    const cx = size / 2,
      cy = size / 2,
      R = size / 2 - 6,
      r = R * 0.62;

    entries.forEach(([name, val]) => {
      const angle = (val / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R, start, start + angle);
      ctx.arc(cx, cy, r, start + angle, start, true);
      ctx.closePath();
      ctx.fillStyle = catMeta(name).color;
      ctx.fill();
      start += angle;
    });

    ctx.fillStyle = this.css("--text") || "#0f172a";
    ctx.font = "600 15px Sora, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Utils.money(total), cx, cy + 5);
    ctx.font = "10px Inter, sans-serif";
    ctx.fillStyle = this.css("--muted") || "#64748b";
    ctx.fillText("TOTAL SPENT", cx, cy + 22);
  },
};

/* ----------------------- UI ------------------------------ */
const UI = {
  state: { view: "dashboard", page: 1, search: "", category: "", month: "", type: "", formType: "expense" },
  pendingDelete: null,

  $(id) {
    return document.getElementById(id);
  },

  init() {
    Store.load();
    this.applyTheme(localStorage.getItem(THEME_KEY) || "light");
    this.fillCategorySelects();
    this.bind();
    this.$("date").value = Utils.today();
    this.render();
    // loading animation
    setTimeout(() => {
      this.$("loader").classList.add("is-hidden");
      this.$("app").hidden = false;
      setTimeout(() => (this.$("loader").style.display = "none"), 400);
      this.renderCharts();
    }, 700);
  },

  /* -------- theme -------- */
  applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    this.$("themeBtn").textContent = theme === "dark" ? "☀️" : "🌙";
  },
  toggleTheme() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    this.applyTheme(next);
    this.renderCharts();
    Toast.show(`${next === "dark" ? "Dark" : "Light"} mode enabled`);
  },

  /* -------- selects -------- */
  fillCategorySelects() {
    const opts = CATEGORIES.map((c) => `<option value="${c.name}">${c.icon} ${c.name}</option>`).join("");
    this.$("category").innerHTML = opts;
    this.$("categoryFilter").innerHTML = `<option value="">All categories</option>` + opts;
  },
  fillMonthFilter() {
    const months = Store.monthsSorted();
    const cur = this.state.month;
    this.$("monthFilter").innerHTML =
      `<option value="">All months</option>` +
      months.map((m) => `<option value="${m}"${m === cur ? " selected" : ""}>${Utils.monthLabel(m)}</option>`).join("");
  },

  /* -------- events -------- */
  bind() {
    document.querySelectorAll("[data-nav]").forEach((b) =>
      b.addEventListener("click", () => this.goto(b.dataset.nav))
    );
    this.$("menuBtn").addEventListener("click", () => this.$("sidebar").classList.toggle("is-open"));
    this.$("themeBtn").addEventListener("click", () => this.toggleTheme());
    this.$("openFormBtn").addEventListener("click", () => this.openForm());
    this.$("closeFormBtn").addEventListener("click", () => this.closeForm());
    this.$("cancelFormBtn").addEventListener("click", () => this.closeForm());
    this.$("overlay").addEventListener("click", () => this.closeForm());
    this.$("txForm").addEventListener("submit", (e) => this.submitForm(e));

    document.querySelectorAll(".toggle__btn").forEach((b) =>
      b.addEventListener("click", () => {
        document.querySelectorAll(".toggle__btn").forEach((x) => x.classList.remove("is-active"));
        b.classList.add("is-active");
        this.state.formType = b.dataset.type;
      })
    );

    this.$("searchInput").addEventListener(
      "input",
      Utils.debounce((e) => {
        this.state.search = e.target.value.toLowerCase();
        this.state.page = 1;
        this.renderTransactions();
      }, 200)
    );
    ["categoryFilter", "monthFilter", "typeFilter"].forEach((id) =>
      this.$(id).addEventListener("change", (e) => {
        this.state[id.replace("Filter", "")] = e.target.value;
        this.state.page = 1;
        this.renderTransactions();
      })
    );

    this.$("confirmCancel").addEventListener("click", () => this.closeConfirm());
    this.$("confirmOk").addEventListener("click", () => {
      if (this.pendingDelete) {
        Store.remove(this.pendingDelete);
        Toast.show("Transaction deleted", "success");
      }
      this.closeConfirm();
      this.render();
    });

    this.$("resetBtn").addEventListener("click", () => this.askDelete(null));
    this.$("exportBtn").addEventListener("click", () => this.exportJSON());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeForm();
        this.closeConfirm();
      }
    });
    window.addEventListener("resize", Utils.debounce(() => this.renderCharts(), 200));
  },

  goto(view) {
    this.state.view = view;
    document.querySelectorAll(".view").forEach((v) => (v.hidden = v.dataset.view !== view));
    document.querySelectorAll(".nav__item").forEach((n) => n.classList.toggle("is-active", n.dataset.nav === view));
    const titles = {
      dashboard: ["Dashboard", "Your money at a glance"],
      transactions: ["Transactions", "Search, filter and manage entries"],
      analytics: ["Analytics", "Insights from your spending"],
    };
    this.$("pageTitle").textContent = titles[view][0];
    this.$("pageSub").textContent = titles[view][1];
    this.$("sidebar").classList.remove("is-open");
    if (view === "dashboard") this.renderCharts();
  },

  /* -------- form -------- */
  openForm(id = null) {
    const f = this.$("txForm");
    f.reset();
    document.querySelectorAll(".err").forEach((e) => (e.textContent = ""));
    if (id) {
      const t = Store.get(id);
      if (!t) return;
      this.$("txId").value = t.id;
      this.$("title").value = t.title;
      this.$("amount").value = t.amount;
      this.$("category").value = t.category;
      this.$("date").value = t.date;
      this.$("notes").value = t.notes || "";
      this.setFormType(t.type);
      this.$("drawerTitle").textContent = "Edit Transaction";
      this.$("saveBtn").textContent = "Update";
    } else {
      this.$("txId").value = "";
      this.$("date").value = Utils.today();
      this.setFormType("expense");
      this.$("drawerTitle").textContent = "Add Transaction";
      this.$("saveBtn").textContent = "Save";
    }
    this.$("overlay").hidden = false;
    this.$("drawer").hidden = false;
    setTimeout(() => this.$("title").focus(), 60);
  },
  setFormType(type) {
    this.state.formType = type;
    document.querySelectorAll(".toggle__btn").forEach((b) => b.classList.toggle("is-active", b.dataset.type === type));
  },
  closeForm() {
    this.$("overlay").hidden = true;
    this.$("drawer").hidden = true;
  },

  /* -------- validation -------- */
  validate(data) {
    const errors = {};
    if (!data.title) errors.title = "Title is required";
    else if (data.title.length < 2) errors.title = "Title is too short";

    if (data.amountRaw === "") errors.amount = "Amount is required";
    else if (isNaN(data.amount)) errors.amount = "Enter a valid number";
    else if (data.amount < 0) errors.amount = "Amount cannot be negative";
    else if (data.amount === 0) errors.amount = "Amount must be greater than zero";
    else if (data.amount > 1e12) errors.amount = "Amount is too large";

    if (!data.category) errors.category = "Select a category";

    if (!data.date) errors.date = "Date is required";
    else if (isNaN(new Date(data.date))) errors.date = "Invalid date";
    else if (data.date > Utils.today()) errors.date = "Date cannot be in the future";
    else if (data.date < "2000-01-01") errors.date = "Date is too far in the past";

    if (data.notes && data.notes.length > 200) errors.notes = "Notes must be under 200 characters";
    return errors;
  },

  submitForm(e) {
    e.preventDefault();
    const amountRaw = this.$("amount").value.trim();
    const data = {
      title: this.$("title").value.trim(),
      amountRaw,
      amount: Number(amountRaw),
      category: this.$("category").value,
      date: this.$("date").value,
      notes: this.$("notes").value.trim(),
      type: this.state.formType,
    };
    const errors = this.validate(data);
    document.querySelectorAll(".err").forEach((el) => (el.textContent = errors[el.dataset.err] || ""));
    if (Object.keys(errors).length) {
      Toast.show("Please fix the highlighted fields", "error");
      return;
    }
    const payload = {
      title: data.title,
      amount: Math.round(data.amount * 100) / 100,
      category: data.category,
      date: data.date,
      notes: data.notes,
      type: data.type,
    };
    const id = this.$("txId").value;
    if (id) {
      Store.update(id, payload);
      Toast.show("Transaction updated", "success");
    } else {
      Store.add(payload);
      Toast.show("Transaction added", "success");
    }
    this.closeForm();
    this.render();
  },

  /* -------- delete confirm -------- */
  askDelete(id) {
    this.pendingDelete = id;
    this.$("confirmText").textContent = id
      ? "This transaction will be permanently removed. This action cannot be undone."
      : "All transactions will be permanently deleted from this device.";
    this.$("confirmOk").textContent = id ? "Delete" : "Delete all";
    if (!id) {
      this.$("confirmOk").onclick = () => {
        Store.clear();
        Toast.show("All data cleared", "success");
        this.closeConfirm();
        this.render();
      };
    } else {
      this.$("confirmOk").onclick = null;
    }
    this.$("confirmModal").hidden = false;
  },
  closeConfirm() {
    this.pendingDelete = null;
    this.$("confirmModal").hidden = true;
  },

  exportJSON() {
    const blob = new Blob([JSON.stringify(Store.items, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "smart-expense-tracker.json";
    a.click();
    URL.revokeObjectURL(a.href);
    Toast.show("Data exported", "success");
  },

  /* -------- rendering -------- */
  render() {
    this.fillMonthFilter();
    this.renderStats();
    this.renderRecent();
    this.renderTransactions();
    this.renderAnalytics();
    this.renderCharts();
  },

  renderStats() {
    const { income, expense, balance } = Store.totals();
    const nowKey = Utils.monthKey(Utils.today());
    const m = Store.monthTotals(nowKey);
    this.$("statBalance").textContent = Utils.money(balance);
    this.$("statIncome").textContent = Utils.money(income);
    this.$("statExpense").textContent = Utils.money(expense);
    this.$("statSavings").textContent = Utils.money(m.savings);
    this.$("statSavingsHint").textContent = Utils.monthLabel(nowKey);
    this.$("statBalanceHint").textContent = `${Store.items.length} transactions`;
  },

  txRow(t) {
    const meta = catMeta(t.category);
    const sign = t.type === "income" ? "+" : "-";
    return `<li class="tx" data-id="${t.id}">
      <div class="tx__icon" style="background:${meta.color}22">${meta.icon}</div>
      <div class="tx__body">
        <div class="tx__title">${Utils.escape(t.title)}</div>
        <div class="tx__meta">${Utils.escape(t.category)} • ${Utils.dateLabel(t.date)}${
      t.notes ? " • " + Utils.escape(t.notes.slice(0, 40)) : ""
    }</div>
      </div>
      <div class="tx__amount ${t.type}">${sign}${Utils.money(t.amount)}</div>
      <div class="tx__actions">
        <button data-act="edit" aria-label="Edit">✏️</button>
        <button data-act="delete" aria-label="Delete">🗑️</button>
      </div>
    </li>`;
  },

  wireRows(container) {
    container.querySelectorAll(".tx").forEach((row) => {
      row.querySelectorAll("[data-act]").forEach((b) =>
        b.addEventListener("click", () => {
          const id = row.dataset.id;
          if (b.dataset.act === "edit") this.openForm(id);
          else this.askDelete(id);
        })
      );
    });
  },

  renderRecent() {
    const list = [...Store.items].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);
    const el = this.$("recentList");
    el.innerHTML = list.map((t) => this.txRow(t)).join("");
    this.$("recentEmpty").hidden = list.length > 0;
    this.wireRows(el);
  },

  filtered() {
    const s = this.state;
    return Store.items
      .filter((t) => {
        const hay = (t.title + " " + (t.notes || "") + " " + t.category).toLowerCase();
        return (
          (!s.search || hay.includes(s.search)) &&
          (!s.category || t.category === s.category) &&
          (!s.month || Utils.monthKey(t.date) === s.month) &&
          (!s.type || t.type === s.type)
        );
      })
      .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1));
  },

  renderTransactions() {
    const rows = this.filtered();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (this.state.page > pages) this.state.page = pages;
    const start = (this.state.page - 1) * PAGE_SIZE;
    const slice = rows.slice(start, start + PAGE_SIZE);

    const el = this.$("txList");
    el.innerHTML = slice.map((t) => this.txRow(t)).join("");
    this.$("txEmpty").hidden = rows.length > 0;
    this.$("txEmpty").textContent = Store.items.length
      ? "No transactions match your filters."
      : "No transactions yet — add your first one to get started.";
    this.wireRows(el);
    this.renderPagination(pages, rows.length);
  },

  renderPagination(pages, total) {
    const p = this.$("pagination");
    if (total <= PAGE_SIZE) {
      p.innerHTML = "";
      return;
    }
    let html = `<button data-page="${this.state.page - 1}" ${this.state.page === 1 ? "disabled" : ""}>‹</button>`;
    for (let i = 1; i <= pages; i++) {
      html += `<button data-page="${i}" class="${i === this.state.page ? "is-active" : ""}">${i}</button>`;
    }
    html += `<button data-page="${this.state.page + 1}" ${this.state.page === pages ? "disabled" : ""}>›</button>`;
    p.innerHTML = html;
    p.querySelectorAll("button[data-page]").forEach((b) =>
      b.addEventListener("click", () => {
        const n = Number(b.dataset.page);
        if (n >= 1 && n <= pages) {
          this.state.page = n;
          this.renderTransactions();
        }
      })
    );
  },

  renderCharts() {
    // Monthly expense bar chart
    const months = Store.lastMonths(6);
    const values = months.map((m) => Store.monthTotals(m).expense);
    const hasBar = values.some((v) => v > 0);
    this.$("barEmpty").hidden = hasBar;
    this.$("barChart").hidden = !hasBar;
    if (hasBar) Charts.bar(this.$("barChart"), months.map((m) => Utils.monthLabel(m).split(" ")[0]), values);

    // Category pie chart
    const entries = Store.byCategory("expense");
    const hasPie = entries.length > 0;
    this.$("pieEmpty").hidden = hasPie;
    this.$("pieChart").hidden = !hasPie;
    const legend = this.$("pieLegend");
    if (hasPie) {
      Charts.pie(this.$("pieChart"), entries);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      legend.innerHTML = entries
        .map(
          ([n, v]) =>
            `<li><i style="background:${catMeta(n).color}"></i>${Utils.escape(n)} <b>${Math.round(
              (v / total) * 100
            )}%</b></li>`
        )
        .join("");
    } else {
      legend.innerHTML = "";
    }
  },

  renderAnalytics() {
    const entries = Store.byCategory("expense");
    if (entries.length) {
      const [name, val] = entries[0];
      const total = entries.reduce((s, [, v]) => s + v, 0);
      this.$("topCategory").textContent = `${catMeta(name).icon} ${name}`;
      this.$("topCategoryMeta").textContent = `${Utils.money(val)} spent • ${Math.round(
        (val / total) * 100
      )}% of all expenses`;
    } else {
      this.$("topCategory").textContent = "—";
      this.$("topCategoryMeta").textContent = "Add expenses to see insights.";
    }

    const key = Utils.monthKey(Utils.today());
    const m = Store.monthTotals(key);
    const count = Store.items.filter((t) => Utils.monthKey(t.date) === key).length;
    const rate = m.income ? Math.round((m.savings / m.income) * 100) : 0;
    this.$("monthSummary").innerHTML = [
      ["Month", Utils.monthLabel(key)],
      ["Income", Utils.money(m.income)],
      ["Expenses", Utils.money(m.expense)],
      ["Savings", Utils.money(m.savings)],
      ["Savings rate", `${rate}%`],
      ["Transactions", String(count)],
    ]
      .map(([k, v]) => `<li><span class="muted">${k}</span><strong>${v}</strong></li>`)
      .join("");

    const months = Store.monthsSorted();
    const tbody = this.$("monthTable").querySelector("tbody");
    tbody.innerHTML = months
      .map((mk) => {
        const d = Store.monthTotals(mk);
        return `<tr><td>${Utils.monthLabel(mk)}</td><td>${Utils.money(d.income)}</td><td>${Utils.money(
          d.expense
        )}</td><td>${Utils.money(d.savings)}</td></tr>`;
      })
      .join("");
    this.$("monthTableEmpty").hidden = months.length > 0;
  },
};

document.addEventListener("DOMContentLoaded", () => UI.init());
