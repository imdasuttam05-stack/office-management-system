import React, { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

function getAuthHeaders() {
  const token = localStorage.getItem("token");

  return {
    "Content-Type": "application/json",
    ...(token
      ? {
          Authorization: "Bearer " + token,
        }
      : {}),
  };
}

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const initialForm = {
  date: getToday(),
  natureOfExpense: "",
  amount: "",
  gpayNo: "",
  payeeName: "",
  billNo: "",
  description: "",
};

export default function Expense() {
  const [form, setForm] = useState(initialForm);

  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [duplicateExpense, setDuplicateExpense] =
    useState(null);

  const [showDuplicate, setShowDuplicate] =
    useState(false);

  const [savingAnyway, setSavingAnyway] =
    useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  async function loadExpenses() {
    try {
      setLoadingExpenses(true);
      setError("");

      const response = await fetch(
        API_URL + "/api/expenses",
        {
          method: "GET",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to load expenses."
        );
      }

      setExpenses(data.expenses || []);
    } catch (err) {
      console.error(err);

      setError(
        err.message || "Unable to load expenses."
      );
    } finally {
      setLoadingExpenses(false);
    }
  }

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setMessage("");
  }

  function resetForm() {
    setForm({
      ...initialForm,
      date: getToday(),
    });

    setDuplicateExpense(null);
    setShowDuplicate(false);
  }

  async function saveExpense(forceSave = false) {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response = await fetch(
        API_URL + "/api/expenses",
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            ...form,
            forceSave,
          }),
        }
      );

      const data = await response.json();

      if (response.status === 409 && data.duplicate) {
        setDuplicateExpense(
          data.existingExpense || null
        );

        setShowDuplicate(true);
        setSavingAnyway(false);

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to save expense."
        );
      }

      setMessage(
        "Expense saved successfully."
      );

      resetForm();

      await loadExpenses();
    } catch (err) {
      console.error(err);

      setError(
        err.message || "Unable to save expense."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.date) {
      setError("Please select expense date.");
      return;
    }

    if (!form.natureOfExpense.trim()) {
      setError(
        "Please enter nature of expense."
      );
      return;
    }

    if (
      !form.amount ||
      Number(form.amount) <= 0
    ) {
      setError("Please enter a valid amount.");
      return;
    }

    if (!form.payeeName.trim()) {
      setError("Please enter payee name.");
      return;
    }

    await saveExpense(false);
  }

  async function saveDuplicateAnyway() {
    setSavingAnyway(true);

    await saveExpense(true);

    setSavingAnyway(false);
  }

  async function updateStatus(id, status) {
    try {
      setError("");
      setMessage("");

      const endpoint =
        API_URL +
        "/api/expenses/" +
        id +
        "/" +
        status;

      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to update expense."
        );
      }

      setMessage(
        "Expense " +
          status +
          " successfully."
      );

      await loadExpenses();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to update expense."
      );
    }
  }

  async function deleteExpense(id) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this expense?"
    );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const response = await fetch(
        API_URL +
          "/api/expenses/" +
          id,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to delete expense."
        );
      }

      setMessage(
        "Expense deleted successfully."
      );

      await loadExpenses();
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to delete expense."
      );
    }
  }

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-IN");
  }

  function formatAmount(value) {
    return Number(value || 0).toLocaleString(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }
    );
  }

  function statusClass(status) {
    if (status === "approved") {
      return "status approved";
    }

    if (status === "rejected") {
      return "status rejected";
    }

    return "status pending";
  }

  return (
    <div className="expense-page">

      <div className="expense-header">
        <div>
          <h1>Expenses</h1>

          <p>
            Create and manage office expenses
          </p>
        </div>

        <button
          className="refresh-button"
          type="button"
          onClick={loadExpenses}
          disabled={loadingExpenses}
        >
          {loadingExpenses
            ? "Loading..."
            : "Refresh"}
        </button>
      </div>

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

      <div className="expense-grid">

        {/* FORM */}
        <section className="expense-card">

          <div className="card-title">
            <div>
              <h2>New Expense</h2>
              <p>Enter expense details</p>
            </div>
          </div>

          <form onSubmit={handleSubmit}>

            <div className="form-grid">

              <div className="field">
                <label>Date *</label>

                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field">
                <label>
                  Nature of Expenses *
                </label>

                <input
                  type="text"
                  name="natureOfExpense"
                  value={
                    form.natureOfExpense
                  }
                  onChange={handleChange}
                  placeholder="e.g. Transportation Charges"
                  required
                />
              </div>

              <div className="field">
                <label>Amount *</label>

                <input
                  type="number"
                  name="amount"
                  value={form.amount}
                  onChange={handleChange}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="field">
                <label>G-Pay No</label>

                <input
                  type="text"
                  name="gpayNo"
                  value={form.gpayNo}
                  onChange={handleChange}
                  placeholder="G-Pay / UPI reference"
                />
              </div>

              <div className="field">
                <label>Payee Name *</label>

                <input
                  type="text"
                  name="payeeName"
                  value={form.payeeName}
                  onChange={handleChange}
                  placeholder="Enter payee name"
                  required
                />
              </div>

              <div className="field">
                <label>
                  Bill / Invoice No
                </label>

                <input
                  type="text"
                  name="billNo"
                  value={form.billNo}
                  onChange={handleChange}
                  placeholder="Bill / Invoice No"
                />
              </div>

              <div className="field full-width">
                <label>
                  Description / Remark
                </label>

                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  placeholder="Enter description or remark"
                  rows="4"
                />
              </div>

            </div>

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
                type="submit"
                className="primary-button"
                disabled={loading}
              >
                {loading
                  ? "Saving..."
                  : "Save Expense"}
              </button>

            </div>

          </form>
        </section>

        {/* SUMMARY */}
        <section className="expense-card summary-card">

          <h2>Expense Summary</h2>

          <div className="summary-item">
            <span>Total Entries</span>

            <strong>
              {expenses.length}
            </strong>
          </div>

          <div className="summary-item">
            <span>Pending</span>

            <strong>
              {
                expenses.filter(
                  (item) =>
                    item.status ===
                    "pending"
                ).length
              }
            </strong>
          </div>

          <div className="summary-item">
            <span>Approved</span>

            <strong>
              {
                expenses.filter(
                  (item) =>
                    item.status ===
                    "approved"
                ).length
              }
            </strong>
          </div>

          <div className="summary-item">
            <span>Rejected</span>

            <strong>
              {
                expenses.filter(
                  (item) =>
                    item.status ===
                    "rejected"
                ).length
              }
            </strong>
          </div>

        </section>

      </div>

      {/* EXISTING EXPENSES */}
      <section className="expense-card existing-card">

        <div className="existing-header">

          <div>
            <h2>Existing Expenses</h2>

            <p>
              All expenses stored in MongoDB
            </p>
          </div>

          <span className="count-badge">
            {expenses.length}
          </span>

        </div>

        {loadingExpenses ? (
          <div className="empty-state">
            Loading expenses...
          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">
            No expenses found.
          </div>
        ) : (
          <div className="table-wrapper">

            <table>

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

                {expenses.map(
                  (expense) => (
                    <tr
                      key={expense._id}
                    >

                      <td>
                        {formatDate(
                          expense.date
                        )}
                      </td>

                      <td>
                        <strong>
                          {
                            expense.natureOfExpense
                          }
                        </strong>

                        {expense.description && (
                          <small>
                            {
                              expense.description
                            }
                          </small>
                        )}
                      </td>

                      <td>
                        {
                          expense.payeeName
                        }
                      </td>

                      <td>
                        {expense.billNo ||
                          "-"}
                      </td>

                      <td>
                        {expense.gpayNo ||
                          "-"}
                      </td>

                      <td>
                        <strong>
                          {formatAmount(
                            expense.amount
                          )}
                        </strong>
                      </td>

                      <td>
                        <span
                          className={statusClass(
                            expense.status
                          )}
                        >
                          {expense.status ||
                            "pending"}
                        </span>
                      </td>

                      <td>

                        <div className="action-buttons">

                          {expense.status ===
                            "pending" && (
                            <>
                              <button
                                className="approve-button"
                                type="button"
                                onClick={() =>
                                  updateStatus(
                                    expense._id,
                                    "approve"
                                  )
                                }
                              >
                                Approve
                              </button>

                              <button
                                className="reject-button"
                                type="button"
                                onClick={() =>
                                  updateStatus(
                                    expense._id,
                                    "reject"
                                  )
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}

                          <button
                            className="delete-button"
                            type="button"
                            onClick={() =>
                              deleteExpense(
                                expense._id
                              )
                            }
                          >
                            Delete
                          </button>

                        </div>

                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>

      {/* DUPLICATE WARNING */}
      {showDuplicate && (
        <div className="modal-overlay">

          <div className="duplicate-modal">

            <div className="warning-icon">
              ⚠
            </div>

            <h2>
              Possible Duplicate Found
            </h2>

            <p>
              A similar expense already
              exists in the system.
            </p>

            {duplicateExpense && (
              <div className="duplicate-details">

                <div>
                  <span>Date</span>
                  <strong>
                    {formatDate(
                      duplicateExpense.date
                    )}
                  </strong>
                </div>

                <div>
                  <span>Payee</span>
                  <strong>
                    {
                      duplicateExpense.payeeName
                    }
                  </strong>
                </div>

                <div>
                  <span>Amount</span>
                  <strong>
                    {formatAmount(
                      duplicateExpense.amount
                    )}
                  </strong>
                </div>

                <div>
                  <span>Nature</span>
                  <strong>
                    {
                      duplicateExpense.natureOfExpense
                    }
                  </strong>
                </div>

                <div>
                  <span>Bill No</span>
                  <strong>
                    {duplicateExpense.billNo ||
                      "-"}
                  </strong>
                </div>

              </div>
            )}

            <div className="modal-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setShowDuplicate(false);
                  setDuplicateExpense(null);
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={saveDuplicateAnyway}
                disabled={savingAnyway}
              >
                {savingAnyway
                  ? "Saving..."
                  : "Save Anyway"}
              </button>

            </div>

          </div>

        </div>
      )}

      <style>{`
        .expense-page {
          min-height: 100vh;
          padding: 30px;
          background: #f5f7fb;
          font-family: Inter, Arial, Helvetica, sans-serif;
          color: #172b4d;
        }

        .expense-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 24px;
        }

        .expense-header h1 {
          margin: 0;
          font-size: 30px;
          font-weight: 800;
        }

        .expense-header p {
          margin: 6px 0 0;
          color: #667085;
        }

        .expense-grid {
          display: grid;
          grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
          gap: 20px;
          margin-bottom: 20px;
        }

        .expense-card {
          background: #ffffff;
          border: 1px solid #e7eaf0;
          border-radius: 18px;
          padding: 24px;
          box-shadow: 0 8px 25px rgba(16, 24, 40, 0.05);
        }

        .card-title h2,
        .summary-card h2,
        .existing-header h2 {
          margin: 0;
          font-size: 20px;
        }

        .card-title p,
        .existing-header p {
          margin: 5px 0 20px;
          color: #667085;
          font-size: 13px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 7px;
        }

        .full-width {
          grid-column: 1 / -1;
        }

        .field label {
          font-size: 13px;
          font-weight: 700;
          color: #344054;
        }

        .field input,
        .field textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          padding: 12px 13px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          color: #101828;
          transition: 0.2s;
        }

        .field textarea {
          resize: vertical;
        }

        .field input:focus,
        .field textarea:focus {
          border-color: #245a96;
          box-shadow: 0 0 0 3px rgba(36, 90, 150, 0.1);
        }

        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 22px;
        }

        button {
          border: 0;
          cursor: pointer;
          font-family: inherit;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .primary-button,
        .secondary-button,
        .refresh-button {
          padding: 11px 18px;
          border-radius: 10px;
          font-weight: 700;
        }

        .primary-button {
          background: #245a96;
          color: #ffffff;
        }

        .secondary-button,
        .refresh-button {
          background: #eef2f6;
          color: #344054;
        }

        .summary-card {
          height: fit-content;
        }

        .summary-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 17px 0;
          border-bottom: 1px solid #eef0f4;
        }

        .summary-item:last-child {
          border-bottom: 0;
        }

        .summary-item span {
          color: #667085;
          font-size: 14px;
        }

        .summary-item strong {
          font-size: 20px;
        }

        .existing-card {
          overflow: hidden;
        }

        .existing-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
        }

        .count-badge {
          min-width: 34px;
          height: 34px;
          padding: 0 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 20px;
          background: #eef4fb;
          color: #245a96;
          font-weight: 800;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 1050px;
        }

        th {
          text-align: left;
          background: #f8fafc;
          color: #667085;
          font-size: 12px;
          text-transform: uppercase;
          padding: 13px;
          border-bottom: 1px solid #e4e7ec;
        }

        td {
          padding: 14px 13px;
          border-bottom: 1px solid #eef0f4;
          font-size: 13px;
          vertical-align: middle;
        }

        td small {
          display: block;
          margin-top: 4px;
          color: #667085;
          max-width: 240px;
        }

        .status {
          display: inline-flex;
          padding: 5px 9px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 800;
          text-transform: capitalize;
        }

        .status.pending {
          background: #fff7e6;
          color: #b54708;
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
          flex-wrap: wrap;
          gap: 6px;
        }

        .approve-button,
        .reject-button,
        .delete-button {
          padding: 7px 9px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 700;
        }

        .approve-button {
          background: #ecfdf3;
          color: #027a48;
        }

        .reject-button {
          background: #fff7e6;
          color: #b54708;
        }

        .delete-button {
          background: #fef3f2;
          color: #b42318;
        }

        .alert {
          padding: 13px 15px;
          border-radius: 10px;
          margin-bottom: 18px;
          font-size: 14px;
          font-weight: 600;
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

        .empty-state {
          padding: 45px 20px;
          text-align: center;
          color: #667085;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          background: rgba(16, 24, 40, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .duplicate-modal {
          width: min(520px, 100%);
          background: #ffffff;
          border-radius: 18px;
          padding: 28px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
        }

        .warning-icon {
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: #fff7e6;
          font-size: 24px;
          margin-bottom: 15px;
        }

        .duplicate-modal h2 {
          margin: 0;
          font-size: 21px;
        }

        .duplicate-modal > p {
          color: #667085;
          font-size: 14px;
          margin: 7px 0 20px;
        }

        .duplicate-details {
          background: #f8fafc;
          border-radius: 12px;
          padding: 15px;
        }

        .duplicate-details div {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          padding: 9px 0;
          border-bottom: 1px solid #eaecf0;
          font-size: 13px;
        }

        .duplicate-details div:last-child {
          border-bottom: 0;
        }

        .duplicate-details span {
          color: #667085;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 22px;
        }

        @media (max-width: 900px) {
          .expense-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 650px) {
          .expense-page {
            padding: 16px;
          }

          .expense-header {
            align-items: flex-start;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .form-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
