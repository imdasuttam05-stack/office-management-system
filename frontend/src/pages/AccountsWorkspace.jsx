import React from "react";
import Accounting from "./Accounting.jsx";

export default function AccountsWorkspace() {
  return (
    <div className="accounts-workspace">
      <style>{`
        .accounts-workspace {
          min-height: 100vh;
          background: #f5f7fb;
          color: #172b4d;
          font-family: Arial, sans-serif;
        }

        .accounts-top {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #ffffff;
          border-bottom: 1px solid #e5eaf1;
          box-shadow: 0 2px 12px rgba(23, 43, 77, 0.05);
        }

        .accounts-top-inner {
          max-width: 1500px;
          margin: 0 auto;
          padding: 16px 24px 12px;
        }

        .accounts-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .accounts-title-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .accounts-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: grid;
          place-items: center;
          background: #245a96;
          color: #ffffff;
          font-size: 21px;
          font-weight: 800;
        }

        .accounts-title h1 {
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
          letter-spacing: -0.3px;
        }

        .accounts-title p {
          margin: 4px 0 0;
          color: #6b778c;
          font-size: 12px;
        }

        .accounts-badge {
          background: #eef5ff;
          color: #245a96;
          border: 1px solid #d8e7fb;
          border-radius: 999px;
          padding: 7px 12px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .accounts-keyboard {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 7px;
          margin-top: 13px;
          padding: 9px 11px;
          background: #f8fafc;
          border: 1px solid #e6ebf2;
          border-radius: 9px;
        }

        .keyboard-item {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #68788d;
          font-size: 10px;
          font-weight: 600;
        }

        .keyboard-item kbd {
          min-width: 27px;
          padding: 4px 6px;
          text-align: center;
          border: 1px solid #cfd8e3;
          border-bottom-width: 2px;
          border-radius: 5px;
          background: #ffffff;
          color: #34495e;
          font-family: Arial, sans-serif;
          font-size: 10px;
          font-weight: 800;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .accounts-sectionbar {
          max-width: 1500px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          padding: 11px 24px;
          background: #f5f7fb;
          border-bottom: 1px solid #e8edf3;
        }

        .accounts-sectionbar strong {
          font-size: 13px;
          color: #173957;
        }

        .accounts-sectionbar span {
          font-size: 10px;
          color: #78889a;
        }

        .accounts-content {
          max-width: 1500px;
          margin: 0 auto;
          padding: 0;
        }

        @media (max-width: 700px) {
          .accounts-top-inner {
            padding: 12px;
          }

          .accounts-title h1 {
            font-size: 20px;
          }

          .accounts-title p {
            font-size: 10px;
          }

          .accounts-badge {
            display: none;
          }

          .accounts-keyboard {
            gap: 5px;
          }

          .accounts-sectionbar {
            padding: 10px 12px;
          }

          .accounts-sectionbar span {
            display: none;
          }
        }
      `}</style>

      <header className="accounts-top">
        <div className="accounts-top-inner">

          <div className="accounts-title">
            <div className="accounts-title-left">

              <div className="accounts-icon">
                ₹
              </div>

              <div>
                <h1>Accounts</h1>
                <p>
                  Tally-style keyboard-first accounting
                </p>
              </div>

            </div>

            <div className="accounts-badge">
              ACCOUNTS
            </div>
          </div>

          <div className="accounts-keyboard">

            <div className="keyboard-item">
              <kbd>F4</kbd>
              <span>Groups</span>
            </div>

            <div className="keyboard-item">
              <kbd>F5</kbd>
              <span>Ledgers</span>
            </div>

            <div className="keyboard-item">
              <kbd>F6</kbd>
              <span>Voucher</span>
            </div>

            <div className="keyboard-item">
              <kbd>F7</kbd>
              <span>Register</span>
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
              <span>Clear</span>
            </div>

          </div>
        </div>
      </header>

      <div className="accounts-sectionbar">
        <strong>ACCOUNTING</strong>

        <span>
          Groups • Ledgers • Voucher Entry • Voucher Register
        </span>
      </div>

      <main className="accounts-content">
        <Accounting />
      </main>

    </div>
  );
}
