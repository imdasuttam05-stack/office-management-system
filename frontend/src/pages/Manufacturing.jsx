import React, { useEffect, useMemo, useState } from "react";

const API = (
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com"
).replace(/\/+$/, "");

const auth = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
});

async function api(path, options = {}) {
  const response = await fetch(`${API}/api/inventory${path}`, {
    ...options,
    headers: {
      ...auth(),
      ...(options.headers || {}),
    },
  });

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.message || `Request failed: ${response.status}`);
  }

  return data;
}

const today = () => new Date().toISOString().slice(0, 10);

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

function normalizeType(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function getProductId(product) {
  return (
    product?._id ||
    product?.id ||
    product?.productId ||
    product?.itemId ||
    ""
  );
}

function getProductName(product) {
  return (
    product?.name ||
    product?.itemName ||
    product?.productName ||
    product?.title ||
    product?.ledgerName ||
    ""
  );
}

function getProductCode(product) {
  return (
    product?.code ||
    product?.itemCode ||
    product?.productCode ||
    product?.sku ||
    ""
  );
}

function getProductType(product) {
  return normalizeType(
    product?.itemType ||
      product?.type ||
      product?.productType ||
      product?.stockType ||
      product?.categoryType ||
      product?.inventoryType ||
      product?.masterType ||
      product?.category ||
      product?.stockCategory ||
      ""
  );
}

function getProductUnit(product) {
  return (
    product?.unit ||
    product?.unitName ||
    product?.uom ||
    product?.primaryUnit ||
    "KG"
  );
}

function getProductRate(product) {
  return (
    product?.purchaseRate ??
    product?.rate ??
    product?.costRate ??
    product?.salesRate ??
    product?.price ??
    ""
  );
}

function getProductHSN(product) {
  return (
    product?.hsn ||
    product?.hsnCode ||
    product?.sac ||
    ""
  );
}

function getProductGST(product) {
  return (
    product?.gstRate ??
    product?.gst ??
    product?.taxRate ??
    ""
  );
}

function extractArray(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.masters)) return data.masters;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.rows)) return data.rows;

  return [];
}

function Input({ label, ...props }) {
  return (
    <label className="mf">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

function Select({ label, children, ...props }) {
  return (
    <label className="mf">
      <span>{label}</span>
      <select {...props}>{children}</select>
    </label>
  );
}

/* =========================================================
   PRODUCT / STOCK DROPDOWN
========================================================= */

function ProductSelect({
  value,
  products,
  stockProducts,
  allowedTypes,
  onChange,
}) {
  const normalizedAllowed = allowedTypes.map(normalizeType);

  const sourceList =
    stockProducts && stockProducts.length > 0
      ? stockProducts
      : products;

  const options = useMemo(() => {
    const seen = new Set();

    const result = sourceList.filter((product) => {
      const name = getProductName(product);
      if (!name) return false;

      const id = getProductId(product);
      const key = `${id}-${name}`;

      if (seen.has(key)) return false;

      const type = getProductType(product);

      /*
       * If type is known, enforce allowed type.
       *
       * If type is missing from old Product Master data,
       * keep the product available so dropdown never breaks.
       */
      if (type && normalizedAllowed.length > 0) {
        if (!normalizedAllowed.includes(type)) {
          return false;
        }
      }

      seen.add(key);
      return true;
    });

    return result;
  }, [sourceList, normalizedAllowed.join("|")]);

  return (
    <select value={value || ""} onChange={onChange}>
      <option value="">Select Product</option>

      {options.map((product, index) => {
        const id = getProductId(product);
        const name = getProductName(product);
        const code = getProductCode(product);
        const type = getProductType(product);

        return (
          <option
            key={id || `${name}-${index}`}
            value={name}
          >
            {name}
            {code ? ` (${code})` : ""}
            {type ? ` — ${type}` : ""}
          </option>
        );
      })}
    </select>
  );
}

/* =========================================================
   LINE TABLE
========================================================= */

function Lines({
  items,
  setItems,
  products = [],
  stockProducts = [],
  allowedTypes = [],
  emptyMessage = "No products available",
}) {
  const normalizedAllowed = allowedTypes.map(normalizeType);

  const sourceList =
    stockProducts && stockProducts.length > 0
      ? stockProducts
      : products;

  const filteredOptions = useMemo(() => {
    const seen = new Set();

    return sourceList.filter((product) => {
      const name = getProductName(product);

      if (!name) return false;

      const id = getProductId(product);
      const key = `${id}-${name}`;

      if (seen.has(key)) return false;

      const type = getProductType(product);

      if (
        normalizedAllowed.length > 0 &&
        type &&
        !normalizedAllowed.includes(type)
      ) {
        return false;
      }

      seen.add(key);
      return true;
    });
  }, [sourceList, normalizedAllowed.join("|")]);

  function updateLine(index, patch) {
    setItems((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              ...patch,
            }
          : row
      )
    );
  }

  function selectProduct(index, productName) {
    const product = filteredOptions.find(
      (item) => getProductName(item) === productName
    );

    if (!product) {
      updateLine(index, {
        itemName: productName,
      });
      return;
    }

    updateLine(index, {
      itemId: getProductId(product),
      itemName: getProductName(product),
      itemType: getProductType(product),
      unit: getProductUnit(product),
      rate: getProductRate(product),
      hsn: getProductHSN(product),
      gstRate: getProductGST(product),
    });
  }

  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Type</th>
            <th>Unit</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Batch</th>
            <th>Barcode</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {items.map((row, index) => (
            <tr key={index}>
              <td style={{ minWidth: 300 }}>
                <ProductSelect
                  value={row.itemName}
                  products={products}
                  stockProducts={stockProducts}
                  allowedTypes={allowedTypes}
                  onChange={(e) =>
                    selectProduct(index, e.target.value)
                  }
                />

                {filteredOptions.length === 0 && (
                  <div className="dropdown-help">
                    {emptyMessage}
                  </div>
                )}
              </td>

              <td>
                <input
                  value={row.itemType || ""}
                  readOnly
                  placeholder="Type"
                />
              </td>

              <td>
                <input
                  value={row.unit || "KG"}
                  readOnly
                />
              </td>

              <td>
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={row.qty || ""}
                  onChange={(e) =>
                    updateLine(index, {
                      qty: e.target.value,
                    })
                  }
                />
              </td>

              <td>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.rate || ""}
                  onChange={(e) =>
                    updateLine(index, {
                      rate: e.target.value,
                    })
                  }
                />
              </td>

              <td>
                <input
                  value={row.batchNo || ""}
                  onChange={(e) =>
                    updateLine(index, {
                      batchNo: e.target.value,
                    })
                  }
                />
              </td>

              <td>
                <input
                  value={row.barcode || ""}
                  onChange={(e) =>
                    updateLine(index, {
                      barcode: e.target.value,
                    })
                  }
                />
              </td>

              <td>
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    setItems((current) =>
                      current.filter(
                        (_, rowIndex) => rowIndex !== index
                      )
                    )
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
  );
}

/* =========================================================
   STOCK TABLE
========================================================= */

function StockTable({ items, title }) {
  return (
    <div className="card">
      <h3>{title}</h3>

      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Location</th>
              <th>Batch</th>
              <th>Qty</th>
              <th>Unit</th>
              <th>Avg Rate</th>
              <th>Value</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => (
              <tr key={item._id || index}>
                <td>{item.itemName}</td>
                <td>{item.itemType}</td>
                <td>{item.location || "-"}</td>
                <td>{item.batchNo || "-"}</td>
                <td>{money(item.qty)}</td>
                <td>{item.unit || "KG"}</td>
                <td>
                  ₹ {money(item.averageRate)}
                </td>
                <td>
                  ₹ {money(item.stockValue)}
                </td>
              </tr>
            ))}

            {!items.length && (
              <tr>
                <td colSpan="8" className="empty">
                  No stock available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN MANUFACTURING
========================================================= */

export default function Manufacturing() {
  const [tab, setTab] = useState(
    () =>
      new URLSearchParams(window.location.search).get("tab") ||
      "purchase"
  );

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [stock, setStock] = useState([]);
  const [products, setProducts] = useState([]);

  const [rawStock, setRawStock] = useState([]);
  const [gradeStock, setGradeStock] = useState([]);
  const [finishedStock, setFinishedStock] = useState([]);

  const [jobs, setJobs] = useState([]);
  const [sales, setSales] = useState([]);
  const [gst, setGst] = useState(null);

  /* =======================================================
     PURCHASE
  ======================================================= */

  const [purchase, setPurchase] = useState({
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

  const blank = () => ({
    itemId: "",
    itemName: "",
    itemType: "",
    unit: "KG",
    qty: "",
    rate: "",
    batchNo: "",
    barcode: "",
    hsn: "",
    gstRate: "",
  });

  const [pLines, setPLines] = useState([blank()]);

  /* =======================================================
     JOB ORDER
  ======================================================= */

  const [job, setJob] = useState({
    date: today(),
    location: "",
    labourCost: "",
    transportCost: "",
    otherCost: "",
    notes: "",
  });

  const [sources, setSources] = useState([blank()]);
  const [outputs, setOutputs] = useState([blank()]);

  const [jobType, setJobType] = useState("GRADING");

  /* =======================================================
     SALE
  ======================================================= */

  const [sale, setSale] = useState({
    date: today(),
    location: "",
    customerName: "",
    customerGSTIN: "",
    customerState: "",
    supplierState: "",
    placeOfSupply: "",
    remarks: "",
  });

  const [sLines, setSLines] = useState([
    {
      ...blank(),
      gstRate: "",
      gstType: "CGST_SGST",
    },
  ]);

  /* =======================================================
     LOAD DATA
  ======================================================= */

  async function loadProducts() {
    const response = await fetch(
      `${API}/api/accounts-masters?type=product`,
      {
        headers: auth(),
      }
    );

    let data = {};

    try {
      data = await response.json();
    } catch {
      data = {};
    }

    if (!response.ok) {
      throw new Error(
        data.message || "Product Master load failed"
      );
    }

    const list = extractArray(data);

    return list;
  }

  async function loadStock(type) {
    try {
      const response = await api(
        `/stock?itemType=${encodeURIComponent(type)}`
      );

      return (
        response?.items ||
        response?.data ||
        response?.stock ||
        []
      );
    } catch {
      return [];
    }
  }

  async function refresh() {
    try {
      setErr("");

      const [
        raw,
        grade,
        finished,
        salesResponse,
        jobsResponse,
        productList,
      ] = await Promise.all([
        loadStock("RAW_MATERIAL"),
        loadStock("GRADE"),
        loadStock("FINISHED_GOODS"),

        api("/sales"),

        api("/job-orders"),

        loadProducts(),
      ]);

      const allStock = [
        ...raw,
        ...grade,
        ...finished,
      ];

      setRawStock(raw);
      setGradeStock(grade);
      setFinishedStock(finished);

      setStock(allStock);

      setSales(
        salesResponse?.items ||
          salesResponse?.data ||
          salesResponse?.sales ||
          []
      );

      setJobs(
        jobsResponse?.items ||
          jobsResponse?.data ||
          jobsResponse?.jobs ||
          []
      );

      setProducts(productList);
    } catch (error) {
      console.error(error);
      setErr(error.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (tab === "gst") {
      api("/gst-report")
        .then(setGst)
        .catch((error) => setErr(error.message));
    }
  }, [tab]);

  /* =======================================================
     PRODUCT FILTERS
  ======================================================= */

  const allProducts = useMemo(() => {
    return products.filter(
      (product) => getProductName(product)
    );
  }, [products]);

  const rawProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const type = getProductType(product);

      return (
        !type ||
        type === "RAW_MATERIAL" ||
        type === "RAW"
      );
    });
  }, [allProducts]);

  const gradeProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const type = getProductType(product);

      return (
        !type ||
        type === "GRADE" ||
        type === "GRADE_STOCK"
      );
    });
  }, [allProducts]);

  const finishedProducts = useMemo(() => {
    return allProducts.filter((product) => {
      const type = getProductType(product);

      return (
        !type ||
        type === "FINISHED_GOODS" ||
        type === "FINISHED_PRODUCT" ||
        type === "FINISHED"
      );
    });
  }, [allProducts]);

  /* =======================================================
     PURCHASE
  ======================================================= */

  async function savePurchase() {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const d = await api("/raw-material-purchases", {
        method: "POST",
        body: JSON.stringify({
          ...purchase,
          lines: pLines,
        }),
      });

      setMsg(d.message || "Purchase posted successfully.");

      setPLines([blank()]);

      await refresh();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     JOB ORDER
  ======================================================= */

  async function saveJob(forceType = jobType) {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      if (!sources.length || !outputs.length) {
        throw new Error(
          "At least one Source Stock and one Output Stock line are required."
        );
      }

      const validSources = sources.filter(
        (line) =>
          line.itemName &&
          Number(line.qty) > 0
      );

      const validOutputs = outputs.filter(
        (line) =>
          line.itemName &&
          Number(line.qty) > 0
      );

      if (!validSources.length) {
        throw new Error(
          "Please select Source Stock product and enter quantity."
        );
      }

      if (!validOutputs.length) {
        throw new Error(
          "Please select Output Stock product and enter quantity."
        );
      }

      const payload = {
        ...job,

        type: forceType,

        sourceItems: validSources.map((line) => ({
          itemId: line.itemId || "",
          itemName: line.itemName,
          itemType: line.itemType,
          unit: line.unit || "KG",
          qty: Number(line.qty || 0),
          rate: Number(line.rate || 0),
          batchNo: line.batchNo || "",
          barcode: line.barcode || "",
        })),

        outputItems: validOutputs.map((line) => ({
          itemId: line.itemId || "",
          itemName: line.itemName,
          itemType: line.itemType,
          unit: line.unit || "KG",
          qty: Number(line.qty || 0),
          rate: Number(line.rate || 0),
          batchNo: line.batchNo || "",
          barcode: line.barcode || "",
        })),
      };

      const d = await api("/job-orders", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setMsg(
        d.message ||
          `${forceType} Job Order posted successfully.`
      );

      setSources([blank()]);
      setOutputs([blank()]);

      await refresh();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     SALE
  ======================================================= */

  async function saveSale() {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const d = await api("/sales", {
        method: "POST",
        body: JSON.stringify({
          ...sale,
          lines: sLines,
        }),
      });

      setMsg(d.message || "Sale posted successfully.");

      setSLines([
        {
          ...blank(),
          gstRate: "",
          gstType: "CGST_SGST",
        },
      ]);

      await refresh();
    } catch (error) {
      setErr(error.message);
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     TABS
  ======================================================= */

  const tabs = [
    ["purchase", "Purchase"],
    ["grading", "Grading Job Order"],
    ["grade", "Grade Stock"],
    ["fgjob", "Finished Goods Job"],
    ["fg", "Finished Goods Stock"],
    ["sales", "Sales"],
    ["gst", "GST Reports"],
  ];

  /* =======================================================
     RENDER
  ======================================================= */

  return (
    <main className="manufacturing">

      <style>{`

        .manufacturing {
          padding: 20px;
          max-width: 1500px;
          margin: auto;
          font-family: Inter, Arial, sans-serif;
          color: #172b4d;
        }

        .top {
          display: flex;
          justify-content: space-between;
          gap: 15px;
          align-items: center;
          margin-bottom: 15px;
        }

        .top h1 {
          margin: 0;
        }

        .tabs {
          display: flex;
          gap: 7px;
          flex-wrap: wrap;
          margin-bottom: 15px;
        }

        .tab {
          border: 1px solid #d0d5dd;
          background: #fff;
          padding: 10px 13px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }

        .tab.on {
          background: #175cd3;
          color: #fff;
          border-color: #175cd3;
        }

        .card {
          background: #fff;
          border: 1px solid #e4e7ec;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 15px;
          box-shadow: 0 2px 10px #1018280d;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(
            4,
            minmax(0, 1fr)
          );
          gap: 12px;
        }

        .mf {
          display: grid;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
        }

        .mf input,
        .mf select,
        .card input,
        .card select,
        table input,
        table select {
          padding: 9px;
          border: 1px solid #d0d5dd;
          border-radius: 7px;
          box-sizing: border-box;
          width: 100%;
          background: #fff;
        }

        .mf input:focus,
        .mf select:focus,
        .card input:focus,
        .card select:focus,
        table input:focus,
        table select:focus {
          outline: none;
          border-color: #175cd3;
          box-shadow: 0 0 0 2px #175cd322;
        }

        .btn {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          background: #175cd3;
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        .btn:hover {
          opacity: 0.92;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .secondary {
          background: #eef2f6;
          color: #344054;
        }

        .danger {
          border: 0;
          background: #fee4e2;
          color: #b42318;
          padding: 7px 10px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 700;
        }

        .scroll {
          overflow: auto;
        }

        table {
          border-collapse: collapse;
          width: 100%;
          min-width: 1000px;
        }

        th,
        td {
          border-bottom: 1px solid #eaecf0;
          padding: 9px;
          text-align: left;
          font-size: 12px;
          white-space: nowrap;
        }

        th {
          background: #f8fafc;
          font-weight: 700;
        }

        .actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 12px;
        }

        .msg {
          background: #ecfdf3;
          color: #027a48;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .err {
          background: #fef3f2;
          color: #b42318;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 12px;
        }

        .muted {
          color: #667085;
          font-size: 13px;
        }

        .empty {
          text-align: center;
          padding: 30px;
          color: #667085;
        }

        .dropdown-help {
          margin-top: 5px;
          font-size: 11px;
          color: #b42318;
        }

        .job-head {
          display: flex;
          gap: 15px;
          align-items: flex-end;
          margin-bottom: 15px;
        }

        .job-type-box {
          min-width: 320px;
        }

        .workflow {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 15px;
          align-items: center;
          margin-bottom: 20px;
        }

        .workflow-box {
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          padding: 15px;
          background: #f8fafc;
        }

        .workflow-title {
          font-size: 13px;
          font-weight: 800;
          margin-bottom: 5px;
        }

        .workflow-sub {
          font-size: 12px;
          color: #667085;
        }

        .workflow-arrow {
          font-size: 25px;
          font-weight: 800;
        }

        .summary {
          display: flex;
          gap: 25px;
          justify-content: flex-end;
          margin-top: 12px;
        }

        @media(max-width: 1000px) {
          .grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            );
          }

          .workflow {
            grid-template-columns: 1fr;
          }

          .workflow-arrow {
            transform: rotate(90deg);
            text-align: center;
          }
        }

        @media(max-width: 600px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .job-head {
            flex-direction: column;
            align-items: stretch;
          }

          .job-type-box {
            min-width: 0;
          }
        }

      `}</style>

      {/* ===================================================
          HEADER
      =================================================== */}

      <div className="top">
        <div>
          <h1>
            Purchase → Production → Sales → GST
          </h1>

          <div className="muted">
            Raw Stock → Grade Stock → Finished Goods Stock
            with stock-controlled job orders.
          </div>
        </div>

        <button
          className="btn secondary"
          onClick={refresh}
        >
          Refresh
        </button>
      </div>

      {/* ===================================================
          TABS
      =================================================== */}

      <div className="tabs">
        {tabs.map(([key, name]) => (
          <button
            type="button"
            className={`tab ${
              tab === key ? "on" : ""
            }`}
            onClick={() => {
              setTab(key);
              setMsg("");
              setErr("");
            }}
            key={key}
          >
            {name}
          </button>
        ))}
      </div>

      {msg && <div className="msg">{msg}</div>}
      {err && <div className="err">{err}</div>}

      {/* ===================================================
          PURCHASE
      =================================================== */}

      {tab === "purchase" && (
        <>
          <div className="card">
            <h3>Raw Material Purchase</h3>

            <div className="grid">

              <Input
                label="Date"
                type="date"
                value={purchase.date}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    date: e.target.value,
                  })
                }
              />

              <Input
                label="Location / Godown"
                value={purchase.location}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    location: e.target.value,
                  })
                }
              />

              <Input
                label="Supplier"
                value={purchase.supplierName}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    supplierName: e.target.value,
                  })
                }
              />

              <Input
                label="Supplier GSTIN"
                value={purchase.supplierGSTIN}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    supplierGSTIN:
                      e.target.value.toUpperCase(),
                  })
                }
              />

              <Input
                label="Invoice No"
                value={purchase.supplierInvoiceNo}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    supplierInvoiceNo:
                      e.target.value,
                  })
                }
              />

              <Input
                label="Invoice Date"
                type="date"
                value={purchase.supplierInvoiceDate}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    supplierInvoiceDate:
                      e.target.value,
                  })
                }
              />

              <Input
                label="Transport Cost"
                type="number"
                value={purchase.transportCost}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    transportCost:
                      e.target.value,
                  })
                }
              />

              <Input
                label="Other Cost"
                type="number"
                value={purchase.otherCost}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    otherCost: e.target.value,
                  })
                }
              />

            </div>
          </div>

          <div className="card">

            <h3>Raw Material Lines</h3>

            <Lines
              items={pLines}
              setItems={setPLines}
              products={rawProducts}
              allowedTypes={["RAW_MATERIAL"]}
              emptyMessage="No Raw Material product found in Product Master."
            />

            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                setPLines([
                  ...pLines,
                  blank(),
                ])
              }
            >
              + Add Raw Material
            </button>

            <div className="actions">

              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={savePurchase}
              >
                {busy
                  ? "Posting..."
                  : "Post Purchase → Raw Stock"}
              </button>

            </div>
          </div>
        </>
      )}

      {/* ===================================================
          JOB ORDER
      =================================================== */}

      {(tab === "grading" ||
        tab === "fgjob") && (
        <div className="card">

          <div className="job-head">

            <div>
              <h3 style={{ margin: 0 }}>
                {tab === "grading"
                  ? "Grading Job Order"
                  : "Finished Goods Job Order"}
              </h3>

              <div className="muted">
                Select source stock and output stock
                according to production type.
              </div>
            </div>

            <div className="job-type-box">

              <Select
                label="Job Order Type"
                value={jobType}
                onChange={(e) => {
                  const type = e.target.value;

                  setJobType(type);

                  /*
                   * Clear old lines when switching
                   * production type so wrong products
                   * cannot remain selected.
                   */
                  setSources([blank()]);
                  setOutputs([blank()]);
                }}
              >

                <option value="GRADING">
                  GRADING: Raw Material → Grade
                </option>

                <option value="FINISHED_GOODS">
                  FINISHED GOODS: Grade → Finished Goods
                </option>

              </Select>

            </div>

          </div>

          {/* WORKFLOW DISPLAY */}

          <div className="workflow">

            <div className="workflow-box">

              <div className="workflow-title">
                Source Stock — Will Decrease
              </div>

              <div className="workflow-sub">

                {jobType === "GRADING"
                  ? "RAW MATERIAL stock"
                  : "GRADE stock"}

              </div>

            </div>

            <div className="workflow-arrow">
              →
            </div>

            <div className="workflow-box">

              <div className="workflow-title">
                Output Stock — Will Increase
              </div>

              <div className="workflow-sub">

                {jobType === "GRADING"
                  ? "GRADE stock"
                  : "FINISHED GOODS stock"}

              </div>

            </div>

          </div>

          {/* JOB DETAILS */}

          <div className="grid">

            <Input
              label="Date"
              type="date"
              value={job.date}
              onChange={(e) =>
                setJob({
                  ...job,
                  date: e.target.value,
                })
              }
            />

            <Input
              label="Location / Godown"
              value={job.location}
              onChange={(e) =>
                setJob({
                  ...job,
                  location: e.target.value,
                })
              }
            />

            <Input
              label="Labour Cost"
              type="number"
              value={job.labourCost}
              onChange={(e) =>
                setJob({
                  ...job,
                  labourCost: e.target.value,
                })
              }
            />

            <Input
              label="Transport Cost"
              type="number"
              value={job.transportCost}
              onChange={(e) =>
                setJob({
                  ...job,
                  transportCost:
                    e.target.value,
                })
              }
            />

            <Input
              label="Other Production Cost"
              type="number"
              value={job.otherCost}
              onChange={(e) =>
                setJob({
                  ...job,
                  otherCost: e.target.value,
                })
              }
            />

            <Input
              label="Notes"
              value={job.notes}
              onChange={(e) =>
                setJob({
                  ...job,
                  notes: e.target.value,
                })
              }
            />

          </div>

          {/* SOURCE STOCK */}

          <div className="card">

            <h4>
              Source Stock
              <span
                style={{
                  marginLeft: 8,
                  color: "#b42318",
                }}
              >
                (will decrease)
              </span>
            </h4>

            {jobType === "GRADING" ? (

              <Lines
                items={sources}
                setItems={setSources}
                products={rawProducts}
                stockProducts={rawStock}
                allowedTypes={[
                  "RAW_MATERIAL",
                  "RAW",
                ]}
                emptyMessage="No Raw Material stock available."
              />

            ) : (

              <Lines
                items={sources}
                setItems={setSources}
                products={gradeProducts}
                stockProducts={gradeStock}
                allowedTypes={[
                  "GRADE",
                  "GRADE_STOCK",
                ]}
                emptyMessage="No Grade stock available for Finished Goods production."
              />

            )}

            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                setSources([
                  ...sources,
                  blank(),
                ])
              }
            >
              + Source
            </button>

          </div>

          {/* OUTPUT STOCK */}

          <div className="card">

            <h4>
              Output Stock
              <span
                style={{
                  marginLeft: 8,
                  color: "#027a48",
                }}
              >
                (will increase)
              </span>
            </h4>

            {jobType === "GRADING" ? (

              <Lines
                items={outputs}
                setItems={setOutputs}
                products={gradeProducts}
                allowedTypes={[
                  "GRADE",
                  "GRADE_STOCK",
                ]}
                emptyMessage="No Grade product found in Product Master."
              />

            ) : (

              /*
               * IMPORTANT:
               *
               * Finished Goods OUTPUT uses Product Master.
               * It does not depend on existing FG stock.
               *
               * This is why a newly-created Finished Goods
               * product can be selected even when current
               * FG stock is zero.
               */

              <Lines
                items={outputs}
                setItems={setOutputs}
                products={finishedProducts}
                allowedTypes={[
                  "FINISHED_GOODS",
                  "FINISHED_PRODUCT",
                  "FINISHED",
                ]}
                emptyMessage="No Finished Goods product found. Please create a Finished Goods item in Accounts → Product Master."
              />

            )}

            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                setOutputs([
                  ...outputs,
                  blank(),
                ])
              }
            >
              + Output
            </button>

          </div>

          {/* POST */}

          <div className="actions">

            <button
              type="button"
              className="btn"
              disabled={busy}
              onClick={() => {
                const type =
                  tab === "grading"
                    ? "GRADING"
                    : "FINISHED_GOODS";

                setJobType(type);

                saveJob(type);
              }}
            >
              {busy
                ? "Posting..."
                : "Post Job Order & Update Stock"}
            </button>

          </div>

        </div>
      )}

      {/* ===================================================
          GRADE STOCK
      =================================================== */}

      {tab === "grade" && (
        <StockTable
          items={gradeStock}
          title="Grade Stock"
        />
      )}

      {/* ===================================================
          FINISHED GOODS STOCK
      =================================================== */}

      {tab === "fg" && (
        <StockTable
          items={finishedStock}
          title="Finished Goods Stock"
        />
      )}

      {/* ===================================================
          SALES
      =================================================== */}

      {tab === "sales" && (
        <>
          <div className="card">

            <h3>Finished Goods Sale</h3>

            <div className="grid">

              <Input
                label="Date"
                type="date"
                value={sale.date}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    date: e.target.value,
                  })
                }
              />

              <Input
                label="Location"
                value={sale.location}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    location: e.target.value,
                  })
                }
              />

              <Input
                label="Customer / Party"
                value={sale.customerName}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    customerName:
                      e.target.value,
                  })
                }
              />

              <Input
                label="Customer GSTIN"
                value={sale.customerGSTIN}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    customerGSTIN:
                      e.target.value.toUpperCase(),
                  })
                }
              />

              <Input
                label="Supplier State"
                value={sale.supplierState}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    supplierState:
                      e.target.value,
                  })
                }
              />

              <Input
                label="Place of Supply"
                value={sale.placeOfSupply}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    placeOfSupply:
                      e.target.value,
                  })
                }
              />

              <Input
                label="Customer State"
                value={sale.customerState}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    customerState:
                      e.target.value,
                  })
                }
              />

            </div>
          </div>

          <div className="card">

            <h3>Sale Lines</h3>

            <div className="scroll">

              <table>

                <thead>
                  <tr>
                    <th>FG Item</th>
                    <th>Unit</th>
                    <th>Qty</th>
                    <th>Rate</th>
                    <th>Batch</th>
                    <th>Barcode</th>
                    <th>HSN</th>
                    <th>GST %</th>
                    <th>Tax Type</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>

                  {sLines.map((row, index) => (

                    <tr key={index}>

                      <td>
                        <select
                          value={row.itemName || ""}
                          onChange={(e) => {
                            const name =
                              e.target.value;

                            const product =
                              finishedProducts.find(
                                (item) =>
                                  getProductName(
                                    item
                                  ) === name
                              );

                            setSLines((current) =>
                              current.map(
                                (item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        itemId:
                                          getProductId(
                                            product
                                          ),
                                        itemName: name,
                                        itemType:
                                          "FINISHED_GOODS",
                                        unit:
                                          getProductUnit(
                                            product
                                          ),
                                        rate:
                                          item.rate ||
                                          getProductRate(
                                            product
                                          ),
                                        hsn:
                                          getProductHSN(
                                            product
                                          ),
                                        gstRate:
                                          getProductGST(
                                            product
                                          ),
                                      }
                                    : item
                              )
                            );
                          }}
                        >

                          <option value="">
                            Select Finished Goods
                          </option>

                          {finishedProducts.map(
                            (product, productIndex) => {

                              const id =
                                getProductId(
                                  product
                                );

                              const name =
                                getProductName(
                                  product
                                );

                              const code =
                                getProductCode(
                                  product
                                );

                              return (
                                <option
                                  key={
                                    id ||
                                    `${name}-${productIndex}`
                                  }
                                  value={name}
                                >
                                  {name}
                                  {code
                                    ? ` (${code})`
                                    : ""}
                                </option>
                              );
                            }
                          )}

                        </select>
                      </td>

                      <td>
                        <input
                          value={
                            row.unit || "KG"
                          }
                          readOnly
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={row.qty || ""}
                          onChange={(e) =>
                            setSLines((current) =>
                              current.map(
                                (item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        qty:
                                          e.target
                                            .value,
                                      }
                                    : item
                              )
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={row.rate || ""}
                          onChange={(e) =>
                            setSLines((current) =>
                              current.map(
                                (item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        rate:
                                          e.target
                                            .value,
                                      }
                                    : item
                              )
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={
                            row.batchNo || ""
                          }
                          onChange={(e) =>
                            setSLines((current) =>
                              current.map(
                                (item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        batchNo:
                                          e.target
                                            .value,
                                      }
                                    : item
                              )
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={
                            row.barcode || ""
                          }
                          onChange={(e) =>
                            setSLines((current) =>
                              current.map(
                                (item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        barcode:
                                          e.target
                                            .value,
                                      }
                                    : item
                              )
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          value={row.hsn || ""}
                          onChange={(e) =>
                            setSLines((current) =>
                              current.map(
                                (item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        hsn:
                                          e.target
                                            .value,
                                      }
                                    : item
                              )
                            )
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="number"
                          value={
                            row.gstRate || ""
                          }
                          onChange={(e) =>
                            setSLines((current) =>
                              current.map(
                                (item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        gstRate:
                                          e.target
                                            .value,
                                      }
                                    : item
                              )
                            )
                          }
                        />
                      </td>

                      <td>
                        <select
                          value={
                            row.gstType ||
                            "CGST_SGST"
                          }
                          onChange={(e) =>
                            setSLines((current) =>
                              current.map(
                                (item, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...item,
                                        gstType:
                                          e.target
                                            .value,
                                      }
                                    : item
                              )
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
                          type="button"
                          className="danger"
                          onClick={() =>
                            setSLines((current) =>
                              current.filter(
                                (_, rowIndex) =>
                                  rowIndex !==
                                  index
                              )
                            )
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
              type="button"
              className="btn secondary"
              onClick={() =>
                setSLines([
                  ...sLines,
                  {
                    ...blank(),
                    gstRate: "",
                    gstType: "CGST_SGST",
                  },
                ])
              }
            >
              + Sale Line
            </button>

            <div className="actions">

              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={saveSale}
              >
                {busy
                  ? "Posting..."
                  : "Post Sale & Reduce FG Stock"}
              </button>

            </div>

          </div>

          <div className="card">

            <h3>Sales List</h3>

            <div className="scroll">

              <table>

                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Location</th>
                    <th>Taxable</th>
                    <th>CGST</th>
                    <th>SGST</th>
                    <th>IGST</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>

                  {sales.map((item, index) => (

                    <tr
                      key={
                        item._id || index
                      }
                    >
                      <td>
                        {item.invoiceNo}
                      </td>

                      <td>
                        {item.date
                          ? new Date(
                              item.date
                            ).toLocaleDateString(
                              "en-IN"
                            )
                          : "-"}
                      </td>

                      <td>
                        {item.customerName}
                      </td>

                      <td>
                        {item.location}
                      </td>

                      <td>
                        ₹{" "}
                        {money(
                          item.subtotal
                        )}
                      </td>

                      <td>
                        ₹{" "}
                        {money(
                          item.totalCGST
                        )}
                      </td>

                      <td>
                        ₹{" "}
                        {money(
                          item.totalSGST
                        )}
                      </td>

                      <td>
                        ₹{" "}
                        {money(
                          item.totalIGST
                        )}
                      </td>

                      <td>
                        ₹{" "}
                        {money(
                          item.grandTotal
                        )}
                      </td>
                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          </div>
        </>
      )}

      {/* ===================================================
          GST
      =================================================== */}

      {tab === "gst" && (
        <div className="card">

          <h3>
            GST Input / Output Summary
          </h3>

          {gst ? (
            <>
              <div className="grid">

                <div>
                  <b>Input Taxable</b>
                  <h2>
                    ₹{" "}
                    {money(
                      gst.summary?.input
                        ?.taxable
                    )}
                  </h2>
                </div>

                <div>
                  <b>Input CGST</b>
                  <h2>
                    ₹{" "}
                    {money(
                      gst.summary?.input
                        ?.cgst
                    )}
                  </h2>
                </div>

                <div>
                  <b>Input SGST</b>
                  <h2>
                    ₹{" "}
                    {money(
                      gst.summary?.input
                        ?.sgst
                    )}
                  </h2>
                </div>

                <div>
                  <b>Input IGST</b>
                  <h2>
                    ₹{" "}
                    {money(
                      gst.summary?.input
                        ?.igst
                    )}
                  </h2>
                </div>

                <div>
                  <b>Output Taxable</b>
                  <h2>
                    ₹{" "}
                    {money(
                      gst.summary?.output
                        ?.taxable
                    )}
                  </h2>
                </div>

                <div>
                  <b>Output CGST</b>
                  <h2>
                    ₹{" "}
                    {money(
                      gst.summary?.output
                        ?.cgst
                    )}
                  </h2>
                </div>

                <div>
                  <b>Output SGST</b>
                  <h2>
                    ₹{" "}
                    {money(
                      gst.summary?.output
                        ?.sgst
                    )}
                  </h2>
                </div>

                <div>
                  <b>Output IGST</b>
                  <h2>
                    ₹{" "}
                    {money(
                      gst.summary?.output
                        ?.igst
                    )}
                  </h2>
                </div>

              </div>

              <h4>
                GST Document Ledger
              </h4>

              <div className="scroll">

                <table>

                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Document</th>
                      <th>Date</th>
                      <th>Party</th>
                      <th>GSTIN</th>
                      <th>HSN</th>
                      <th>Taxable</th>
                      <th>CGST</th>
                      <th>SGST</th>
                      <th>IGST</th>
                    </tr>
                  </thead>

                  <tbody>

                    {(gst.rows || []).map(
                      (item, index) => (

                        <tr
                          key={
                            item._id ||
                            index
                          }
                        >

                          <td>
                            {item.sourceType}
                          </td>

                          <td>
                            {item.documentNo}
                          </td>

                          <td>
                            {item.date
                              ? new Date(
                                  item.date
                                ).toLocaleDateString(
                                  "en-IN"
                                )
                              : "-"}
                          </td>

                          <td>
                            {item.partyName}
                          </td>

                          <td>
                            {item.partyGSTIN ||
                              "-"}
                          </td>

                          <td>
                            {item.hsn || "-"}
                          </td>

                          <td>
                            ₹{" "}
                            {money(
                              item.taxableAmount
                            )}
                          </td>

                          <td>
                            ₹{" "}
                            {money(
                              item.cgst
                            )}
                          </td>

                          <td>
                            ₹{" "}
                            {money(
                              item.sgst
                            )}
                          </td>

                          <td>
                            ₹{" "}
                            {money(
                              item.igst
                            )}
                          </td>

                        </tr>

                      )
                    )}

                  </tbody>

                </table>

              </div>

            </>
          ) : (
            <div className="muted">
              Loading GST report...
            </div>
          )}

        </div>
      )}

    </main>
  );
}
