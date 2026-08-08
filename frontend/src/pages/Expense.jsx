import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

function Expense() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    natureOfExpense: "",
    amount: "",
    gpayNo: "",
    payeeName: "",
    description: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [duplicate, setDuplicate] = useState(null);
  const [successExpense, setSuccessExpense] = useState(null);

  const token = localStorage.getItem("token");

  // ==========================================
  // INPUT CHANGE
  // ==========================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    setError("");
    setMessage("");
  };

  // ==========================================
  // SAVE EXPENSE
  // ==========================================

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setMessage("");
    setDuplicate(null);
    setSuccessExpense(null);

    // Basic validation
    if (!form.date) {
      setError("Please select expense date.");
      return;
    }

    if (!form.natureOfExpense.trim()) {
      setError("Please enter nature of expense.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!form.payeeName.trim()) {
      setError("Please enter payee name.");
      return;
    }

    if (!token) {
      setError("Session expired. Please login again.");
      navigate("/login");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_URL}/api/expenses`,
        {
          date: form.date,
          natureOfExpense: form.natureOfExpense.trim(),
          amount: Number(form.amount),
          gpayNo: form.gpayNo.trim(),
          payeeName: form.payeeName.trim(),
          description: form.description.trim(),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.success) {
        setSuccessExpense(response.data.expense);

        setMessage(
          "Expense saved successfully."
        );

        setForm({
          date: new Date()
            .toISOString()
            .split("T")[0],
          natureOfExpense: "",
          amount: "",
          gpayNo: "",
          payeeName: "",
          description: "",
        });
      }
    } catch (err) {
      console.error(
        "EXPENSE SAVE ERROR:",
        err
      );

      // Duplicate detected
      if (
        err.response?.status === 409 &&
        err.response?.data?.duplicate
      ) {
        setDuplicate(
          err.response.data
        );

        setError(
          "Possible duplicate expense found."
        );

        return;
      }

      // Unauthorized
      if (err.response?.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");

        navigate("/login");

        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to save expense. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // SAVE DUPLICATE ANYWAY
  // ==========================================

  const saveAnyway = async () => {
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setDuplicate(null);

      const response = await axios.post(
        `${API_URL}/api/expenses`,
        {
          ...form,
          amount: Number(form.amount),
          forceSave: true,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data?.success) {
        setSuccessExpense(
          response.data.expense
        );

        setMessage(
          "Expense saved successfully."
        );

        setForm({
          date: new Date()
            .toISOString()
            .split("T")[0],
          natureOfExpense: "",
          amount: "",
          gpayNo: "",
          payeeName: "",
          description: "",
        });
      }
    } catch (err) {
      console.error(
        "SAVE ANYWAY ERROR:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to save expense."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // CANCEL DUPLICATE
  // ==========================================

  const cancelDuplicate = () => {
    setDuplicate(null);
    setError("");
  };

  return (
    <div className="expense-page">

      {/* ======================================
          HEADER
      ====================================== */}

      <header className="expense-header">

        <div>
          <h1>Expense Entry</h1>

          <p>
            Create and manage office expenses
          </p>
        </div>

        <button
          className="back-btn"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          ← Dashboard
        </button>

      </header>

      {/* ======================================
          CONTENT
      ====================================== */}

      <main className="expense-container">

        {/* ====================================
            FORM CARD
        ==================================== */}

        <section className="expense-card">

          <div className="card-title">

            <div>
              <h2>New Expense</h2>

              <p>
                Enter the expense details below
              </p>
            </div>

            <div className="status-badge pending">
              Pending
            </div>

          </div>

          {/* ==================================
              ALERTS
          ================================== */}

          {message && (
            <div className="success-alert">
              ✓ {message}
            </div>
          )}

          {error && !duplicate && (
            <div className="error-alert">
              ⚠ {error}
            </div>
          )}

          {/* ==================================
              DUPLICATE WARNING
          ================================== */}

          {duplicate && (
            <div className="duplicate-alert">

              <div className="duplicate-title">
                ⚠ Possible Duplicate Expense
              </div>

              <p>
                A similar expense already exists
                in the system.
              </p>

              {duplicate.existingExpense && (
                <div className="duplicate-details">

                  <div>
                    <span>Date</span>
                    <strong>
                      {
                        duplicate
                          .existingExpense
                          .date
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Amount</span>
                    <strong>
                      ₹
                      {
                        duplicate
                          .existingExpense
                          .amount
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Payee</span>
                    <strong>
                      {
                        duplicate
                          .existingExpense
                          .payeeName
                      }
                    </strong>
                  </div>

                  <div>
                    <span>Nature</span>
                    <strong>
                      {
                        duplicate
                          .existingExpense
                          .natureOfExpense
                      }
                    </strong>
                  </div>

                </div>
              )}

              <div className="similarity">

                Similarity:

                <strong>
                  {duplicate.similarity || 90}%
                </strong>

              </div>

              <div className="duplicate-actions">

                <button
                  type="button"
                  className="cancel-btn"
                  onClick={cancelDuplicate}
                  disabled={loading}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="save-anyway-btn"
                  onClick={saveAnyway}
                  disabled={loading}
                >
                  {loading
                    ? "Saving..."
                    : "Save Anyway"}
                </button>

              </div>

            </div>
          )}

          {/* ==================================
              FORM
          ================================== */}

          <form
            onSubmit={handleSubmit}
            className="expense-form"
          >

            {/* DATE */}

            <div className="form-group">

              <label htmlFor="date">
                Date
                <span>*</span>
              </label>

              <input
                id="date"
                name="date"
                type="date"
                value={form.date}
                onChange={handleChange}
                required
              />

            </div>

            {/* NATURE */}

            <div className="form-group full-width">

              <label htmlFor="natureOfExpense">
                Nature of Expenses
                <span>*</span>
              </label>

              <input
                id="natureOfExpense"
                name="natureOfExpense"
                type="text"
                placeholder="Example: Chennai Hub Transportation Charges"
                value={form.natureOfExpense}
                onChange={handleChange}
                required
              />

            </div>

            {/* AMOUNT */}

            <div className="form-group">

              <label htmlFor="amount">
                Amount
                <span>*</span>
              </label>

              <div className="amount-input">

                <span>₹</span>

                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={handleChange}
                  required
                />

              </div>

            </div>

            {/* GPAY */}

            <div className="form-group">

              <label htmlFor="gpayNo">
                G-Pay No
              </label>

              <input
                id="gpayNo"
                name="gpayNo"
                type="text"
                placeholder="Enter G-Pay / UPI reference"
                value={form.gpayNo}
                onChange={handleChange}
              />

            </div>

            {/* PAYEE */}

            <div className="form-group full-width">

              <label htmlFor="payeeName">
                Payee Name
                <span>*</span>
              </label>

              <input
                id="payeeName"
                name="payeeName"
                type="text"
                placeholder="Enter payee name"
                value={form.payeeName}
                onChange={handleChange}
                required
              />

            </div>

            {/* DESCRIPTION */}

            <div className="form-group full-width">

              <label htmlFor="description">
                Description
              </label>

              <textarea
                id="description"
                name="description"
                rows="4"
                placeholder="Add additional details..."
                value={form.description}
                onChange={handleChange}
              />

            </div>

            {/* STATUS */}

            <div className="status-section full-width">

              <div>
                <label>
                  Expense Status
                </label>

                <p>
                  New expenses require approval.
                </p>
              </div>

              <div className="status-options">

                <span className="status-badge pending">
                  Pending
                </span>

                <span className="status-badge approved">
                  Approved
                </span>

                <span className="status-badge rejected">
                  Rejected
                </span>

              </div>

            </div>

            {/* ACTIONS */}

            <div className="form-actions full-width">

              <button
                type="button"
                className="secondary-btn"
                onClick={() =>
                  navigate("/dashboard")
                }
                disabled={loading}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-btn"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : "Save Expense"}
              </button>

            </div>

          </form>

        </section>

      </main>

      {/* ======================================
          CSS
      ====================================== */}

      <style>{`
        * {
          box-sizing: border-box;
        }

        .expense-page {
          min-height: 100vh;
          background: #f5f7fb;
          color: #172b4d;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
        }

        .expense-header {
          height: 76px;
          padding: 0 32px;
          background: #ffffff;
          border-bottom: 1px solid #e4e7ec;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .expense-header h1 {
          margin: 0;
          font-size: 22px;
          font-weight: 700;
        }

        .expense-header p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 13px;
        }

        .back-btn {
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #344054;
          padding: 10px 16px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .back-btn:hover {
          background: #f9fafb;
        }

        .expense-container {
          max-width: 1100px;
          margin: 0 auto;
          padding: 32px;
        }

        .expense-card {
          background: #ffffff;
          border: 1px solid #e4e7ec;
          border-radius: 16px;
          padding: 28px;
          box-shadow:
            0 5px 20px rgba(16, 24, 40, 0.05);
        }

        .card-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 25px;
        }

        .card-title h2 {
          margin: 0;
          font-size: 19px;
        }

        .card-title p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 13px;
        }

        .expense-form {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .form-group label,
        .status-section label {
          font-size: 13px;
          font-weight: 600;
          color: #344054;
        }

        .form-group label span {
          color: #d92d20;
          margin-left: 3px;
        }

        .form-group input,
        .form-group textarea {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          padding: 12px 13px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          color: #101828;
          font-family: inherit;
          transition: 0.2s;
        }

        .form-group textarea {
          resize: vertical;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          border-color: #245a96;
          box-shadow:
            0 0 0 3px rgba(36, 90, 150, 0.1);
        }

        .amount-input {
          display: flex;
          align-items: center;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          overflow: hidden;
        }

        .amount-input span {
          padding-left: 13px;
          font-weight: 700;
          color: #475467;
        }

        .amount-input input {
          border: none;
          box-shadow: none;
        }

        .amount-input input:focus {
          box-shadow: none;
        }

        .status-section {
          border-top: 1px solid #eaecf0;
          border-bottom: 1px solid #eaecf0;
          padding: 20px 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
        }

        .status-section p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 12px;
        }

        .status-options {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 11px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .pending {
          color: #9a6700;
          background: #fff7d6;
        }

        .approved {
          color: #027a48;
          background: #ecfdf3;
        }

        .rejected {
          color: #b42318;
          background: #fef3f2;
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .primary-btn,
        .secondary-btn {
          border-radius: 9px;
          padding: 11px 20px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }

        .primary-btn {
          border: none;
          background: #245a96;
          color: #ffffff;
        }

        .primary-btn:hover {
          background: #174579;
        }

        .primary-btn:disabled,
        .secondary-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary-btn {
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #344054;
        }

        .success-alert,
        .error-alert,
        .duplicate-alert {
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 20px;
          font-size: 13px;
        }

        .success-alert {
          background: #ecfdf3;
          color: #027a48;
          border: 1px solid #abefc6;
        }

        .error-alert {
          background: #fef3f2;
          color: #b42318;
          border: 1px solid #fecdca;
        }

        .duplicate-alert {
          background: #fffbeb;
          border: 1px solid #fedf89;
          color: #7a4d00;
        }

        .duplicate-title {
          font-size: 15px;
          font-weight: 700;
        }

        .duplicate-alert p {
          margin: 6px 0 15px;
          font-size: 13px;
        }

        .duplicate-details {
          display: grid;
          grid-template-columns:
            repeat(4, 1fr);
          gap: 10px;
          background: #ffffff;
          border-radius: 9px;
          padding: 14px;
        }

        .duplicate-details div {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .duplicate-details span {
          font-size: 11px;
          color: #667085;
        }

        .duplicate-details strong {
          font-size: 13px;
          color: #344054;
        }

        .similarity {
          margin-top: 12px;
          font-size: 13px;
        }

        .similarity strong {
          margin-left: 5px;
        }

        .duplicate-actions {
          margin-top: 15px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .cancel-btn,
        .save-anyway-btn {
          padding: 9px 15px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .cancel-btn {
          border: 1px solid #d0d5dd;
          background: #ffffff;
        }

        .save-anyway-btn {
          border: none;
          background: #245a96;
          color: #ffffff;
        }

        @media (max-width: 700px) {

          .expense-header {
            padding: 0 16px;
          }

          .expense-header h1 {
            font-size: 18px;
          }

          .expense-container {
            padding: 18px;
          }

          .expense-card {
            padding: 20px;
          }

          .expense-form {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .card-title {
            align-items: flex-start;
            gap: 15px;
          }

          .status-section {
            flex-direction: column;
            align-items: flex-start;
          }

          .duplicate-details {
            grid-template-columns: 1fr 1fr;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .primary-btn,
          .secondary-btn {
            width: 100%;
          }

        }
      `}</style>
    </div>
  );
}

export default Expense;
