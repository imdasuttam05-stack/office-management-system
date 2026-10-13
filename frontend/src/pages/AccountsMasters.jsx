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
          background:#edf3f6;
          color:#1a3446;
          font-family:Arial,sans-serif
        }
        /* GST-style workspace: dark teal header, pale blue sidebar */
        .am-shell{display:grid;grid-template-columns:250px minmax(0,1fr);align-content:start}
        .am-shell-head{grid-column:1/-1}
        .am-shell-subnav{grid-column:1;grid-row:auto;display:flex;flex-direction:column;align-items:stretch;gap:5px;min-width:0;padding:18px 12px;background:#e5eff4;border-right:1px solid #d0dfe6;border-bottom:0;overflow:visible;white-space:normal}
        .am-content{grid-column:2;grid-row:2 / span 2;min-width:0;width:100%;max-width:none;padding:22px 26px}
        .am-shell-mainnav .am-navbtn{border-radius:2px}
        .am-navbtn{border-radius:2px;text-align:left;border-color:#d0dfe6;color:#1a3446}
        .am-navbtn:hover{background:#d6e7ef;border-color:#9bbbc8}
        .am-navbtn.active{background:#f4c648;color:#183348;border-color:#edb62e;box-shadow:none}
        .am-back{border-radius:2px;color:#27786e;border-color:#cbd8df}
        .am-shell-logo{border-radius:3px;background:#173b50}
        .am-info{border-radius:2px;background:#e9f5f1;border-color:#cde4dc;color:#27786e}


        .am-shell-head{
          position:sticky;
          top:0;
          z-index:100;
          background:#ffffff;
          border-bottom:1px solid #d0dfe6;
          box-shadow:0 2px 12px rgba(23,52,70,.06)
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
          background:#173b50;
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

        .am-shell-mainnav,
        .am-shell-subnav{
          display:flex;
          gap:7px;
          flex-wrap:wrap
        }

        .am-shell-mainnav{
          margin-top:12px
        }

        .am-shell-subnav{
          padding:10px 20px;
          background:#e5eff4;
          border-bottom:1px solid #d0dfe6;
          overflow:auto;
          flex-wrap:nowrap
        }

        .am-navbtn{
          border:1px solid #cbd8df;
          background:#ffffff;
          color:#1a3446;
          border-radius:8px;
          padding:8px 11px;
          font-weight:800;
          cursor:pointer;
          white-space:nowrap
        }

        .am-navbtn.active{
          background:#173b50;
          color:#fff;
          border-color:#245a96
        }

        .am-key{
          font-size:10px;
          opacity:.75;
          margin-left:4px
        }

        .am-content{
          max-width:1650px;
          margin:0 auto;
          padding:16px 20px
        }

        .am-back{
          border:1px solid #cbd8df;
          background:#ffffff;
          border-radius:8px;
          padding:8px 11px;
          font-weight:700;
          cursor:pointer
        }

        .am-info{
          background:#e9f5f1;
          border:1px solid #cde4dc;
          color:#27786e;
          border-radius:9px;
          padding:9px 12px;
          font-size:12px;
          margin-bottom:10px
        }

        @media(max-width:700px){
          .am-shell{display:block}
          .am-shell-head-inner,.am-content{padding:12px 10px}
          .am-shell-mainnav{overflow-x:auto;flex-wrap:nowrap}
          .am-shell-subnav{display:flex;flex-direction:row;align-items:center;gap:6px;padding:10px;overflow-x:auto;border-right:0;border-bottom:1px solid #d0dfe6;white-space:nowrap}
          .am-navbtn{flex:0 0 auto}
          .am-content{padding:14px 10px}
          .am-shell-title h1{font-size:18px}
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

      {section === "master" && (
        <div className="am-shell-subnav">
          {masterTabs.map(([id, label, key]) => (
            <button
              key={id}
              className={`am-navbtn ${
                master === id ? "active" : ""
              }`}
              onClick={() => {
                setMaster(id);
                setSection("master");
              }}
            >
              {label} <span className="am-key">{key}</span>
            </button>
          ))}

          <button
            className="am-back"
            onClick={() => setSection("transactions")}
          >
            Open Vouchers →
          </button>
        </div>
      )}

      {section === "transactions" && (
        <div className="am-shell-subnav">
          {txTabs.map(([id, label, key]) => (
            <button
              key={id}
              className={`am-navbtn ${
                tx === id ? "active" : ""
              }`}
              onClick={() => {
                setTx(id);
                setSection("transactions");
              }}
            >
              {label}{" "}
              {key && <span className="am-key">{key}</span>}
            </button>
          ))}

          <button
            className="am-back"
            onClick={() => setSection("master")}
          >
            ← Masters
          </button>
        </div>
      )}

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
  );
}
