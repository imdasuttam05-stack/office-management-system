import React, { useEffect, useRef, useState } from "react";
import AccountsMasterCatalog from "./AccountsMasterCatalog.jsx";

const API = (
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com"
).replace(/\/+$/, "");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  }`,
});

const today = () => new Date().toISOString().slice(0, 10);

const money = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const voucherTypes = [
  "Payment",
  "Receipt",
  "Contra",
  "Journal",
  "Sales",
  "Purchase",
  "Debit Note",
  "Credit Note",
];

const natures = ["Asset", "Liability", "Income", "Expense", "Capital"];

export default function Accounting({ initialTab = "groups" } = {}) {
  const [tab, setTab] = useState(initialTab);

  const [groups, setGroups] = useState([]);
  const [ledgers, setLedgers] = useState([]);
  const [vouchers, setVouchers] = useState([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [openBills, setOpenBills] = useState([]);
  const [billAllocations, setBillAllocations] = useState([]);
  const [loadingBills, setLoadingBills] = useState(false);

  const openVoucherCenter = () => { window.location.href = "/voucher"; };

  const groupNameRef = useRef(null);
  const ledgerNameRef = useRef(null);
  const voucherDateRef = useRef(null);

  const [group, setGroup] = useState({
    name: "",
    parent: "",
    nature: "Asset",
  });

  const [ledger, setLedger] = useState({
    name: "",
    group: "",
    openingBalance: "",
    openingType: "Dr",
    gstin: "",
    phone: "",
    address: "",
  });

  const [voucher, setVoucher] = useState({
    date: today(),
    type: "Payment",
    partyLedger: "",
    referenceNo: "",
    narration: "",
    lines: [
      { ledger: "", debit: "", credit: "", narration: "" },
      { ledger: "", debit: "", credit: "", narration: "" },
    ],
  });

  /* ======================================================
     LOAD DATA
  ====================================================== */

  async function loadAll() {
    try {
      setError("");

      const [g, l, v] = await Promise.all([
        fetch(`${API}/api/accounting/groups`, {
          headers: headers(),
        }),
        fetch(`${API}/api/accounting/ledgers`, {
          headers: headers(),
        }),
        fetch(`${API}/api/accounting/vouchers`, {
          headers: headers(),
        }),
      ]);

      const gd = await g.json();
      const ld = await l.json();
      const vd = await v.json();

      if (!g.ok) {
        throw new Error(gd.message || "Unable to load groups");
      }

      if (!l.ok) {
        throw new Error(ld.message || "Unable to load ledgers");
      }

      if (!v.ok) {
        throw new Error(vd.message || "Unable to load vouchers");
      }

      setGroups(gd.groups || []);
      setLedgers(ld.ledgers || []);
      setVouchers(vd.vouchers || []);
    } catch (err) {
      setError(err.message || "Unable to load accounting data");
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const allocationBillType = ["Receipt", "Credit Note"].includes(voucher.type)
    ? "SALE"
    : ["Payment", "Debit Note"].includes(voucher.type)
      ? "PURCHASE"
      : null;

  useEffect(() => {
    let cancelled = false;
    setOpenBills([]);
    setBillAllocations([]);
    if (!allocationBillType || !voucher.partyLedger) return undefined;
    setLoadingBills(true);
    fetch(`${API}/api/accounting/open-bills?type=${allocationBillType}&partyLedgerId=${encodeURIComponent(voucher.partyLedger)}`, { headers: headers() })
      .then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || "Unable to load outstanding bills");
        if (!cancelled) setOpenBills(data.bills || []);
      })
      .catch(err => { if (!cancelled) setError(err.message || "Unable to load outstanding bills"); })
      .finally(() => { if (!cancelled) setLoadingBills(false); });
    return () => { cancelled = true; };
  }, [allocationBillType, voucher.partyLedger]);

  function updateBillAllocation(index, field, value) {
    setBillAllocations(old => old.map((row, i) => {
      if (i !== index) return row;
      if (field === "invoiceId") {
        const bill = openBills.find(item => item._id === value);
        const voucherAmount = Math.max(Number(totalDebit || 0), Number(totalCredit || 0));
        return { invoiceType: allocationBillType, invoiceId: value, invoiceNo: bill?.invoiceNo || "", amount: bill ? String(Math.min(Number(bill.outstanding), voucherAmount || Number(bill.outstanding))) : "" };
      }
      return { ...row, [field]: value };
    }));
  }

  function addBillAllocation() {
    setBillAllocations(old => [...old, { invoiceType: allocationBillType, invoiceId: "", invoiceNo: "", amount: "" }]);
  }

  /* ======================================================
     KEYBOARD SHORTCUTS
  ====================================================== */

  useEffect(() => {
    const handleKeyboard = (e) => {
      // Ctrl + G = Groups
      if (e.ctrlKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        openTab("groups");
      }

      // Ctrl + L = Ledgers
      if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        openTab("ledgers");
      }

      // Ctrl + V = Voucher
      if (e.ctrlKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        openTab("voucher");
      }

      // F4 = Groups
      if (e.key === "F4") {
        e.preventDefault();
        openTab("groups");
      }

      // F5 = Ledgers
      if (e.key === "F5") {
        e.preventDefault();
        openTab("ledgers");
      }

      // F6 = Voucher
      if (e.key === "F6") {
        e.preventDefault();
        openTab("voucher");
      }

      // F8 = Voucher Center
      if (e.key === "F8") {
        e.preventDefault();
        openVoucherCenter();
      }

      // F7 = Register
      if (e.key === "F7") {
        e.preventDefault();
        openTab("register");
      }

      // Alt+C = Create
      if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();

        if (tab === "groups") {
          groupNameRef.current?.focus();
        }

        if (tab === "ledgers") {
          ledgerNameRef.current?.focus();
        }

        if (tab === "voucher") {
          voucherDateRef.current?.focus();
        }
      }

      // Escape
      if (e.key === "Escape") {
        setMessage("");
        setError("");
      }
    };

    window.addEventListener("keydown", handleKeyboard);

    return () => {
      window.removeEventListener("keydown", handleKeyboard);
    };
  }, [tab]);

  function openTab(nextTab) {
    setTab(nextTab);
    setMessage("");
    setError("");

    setTimeout(() => {
      if (nextTab === "groups") {
        groupNameRef.current?.focus();
      }

      if (nextTab === "ledgers") {
        ledgerNameRef.current?.focus();
      }

      if (nextTab === "voucher") {
        voucherDateRef.current?.focus();
      }
    }, 80);
  }

  /* ======================================================
     ENTER = NEXT FIELD
  ====================================================== */

  function handleEnter(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const target = e.target;
      if (target?.matches?.("[data-voucher-field]")) {
        const form = e.currentTarget;
        const fields = Array.from(form.querySelectorAll(`[data-voucher-field="${target.dataset.voucherField}"]:not([disabled])`)).filter(el => el.offsetParent !== null);
        const index = fields.indexOf(target);
        const next = fields[index + (e.key === "ArrowDown" ? 1 : -1)];
        if (next) { e.preventDefault(); next.focus(); if (next.select && next.tagName === "INPUT") next.select(); }
      }
      return;
    }
    if (e.key !== "Enter" || e.target.tagName === "TEXTAREA") return;
    if (e.target.tagName === "BUTTON") return;
    e.preventDefault();
    const form = e.currentTarget;
    const fields = Array.from(form.querySelectorAll("input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])"))
      .filter(el => el.offsetParent !== null && el.getAttribute("aria-hidden") !== "true");
    const currentIndex = fields.indexOf(e.target);
    const nextIndex = currentIndex + (e.shiftKey ? -1 : 1);
    if (currentIndex >= 0 && nextIndex >= 0 && nextIndex < fields.length) fields[nextIndex].focus();
    else if (!e.shiftKey) form.querySelector("button[type=submit], button:not([type])")?.focus();
  }

  /* ======================================================
     POST
  ====================================================== */

  async function post(url, body) {
    setSaving(true);

    try {
      const response = await fetch(`${API}${url}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Save failed");
      }

      return data;
    } finally {
      setSaving(false);
    }
  }

  /* ======================================================
     GROUP
  ====================================================== */

  async function saveGroup(e) {
    e.preventDefault();

    if (!group.name.trim()) {
      setError("Group name is required.");
      groupNameRef.current?.focus();
      return;
    }

    try {
      await post("/api/accounting/groups", {
        ...group,
        parent: group.parent || null,
      });

      setGroup({
        name: "",
        parent: "",
        nature: "Asset",
      });

      setMessage("Group created successfully.");

      await loadAll();

      setTimeout(() => {
        groupNameRef.current?.focus();
      }, 100);
    } catch (err) {
      setError(err.message);
    }
  }

  /* ======================================================
     LEDGER
  ====================================================== */

  async function saveLedger(e) {
    e.preventDefault();

    if (!ledger.name.trim()) {
      setError("Ledger name is required.");
      ledgerNameRef.current?.focus();
      return;
    }

    if (!ledger.group) {
      setError("Please select a Group.");
      return;
    }

    try {
      await post("/api/accounting/ledgers", ledger);

      setLedger({
        name: "",
        group: "",
        openingBalance: "",
        openingType: "Dr",
        gstin: "",
        phone: "",
        address: "",
      });

      setMessage("Ledger created successfully.");

      await loadAll();

      setTimeout(() => {
        ledgerNameRef.current?.focus();
      }, 100);
    } catch (err) {
      setError(err.message);
    }
  }

  /* ======================================================
     VOUCHER
  ====================================================== */

  function updateLine(index, field, value) {
    setVoucher((old) => ({
      ...old,
      lines: old.lines.map((line, i) =>
        i === index
          ? {
              ...line,
              [field]: value,
            }
          : line
      ),
    }));
  }

  function addLine() {
    setVoucher((old) => ({
      ...old,
      lines: [
        ...old.lines,
        {
          ledger: "",
          debit: "",
          credit: "",
          narration: "",
        },
      ],
    }));
  }

  function removeLine(index) {
    setVoucher((old) => {
      if (old.lines.length <= 2) return old;

      return {
        ...old,
        lines: old.lines.filter((_, i) => i !== index),
      };
    });
  }

  async function saveVoucher(e) {
    e.preventDefault();

    const lines = voucher.lines.filter(
      (line) =>
        line.ledger &&
        (Number(line.debit) > 0 ||
          Number(line.credit) > 0)
    );

    if (lines.length < 2) {
      setError("At least two ledger lines are required.");
      return;
    }

    const debit = lines.reduce(
      (sum, line) => sum + Number(line.debit || 0),
      0
    );

    const credit = lines.reduce(
      (sum, line) => sum + Number(line.credit || 0),
      0
    );

    if (Math.abs(debit - credit) > 0.005) {
      setError(
        `Voucher is not balanced. Difference ${money(
          Math.abs(debit - credit)
        )}`
      );
      return;
    }

    try {
      await post("/api/accounting/vouchers", {
        ...voucher,
        partyLedger: voucher.partyLedger || null,
        lines,
        billAllocations: billAllocations.filter(row => row.invoiceId && Number(row.amount) > 0).map(row => ({ invoiceType: allocationBillType, invoiceId: row.invoiceId, amount: Number(row.amount) })),
      });

      setVoucher({
        date: today(),
        type: "Payment",
        partyLedger: "",
        referenceNo: "",
        narration: "",
        lines: [
          {
            ledger: "",
            debit: "",
            credit: "",
            narration: "",
          },
          {
            ledger: "",
            debit: "",
            credit: "",
            narration: "",
          },
        ],
      });

      setBillAllocations([]);
      setMessage("Voucher saved successfully.");

      await loadAll();

      setTimeout(() => {
        voucherDateRef.current?.focus();
      }, 100);
    } catch (err) {
      setError(err.message);
    }
  }

  async function reverseVoucher(voucherId) {
    if (!window.confirm("Create a reversal voucher? The original voucher will remain in the register for audit.")) return;
    try {
      const response = await fetch(`${API}/api/accounting/vouchers/${voucherId}/reverse`, { method: "POST", headers: headers(), body: JSON.stringify({}) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to reverse voucher");
      setMessage(data.message || "Reversal voucher created.");
      await loadAll();
    } catch (err) { setError(err.message || "Unable to reverse voucher"); }
  }

  /* ======================================================
     CALCULATION
  ====================================================== */

  const totalDebit = voucher.lines.reduce(
    (sum, line) => sum + Number(line.debit || 0),
    0
  );

  const totalCredit = voucher.lines.reduce(
    (sum, line) => sum + Number(line.credit || 0),
    0
  );

  const difference = totalDebit - totalCredit;

  const groupSearch = groups.filter((item) =>
    `${item.name} ${
      item.parent?.name || ""
    } ${item.nature}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const ledgerSearch = ledgers.filter((item) =>
    `${item.name} ${
      item.group?.name || ""
    } ${item.gstin || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const voucherSearch = vouchers.filter((item) =>
    `${item.voucherNo || ""} ${
      item.type || ""
    } ${item.narration || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* ======================================================
     UI
  ====================================================== */

  return (
    <div className="accounts-page">
      <style>{`${styles}\n.top-tabs{display:none!important}`}</style>

      {/* ==================================================
          HEADER
      ================================================== */}

      <div className="accounts-header">
        <div className="title-area">
          <div className="account-logo">₹</div>

          <div>
            <div className="small-title">
              BUSINESS SOFTWARE
            </div>

            <h1>Accounts</h1>

            <p>
              Groups · Ledgers · Voucher Entry · Register
            </p>
          </div>
        </div>

        {/* TOP RIGHT TABS */}
        <div className="top-tabs">
          <button
            className={
              tab === "groups"
                ? "top-tab active"
                : "top-tab"
            }
            onClick={() => openTab("groups")}
          >
            <span>Groups</span>
            <kbd>F4</kbd>
          </button>

          <button
            className={
              tab === "ledgers"
                ? "top-tab active"
                : "top-tab"
            }
            onClick={() => openTab("ledgers")}
          >
            <span>Ledgers</span>
            <kbd>F5</kbd>
          </button>

          <button
            className={
              tab === "voucher"
                ? "top-tab active"
                : "top-tab"
            }
            onClick={() => openTab("voucher")}
          >
            <span>Voucher Entry</span>
            <kbd>F6</kbd>
          </button>

          <button
            className={
              tab === "register"
                ? "top-tab active"
                : "top-tab"
            }
            onClick={() => openTab("register")}
          >
            <span>Register</span>
            <kbd>F7</kbd>
          </button>
        </div>
      </div>

      {/* ==================================================
          KEYBOARD BAR
      ================================================== */}

      <div className="keyboard-bar">
        <span>
          <kbd>F4</kbd> Groups
        </span>

        <span>
          <kbd>F5</kbd> Ledgers
        </span>

        <span>
          <kbd>F6</kbd> Voucher
        </span>

        <span>
          <kbd>F7</kbd> Register
        </span>

        <span>
          <kbd>Alt+C</kbd> Create
        </span>

        <span>
          <kbd>Enter</kbd> Next
        </span>

        <span>
          <kbd>Esc</kbd> Clear
        </span>
      </div>

      {/* ==================================================
          MESSAGE
      ================================================== */}

      {(message || error) && (
        <div
          className={
            error
              ? "message error-message"
              : "message success-message"
          }
        >
          {error ? "⚠ " : "✓ "}
          {error || message}
        </div>
      )}

      {/* ==================================================
          GROUPS
      ================================================== */}

      {tab === "groups" && (
        <div className="main-layout">
          <form
            className="entry-panel"
            onSubmit={saveGroup}
            onKeyDown={handleEnter}
          >
            <div className="panel-title">
              <span>MASTER 01</span>
              <h2>Create Group</h2>
              <p>
                Create your accounting hierarchy.
              </p>
            </div>

            <label>
              Group Name <b>*</b>
            </label>

            <input
              ref={groupNameRef}
              autoFocus
              value={group.name}
              onChange={(e) =>
                setGroup({
                  ...group,
                  name: e.target.value,
                })
              }
              placeholder="Sundry Debtors"
            />

            <label>Under</label>

            <select
              value={group.parent}
              onChange={(e) =>
                setGroup({
                  ...group,
                  parent: e.target.value,
                })
              }
            >
              <option value="">
                Primary
              </option>

              {groups.map((item) => (
                <option
                  key={item._id}
                  value={item._id}
                >
                  {item.name}
                </option>
              ))}
            </select>

            <label>Nature</label>

            <select
              value={group.nature}
              onChange={(e) =>
                setGroup({
                  ...group,
                  nature: e.target.value,
                })
              }
            >
              {natures.map((item) => (
                <option key={item}>
                  {item}
                </option>
              ))}
            </select>

            <button
              className="save-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Group"}
              <kbd>Enter</kbd>
            </button>

            <div className="example-box">
              Example:
              <strong>
                Current Assets
              </strong>
              {" → "}
              <strong>
                Sundry Debtors
              </strong>
            </div>
          </form>

          <div className="list-panel">
            <div className="list-header">
              <div>
                <span>GROUP MASTER</span>
                <h2>Accounting Groups</h2>
              </div>

              <strong>
                {groups.length} Groups
              </strong>
            </div>

            <div className="search-box">
              🔎
              <input
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
                placeholder="Search group..."
              />
            </div>

            <div className="table">
              <div className="table-head">
                <span>GROUP NAME</span>
                <span>UNDER</span>
                <span>NATURE</span>
              </div>

              {groupSearch.map((item) => (
                <div
                  className="table-row"
                  key={item._id}
                >
                  <strong>
                    {item.name}
                  </strong>

                  <span>
                    {item.parent?.name ||
                      "Primary"}
                  </span>

                  <span>
                    <em className="nature">
                      {item.nature}
                    </em>
                  </span>
                </div>
              ))}

              {groupSearch.length === 0 && (
                <div className="empty">
                  No groups found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================
          LEDGERS
      ================================================== */}

      {tab === "ledgers" && (
        <AccountsMasterCatalog initialType="ledger" />
      )}

      {/* ==================================================
          VOUCHER
      ================================================== */}

      {tab === "voucher" && (
        <form
          className="voucher-panel"
          onSubmit={saveVoucher}
          onKeyDown={handleEnter}
        >
          <div className="voucher-header">
            <div>
              <span>
                TRANSACTION
              </span>

              <h2>Voucher Entry</h2>

              <p>
                Double-entry accounting
              </p>
            </div>

            <div
              className={
                Math.abs(difference) < 0.005
                  ? "balanced"
                  : "not-balanced"
              }
            >
              {Math.abs(difference) <
              0.005
                ? "✓ BALANCED"
                : `Difference ${money(
                    Math.abs(difference)
                  )}`}
            </div>
          </div>

          <div className="voucher-top">
            <div>
              <label>Date</label>

              <input
                ref={voucherDateRef}
                autoFocus
                type="date"
                value={voucher.date}
                onChange={(e) =>
                  setVoucher({
                    ...voucher,
                    date: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label>Voucher Type</label>

              <select
                value={voucher.type}
                onChange={(e) =>
                  setVoucher({
                    ...voucher,
                    type: e.target.value,
                  })
                }
              >
                {voucherTypes.map(
                  (type) => (
                    <option key={type}>
                      {type}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label>Reference No.</label>

              <input
                value={
                  voucher.referenceNo
                }
                onChange={(e) =>
                  setVoucher({
                    ...voucher,
                    referenceNo:
                      e.target.value,
                  })
                }
                placeholder="Optional"
              />
            </div>

            <div>
              <label>Party Ledger</label>

              <select
                value={
                  voucher.partyLedger
                }
                onChange={(e) =>
                  setVoucher({
                    ...voucher,
                    partyLedger:
                      e.target.value,
                  })
                }
              >
                <option value="">
                  Select Party
                </option>

                {ledgers.map((item) => (
                  <option
                    key={item._id}
                    value={item._id}
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {allocationBillType && (
            <section style={{ margin: "14px 0", padding: 14, border: "1px solid #d0d5dd", borderRadius: 10, background: "#f9fafb" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <strong>Bill-wise Adjustment</strong>
                  <div style={{ fontSize: 12, color: "#667085", marginTop: 4 }}>
                    {voucher.type} will be allocated against {allocationBillType === "SALE" ? "Sales Bills / Customer Invoices" : "Purchase Bills / Supplier Invoices"}. Allocation cannot exceed bill outstanding.
                  </div>
                </div>
                <button type="button" onClick={addBillAllocation} disabled={!voucher.partyLedger || loadingBills || openBills.length === 0} className="add-line">+ Allocate Bill</button>
              </div>
              {!voucher.partyLedger && <p style={{ color: "#b42318", marginBottom: 0 }}>Select a Party Ledger to load outstanding bills.</p>}
              {loadingBills && <p style={{ marginBottom: 0 }}>Loading outstanding bills…</p>}
              {!loadingBills && voucher.partyLedger && openBills.length === 0 && <p style={{ marginBottom: 0 }}>No open bills found for this party.</p>}
              {billAllocations.map((row, index) => (
                <div key={`${index}-${row.invoiceId}`} style={{ display: "grid", gridTemplateColumns: "minmax(180px,2fr) minmax(120px,1fr) auto", gap: 8, marginTop: 10, alignItems: "end" }}>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Bill
                    <select value={row.invoiceId} onChange={e => updateBillAllocation(index, "invoiceId", e.target.value)} style={{ minWidth: 0, padding: 9, border: "1px solid #d0d5dd", borderRadius: 6 }}>
                      <option value="">Select outstanding bill</option>
                      {openBills.map(bill => <option key={bill._id} value={bill._id}>{bill.invoiceNo} · {new Date(bill.date).toLocaleDateString("en-IN")} · Due ₹{Number(bill.outstanding).toFixed(2)}</option>)}
                    </select>
                  </label>
                  <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 700 }}>Allocated Amount
                    <input type="number" min="0.01" max={openBills.find(b => b._id === row.invoiceId)?.outstanding || undefined} step="0.01" value={row.amount} onChange={e => updateBillAllocation(index, "amount", e.target.value)} placeholder="0.00" style={{ padding: 9, border: "1px solid #d0d5dd", borderRadius: 6, width: "100%" }} />
                  </label>
                  <button type="button" className="delete-line" aria-label="Remove bill allocation" onClick={() => setBillAllocations(old => old.filter((_, i) => i !== index))}>×</button>
                </div>
              ))}
              {billAllocations.length > 0 && <div style={{ textAlign: "right", fontWeight: 700, marginTop: 10 }}>Allocated: {money(billAllocations.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))}</div>}
            </section>
          )}

          <div className="voucher-table-head">
            <span>#</span>
            <span>LEDGER</span>
            <span>DEBIT</span>
            <span>CREDIT</span>
            <span>NARRATION</span>
            <span></span>
          </div>

          <div className="voucher-lines">
            {voucher.lines.map(
              (line, index) => (
                <div
                  className="voucher-line"
                  key={index}
                >
                  <b>
                    {String(
                      index + 1
                    ).padStart(2, "0")}
                  </b>

                  <select
                    data-voucher-field="ledger"
                    value={
                      line.ledger
                    }
                    onChange={(e) =>
                      updateLine(
                        index,
                        "ledger",
                        e.target.value
                      )
                    }
                  >
                    <option value="">
                      Select Ledger
                    </option>

                    {ledgers.map(
                      (item) => (
                        <option
                          key={item._id}
                          value={
                            item._id
                          }
                        >
                          {item.name}
                        </option>
                      )
                    )}
                  </select>

                  <input
                    data-voucher-field="debit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      line.debit
                    }
                    onChange={(e) =>
                      updateLine(
                        index,
                        "debit",
                        e.target.value
                      )
                    }
                    placeholder="0.00"
                  />

                  <input
                    data-voucher-field="credit"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      line.credit
                    }
                    onChange={(e) =>
                      updateLine(
                        index,
                        "credit",
                        e.target.value
                      )
                    }
                    placeholder="0.00"
                  />

                  <input
                    data-voucher-field="line-narration"
                    value={
                      line.narration
                    }
                    onChange={(e) =>
                      updateLine(
                        index,
                        "narration",
                        e.target.value
                      )
                    }
                    placeholder="Narration"
                  />

                  <button
                    type="button"
                    className="delete-line"
                    onClick={() =>
                      removeLine(index)
                    }
                  >
                    ×
                  </button>
                </div>
              )
            )}
          </div>

          <div className="voucher-actions">
            <button
              type="button"
              className="add-line"
              onClick={addLine}
            >
              + Add Line
            </button>

            <div className="totals">
              <div>
                Debit
                <strong>
                  {money(totalDebit)}
                </strong>
              </div>

              <div>
                Credit
                <strong>
                  {money(totalCredit)}
                </strong>
              </div>
            </div>
          </div>

          <div className="voucher-bottom">
            <div>
              <label>
                Voucher Narration
              </label>

              <input
                value={
                  voucher.narration
                }
                onChange={(e) =>
                  setVoucher({
                    ...voucher,
                    narration:
                      e.target.value,
                  })
                }
                placeholder="Enter transaction narration"
              />
            </div>

            <button
              className="save-voucher"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : "Save Voucher"}
              <kbd>Enter</kbd>
            </button>
          </div>
        </form>
      )}

      {/* ==================================================
          REGISTER
      ================================================== */}

      {tab === "register" && (
        <div className="register-panel">
          <div className="list-header">
            <div>
              <span>
                TRANSACTION REGISTER
              </span>

              <h2>Voucher Register</h2>
            </div>

            <strong>
              {vouchers.length} Vouchers
            </strong>
          </div>

          <div className="search-box">
            🔎

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Search voucher..."
            />
          </div>

          <div className="table register-table">
            <div className="table-head">
              <span>VOUCHER NO.</span>
              <span>DATE</span>
              <span>TYPE</span>
              <span>DEBIT</span>
              <span>CREDIT</span>
              <span>NARRATION</span>
            </div>

            {voucherSearch.map(
              (item) => (
                <div
                  className="table-row"
                  key={item._id}
                >
                  <strong>
                    {item.voucherNo ||
                      "—"}
                  </strong>

                  <span>
                    {item.date
                      ? new Date(
                          item.date
                        ).toLocaleDateString(
                          "en-IN"
                        )
                      : "—"}
                  </span>

                  <span>
                    <em className="voucher-badge">
                      {item.type}
                    </em>
                  </span>

                  <span className="amount">
                    {money(
                      item.totalDebit
                    )}
                  </span>

                  <span className="amount">
                    {money(
                      item.totalCredit
                    )}
                  </span>

                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span>{item.narration || "—"}</span>
                    {!item.reversesVoucherId && !vouchers.some(v => String(v.reversesVoucherId || "") === String(item._id)) && (
                      <button type="button" onClick={() => reverseVoucher(item._id)} title="Create reversal voucher" style={{ border: "1px solid #fda29b", color: "#b42318", background: "#fff", borderRadius: 6, padding: "4px 7px", cursor: "pointer", whiteSpace: "nowrap" }}>Reverse</button>
                    )}
                  </span>
                </div>
              )
            )}

            {voucherSearch.length ===
              0 && (
              <div className="empty">
                No vouchers found.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ==========================================================
   STYLES
========================================================== */

const styles = `
* {
  box-sizing: border-box;
}

.accounts-page {
  min-height: 100vh;
  padding: 24px 28px 50px;
  background:
    radial-gradient(
      circle at top right,
      #e8f2ff 0,
      transparent 30%
    ),
    #f4f7fb;

  color: #14263d;

  font-family:
    Inter,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

/* HEADER */

.accounts-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 25px;

  margin-bottom: 12px;
}

.title-area {
  display: flex;
  align-items: center;
  gap: 14px;
}

.account-logo {
  width: 54px;
  height: 54px;

  display: grid;
  place-items: center;

  border-radius: 16px;

  background:
    linear-gradient(
      135deg,
      #0b3964,
      #1776bd
    );

  color: white;

  font-size: 28px;
  font-weight: 900;

  box-shadow:
    0 12px 28px
    rgba(12, 65, 110, .20);
}

.small-title {
  color: #718096;
  font-size: 10px;
  font-weight: 900;
  letter-spacing: .16em;
}

.title-area h1 {
  margin: 2px 0;

  font-size: 30px;
  letter-spacing: -.04em;
}

.title-area p {
  margin: 0;

  color: #728198;
  font-size: 13px;
}

/* TOP RIGHT TABS */

.top-tabs {
  display: flex;
  align-items: center;
  gap: 7px;

  padding: 7px;

  background: white;

  border: 1px solid #dce5ef;

  border-radius: 15px;

  box-shadow:
    0 7px 22px
    rgba(30, 55, 85, .07);
}

.top-tab {
  min-height: 42px;

  display: flex;
  align-items: center;
  gap: 8px;

  border: 0;
  border-radius: 10px;

  padding: 8px 13px;

  background: transparent;

  color: #52657b;

  font-weight: 800;
  font-size: 12px;

  cursor: pointer;

  transition: .15s ease;
}

.top-tab:hover {
  background: #edf4fb;
  color: #123f69;
}

.top-tab.active {
  color: white;

  background:
    linear-gradient(
      135deg,
      #103f69,
      #176ca8
    );

  box-shadow:
    0 7px 17px
    rgba(16, 63, 105, .22);
}

kbd {
  font-family: inherit;

  font-size: 10px;

  padding: 3px 6px;

  border-radius: 5px;

  background: #edf1f6;

  color: #536579;

  border: 1px solid #d5dee8;

  border-bottom-width: 2px;

  font-weight: 900;
}

.top-tab.active kbd {
  background: rgba(255,255,255,.15);
  border-color: rgba(255,255,255,.25);
  color: white;
}

/* KEYBOARD BAR */

.keyboard-bar {
  display: flex;
  justify-content: flex-end;
  gap: 14px;

  color: #7a899c;

  font-size: 10px;

  margin-bottom: 10px;
}

.keyboard-bar span {
  display: flex;
  align-items: center;
  gap: 4px;
}

/* MESSAGE */

.message {
  padding: 9px 13px;

  border-radius: 9px;

  margin-bottom: 12px;

  font-size: 12px;

  font-weight: 700;
}

.success-message {
  color: #126a45;
  background: #e8f7ef;
  border: 1px solid #bce8d0;
}

.error-message {
  color: #a51f1f;
  background: #fff0f0;
  border: 1px solid #f0c5c5;
}

/* MAIN */

.main-layout {
  display: grid;

  grid-template-columns:
    360px
    minmax(0, 1fr);

  gap: 18px;

  align-items: start;
}

/* ENTRY */

.entry-panel {
  background: white;

  border: 1px solid #e1e8f0;

  border-radius: 18px;

  padding: 22px;

  box-shadow:
    0 10px 30px
    rgba(30, 55, 85, .07);
}

.panel-title span,
.list-header span,
.voucher-header span {
  color: #8090a4;

  font-size: 10px;

  font-weight: 900;

  letter-spacing: .13em;
}

.panel-title h2,
.list-header h2,
.voucher-header h2 {
  margin: 4px 0;

  font-size: 21px;

  letter-spacing: -.025em;
}

.panel-title p,
.voucher-header p {
  margin: 0 0 18px;

  color: #7c899a;

  font-size: 12px;
}

.entry-panel label,
.voucher-panel label {
  display: block;

  margin: 12px 0 5px;

  color: #43566e;

  font-size: 11px;

  font-weight: 800;
}

.entry-panel label b {
  color: #d14343;
}

.entry-panel input,
.entry-panel select,
.entry-panel textarea,
.voucher-panel input,
.voucher-panel select {
  width: 100%;

  border: 1px solid #d5dee8;

  background: #fbfcfe;

  border-radius: 9px;

  padding: 10px 11px;

  outline: none;

  font-size: 13px;

  color: #1d3047;

  transition: .15s;
}

.entry-panel input:focus,
.entry-panel select:focus,
.entry-panel textarea:focus,
.voucher-panel input:focus,
.voucher-panel select:focus {
  border-color: #2474ae;

  background: white;

  box-shadow:
    0 0 0 3px
    rgba(36,116,174,.10);
}

.balance-row {
  display: grid;

  grid-template-columns: 1fr 75px;

  gap: 7px;
}

.save-button {
  width: 100%;

  margin-top: 16px;

  padding: 12px;

  border: 0;

  border-radius: 10px;

  background:
    linear-gradient(
      135deg,
      #0e426d,
      #1774b6
    );

  color: white;

  font-weight: 800;

  cursor: pointer;

  box-shadow:
    0 7px 18px
    rgba(16,63,105,.20);
}

.save-button:hover {
  transform: translateY(-1px);
}

.save-button kbd {
  margin-left: 8px;

  background: rgba(255,255,255,.14);

  color: white;

  border-color: rgba(255,255,255,.25);
}

.example-box {
  margin-top: 14px;

  padding: 10px;

  border-radius: 9px;

  background: #f4f8fc;

  color: #718096;

  font-size: 10px;
}

.example-box strong {
  color: #234b70;
}

/* LIST */

.list-panel,
.register-panel {
  min-width: 0;

  background: white;

  border: 1px solid #e1e8f0;

  border-radius: 18px;

  padding: 22px;

  box-shadow:
    0 10px 30px
    rgba(30,55,85,.07);
}

.list-header {
  display: flex;

  justify-content: space-between;

  align-items: center;

  gap: 15px;
}

.list-header > strong {
  color: #1767a1;

  background: #edf6fd;

  padding: 7px 10px;

  border-radius: 8px;

  font-size: 11px;
}

.search-box {
  display: flex;

  align-items: center;

  gap: 8px;

  margin: 15px 0;

  padding: 0 11px;

  border: 1px solid #dbe4ed;

  border-radius: 9px;

  background: #fbfcfe;
}

.search-box input {
  width: 100%;

  border: 0;

  outline: 0;

  padding: 10px 2px;

  background: transparent;

  font-size: 12px;
}

/* TABLE */

.table {
  overflow: hidden;

  border: 1px solid #e5ebf1;

  border-radius: 11px;
}

.table-head,
.table-row {
  display: grid;

  grid-template-columns:
    1.3fr
    1fr
    .7fr;

  gap: 12px;

  align-items: center;

  padding: 12px 14px;
}

.table-head {
  background: #f4f7fa;

  color: #75869b;

  font-size: 9px;

  font-weight: 900;

  letter-spacing: .08em;
}

.table-row {
  border-top: 1px solid #edf1f5;

  font-size: 12px;
}

.table-row:hover {
  background: #f8fbfe;
}

.table-row strong {
  color: #1a3858;
}

.table-row span {
  color: #66778c;
}

.nature {
  display: inline-block;

  padding: 4px 7px;

  border-radius: 6px;

  background: #edf5fc;

  color: #22628f;

  font-style: normal;

  font-size: 9px;

  font-weight: 800;
}

.amount {
  font-weight: 800;

  color: #1c527c !important;
}

.empty {
  text-align: center;

  padding: 35px;

  color: #98a5b4;

  font-size: 12px;
}

/* VOUCHER */

.voucher-panel {
  background: white;

  border: 1px solid #dfe7ef;

  border-radius: 18px;

  padding: 22px;

  box-shadow:
    0 10px 30px
    rgba(30,55,85,.07);
}

.voucher-header {
  display: flex;

  justify-content: space-between;

  align-items: center;

  gap: 20px;
}

.balanced,
.not-balanced {
  padding: 9px 13px;

  border-radius: 9px;

  font-size: 11px;

  font-weight: 900;
}

.balanced {
  color: #14724b;

  background: #e8f7ef;

  border: 1px solid #b9e5cc;
}

.not-balanced {
  color: #a52828;

  background: #fff0f0;

  border: 1px solid #efc5c5;
}

.voucher-top {
  display: grid;

  grid-template-columns:
    150px
    170px
    180px
    1fr;

  gap: 12px;

  margin-bottom: 18px;
}

.voucher-table-head,
.voucher-line {
  display: grid;

  grid-template-columns:
    34px
    minmax(190px,1.5fr)
    140px
    140px
    minmax(180px,1fr)
    35px;

  gap: 8px;

  align-items: center;
}

.voucher-table-head {
  padding: 9px 10px;

  background: #f2f6fa;

  color: #73849a;

  font-size: 9px;

  font-weight: 900;

  letter-spacing: .08em;

  border-radius: 8px 8px 0 0;
}

.voucher-line {
  padding: 7px 10px;

  border-bottom: 1px solid #edf1f5;
}

.voucher-line > b {
  color: #9aa8b7;

  font-size: 10px;
}

.voucher-line input,
.voucher-line select {
  padding: 9px;

  font-size: 12px;
}

.delete-line {
  width: 30px;

  height: 30px;

  border: 0;

  border-radius: 7px;

  background: #fff0f0;

  color: #b42318;

  cursor: pointer;

  font-size: 17px;
}

.voucher-actions {
  display: flex;

  justify-content: space-between;

  align-items: center;

  margin-top: 14px;
}

.add-line {
  border: 1px solid #cbd9e6;

  background: white;

  color: #1d5a88;

  padding: 9px 12px;

  border-radius: 8px;

  font-weight: 800;

  cursor: pointer;
}

.totals {
  display: flex;

  gap: 22px;

  font-size: 11px;

  color: #73849a;
}

.totals div {
  display: flex;

  gap: 7px;
}

.totals strong {
  color: #183c5e;
}

.voucher-bottom {
  display: grid;

  grid-template-columns: 1fr 170px;

  gap: 12px;

  align-items: end;

  margin-top: 14px;
}

.save-voucher {
  height: 42px;

  border: 0;

  border-radius: 9px;

  background:
    linear-gradient(
      135deg,
      #0d426d,
      #1975b7
    );

  color: white;

  font-weight: 900;

  cursor: pointer;
}

.save-voucher kbd {
  margin-left: 8px;

  background: rgba(255,255,255,.14);

  color: white;

  border-color: rgba(255,255,255,.25);
}

/* REGISTER */

.register-panel {
  width: 100%;
}

.register-table .table-head,
.register-table .table-row {
  grid-template-columns:
    1.1fr
    .8fr
    .8fr
    .9fr
    .9fr
    1.5fr;
}

.voucher-badge {
  display: inline-block;

  padding: 5px 8px;

  background: #edf5fc;

  color: #23618e;

  border-radius: 6px;

  font-style: normal;

  font-size: 9px;

  font-weight: 900;
}

/* RESPONSIVE */

@media (max-width: 1100px) {

  .accounts-header {
    flex-direction: column;
  }

  .top-tabs {
    width: 100%;

    overflow-x: auto;

    justify-content: flex-start;
  }

  .keyboard-bar {
    justify-content: flex-start;

    flex-wrap: wrap;
  }

  .main-layout {
    grid-template-columns: 1fr;
  }

  .voucher-top {
    grid-template-columns: 1fr 1fr;
  }

  .voucher-table-head,
  .voucher-line {
    grid-template-columns:
      30px
      1fr
      110px
      110px
      1fr
      30px;
  }
}

@media (max-width: 700px) {

  .accounts-page {
    padding: 14px;
  }

  .title-area h1 {
    font-size: 24px;
  }

  .top-tab {
    white-space: nowrap;
  }

  .voucher-top {
    grid-template-columns: 1fr;
  }

  .voucher-table-head {
    display: none;
  }

  .voucher-line {
    grid-template-columns: 30px 1fr 1fr;
  }

  .voucher-line input:nth-of-type(3),
  .voucher-line input:nth-of-type(4) {
    grid-column: span 1;
  }

  .voucher-line select,
  .voucher-line input {
    min-width: 0;
  }

  .voucher-bottom {
    grid-template-columns: 1fr;
  }

  .table {
    overflow-x: auto;
  }

  .table-head,
  .table-row {
    min-width: 600px;
  }
}
`;
