import React, { useMemo, useState } from "react";
import Accounting from "./Accounting.jsx";
import InventoryMasters from "./InventoryMasters.jsx";
import RawMaterialPurchase from "./RawMaterialPurchase.jsx";
import Inventory from "./Inventory.jsx";
import Manufacturing from "./Manufacturing.jsx";

const menu = [
  { id: "accounts", label: "Accounts", icon: "▣", description: "Groups, Ledgers & Vouchers", component: Accounting },
  { id: "masters", label: "Masters", icon: "◈", description: "Party, Supplier, Product & Location", component: InventoryMasters },
  { id: "purchase", label: "Purchase", icon: "↓", description: "Purchase Entry & Stock In", component: RawMaterialPurchase },
  { id: "sales", label: "Sales", icon: "↑", description: "Sales Entry & Stock Out", component: Manufacturing },
  { id: "inventory", label: "Inventory", icon: "▦", description: "Stock, Job Order & Inventory", component: Inventory },
];

export default function AccountsWorkspace() {
  const [active, setActive] = useState("accounts");
  const current = useMemo(() => menu.find((x) => x.id === active) || menu[0], [active]);
  const Component = current.component;

  return (
    <div className="accounts-workspace">
      <style>{`
        .accounts-workspace{min-height:100vh;background:#f5f7fb;color:#172b4d;font-family:Arial,sans-serif}
        .accounts-top{position:sticky;top:0;z-index:20;background:#fff;border-bottom:1px solid #e5eaf1;box-shadow:0 2px 12px rgba(23,43,77,.05)}
        .accounts-top-inner{max-width:1500px;margin:0 auto;padding:18px 24px 12px}
        .accounts-title{display:flex;align-items:center;justify-content:space-between;gap:18px}
        .accounts-title h1{margin:0;font-size:25px;letter-spacing:-.3px}
        .accounts-title p{margin:5px 0 0;color:#6b778c;font-size:13px}
        .accounts-badge{background:#eef5ff;color:#245a96;border:1px solid #d8e7fb;border-radius:999px;padding:8px 13px;font-size:12px;font-weight:700}
        .accounts-nav{display:flex;gap:8px;overflow:auto;padding-top:14px;scrollbar-width:none}
        .accounts-nav::-webkit-scrollbar{display:none}
        .accounts-nav button{border:1px solid #e1e7ef;background:#fff;color:#44546f;border-radius:11px;padding:10px 14px;min-width:150px;text-align:left;cursor:pointer;transition:.15s;box-shadow:0 2px 8px rgba(23,43,77,.03)}
        .accounts-nav button:hover{border-color:#b9cee8;transform:translateY(-1px)}
        .accounts-nav button.active{background:#245a96;color:#fff;border-color:#245a96;box-shadow:0 5px 14px rgba(36,90,150,.2)}
        .accounts-nav .nav-line{display:flex;align-items:center;gap:8px;font-weight:700;font-size:13px}
        .accounts-nav .nav-icon{font-size:16px}
        .accounts-nav small{display:block;margin-top:4px;opacity:.72;font-size:10px;line-height:1.25}
        .accounts-content{max-width:1500px;margin:0 auto;padding:0}
        .accounts-sectionbar{display:flex;align-items:center;justify-content:space-between;padding:12px 24px;background:#f5f7fb;border-bottom:1px solid #e8edf3}
        .accounts-sectionbar strong{font-size:13px}
        .accounts-sectionbar span{font-size:11px;color:#6b778c}
        @media(max-width:700px){.accounts-top-inner{padding:14px}.accounts-title h1{font-size:21px}.accounts-nav button{min-width:135px}.accounts-content{overflow:hidden}}
      `}</style>

      <header className="accounts-top">
        <div className="accounts-top-inner">
          <div className="accounts-title">
            <div>
              <h1>Accounts</h1>
              <p>Integrated accounting, purchase, sales, inventory and masters</p>
            </div>
            <div className="accounts-badge">ACCOUNTING WORKSPACE</div>
          </div>

          <nav className="accounts-nav" aria-label="Accounts modules">
            {menu.map((item) => (
              <button key={item.id} className={active === item.id ? "active" : ""} onClick={() => setActive(item.id)}>
                <div className="nav-line"><span className="nav-icon">{item.icon}</span>{item.label}</div>
                <small>{item.description}</small>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="accounts-sectionbar">
        <strong>{current.label}</strong>
        <span>{current.description}</span>
      </div>

      <main className="accounts-content">
        <Component />
      </main>
    </div>
  );
}
