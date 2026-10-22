import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AccountsMasterCatalog from "./AccountsMasterCatalog.jsx";
import AccountsTransactionCenter from "./AccountsTransactionCenter.jsx";
import Accounting from "./Accounting.jsx";
import JobOrderStockReport from "./JobOrderStockReport.jsx";

const masterTabs = [
  ["group", "Group", "F4"],
  ["ledger", "Ledger", "F5"],
  ["product", "Product", "F8"],
  ["location", "Location", "F9"],
  ["unit", "Unit", "F10"],
];

const txTabs = [
  ["purchase", "Purchase", "F11"],
  ["sale", "Sale", "F12"],
  ["job", "Job Order", "F13"],
  ["production", "Production", "F14"],
  ["grading", "Grading", "F15"],
  ["pi", "PI", "F16"],
  ["return", "Return", "F17"],
  ["damage", "Damage", "F18"],
  ["repack", "Repacking", "F19"],
  ["packing", "Packing Conversion", "F20"],
  ["job-order-report", "Job Order Report", ""],
  ["bom", "BOM / Costing", ""],
  ["stock", "Stock / Ledger", ""],
  ["documents", "Documents", ""],
];

export default function AccountsMasters() {
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);

  const [section, setSection] = useState(
    params.get("section") || "master"
  );

  const requestedMaster = params.get("master") || "ledger";
  const [master, setMaster] = useState(
    ["party", "supplier"].includes(requestedMaster) ? "ledger" : requestedMaster
  );

  const [tx, setTx] = useState(
    params.get("tab") || "purchase"
  );

  const [ledgerTab, setLedgerTab] = useState(params.get("ledgerTab") || "groups");

  useEffect(() => {
    const p = new URLSearchParams();

    p.set("section", section);

    if (section === "master") {
      p.set("master", master);
    } else if (section === "transactions") {
      p.set("tab", tx);
    } else if (section === "ledger") {
      p.set("ledgerTab", ledgerTab);
    }

    navigate(`/accounts?${p.toString()}`, {
      replace: true,
    });
  }, [section, master, tx, ledgerTab, navigate]);

  useEffect(() => {
    const onKey = (e) => {
      const map = {
        F4: "group",
        F5: "ledger",
        F8: "product",
        F9: "location",
        F10: "unit",

        F11: "purchase",
        F12: "sale",
        F13: "job",
        F14: "production",
        F15: "grading",
        F16: "pi",
        F17: "return",
        F18: "damage",
        F19: "repack",
        F20: "packing",
      };

      if (!map[e.key]) return;

      e.preventDefault();

      if (
        [
          "group",
          "ledger",
          "product",
          "location",
          "unit",
        ].includes(map[e.key])
      ) {
        setSection("master");
        setMaster(map[e.key]);
      } else {
        setSection("transactions");
        setTx(map[e.key]);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <div className="am-shell">
      <style>{`
        .am-shell{
          min-height:100vh;
          background:#f2f6f8;
          color:#152a3a;
          font-family:"Segoe UI",Arial,sans-serif
        }

        .am-shell-head{
          position:sticky;
          top:0;
          z-index:100;
          background:#123c55;
          color:#fff;
          border-bottom:1px solid #0d3044;
          box-shadow:0 2px 12px rgba(18,60,85,.12)
        }

        .am-shell-head-inner{
          max-width:1650px;
          margin:0 auto;
          padding:14px 20px
        }

        .am-shell-title{
          display:flex;
          align-items:center;
          gap:12px
        }

        .am-shell-logo{
          width:42px;
          height:42px;
          border-radius:10px;
          background:#f0b83f;
          color:#17364a;
          display:grid;
          place-items:center;
          font-weight:900
        }

        .am-shell-title h1{
          margin:0;
          color:#fff;
          font-size:21px
        }

        .am-shell-title p{
          margin:4px 0 0;
          font-size:11px;
          color:#c8d9e2
        }

        .am-shell-mainnav{display:none}

        .am-layout{
          display:grid;
          grid-template-columns:230px minmax(0,1fr);
          align-items:start;
          min-height:calc(100vh - 120px)
        }

        .am-shell-subnav{
          position:sticky;
          top:0;
          min-height:calc(100vh - 120px);
          padding:14px 11px;
          display:flex;
          flex-direction:column;
          align-items:stretch;
          gap:7px;
          background:#e5eff4;
          border-right:1px solid #d0dfe6;
          overflow-y:auto
        }

        .am-sidebar-sections{display:grid;grid-template-columns:1fr;gap:6px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid #d0dfe6}
        .am-shell-subnav .am-section-btn{width:100%;text-align:left;border:1px solid #cbd8df;background:rgba(255,255,255,.76);color:#1a3446;border-radius:3px;padding:10px 9px;font-weight:800;cursor:pointer}
        .am-shell-subnav .am-section-btn.active{background:#f4c648;color:#183348;border-color:#dda936}

        .am-sidebar-heading{
          padding:5px 9px 9px;
          color:#528096;
          font-size:11px;
          font-weight:900;
          letter-spacing:.07em;
          text-transform:uppercase
        }

        .am-shell-subnav .am-navbtn{
          width:100%;
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:8px;
          text-align:left;
          border:1px solid transparent;
          background:rgba(255,255,255,.52);
          color:#1a3446;
          border-radius:3px;
          padding:10px 11px;
          font-weight:800;
          cursor:pointer;
          white-space:nowrap
        }

        .am-shell-subnav .am-navbtn:hover{
          background:#d6e7ef;
          border-color:#c3d8e1
        }

        .am-shell-subnav .am-navbtn.active{
          background:#f4c648;
          color:#183348;
          border-color:#dda936;
          box-shadow:0 2px 5px rgba(18,60,85,.09)
        }

        .am-shell-subnav .am-key{
          color:inherit;
          opacity:.65
        }

        .am-shell-subnav .am-back{
          width:100%;
          margin-top:8px;
          border-color:#cbd8df;
          background:rgba(255,255,255,.55);
          color:#1a3446;
          text-align:left
        }

        .am-key{
          font-size:10px;
          opacity:.75;
          margin-left:4px
        }

        .am-content{
          width:100%;
          max-width:1650px;
          min-width:0;
          margin:0 auto;
          padding:16px 20px
        }

        .am-back{
          border:1px solid #d0d5dd;
          background:#fff;
          border-radius:8px;
          padding:8px 11px;
          font-weight:700;
          cursor:pointer
        }

        .am-info{
          background:#e9f5f1;
          border:1px solid #c8e2d9;
          color:#287168;
          border-radius:2px;
          padding:9px 12px;
          font-size:12px;
          margin-bottom:10px
        }

        @media(max-width:900px){
          .am-layout{grid-template-columns:190px minmax(0,1fr)}
          .am-content{padding:14px 12px}
          .am-shell-subnav{padding:12px 8px}
          .am-shell-subnav .am-navbtn{padding:9px 8px;font-size:12px}
        }

        @media(max-width:700px){
          .am-shell-head-inner{padding:12px 10px}
          .am-shell-title h1{font-size:18px}
          .am-layout{grid-template-columns:132px minmax(0,1fr)}
          .am-content{padding:12px 8px}
          .am-shell-subnav{padding:10px 5px}
          .am-sidebar-heading{padding:5px 5px 8px;font-size:9px}
          .am-shell-subnav .am-section-btn{font-size:11px;padding:9px 6px}
          .am-shell-subnav .am-navbtn{white-space:normal;font-size:11px;gap:3px;padding:9px 6px}
          .am-shell-subnav .am-key{font-size:9px}
        }
      `}</style>

      <header className="am-shell-head">
        <div className="am-shell-head-inner">
          <div className="am-shell-title">
            <div className="am-shell-logo">₹</div>

            <div>
              <h1>Accounts Masters & Operations</h1>

              <p>
                Group, Ledger, Product, Unit, Location + all
                voucher, inventory and production entry in one workspace
              </p>
            </div>
          </div>

        </div>
      </header>

      <div className="am-layout">
        <aside className="am-shell-subnav" aria-label="Accounts submenu">
          <div className="am-sidebar-sections" aria-label="Main sections">
            <button className={`am-section-btn ${section === "master" ? "active" : ""}`} onClick={() => setSection("master")}>Masters</button>
            <button className={`am-section-btn ${section === "transactions" ? "active" : ""}`} onClick={() => setSection("transactions")}>Voucher / Operations</button>
            <button className={`am-section-btn ${section === "ledger" ? "active" : ""}`} onClick={() => setSection("ledger")}>Accounts Ledger</button>
            <button className="am-section-btn" onClick={() => navigate("/dashboard")}>Dashboard</button>
          </div>
          {section === "master" && (
            <>
              <div className="am-sidebar-heading">Masters Menu</div>
              {masterTabs.map(([id, label, key]) => (
                <React.Fragment key={id}>
                  {id === "product" && <div className="am-sidebar-heading">Inventory Masters</div>}
                  <button
                    className={`am-navbtn ${master === id ? "active" : ""}`}
                    onClick={() => {
                      setMaster(id);
                      setSection("master");
                    }}
                  >
                    <span>{label}</span><span className="am-key">{key}</span>
                  </button>
                </React.Fragment>
              ))}
            </>
          )}

          {section === "transactions" && (
            <>
              <div className="am-sidebar-heading">Voucher / Operations</div>
              {txTabs.map(([id, label, key]) => (
                <button
                  key={id}
                  className={`am-navbtn ${tx === id ? "active" : ""}`}
                  onClick={() => {
                    setTx(id);
                    setSection("transactions");
                  }}
                >
                  <span>{label}</span>{key && <span className="am-key">{key}</span>}
                </button>
              ))}
            </>
          )}

          {section === "ledger" && (
            <>
              <div className="am-sidebar-heading">Accounts Ledger</div>
              {[["groups","Accounting Groups"],["ledgers","Ledgers"],["voucher","Voucher Entry"],["register","Register"]].map(([id,label]) => (
                <button key={id} className={`am-navbtn ${ledgerTab === id ? "active" : ""}`} onClick={() => { setLedgerTab(id); setSection("ledger"); }}>
                  <span>{label}</span>
                </button>
              ))}
            </>
          )}
        </aside>

      <main className="am-content">
        {section === "master" && (
          <>
            <div className="am-info">
              Create and manage accounting ledgers and inventory masters.
            </div>

            <AccountsMasterCatalog
              key={master}
              initialType={master}
            />
          </>
        )}

        {section === "transactions" && (
          tx === "job-order-report"
            ? <JobOrderStockReport onBack={() => setTx("job")} />
            : <AccountsTransactionCenter key={tx} initialTab={tx} />
        )}

        {section === "ledger" && <Accounting key={ledgerTab} initialTab={ledgerTab} />}
      </main>
      </div>
    </div>
  );
}
