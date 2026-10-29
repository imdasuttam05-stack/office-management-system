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
  const [partyLedgerId, setPartyLedgerId] = useState("");
  const [partyLedgerType, setPartyLedgerType] = useState("ALL");
  const [partyLedgerFrom, setPartyLedgerFrom] = useState("");
  const [partyLedgerTo, setPartyLedgerTo] = useState("");
  const [partyLedgerRows, setPartyLedgerRows] = useState([]);
  const [partyLedgerMeta, setPartyLedgerMeta] = useState(null);
  const [partyLedgerLoading, setPartyLedgerLoading] = useState(false);

  const openVoucherCenter = () => { window.location.href = "/voucher"; };

  const groupNameRef = useRef(null);
  const ledgerNameRef = useRef(null);
  const voucherDateRef = useRef(null);
  const voucherTypeRef = useRef(null);
  const partyLedgerRef = useRef(null);

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

  async function loadPartyLedgerReport() {
    if (!partyLedgerId) {
      setError("Please select a party ledger.");
      return;
    }
    setPartyLedgerLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ partyLedgerId, type: partyLedgerType });
      if (partyLedgerFrom) params.set("from", partyLedgerFrom);
      if (partyLedgerTo) params.set("to", partyLedgerTo);
      const response = await fetch(`${API}/api/accounting/party-ledger?${params.toString()}`, { headers: headers() });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Unable to load party ledger.");
      setPartyLedgerRows(Array.isArray(data.entries) ? data.entries : []);
      setPartyLedgerMeta(data);
    } catch (err) {
      setPartyLedgerRows([]);
      setPartyLedgerMeta(null);
      setError(err.message || "Unable to load party ledger.");
    } finally {
      setPartyLedgerLoading(false);
    }
  }

  const partyLedgerOptions = ledgers.filter(item => /sundry debtors|sundry creditors/i.test(item.group?.name || ""));
  const availablePartyLedgers = partyLedgerOptions.length ? partyLedgerOptions : ledgers;

  async function loadAll() {
    setError("");
    const request = async (path, key, setter, fallbackMessage) => {
      try {
        const response = await fetch(`${API}${path}`, { headers: headers() });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || fallbackMessage);
        setter(Array.isArray(data[key]) ? data[key] : []);
      } catch (err) {
        setError((current) => current ? `${current} · ${err.message || fallbackMessage}` : (err.message || fallbackMessage));
      }
    };

    // Render each dataset as soon as its own request finishes instead of
    // making Groups wait for the slowest of Groups, Ledgers and Vouchers.
    await Promise.all([
      request("/api/accounting/groups", "groups", setGroups, "Unable to load groups"),
      request("/api/accounting/ledgers", "ledgers", setLedgers, "Unable to load ledgers"),
      request("/api/accounting/vouchers", "vouchers", setVouchers, "Unable to load vouchers"),
    ]);
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
     Tally-style voucher keys are active only inside Voucher Entry.
  ====================================================== */

  useEffect(() => {
    const handleKeyboard = (e) => {
      const key = e.key;
      const lowerKey = key.toLowerCase();

      // Inside Voucher Entry, use Tally-style function keys.
      if (tab === "voucher") {
        const voucherKeyMap = {
          F4: "Contra",
          F5: "Payment",
          F6: "Receipt",
          F7: "Journal",
          F8: "Sales",
          F9: "Purchase",
        };
        if (voucherKeyMap[key]) {
          e.preventDefault();
          setVoucher((old) => ({ ...old, type: voucherKeyMap[key] }));
          setMessage("");
          setError("");
          return;
        }
        if (key === "F2") {
          e.preventDefault();
          voucherDateRef.current?.focus();
          return;
        }
        if (key === "F10") {
          e.preventDefault();
          voucherTypeRef.current?.focus();
          return;
        }
        if (key === "F11") {
          e.preventDefault();
          openTab("register");
          return;
        }
      } else {
        // Master/register navigation shortcuts outside Voucher Entry.
        if (key === "F4") { e.preventDefault(); openTab("groups"); }
        if (key === "F5") { e.preventDefault(); openTab("ledgers"); }
        if (key === "F6") { e.preventDefault(); openTab("voucher"); }
        if (key === "F7") { e.preventDefault(); openTab("register"); }
        if (key === "F8") { e.preventDefault(); openVoucherCenter(); }
      }

      if (e.ctrlKey && lowerKey === "g") {
        e.preventDefault();
        openTab("groups");
      }
      if (e.ctrlKey && lowerKey === "l") {
        e.preventDefault();
        openTab("ledgers");
      }
      if (e.ctrlKey && lowerKey === "v") {
        e.preventDefault();
        openTab("voucher");
      }

      if (e.altKey && lowerKey === "c") {
        e.preventDefault();
        if (tab === "groups") groupNameRef.current?.focus();
        if (tab === "ledgers") ledgerNameRef.current?.focus();
        if (tab === "voucher") partyLedgerRef.current?.focus();
      }

      if (key === "Escape") {
        setMessage("");
        setError("");
      }
    };

    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
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
     KEYBOARD-FIRST VOUCHER NAVIGATION
     Enter/Shift+Enter move through fields. Up/Down moves within amount columns;
     selects keep native Up/Down so ledger/type options remain selectable.
  ====================================================== */

  function handleEnter(e) {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.requestSubmit();
      return;
    }

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const target = e.target;
      const column = target?.dataset?.voucherColumn;
      // Keep native select behaviour: Up/Down chooses a ledger/type option.
      if (column && target.tagName !== "SELECT") {
        const form = e.currentTarget;
        const fields = Array.from(
          form.querySelectorAll(`[data-voucher-column="${column}"]:not([disabled])`)
        ).filter((el) => el.offsetParent !== null);
        const index = fields.indexOf(target);
        const next = fields[index + (e.key === "ArrowDown" ? 1 : -1)];
        if (next) {
          e.preventDefault();
          next.focus();
          if (typeof next.select === "function") next.select();
        }
      }
      return;
    }

    if (e.key !== "Enter" || e.target.tagName === "TEXTAREA" || e.target.tagName === "BUTTON") return;
    e.preventDefault();
    const form = e.currentTarget;
    const fields = Array.from(
      form.querySelectorAll("input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])")
    ).filter((el) => el.offsetParent !== null && el.getAttribute("aria-hidden") !== "true");
    const currentIndex = fields.indexOf(e.target);
    const nextIndex = currentIndex + (e.shiftKey ? -1 : 1);
    if (currentIndex >= 0 && nextIndex >= 0 && nextIndex < fields.length) {
      fields[nextIndex].focus();
      if (fields[nextIndex].tagName === "INPUT" && fields[nextIndex].type !== "date") fields[nextIndex].select?.();
    } else if (!e.shiftKey) {
      form.querySelector("button[type=submit], button:not([type])")?.focus();
    }
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
      <style>{`${styles}\n.top-tabs{display:flex!important}`}</style>

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
              Groups · Ledgers · Voucher Entry · Register · Party Ledger
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

          <button
            className={tab === "party-ledger" ? "top-tab active" : "top-tab"}
            onClick={() => openTab("party-ledger")}
          >
            <span>Party Ledger</span>
          </button>
        </div>
      </div>

      {/* ==================================================
          KEYBOARD BAR
      ================================================== */}

      <div className="keyboard-bar">
        {tab === "voucher" ? (
          <>
            <span><kbd>F2</kbd> Date</span>
            <span><kbd>F4</kbd> Contra</span>
            <span><kbd>F5</kbd> Payment</span>
            <span><kbd>F6</kbd> Receipt</span>
            <span><kbd>F7</kbd> Journal</span>
            <span><kbd>F8</kbd> Sales</span>
            <span><kbd>F9</kbd> Purchase</span>
            <span><kbd>F10</kbd> Other Vouchers</span>
          </>
        ) : (
          <>
            <span><kbd>F4</kbd> Groups</span>
            <span><kbd>F5</kbd> Ledgers</span>
            <span><kbd>F6</kbd> Voucher</span>
            <span><kbd>F7</kbd> Register</span>
            <span><kbd>Alt+C</kbd> Create</span>
            <span><kbd>Enter</kbd> Next</span>
            <span><kbd>Esc</kbd> Clear</span>
          </>
        )}
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
          className="voucher-panel tally-voucher-panel"
          onSubmit={saveVoucher}
          onKeyDown={handleEnter}
        >
          <div className="tally-voucher-main">
            <div className="tally-voucher-titlebar">
              <div>
                <span className="tally-kicker">BUSINESS SOFTWARE · TRANSACTION</span>
                <h2>Voucher Entry</h2>
                <p>Keyboard-first double-entry accounting</p>
              </div>
              <div className="tally-title-status">
                <div className="tally-voucher-date-label">{voucher.date ? new Date(`${voucher.date}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "Select date"}</div>
                <div className={totalDebit + totalCredit > 0 && Math.abs(difference) < 0.005 ? "balanced" : "not-balanced"}>
                  {totalDebit + totalCredit === 0 ? "ENTER AMOUNTS" : Math.abs(difference) < 0.005 ? "✓ BALANCED" : `DIFFERENCE ${money(Math.abs(difference))}`}
                </div>
              </div>
            </div>

            <div className="tally-voucher-meta">
              <label className="tally-field">
                <span>Date <kbd>F2</kbd></span>
                <input
                  ref={voucherDateRef}
                  autoFocus
                  data-voucher-meta="date"
                  type="date"
                  value={voucher.date}
                  onChange={(e) => setVoucher({ ...voucher, date: e.target.value })}
                />
              </label>
              <label className="tally-field">
                <span>Voucher Type <kbd>F10</kbd></span>
                <select
                  ref={voucherTypeRef}
                  value={voucher.type}
                  onChange={(e) => setVoucher({ ...voucher, type: e.target.value })}
                >
                  {voucherTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="tally-field">
                <span>Reference / Voucher Ref.</span>
                <input value={voucher.referenceNo} onChange={(e) => setVoucher({ ...voucher, referenceNo: e.target.value })} placeholder="Enter reference number" />
              </label>
            </div>

            <div className="tally-party-band">
              <label className="tally-field tally-party-field">
                <span>Party A/c Name</span>
                <select
                  ref={partyLedgerRef}
                  value={voucher.partyLedger}
                  onChange={(e) => setVoucher({ ...voucher, partyLedger: e.target.value })}
                >
                  <option value="">Select Party Ledger</option>
                  {ledgers.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                </select>
              </label>
              <div className="tally-current-type">
                <span>VOUCHER TYPE</span>
                <strong>{voucher.type.toUpperCase()}</strong>
              </div>
            </div>

            {allocationBillType && (
              <section className="tally-billwise">
                <div className="tally-billwise-header">
                  <div>
                    <strong>Bill-wise Adjustment</strong>
                    <p>{voucher.type} against {allocationBillType === "SALE" ? "Sales Bills / Customer Invoices" : "Purchase Bills / Supplier Invoices"}</p>
                  </div>
                  <button type="button" onClick={addBillAllocation} disabled={!voucher.partyLedger || loadingBills || openBills.length === 0} className="add-line">+ Allocate Bill</button>
                </div>
                {!voucher.partyLedger && <p className="tally-inline-note">Select a Party Ledger to load outstanding bills.</p>}
                {loadingBills && <p className="tally-inline-note">Loading outstanding bills…</p>}
                {!loadingBills && voucher.partyLedger && openBills.length === 0 && <p className="tally-inline-note">No open bills found for this party.</p>}
                {billAllocations.map((row, index) => (
                  <div className="tally-allocation-row" key={`${index}-${row.invoiceId}`}>
                    <label className="tally-field">
                      <span>Against Bill</span>
                      <select value={row.invoiceId} onChange={(e) => updateBillAllocation(index, "invoiceId", e.target.value)}>
                        <option value="">Select outstanding bill</option>
                        {openBills.map((bill) => <option key={bill._id} value={bill._id}>{bill.invoiceNo} · {new Date(bill.date).toLocaleDateString("en-IN")} · Due {money(bill.outstanding)}</option>)}
                      </select>
                    </label>
                    <label className="tally-field">
                      <span>Allocated Amount (₹)</span>
                      <input type="number" min="0.01" max={openBills.find((bill) => bill._id === row.invoiceId)?.outstanding || undefined} step="0.01" value={row.amount} onChange={(e) => updateBillAllocation(index, "amount", e.target.value)} placeholder="0.00" />
                    </label>
                    <button type="button" className="delete-line" aria-label="Remove bill allocation" onClick={() => setBillAllocations((old) => old.filter((_, i) => i !== index))}>×</button>
                  </div>
                ))}
                {billAllocations.length > 0 && <div className="tally-allocation-total">Allocated: {money(billAllocations.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))}</div>}
              </section>
            )}

            <div className="tally-ledger-grid">
              <div className="tally-ledger-head">
                <span>No.</span><span>Particulars / Ledger</span><span>Debit (₹)</span><span>Credit (₹)</span><span>Narration</span><span></span>
              </div>
              <div className="voucher-lines tally-voucher-lines">
                {voucher.lines.map((line, index) => (
                  <div className="voucher-line tally-voucher-line" key={index}>
                    <b>{String(index + 1).padStart(2, "0")}</b>
                    <select value={line.ledger} onChange={(e) => updateLine(index, "ledger", e.target.value)} aria-label={`Ledger line ${index + 1}`}>
                      <option value="">Select Ledger</option>
                      {ledgers.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}
                    </select>
                    <input data-voucher-column="debit" type="number" min="0" step="0.01" value={line.debit} onChange={(e) => updateLine(index, "debit", e.target.value)} placeholder="0.00" aria-label={`Debit line ${index + 1}`} />
                    <input data-voucher-column="credit" type="number" min="0" step="0.01" value={line.credit} onChange={(e) => updateLine(index, "credit", e.target.value)} placeholder="0.00" aria-label={`Credit line ${index + 1}`} />
                    <input value={line.narration} onChange={(e) => updateLine(index, "narration", e.target.value)} placeholder="Line narration" aria-label={`Narration line ${index + 1}`} />
                    <button type="button" className="delete-line" aria-label={`Remove ledger line ${index + 1}`} onClick={() => removeLine(index)}>×</button>
                  </div>
                ))}
              </div>
              <div className="tally-ledger-foot">
                <span></span><strong>Total</strong><strong>{money(totalDebit)}</strong><strong>{money(totalCredit)}</strong><span></span><span></span>
              </div>
            </div>

            <div className="tally-voucher-actions">
              <button type="button" className="add-line" onClick={addLine}>+ Add Line</button>
              <div className="tally-difference">
                <span>Difference</span><strong className={Math.abs(difference) < 0.005 ? "tally-zero-difference" : "tally-has-difference"}>{money(Math.abs(difference))}</strong>
              </div>
            </div>

            <div className="tally-voucher-footer">
              <label className="tally-field tally-narration-field">
                <span>Voucher Narration</span>
                <input value={voucher.narration} onChange={(e) => setVoucher({ ...voucher, narration: e.target.value })} placeholder="Being ..." />
              </label>
              <button type="submit" className="save-voucher" disabled={saving || totalDebit <= 0 || Math.abs(difference) > 0.005}>
                {saving ? "Saving…" : "Save Voucher"}<kbd>Ctrl+Enter</kbd>
              </button>
            </div>
            <div className="tally-keyboard-hint">Enter: next field · Shift+Enter: previous field · ↑/↓: move between amount rows · Esc: clear notices</div>
          </div>

          <aside className="tally-function-panel" aria-label="Voucher function keys">
            <div className="tally-function-title">Voucher Keys</div>
            <button type="button" onClick={() => voucherDateRef.current?.focus()}><kbd>F2</kbd><span>Date</span></button>
            <div className="tally-function-divider" />
            {[
              ["F4", "Contra", "Contra"],
              ["F5", "Payment", "Payment"],
              ["F6", "Receipt", "Receipt"],
              ["F7", "Journal", "Journal"],
              ["F8", "Sales", "Sales"],
              ["F9", "Purchase", "Purchase"],
            ].map(([key, label, type]) => (
              <button type="button" key={key} className={voucher.type === type ? "active" : ""} onClick={() => { setVoucher((old) => ({ ...old, type })); setMessage(""); setError(""); }}>
                <kbd>{key}</kbd><span>{label}</span>
              </button>
            ))}
            <button type="button" onClick={() => voucherTypeRef.current?.focus()}><kbd>F10</kbd><span>Other Vouchers</span></button>
            <div className="tally-function-divider" />
            <button type="button" onClick={() => openTab("register")}><kbd>F11</kbd><span>Register</span></button>
            <button type="button" onClick={() => { setMessage(""); setError(""); }}><kbd>Esc</kbd><span>Clear Notice</span></button>
          </aside>
        </form>
      )}

      {/* ==================================================
          REGISTER
      ================================================== */}

      {tab === "party-ledger" && (
        <div className="register-panel party-ledger-panel">
          <div className="list-header">
            <div><span>PARTY ACCOUNT STATEMENT</span><h2>Party-wise Sales & Purchase Ledger</h2><p>View invoices, purchase bills, receipts, payments and running balance.</p></div>
          </div>
          <div className="party-ledger-filters">
            <label>Party / Ledger
              <select value={partyLedgerId} onChange={e => setPartyLedgerId(e.target.value)}>
                <option value="">Select Party Ledger</option>
                {availablePartyLedgers.map(item => <option key={item._id} value={item._id}>{item.name}{item.group?.name ? ` · ${item.group.name}` : ""}</option>)}
              </select>
            </label>
            <label>Ledger Type
              <select value={partyLedgerType} onChange={e => setPartyLedgerType(e.target.value)}>
                <option value="ALL">Sales + Purchase + Payments</option>
                <option value="SALE">Sales / Debtors</option>
                <option value="PURCHASE">Purchase / Creditors</option>
              </select>
            </label>
            <label>From Date<input type="date" value={partyLedgerFrom} onChange={e => setPartyLedgerFrom(e.target.value)} /></label>
            <label>To Date<input type="date" value={partyLedgerTo} onChange={e => setPartyLedgerTo(e.target.value)} /></label>
            <button type="button" className="primary-button" onClick={loadPartyLedgerReport} disabled={partyLedgerLoading || !partyLedgerId}>{partyLedgerLoading ? "Loading…" : "Show Ledger"}</button>
          </div>
          {partyLedgerMeta && <div className="party-ledger-summary">
            <div><span>Party</span><strong>{partyLedgerMeta.ledger?.name || "—"}</strong></div>
            <div><span>Total Debit</span><strong>{money(partyLedgerMeta.totals?.debit)}</strong></div>
            <div><span>Total Credit</span><strong>{money(partyLedgerMeta.totals?.credit)}</strong></div>
            <div><span>Closing Balance</span><strong>{money(Math.abs(Number(partyLedgerMeta.closingBalance || 0)))} {partyLedgerMeta.closingType || "Dr"}</strong></div>
          </div>}
          <div className="table register-table party-ledger-table">
            <div className="table-head"><span>DATE</span><span>VOUCHER NO.</span><span>TYPE</span><span>REFERENCE</span><span>NARRATION</span><span>DEBIT</span><span>CREDIT</span><span>BALANCE</span></div>
            {partyLedgerRows.map((item, index) => <div className="table-row" key={`${item.sourceType}-${item.voucherNo}-${index}`}>
              <span>{item.date ? new Date(item.date).toLocaleDateString("en-IN") : "—"}</span>
              <strong>{item.voucherNo || "—"}</strong>
              <span>{item.type || "—"}</span>
              <span>{item.referenceNo || "—"}</span>
              <span>{item.narration || "—"}</span>
              <span>{Number(item.debit || 0) ? money(item.debit) : "—"}</span>
              <span>{Number(item.credit || 0) ? money(item.credit) : "—"}</span>
              <strong>{money(Math.abs(Number(item.balance || 0)))} {item.balanceType || "Dr"}</strong>
            </div>)}
            {partyLedgerMeta && partyLedgerRows.length === 0 && <div className="table-row"><span>No transactions found for the selected party and date range.</span></div>}
          </div>
        </div>
      )}

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

/* TALLY-STYLE VOUCHER ENTRY: visual/navigation layer only; API and posting logic stay unchanged */
.tally-voucher-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 176px;
  gap: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid #a8bacb;
  border-radius: 4px;
  background: #fff7fc;
  box-shadow: 0 8px 24px rgba(25, 54, 82, .08);
  color: #101820;
}
.tally-voucher-main { min-width: 0; padding: 0 0 14px; }
.tally-voucher-titlebar {
  min-height: 70px; padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; gap: 16px;
  color: #fff; background: #1766a5; border-bottom: 3px solid #9ccce8;
}
.tally-voucher-titlebar .tally-kicker { display: block; color: #d5eafa; font-size: 9px; font-weight: 900; letter-spacing: .12em; }
.tally-voucher-titlebar h2 { margin: 4px 0 1px; font-size: 22px; line-height: 1.1; letter-spacing: 0; color: white; }
.tally-voucher-titlebar p { margin: 0; color: #e6f4ff; font-size: 11px; }
.tally-title-status { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
.tally-title-status .balanced, .tally-title-status .not-balanced { padding: 5px 8px; border-radius: 3px; font-size: 9px; white-space: nowrap; }
.tally-voucher-date-label { font-size: 12px; font-weight: 800; color: #fff; }
.tally-voucher-meta { display: grid; grid-template-columns: minmax(135px, .8fr) minmax(150px, 1fr) minmax(180px, 1.2fr); gap: 12px; padding: 12px 14px 10px; border-bottom: 1px solid #d9cbd5; }
.tally-field { min-width: 0; display: flex !important; flex-direction: column; gap: 5px; margin: 0 !important; color: #233a4a !important; font-size: 11px !important; font-weight: 800 !important; }
.tally-field > span { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.tally-field > span kbd { padding: 1px 4px; font-size: 9px; }
.tally-voucher-panel .tally-field input, .tally-voucher-panel .tally-field select {
  min-width: 0; height: 34px; padding: 6px 8px; border: 1px solid #aebdca; border-radius: 2px; background: #fffefa; color: #111827; font-size: 12px; box-shadow: none;
}
.tally-voucher-panel .tally-field input:focus, .tally-voucher-panel .tally-field select:focus { border-color: #1766a5; outline: 2px solid rgba(23, 102, 165, .2); box-shadow: none; }
.tally-party-band { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: end; gap: 18px; padding: 10px 14px; border-bottom: 1px solid #d9cbd5; background: #fffafd; }
.tally-party-field select { font-weight: 800 !important; }
.tally-current-type { display: flex; flex-direction: column; gap: 4px; align-items: flex-end; padding: 0 2px 7px 8px; }
.tally-current-type span { font-size: 9px; color: #68798a; font-weight: 900; letter-spacing: .08em; }
.tally-current-type strong { font-size: 12px; color: #175f99; }
.tally-billwise { margin: 12px 14px; padding: 10px; border: 1px solid #c9d6df; background: #f7fbfe; border-radius: 3px; }
.tally-billwise-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.tally-billwise-header strong { color: #174e78; font-size: 12px; }
.tally-billwise-header p { margin: 3px 0 0; color: #657786; font-size: 10px; }
.tally-inline-note { margin: 8px 0 0; color: #7b5565; font-size: 11px; }
.tally-allocation-row { display: grid; grid-template-columns: minmax(180px, 1.5fr) minmax(130px, .8fr) 30px; align-items: end; gap: 8px; margin-top: 8px; }
.tally-allocation-total { text-align: right; font-size: 11px; font-weight: 900; margin-top: 8px; color: #154f7f; }
.tally-ledger-grid { margin: 10px 14px 0; border: 1px solid #c8d2db; background: #fffafd; }
.tally-ledger-head, .tally-voucher-line, .tally-ledger-foot { display: grid; grid-template-columns: 38px minmax(160px, 1.55fr) minmax(105px, .8fr) minmax(105px, .8fr) minmax(130px, 1fr) 30px; gap: 6px; align-items: center; }
.tally-ledger-head { min-height: 32px; padding: 5px 8px; background: #dceefa; color: #123e60; font-size: 10px; font-weight: 900; border-bottom: 1px solid #b3c8d8; }
.tally-voucher-lines { background: #fff7fc; }
.tally-voucher-line { padding: 5px 8px; min-height: 43px; border-bottom: 1px solid #efe3eb; }
.tally-voucher-line:last-child { border-bottom: 1px solid #c8d2db; }
.tally-voucher-line > b { padding-left: 4px; font-size: 10px; color: #536b7e; }
.tally-voucher-panel .tally-voucher-line input, .tally-voucher-panel .tally-voucher-line select { height: 32px; min-width: 0; padding: 5px 7px; border: 1px solid #d0d5da; border-radius: 2px; background: #fffefa; color: #111827; font-size: 11px; }
.tally-voucher-panel .tally-voucher-line input[type="number"] { text-align: right; font-variant-numeric: tabular-nums; }
.tally-ledger-foot { min-height: 36px; padding: 5px 8px; background: #edf6fc; color: #143f60; font-size: 11px; }
.tally-ledger-foot strong:nth-child(3), .tally-ledger-foot strong:nth-child(4) { text-align: right; font-variant-numeric: tabular-nums; }
.tally-voucher-actions { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 10px 14px 0; }
.tally-difference { display: flex; align-items: center; gap: 10px; font-size: 11px; color: #526779; font-weight: 800; }
.tally-zero-difference { color: #137044; }
.tally-has-difference { color: #b42318; }
.tally-voucher-footer { display: grid; grid-template-columns: minmax(0,1fr) 185px; gap: 12px; align-items: end; margin: 12px 14px 0; padding-top: 10px; border-top: 1px solid #d9cbd5; }
.tally-narration-field input { width: 100%; }
.tally-voucher-panel .save-voucher { height: 37px; border-radius: 3px; background: #1766a5; font-size: 12px; }
.tally-voucher-panel .save-voucher:disabled { opacity: .55; cursor: not-allowed; }
.tally-voucher-panel .save-voucher kbd { margin-left: 6px; padding: 2px 4px; font-size: 9px; }
.tally-keyboard-hint { padding: 8px 14px 0; font-size: 9px; color: #6c7e8c; }
.tally-function-panel { min-width: 0; padding: 0 7px 10px; border-left: 1px solid #b9ccd8; background: #deeff8; display: flex; flex-direction: column; align-items: stretch; gap: 3px; }
.tally-function-title { margin: 0 -7px 5px; padding: 11px 9px; background: #c1e0f0; border-bottom: 1px solid #9abfd5; color: #164769; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: .06em; }
.tally-function-panel button { display: flex; align-items: center; gap: 7px; width: 100%; min-height: 32px; border: 0; border-bottom: 1px solid #b5d2e1; border-radius: 0; padding: 5px 3px; text-align: left; background: transparent; color: #173e59; font-size: 11px; cursor: pointer; }
.tally-function-panel button:hover, .tally-function-panel button.active { background: #b8ddef; color: #0b3552; }
.tally-function-panel button kbd { flex: 0 0 auto; min-width: 29px; text-align: center; background: #f6fbfe; border: 1px solid #98bacd; border-bottom-width: 2px; border-radius: 2px; padding: 3px 4px; color: #1c5e8a; font-size: 9px; }
.tally-function-panel button span { min-width: 0; }
.tally-function-divider { height: 6px; }
@media (max-width: 1100px) {
  .tally-voucher-panel { grid-template-columns: minmax(0, 1fr) 150px; }
  .tally-ledger-head, .tally-voucher-line, .tally-ledger-foot { grid-template-columns: 28px minmax(120px, 1.4fr) minmax(82px, .7fr) minmax(82px, .7fr) minmax(100px, 1fr) 26px; gap: 4px; }
}
@media (max-width: 760px) {
  .tally-voucher-panel { grid-template-columns: minmax(0,1fr); }
  .tally-function-panel { border-left: 0; border-top: 1px solid #b9ccd8; display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); padding: 8px; }
  .tally-function-title { grid-column: 1 / -1; margin: -8px -8px 4px; }
  .tally-function-divider { display: none; }
  .tally-voucher-meta { grid-template-columns: 1fr 1fr; }
  .tally-voucher-meta .tally-field:last-child { grid-column: 1 / -1; }
  .tally-party-band { grid-template-columns: minmax(0,1fr); }
  .tally-current-type { align-items: flex-start; padding: 0; }
  .tally-ledger-grid { overflow-x: auto; }
  .tally-ledger-head, .tally-voucher-line, .tally-ledger-foot { min-width: 740px; }
  .tally-voucher-footer { grid-template-columns: minmax(0,1fr); }
}

.party-ledger-panel { min-width: 0; }
.party-ledger-panel .list-header p { margin: 5px 0 0; color: #667085; font-size: 12px; }
.party-ledger-filters { display: grid; grid-template-columns: minmax(220px,1.5fr) minmax(180px,1.1fr) minmax(130px,.8fr) minmax(130px,.8fr) auto; align-items: end; gap: 10px; padding: 14px; margin: 12px 0; border: 1px solid #d8e0e8; border-radius: 8px; background: #f8fafc; }
.party-ledger-filters label { display: flex; flex-direction: column; gap: 5px; color: #344054; font-size: 11px; font-weight: 800; }
.party-ledger-filters input, .party-ledger-filters select { width: 100%; min-width: 0; height: 36px; padding: 7px 9px; border: 1px solid #cbd5e1; border-radius: 5px; background: white; color: #101828; font-size: 12px; }
.party-ledger-filters button { height: 36px; padding: 0 16px; border: 1px solid #1766a5; border-radius: 5px; background: #1766a5; color: #fff; font-size: 12px; font-weight: 800; cursor: pointer; white-space: nowrap; }
.party-ledger-filters button:disabled { opacity: .6; cursor: wait; }
.party-ledger-summary { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; margin: 12px 0; }
.party-ledger-summary > div { display: flex; flex-direction: column; gap: 5px; min-width: 0; padding: 12px; border: 1px solid #dce4ec; border-radius: 7px; background: #fff; }
.party-ledger-summary span { color: #667085; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; }
.party-ledger-summary strong { color: #173e59; font-size: 15px; overflow-wrap: anywhere; }
.party-ledger-table { overflow-x: auto; }
.party-ledger-table .table-head, .party-ledger-table .table-row { grid-template-columns: 95px minmax(120px,.9fr) 95px minmax(110px,.9fr) minmax(180px,1.4fr) minmax(110px,.8fr) minmax(110px,.8fr) minmax(125px,.9fr); gap: 10px; }
.party-ledger-table .table-row > span:nth-last-child(3), .party-ledger-table .table-row > span:nth-last-child(2), .party-ledger-table .table-row > strong:last-child { text-align: right; font-variant-numeric: tabular-nums; }
@media (max-width: 1050px) {
  .party-ledger-filters { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .party-ledger-summary { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .party-ledger-table .table-head, .party-ledger-table .table-row { min-width: 1100px; }
}
@media (max-width: 560px) {
  .party-ledger-filters { grid-template-columns: minmax(0,1fr); }
  .party-ledger-summary { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
}


`;
