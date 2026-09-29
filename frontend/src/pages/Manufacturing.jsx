```jsx
import React, { useEffect, useMemo, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

const emptyJob = {
  jobNo: "",
  date: new Date().toISOString().slice(0, 10),
  type: "Finished Goods",
  customerName: "",
  location: "",
  sourceItemId: "",
  sourceItemName: "",
  sourceQty: "",
  sourceUnit: "",
  outputItemId: "",
  outputItemName: "",
  outputQty: "",
  outputUnit: "",
  wastageQty: "",
  remarks: "",
};

export default function Manufacturing() {
  const [items, setItems] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(emptyJob);
  const [loading, setLoading] = useState(false);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [error, setError] = useState("");

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    "";

  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
    [token]
  );

  // ---------------------------------------------------------
  // LOAD INVENTORY MASTER ITEMS
  // ---------------------------------------------------------
  const loadItems = async () => {
    try {
      setItemsLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/inventory/items`, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(`Unable to load inventory items (${response.status})`);
      }

      const data = await response.json();

      // Supports:
      // {items: []}
      // {data: []}
      // []
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
        ? data.data
        : [];

      setItems(list);
    } catch (err) {
      console.error("Inventory items loading error:", err);
      setError(
        "Inventory Master items load হচ্ছে না. API endpoint/check করুন."
      );
      setItems([]);
    } finally {
      setItemsLoading(false);
    }
  };

  // ---------------------------------------------------------
  // LOAD JOB ORDERS
  // ---------------------------------------------------------
  const loadJobs = async () => {
    try {
      const response = await fetch(`${API_URL}/api/inventory/jobs`, {
        method: "GET",
        headers,
      });

      if (!response.ok) return;

      const data = await response.json();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.jobs)
        ? data.jobs
        : Array.isArray(data.data)
        ? data.data
        : [];

      setJobs(list);
    } catch (err) {
      console.error("Job orders loading error:", err);
    }
  };

  useEffect(() => {
    loadItems();
    loadJobs();
  }, []);

  // ---------------------------------------------------------
  // NORMALIZE ITEM DATA
  // ---------------------------------------------------------
  const getItemId = (item) =>
    item._id ||
    item.id ||
    item.itemId ||
    item.productId ||
    item.stockItemId ||
    "";

  const getItemName = (item) =>
    item.name ||
    item.itemName ||
    item.productName ||
    item.stockItemName ||
    item.product ||
    "";

  const getItemCode = (item) =>
    item.code ||
    item.itemCode ||
    item.productCode ||
    item.stockCode ||
    "";

  const getItemUnit = (item) =>
    item.unit ||
    item.unitName ||
    item.stockUnit ||
    "PCS";

  // Remove duplicate products
  const uniqueItems = useMemo(() => {
    const map = new Map();

    items.forEach((item) => {
      const id = String(getItemId(item));

      if (!id) return;

      if (!map.has(id)) {
        map.set(id, item);
      }
    });

    return Array.from(map.values());
  }, [items]);

  // ---------------------------------------------------------
  // HANDLE FORM
  // ---------------------------------------------------------
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // ---------------------------------------------------------
  // SOURCE ITEM SELECT
  // SOURCE STOCK WILL DECREASE
  // ---------------------------------------------------------
  const handleSourceItemChange = (e) => {
    const id = e.target.value;

    const item = uniqueItems.find(
      (x) => String(getItemId(x)) === String(id)
    );

    if (!item) {
      setForm((prev) => ({
        ...prev,
        sourceItemId: "",
        sourceItemName: "",
        sourceUnit: "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      sourceItemId: getItemId(item),
      sourceItemName: getItemName(item),
      sourceUnit: getItemUnit(item),
    }));
  };

  // ---------------------------------------------------------
  // OUTPUT ITEM SELECT
  // OUTPUT STOCK WILL INCREASE
  // ---------------------------------------------------------
  const handleOutputItemChange = (e) => {
    const id = e.target.value;

    const item = uniqueItems.find(
      (x) => String(getItemId(x)) === String(id)
    );

    if (!item) {
      setForm((prev) => ({
        ...prev,
        outputItemId: "",
        outputItemName: "",
        outputUnit: "",
      }));
      return;
    }

    setForm((prev) => ({
      ...prev,
      outputItemId: getItemId(item),
      outputItemName: getItemName(item),
      outputUnit: getItemUnit(item),
    }));
  };

  // ---------------------------------------------------------
  // RESET
  // ---------------------------------------------------------
  const resetForm = () => {
    setForm({
      ...emptyJob,
      jobNo: `JOB-${new Date().getFullYear()}-${String(
        jobs.length + 1
      ).padStart(5, "0")}`,
      date: new Date().toISOString().slice(0, 10),
    });
  };

  // ---------------------------------------------------------
  // SAVE JOB ORDER
  // ---------------------------------------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");

    if (!form.sourceItemId) {
      setError("Source Stock-এর Item Name select করুন.");
      return;
    }

    if (!form.outputItemId) {
      setError("Output Stock-এর Item Name select করুন.");
      return;
    }

    if (!form.sourceQty || Number(form.sourceQty) <= 0) {
      setError("Source Stock quantity দিন.");
      return;
    }

    if (!form.outputQty || Number(form.outputQty) <= 0) {
      setError("Output Stock quantity দিন.");
      return;
    }

    const payload = {
      jobNo: form.jobNo,
      date: form.date,
      type: form.type,

      customerName: form.customerName,
      location: form.location,

      // SOURCE
      sourceItemId: form.sourceItemId,
      sourceItemName: form.sourceItemName,
      sourceQty: Number(form.sourceQty),
      sourceUnit: form.sourceUnit,

      // OUTPUT
      outputItemId: form.outputItemId,
      outputItemName: form.outputItemName,
      outputQty: Number(form.outputQty),
      outputUnit: form.outputUnit,

      wastageQty: Number(form.wastageQty || 0),

      remarks: form.remarks,
    };

    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/inventory/jobs`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Job Order save failed"
        );
      }

      await loadJobs();

      resetForm();

      alert(
        "Job Order saved successfully.\n\n" +
          `Source Stock: ${form.sourceItemName} (-${form.sourceQty} ${form.sourceUnit})\n` +
          `Output Stock: ${form.outputItemName} (+${form.outputQty} ${form.outputUnit})`
      );
    } catch (err) {
      console.error("Job Order save error:", err);
      setError(err.message || "Job Order save failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: 24,
        background: "#f5f7fb",
        minHeight: "100%",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          background: "#111827",
          color: "#fff",
          padding: "18px 22px",
          borderRadius: 12,
          marginBottom: 20,
        }}
      >
        <div
          style={{
            fontSize: 12,
            opacity: 0.7,
            marginBottom: 5,
            letterSpacing: 1,
          }}
        >
          INVENTORY / MANUFACTURING
        </div>

        <h2 style={{ margin: 0 }}>Job Order</h2>

        <div
          style={{
            marginTop: 5,
            opacity: 0.75,
            fontSize: 13,
          }}
        >
          Source Stock → Decrease &nbsp; | &nbsp; Output Stock → Increase
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "12px 15px",
            borderRadius: 8,
            marginBottom: 15,
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* BASIC */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            marginBottom: 18,
            border: "1px solid #e5e7eb",
          }}
        >
          <h3 style={{ marginTop: 0 }}>Job Order Details</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 15,
            }}
          >
            <Field
              label="Job No."
              name="jobNo"
              value={form.jobNo}
              onChange={handleChange}
              placeholder="Auto"
            />

            <Field
              label="Date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
            />

            <div>
              <label className="field-label">Job Type</label>

              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                className="field-input"
              >
                <option value="Finished Goods">Finished Goods</option>
                <option value="Grading">Grading</option>
                <option value="Packing">Packing</option>
                <option value="Production">Production</option>
              </select>
            </div>

            <Field
              label="Customer"
              name="customerName"
              value={form.customerName}
              onChange={handleChange}
              placeholder="Customer / Party"
            />
          </div>
        </div>

        {/* STOCK MAPPING */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 18,
            marginBottom: 18,
          }}
        >
          {/* SOURCE */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              border: "1px solid #fecaca",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 15,
              }}
            >
              <h3 style={{ margin: 0 }}>Source Stock</h3>

              <span
                style={{
                  background: "#fee2e2",
                  color: "#b91c1c",
                  padding: "5px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                WILL DECREASE
              </span>
            </div>

            <label className="field-label">
              Item Name <span style={{ color: "red" }}>*</span>
            </label>

            <select
              value={form.sourceItemId}
              onChange={handleSourceItemChange}
              className="field-input"
              disabled={itemsLoading}
            >
              <option value="">
                {itemsLoading
                  ? "Loading Inventory Items..."
                  : uniqueItems.length
                  ? "Select Source Item"
                  : "No Inventory Item Found"}
              </option>

              {uniqueItems.map((item) => {
                const id = getItemId(item);
                const name = getItemName(item);
                const code = getItemCode(item);

                return (
                  <option key={id} value={id}>
                    {name}
                    {code ? ` — ${code}` : ""}
                  </option>
                );
              })}
            </select>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 15,
              }}
            >
              <Field
                label="Quantity"
                name="sourceQty"
                type="number"
                value={form.sourceQty}
                onChange={handleChange}
                placeholder="0"
              />

              <Field
                label="Unit"
                name="sourceUnit"
                value={form.sourceUnit}
                onChange={handleChange}
                readOnly
              />
            </div>

            {form.sourceItemName && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "#fff7ed",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                Selected Source:
                <strong> {form.sourceItemName}</strong>
                <br />
                Stock movement:
                <strong> -{form.sourceQty || 0}</strong>{" "}
                {form.sourceUnit}
              </div>
            )}
          </div>

          {/* OUTPUT */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 20,
              border: "1px solid #bbf7d0",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 15,
              }}
            >
              <h3 style={{ margin: 0 }}>Output Stock</h3>

              <span
                style={{
                  background: "#dcfce7",
                  color: "#15803d",
                  padding: "5px 10px",
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                WILL INCREASE
              </span>
            </div>

            <label className="field-label">
              Item Name <span style={{ color: "red" }}>*</span>
            </label>

            <select
              value={form.outputItemId}
              onChange={handleOutputItemChange}
              className="field-input"
              disabled={itemsLoading}
            >
              <option value="">
                {itemsLoading
                  ? "Loading Inventory Items..."
                  : uniqueItems.length
                  ? "Select Finished Goods"
                  : "No Inventory Item Found"}
              </option>

              {uniqueItems.map((item) => {
                const id = getItemId(item);
                const name = getItemName(item);
                const code = getItemCode(item);

                return (
                  <option key={id} value={id}>
                    {name}
                    {code ? ` — ${code}` : ""}
                  </option>
                );
              })}
            </select>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginTop: 15,
              }}
            >
              <Field
                label="Quantity"
                name="outputQty"
                type="number"
                value={form.outputQty}
                onChange={handleChange}
                placeholder="0"
              />

              <Field
                label="Unit"
                name="outputUnit"
                value={form.outputUnit}
                onChange={handleChange}
                readOnly
              />
            </div>

            {form.outputItemName && (
              <div
                style={{
                  marginTop: 12,
                  padding: 10,
                  background: "#f0fdf4",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                Selected Output:
                <strong> {form.outputItemName}</strong>
                <br />
                Stock movement:
                <strong> +{form.outputQty || 0}</strong>{" "}
                {form.outputUnit}
              </div>
            )}
          </div>
        </div>

        {/* OTHER DETAILS */}
        <div
          style={{
            background: "#fff",
            borderRadius: 12,
            padding: 20,
            border: "1px solid #e5e7eb",
            marginBottom: 18,
          }}
        >
          <h3 style={{ marginTop: 0 }}>Other Details</h3>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 15,
            }}
          >
            <Field
              label="Location"
              name="location"
              value={form.location}
              onChange={handleChange}
              placeholder="Select / enter location"
            />

            <Field
              label="Wastage Qty"
              name="wastageQty"
              type="number"
              value={form.wastageQty}
              onChange={handleChange}
              placeholder="0"
            />
          </div>

          <div style={{ marginTop: 15 }}>
            <label className="field-label">Remarks</label>

            <textarea
              name="remarks"
              value={form.remarks}
              onChange={handleChange}
              className="field-input"
              rows={3}
              placeholder="Remarks / production note"
            />
          </div>
        </div>

        {/* BUTTONS */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={resetForm}
            style={{
              padding: "11px 20px",
              border: "1px solid #d1d5db",
              background: "#fff",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Clear
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "11px 25px",
              border: 0,
              background: "#111827",
              color: "#fff",
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 600,
            }}
          >
            {loading ? "Saving..." : "Save Job Order"}
          </button>
        </div>
      </form>

      {/* JOB ORDER LIST */}
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: 20,
          marginTop: 25,
          border: "1px solid #e5e7eb",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Recent Job Orders</h3>

        {jobs.length === 0 ? (
          <div style={{ color: "#6b7280", padding: 15 }}>
            No Job Orders found.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr>
                  <th className="table-head">Job No.</th>
                  <th className="table-head">Date</th>
                  <th className="table-head">Source Stock</th>
                  <th className="table-head">Source Qty</th>
                  <th className="table-head">Output Stock</th>
                  <th className="table-head">Output Qty</th>
                  <th className="table-head">Type</th>
                </tr>
              </thead>

              <tbody>
                {jobs.map((job, index) => (
                  <tr key={job._id || job.id || index}>
                    <td className="table-cell">
                      {job.jobNo || job.jobNumber || "-"}
                    </td>

                    <td className="table-cell">
                      {job.date
                        ? String(job.date).slice(0, 10)
                        : "-"}
                    </td>

                    <td className="table-cell">
                      {job.sourceItemName ||
                        job.sourceStock ||
                        "-"}
                    </td>

                    <td className="table-cell">
                      {job.sourceQty || 0}{" "}
                      {job.sourceUnit || ""}
                    </td>

                    <td className="table-cell">
                      {job.outputItemName ||
                        job.outputStock ||
                        "-"}
                    </td>

                    <td className="table-cell">
                      {job.outputQty || 0}{" "}
                      {job.outputUnit || ""}
                    </td>

                    <td className="table-cell">
                      {job.type || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .field-label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 6px;
        }

        .field-input {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid #d1d5db;
          border-radius: 7px;
          padding: 10px 11px;
          background: #fff;
          color: #111827;
          outline: none;
          font-size: 14px;
        }

        .field-input:focus {
          border-color: #111827;
          box-shadow: 0 0 0 2px rgba(17, 24, 39, 0.08);
        }

        .table-head {
          text-align: left;
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
          white-space: nowrap;
        }

        .table-cell {
          padding: 10px;
          border-bottom: 1px solid #f1f5f9;
          white-space: nowrap;
        }

        @media (max-width: 900px) {
          form > div,
          form > div > div {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------
// REUSABLE FIELD
// ---------------------------------------------------------
function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  readOnly = false,
}) {
  return (
    <div>
      <label className="field-label">{label}</label>

      <input
        className="field-input"
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        readOnly={readOnly}
      />
    </div>
  );
}
```
