import React, { useEffect, useRef, useState } from "react";

/* =========================================================
   API CONFIGURATION
========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";


/* =========================================================
   AUTH
========================================================= */

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

/* =========================================================
   TODAY
========================================================= */

function getToday() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/* =========================================================
   INITIAL FORM
========================================================= */

const initialForm = {
  date: getToday(),
  natureOfExpense: "",
  amount: "",
  gpayNo: "",
  payeeName: "",
  billNo: "",
  description: "",
};

/* =========================================================
   COMPONENT
========================================================= */

export default function Expense() {
  const [form, setForm] = useState(initialForm);

  const [expenses, setExpenses] = useState([]);

  const [loading, setLoading] = useState(false);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /* Duplicate */
  const [duplicateExpense, setDuplicateExpense] = useState(null);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [savingAnyway, setSavingAnyway] = useState(false);

  /* Upload / Scan */
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  /* =========================================================
     LOAD
  ========================================================= */

  useEffect(() => {
    loadExpenses();
  }, []);

  /* =========================================================
     CLEAN PREVIEW
  ========================================================= */

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  /* =========================================================
     LOAD EXPENSES
  ========================================================= */

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
          data.message ||
            "Unable to load expenses."
        );
      }

      setExpenses(data.expenses || []);
    } catch (err) {
      console.error(err);

      setError(
        err.message ||
          "Unable to load expenses."
      );
    } finally {
      setLoadingExpenses(false);
    }
  }

  /* =========================================================
     FORM CHANGE
  ========================================================= */

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    setError("");
    setMessage("");
  }

  /* =========================================================
     RESET FORM
  ========================================================= */

  function resetForm() {
    setForm({
      ...initialForm,
      date: getToday(),
    });

    setDuplicateExpense(null);
    setShowDuplicate(false);

    clearSelectedFile();

    setError("");
    setMessage("");
  }

  /* =========================================================
     CLEAR FILE
  ========================================================= */

  function clearSelectedFile() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(null);
    setPreviewUrl("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (cameraInputRef.current) {
      cameraInputRef.current.value = "";
    }
  }

  /* =========================================================
     OPEN UPLOAD
  ========================================================= */

  function openUploadModal() {
    setShowUploadModal(true);
    setError("");
    setMessage("");
  }

  /* =========================================================
     CLOSE UPLOAD
  ========================================================= */

  function closeUploadModal() {
    if (!ocrLoading) {
      setShowUploadModal(false);
    }
  }

  /* =========================================================
     FILE SELECT
  ========================================================= */

  function handleFileSelect(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    /*
      Tesseract API currently processes image files.
      PDF is intentionally disabled.
    */

    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/bmp",
      "image/tiff",
    ];

    if (!allowedTypes.includes(file.type)) {
      setError(
        "Please select JPG, PNG, WEBP, BMP or TIFF image."
      );

      event.target.value = "";
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(
        "File size must be less than 10 MB."
      );

      event.target.value = "";
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      setPreviewUrl(
        URL.createObjectURL(file)
      );
    } else {
      setPreviewUrl("");
    }

    setError("");
    setMessage("");
  }

  /* =========================================================
     CAMERA
  ========================================================= */

  function openCamera() {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  }

  /* =========================================================
     FILE PICKER
  ========================================================= */

  function openFilePicker() {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  /* =========================================================
     TESSERACT OCR
  ========================================================= */

  async function useUploadedBill() {
    if (!selectedFile) {
      setError("Please select a bill or invoice first.");
      return;
    }

    if (!selectedFile.type.startsWith("image/")) {
      setError("Please select a JPG, PNG, WEBP, BMP or TIFF image.");
      return;
    }

    const token = localStorage.getItem("token");

    if (!token) {
      setError("Your session has expired. Please login again.");
      return;
    }

    try {
      setOcrLoading(true);
      setError("");
      setMessage("");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        API_URL.replace(/\/$/, "") + "/api/ocr",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
          },
          body: formData,
        }
      );

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("OCR server returned an invalid response.");
      }

      if (response.status === 401) {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        throw new Error("Your session has expired. Please login again.");
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || data.error || "OCR processing failed."
        );
      }

      const extractedText = String(data.text || "").trim();
      const lines = Array.isArray(data.lines) ? data.lines : [];

      if (!extractedText && !lines.length) {
        throw new Error("No readable text was found in this image.");
      }

      const ocrFields = data.fields && typeof data.fields === "object"
        ? data.fields
        : {};

      setForm((previous) => ({
        ...previous,
        amount: ocrFields.amount || previous.amount,
        date: normalizeOcrDate(ocrFields.date) || previous.date,
        payeeName: ocrFields.payeeName || previous.payeeName,
        billNo: ocrFields.billNo || previous.billNo,
        description: extractedText
          ? extractedText.slice(0, 2000)
          : previous.description,
      }));

      setMessage(
        `Bill scanned successfully${data.confidence != null ? ` (${Number(data.confidence).toFixed(0)}% confidence)` : ""}. Please review the extracted values before saving.`
      );

      setShowUploadModal(false);
      setSelectedFile(null);
      setPreviewUrl("");
    } catch (err) {
      console.error("OCR ERROR:", err);
      setError(err.message || "Unable to scan the bill.");
    } finally {
      setOcrLoading(false);
    }
  }

  function normalizeOcrDate(value) {
    if (!value) return "";

    const raw = String(value).trim();

    let match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) {
      const [, dd, mm, yyyy] = match;
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }

    match = raw.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (match) {
      const [, yyyy, mm, dd] = match;
      return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }

    return "";
  }

  /* =========================================================
     SAVE EXPENSE
  ========================================================= */

  async function saveExpense(
    forceSave = false
  ) {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const response =
        await fetch(
          API_URL +
            "/api/expenses",
          {
            method: "POST",
            headers: getAuthHeaders(),

            body: JSON.stringify({
              ...form,
              forceSave,
            }),
          }
        );

      const data =
        await response.json();

      if (
        response.status === 409 &&
        data.duplicate
      ) {
        setDuplicateExpense(
          data.existingExpense ||
            null
        );

        setShowDuplicate(true);
        setSavingAnyway(false);

        return;
      }

      if (!response.ok) {
        throw new Error(
          data.message ||
            "Unable to save expense."
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
        err.message ||
          "Unable to save expense."
      );
    } finally {
      setLoading(false);
    }
  }

  /* =========================================================
     SUBMIT
  ========================================================= */

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.date) {
      setError(
        "Please select expense date."
      );
      return;
    }

    if (
      !form.natureOfExpense.trim()
    ) {
      setError(
        "Please enter nature of expense."
      );
      return;
    }

    if (
      !form.amount ||
      Number(form.amount) <= 0
    ) {
      setError(
        "Please enter a valid amount."
      );
      return;
    }

    if (!form.payeeName.trim()) {
      setError(
        "Please enter payee name."
      );
      return;
    }

    await saveExpense(false);
  }

  /* =========================================================
     DUPLICATE SAVE
  ========================================================= */

  async function saveDuplicateAnyway() {
    try {
      setSavingAnyway(true);

      await saveExpense(true);
    } finally {
      setSavingAnyway(false);
    }
  }

  /* =========================================================
     STATUS
  ========================================================= */

  async function updateStatus(
    id,
    status
  ) {
    try {
      setError("");
      setMessage("");

      const endpoint =
        API_URL +
        "/api/expenses/" +
        id +
        "/" +
        status;

      const response =
        await fetch(
          endpoint,
          {
            method: "PATCH",
            headers:
              getAuthHeaders(),
          }
        );

      const data =
        await response.json();

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

  /* =========================================================
     DELETE
  ========================================================= */

  async function deleteExpense(id) {
    const confirmed =
      window.confirm(
        "Are you sure you want to delete this expense?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setMessage("");

      const response =
        await fetch(
          API_URL +
            "/api/expenses/" +
            id,
          {
            method: "DELETE",
            headers:
              getAuthHeaders(),
          }
        );

      const data =
        await response.json();

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

  /* =========================================================
     FORMAT DATE
  ========================================================= */

  function formatDate(value) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      "en-IN"
    );
  }

  /* =========================================================
     FORMAT AMOUNT
  ========================================================= */

  function formatAmount(value) {
    return Number(
      value || 0
    ).toLocaleString(
      "en-IN",
      {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }
    );
  }

  /* =========================================================
     STATUS CLASS
  ========================================================= */

  function statusClass(status) {
    if (
      status === "approved"
    ) {
      return "status approved";
    }

    if (
      status === "rejected"
    ) {
      return "status rejected";
    }

    return "status pending";
  }

  /* =========================================================
     SUMMARY
  ========================================================= */

  const pendingCount =
    expenses.filter(
      (item) =>
        item.status ===
        "pending"
    ).length;

  const approvedCount =
    expenses.filter(
      (item) =>
        item.status ===
        "approved"
    ).length;

  const rejectedCount =
    expenses.filter(
      (item) =>
        item.status ===
        "rejected"
    ).length;

  const totalAmount =
    expenses.reduce(
      (total, item) =>
        total +
        Number(
          item.amount || 0
        ),
      0
    );

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="expense-page">

      {/* HEADER */}

      <div className="expense-header">

        <div>
          <h1>
            Expenses
          </h1>

          <p>
            Create and manage
            office expenses
          </p>
        </div>

        <div className="header-actions">

          <button
            className="upload-button"
            type="button"
            onClick={
              openUploadModal
            }
          >
            📎 Upload / Scan Bill
          </button>

          <button
            className="refresh-button"
            type="button"
            onClick={
              loadExpenses
            }
            disabled={
              loadingExpenses
            }
          >
            {loadingExpenses
              ? "Loading..."
              : "↻ Refresh"}
          </button>

        </div>

      </div>

      {/* ALERT */}

      {message && (
        <div className="alert success">
          <span>✓</span>
          <span>
            {message}
          </span>
        </div>
      )}

      {error && (
        <div className="alert error">
          <span>!</span>
          <span>
            {error}
          </span>
        </div>
      )}

      {/* SUMMARY */}

      <div className="top-summary-grid">

        <div className="top-summary-card">
          <div className="top-summary-icon blue">
            ₹
          </div>

          <div>
            <span>
              Total Expense
            </span>

            <strong>
              {formatAmount(
                totalAmount
              )}
            </strong>
          </div>
        </div>

        <div className="top-summary-card">
          <div className="top-summary-icon orange">
            ⏳
          </div>

          <div>
            <span>
              Pending
            </span>

            <strong>
              {pendingCount}
            </strong>
          </div>
        </div>

        <div className="top-summary-card">
          <div className="top-summary-icon green">
            ✓
          </div>

          <div>
            <span>
              Approved
            </span>

            <strong>
              {approvedCount}
            </strong>
          </div>
        </div>

        <div className="top-summary-card">
          <div className="top-summary-icon red">
            ×
          </div>

          <div>
            <span>
              Rejected
            </span>

            <strong>
              {rejectedCount}
            </strong>
          </div>
        </div>

      </div>

      {/* FORM + SUMMARY */}

      <div className="expense-grid">

        {/* FORM */}

        <section className="expense-card">

          <div className="card-title-row">

            <div className="card-title">

              <div className="card-title-icon">
                ₹
              </div>

              <div>
                <h2>
                  New Expense
                </h2>

                <p>
                  Enter expense
                  details
                </p>
              </div>

            </div>

            <button
              type="button"
              className="small-upload-button"
              onClick={
                openUploadModal
              }
            >
              📷 Scan / Upload
            </button>

          </div>

          <form
            onSubmit={
              handleSubmit
            }
          >

            <div className="form-grid">

              <div className="field">

                <label>
                  Date *
                </label>

                <input
                  type="date"
                  name="date"
                  value={
                    form.date
                  }
                  onChange={
                    handleChange
                  }
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
                  onChange={
                    handleChange
                  }
                  placeholder="e.g. Transportation Charges"
                  required
                />

              </div>

              <div className="field">

                <label>
                  Amount *
                </label>

                <input
                  type="number"
                  name="amount"
                  value={
                    form.amount
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  required
                />

              </div>

              <div className="field">

                <label>
                  G-Pay / UPI No
                </label>

                <input
                  type="text"
                  name="gpayNo"
                  value={
                    form.gpayNo
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="UPI reference number"
                />

              </div>

              <div className="field">

                <label>
                  Payee Name *
                </label>

                <input
                  type="text"
                  name="payeeName"
                  value={
                    form.payeeName
                  }
                  onChange={
                    handleChange
                  }
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
                  value={
                    form.billNo
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Bill / Invoice No"
                />

              </div>

              <div className="field full-width">

                <label>
                  Description / Remark
                </label>

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Enter description or remark"
                  rows="4"
                />

              </div>

            </div>

            {selectedFile && (
              <div className="selected-file-box">

                <div className="file-icon">
                  📄
                </div>

                <div className="file-info">

                  <strong>
                    {
                      selectedFile.name
                    }
                  </strong>

                  <span>
                    {(
                      selectedFile.size /
                      1024 /
                      1024
                    ).toFixed(2)}{" "}
                    MB
                  </span>

                </div>

                <button
                  type="button"
                  className="remove-file-button"
                  onClick={
                    clearSelectedFile
                  }
                >
                  ×
                </button>

              </div>
            )}

            <div className="form-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={
                  resetForm
                }
                disabled={
                  loading ||
                  ocrLoading
                }
              >
                Clear
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={
                  loading ||
                  ocrLoading
                }
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

          <div className="summary-header">

            <div>
              <h2>
                Expense Summary
              </h2>

              <p>
                Current expense
                status
              </p>
            </div>

            <div className="summary-main-icon">
              ₹
            </div>

          </div>

          <div className="summary-item">
            <span>
              Total Entries
            </span>

            <strong>
              {expenses.length}
            </strong>
          </div>

          <div className="summary-item">
            <span>
              Pending
            </span>

            <strong className="orange-text">
              {pendingCount}
            </strong>
          </div>

          <div className="summary-item">
            <span>
              Approved
            </span>

            <strong className="green-text">
              {approvedCount}
            </strong>
          </div>

          <div className="summary-item">
            <span>
              Rejected
            </span>

            <strong className="red-text">
              {rejectedCount}
            </strong>
          </div>

          <div className="summary-total">
            <span>
              Total Amount
            </span>

            <strong>
              {formatAmount(
                totalAmount
              )}
            </strong>
          </div>

        </section>

      </div>

      {/* EXISTING EXPENSES */}

      <section className="expense-card existing-card">

        <div className="existing-header">

          <div>
            <h2>
              Existing Expenses
            </h2>

            <p>
              All expenses stored
              in MongoDB
            </p>
          </div>

          <div className="existing-actions">

            <button
              type="button"
              className="outline-upload-button"
              onClick={
                openUploadModal
              }
            >
              + Add Bill
            </button>

            <span className="count-badge">
              {expenses.length}
            </span>

          </div>

        </div>

        {loadingExpenses ? (
          <div className="empty-state">

            <div className="loading-spinner">
              ⟳
            </div>

            <p>
              Loading expenses...
            </p>

          </div>
        ) : expenses.length === 0 ? (
          <div className="empty-state">

            <div className="empty-icon">
              ₹
            </div>

            <h4>
              No expenses found
            </h4>

            <p>
              Start by adding
              your first office
              expense.
            </p>

            <button
              type="button"
              className="empty-action"
              onClick={
                openUploadModal
              }
            >
              📎 Upload / Scan
              Bill
            </button>

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
                      key={
                        expense._id
                      }
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
                                ✓ Approve
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
                                × Reject
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

      {/* UPLOAD / SCAN MODAL */}

      {showUploadModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !ocrLoading
            ) {
              closeUploadModal();
            }
          }}
        >

          <div className="upload-modal">

            {/* HEADER */}

            <div className="upload-modal-header">

              <div>

                <div className="modal-title-icon">
                  📎
                </div>

                <div>
                  <h2>
                    Upload / Scan
                    Bill
                  </h2>

                  <p>
                    Add your bill or
                    invoice
                  </p>
                </div>

              </div>

              <button
                type="button"
                className="close-modal-button"
                onClick={
                  closeUploadModal
                }
                disabled={
                  ocrLoading
                }
                aria-label="Close"
              >
                ×
              </button>

            </div>

            {/* FILE INPUT */}

            <input
              ref={
                fileInputRef
              }
              type="file"
              accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff"
              onChange={
                handleFileSelect
              }
              style={{
                display: "none",
              }}
            />

            {/* CAMERA */}

            <input
              ref={
                cameraInputRef
              }
              type="file"
              accept="image/*"
              capture="environment"
              onChange={
                handleFileSelect
              }
              style={{
                display: "none",
              }}
            />

            {!selectedFile ? (
              <div className="upload-options">

                <button
                  type="button"
                  className="upload-option"
                  onClick={
                    openFilePicker
                  }
                >

                  <div className="upload-option-icon blue">
                    📁
                  </div>

                  <div>
                    <strong>
                      Upload Bill
                    </strong>

                    <span>
                      Choose image from
                      your device
                    </span>
                  </div>

                  <b>
                    →
                  </b>

                </button>

                <button
                  type="button"
                  className="upload-option"
                  onClick={
                    openCamera
                  }
                >

                  <div className="upload-option-icon green">
                    📷
                  </div>

                  <div>
                    <strong>
                      Scan Bill
                    </strong>

                    <span>
                      Use camera to
                      capture the bill
                    </span>
                  </div>

                  <b>
                    →
                  </b>

                </button>

                <div className="upload-info">

                  <span>
                    ✓ JPG, PNG, WEBP
                  </span>

                  <span>
                    ✓ BMP / TIFF
                  </span>

                  <span>
                    ✓ Maximum 10 MB
                  </span>

                  <span>
                    ✓ Tesseract OCR
                  </span>

                </div>

              </div>
            ) : (
              <div className="file-preview-section">

                <div className="preview-header">

                  <div>
                    <strong>
                      Selected Bill
                    </strong>

                    <span>
                      Review before
                      scanning
                    </span>
                  </div>

                  <button
                    type="button"
                    className="change-file-button"
                    onClick={
                      openFilePicker
                    }
                    disabled={
                      ocrLoading
                    }
                  >
                    Change
                  </button>

                </div>

                {previewUrl && (
                  <div className="image-preview">

                    <img
                      src={
                        previewUrl
                      }
                      alt="Bill preview"
                    />

                  </div>
                )}

                <div className="selected-file-info">

                  <div>
                    <span>
                      File name
                    </span>

                    <strong>
                      {
                        selectedFile.name
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      File size
                    </span>

                    <strong>
                      {(
                        selectedFile.size /
                        1024 /
                        1024
                      ).toFixed(
                        2
                      )}{" "}
                      MB
                    </strong>
                  </div>

                  <div>
                    <span>
                      OCR Engine
                    </span>

                    <strong>
                      Tesseract
                    </strong>
                  </div>

                </div>

              </div>
            )}

            {/* FOOTER */}

            <div className="upload-modal-footer">

              <button
                type="button"
                className="secondary-button"
                onClick={
                  closeUploadModal
                }
                disabled={
                  ocrLoading
                }
              >
                Close
              </button>

              {selectedFile && (
                <button
                  type="button"
                  className="primary-button scan-button"
                  onClick={
                    useUploadedBill
                  }
                  disabled={
                    ocrLoading
                  }
                >
                  {ocrLoading ? (
                    <>
                      <span className="scan-spinner">
                        ⟳
                      </span>

                      Scanning...
                    </>
                  ) : (
                    <>
                      🔍 Scan & Fill
                      Form
                    </>
                  )}
                </button>
              )}

            </div>

          </div>

        </div>
      )}

      {/* DUPLICATE MODAL */}

      {showDuplicate && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setShowDuplicate(
                false
              );

              setDuplicateExpense(
                null
              );
            }
          }}
        >

          <div className="duplicate-modal">

            <button
              type="button"
              className="duplicate-close-button"
              onClick={() => {
                setShowDuplicate(
                  false
                );

                setDuplicateExpense(
                  null
                );
              }}
            >
              ×
            </button>

            <div className="warning-icon">
              ⚠
            </div>

            <h2>
              Possible Duplicate
              Found
            </h2>

            <p>
              A similar expense
              already exists in
              the system.
            </p>

            {duplicateExpense && (
              <div className="duplicate-details">

                <div>
                  <span>
                    Date
                  </span>

                  <strong>
                    {formatDate(
                      duplicateExpense.date
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Payee
                  </span>

                  <strong>
                    {
                      duplicateExpense.payeeName
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Amount
                  </span>

                  <strong>
                    {formatAmount(
                      duplicateExpense.amount
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Nature
                  </span>

                  <strong>
                    {
                      duplicateExpense.natureOfExpense
                    }
                  </strong>
                </div>

                <div>
                  <span>
                    Bill No
                  </span>

                  <strong>
                    {
                      duplicateExpense.billNo ||
                      "-"
                    }
                  </strong>
                </div>

              </div>
            )}

            <div className="modal-actions">

              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setShowDuplicate(
                    false
                  );

                  setDuplicateExpense(
                    null
                  );
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary-button"
                onClick={
                  saveDuplicateAnyway
                }
                disabled={
                  savingAnyway
                }
              >
                {savingAnyway
                  ? "Saving..."
                  : "Save Anyway"}
              </button>

            </div>

          </div>

        </div>
      )}

      {/* =====================================================
          CSS
      ===================================================== */}

      <style>{`

        * {
          box-sizing: border-box;
        }

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

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .upload-button,
        .refresh-button {
          padding: 11px 16px;
          border-radius: 10px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
        }

        .upload-button {
          border: 1px solid #d6e4f3;
          background: #eef5fc;
          color: #245a96;
        }

        .upload-button:hover {
          background: #e4effb;
        }

        .refresh-button {
          border: none;
          background: #eef2f6;
          color: #344054;
        }

        .alert {
          padding: 13px 15px;
          border-radius: 10px;
          margin-bottom: 18px;
          font-size: 14px;
          font-weight: 600;
          display: flex;
          gap: 10px;
          align-items: center;
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

        .top-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 20px;
        }

        .top-summary-card {
          background: #ffffff;
          border: 1px solid #e7eaf0;
          border-radius: 15px;
          padding: 17px;
          display: flex;
          align-items: center;
          gap: 13px;
          box-shadow: 0 4px 15px rgba(16, 24, 40, 0.035);
        }

        .top-summary-icon {
          width: 43px;
          height: 43px;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
        }

        .top-summary-icon.blue {
          background: #eaf2fb;
          color: #245994;
        }

        .top-summary-icon.orange {
          background: #fff3e4;
          color: #d47a18;
        }

        .top-summary-icon.green {
          background: #e6f7ed;
          color: #24864b;
        }

        .top-summary-icon.red {
          background: #fff0ef;
          color: #c8493e;
        }

        .top-summary-card span {
          display: block;
          color: #7d8798;
          font-size: 11px;
          margin-bottom: 4px;
        }

        .top-summary-card strong {
          font-size: 18px;
          color: #1c2637;
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

        .card-title-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 20px;
        }

        .card-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .card-title-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: #eaf2fb;
          color: #245994;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }

        .card-title h2,
        .summary-card h2,
        .existing-header h2 {
          margin: 0;
          font-size: 20px;
        }

        .card-title p,
        .existing-header p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 13px;
        }

        .small-upload-button {
          border: 1px solid #d6e4f3;
          background: #f5f9fe;
          color: #245a96;
          padding: 9px 12px;
          border-radius: 9px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
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
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          padding: 12px 13px;
          font-size: 14px;
          outline: none;
          background: #ffffff;
          color: #101828;
          transition: 0.2s;
          font-family: inherit;
        }

        .field textarea {
          resize: vertical;
        }

        .field input:focus,
        .field textarea:focus {
          border-color: #245a96;
          box-shadow: 0 0 0 3px rgba(36, 90, 150, 0.1);
        }

        .selected-file-box {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 18px;
          padding: 12px;
          border-radius: 11px;
          border: 1px solid #d9e7f5;
          background: #f7fbff;
        }

        .file-icon {
          width: 38px;
          height: 38px;
          border-radius: 9px;
          background: #eaf2fb;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .file-info {
          flex: 1;
          min-width: 0;
        }

        .file-info strong {
          display: block;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .file-info span {
          display: block;
          margin-top: 3px;
          color: #667085;
          font-size: 10px;
        }

        .remove-file-button {
          width: 30px;
          height: 30px;
          border: none;
          background: #fff0ef;
          color: #b42318;
          border-radius: 8px;
          cursor: pointer;
          font-size: 20px;
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
        .secondary-button {
          padding: 11px 18px;
          border-radius: 10px;
          font-weight: 700;
        }

        .primary-button {
          background: #245a96;
          color: #ffffff;
        }

        .primary-button:hover:not(:disabled) {
          background: #1d4d82;
        }

        .secondary-button {
          background: #eef2f6;
          color: #344054;
        }

        .summary-card {
          height: fit-content;
        }

        .summary-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .summary-header p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 12px;
        }

        .summary-main-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: #eaf2fb;
          color: #245994;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
        }

        .summary-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 17px 0;
          border-bottom: 1px solid #eef0f4;
        }

        .summary-item span {
          color: #667085;
          font-size: 14px;
        }

        .summary-item strong {
          font-size: 20px;
        }

        .orange-text {
          color: #d47a18;
        }

        .green-text {
          color: #24864b;
        }

        .red-text {
          color: #c8493e;
        }

        .summary-total {
          margin-top: 16px;
          padding: 15px;
          border-radius: 12px;
          background: #f5f9fe;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
        }

        .summary-total span {
          color: #667085;
          font-size: 12px;
        }

        .summary-total strong {
          color: #245994;
          font-size: 16px;
        }

        .existing-card {
          overflow: hidden;
        }

        .existing-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 15px;
          margin-bottom: 18px;
        }

        .existing-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .outline-upload-button {
          border: 1px solid #d6e4f3;
          background: #ffffff;
          color: #245a96;
          padding: 8px 11px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
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

        .empty-state {
          padding: 55px 20px;
          text-align: center;
          color: #667085;
        }

        .empty-icon {
          width: 52px;
          height: 52px;
          border-radius: 13px;
          background: #f0f5fa;
          color: #7092b4;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 21px;
          font-weight: 800;
          margin: auto;
        }

        .empty-state h4 {
          margin: 12px 0 4px;
          font-size: 13px;
          color: #475266;
        }

        .empty-state p {
          margin: 7px 0;
          color: #99a2b0;
          font-size: 11px;
        }

        .empty-action {
          margin-top: 15px;
          border: 1px solid #dbe5f0;
          background: #f7faff;
          color: #245994;
          border-radius: 7px;
          padding: 9px 13px;
          font-size: 11px;
          font-weight: 700;
        }

        .loading-spinner {
          font-size: 25px;
          color: #245994;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 5000;
          background: rgba(16, 24, 40, 0.58);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .upload-modal,
        .duplicate-modal {
          width: min(560px, 100%);
          max-height: 90vh;
          overflow-y: auto;
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 25px 70px rgba(0, 0, 0, 0.22);
        }

        .upload-modal-header {
          padding: 22px 24px;
          border-bottom: 1px solid #eef0f4;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
        }

        .upload-modal-header > div:first-child {
          display: flex;
          gap: 12px;
        }

        .modal-title-icon {
          width: 43px;
          height: 43px;
          border-radius: 11px;
          background: #eaf2fb;
          color: #245994;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .upload-modal-header h2 {
          margin: 0;
          font-size: 20px;
          color: #172033;
        }

        .upload-modal-header p {
          margin: 5px 0 0;
          color: #667085;
          font-size: 12px;
        }

        .close-modal-button,
        .duplicate-close-button {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: #f4f6f8;
          color: #667085;
          font-size: 23px;
          line-height: 1;
          cursor: pointer;
        }

        .close-modal-button:hover,
        .duplicate-close-button:hover {
          background: #fef3f2;
          color: #b42318;
        }

        .upload-options {
          padding: 24px;
        }

        .upload-option {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px;
          margin-bottom: 12px;
          border: 1px solid #e5e9ef;
          background: #ffffff;
          border-radius: 13px;
          text-align: left;
          transition: 0.2s;
        }

        .upload-option:hover {
          border-color: #c8dced;
          background: #f8fbff;
          transform: translateY(-1px);
        }

        .upload-option-icon {
          width: 45px;
          height: 45px;
          flex-shrink: 0;
          border-radius: 11px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
        }

        .upload-option-icon.blue {
          background: #eaf2fb;
          color: #245994;
        }

        .upload-option-icon.green {
          background: #e6f7ed;
          color: #24864b;
        }

        .upload-option > div:nth-child(2) {
          flex: 1;
        }

        .upload-option strong {
          display: block;
          color: #253047;
          font-size: 14px;
        }

        .upload-option span {
          display: block;
          color: #8993a5;
          font-size: 11px;
          margin-top: 4px;
        }

        .upload-option b {
          color: #9aa4b5;
          font-size: 18px;
        }

        .upload-info {
          margin-top: 20px;
          padding: 13px;
          border-radius: 10px;
          background: #f8fafc;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .upload-info span {
          color: #667085;
          font-size: 10px;
        }

        .file-preview-section {
          padding: 24px;
        }

        .preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 15px;
        }

        .preview-header strong {
          display: block;
          font-size: 14px;
        }

        .preview-header span {
          display: block;
          margin-top: 4px;
          color: #8993a5;
          font-size: 11px;
        }

        .change-file-button {
          border: 1px solid #dbe5f0;
          background: #f7faff;
          color: #245994;
          padding: 8px 11px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
        }

        .image-preview {
          width: 100%;
          height: 300px;
          border: 1px solid #e5e9ef;
          border-radius: 12px;
          overflow: hidden;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .image-preview img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }

        .selected-file-info {
          margin-top: 13px;
          padding: 12px;
          background: #f8fafc;
          border-radius: 10px;
        }

        .selected-file-info div {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          padding: 6px 0;
        }

        .selected-file-info span {
          color: #8993a5;
          font-size: 10px;
        }

        .selected-file-info strong {
          font-size: 10px;
          max-width: 65%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .upload-modal-footer {
          border-top: 1px solid #eef0f4;
          padding: 17px 24px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        }

        .scan-button {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .scan-spinner {
          display: inline-block;
          animation: spin 1s linear infinite;
          font-size: 18px;
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        .duplicate-modal {
          position: relative;
          padding: 28px;
        }

        .duplicate-close-button {
          position: absolute;
          top: 17px;
          right: 17px;
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

        @media (max-width: 1100px) {

          .top-summary-grid {
            grid-template-columns: repeat(2, 1fr);
          }

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
            flex-direction: column;
          }

          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .top-summary-grid {
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .top-summary-card {
            padding: 12px;
          }

          .top-summary-icon {
            width: 36px;
            height: 36px;
          }

          .form-grid {
            grid-template-columns: 1fr;
          }

          .full-width {
            grid-column: auto;
          }

          .card-title-row {
            flex-direction: column;
          }

          .small-upload-button {
            width: 100%;
          }

          .form-actions {
            flex-direction: column-reverse;
          }

          .form-actions button {
            width: 100%;
          }

          .existing-header {
            flex-direction: column;
          }

          .existing-actions {
            width: 100%;
            justify-content: space-between;
          }

          .upload-modal,
          .duplicate-modal {
            max-height: 94vh;
          }

          .upload-modal-header,
          .upload-options,
          .file-preview-section,
          .upload-modal-footer {
            padding-left: 17px;
            padding-right: 17px;
          }

        }

        @media (max-width: 420px) {

          .top-summary-grid {
            grid-template-columns: 1fr;
          }

          .expense-header h1 {
            font-size: 25px;
          }

          .header-actions {
            flex-direction: column;
          }

          .header-actions button {
            width: 100%;
          }

          .upload-modal-footer {
            flex-direction: column;
          }

          .upload-modal-footer button {
            width: 100%;
          }

        }

      `}</style>

    </div>
  );
}
