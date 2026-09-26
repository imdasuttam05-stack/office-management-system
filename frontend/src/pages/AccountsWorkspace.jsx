import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import Accounting from "./Accounting.jsx";
import InventoryMasters from "./InventoryMasters.jsx";
import RawMaterialPurchase from "./RawMaterialPurchase.jsx";
import Inventory from "./Inventory.jsx";
import Manufacturing from "./Manufacturing.jsx";

export default function AccountsWorkspace() {

  const [active, setActive] =
    useState("accounting");

  const contentRef =
    useRef(null);

  const menu = [

    {
      id: "accounting",
      label: "Accounts",
      icon: "₹",
      shortcut: "F4",
      description:
        "Groups, Ledgers, Vouchers & Register",
      component: Accounting,
    },

    {
      id: "masters",
      label: "Masters",
      icon: "M",
      shortcut: "F5",
      description:
        "Party, Supplier, Product & Location",
      component: InventoryMasters,
    },

    {
      id: "purchase",
      label: "Purchase",
      icon: "↓",
      shortcut: "F6",
      description:
        "Purchase Entry & Stock In",
      component: RawMaterialPurchase,
    },

    {
      id: "sales",
      label: "Sales",
      icon: "↑",
      shortcut: "F7",
      description:
        "Sales Entry & Stock Out",
      component: Manufacturing,
    },

    {
      id: "inventory",
      label: "Inventory",
      icon: "▦",
      shortcut: "F8",
      description:
        "Stock, Job Order & Inventory",
      component: Inventory,
    },

  ];

  const current =
    menu.find(
      (item) =>
        item.id === active
    ) || menu[0];

  const CurrentComponent =
    current.component;

  /* =========================
     KEYBOARD
  ========================= */

  useEffect(() => {

    const handleKeyboard = (event) => {

      const key =
        event.key.toLowerCase();

      /* Alt + C */

      if (
        event.altKey &&
        key === "c"
      ) {

        event.preventDefault();

        const firstInput =
          contentRef.current?.querySelector(
            `
            input:not([disabled]),
            select:not([disabled]),
            textarea:not([disabled])
            `
          );

        if (firstInput) {
          firstInput.focus();
        }

        return;
      }

      /* F4 */

      if (event.key === "F4") {

        event.preventDefault();

        setActive("accounting");

        return;
      }

      /* F5 */

      if (event.key === "F5") {

        event.preventDefault();

        setActive("masters");

        return;
      }

      /* F6 */

      if (event.key === "F6") {

        event.preventDefault();

        setActive("purchase");

        return;
      }

      /* F7 */

      if (event.key === "F7") {

        event.preventDefault();

        setActive("sales");

        return;
      }

      /* F8 */

      if (event.key === "F8") {

        event.preventDefault();

        setActive("inventory");

        return;
      }

      /* ESC */

      if (event.key === "Escape") {

        const activeElement =
          document.activeElement;

        if (
          activeElement &&
          (
            activeElement.tagName === "INPUT" ||
            activeElement.tagName === "TEXTAREA" ||
            activeElement.tagName === "SELECT"
          )
        ) {

          activeElement.blur();

        }

      }

    };

    window.addEventListener(
      "keydown",
      handleKeyboard
    );

    return () => {

      window.removeEventListener(
        "keydown",
        handleKeyboard
      );

    };

  }, []);

  return (

    <div className="accounts-workspace">

      <style>{`

        * {
          box-sizing: border-box;
        }

        .accounts-workspace {
          min-height: 100vh;
          background: #f5f7fb;
          color: #172b4d;
          font-family: Arial, sans-serif;
        }

        /* =========================
           TOP
        ========================= */

        .accounts-top {
          position: sticky;
          top: 0;
          z-index: 50;

          background: #ffffff;

          border-bottom:
            1px solid #e4e7ec;

          box-shadow:
            0 2px 12px
            rgba(23,43,77,.06);
        }

        .accounts-top-inner {
          max-width: 1600px;
          margin: 0 auto;
          padding:
            14px 20px 12px;
        }

        .accounts-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
        }

        .accounts-title-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .accounts-logo {
          width: 42px;
          height: 42px;

          border-radius: 10px;

          display: flex;
          align-items: center;
          justify-content: center;

          background: #245a96;
          color: #ffffff;

          font-size: 20px;
          font-weight: 800;
        }

        .accounts-title h1 {
          margin: 0;

          font-size: 22px;

          color: #172b4d;
        }

        .accounts-title p {
          margin:
            4px 0 0;

          color: #667085;

          font-size: 11px;
        }

        .accounts-badge {
          padding:
            7px 12px;

          border-radius: 999px;

          background: #eef4fb;

          border:
            1px solid #d9e6f5;

          color: #245a96;

          font-size: 10px;

          font-weight: 800;
        }

        /* =========================
           KEYBOARD
        ========================= */

        .accounts-keyboard {

          display: flex;

          align-items: center;

          flex-wrap: wrap;

          gap: 7px;

          margin-top: 12px;
        }

        .keyboard-item {

          display: flex;

          align-items: center;

          gap: 5px;

          color: #667085;

          font-size: 10px;

          font-weight: 600;
        }

        .keyboard-item kbd {

          min-width: 28px;

          padding:
            4px 6px;

          text-align: center;

          border:
            1px solid #d0d5dd;

          border-bottom-width: 2px;

          border-radius: 5px;

          background: #ffffff;

          color: #344054;

          font-size: 9px;

          font-weight: 800;

          font-family: Arial, sans-serif;
        }

        /* =========================
           NAV
        ========================= */

        .accounts-nav {

          max-width: 1600px;

          margin: 0 auto;

          padding:
            10px 20px;

          display: flex;

          gap: 7px;

          overflow-x: auto;

          background: #f8fafc;

          border-bottom:
            1px solid #e4e7ec;
        }

        .accounts-nav::-webkit-scrollbar {
          display: none;
        }

        .accounts-nav button {

          min-width: 145px;

          border:
            1px solid #dfe4ea;

          background: #ffffff;

          color: #475467;

          border-radius: 9px;

          padding:
            9px 11px;

          text-align: left;

          cursor: pointer;

          transition: .15s ease;
        }

        .accounts-nav button:hover {

          border-color:
            #b9cee8;

          transform:
            translateY(-1px);
        }

        .accounts-nav button.active {

          background:
            #245a96;

          border-color:
            #245a96;

          color:
            #ffffff;

          box-shadow:
            0 4px 12px
            rgba(36,90,150,.20);
        }

        .nav-top {

          display: flex;

          align-items: center;

          gap: 7px;
        }

        .nav-icon {

          width: 25px;
          height: 25px;

          display: flex;

          align-items: center;
          justify-content: center;

          border-radius: 6px;

          background:
            #eef4fb;

          color:
            #245a96;

          font-size: 11px;

          font-weight: 800;
        }

        .accounts-nav
        button.active
        .nav-icon {

          background:
            rgba(255,255,255,.18);

          color:
            #ffffff;
        }

        .nav-label {

          font-size: 11px;

          font-weight: 800;
        }

        .nav-shortcut {

          margin-left: auto;

          font-size: 8px;

          opacity: .7;
        }

        .nav-description {

          margin-top: 5px;

          font-size: 8px;

          opacity: .7;

          line-height: 1.3;
        }

        /* =========================
           SECTION BAR
        ========================= */

        .accounts-sectionbar {

          max-width: 1600px;

          margin: 0 auto;

          padding:
            9px 20px;

          display: flex;

          justify-content:
            space-between;

          align-items: center;

          background:
            #f5f7fb;

          border-bottom:
            1px solid #e4e7ec;
        }

        .accounts-sectionbar strong {

          font-size: 12px;

          color:
            #173957;
        }

        .accounts-sectionbar span {

          color:
            #667085;

          font-size: 9px;
        }

        /* =========================
           CONTENT
        ========================= */

        .accounts-content {

          max-width: 1600px;

          margin: 0 auto;

          padding: 0;
        }

        /* =========================
           MOBILE
        ========================= */

        @media (max-width: 700px) {

          .accounts-top-inner {
            padding: 12px;
          }

          .accounts-title h1 {
            font-size: 19px;
          }

          .accounts-title p {
            font-size: 9px;
          }

          .accounts-badge {
            display: none;
          }

          .accounts-nav {
            padding: 8px 12px;
          }

          .accounts-nav button {
            min-width: 130px;
          }

          .accounts-sectionbar {
            padding:
              9px 12px;
          }

          .accounts-sectionbar span {
            display: none;
          }

        }

      `}</style>

      {/* =========================
          HEADER
      ========================= */}

      <header className="accounts-top">

        <div className="accounts-top-inner">

          <div className="accounts-title-row">

            <div className="accounts-title-left">

              <div className="accounts-logo">
                ₹
              </div>

              <div className="accounts-title">

                <h1>
                  Accounts
                </h1>

                <p>
                  Tally-style Business &
                  Accounting Workspace
                </p>

              </div>

            </div>

            <div className="accounts-badge">
              BUSINESS SOFTWARE
            </div>

          </div>

          {/* Keyboard */}

          <div className="accounts-keyboard">

            <div className="keyboard-item">
              <kbd>F4</kbd>
              <span>Accounts</span>
            </div>

            <div className="keyboard-item">
              <kbd>F5</kbd>
              <span>Masters</span>
            </div>

            <div className="keyboard-item">
              <kbd>F6</kbd>
              <span>Purchase</span>
            </div>

            <div className="keyboard-item">
              <kbd>F7</kbd>
              <span>Sales</span>
            </div>

            <div className="keyboard-item">
              <kbd>F8</kbd>
              <span>Inventory</span>
            </div>

            <div className="keyboard-item">
              <kbd>Alt+C</kbd>
              <span>Create</span>
            </div>

            <div className="keyboard-item">
              <kbd>Enter</kbd>
              <span>Next</span>
            </div>

            <div className="keyboard-item">
              <kbd>Esc</kbd>
              <span>Back / Clear</span>
            </div>

          </div>

        </div>

      </header>

      {/* =========================
          MODULE NAVIGATION
      ========================= */}

      <nav
        className="accounts-nav"
        aria-label="Accounts modules"
      >

        {menu.map((item) => (

          <button
            key={item.id}
            type="button"
            className={
              active === item.id
                ? "active"
                : ""
            }
            onClick={() => {

              setActive(item.id);

              window.scrollTo({
                top: 0,
                behavior: "smooth",
              });

            }}
          >

            <div className="nav-top">

              <span className="nav-icon">
                {item.icon}
              </span>

              <span className="nav-label">
                {item.label}
              </span>

              <span className="nav-shortcut">
                {item.shortcut}
              </span>

            </div>

            <div className="nav-description">
              {item.description}
            </div>

          </button>

        ))}

      </nav>

      {/* =========================
          CURRENT SECTION
      ========================= */}

      <div className="accounts-sectionbar">

        <strong>
          {current.label}
        </strong>

        <span>
          {current.description}
        </span>

      </div>

      {/* =========================
          MODULE CONTENT
      ========================= */}

      <main
        ref={contentRef}
        className="accounts-content"
      >

        <CurrentComponent />

      </main>

    </div>

  );
}
