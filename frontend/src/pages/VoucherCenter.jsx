import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const items = [
  ["Purchase", "Purchase entry and purchase report", "/voucher/purchase", "F11"],
  ["Sale", "Sale entry and invoice report", "/voucher/sale", "F12"],
  ["Job Order", "Job planning, entry and saved orders", "/voucher/job-order", "F13"],
  ["Production", "Production entry and output report", "/voucher/production", "F14"],
  ["Grading", "Grading workflow and job report", "/voucher/grading", "F15"],
  ["PI", "Proforma invoice entry and report", "/voucher/pi", "F16"],
  ["Return", "Return entries and return report", "/voucher/return", "F17"],
  ["Damage", "Damage voucher and report", "/voucher/damage", "F18"],
  ["Repacking", "Repacking entry and report", "/voucher/repacking", "F19"],
  ["Packing Conversion", "Packing conversion entry and report", "/voucher/packing-conversion", "F20"],
  ["Job Order Report", "Party-wise production progress and stock", "/voucher/job-order-stock", "Report"],
  ["BOM / Costing", "Product recipes, cost items and saved BOMs", "/voucher/bom-costing", ""],
  ["Stock / Ledger", "Current stock and item movement details", "/voucher/stock-ledger", ""],
  ["Documents", "Workflow documents and stock movement ledger", "/voucher/documents", ""],
];

export default function VoucherCenter() {
  const navigate = useNavigate();
  useEffect(() => {
    const shortcuts = {
      F11: "/voucher/purchase",
      F12: "/voucher/sale",
      F13: "/voucher/job-order",
      F14: "/voucher/production",
      F15: "/voucher/grading",
      F16: "/voucher/pi",
      F17: "/voucher/return",
      F18: "/voucher/damage",
      F19: "/voucher/repacking",
      F20: "/voucher/packing-conversion",
    };
    function handleShortcut(event) {
      const path = shortcuts[event.key];
      if (!path) return;
      event.preventDefault();
      navigate(path);
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [navigate]);

  return (
    <main style={{ padding: 24, minHeight: "100vh", background: "#f5f7fb", fontFamily: "Arial,sans-serif", color: "#172b4d" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, padding: 22, background: "#153d55", color: "#fff", borderRadius: 4 }}>
        <div>
          <div style={{ color: "#8de0d1", fontSize: 10, fontWeight: 800, letterSpacing: 1.2 }}>ACCOUNTS · OPERATIONS</div>
          <h1 style={{ margin: "6px 0" }}>Voucher Center</h1>
          <div style={{ color: "#e1edf3", fontSize: 13 }}>Open each workflow on its own page. Each page includes its matching report, CSV export and print.</div>
        </div>
        <button onClick={() => navigate("/accounting")} style={button("#344054")}>Ledger / Accounts</button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 14 }}>
        {items.map(([title, description, path, shortcut]) => (
          <button
            key={title}
            type="button"
            onClick={() => navigate(path)}
            style={{ textAlign: "left", minHeight: 112, background: "#fff", border: "1px solid #e4e7ec", borderRadius: 8, padding: 18, cursor: "pointer", boxShadow: "0 2px 8px rgba(16,24,40,.05)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <b style={{ fontSize: 17 }}>{title}</b>
              {shortcut && <kbd style={{ background: "#eef2f6", padding: "4px 7px", borderRadius: 4, fontSize: 11 }}>{shortcut}</kbd>}
            </div>
            <div style={{ fontSize: 12, color: "#667085", marginTop: 9 }}>{description}</div>
            <div style={{ color: "#176b55", fontSize: 12, fontWeight: 700, marginTop: 14 }}>Open page →</div>
          </button>
        ))}
      </div>
    </main>
  );
}

function button(background) {
  return { border: 0, borderRadius: 5, padding: "10px 14px", background, color: "#fff", fontWeight: 700, cursor: "pointer" };
}
