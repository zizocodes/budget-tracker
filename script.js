// script.js
// Personal Budget Tracker logic
// Data model is stored per-month in LocalStorage under key "budget-YYYY-MM"

// === Helpers for month, storage, and currency ===

// Return YYYY-MM string from a Date
function getMonthKeyFromDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  
  // Parse a YYYY-MM string to a human label
  function monthKeyToLabel(monthKey) {
    const [y, m] = monthKey.split("-");
    const dt = new Date(Number(y), Number(m) - 1, 1);
    return dt.toLocaleString("default", { month: "long", year: "numeric" });
  }
  
  // Get current month key
  function getCurrentMonthKey() {
    return getMonthKeyFromDate(new Date());
  }
  
  // LocalStorage load/save
  function loadMonthData(monthKey) {
    const raw = localStorage.getItem("budget-" + monthKey);
    if (!raw) {
      return {
        income: [],
        expenses: [],
        lending: [],
        wallet: 0,      // stored in KWD fils (integer)
        savings: 0      // stored in KWD fils (integer)
      };
    }
    return JSON.parse(raw);
  }
  
  function saveMonthData(monthKey, data) {
    localStorage.setItem("budget-" + monthKey, JSON.stringify(data));
  }
  
  // Safely convert decimal amount (string or number) to integer "fils" (3 decimals)
  function amountToFils(amount) {
    // Force string, handle up to 3 decimal places exactly
    const str = String(amount);
    const [intPart, decPart = ""] = str.split(".");
    const paddedDec = (decPart + "000").slice(0, 3); // always 3 digits
    const value = Number(intPart) * 1000 + Number(paddedDec);
    return value;
  }
  
  // Convert fils back to string with 3 decimals (e.g., "1.250")
  function filsToAmountString(filsInt) {
    const isNegative = filsInt < 0;
    const v = Math.abs(filsInt);
    const intPart = Math.floor(v / 1000);
    const decPart = String(v % 1000).padStart(3, "0");
    return (isNegative ? "-" : "") + intPart + "." + decPart;
  }
  
  // Format an amount with currency, e.g. "KWD 1.250"
  function formatCurrency(amountFils, currency) {
    if (currency === "KWD") {
      return "KWD " + filsToAmountString(amountFils);
    } else {
      // For non-KWD we still store as text amounts (not aggregated in totals)
      return currency + " " + filsToAmountString(amountFils);
    }
  }
  
  // === Global state ===
  let currentMonthKey = getCurrentMonthKey();
  let monthData = loadMonthData(currentMonthKey);
  
  // DOM elements
  const monthPicker = document.getElementById("monthPicker");
  const currentMonthLabel = document.getElementById("currentMonthLabel");
  
  const totalIncomeDisplay = document.getElementById("totalIncomeDisplay");
  const totalExpensesDisplay = document.getElementById("totalExpensesDisplay");
  const totalSavingsDisplay = document.getElementById("totalSavingsDisplay");
  const walletBalanceDisplay = document.getElementById("walletBalanceDisplay");
  const savingsBalanceDisplay = document.getElementById("savingsBalanceDisplay");
  
  const incomeForm = document.getElementById("incomeForm");
  const incomeTableBody = document.querySelector("#incomeTable tbody");
  
  const expenseForm = document.getElementById("expenseForm");
  const expenseTableBody = document.querySelector("#expenseTable tbody");
  
  const lbForm = document.getElementById("lbForm");
  const lbTableBody = document.querySelector("#lbTable tbody");
  
  const walletToSavingsBtn = document.getElementById("walletToSavingsBtn");
  const incomeToSavingsBtn = document.getElementById("incomeToSavingsBtn");
  const clearMonthBtn = document.getElementById("clearMonthBtn");
  const exportPdfBtn = document.getElementById("exportPdfBtn");
  
  const toReceiveSummary = document.getElementById("toReceiveSummary");
  const toPayBackSummary = document.getElementById("toPayBackSummary");
  
  // Initialize month picker to current month
  (function initMonthPicker() {
    monthPicker.value = currentMonthKey;
    currentMonthLabel.textContent = "Current month: " + monthKeyToLabel(currentMonthKey);
  })();
  
  // When month changes, load that month's data
  monthPicker.addEventListener("change", () => {
    currentMonthKey = monthPicker.value || getCurrentMonthKey();
    monthData = loadMonthData(currentMonthKey);
    currentMonthLabel.textContent = "Current month: " + monthKeyToLabel(currentMonthKey);
    renderAll();
  });
  
  // === Rendering functions ===
  
  // Calculate totals per currency
  function calculateTotals() {
    const incomeTotals = {};
    const expenseTotals = {};
  
    // Initialize objects as { KWD: filsInt, USD: filsInt, ... }
    const ensureCurrency = (obj, currency) => {
      if (!obj[currency]) obj[currency] = 0;
    };
  
    monthData.income.forEach((entry) => {
      ensureCurrency(incomeTotals, entry.currency);
      incomeTotals[entry.currency] += entry.amountFils;
    });
  
    monthData.expenses.forEach((entry) => {
      ensureCurrency(expenseTotals, entry.currency);
      expenseTotals[entry.currency] += entry.amountFils;
    });
  
    return { incomeTotals, expenseTotals };
  }
  
  // Build a display string for totals by currency
  function totalsToDisplayString(totalsObj) {
    const parts = [];
    for (const cur in totalsObj) {
      parts.push(formatCurrency(totalsObj[cur], cur));
    }
    return parts.join(" | ");
  }
  
  // Render dashboard
  function renderDashboard() {
    const { incomeTotals, expenseTotals } = calculateTotals();
  
    totalIncomeDisplay.textContent =
      Object.keys(incomeTotals).length === 0 ? "–" : totalsToDisplayString(incomeTotals);
  
    totalExpensesDisplay.textContent =
      Object.keys(expenseTotals).length === 0 ? "–" : totalsToDisplayString(expenseTotals);
  
    // Total savings per currency = income - expenses (only if both exist)
    // We focus on KWD for the main savings + also show other currencies if present
    const savingsTotals = {};
    const currencies = new Set([
      ...Object.keys(incomeTotals),
      ...Object.keys(expenseTotals)
    ]);
  
    currencies.forEach((cur) => {
      const inc = incomeTotals[cur] || 0;
      const exp = expenseTotals[cur] || 0;
      savingsTotals[cur] = inc - exp;
    });
  
    totalSavingsDisplay.textContent =
      Object.keys(savingsTotals).length === 0 ? "–" : totalsToDisplayString(savingsTotals);
  
    // Wallet and savings are tracked only in KWD
    walletBalanceDisplay.textContent = "KWD " + filsToAmountString(monthData.wallet);
    savingsBalanceDisplay.textContent = "KWD " + filsToAmountString(monthData.savings);
  }
  
  // Render tables
  
  function renderIncomeTable() {
    incomeTableBody.innerHTML = "";
    monthData.income.forEach((entry, index) => {
      const tr = document.createElement("tr");
  
      tr.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.source}</td>
        <td>${filsToAmountString(entry.amountFils)}</td>
        <td>${entry.currency}</td>
        <td>${entry.notes || "-"}</td>
        <td>
          <button class="action-btn edit" data-type="income" data-index="${index}">✏️</button>
          <button class="action-btn delete" data-type="income" data-index="${index}">🗑</button>
        </td>
      `;
  
      incomeTableBody.appendChild(tr);
    });
  }
  
  function renderExpenseTable() {
    expenseTableBody.innerHTML = "";
    monthData.expenses.forEach((entry, index) => {
      const tr = document.createElement("tr");
  
      tr.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.category}</td>
        <td>${filsToAmountString(entry.amountFils)}</td>
        <td>${entry.currency}</td>
        <td>${entry.method}</td>
        <td>${entry.notes || "-"}</td>
        <td>
          <button class="action-btn edit" data-type="expense" data-index="${index}">✏️</button>
          <button class="action-btn delete" data-type="expense" data-index="${index}">🗑</button>
        </td>
      `;
  
      expenseTableBody.appendChild(tr);
    });
  }
  
  function renderLBTable() {
    lbTableBody.innerHTML = "";
    monthData.lending.forEach((entry, index) => {
      const tr = document.createElement("tr");
  
      tr.innerHTML = `
        <td>${entry.date}</td>
        <td>${entry.name}</td>
        <td>${filsToAmountString(entry.amountFils)}</td>
        <td>${entry.currency}</td>
        <td>${entry.reason || "-"}</td>
        <td>${entry.type}</td>
        <td>${entry.status}</td>
        <td>
          <button class="action-btn edit" data-type="lending" data-index="${index}">✏️</button>
          <button class="action-btn delete" data-type="lending" data-index="${index}">🗑</button>
        </td>
      `;
  
      lbTableBody.appendChild(tr);
    });
  }
  
  // Lending summary
  function renderLBSummary() {
    const toReceive = {};
    const toPayBack = {};
  
    const ensureCurrency = (obj, currency) => {
      if (!obj[currency]) obj[currency] = 0;
    };
  
    monthData.lending.forEach((entry) => {
      if (entry.status === "pending") {
        if (entry.type === "lend") {
          ensureCurrency(toReceive, entry.currency);
          toReceive[entry.currency] += entry.amountFils;
        } else if (entry.type === "borrow") {
          ensureCurrency(toPayBack, entry.currency);
          toPayBack[entry.currency] += entry.amountFils;
        }
      }
    });
  
    toReceiveSummary.textContent =
      "To receive: " +
      (Object.keys(toReceive).length === 0 ? "–" : totalsToDisplayString(toReceive));
  
    toPayBackSummary.textContent =
      "To pay back: " +
      (Object.keys(toPayBack).length === 0 ? "–" : totalsToDisplayString(toPayBack));
  }
  
  function renderAll() {
    renderDashboard();
    renderIncomeTable();
    renderExpenseTable();
    renderLBTable();
    renderLBSummary();
  }
  
  // Initial render
  renderAll();
  
  // === Form handlers ===
  
  // Income form
  incomeForm.addEventListener("submit", (e) => {
    e.preventDefault();
  
    const date = document.getElementById("incomeDate").value;
    const source = document.getElementById("incomeSource").value.trim();
    const amountStr = document.getElementById("incomeAmount").value;
    const currency = document.getElementById("incomeCurrency").value;
    const notes = document.getElementById("incomeNotes").value.trim();
  
    if (!date || !source || !amountStr) return;
  
    const amountFils = amountToFils(amountStr);
  
    const entry = {
      date,
      source,
      amountFils,
      currency,
      notes
    };
  
    monthData.income.push(entry);
  
    // Wallet balance is only KWD. If income is in KWD, add to wallet.
    if (currency === "KWD") {
      monthData.wallet += amountFils;
    }
  
    saveMonthData(currentMonthKey, monthData);
    renderAll();
    incomeForm.reset();
  });
  
  // Expense form
  expenseForm.addEventListener("submit", (e) => {
    e.preventDefault();
  
    const date = document.getElementById("expenseDate").value;
    const category = document.getElementById("expenseCategory").value.trim();
    const amountStr = document.getElementById("expenseAmount").value;
    const currency = document.getElementById("expenseCurrency").value;
    const method = document.getElementById("paymentMethod").value;
    const notes = document.getElementById("expenseNotes").value.trim();
  
    if (!date || !category || !amountStr) return;
  
    const amountFils = amountToFils(amountStr);
  
    const entry = {
      date,
      category,
      amountFils,
      currency,
      method,
      notes
    };
  
    monthData.expenses.push(entry);
  
    // Deduct from balances only if KWD
    if (currency === "KWD") {
      if (method === "wallet") {
        monthData.wallet -= amountFils;
      } else if (method === "bank") {
        monthData.savings -= amountFils;
      }
    }
  
    saveMonthData(currentMonthKey, monthData);
    renderAll();
    expenseForm.reset();
  });
  
  // Lending/Borrowing form
  lbForm.addEventListener("submit", (e) => {
    e.preventDefault();
  
    const date = document.getElementById("lbDate").value;
    const name = document.getElementById("lbName").value.trim();
    const amountStr = document.getElementById("lbAmount").value;
    const currency = document.getElementById("lbCurrency").value;
    const reason = document.getElementById("lbReason").value.trim();
    const type = document.getElementById("lbType").value;
    const status = document.getElementById("lbStatus").value;
  
    if (!date || !name || !amountStr) return;
  
    const amountFils = amountToFils(amountStr);
  
    const entry = {
      date,
      name,
      amountFils,
      currency,
      reason,
      type,
      status
    };
  
    monthData.lending.push(entry);
  
    saveMonthData(currentMonthKey, monthData);
    renderAll();
    lbForm.reset();
  });
  
  // === Edit / Delete (event delegation) ===
  
  function handleEdit(type, index) {
    let entry;
    if (type === "income") entry = monthData.income[index];
    else if (type === "expense") entry = monthData.expenses[index];
    else if (type === "lending") entry = monthData.lending[index];
  
    if (!entry) return;
  
    // For simplicity, use prompt dialogs; you can replace with inline editing UI later
    const newDate = prompt("Date (YYYY-MM-DD):", entry.date) || entry.date;
    let mainFieldLabel, mainFieldValue;
  
    if (type === "income") {
      mainFieldLabel = "Source";
      mainFieldValue = entry.source;
    } else if (type === "expense") {
      mainFieldLabel = "Category";
      mainFieldValue = entry.category;
    } else {
      mainFieldLabel = "Name";
      mainFieldValue = entry.name;
    }
  
    const newMainField = prompt(mainFieldLabel + ":", mainFieldValue) || mainFieldValue;
    const newAmountStr = prompt(
      "Amount (3 decimals allowed, e.g., 1.250):",
      filsToAmountString(entry.amountFils)
    );
    const newCurrency = prompt(
      "Currency (KWD / USD / GBP / EUR):",
      entry.currency
    ) || entry.currency;
    const newNotes = prompt("Notes:", entry.notes || "") || entry.notes;
    let extraFields = {};
  
    if (type === "expense") {
      const newMethod = prompt("Method (wallet/bank):", entry.method) || entry.method;
      extraFields.method = newMethod;
    } else if (type === "lending") {
      const newType = prompt("Type (lend/borrow):", entry.type) || entry.type;
      const newStatus = prompt("Status (pending/returned):", entry.status) || entry.status;
      extraFields.type = newType;
      extraFields.status = newStatus;
    }
  
    // Before changing balances, we need to revert the old impact for KWD
    if (type === "income" && entry.currency === "KWD") {
      monthData.wallet -= entry.amountFils;
    } else if (type === "expense" && entry.currency === "KWD") {
      if (entry.method === "wallet") monthData.wallet += entry.amountFils;
      else if (entry.method === "bank") monthData.savings += entry.amountFils;
    }
  
    const newAmountFils = newAmountStr ? amountToFils(newAmountStr) : entry.amountFils;
  
    // Update entry
    if (type === "income") {
      entry.date = newDate;
      entry.source = newMainField;
      entry.amountFils = newAmountFils;
      entry.currency = newCurrency;
      entry.notes = newNotes;
    } else if (type === "expense") {
      entry.date = newDate;
      entry.category = newMainField;
      entry.amountFils = newAmountFils;
      entry.currency = newCurrency;
      entry.notes = newNotes;
      entry.method = extraFields.method;
    } else if (type === "lending") {
      entry.date = newDate;
      entry.name = newMainField;
      entry.amountFils = newAmountFils;
      entry.currency = newCurrency;
      entry.reason = newNotes;
      entry.type = extraFields.type;
      entry.status = extraFields.status;
    }
  
    // Apply new impact for KWD entries
    if (type === "income" && entry.currency === "KWD") {
      monthData.wallet += entry.amountFils;
    } else if (type === "expense" && entry.currency === "KWD") {
      if (entry.method === "wallet") monthData.wallet -= entry.amountFils;
      else if (entry.method === "bank") monthData.savings -= entry.amountFils;
    }
  
    saveMonthData(currentMonthKey, monthData);
    renderAll();
  }
  
  function handleDelete(type, index) {
    if (!confirm("Delete this entry?")) return;
  
    let entry;
    if (type === "income") entry = monthData.income[index];
    else if (type === "expense") entry = monthData.expenses[index];
    else if (type === "lending") entry = monthData.lending[index];
  
    if (!entry) return;
  
    // Revert balances for KWD entries
    if (type === "income" && entry.currency === "KWD") {
      monthData.wallet -= entry.amountFils;
    } else if (type === "expense" && entry.currency === "KWD") {
      if (entry.method === "wallet") monthData.wallet += entry.amountFils;
      else if (entry.method === "bank") monthData.savings += entry.amountFils;
    }
  
    if (type === "income") monthData.income.splice(index, 1);
    else if (type === "expense") monthData.expenses.splice(index, 1);
    else if (type === "lending") monthData.lending.splice(index, 1);
  
    saveMonthData(currentMonthKey, monthData);
    renderAll();
  }
  
  // Attach to each table via event delegation
  [incomeTableBody, expenseTableBody, lbTableBody].forEach((tbody) => {
    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const type = btn.getAttribute("data-type");
      const index = Number(btn.getAttribute("data-index"));
      if (btn.classList.contains("edit")) {
        handleEdit(type, index);
      } else if (btn.classList.contains("delete")) {
        handleDelete(type, index);
      }
    });
  });
  
  // === Savings management ===
  
  walletToSavingsBtn.addEventListener("click", () => {
    const amountStr = prompt(
      "Amount to move from Wallet to Savings (KWD, 3 decimals, e.g., 5.000):"
    );
    if (!amountStr) return;
  
    const amountFils = amountToFils(amountStr);
    if (amountFils <= 0 || amountFils > monthData.wallet) {
      alert("Invalid amount (check wallet balance).");
      return;
    }
  
    monthData.wallet -= amountFils;
    monthData.savings += amountFils;
    saveMonthData(currentMonthKey, monthData);
    renderAll();
  });
  
  incomeToSavingsBtn.addEventListener("click", () => {
    const amountStr = prompt(
      "Amount to move from Income to Savings (KWD only, 3 decimals, e.g., 10.500):"
    );
    if (!amountStr) return;
  
    const amountFils = amountToFils(amountStr);
    if (amountFils <= 0) {
      alert("Invalid amount.");
      return;
    }
  
    // We don't adjust wallet here, just savings (you can customize)
    monthData.savings += amountFils;
    saveMonthData(currentMonthKey, monthData);
    renderAll();
  });
  
  // === Clear month ===
  clearMonthBtn.addEventListener("click", () => {
    if (!confirm("Clear ALL data for this month? This cannot be undone.")) return;
    localStorage.removeItem("budget-" + currentMonthKey);
    monthData = loadMonthData(currentMonthKey);
    renderAll();
  });
  
  // === PDF Export ===
  exportPdfBtn.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
  
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" }); // [web:3]
  
    let y = 40;
    doc.setFontSize(14);
    doc.text("Personal Budget Statement - " + monthKeyToLabel(currentMonthKey), 40, y);
    y += 20;
  
    // Dashboard summary
    doc.setFontSize(11);
    doc.text("Dashboard:", 40, y);
    y += 15;
  
    const { incomeTotals, expenseTotals } = calculateTotals();
    const savingsTotals = {};
    const currencies = new Set([
      ...Object.keys(incomeTotals),
      ...Object.keys(expenseTotals)
    ]);
    currencies.forEach((cur) => {
      const inc = incomeTotals[cur] || 0;
      const exp = expenseTotals[cur] || 0;
      savingsTotals[cur] = inc - exp;
    });
  
    doc.text("Total Income: " + (totalsToDisplayString(incomeTotals) || "-"), 50, y);
    y += 15;
    doc.text("Total Expenses: " + (totalsToDisplayString(expenseTotals) || "-"), 50, y);
    y += 15;
    doc.text("Total Savings: " + (totalsToDisplayString(savingsTotals) || "-"), 50, y);
    y += 15;
    doc.text("Wallet (KWD): " + filsToAmountString(monthData.wallet), 50, y);
    y += 15;
    doc.text("Savings (KWD): " + filsToAmountString(monthData.savings), 50, y);
    y += 20;
  
    // Income list
    doc.setFontSize(12);
    doc.text("Income:", 40, y);
    y += 15;
    doc.setFontSize(10);
    monthData.income.forEach((entry) => {
      const line =
        `${entry.date} | ${entry.source} | ` +
        `${filsToAmountString(entry.amountFils)} ${entry.currency} | ${entry.notes || "-"}`;
      doc.text(line, 50, y);
      y += 12;
      if (y > 780) {
        doc.addPage();
        y = 40;
      }
    });
    y += 10;
  
    // Expenses list
    doc.setFontSize(12);
    doc.text("Expenses:", 40, y);
    y += 15;
    doc.setFontSize(10);
    monthData.expenses.forEach((entry) => {
      const line =
        `${entry.date} | ${entry.category} | ` +
        `${filsToAmountString(entry.amountFils)} ${entry.currency} | ${entry.method} | ${entry.notes || "-"}`;
      doc.text(line, 50, y);
      y += 12;
      if (y > 780) {
        doc.addPage();
        y = 40;
      }
    });
    y += 10;
  
    // Lending & borrowing list
    doc.setFontSize(12);
    doc.text("Lending & Borrowing:", 40, y);
    y += 15;
    doc.setFontSize(10);
    monthData.lending.forEach((entry) => {
      const line =
        `${entry.date} | ${entry.name} | ${filsToAmountString(entry.amountFils)} ${entry.currency} | ` +
        `${entry.type} | ${entry.status} | ${entry.reason || "-"}`;
      doc.text(line, 50, y);
      y += 12;
      if (y > 780) {
        doc.addPage();
        y = 40;
      }
    });
  
    doc.save(`Budget_${currentMonthKey}.pdf`);
  });
  