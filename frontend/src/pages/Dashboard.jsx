import React, { useEffect, useState } from "react";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com"
).replace(/\/+$/, "");

function getToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  );
}

function getHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
  };
}

export default function InventoryMasters() {
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const [locationForm, setLocationForm] = useState({
    name: "",
    code: "",
    address: "",
  });

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    gstin: "",
    state: "",
    phone: "",
    address: "",
  });

  const [itemForm, setItemForm] = useState({
    name: "",
    code: "",
    itemType: "RAW_MATERIAL",
    unit: "KG",
    hsn: "",
    defaultGstRate: "",
    defaultBarcode: "",
  });

  /* =========================================================
     LOAD MASTERS
  ========================================================= */

  async function loadMasters() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/inventory/raw-material-masters`,
        {
          method: "GET",
          headers: getHeaders(),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message || "Failed to load inventory masters"
        );
      }

      setLocations(
        Array.isArray(data?.locations)
          ? data.locations
          : []
      );

      setSuppliers(
        Array.isArray(data?.suppliers)
          ? data.suppliers
          : []
      );

      setItems(
        Array.isArray(data?.items)
          ? data.items
          : []
      );
    } catch (err) {
      console.error("Inventory masters load error:", err);

      setError(
        err?.message ||
          "Failed to load inventory masters"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMasters();
  }, []);

  /* =========================================================
     CLEAR MESSAGE
  ========================================================= */

  function clearMessages() {
    setSuccess("");
    setError("");
  }

  /* =========================================================
     CREATE LOCATION
  ========================================================= */

  async function createLocation(event) {
    event.preventDefault();

    clearMessages();

    if (!locationForm.name.trim()) {
      setError("Location name is required");
      return;
    }

    try {
      setSaving("location");

      const response = await fetch(
        `${API_URL}/api/inventory/masters/locations`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: locationForm.name.trim(),
            code: locationForm.code.trim(),
            address: locationForm.address.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to create location"
        );
      }

      setSuccess(
        data?.message ||
          "Location created successfully"
      );

      setLocationForm({
        name: "",
        code: "",
        address: "",
      });

      await loadMasters();
    } catch (err) {
      console.error("Create location error:", err);

      setError(
        err?.message ||
          "Failed to create location"
      );
    } finally {
      setSaving("");
    }
  }

  /* =========================================================
     CREATE SUPPLIER
  ========================================================= */

  async function createSupplier(event) {
    event.preventDefault();

    clearMessages();

    if (!supplierForm.name.trim()) {
      setError("Supplier name is required");
      return;
    }

    try {
      setSaving("supplier");

      const response = await fetch(
        `${API_URL}/api/inventory/masters/suppliers`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: supplierForm.name.trim(),
            gstin: supplierForm.gstin.trim(),
            state: supplierForm.state.trim(),
            phone: supplierForm.phone.trim(),
            address: supplierForm.address.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to create supplier"
        );
      }

      setSuccess(
        data?.message ||
          "Supplier created successfully"
      );

      setSupplierForm({
        name: "",
        gstin: "",
        state: "",
        phone: "",
        address: "",
      });

      await loadMasters();
    } catch (err) {
      console.error("Create supplier error:", err);

      setError(
        err?.message ||
          "Failed to create supplier"
      );
    } finally {
      setSaving("");
    }
  }

  /* =========================================================
     CREATE PRODUCT / ITEM
  ========================================================= */

  async function createItem(event) {
    event.preventDefault();

    clearMessages();

    if (!itemForm.name.trim()) {
      setError("Product / Item name is required");
      return;
    }

    try {
      setSaving("item");

      const response = await fetch(
        `${API_URL}/api/inventory/masters/items`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: itemForm.name.trim(),
            code: itemForm.code.trim(),
            itemType: itemForm.itemType,
            unit: itemForm.unit.trim(),
            hsn: itemForm.hsn.trim(),
            defaultGstRate:
              itemForm.defaultGstRate === ""
                ? undefined
                : Number(itemForm.defaultGstRate),
            defaultBarcode:
              itemForm.defaultBarcode.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ||
            "Failed to create product"
        );
      }

      setSuccess(
        data?.message ||
          "Product created successfully"
      );

      setItemForm({
        name: "",
        code: "",
        itemType: "RAW_MATERIAL",
        unit: "KG",
        hsn: "",
        defaultGstRate: "",
        defaultBarcode: "",
      });

      await loadMasters();
    } catch (err) {
      console.error("Create item error:", err);

      setError(
        err?.message ||
          "Failed to create product"
      );
    } finally {
      setSaving("");
    }
  }

  /* =========================================================
     RENDER
  ========================================================= */

  return (
    <div className="inventory-masters-page">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="page-header">

        <div>
          <div className="page-kicker">
            INVENTORY
          </div>

          <h1>
            Inventory Masters
          </h1>

          <p>
            Create and manage Location, Supplier
            and Product / Item masters.
          </p>
        </div>

        <button
          type="button"
          className="refresh-btn"
          onClick={loadMasters}
          disabled={loading}
        >
          ↻ Refresh
        </button>

      </div>

      {/* =====================================================
          MESSAGES
      ===================================================== */}

      {success && (
        <div className="success-message">
          ✓ {success}
        </div>
      )}

      {error && (
        <div className="error-message">
          ⚠ {error}
        </div>
      )}

      {/* =====================================================
          MASTER CARDS
      ===================================================== */}

      <div className="master-grid">

        {/* ===================================================
            LOCATION
        =================================================== */}

        <section className="master-card">

          <div className="master-card-header">

            <div className="master-icon">
              📍
            </div>

            <div>
              <h2>
                Location / Godown
              </h2>

              <p>
                Create warehouse or godown locations.
              </p>
            </div>

          </div>

          <form onSubmit={createLocation}>

            <label>
              Location Name
              <span>*</span>
            </label>

            <input
              type="text"
              value={locationForm.name}
              onChange={(event) =>
                setLocationForm({
                  ...locationForm,
                  name: event.target.value,
                })
              }
              placeholder="Example: Kolkata Warehouse"
            />

            <label>
              Location Code
            </label>

            <input
              type="text"
              value={locationForm.code}
              onChange={(event) =>
                setLocationForm({
                  ...locationForm,
                  code: event.target.value,
                })
              }
              placeholder="Example: KOL-01"
            />

            <label>
              Address
            </label>

            <textarea
              rows="3"
              value={locationForm.address}
              onChange={(event) =>
                setLocationForm({
                  ...locationForm,
                  address: event.target.value,
                })
              }
              placeholder="Location address"
            />

            <button
              type="submit"
              className="primary-btn"
              disabled={saving === "location"}
            >
              {saving === "location"
                ? "Saving..."
                : "+ Create Location"}
            </button>

          </form>

        </section>

        {/* ===================================================
            SUPPLIER
        =================================================== */}

        <section className="master-card">

          <div className="master-card-header">

            <div className="master-icon supplier">
              🏢
            </div>

            <div>
              <h2>
                Supplier Master
              </h2>

              <p>
                Create raw material suppliers.
              </p>
            </div>

          </div>

          <form onSubmit={createSupplier}>

            <label>
              Supplier Name
              <span>*</span>
            </label>

            <input
              type="text"
              value={supplierForm.name}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  name: event.target.value,
                })
              }
              placeholder="Supplier name"
            />

            <label>
              GSTIN
            </label>

            <input
              type="text"
              value={supplierForm.gstin}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  gstin:
                    event.target.value.toUpperCase(),
                })
              }
              placeholder="GSTIN"
            />

            <label>
              State
            </label>

            <input
              type="text"
              value={supplierForm.state}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  state: event.target.value,
                })
              }
              placeholder="West Bengal"
            />

            <label>
              Phone
            </label>

            <input
              type="text"
              value={supplierForm.phone}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  phone: event.target.value,
                })
              }
              placeholder="Phone number"
            />

            <label>
              Address
            </label>

            <textarea
              rows="3"
              value={supplierForm.address}
              onChange={(event) =>
                setSupplierForm({
                  ...supplierForm,
                  address: event.target.value,
                })
              }
              placeholder="Supplier address"
            />

            <button
              type="submit"
              className="primary-btn"
              disabled={saving === "supplier"}
            >
              {saving === "supplier"
                ? "Saving..."
                : "+ Create Supplier"}
            </button>

          </form>

        </section>

        {/* ===================================================
            PRODUCT / ITEM
        =================================================== */}

        <section className="master-card">

          <div className="master-card-header">

            <div className="master-icon product">
              📦
            </div>

            <div>
              <h2>
                Product / Item Master
              </h2>

              <p>
                Create raw material, grade and
                finished goods.
              </p>
            </div>

          </div>

          <form onSubmit={createItem}>

            <label>
              Product / Item Name
              <span>*</span>
            </label>

            <input
              type="text"
              value={itemForm.name}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  name: event.target.value,
                })
              }
              placeholder="Example: Raw Rice"
            />

            <label>
              Item Code
            </label>

            <input
              type="text"
              value={itemForm.code}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  code: event.target.value,
                })
              }
              placeholder="Example: RM-001"
            />

            <label>
              Item Type
            </label>

            <select
              value={itemForm.itemType}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  itemType: event.target.value,
                })
              }
            >
              <option value="RAW_MATERIAL">
                Raw Material
              </option>

              <option value="GRADE">
                Grade
              </option>

              <option value="FINISHED_GOODS">
                Finished Goods
              </option>
            </select>

            <label>
              Unit
            </label>

            <input
              type="text"
              value={itemForm.unit}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  unit: event.target.value,
                })
              }
              placeholder="KG"
            />

            <label>
              HSN
            </label>

            <input
              type="text"
              value={itemForm.hsn}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  hsn: event.target.value,
                })
              }
              placeholder="HSN Code"
            />

            <label>
              Default GST %
            </label>

            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={itemForm.defaultGstRate}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  defaultGstRate:
                    event.target.value,
                })
              }
              placeholder="0"
            />

            <label>
              Default Barcode
            </label>

            <input
              type="text"
              value={itemForm.defaultBarcode}
              onChange={(event) =>
                setItemForm({
                  ...itemForm,
                  defaultBarcode:
                    event.target.value,
                })
              }
              placeholder="Barcode"
            />

            <button
              type="submit"
              className="primary-btn"
              disabled={saving === "item"}
            >
              {saving === "item"
                ? "Saving..."
                : "+ Create Product"}
            </button>

          </form>

        </section>

      </div>

      {/* =====================================================
          EXISTING MASTERS
      ===================================================== */}

      <section className="existing-section">

        <div className="existing-header">
          <div>
            <div className="page-kicker">
              MASTER LIST
            </div>

            <h2>
              Existing Masters
            </h2>
          </div>

          <span className="record-count">
            {locations.length +
              suppliers.length +
              items.length}{" "}
            Records
          </span>
        </div>

        {loading ? (
          <div className="empty-state">
            Loading masters...
          </div>
        ) : (
          <div className="tables-grid">

            {/* LOCATION LIST */}

            <div className="table-card">

              <h3>
                📍 Locations
              </h3>

              {locations.length === 0 ? (
                <div className="empty-state">
                  No locations created.
                </div>
              ) : (
                <div className="table-wrapper">

                  <table>

                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Code</th>
                        <th>Address</th>
                      </tr>
                    </thead>

                    <tbody>
                      {locations.map(
                        (location) => (
                          <tr
                            key={
                              location._id ||
                              location.id
                            }
                          >
                            <td>
                              {location.name ||
                                "-"}
                            </td>

                            <td>
                              {location.code ||
                                "-"}
                            </td>

                            <td>
                              {location.address ||
                                "-"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>

                  </table>

                </div>
              )}

            </div>

            {/* SUPPLIER LIST */}

            <div className="table-card">

              <h3>
                🏢 Suppliers
              </h3>

              {suppliers.length === 0 ? (
                <div className="empty-state">
                  No suppliers created.
                </div>
              ) : (
                <div className="table-wrapper">

                  <table>

                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>GSTIN</th>
                        <th>State</th>
                        <th>Phone</th>
                      </tr>
                    </thead>

                    <tbody>
                      {suppliers.map(
                        (supplier) => (
                          <tr
                            key={
                              supplier._id ||
                              supplier.id
                            }
                          >
                            <td>
                              {supplier.name ||
                                "-"}
                            </td>

                            <td>
                              {supplier.gstin ||
                                "-"}
                            </td>

                            <td>
                              {supplier.state ||
                                "-"}
                            </td>

                            <td>
                              {supplier.phone ||
                                "-"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>

                  </table>

                </div>
              )}

            </div>

            {/* PRODUCT LIST */}

            <div className="table-card table-card-full">

              <h3>
                📦 Products / Items
              </h3>

              {items.length === 0 ? (
                <div className="empty-state">
                  No products created.
                </div>
              ) : (
                <div className="table-wrapper">

                  <table>

                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Code</th>
                        <th>Type</th>
                        <th>Unit</th>
                        <th>HSN</th>
                        <th>GST %</th>
                        <th>Barcode</th>
                      </tr>
                    </thead>

                    <tbody>
                      {items.map(
                        (item) => (
                          <tr
                            key={
                              item._id ||
                              item.id
                            }
                          >
                            <td>
                              {item.name ||
                                "-"}
                            </td>

                            <td>
                              {item.code ||
                                item.itemCode ||
                                "-"}
                            </td>

                            <td>
                              {item.itemType ||
                                "-"}
                            </td>

                            <td>
                              {item.unit ||
                                "-"}
                            </td>

                            <td>
                              {item.hsn ||
                                "-"}
                            </td>

                            <td>
                              {item.defaultGstRate ??
                                item.gstRate ??
                                0}
                              %
                            </td>

                            <td>
                              {item.defaultBarcode ||
                                item.barcode ||
                                "-"}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>

                  </table>

                </div>
              )}

            </div>

          </div>
        )}

      </section>

      {/* =====================================================
          STYLES
      ===================================================== */}

      <style>{`

        * {
          box-sizing: border-box;
        }

        .inventory-masters-page {
          min-height: 100vh;
          background: #f5f7fb;
          padding: 28px;
          font-family:
            Arial,
            Helvetica,
            sans-serif;
          color: #172b4d;
        }

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 22px;
        }

        .page-kicker {
          color: #98a2b3;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 1px;
        }

        .page-header h1 {
          margin: 5px 0 4px;
          font-size: 26px;
          color: #173b68;
        }

        .page-header p {
          margin: 0;
          color: #667085;
          font-size: 12px;
        }

        .refresh-btn {
          border: 1px solid #d0d5dd;
          background: #ffffff;
          color: #245a96;
          border-radius: 9px;
          padding: 10px 15px;
          cursor: pointer;
          font-weight: 700;
        }

        .refresh-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .success-message,
        .error-message {
          border-radius: 9px;
          padding: 12px 15px;
          margin-bottom: 16px;
          font-size: 12px;
          font-weight: 600;
        }

        .success-message {
          background: #ecfdf3;
          color: #027a48;
          border: 1px solid #abefc6;
        }

        .error-message {
          background: #fef3f2;
          color: #b42318;
          border: 1px solid #fecdca;
        }

        .master-grid {
          display: grid;
          grid-template-columns:
            repeat(3, minmax(0, 1fr));
          gap: 18px;
          align-items: start;
        }

        .master-card {
          background: #ffffff;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
          padding: 20px;
          box-shadow:
            0 3px 12px
            rgba(16, 24, 40, .04);
        }

        .master-card-header {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 18px;
        }

        .master-icon {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #eef4fb;
          font-size: 19px;
        }

        .master-icon.supplier {
          background: #f2f4ff;
        }

        .master-icon.product {
          background: #ecfdf3;
        }

        .master-card h2 {
          margin: 0;
          font-size: 16px;
          color: #173b68;
        }

        .master-card-header p {
          margin: 4px 0 0;
          color: #98a2b3;
          font-size: 10px;
        }

        .master-card form {
          display: flex;
          flex-direction: column;
        }

        .master-card label {
          margin-bottom: 5px;
          color: #344054;
          font-size: 11px;
          font-weight: 700;
        }

        .master-card label span {
          color: #d92d20;
          margin-left: 3px;
        }

        .master-card input,
        .master-card select,
        .master-card textarea {
          width: 100%;
          border: 1px solid #d0d5dd;
          border-radius: 8px;
          background: #ffffff;
          color: #172b4d;
          padding: 10px 11px;
          margin-bottom: 13px;
          outline: none;
          font-size: 12px;
          font-family: inherit;
        }

        .master-card textarea {
          resize: vertical;
        }

        .master-card input:focus,
        .master-card select:focus,
        .master-card textarea:focus {
          border-color: #245a96;
          box-shadow:
            0 0 0 3px
            rgba(36, 90, 150, .08);
        }

        .primary-btn {
          width: 100%;
          border: none;
          border-radius: 9px;
          padding: 11px 14px;
          background: #245a96;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 3px;
        }

        .primary-btn:hover {
          background: #173b68;
        }

        .primary-btn:disabled {
          opacity: .65;
          cursor: not-allowed;
        }

        .existing-section {
          margin-top: 22px;
          background: #ffffff;
          border: 1px solid #e4e7ec;
          border-radius: 14px;
          padding: 20px;
        }

        .existing-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        }

        .existing-header h2 {
          margin: 4px 0 0;
          font-size: 18px;
        }

        .record-count {
          background: #eef4fb;
          color: #245a96;
          padding: 7px 11px;
          border-radius: 20px;
          font-size: 10px;
          font-weight: 700;
        }

        .tables-grid {
          display: grid;
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
          gap: 16px;
        }

        .table-card {
          border: 1px solid #eaecf0;
          border-radius: 11px;
          overflow: hidden;
          background: #ffffff;
        }

        .table-card-full {
          grid-column: 1 / -1;
        }

        .table-card h3 {
          margin: 0;
          padding: 13px 15px;
          background: #f8fafc;
          border-bottom: 1px solid #eaecf0;
          font-size: 12px;
          color: #173b68;
        }

        .table-wrapper {
          overflow-x: auto;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 520px;
        }

        th {
          background: #f8fafc;
          color: #667085;
          font-size: 10px;
          font-weight: 800;
          text-align: left;
          padding: 10px 12px;
          border-bottom: 1px solid #eaecf0;
          white-space: nowrap;
        }

        td {
          color: #344054;
          font-size: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid #f2f4f7;
          vertical-align: top;
        }

        tbody tr:last-child td {
          border-bottom: none;
        }

        .empty-state {
          padding: 25px;
          text-align: center;
          color: #98a2b3;
          font-size: 11px;
        }

        @media (max-width: 1100px) {
          .master-grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 750px) {
          .inventory-masters-page {
            padding: 16px;
          }

          .page-header {
            flex-direction: column;
          }

          .master-grid,
          .tables-grid {
            grid-template-columns: 1fr;
          }

          .table-card-full {
            grid-column: auto;
          }
        }

      `}</style>

    </div>
  );
}
