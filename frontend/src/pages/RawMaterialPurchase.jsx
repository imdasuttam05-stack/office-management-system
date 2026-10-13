import React, { useEffect, useMemo, useState } from "react";

const API_URL = (import.meta.env.VITE_API_URL || "https://office-management-system-ikx8.onrender.com").replace(/\/+$/, "");

const today = () => new Date().toISOString().slice(0, 10);

const blankLine = () => ({
  itemName: "",
  hsn: "",
  unit: "KG",
  batchNo: "",
  barcode: "",
  mfgDate: "",
  expiryDate: "",
  qty: "",
  purchaseRate: "",
  discount: "",
  gstRate: "",
  gstType: "NONE",
});

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token") || localStorage.getItem("accessToken") || ""}`,
  };
}

function money(n) {
  return Number(n || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function RawMaterialPurchase() {
  const [form, setForm] = useState({
    date: today(),
    location: "",
    supplierName: "",
    supplierGSTIN: "",
    supplierInvoiceNo: "",
    supplierInvoiceDate: "",
    transportCost: "",
    otherCost: "",
    remarks: "",
  });

  const [lines, setLines] = useState([blankLine()]);
  const [purchases, setPurchases] = useState([]);
  const [editingPurchaseId, setEditingPurchaseId] = useState("");
  const [stock, setStock] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [stockMovements, setStockMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementError, setMovementError] = useState("");

  const [masters, setMasters] = useState({
    locations: [],
    suppliers: [],
    items: [],
  });

  const [mastersLoading, setMastersLoading] = useState(false);
  const [tab, setTab] = useState("purchase");
  const [loading, setLoading] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [stockPage, setStockPage] = useState(1);

  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const [stockPagination, setStockPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
  });

  const totals = useMemo(
    () =>
      lines.reduce(
        (a, l) => {
          const gross =
            Number(l.qty || 0) * Number(l.purchaseRate || 0);

          const taxable = Math.max(
            0,
            gross - Number(l.discount || 0)
          );

          const gst =
            l.gstType === "NONE"
              ? 0
              : (taxable * Number(l.gstRate || 0)) / 100;

          const cgst =
            l.gstType === "CGST_SGST" ? gst / 2 : 0;

          const sgst =
            l.gstType === "CGST_SGST" ? gst / 2 : 0;

          const igst =
            l.gstType === "IGST" ? gst : 0;

          return {
            taxable: a.taxable + taxable,
            cgst: a.cgst + cgst,
            sgst: a.sgst + sgst,
            igst: a.igst + igst,
          };
        },
        {
          taxable: 0,
          cgst: 0,
          sgst: 0,
          igst: 0,
        }
      ),
    [lines]
  );

  const grand =
    totals.taxable +
    totals.cgst +
    totals.sgst +
    totals.igst +
    Number(form.transportCost || 0) +
    Number(form.otherCost || 0);

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    if (tab === "purchase" || tab === "list") {
      loadPurchases();
    }
  }, [tab, page]);

  useEffect(() => {
    if (tab === "stock") {
      loadStock();
    }
  }, [tab, stockPage]);

  /*
   * ============================================================
   * MASTER / DROPDOWN LOADING
   * ============================================================
   *
   * Only this part is changed for dropdown loading.
   *
   * Supports:
   *   {
   *     locations: [],
   *     suppliers: [],
   *     items: []
   *   }
   *
   * Also supports:
   *   {
   *     data: {
   *       locations: [],
   *       suppliers: [],
   *       items: []
   *     }
   *   }
   *
   * And alternate backend names:
   *   godowns
   *   companies
   *   rawMaterials
   *   raw_materials
   */

  async function loadMasters() {
    setMastersLoading(true);
    setError("");

    try {
      const r = await fetch(
        `${API_URL}/api/inventory/raw-material-masters`,
        {
          method: "GET",
          headers: headers(),
          cache: "no-store",
        }
      );

      let d = {};

      try {
        d = await r.json();
      } catch {
        d = {};
      }

      if (!r.ok) {
        throw new Error(
          d?.message ||
            d?.error ||
            `Purchase master load failed (${r.status})`
        );
      }

      const source =
        d?.data && typeof d.data === "object"
          ? d.data
          : d?.result && typeof d.result === "object"
            ? d.result
            : d;

      const locations = Array.isArray(source?.locations)
        ? source.locations
        : Array.isArray(source?.godowns)
          ? source.godowns
          : [];

      const suppliers = Array.isArray(source?.suppliers)
        ? source.suppliers
        : Array.isArray(source?.companies)
          ? source.companies
          : [];

      const items = Array.isArray(source?.items)
        ? source.items
        : Array.isArray(source?.rawMaterials)
          ? source.rawMaterials
          : Array.isArray(source?.raw_materials)
            ? source.raw_materials
            : [];

      setMasters({
        locations,
        suppliers,
        items,
      });
    } catch (e) {
      console.error(
        "Raw Material Purchase master loading failed:",
        e
      );

      setMasters({
        locations: [],
        suppliers: [],
        items: [],
      });

      setError(
        e?.message || "Purchase master load failed."
      );
    } finally {
      setMastersLoading(false);
    }
  }

  function selectSupplier(id) {
    const s = masters.suppliers.find(
      (x) => String(x._id) === String(id)
    );

    setField("supplierName", s?.name || "");
    setField("supplierGSTIN", s?.gstin || "");
  }

  function selectItem(i, id) {
    const m = masters.items.find(
      (x) => String(x._id) === String(id)
    );

    setLine(i, "itemName", m?.name || "");
    setLine(i, "hsn", m?.hsn || "");
    setLine(i, "unit", m?.unit || "KG");
    setLine(i, "gstRate", m?.defaultGstRate ?? "");
    setLine(i, "barcode", m?.defaultBarcode || "");
  }

  async function loadPurchases() {
    setLoadingList(true);
    setError("");

    try {
      const r = await fetch(
        `${API_URL}/api/inventory/raw-material-purchases?page=${page}&limit=15&search=${encodeURIComponent(
          search
        )}`,
        {
          headers: headers(),
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.message || "Purchase list load failed."
        );
      }

      setPurchases(d.items || []);

      setPagination(
        d.pagination || {
          page: 1,
          pages: 1,
          total: 0,
        }
      );
    } catch (e) {
      setError(
        e.message || "Purchase list load failed."
      );
    } finally {
      setLoadingList(false);
    }
  }

  async function loadStock() {
    setLoadingList(true);
    setError("");

    try {
      const r = await fetch(
        `${API_URL}/api/inventory/raw-material-stock?page=${stockPage}&limit=20&search=${encodeURIComponent(
          search
        )}`,
        {
          headers: headers(),
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.message || "Stock load failed."
        );
      }

      setStock(d.items || []);

      setStockPagination(
        d.pagination || {
          page: 1,
          pages: 1,
          total: 0,
        }
      );
    } catch (e) {
      setError(e.message || "Stock load failed.");
    } finally {
      setLoadingList(false);
    }
  }

  async function showStockMovements(item) {
    setSelectedStock(item);
    setStockMovements([]);
    setMovementError("");
    setLoadingMovements(true);

    try {
      const params = new URLSearchParams({
        itemType: "RAW_MATERIAL",
        itemName: item.itemName,
        location: item.location,
        batchNo: item.batchNo || "",
        barcode: item.barcode || "",
      });
      const response = await fetch(
        `${API_URL}/api/inventory/workflow/stock-ledger?${params}`,
        { headers: headers() }
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Stock history load failed.");
      }

      setStockMovements(data.items || []);
    } catch (e) {
      setMovementError(e.message || "Stock history load failed.");
    } finally {
      setLoadingMovements(false);
    }
  }

  const movementTotals = stockMovements.reduce(
    (totals, movement) => ({
      qtyIn: totals.qtyIn + Number(movement.qtyIn || 0),
      qtyOut: totals.qtyOut + Number(movement.qtyOut || 0),
    }),
    { qtyIn: 0, qtyOut: 0 }
  );

  function movementLabel(type) {
    return String(type || "OTHER").replaceAll("_", " ");
  }

  function setField(name, value) {
    setForm((f) => ({
      ...f,
      [name]: value,
    }));
  }

  function setLine(i, name, value) {
    setLines((a) =>
      a.map((x, idx) =>
        idx === i
          ? {
              ...x,
              [name]: value,
            }
          : x
      )
    );
  }

  function reset() {
    setEditingPurchaseId("");
    setForm({
      date: today(),
      location: "",
      supplierName: "",
      supplierGSTIN: "",
      supplierInvoiceNo: "",
      supplierInvoiceDate: "",
      transportCost: "",
      otherCost: "",
      remarks: "",
    });

    setLines([blankLine()]);
  }

  function editPurchase(purchase) {
    setEditingPurchaseId(purchase._id);
    setForm({
      date: String(purchase.date || today()).slice(0, 10),
      location: purchase.location || "",
      supplierName: purchase.supplierName || "",
      supplierGSTIN: purchase.supplierGSTIN || "",
      supplierInvoiceNo: purchase.supplierInvoiceNo || "",
      supplierInvoiceDate: purchase.supplierInvoiceDate
        ? String(purchase.supplierInvoiceDate).slice(0, 10)
        : "",
      transportCost: String(purchase.transportCost || ""),
      otherCost: String(purchase.otherCost || ""),
      remarks: purchase.remarks || "",
    });
    setLines((purchase.lines || []).map((line) => ({
      itemName: line.itemName || "",
      hsn: line.hsn || "",
      unit: line.unit || "KG",
      batchNo: line.batchNo || "",
      barcode: line.barcode || "",
      mfgDate: line.mfgDate ? String(line.mfgDate).slice(0, 10) : "",
      expiryDate: line.expiryDate ? String(line.expiryDate).slice(0, 10) : "",
      qty: String(line.qty ?? ""),
      purchaseRate: String(line.purchaseRate ?? ""),
      discount: String(line.discount ?? ""),
      gstRate: String(line.gstRate ?? ""),
      gstType: line.gstType || "NONE",
    })));
    setTab("purchase");
    setError("");
    setMessage("");
  }

  async function deletePurchase(purchase) {
    if (!window.confirm(`Delete purchase ${purchase.purchaseNo}? Its stock entry and accounting records will also be removed.`)) return;

    setLoadingList(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(
        `${API_URL}/api/inventory/raw-material-purchases/${purchase._id}`,
        { method: "DELETE", headers: headers() }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Purchase delete failed.");
      setMessage(data.message || "Purchase deleted.");
      await loadPurchases();
    } catch (e) {
      setError(e.message || "Purchase delete failed.");
    } finally {
      setLoadingList(false);
    }
  }

  async function save() {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const r = await fetch(
        `${API_URL}/api/inventory/raw-material-purchases${editingPurchaseId ? `/${editingPurchaseId}` : ""}`,
        {
          method: editingPurchaseId ? "PUT" : "POST",
          headers: headers(),
          body: JSON.stringify({
            ...form,
            lines,
          }),
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.message || "Purchase save failed."
        );
      }

      setMessage(d.message || (editingPurchaseId ? "Purchase updated successfully." : "Purchase saved successfully."));

      reset();
      setTab("purchase");
      setPage(1);

      await loadPurchases();
    } catch (e) {
      setError(
        e.message || "Purchase save failed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rmp-page">
      <style>{`
        .rmp-page{
          padding:22px;
          max-width:1400px;
          margin:auto;
          min-height:100vh;
          color:#182b3b;
          background:linear-gradient(135deg,#f2f7f5 0%,#f4f7fb 52%,#f8f6f1 100%);
          font-family:Inter,Segoe UI,sans-serif
        }

        .rmp-head{
          display:flex;
          justify-content:space-between;
          align-items:center;
          gap:12px;
          margin-bottom:16px
        }

        .rmp-head h2{
          margin:0;
          color:#182b3b;
          font-size:22px
        }

        .rmp-card{
          background:#fff;
          border:1px solid #dce5e2;
          border-radius:8px;
          padding:18px;
          margin-bottom:16px;
          box-shadow:0 8px 22px rgba(24,43,59,.045)
        }

        .rmp-grid{
          display:grid;
          grid-template-columns:repeat(4,minmax(0,1fr));
          gap:12px
        }

        .rmp-field label{
          display:block;
          font-size:12px;
          color:#667085;
          margin-bottom:5px
        }

        .rmp-field input,
        .rmp-field select,
        .rmp-field textarea{
          width:100%;
          box-sizing:border-box;
          padding:10px;
          border:1px solid #d0d5dd;
          border-radius:8px;
          background:#fff
        }

        .rmp-field textarea{
          min-height:42px
        }

        .rmp-wide{
          grid-column:span 2
        }

        .rmp-table{
          width:100%;
          border-collapse:collapse;
          min-width:1100px
        }

        .rmp-table th,
        .rmp-table td{
          border-bottom:1px solid #eaecf0;
          padding:8px;
          text-align:left;
          font-size:12px;
          white-space:nowrap
        }

        .rmp-table th{
          background:#eff5f2;
          color:#36594f
        }

        .rmp-table tbody tr:hover{
          background:#f3f8f6
        }

        .rmp-table input,
        .rmp-table select{
          padding:7px;
          border:1px solid #d0d5dd;
          border-radius:6px;
          min-width:82px
        }

        .rmp-scroll{
          overflow:auto
        }

        .rmp-actions{
          display:flex;
          gap:8px;
          align-items:center;
          justify-content:flex-end;
          margin-top:14px
        }

        .rmp-btn{
          border:0;
          border-radius:8px;
          padding:10px 14px;
          cursor:pointer;
          font-weight:600
        }

        .rmp-primary{
          background:#176b55;
          color:#fff
        }

        .rmp-secondary{
          background:#eef2f6;
          color:#344054
        }

        .rmp-danger{
          background:#fee4e2;
          color:#b42318
        }

        .rmp-tabs{
          display:flex;
          gap:8px;
          margin-bottom:14px
        }

        .rmp-tab{
          border:1px solid #d0d5dd;
          background:#fff;
          padding:9px 14px;
          border-radius:8px;
          cursor:pointer
        }

        .rmp-tab.active{
          background:#176b55;
          color:#fff;
          border-color:#176b55
        }

        .rmp-btn,.rmp-tab{
          transition:background .16s ease,border-color .16s ease,transform .16s ease
        }

        .rmp-btn:hover:not(:disabled),.rmp-tab:hover{
          transform:translateY(-1px)
        }

        .rmp-msg{
          padding:10px;
          border-radius:8px;
          background:#ecfdf3;
          color:#027a48;
          margin-bottom:12px
        }

        .rmp-error{
          padding:10px;
          border-radius:8px;
          background:#fef3f2;
          color:#b42318;
          margin-bottom:12px
        }

        .rmp-summary{
          display:flex;
          justify-content:flex-end;
          gap:22px;
          flex-wrap:wrap;
          font-size:13px
        }

        .rmp-summary strong{
          color:#172b4d
        }

        .rmp-search{
          display:flex;
          gap:8px;
          margin-bottom:12px
        }

        .rmp-search input{
          padding:10px;
          border:1px solid #d0d5dd;
          border-radius:8px;
          flex:1
        }

        .rmp-pager{
          display:flex;
          justify-content:flex-end;
          gap:8px;
          margin-top:12px;
          align-items:center
        }

        .rmp-row-actions{
          display:flex;
          gap:6px
        }

        .rmp-qty-link{
          border:0;
          padding:2px 4px;
          background:transparent;
          color:#175cd3;
          font:inherit;
          font-weight:700;
          text-decoration:underline;
          text-underline-offset:3px;
          cursor:pointer
        }

        .rmp-modal-backdrop{
          position:fixed;
          inset:0;
          z-index:1000;
          display:grid;
          place-items:center;
          padding:20px;
          background:rgba(16,24,40,.56)
        }

        .rmp-modal{
          width:min(1040px,100%);
          max-height:min(86vh,760px);
          overflow:auto;
          padding:20px;
          border:1px solid #d0d5dd;
          border-radius:10px;
          background:#fff;
          box-shadow:0 24px 64px rgba(16,24,40,.22)
        }

        .rmp-modal-header{
          display:flex;
          align-items:flex-start;
          justify-content:space-between;
          gap:16px;
          margin-bottom:16px
        }

        .rmp-modal-header h2{
          margin:0 0 5px;
          font-size:20px
        }

        .rmp-modal-header p{
          margin:0;
          color:#667085;
          font-size:13px
        }

        .rmp-movement-summary{
          display:flex;
          gap:22px;
          flex-wrap:wrap;
          padding:12px 0;
          margin-bottom:12px;
          border-top:1px solid #eaecf0;
          border-bottom:1px solid #eaecf0;
          color:#475467;
          font-size:13px
        }

        .rmp-movement-summary strong{
          margin-left:5px;
          color:#101828
        }

        .rmp-movement-table{
          min-width:900px
        }

        @media(max-width:900px){
          .rmp-grid{
            grid-template-columns:repeat(2,minmax(0,1fr))
          }
        }

        @media(max-width:600px){
          .rmp-grid{
            grid-template-columns:1fr
          }

          .rmp-wide{
            grid-column:span 1
          }

          .rmp-page{
            padding:12px
          }

          .rmp-modal-backdrop{
            padding:8px
          }

          .rmp-modal{
            max-height:92vh;
            padding:14px
          }

          .rmp-modal-header{
            flex-direction:column
          }
        }
      `}</style>

      <div className="rmp-head">
        <div>
          <h2>Raw Material Purchase</h2>

          <div
            style={{
              color: "#667085",
              fontSize: 13,
            }}
          >
            Purchase posts directly into Raw Material Stock.
          </div>
        </div>

        <button
          className="rmp-btn rmp-secondary"
          onClick={reset}
        >
          New Purchase
        </button>
      </div>

      <div className="rmp-tabs">
        <button
          className={`rmp-tab ${
            tab === "purchase" ? "active" : ""
          }`}
          onClick={() => setTab("purchase")}
        >
          Purchase
        </button>

        <button
          className={`rmp-tab ${
            tab === "list" ? "active" : ""
          }`}
          onClick={() => setTab("list")}
        >
          Purchase List
        </button>

        <button
          className={`rmp-tab ${
            tab === "stock" ? "active" : ""
          }`}
          onClick={() => setTab("stock")}
        >
          Raw Material Stock
        </button>
      </div>

      {message && (
        <div className="rmp-msg">
          {message}
        </div>
      )}

      {error && (
        <div className="rmp-error">
          {error}
        </div>
      )}

      {tab === "purchase" && (
        <>
          <div className="rmp-card">
            <div className="rmp-grid">
              <div className="rmp-field">
                <label>Purchase Date</label>

                <input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setField("date", e.target.value)
                  }
                />
              </div>

              <div className="rmp-field">
                <label>
                  Location / Godown *
                </label>

                <select
                  value={form.location}
                  onChange={(e) =>
                    setField(
                      "location",
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    {mastersLoading
                      ? "Loading locations..."
                      : "Select Location / Godown"}
                  </option>

                  {masters.locations.map((x) => (
                    <option
                      key={x._id}
                      value={x.name}
                    >
                      {x.name}
                      {x.code
                        ? ` (${x.code})`
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rmp-field">
                <label>Supplier *</label>

                <select
                  value={
                    masters.suppliers.find(
                      (x) =>
                        x.name ===
                        form.supplierName
                    )?._id || ""
                  }
                  onChange={(e) =>
                    selectSupplier(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    {mastersLoading
                      ? "Loading suppliers..."
                      : "Select Supplier"}
                  </option>

                  {masters.suppliers.map((x) => (
                    <option
                      key={x._id}
                      value={x._id}
                    >
                      {x.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rmp-field">
                <label>Supplier GSTIN</label>

                <input
                  value={form.supplierGSTIN}
                  onChange={(e) =>
                    setField(
                      "supplierGSTIN",
                      e.target.value.toUpperCase()
                    )
                  }
                />
              </div>

              <div className="rmp-field">
                <label>
                  Supplier Invoice No.
                </label>

                <input
                  value={form.supplierInvoiceNo}
                  onChange={(e) =>
                    setField(
                      "supplierInvoiceNo",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="rmp-field">
                <label>Invoice Date</label>

                <input
                  type="date"
                  value={
                    form.supplierInvoiceDate
                  }
                  onChange={(e) =>
                    setField(
                      "supplierInvoiceDate",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="rmp-field">
                <label>Transport Cost</label>

                <input
                  type="number"
                  min="0"
                  value={form.transportCost}
                  onChange={(e) =>
                    setField(
                      "transportCost",
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="rmp-field">
                <label>Other Cost</label>

                <input
                  type="number"
                  min="0"
                  value={form.otherCost}
                  onChange={(e) =>
                    setField(
                      "otherCost",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          </div>

          <div className="rmp-card">
            <div className="rmp-scroll">
              <table className="rmp-table">
                <thead>
                  <tr>
                    <th>Raw Material *</th>
                    <th>HSN</th>
                    <th>Unit</th>
                    <th>Batch</th>
                    <th>Barcode</th>
                    <th>MFG</th>
                    <th>Expiry</th>
                    <th>Qty *</th>
                    <th>Rate *</th>
                    <th>Discount</th>
                    <th>GST %</th>
                    <th>GST Type</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <select
                          value={
                            masters.items.find(
                              (x) =>
                                x.name ===
                                l.itemName
                            )?._id || ""
                          }
                          onChange={(e) =>
                            selectItem(
                              i,
                              e.target.value
                            )
                          }
                        >
                          <option value="">
                            {mastersLoading
                              ? "Loading raw materials..."
                              : "Select Raw Material"}
                          </option>

                          {masters.items.map((x) => (
                            <option
                              key={x._id}
                              value={x._id}
                            >
                              {x.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <input
                          value={l.hsn}
                          onChange={(e) =>
                            setLine(
                              i,
                              "hsn",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={l.unit}
                          onChange={(e) =>
                            setLine(
                              i,
                              "unit",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={l.batchNo}
                          onChange={(e) =>
                            setLine(
                              i,
                              "batchNo",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={l.barcode}
                          onChange={(e) =>
                            setLine(
                              i,
                              "barcode",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="date"
                          value={l.mfgDate}
                          onChange={(e) =>
                            setLine(
                              i,
                              "mfgDate",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="date"
                          value={l.expiryDate}
                          onChange={(e) =>
                            setLine(
                              i,
                              "expiryDate",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={l.qty ?? ""}
                          onChange={(e) =>
                            setLine(
                              i,
                              "qty",
                              e.target.value
                            )
                          }
                          style={{
                            color: "#172b4d",
                            background: "#fff",
                          }}
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          value={l.purchaseRate}
                          onChange={(e) =>
                            setLine(
                              i,
                              "purchaseRate",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          value={l.discount}
                          onChange={(e) =>
                            setLine(
                              i,
                              "discount",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={l.gstRate}
                          onChange={(e) =>
                            setLine(
                              i,
                              "gstRate",
                              e.target.value
                            )
                          }
                        />
                      </td>

                      <td>
                        <select
                          value={l.gstType}
                          onChange={(e) =>
                            setLine(
                              i,
                              "gstType",
                              e.target.value
                            )
                          }
                        >
                          <option value="NONE">
                            None
                          </option>

                          <option value="CGST_SGST">
                            CGST + SGST
                          </option>

                          <option value="IGST">
                            IGST
                          </option>
                        </select>
                      </td>

                      <td>
                        <button
                          className="rmp-btn rmp-danger"
                          onClick={() =>
                            setLines((a) =>
                              a.filter(
                                (_, x) => x !== i
                              )
                            )
                          }
                          disabled={
                            lines.length === 1
                          }
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              className="rmp-btn rmp-secondary"
              style={{ marginTop: 12 }}
              onClick={() =>
                setLines((a) => [
                  ...a,
                  blankLine(),
                ])
              }
            >
              + Add Raw Material
            </button>
          </div>

          <div className="rmp-card">
            <div className="rmp-grid">
              <div className="rmp-field rmp-wide">
                <label>Remarks</label>

                <textarea
                  value={form.remarks}
                  onChange={(e) =>
                    setField(
                      "remarks",
                      e.target.value
                    )
                  }
                />
              </div>
            </div>

            <div className="rmp-summary">
              <span>
                Taxable:{" "}
                <strong>
                  ₹ {money(totals.taxable)}
                </strong>
              </span>

              <span>
                CGST:{" "}
                <strong>
                  ₹ {money(totals.cgst)}
                </strong>
              </span>

              <span>
                SGST:{" "}
                <strong>
                  ₹ {money(totals.sgst)}
                </strong>
              </span>

              <span>
                IGST:{" "}
                <strong>
                  ₹ {money(totals.igst)}
                </strong>
              </span>

              <span>
                Grand Total:{" "}
                <strong>
                  ₹ {money(grand)}
                </strong>
              </span>
            </div>

            <div className="rmp-actions">
              <button
                className="rmp-btn rmp-secondary"
                onClick={reset}
              >
                Clear
              </button>

              <button
                className="rmp-btn rmp-primary"
                disabled={loading}
                onClick={save}
              >
                {loading
                  ? (editingPurchaseId ? "Updating..." : "Posting...")
                  : (editingPurchaseId ? "Update Purchase" : "Post Purchase & Update Stock")}
              </button>
              {editingPurchaseId && (
                <button
                  type="button"
                  className="rmp-btn rmp-secondary"
                  onClick={reset}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {(tab === "list" || tab === "stock") && (
        <div className="rmp-card">
          <div className="rmp-search">
            <input
              placeholder="Search purchase / supplier / material"
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  tab === "list"
                    ? loadPurchases()
                    : loadStock();
                }
              }}
            />

            <button
              className="rmp-btn rmp-secondary"
              onClick={() => {
                tab === "list"
                  ? loadPurchases()
                  : loadStock();
              }}
            >
              Search
            </button>
          </div>

          {loadingList ? (
            <div>Loading...</div>
          ) : tab === "list" ? (
            <div className="rmp-scroll">
              <table className="rmp-table">
                <thead>
                  <tr>
                    <th>Purchase No</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Location</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {purchases.map((p) => (
                    <tr key={p._id}>
                      <td>{p.purchaseNo}</td>

                      <td>
                        {new Date(
                          p.date
                        ).toLocaleDateString(
                          "en-IN"
                        )}
                      </td>

                      <td>
                        {p.supplierName}
                      </td>

                      <td>
                        {p.location}
                      </td>

                      <td>
                        {p.lines
                          ?.map(
                            (x) =>
                              `${x.itemName} (${x.qty} ${x.unit})`
                          )
                          .join(", ")}
                      </td>

                      <td>
                        ₹{" "}
                        {money(
                          p.grandTotal
                        )}
                      </td>

                      <td>
                        <div className="rmp-row-actions">
                          <button
                            type="button"
                            className="rmp-btn rmp-secondary"
                            onClick={() => editPurchase(p)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="rmp-btn rmp-danger"
                            onClick={() => deletePurchase(p)}
                            disabled={loadingList}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rmp-scroll">
              <table className="rmp-table">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Location</th>
                    <th>Batch</th>
                    <th>Barcode</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Average Rate</th>
                    <th>Stock Value</th>
                  </tr>
                </thead>

                <tbody>
                  {stock.map((s) => (
                    <tr key={s._id}>
                      <td>
                        {s.itemName}
                      </td>

                      <td>
                        {s.location}
                      </td>

                      <td>
                        {s.batchNo || "-"}
                      </td>

                      <td>
                        {s.barcode || "-"}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="rmp-qty-link"
                          onClick={() => showStockMovements(s)}
                          title="View stock movement breakdown"
                        >
                          {s.qty}
                        </button>
                      </td>

                      <td>{s.unit}</td>

                      <td>
                        ₹{" "}
                        {money(
                          s.averageRate
                        )}
                      </td>

                      <td>
                        ₹{" "}
                        {money(
                          s.stockValue
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="rmp-pager">
            <button
              className="rmp-btn rmp-secondary"
              disabled={
                (tab === "list"
                  ? pagination
                  : stockPagination
                ).page <= 1
              }
              onClick={() =>
                tab === "list"
                  ? setPage((p) =>
                      Math.max(1, p - 1)
                    )
                  : setStockPage((p) =>
                      Math.max(1, p - 1)
                    )
              }
            >
              Prev
            </button>

            <span>
              Page{" "}
              {
                (tab === "list"
                  ? pagination
                  : stockPagination
                ).page
              }{" "}
              /{" "}
              {(tab === "list"
                ? pagination
                : stockPagination
              ).pages || 1}
            </span>

            <button
              className="rmp-btn rmp-secondary"
              disabled={
                (tab === "list"
                  ? pagination
                  : stockPagination
                ).page >=
                (tab === "list"
                  ? pagination
                  : stockPagination
                ).pages
              }
              onClick={() =>
                tab === "list"
                  ? setPage((p) => p + 1)
                  : setStockPage((p) =>
                      p + 1
                    )
              }
            >
              Next
            </button>
          </div>
        </div>
      )}

      {selectedStock && (
        <div
          className="rmp-modal-backdrop"
          onClick={() => setSelectedStock(null)}
        >
          <section
            className="rmp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rmp-movement-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="rmp-modal-header">
              <div>
                <h2 id="rmp-movement-title">Stock Movement</h2>
                <p>
                  {selectedStock.itemName} · {selectedStock.location}
                  {selectedStock.batchNo ? ` · Batch ${selectedStock.batchNo}` : ""}
                </p>
              </div>
              <button
                type="button"
                className="rmp-btn rmp-secondary"
                onClick={() => setSelectedStock(null)}
                aria-label="Close stock movement"
              >
                Close
              </button>
            </div>

            <div className="rmp-movement-summary">
              <span>Current stock <strong>{selectedStock.qty} {selectedStock.unit}</strong></span>
              <span>Added <strong>{money(movementTotals.qtyIn)} {selectedStock.unit}</strong></span>
              <span>Reduced <strong>{money(movementTotals.qtyOut)} {selectedStock.unit}</strong></span>
            </div>

            {loadingMovements ? (
              <div>Loading stock history...</div>
            ) : movementError ? (
              <div className="rmp-error">{movementError}</div>
            ) : stockMovements.length ? (
              <div className="rmp-scroll">
                <table className="rmp-table rmp-movement-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reason</th>
                      <th>Document</th>
                      <th>Added</th>
                      <th>Reduced</th>
                      <th>Balance after</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockMovements.map((movement) => (
                      <tr key={movement._id}>
                        <td>{new Date(movement.date).toLocaleDateString("en-IN")}</td>
                        <td>{movementLabel(movement.sourceType)}</td>
                        <td>{movement.sourceNo || movement.referenceNo || "-"}</td>
                        <td>{Number(movement.qtyIn || 0) || "-"}</td>
                        <td>{Number(movement.qtyOut || 0) || "-"}</td>
                        <td>{movement.balanceQty ?? "-"} {movement.unit || selectedStock.unit}</td>
                        <td>{movement.narration || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div>No movement history found for this stock batch.</div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
