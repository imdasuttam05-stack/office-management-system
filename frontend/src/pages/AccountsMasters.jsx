import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AccountsMasterCatalog from "./AccountsMasterCatalog.jsx";
import AccountsTransactionCenter from "./AccountsTransactionCenter.jsx";
import Accounting from "./Accounting.jsx";

const masterTabs = [
  ["group", "Group", "F4"],
  ["ledger", "Ledger", "F5"],
  ["party", "Party", "F6"],
  ["supplier", "Supplier", "F7"],
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

  const [master, setMaster] = useState(
    params.get("master") || "ledger"
  );

  const [tx, setTx] = useState(
    params.get("tab") || "purchase"
  );

  useEffect(() => {
    const p = new URLSearchParams();

    p.set("section", section);

    if (section === "master") {
      p.set("master", master);
    } else if (section === "transactions") {
      p.set("tab", tx);
    }

    navigate(`/accounts?${p.toString()}`, {
      replace: true,
    });
  }, [section, master, tx, navigate]);

  useEffect(() => {
    const onKey = (e) => {
      const map = {
        F4: "group",
        F5: "ledger",
        F6: "party",
        F7: "supplier",
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
          "party",
          "supplier",
          "product",
          "location",
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
          background:#f5f7fb;
          color:#172b4d;
          font-family:Arial,sans-serif
        }

        .am-shell-head{
          position:sticky;
          top:0;
          z-index:100;
          background:#fff;
          border-bottom:1px solid #e4e7ec;
          box-shadow:0 2px 12px rgba(23,43,77,.06)
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
          background:#245a96;
          color:#fff;
          display:grid;
          place-items:center;
          font-weight:900
        }

        .am-shell-title h1{
          margin:0;
          font-size:21px
        }

        .am-shell-title p{
          margin:4px 0 0;
          font-size:11px;
          color:#667085
        }

        .am-shell-mainnav{
          display:flex;
          gap:7px;
          flex-wrap:wrap;
          margin-top:12px
        }

        /* Main navigation stays at the top; module submenus live only in the left sidebar. */
        .am-shell-mainnav .am-navbtn{
          border:1px solid #e5eaf1;
          background:#f7f9fc;
          color:#718096;
          border-radius:8px;
          padding:8px 11px;
          font-weight:800;
          cursor:pointer;
          white-space:nowrap;
          transition:background .15s ease,color .15s ease,border-color .15s ease
        }

        .am-shell-mainnav .am-navbtn:hover{
          background:#edf3fa;
          color:#52657d
        }

        .am-shell-mainnav .am-navbtn.active{
          background:#eaf2ff;
          color:#58708e;
          border-color:#d8e5f6
        }

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
          background:#ffef9c;
          border-right:1px solid #ead36a;
          overflow-y:auto
        }

        .am-sidebar-heading{
          padding:5px 9px 9px;
          color:#79651b;
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
          color:#66571b;
          border-radius:8px;
          padding:10px 11px;
          font-weight:800;
          cursor:pointer;
          white-space:nowrap
        }

        .am-shell-subnav .am-navbtn:hover{
          background:rgba(255,255,255,.82);
          border-color:#f0d85d
        }

        .am-shell-subnav .am-navbtn.active{
          background:#f4d84f;
          color:#44380b;
          border-color:#dfc12d;
          box-shadow:0 2px 5px rgba(117,91,0,.09)
        }

        .am-shell-subnav .am-key{
          color:inherit;
          opacity:.65
        }

        .am-shell-subnav .am-back{
          width:100%;
          margin-top:8px;
          border-color:#ead36a;
          background:rgba(255,255,255,.55);
          color:#66571b;
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
          background:#eef6ff;
          border:1px solid #cfe2ff;
          color:#245a96;
          border-radius:9px;
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
                Group, Ledger, Party, Supplier, Product, Location + all
                voucher, inventory and production entry in one workspace
              </p>
            </div>
          </div>

          <div className="am-shell-mainnav">
            <button
              className={`am-navbtn ${
                section === "master" ? "active" : ""
              }`}
              onClick={() => setSection("master")}
            >
              Masters <span className="am-key">F4–F10</span>
            </button>

            <button
              className={`am-navbtn ${
                section === "transactions" ? "active" : ""
              }`}
              onClick={() => setSection("transactions")}
            >
              Voucher / Operations{" "}
              <span className="am-key">F11–F20</span>
            </button>

            <button
              className={`am-navbtn ${
                section === "ledger" ? "active" : ""
              }`}
              onClick={() => setSection("ledger")}
            >
              Accounts Ledger
            </button>

            <button
              className="am-navbtn"
              onClick={() => navigate("/dashboard")}
            >
              Dashboard
            </button>
          </div>
        </div>
      </header>

      <div className="am-layout">
        <aside className="am-shell-subnav" aria-label="Accounts submenu">
          {section === "master" && (
            <>
              <div className="am-sidebar-heading">Masters Menu</div>
              {masterTabs.map(([id, label, key]) => (
                <button
                  key={id}
                  className={`am-navbtn ${master === id ? "active" : ""}`}
                  onClick={() => {
                    setMaster(id);
                    setSection("master");
                  }}
                >
                  <span>{label}</span><span className="am-key">{key}</span>
                </button>
              ))}
              <button className="am-back" onClick={() => setSection("transactions")}>
                Open Vouchers →
              </button>
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
              <button className="am-back" onClick={() => setSection("master")}>
                ← Masters
              </button>
            </>
          )}

          {section === "ledger" && (
            <>
              <div className="am-sidebar-heading">Accounts Ledger</div>
              <button className="am-navbtn active" onClick={() => setSection("ledger")}>Ledger Workspace</button>
              <button className="am-back" onClick={() => setSection("master")}>← Masters</button>
            </>
          )}
        </aside>

      <main className="am-content">
        {section === "master" && (
          <>
            <div className="am-info">
              Create, edit, and delete Group, Ledger, Party, Supplier,
              Product, and Location here. Use F4–F9 to switch between
              masters.
            </div>

            <AccountsMasterCatalog
              key={master}
              initialType={master}
            />
          </>
        )}

        {section === "transactions" && (
          <AccountsTransactionCenter
            key={tx}
            initialTab={tx}
          />
        )}

        {section === "ledger" && <Accounting />}
      </main>
      </div>
    </div>
  );
}
