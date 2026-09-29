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
];

const txTabs = [
  ["purchase", "Purchase", "F10"],
  ["sale", "Sale", "F11"],
  ["job", "Job Order", "F12"],
  ["production", "Production", "F13"],
  ["grading", "Grading", "F14"],
  ["pi", "PI", "F15"],
  ["return", "Return", "F16"],
  ["damage", "Damage", "F17"],
  ["repack", "Repacking", "F18"],
  ["packing", "Packing Conversion", "F19"],
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

        F10: "purchase",
        F11: "sale",
        F12: "job",
        F13: "production",
        F14: "grading",
        F15: "pi",
        F16: "return",
        F17: "damage",
        F18: "repack",
        F19: "packing",
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
          background:#f8fafc;
          border-bottom:1px solid #e4e7ec;
          overflow:auto;
          flex-wrap:nowrap
        }

        .am-navbtn{
          border:1px solid #d0d5dd;
          background:#fff;
          color:#344054;
          border-radius:8px;
          padding:8px 11px;
          font-weight:800;
          cursor:pointer;
          white-space:nowrap
        }

        .am-navbtn.active{
          background:#245a96;
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

        @media(max-width:700px){
          .am-shell-head-inner,
          .am-content{
            padding:12px 10px
          }

          .am-shell-subnav{
            padding:8px 10px
          }

          .am-shell-title h1{
            font-size:18px
          }
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
              Masters <span className="am-key">F4–F9</span>
            </button>

            <button
              className={`am-navbtn ${
                section === "transactions" ? "active" : ""
              }`}
              onClick={() => setSection("transactions")}
            >
              Voucher / Operations{" "}
              <span className="am-key">F10–F19</span>
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
