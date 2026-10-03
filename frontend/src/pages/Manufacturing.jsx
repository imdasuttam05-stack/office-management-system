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
  return product?.hsn || product?.hsnCode || product?.sac || "";
}

function getProductGST(product) {
  return product?.gstRate ?? product?.gst ?? product?.taxRate ?? "";
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
   PRODUCT LINES
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

  const options = useMemo(() => {
    const seen = new Set();

    return sourceList.filter((product) => {
      const name = getProductName(product);

      if (!name) return false;

      const id = getProductId(product);
      const key = `${id}-${name}`;

      if (seen.has(key)) return false;

      const type = getProductType(product);

      /*
       * If stock/product type is available,
       * validate it.
       *
       * If old records do not have type,
       * keep them visible.
       */
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

  function selectProduct(index, name) {
    const product = options.find(
      (item) => getProductName(item) === name
    );

    if (!product) {
      updateLine(index, {
        itemName: name,
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

                <select
                  value={row.itemName || ""}
                  onChange={(e) =>
                    selectProduct(
                      index,
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Select Raw Material Stock
                  </option>

                  {options.map((product, productIndex) => {

                    const id = getProductId(product);
                    const name = getProductName(product);
                    const code = getProductCode(product);
                    const type = getProductType(product);

                    return (
                      <option
                        key={
                          id ||
                          `${name}-${productIndex}`
                        }
                        value={name}
                      >
                        {name}
                        {code ? ` (${code})` : ""}
                        {type ? ` — ${type}` : ""}
                      </option>
                    );
                  })}

                </select>

                {!options.length && (
                  <div className="dropdown-help">
                    {emptyMessage}
                  </div>
                )}

              </td>

              <td>
                <input
                  value={row.itemType || ""}
                  readOnly
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
                        (_, rowIndex) =>
                          rowIndex !== index
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
   MAIN
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

  const [products, setProducts] = useState([]);

  const [rawStock, setRawStock] = useState([]);
  const [gradeStock, setGradeStock] = useState([]);
  const [finishedStock, setFinishedStock] = useState([]);

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

  const [pLines, setPLines] = useState([
    blank(),
  ]);

  /* =======================================================
     JOB
  ======================================================= */

  const [job, setJob] = useState({
    date: today(),
    location: "",
    labourCost: "",
    transportCost: "",
    otherCost: "",
    notes: "",
  });

  const [sources, setSources] = useState([
    blank(),
  ]);

  const [outputs, setOutputs] = useState([
    blank(),
  ]);

  const [jobType, setJobType] = useState(
    "GRADING"
  );

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
     LOAD PRODUCT MASTER
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
        data.message ||
          "Product Master load failed"
      );
    }

    return extractArray(data);
  }

  /* =======================================================
     LOAD STOCK
  ======================================================= */

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

  /* =======================================================
     REFRESH
  ======================================================= */

  async function refresh() {

    try {

      setErr("");

      const [
        raw,
        grade,
        finished,
        salesResponse,
        productList,
      ] = await Promise.all([

        loadStock("RAW_MATERIAL"),

        loadStock("GRADE"),

        loadStock("FINISHED_GOODS"),

        api("/sales"),

        loadProducts(),

      ]);

      setRawStock(raw);
      setGradeStock(grade);
      setFinishedStock(finished);

      setSales(
        salesResponse?.items ||
          salesResponse?.data ||
          salesResponse?.sales ||
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
        .catch((error) =>
          setErr(error.message)
        );

    }

  }, [tab]);

  /* =======================================================
     PRODUCT FILTERS
  ======================================================= */

  const allProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          getProductName(product)
      ),
    [products]
  );

  const rawProducts = useMemo(
    () =>
      allProducts.filter((product) => {

        const type =
          getProductType(product);

        return (
          !type ||
          type === "RAW_MATERIAL" ||
          type === "RAW"
        );

      }),
    [allProducts]
  );

  const gradeProducts = useMemo(
    () =>
      allProducts.filter((product) => {

        const type =
          getProductType(product);

        return (
          !type ||
          type === "GRADE" ||
          type === "GRADE_STOCK"
        );

      }),
    [allProducts]
  );

  const finishedProducts = useMemo(
    () =>
      allProducts.filter((product) => {

        const type =
          getProductType(product);

        return (
          !type ||
          type === "FINISHED_GOODS" ||
          type === "FINISHED_PRODUCT" ||
          type === "FINISHED"
        );

      }),
    [allProducts]
  );

  /* =======================================================
     PURCHASE SAVE
  ======================================================= */

  async function savePurchase() {

    setBusy(true);
    setErr("");
    setMsg("");

    try {

      const result =
        await api(
          "/raw-material-purchases",
          {
            method: "POST",
            body: JSON.stringify({
              ...purchase,
              lines: pLines,
            }),
          }
        );

      setMsg(
        result.message ||
          "Purchase posted successfully."
      );

      setPLines([blank()]);

      await refresh();

    } catch (error) {

      setErr(error.message);

    } finally {

      setBusy(false);

    }
  }

  /* =======================================================
     JOB SAVE
  ======================================================= */

  async function saveJob(type) {

    setBusy(true);
    setErr("");
    setMsg("");

    try {

      const validSources =
        sources.filter(
          (line) =>
            line.itemName &&
            Number(line.qty) > 0
        );

      const validOutputs =
        outputs.filter(
          (line) =>
            line.itemName &&
            Number(line.qty) > 0
        );

      if (!validSources.length) {
        throw new Error(
          "Please select Source Stock item and enter quantity."
        );
      }

      if (!validOutputs.length) {
        throw new Error(
          "Please select Output Stock item and enter quantity."
        );
      }

      /*
       * FINISHED GOODS:
       *
       * Source = RAW MATERIAL
       * Output = FINISHED GOODS
       *
       * GRADING:
       *
       * Source = RAW MATERIAL
       * Output = GRADE
       */

      const payload = {

        ...job,

        type,

        sourceItems:
          validSources.map((line) => ({
            itemId:
              line.itemId || "",

            itemName:
              line.itemName,

            itemType:
              line.itemType ||
              "RAW_MATERIAL",

            unit:
              line.unit || "KG",

            qty:
              Number(line.qty || 0),

            rate:
              Number(line.rate || 0),

            batchNo:
              line.batchNo || "",

            barcode:
              line.barcode || "",
          })),

        outputItems:
          validOutputs.map((line) => ({
            itemId:
              line.itemId || "",

            itemName:
              line.itemName,

            itemType:
              line.itemType ||
              (
                type === "GRADING"
                  ? "GRADE"
                  : "FINISHED_GOODS"
              ),

            unit:
              line.unit || "KG",

            qty:
              Number(line.qty || 0),

            rate:
              Number(line.rate || 0),

            batchNo:
              line.batchNo || "",

            barcode:
              line.barcode || "",
          })),

      };

      const result =
        await api(
          "/job-orders",
          {
            method: "POST",
            body: JSON.stringify(payload),
          }
        );

      setMsg(
        result.message ||
          `${type} Job Order posted successfully.`
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
     SALE SAVE
  ======================================================= */

  async function saveSale() {

    setBusy(true);
    setErr("");
    setMsg("");

    try {

      const result =
        await api(
          "/sales",
          {
            method: "POST",
            body: JSON.stringify({
              ...sale,
              lines: sLines,
            }),
          }
        );

      setMsg(
        result.message ||
          "Sale posted successfully."
      );

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
          grid-template-columns:
            repeat(4, minmax(0, 1fr));
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

        .btn {
          border: 0;
          border-radius: 8px;
          padding: 10px 14px;
          background: #175cd3;
          color: white;
          font-weight: 700;
          cursor: pointer;
        }

        .btn:disabled {
          opacity: .6;
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
          color: #b42318;
          font-size: 11px;
        }

        .job-head {
          display: flex;
          gap: 20px;
          align-items: flex-end;
          margin-bottom: 15px;
        }

        .job-type {
          min-width: 350px;
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
          font-weight: 800;
          font-size: 13px;
        }

        .workflow-sub {
          margin-top: 5px;
          color: #667085;
          font-size: 12px;
        }

        .workflow-arrow {
          font-size: 28px;
          font-weight: 800;
        }

        @media(max-width: 1000px) {

          .grid {
            grid-template-columns:
              repeat(2, minmax(0, 1fr));
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

          .job-type {
            min-width: 0;
          }

        }

      `}</style>

      {/* HEADER */}

      <div className="top">

        <div>

          <h1>
            Purchase → Production → Sales → GST
          </h1>

          <div className="muted">
            Raw Material → Production → Grade /
            Finished Goods → Sales
          </div>

        </div>

        <button
          type="button"
          className="btn secondary"
          onClick={refresh}
        >
          Refresh
        </button>

      </div>

      {/* TABS */}

      <div className="tabs">

        {tabs.map(([key, name]) => (

          <button
            type="button"
            key={key}
            className={
              `tab ${tab === key ? "on" : ""}`
            }
            onClick={() => {
              setTab(key);
              setMsg("");
              setErr("");
            }}
          >
            {name}
          </button>

        ))}

      </div>

      {msg && (
        <div className="msg">
          {msg}
        </div>
      )}

      {err && (
        <div className="err">
          {err}
        </div>
      )}

      {/* =================================================
          PURCHASE
      ================================================= */}

      {tab === "purchase" && (
        <>

          <div className="card">

            <h3>
              Raw Material Purchase
            </h3>

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
                    location:
                      e.target.value,
                  })
                }
              />

              <Input
                label="Supplier"
                value={purchase.supplierName}
                onChange={(e) =>
                  setPurchase({
                    ...purchase,
                    supplierName:
                      e.target.value,
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
                value={
                  purchase.supplierInvoiceDate
                }
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
                    otherCost:
                      e.target.value,
                  })
                }
              />

            </div>

          </div>

          <div className="card">

            <h3>
              Raw Material Lines
            </h3>

            <Lines
              items={pLines}
              setItems={setPLines}
              products={rawProducts}
              stockProducts={[]}
              allowedTypes={[
                "RAW_MATERIAL",
                "RAW",
              ]}
              emptyMessage={
                "No Raw Material product found."
              }
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

      {/* =================================================
          JOB ORDER
      ================================================= */}

      {(tab === "grading" ||
        tab === "fgjob") && (

        <div className="card">

          <div className="job-head">

            <div>
              <h3 style={{ margin: 0 }}>
                {jobType === "GRADING"
                  ? "Grading Job Order"
                  : "Finished Goods Job Order"}
              </h3>

              <div className="muted">
                Select Job Order Type first.
              </div>
            </div>

            <div className="job-type">

              <Select
                label="Job Order Type"
                value={jobType}
                onChange={(e) => {

                  const value =
                    e.target.value;

                  setJobType(value);

                  setSources([
                    blank(),
                  ]);

                  setOutputs([
                    blank(),
                  ]);

                }}
              >

                <option value="GRADING">
                  GRADING: Raw Material → Grade
                </option>

                <option value="FINISHED_GOODS">
                  FINISHED GOODS: Raw Material → Finished Goods
                </option>

              </Select>

            </div>

          </div>

          {/* WORKFLOW */}

          <div className="workflow">

            <div className="workflow-box">

              <div className="workflow-title">
                Source Stock — will decrease
              </div>

              <div className="workflow-sub">
                Raw Material
              </div>

            </div>

            <div className="workflow-arrow">
              →
            </div>

            <div className="workflow-box">

              <div className="workflow-title">
                Output Stock — will increase
              </div>

              <div className="workflow-sub">

                {jobType === "GRADING"
                  ? "Grade"
                  : "Finished Goods"}

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
                  location:
                    e.target.value,
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
                  labourCost:
                    e.target.value,
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
                  otherCost:
                    e.target.value,
                })
              }
            />

            <Input
              label="Notes"
              value={job.notes}
              onChange={(e) =>
                setJob({
                  ...job,
                  notes:
                    e.target.value,
                })
              }
            />

          </div>

          {/* SOURCE */}

          <div className="card">

            <h4>
              Source Stock
              <span
                style={{
                  marginLeft: 8,
                  color: "#b42318",
                }}
              >
                — will decrease
              </span>
            </h4>

            {/*
             * IMPORTANT:
             *
             * BOTH GRADING AND FINISHED GOODS
             * use RAW MATERIAL as source.
             */}

            <Lines
              items={sources}
              setItems={setSources}
              /*
               * Source Stock always comes from actual RAW MATERIAL stock
               * for both GRADING and FINISHED GOODS production.
               */
              products={[]}
              stockProducts={rawStock.map((stock) => ({
                ...stock,
                itemType:
                  getProductType(stock) ||
                  "RAW_MATERIAL",
              }))}
              allowedTypes={[
                "RAW_MATERIAL",
                "RAW",
              ]}
              emptyMessage={
                rawStock.length
                  ? "No Raw Material stock available."
                  : "No Raw Material stock found. Post a Raw Material Purchase first."
              }
            />

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

          {/* OUTPUT */}

          <div className="card">

            <h4>
              Output Stock
              <span
                style={{
                  marginLeft: 8,
                  color: "#027a48",
                }}
              >
                — will increase
              </span>
            </h4>

            {jobType === "GRADING" ? (

              <Lines
                items={outputs}
                setItems={setOutputs}
                products={gradeProducts}
                stockProducts={[]}
                allowedTypes={[
                  "GRADE",
                  "GRADE_STOCK",
                ]}
                emptyMessage={
                  "No Grade product found in Product Master."
                }
              />

            ) : (

              <Lines
                items={outputs}
                setItems={setOutputs}
                products={finishedProducts}
                stockProducts={[]}
                allowedTypes={[
                  "FINISHED_GOODS",
                  "FINISHED_PRODUCT",
                  "FINISHED",
                ]}
                emptyMessage={
                  "No Finished Goods product found. Create Finished Goods in Accounts → Product Master."
                }
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
                  jobType ===
                  "FINISHED_GOODS"
                    ? "FINISHED_GOODS"
                    : "GRADING";

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

      {/* =================================================
          GRADE STOCK
      ================================================= */}

      {tab === "grade" && (
        <StockTable
          items={gradeStock}
          title="Grade Stock"
        />
      )}

      {/* =================================================
          FINISHED GOODS STOCK
      ================================================= */}

      {tab === "fg" && (
        <StockTable
          items={finishedStock}
          title="Finished Goods Stock"
        />
      )}

      {/* =================================================
          SALES
      ================================================= */}

      {tab === "sales" && (
        <>
          <div className="card">

            <h3>
              Finished Goods Sale
            </h3>

            <div className="grid">

              <Input
                label="Date"
                type="date"
                value={sale.date}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    date:
                      e.target.value,
                  })
                }
              />

              <Input
                label="Location"
                value={sale.location}
                onChange={(e) =>
                  setSale({
                    ...sale,
                    location:
                      e.target.value,
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

            <h3>
              Sale Lines
            </h3>

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

                  {sLines.map(
                    (line, index) => (

                      <tr key={index}>

                        <td>

                          <select
                            value={
                              line.itemName ||
                              ""
                            }
                            onChange={(e) => {

                              const name =
                                e.target
                                  .value;

                              const product =
                                finishedProducts.find(
                                  (item) =>
                                    getProductName(
                                      item
                                    ) === name
                                );

                              setSLines(
                                (current) =>
                                  current.map(
                                    (
                                      row,
                                      rowIndex
                                    ) =>
                                      rowIndex ===
                                      index
                                        ? {
                                            ...row,
                                            itemId:
                                              getProductId(
                                                product
                                              ),
                                            itemName:
                                              name,
                                            itemType:
                                              "FINISHED_GOODS",
                                            unit:
                                              getProductUnit(
                                                product
                                              ),
                                            rate:
                                              row.rate ||
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
                                        : row
                                  )
                              );

                            }}
                          >

                            <option value="">
                              Select Finished Goods
                            </option>

                            {finishedProducts.map(
                              (
                                product,
                                productIndex
                              ) => (

                                <option
                                  key={
                                    getProductId(
                                      product
                                    ) ||
                                    `${getProductName(
                                      product
                                    )}-${productIndex}`
                                  }
                                  value={getProductName(
                                    product
                                  )}
                                >
                                  {
                                    getProductName(
                                      product
                                    )
                                  }
                                  {getProductCode(
                                    product
                                  )
                                    ? ` (${getProductCode(
                                        product
                                      )})`
                                    : ""}
                                </option>

                              )
                            )}

                          </select>

                        </td>

                        <td>
                          <input
                            value={
                              line.unit ||
                              "KG"
                            }
                            readOnly
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            value={
                              line.qty || ""
                            }
                            onChange={(e) =>
                              setSLines(
                                (current) =>
                                  current.map(
                                    (
                                      row,
                                      rowIndex
                                    ) =>
                                      rowIndex ===
                                      index
                                        ? {
                                            ...row,
                                            qty:
                                              e.target
                                                .value,
                                          }
                                        : row
                                  )
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            value={
                              line.rate || ""
                            }
                            onChange={(e) =>
                              setSLines(
                                (current) =>
                                  current.map(
                                    (
                                      row,
                                      rowIndex
                                    ) =>
                                      rowIndex ===
                                      index
                                        ? {
                                            ...row,
                                            rate:
                                              e.target
                                                .value,
                                          }
                                        : row
                                  )
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            value={
                              line.batchNo ||
                              ""
                            }
                            onChange={(e) =>
                              setSLines(
                                (current) =>
                                  current.map(
                                    (
                                      row,
                                      rowIndex
                                    ) =>
                                      rowIndex ===
                                      index
                                        ? {
                                            ...row,
                                            batchNo:
                                              e.target
                                                .value,
                                          }
                                        : row
                                  )
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            value={
                              line.barcode ||
                              ""
                            }
                            onChange={(e) =>
                              setSLines(
                                (current) =>
                                  current.map(
                                    (
                                      row,
                                      rowIndex
                                    ) =>
                                      rowIndex ===
                                      index
                                        ? {
                                            ...row,
                                            barcode:
                                              e.target
                                                .value,
                                          }
                                        : row
                                  )
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            value={
                              line.hsn || ""
                            }
                            onChange={(e) =>
                              setSLines(
                                (current) =>
                                  current.map(
                                    (
                                      row,
                                      rowIndex
                                    ) =>
                                      rowIndex ===
                                      index
                                        ? {
                                            ...row,
                                            hsn:
                                              e.target
                                                .value,
                                          }
                                        : row
                                  )
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            value={
                              line.gstRate ||
                              ""
                            }
                            onChange={(e) =>
                              setSLines(
                                (current) =>
                                  current.map(
                                    (
                                      row,
                                      rowIndex
                                    ) =>
                                      rowIndex ===
                                      index
                                        ? {
                                            ...row,
                                            gstRate:
                                              e.target
                                                .value,
                                          }
                                        : row
                                  )
                              )
                            }
                          />
                        </td>

                        <td>

                          <select
                            value={
                              line.gstType ||
                              "CGST_SGST"
                            }
                            onChange={(e) =>
                              setSLines(
                                (current) =>
                                  current.map(
                                    (
                                      row,
                                      rowIndex
                                    ) =>
                                      rowIndex ===
                                      index
                                        ? {
                                            ...row,
                                            gstType:
                                              e.target
                                                .value,
                                          }
                                        : row
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
                              setSLines(
                                (current) =>
                                  current.filter(
                                    (
                                      _,
                                      rowIndex
                                    ) =>
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

                    )
                  )}

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
                    gstType:
                      "CGST_SGST",
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
        </>
      )}

      {/* =================================================
          GST
      ================================================= */}

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
                      (row, index) => (

                        <tr
                          key={
                            row._id ||
                            index
                          }
                        >

                          <td>
                            {row.sourceType}
                          </td>

                          <td>
                            {row.documentNo}
                          </td>

                          <td>
                            {row.date
                              ? new Date(
                                  row.date
                                ).toLocaleDateString(
                                  "en-IN"
                                )
                              : "-"}
                          </td>

                          <td>
                            {row.partyName}
                          </td>

                          <td>
                            {row.partyGSTIN ||
                              "-"}
                          </td>

                          <td>
                            {row.hsn || "-"}
                          </td>

                          <td>
                            ₹{" "}
                            {money(
                              row.taxableAmount
                            )}
                          </td>

                          <td>
                            ₹{" "}
                            {money(row.cgst)}
                          </td>

                          <td>
                            ₹{" "}
                            {money(row.sgst)}
                          </td>

                          <td>
                            ₹{" "}
                            {money(row.igst)}
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
