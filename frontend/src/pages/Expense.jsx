```jsx
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

const emptyForm = {
  date: new Date().toISOString().split("T")[0],
  natureOfExpense: "",
  amount: "",
  gpayNo: "",
  payeeName: "",
  billNo: "",
  description: "",
  remark: "",
};

export default function Expense() {
  const [form, setForm] = useState(emptyForm);

  const [expenses, setExpenses] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [duplicate, setDuplicate] = useState(null);
  const [showDuplicate, setShowDuplicate] = useState(false);

  const fileInputRef = useRef(null);

  // ==========================================
  // GET TOKEN
  // ==========================================

  const getToken = () => {
    return localStorage.getItem("token");
  };

  // ==========================================
  // AXIOS CONFIG
  // ==========================================

  const getConfig = () => {
    const token = getToken();

    return {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    };
  };

  // ==========================================
  // FETCH EXPENSES
  // ==========================================

  const fetchExpenses = async () => {
    try {
      setFetching(true);
      setError("");

      const response = await axios.get(
        `${API_URL}/api/expenses`,
        getConfig()
      );

      if (response.data?.success) {
        setExpenses(response.data.expenses || []);
      }
    } catch (err) {
      console.error("FETCH EXPENSE ERROR:", err);

      if (err.response?.status === 401) {
        setError("Session expired. Please login again.");
      } else {
        setError(
          err.response?.data?.message ||
            "Unable to load expenses."
        );
      }
    } finally {
      setFetching(false);
    }
  };

  // ==========================================
  // LOAD EXPENSES
  // ==========================================

  useEffect(() => {
    fetchExpenses();
  }, []);

  // ==========================================
  // FORM CHANGE
  // ==========================================

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ==========================================
  // FILE SELECT
  // ==========================================

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please upload JPG, PNG, WEBP or PDF file."
      );

      e.target.value = "";
      return;
    }

    const maxSize = 10 * 1024 * 1024;

    if (file.size > maxSize) {
      setError("Maximum file size is 10 MB.");

      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setError("");
    setMessage(
      "Bill selected. OCR scan will be connected next."
    );
  };

  // ==========================================
  // REMOVE FILE
  // ==========================================

  const removeFile = () => {
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    setMessage("");
  };

  // ==========================================
  // RESET FORM
  // ==========================================

  const resetForm = () => {
    setForm({
      ...emptyForm,
      date: new Date()
        .toISOString()
        .split("T")[0],
    });

    setSelectedFile(null);
    setDuplicate(null);
    setShowDuplicate(false);
    setMessage("");
    setError("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // ==========================================
  // SAVE EXPENSE
  // ==========================================

  const saveExpense = async (forceSave = false) => {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      if (!form.date) {
        setError("Date is required.");
        return;
      }

      if (!form.natureOfExpense.trim()) {
        setError("Nature of Expenses is required.");
        return;
      }

      if (
        form.amount === "" ||
        Number(form.amount) <= 0
      ) {
        setError("Please enter a valid amount.");
        return;
      }

      if (!form.payeeName.trim()) {
        setError("Payee Name is required.");
        return;
      }

      const payload = {
        date: form.date,

        natureOfExpense:
          form.natureOfExpense.trim(),

        amount: Number(form.amount),

        gpayNo: form.gpayNo.trim(),

        payeeName:
          form.payeeName.trim(),

        billNo:
          form.billNo.trim(),

        description:
          form.description.trim(),

        remark:
          form.remark.trim(),
      };

      // ========================================
      // SAVE TO BACKEND
      // ========================================

      const response = await axios.post(
        `${API_URL}/api/expenses`,
        payload,
        getConfig()
      );

      if (response.data?.success) {
        setMessage(
          "Expense saved successfully. Status: Pending."
        );

        resetForm();

        await fetchExpenses();

        return;
      }

      setError(
        response.data?.message ||
          "Unable to save expense."
      );
    } catch (err) {
      console.error("SAVE EXPENSE ERROR:", err);

      // ========================================
      // DUPLICATE FOUND
      // ========================================

      if (
        err.response?.status === 409 &&
        err.response?.data?.duplicate
      ) {
        setDuplicate(
          err.response.data.existingExpense
        );

        setShowDuplicate(true);

        setError(
          err.response.data.message ||
            "Possible duplicate expense found."
        );

        return;
      }

      setError(
        err.response?.data?.message ||
          "Unable to save expense."
      );
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // SAVE ANYWAY
  // ==========================================

  const saveAnyway = async () => {
    try {
      setShowDuplicate(false);

      /*
       * IMPORTANT:
       * Current backend duplicate API returns 409.
       * A dedicated "force save" endpoint should be
       * added later for Save Anyway.
       */

      setError(
        "Duplicate detected. Save Anyway API will be connected in the next backend step."
      );
    } catch (err) {
      console.error(err);
    }
  };

  // ==========================================
  // STATUS CLASS
  // ==========================================

  const getStatusClass = (status) => {
    switch (
      String(status || "").toLowerCase()
    ) {
      case "approved":
        return "status approved";

      case "rejected":
        return "status rejected";

      default:
        return "status pending";
    }
  };

  // ==========================================
  // FORMAT DATE
  // ==========================================

  const formatDate = (value) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN");
  };

  // ==========================================
  // FORMAT AMOUNT
  // ==========================================

  const formatAmount = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(Number(amount || 0));
  };

  // ==========================================
  // TOTAL
  // ==========================================

  const totalAmount = expenses.reduce(
    (total, expense) =>
      total + Number(expense.amount || 0),
    0
  );

  // ==========================================
  // APPROVE
  // ==========================================

  const approveExpense = async (id) => {
    try {
      await axios.patch(
        `${API_URL}/api/expenses/${id}/approve`,
        {},
        getConfig()
      );

      await fetchExpenses();
    } catch (err) {
      console.error(
        "APPROVE EXPENSE ERROR:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to approve expense."
      );
    }
  };

  // ==========================================
  // REJECT
  // ==========================================

  const rejectExpense = async (id) => {
    try {
      await axios.patch(
        `${API_URL}/api/expenses/${id}/reject`,
        {},
        getConfig()
      );

      await fetchExpenses();
    } catch (err) {
      console.error(
        "REJECT EXPENSE ERROR:",
        err
      );

      setError(
        err.response?.data?.message ||
          "Unable to reject expense."
      );
    }
  };

  return (
    <div className="expense-page">

      {/* =====================================
          HEADER
      ====================================== */}

      <div className="expense-header">

        <div>
          <h1>Expenses</h1>

          <p>
            Manage office expenses and payments
          </p>
        </div>

        <div className="total-card">
          <span>Total Expenses</span>

          <strong>
            {formatAmount(totalAmount)}
          </strong>
        </div>

      </div>

      {/* =====================================
          MESSAGE
      ====================================== */}

      {message && (
        <div className="alert success">
          {message}
        </div>
      )}

      {error && (
        <div className="alert error">
          {error}
        </div>
      )}

      {/* =====================================
          EXPENSE FORM
      ====================================== */}

      <div className="expense-card">

        <div className="card-title">
          <div>
            <h2>Expense Entry</h2>

            <p>
              Enter manually or upload a bill
            </p>
          </div>
        </div>

        {/* ===================================
            UPLOAD
        ==================================== */}

        <div className="upload-box">

          <div className="upload-icon">
            📄
          </div>

          <div className="upload-content">

            <strong>
              Upload Bill / Receipt
            </strong>

            <span>
              JPG, PNG, WEBP or PDF — Maximum 10 MB
            </span>

            {selectedFile && (
              <div className="selected-file">
                <span>
                  {selectedFile.name}
                </span>

                <button
                  type="button"
                  onClick={removeFile}
                >
                  Remove
                </button>
              </div>
            )}

          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf"
            onChange={handleFileChange}
            hidden
          />

          <button
            type="button"
            className="upload-button"
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            Choose File
          </button>

        </div>

        {/* ===================================
            FORM
        ==================================== */}

        <div className="form-grid">

          {/* DATE */}

          <div className="field">
            <label>
              Date <span>*</span>
            </label>

            <input
              type="date"
              name="date"
              value={form.date}
              onChange={handleChange}
            />
          </div>

          {/* NATURE */}

          <div className="field">
            <label>
              Nature of Expenses <span>*</span>
            </label>

            <input
              type="text"
              name="natureOfExpense"
              placeholder="e.g. Transportation Charges"
              value={form.natureOfExpense}
              onChange={handleChange}
            />
          </div>

          {/* AMOUNT */}

          <div className="field">
            <label>
              Amount <span>*</span>
            </label>

            <input
              type="number"
              name="amount"
              min="0"
              step="0.01"
              placeholder="₹ 0.00"
              value={form.amount}
              onChange={handleChange}
            />
          </div>

          {/* GPAY */}

          <div className="field">
            <label>G-Pay No</label>

            <input
              type="text"
              name="gpayNo"
              placeholder="G-Pay / Transaction No"
              value={form.gpayNo}
              onChange={handleChange}
            />
          </div>

          {/* PAYEE */}

          <div className="field">
            <label>
              Payee Name <span>*</span>
            </label>

            <input
              type="text"
              name="payeeName"
              placeholder="Enter payee name"
              value={form.payeeName}
              onChange={handleChange}
            />
          </div>

          {/* BILL NO */}

          <div className="field">
            <label>Bill No / Invoice No</label>

            <input
              type="text"
              name="billNo"
              placeholder="Bill / Invoice number"
              value={form.billNo}
              onChange={handleChange}
            />
          </div>

          {/* DESCRIPTION */}

          <div className="field full">
            <label>Description</label>

            <textarea
              name="description"
              rows="3"
              placeholder="Expense description"
              value={form.description}
              onChange={handleChange}
            />
          </div>

          {/* REMARK */}

          <div className="field full">
            <label>Remark</label>

            <textarea
              name="remark"
              rows="3"
              placeholder="Additional remarks"
              value={form.remark}
              onChange={handleChange}
            />
          </div>

        </div>

        {/* ===================================
            ACTIONS
        ==================================== */}

        <div className="form-actions">

          <button
            type="button"
            className="secondary-button"
            onClick={resetForm}
            disabled={loading}
          >
            Clear
          </button>

          <button
            type="button"
            className="primary-button"
            onClick={() => saveExpense(false)}
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : "Save Expense"}
          </button>

        </div>

      </div>

      {/* =====================================
          DUPLICATE WARNING
      ====================================== */}

      {showDuplicate && duplicate && (
        <div className="duplicate-overlay">

          <div className="duplicate-modal">

            <div className="warning-icon">
              ⚠
            </div>

            <h2>
              Possible Duplicate Expense
            </h2>

            <p>
              A similar expense already exists.
              Please review it before saving.
            </p>

            <div className="duplicate-details">

              <div>
                <span>Date</span>
                <strong>
                  {formatDate(duplicate.date)}
                </strong>
              </div>

              <div>
                <span>Amount</span>
                <strong>
                  {formatAmount(
                    duplicate.amount
                  )}
                </strong>
              </div>

              <div>
                <span>Payee</span>
                <strong>
                  {duplicate.payeeName || "-"}
                </strong>
              </div>

              <div>
                <span>Bill No</span>
                <strong>
                  {duplicate.billNo || "-"}
                </strong>
              </div>

            </div>

            <div className="duplicate-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setShowDuplicate(false);
                  setDuplicate(null);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="danger-button"
                onClick={saveAnyway}
              >
                Review / Save Anyway
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =====================================
          EXISTING EXPENSES
      ====================================== */}

      <div className="expense-card">

        <div className="list-header">

          <div>
            <h2>Existing Expenses</h2>

            <p>
              Previously submitted expenses
            </p>
          </div>

          <button
            type="button"
            className="refresh-button"
            onClick={fetchExpenses}
            disabled={fetching}
          >
            {fetching
              ? "Loading..."
              : "Refresh"}
          </button>

        </div>

        {fetching ? (
          <div className="empty-state">
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            No expenses found.
          </div>
        ) : (
          <div className="expense-table-wrapper">

            <table className="expense-table">

              <thead>
                <tr>
                  <th>Date</th>
                  <th>Nature</th>
                  <th>Payee</th>
                  <th>Bill No</th>
                  <th>G-Pay No</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>

                {expenses.map((expense) => (

                  <tr key={expense._id}>

                    <td>
                      {formatDate(
                        expense.date
                      )}
                    </td>

                    <td>
                      <strong>
                        {expense.natureOfExpense ||
                          "-"}
                      </strong>

                      {expense.description && (
                        <small>
                          {expense.description}
                        </small>
                      )}
                    </td>

                    <td>
                      {expense.payeeName || "-"}
                    </td>

                    <td>
                      {expense.billNo || "-"}
                    </td>

                    <td>
                      {expense.gpayNo || "-"}
                    </td>

                    <td className="amount">
                      {formatAmount(
                        expense.amount
                      )}
                    </td>

                    <td>
                      <span
                        className={getStatusClass(
                          expense.status
                        )}
                      >
                        {expense.status ||
                          "pending"}
                      </span>
                    </td>

                    <td>

                      {expense.status ===
                        "pending" && (
                        <div className="action-buttons">

                          <button
                            type="button"
                            className="approve-button"
                            onClick={() =>
                              approveExpense(
                                expense._id
                              )
                            }
                          >
                            Approve
                          </button>

                          <button
                            type="button"
                            className="reject-button"
                            onClick={() =>
                              rejectExpense(
                                expense._id
                              )
                            }
                          >
                            Reject
                          </button>

                        </div>
                      )}

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>
        )}

      </div>

      {/* =====================================
          PAGE CSS
      ====================================== */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        .expense-page {
          min-height: 100vh;
          padding: 28px;
          background: #f5f7fb;
          font-family:
            Inter,
            Arial,
            Helvetica,
            sans-serif;
          color: #172b4d;
        }

        .expense-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 20px;
          margin-bottom: 24px;
        }

        .expense-header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 800;
        }

        .expense-header p {
          margin: 6px 0 0;
          color: #667085;
          font-size: 14px;
        }

        .total-card {
          background: white;
          border-radius: 14px;
          padding: 16px 22px;
          min-width: 190px;
          box-shadow:
            0 5px 20px rgba(0, 0, 0, 0.06);
        }

        .total-card span {
          display: block;
          color: #667085;
          font-size: 12px;
        }

        .total-card strong {
          display: block;
          margin-top: 5px;
          font-size: 22px;
        }

        .alert {
          padding: 13px 16px;
          border-radius: 10px;
          margin-bottom: 18px;
          font-size: 14px;
        }

        .alert.success {
          background: #ecfdf3;
          color: #027a48;
          border: 1px solid #abefc6;
        }

        .alert.error {
          background: #fef3f2;
          color: #b42318;
          border: 1px solid #fecdca;
        }

        .expense-card {
          background: white;
          border-radius: 18px;
          padding: 24px;
          margin-bottom: 24px;
          box-shadow:
            0 6px 24px rgba(0, 0, 0, 0.06);
        }

        .card-title {
          margin-bottom: 22px;
        }

        .card-title h2,
        .list-header h2 {
          margin: 0;
          font-size: 19px;
        }

        .card-title p,
        .list-header p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 13px;
        }

        .upload-box {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px;
          margin-bottom: 24px;
          border: 1.5px dashed #b8c4d6;
          border-radius: 14px;
          background: #f8fafc;
        }

        .upload-icon {
          width: 46px;
          height: 46px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #e8f1fb;
          font-size: 22px;
        }

        .upload-content {
          flex: 1;
          min-width: 0;
        }

        .upload-content strong {
          display: block;
          font-size: 14px;
        }

        .upload-content > span {
          display: block;
          margin-top: 4px;
          color: #667085;
          font-size: 12px;
        }

        .selected-file {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
          font-size: 12px;
        }

        .selected-file button {
          border: none;
          background: transparent;
          color: #b42318;
          cursor: pointer;
          font-weight: 600;
        }

        .upload-button {
          border: none;
          border-radius: 9px;
          padding: 10px 15px;
          background: #172b4d;
          color: white;
          cursor: pointer;
          font-weight: 600;
        }

        .form-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .field.full {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 13px;
          font-weight: 700;
          color: #344054;
        }

        .field label span {
          color: #d92d20;
        }

        .field input,
        .field textarea {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 9px;
          padding: 11px 13px;
          outline: none;
          background: white;
          color: #101828;
          font-family: inherit;
          font-size: 14px;
          transition: 0.2s;
        }

        .field textarea {
          resize: vertical;
        }

        .field input:focus,
        .field textarea:focus {
          border-color: #245a96;
          box-shadow:
            0 0 0 3px rgba(
              36,
              90,
              150,
              0.1
            );
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .primary-button,
        .secondary-button,
        .danger-button,
        .refresh-button {
          border: none;
          border-radius: 9px;
          padding: 11px 18px;
          cursor: pointer;
          font-weight: 700;
        }

        .primary-button {
          background: #245a96;
          color: white;
        }

        .secondary-button {
          background: #eef2f6;
          color: #344054;
        }

        .danger-button {
          background: #b42318;
          color: white;
        }

        .refresh-button {
          background: #eef2f6;
          color: #344054;
        }

        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .list-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 20px;
        }

        .expense-table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        .expense-table {
          width: 100%;
          border-collapse: collapse;
          min-width: 950px;
        }

        .expense-table th {
          background: #f8fafc;
          color: #667085;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          text-align: left;
          padding: 13px;
          border-bottom: 1px solid #eaecf0;
        }

        .expense-table td {
          padding: 14px 13px;
          border-bottom: 1px solid #eaecf0;
          font-size: 13px;
          vertical-align: middle;
        }

        .expense-table td small {
          display: block;
          margin-top: 4px;
          color: #667085;
        }

        .amount {
          font-weight: 800;
          white-space: nowrap;
        }

        .status {
          display: inline-flex;
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          text-transform: capitalize;
        }

        .status.pending {
          background: #fff7ed;
          color: #c2410c;
        }

        .status.approved {
          background: #ecfdf3;
          color: #027a48;
        }

        .status.rejected {
          background: #fef3f2;
          color: #b42318;
        }

        .action-buttons {
          display: flex;
          gap: 6px;
        }

        .approve-button,
        .reject-button {
          border: none;
          border-radius: 7px;
          padding: 7px 9px;
          font-size: 11px;
          font-weight: 700;
          cursor: pointer;
        }

        .approve-button {
          background: #ecfdf3;
          color: #027a48;
        }

        .reject-button {
          background: #fef3f2;
          color: #b42318;
        }

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          color: #667085;
          font-size: 14px;
        }

        .duplicate-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
          background: rgba(16, 24, 40, 0.55);
        }

        .duplicate-modal {
          width: min(480px, 100%);
          background: white;
          border-radius: 18px;
          padding: 28px;
          box-shadow:
            0 20px 50px rgba(0, 0, 0, 0.2);
        }

        .warning-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fff7ed;
          color: #c2410c;
          font-size: 24px;
          margin-bottom: 15px;
        }

        .duplicate-modal h2 {
          margin: 0;
          font-size: 20px;
        }

        .duplicate-modal > p {
          color: #667085;
          font-size: 13px;
          line-height: 1.6;
        }

        .duplicate-details {
          display: grid;
          grid-template-columns:
            repeat(2, 1fr);
          gap: 12px;
          margin: 20px 0;
        }

        .duplicate-details div {
          padding: 12px;
          background: #f8fafc;
          border-radius: 9px;
        }

        .duplicate-details span {
          display: block;
          color: #667085;
          font-size: 11px;
        }

        .duplicate-details strong {
          display: block;
          margin-top: 4px;
          font-size: 13px;
        }

        .duplicate-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        @media (max-width: 768px) {

          .expense-page {
            padding: 16px;
          }

          .expense-header {
            align-items: stretch;
            flex-direction: column;
          }

          .total-card {
            width: 100%;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .field.full {
            grid-column: auto;
          }

          .upload-box {
            align-items: flex-start;
            flex-wrap: wrap;
          }

          .upload-content {
            width: calc(100% - 65px);
          }

          .upload-button {
            width: 100%;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .form-actions button {
            width: 100%;
          }

          .duplicate-actions {
            flex-direction: column;
          }

          .duplicate-actions button {
            width: 100%;
          }

        }

      `}</style>

    </div>
  );
}
```
