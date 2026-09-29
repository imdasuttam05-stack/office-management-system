import React, { useEffect, useMemo, useState } from "react";

const API = (
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com"
).replace(/\/+$/, "");

const auth = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken") ||
    ""
  }`,
});

async function api(path, opt = {}) {
  const response = await fetch(`${API}/api/inventory${path}`, {
    ...opt,
    headers: {
      ...auth(),
      ...(opt.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

const today = () => new Date().toISOString().slice(0, 10);

const money = (value) =>
  Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/* =========================================================
   PRODUCT TYPE HELPERS
========================================================= */

function normalizeType(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

function getProductType(product) {
  return normalizeType(
    product?.itemType ??
      product?.type ??
      product?.productType ??
      product?.stockType ??
      product?.categoryType ??
      product?.inventoryType ??
      ""
  );
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

function getProductUnit(product) {
  return (
    product?.unit ||
    product?.stockUnit ||
    product?.unitName ||
    "KG"
  );
}

function getProductRate(product) {
  return (
    product?.purchaseRate ??
    product?.rate ??
    product?.costRate ??
    product?.openingRate ??
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

/* =========================================================
   INPUT
========================================================= */

function Input({ label, ...props }) {
  return (
    <label className="mf">
      <span>{label}</span>
      <input {...props} />
    </label>
  );
}

/* =========================================================
   SELECT
========================================================= */

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
  allowedTypes = [],
}) {
  const normalizedAllowedTypes = useMemo(
    () => allowedTypes.map(normalizeType),
    [allowedTypes]
  );

  const options = useMemo(() => {
    return products.filter((product) => {
      const productType = getProductType(product);

      /*
       * If no type restriction is provided,
       * show every product.
       */
      if (!normalizedAllowedTypes.length) {
        return true;
      }

      /*
       * If Product Master does not have an item type,
       * keep the product selectable.
       *
       * This prevents an empty dropdown when older
       * Product Master records do not have itemType.
       */
      if (!productType) {
        return true;
      }

      return normalizedAllowedTypes.includes(productType);
    });
  }, [products, normalizedAllowedTypes]);

  function selectProduct(index, productId) {
    const product = products.find(
      (item) => String(getProductId(item)) === String(productId)
    );

    if (!product) {
      setItems((current) =>
        current.map((item, rowIndex) =>
          rowIndex === index
            ? {
                ...item,
                itemId: "",
                itemName: "",
              }
            : item
        )
      );

      return;
    }

    setItems((current) =>
      current.map((item, rowIndex) =>
        rowIndex === index
          ? {
              ...item,
              itemId: getProductId(product),
              itemName: getProductName(product),
              unit: getProductUnit(product),
              rate:
                item.rate !== undefined &&
                item.rate !== null &&
                item.rate !== ""
                  ? item.rate
                  : getProductRate(product),
              hsn: getProductHSN(product),
              gstRate: getProductGST(product),
              itemType: getProductType(product),
            }
          : item
      )
    );
  }

  return (
    <div className="scroll">
      <table className="line-table">
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
          {items.map((item, index) => {
            const selectedProduct = products.find(
              (product) =>
                String(getProductId(product)) ===
                String(item.itemId || "")
            );

            return (
              <tr key={index}>
                <td>
                  <select
                    value={item.itemId || ""}
                    onChange={(event) =>
                      selectProduct(index, event.target.value)
                    }
                  >
                    <option value="">Select Product</option>

                    {options.map((product) => {
                      const id = getProductId(product);
                      const name = getProductName(product);
                      const code = getProductCode(product);
                      const type = getProductType(product);

                      return (
                        <option key={String(id)} value={id}>
                          {name}
                          {code ? ` (${code})` : ""}
                          {type ? ` — ${type}` : ""}
                        </option>
                      );
                    })}
                  </select>

                  {options.length === 0 && (
                    <div className="dropdown-warning">
                      No matching products found in Product Master.
                    </div>
                  )}
                </td>

                <td>
                  <input
                    value={
                      selectedProduct
                        ? getProductType(selectedProduct)
                        : item.itemType || ""
                    }
                    readOnly
                    placeholder="Type"
                  />
                </td>

                <td>
                  <input
                    value={item.unit || "KG"}
                    readOnly
                  />
                </td>

                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={item.qty ?? ""}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                qty: event.target.value,
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
                    min="0"
                    step="0.01"
                    value={item.rate ?? ""}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                rate: event.target.value,
                              }
                            : row
                        )
                      )
                    }
                  />
                </td>

                <td>
                  <input
                    value={item.batchNo || ""}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                batchNo: event.target.value,
                              }
                            : row
                        )
                      )
                    }
                  />
                </td>

                <td>
                  <input
                    value={item.barcode || ""}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((row, rowIndex) =>
                          rowIndex === index
                            ? {
                                ...row,
                                barcode: event.target.value,
                              }
                            : row
                        )
                      )
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
            );
          })}
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
              <th>Average Rate</th>
              <th>Stock Value</th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty">
                  No stock available.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item._id}>
                  <td>{item.itemName}</td>
                  <td>{item.itemType}</td>
                  <td>{item.location}</td>
                  <td>{item.batchNo || "-"}</td>
                  <td>{money(item.qty)}</td>
                  <td>{item.unit}</td>
                  <td>₹ {money(item.averageRate)}</td>
                  <td>₹ {money(item.stockValue)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
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
     REFRESH DATA
  ======================================================= */

  async function refresh() {
    setErr("");

    try {
      const [
        rawResponse,
        gradeResponse,
        finishedResponse,
        salesResponse,
        jobsResponse,
        productsResponse,
      ] = await Promise.all([
        api("/stock?itemType=RAW_MATERIAL"),

        api("/stock?itemType=GRADE"),

        api("/stock?itemType=FINISHED_GOODS"),

        api("/sales"),

        api("/job-orders"),

        fetch(
          `${API}/api/accounts-masters?type=product`,
          {
            headers: auth(),
          }
        ).then(async (response) => {
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(
              data.message || "Product Master load failed"
            );
          }

          return data;
        }),
      ]);

      setStock([
        ...(rawResponse.items || []),
        ...(gradeResponse.items || []),
        ...(finishedResponse.items || []),
      ]);

      setSales(salesResponse.items || []);

      setJobs(jobsResponse.items || []);

      /*
       * Support different response formats from Accounts Master.
       */
      const productList =
        productsResponse.data ||
        productsResponse.masters ||
        productsResponse.items ||
        productsResponse.products ||
        [];

      setProducts(Array.isArray(productList) ? productList : []);
    } catch (error) {
      setErr(error.message || "Failed to load data.");
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
     SAVE PURCHASE
  ======================================================= */

  async function savePurchase() {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const response = await api("/raw-material-purchases", {
        method: "POST",
        body: JSON.stringify({
          ...purchase,
          lines: pLines,
        }),
      });

      setMsg(response.message || "Purchase posted successfully.");

      setPLines([blank()]);

      await refresh();
    } catch (error) {
      setErr(error.message || "Purchase posting failed.");
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     SAVE JOB ORDER
  ======================================================= */

  async function saveJob(forceType = jobType) {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      if (!job.location) {
        throw new Error("Please select or enter Location.");
      }

      if (!sources.some((item) => item.itemId || item.itemName)) {
        throw new Error(
          "Please select at least one Source Stock item."
        );
      }

      if (!outputs.some((item) => item.itemId || item.itemName)) {
        throw new Error(
          "Please select at least one Output Stock item."
        );
      }

      const response = await api("/job-orders", {
        method: "POST",
        body: JSON.stringify({
          ...job,
          type: forceType,
          sourceItems: sources,
          outputItems: outputs,
        }),
      });

      setMsg(
        response.message ||
          "Job Order posted and stock updated successfully."
      );

      setSources([blank()]);
      setOutputs([blank()]);

      await refresh();
    } catch (error) {
      setErr(error.message || "Job Order posting failed.");
    } finally {
      setBusy(false);
    }
  }

  /* =======================================================
     SAVE SALE
  ======================================================= */

  async function saveSale() {
    setBusy(true);
    setErr("");
    setMsg("");

    try {
      const response = await api("/sales", {
        method: "POST",
        body: JSON.stringify({
          ...sale,
          lines: sLines,
        }),
      });

      setMsg(response.message || "Sale posted successfully.");

      setSLines([
        {
          ...blank(),
          gstRate: "",
          gstType: "CGST_SGST",
        },
      ]);

      await refresh();
    } catch (error) {
      setErr(error.message || "Sale posting failed.");
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
     JOB DROPDOWN INFORMATION
  ======================================================= */

  const sourceAllowedTypes =
    jobType === "GRADING"
      ? ["RAW_MATERIAL"]
      : ["GRADE"];

  const outputAllowedTypes =
    jobType === "GRADING"
      ? ["GRADE"]
      : ["FINISHED_GOODS"];

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

        .tab:hover {
          border-color: #175cd3;
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
        .line-table input,
        .line-table select {
          padding: 9px;
          border: 1px solid #d0d5dd;
          border-radius: 7px;
          box-sizing: border-box;
          width: 100%;
          background: #fff;
        }

        .mf input:focus,
        .mf select:focus,
        .line-table input:focus,
        .line-table select:focus {
          outline: none;
          border-color: #175cd3;
          box-shadow: 0 0 0 2px #175cd320;
        }

        .wide {
          grid-column: span 2;
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

        .danger:hover {
          background: #fecdca;
        }

        .scroll {
          overflow-x: auto;
        }

        table {
          border-collapse: collapse;
          width: 100%;
          min-width: 850px;
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

        .line-table {
          min-width: 1200px;
        }

        .line-table td:first-child {
          min-width: 300px;
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
          border: 1px solid #abefc6;
        }

        .err {
          background: #fef3f2;
          color: #b42318;
          padding: 10px;
          border-radius: 8px;
          margin-bottom: 12px;
          border: 1px solid #fecdca;
        }

        .muted {
          color: #667085;
          font-size: 13px;
        }

        .summary {
          display: flex;
          gap: 25px;
          justify-content: flex-end;
          margin-top: 12px;
        }

        .job-head {
          display: flex;
          gap: 15px;
          align-items: center;
          margin-bottom: 15px;
        }

        .job-head h3 {
          margin: 0;
        }

        .job-type-box {
          min-width: 300px;
        }

        .dropdown-warning {
          margin-top: 5px;
          color: #b54708;
          font-size: 11px;
          font-weight: 600;
        }

        .empty {
          text-align: center;
          color: #667085;
          padding: 30px;
        }

        .job-flow {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 15px;
          margin: 15px 0;
        }

        .flow-box {
          padding: 12px;
          border: 1px solid #d0d5dd;
          border-radius: 10px;
          background: #f8fafc;
        }

        .flow-title {
          font-weight: 700;
          margin-bottom: 4px;
        }

        .flow-subtitle {
          color: #667085;
          font-size: 12px;
        }

        .flow-arrow {
          font-size: 24px;
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }

          .job-flow {
            grid-template-columns: 1fr;
          }

          .flow-arrow {
            text-align: center;
            transform: rotate(90deg);
          }
        }

        @media (max-width: 700px) {
          .grid {
            grid-template-columns: 1fr;
          }

          .wide {
            grid-column: auto;
          }

          .top {
            flex-direction: column;
            align-items: flex-start;
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

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="top">
        <div>
          <h1>Purchase → Production → Sales → GST</h1>

          <div className="muted">
            Raw Stock → Grade Stock → Finished Goods Stock
            with stock-controlled Job Orders.
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

      {/* =================================================
          TABS
      ================================================= */}

      <div className="tabs">
        {tabs.map(([key, name]) => (
          <button
            type="button"
            className={`tab ${tab === key ? "on" : ""}`}
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

      {/* =================================================
          PURCHASE
      ================================================= */}

      {tab === "purchase" && (
        <>
          <div className="card">
            <h3>Raw Material Purchase</h3>

            <div className="grid">
              <Input
                label="Date"
                type="date"
                value={purchase.date}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    date: event.target.value,
                  })
                }
              />

              <Input
                label="Location / Godown"
                value={purchase.location}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    location: event.target.value,
                  })
                }
              />

              <Input
                label="Supplier"
                value={purchase.supplierName}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    supplierName: event.target.value,
                  })
                }
              />

              <Input
                label="Supplier GSTIN"
                value={purchase.supplierGSTIN}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    supplierGSTIN:
                      event.target.value.toUpperCase(),
                  })
                }
              />

              <Input
                label="Invoice No"
                value={purchase.supplierInvoiceNo}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    supplierInvoiceNo: event.target.value,
                  })
                }
              />

              <Input
                label="Invoice Date"
                type="date"
                value={purchase.supplierInvoiceDate}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    supplierInvoiceDate:
                      event.target.value,
                  })
                }
              />

              <Input
                label="Transport Cost"
                type="number"
                value={purchase.transportCost}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    transportCost: event.target.value,
                  })
                }
              />

              <Input
                label="Other Cost"
                type="number"
                value={purchase.otherCost}
                onChange={(event) =>
                  setPurchase({
                    ...purchase,
                    otherCost: event.target.value,
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
              products={products}
              allowedTypes={["RAW_MATERIAL"]}
            />

            <button
              type="button"
              className="btn secondary"
              onClick={() =>
                setPLines([...pLines, blank()])
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

      {(tab === "grading" || tab === "fgjob") && (
        <div className="card">
          <div className="job-head">
            <div>
              <h3>
                {tab === "grading"
                  ? "Grading Job Order"
                  : "Finished Goods Job Order"}
              </h3>

              <div className="muted">
                Select Source Stock and Output Stock from
                Product Master.
              </div>
            </div>

            <div className="job-type-box">
              <Select
                label="Production Type"
                value={jobType}
                onChange={(event) =>
                  setJobType(event.target.value)
                }
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

          {/* =================================================
              JOB FLOW
          ================================================= */}

          <div className="job-flow">
            <div className="flow-box">
              <div className="flow-title">
                Source Stock
              </div>

              <div className="flow-subtitle">
                {jobType === "GRADING"
                  ? "Raw Material — stock will decrease"
                  : "Grade — stock will decrease"}
              </div>
            </div>

            <div className="flow-arrow">→</div>

            <div className="flow-box">
              <div className="flow-title">
                Output Stock
              </div>

              <div className="flow-subtitle">
                {jobType === "GRADING"
                  ? "Grade — stock will increase"
                  : "Finished Goods — stock will increase"}
              </div>
            </div>
          </div>

          {/* =================================================
              JOB HEADER
          ================================================= */}

          <div className="grid">
            <Input
              label="Date"
              type="date"
              value={job.date}
              onChange={(event) =>
                setJob({
                  ...job,
                  date: event.target.value,
                })
              }
            />

            <Input
              label="Location / Godown"
              value={job.location}
              onChange={(event) =>
                setJob({
                  ...job,
                  location: event.target.value,
                })
              }
            />

            <Input
              label="Labour Cost"
              type="number"
              value={job.labourCost}
              onChange={(event) =>
                setJob({
                  ...job,
                  labourCost: event.target.value,
                })
              }
            />

            <Input
              label="Transport Cost"
              type="number"
              value={job.transportCost}
              onChange={(event) =>
                setJob({
                  ...job,
                  transportCost: event.target.value,
                })
              }
            />

            <Input
              label="Other Production Cost"
              type="number"
              value={job.otherCost}
              onChange={(event) =>
                setJob({
                  ...job,
                  otherCost: event.target.value,
                })
              }
            />

            <Input
              label="Notes"
              value={job.notes}
              onChange={(event) =>
                setJob({
                  ...job,
                  notes: event.target.value,
                })
              }
            />
          </div>

          {/* =================================================
              SOURCE STOCK
          ================================================= */}

          <h4>
            Source Stock — will decrease
            {jobType === "GRADING"
              ? " (Raw Material)"
              : " (Grade)"}
          </h4>

          <Lines
            items={sources}
            setItems={setSources}
            products={products}
            allowedTypes={sourceAllowedTypes}
          />

          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              setSources([...sources, blank()])
            }
          >
            + Add Source Item
          </button>

          {/* =================================================
              OUTPUT STOCK
          ================================================= */}

          <h4 style={{ marginTop: 20 }}>
            Output Stock — will increase
            {jobType === "GRADING"
              ? " (Grade)"
              : " (Finished Goods)"}
          </h4>

          <Lines
            items={outputs}
            setItems={setOutputs}
            products={products}
            allowedTypes={outputAllowedTypes}
          />

          <button
            type="button"
            className="btn secondary"
            onClick={() =>
              setOutputs([...outputs, blank()])
            }
          >
            + Add Output Item
          </button>

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

      {/* =================================================
          GRADE STOCK
      ================================================= */}

      {tab === "grade" && (
        <StockTable
          items={stock.filter(
            (item) =>
              normalizeType(item.itemType) === "GRADE"
          )}
          title="Grade Stock"
        />
      )}

      {/* =================================================
          FINISHED GOODS STOCK
      ================================================= */}

      {tab === "fg" && (
        <StockTable
          items={stock.filter(
            (item) =>
              normalizeType(item.itemType) ===
              "FINISHED_GOODS"
          )}
          title="Finished Goods Stock"
        />
      )}

      {/* =================================================
          SALES
      ================================================= */}

      {tab === "sales" && (
        <>
          <div className="card">
            <h3>Finished Goods Sale</h3>

            <div className="grid">
              <Input
                label="Date"
                type="date"
                value={sale.date}
                onChange={(event) =>
                  setSale({
                    ...sale,
                    date: event.target.value,
                  })
                }
              />

              <Input
                label="Location"
                value={sale.location}
                onChange={(event) =>
                  setSale({
                    ...sale,
                    location: event.target.value,
                  })
                }
              />

              <Input
                label="Customer / Party"
                value={sale.customerName}
                onChange={(event) =>
                  setSale({
                    ...sale,
                    customerName: event.target.value,
                  })
                }
              />

              <Input
                label="Customer GSTIN"
                value={sale.customerGSTIN}
                onChange={(event) =>
                  setSale({
                    ...sale,
                    customerGSTIN:
                      event.target.value.toUpperCase(),
                  })
                }
              />

              <Input
                label="Supplier State"
                value={sale.supplierState}
                onChange={(event) =>
                  setSale({
                    ...sale,
                    supplierState: event.target.value,
                  })
                }
              />

              <Input
                label="Place of Supply"
                value={sale.placeOfSupply}
                onChange={(event) =>
                  setSale({
                    ...sale,
                    placeOfSupply: event.target.value,
                  })
                }
              />

              <Input
                label="Customer State"
                value={sale.customerState}
                onChange={(event) =>
                  setSale({
                    ...sale,
                    customerState: event.target.value,
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
                  {sLines.map((item, index) => (
                    <tr key={index}>
                      {[
                        "itemName",
                        "unit",
                        "qty",
                        "rate",
                        "batchNo",
                        "barcode",
                        "hsn",
                        "gstRate",
                      ].map((key) => (
                        <td key={key}>
                          <input
                            type={
                              ["qty", "rate", "gstRate"].includes(
                                key
                              )
                                ? "number"
                                : "text"
                            }
                            value={item[key] || ""}
                            onChange={(event) =>
                              setSLines((current) =>
                                current.map(
                                  (row, rowIndex) =>
                                    rowIndex === index
                                      ? {
                                          ...row,
                                          [key]:
                                            event.target
                                              .value,
                                        }
                                      : row
                                )
                              )
                            }
                          />
                        </td>
                      ))}

                      <td>
                        <select
                          value={item.gstType}
                          onChange={(event) =>
                            setSLines((current) =>
                              current.map(
                                (row, rowIndex) =>
                                  rowIndex === index
                                    ? {
                                        ...row,
                                        gstType:
                                          event.target.value,
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
                            setSLines((current) =>
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
                  {sales.map((item) => (
                    <tr key={item._id}>
                      <td>{item.invoiceNo}</td>

                      <td>
                        {new Date(
                          item.date
                        ).toLocaleDateString("en-IN")}
                      </td>

                      <td>{item.customerName}</td>

                      <td>{item.location}</td>

                      <td>
                        ₹ {money(item.subtotal)}
                      </td>

                      <td>
                        ₹ {money(item.totalCGST)}
                      </td>

                      <td>
                        ₹ {money(item.totalSGST)}
                      </td>

                      <td>
                        ₹ {money(item.totalIGST)}
                      </td>

                      <td>
                        ₹ {money(item.grandTotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =================================================
          GST
      ================================================= */}

      {tab === "gst" && (
        <div className="card">
          <h3>GST Input / Output Summary</h3>

          {gst ? (
            <>
              <div className="grid">
                <div>
                  <b>Input Taxable</b>
                  <h2>
                    ₹ {money(gst.summary?.input?.taxable)}
                  </h2>
                </div>

                <div>
                  <b>Input CGST</b>
                  <h2>
                    ₹ {money(gst.summary?.input?.cgst)}
                  </h2>
                </div>

                <div>
                  <b>Input SGST</b>
                  <h2>
                    ₹ {money(gst.summary?.input?.sgst)}
                  </h2>
                </div>

                <div>
                  <b>Input IGST</b>
                  <h2>
                    ₹ {money(gst.summary?.input?.igst)}
                  </h2>
                </div>

                <div>
                  <b>Output Taxable</b>
                  <h2>
                    ₹ {money(gst.summary?.output?.taxable)}
                  </h2>
                </div>

                <div>
                  <b>Output CGST</b>
                  <h2>
                    ₹ {money(gst.summary?.output?.cgst)}
                  </h2>
                </div>

                <div>
                  <b>Output SGST</b>
                  <h2>
                    ₹ {money(gst.summary?.output?.sgst)}
                  </h2>
                </div>

                <div>
                  <b>Output IGST</b>
                  <h2>
                    ₹ {money(gst.summary?.output?.igst)}
                  </h2>
                </div>
              </div>

              <h4>GST Document Ledger</h4>

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
                    {(gst.rows || []).map((item) => (
                      <tr key={item._id}>
                        <td>{item.sourceType}</td>

                        <td>{item.documentNo}</td>

                        <td>
                          {new Date(
                            item.date
                          ).toLocaleDateString("en-IN")}
                        </td>

                        <td>{item.partyName}</td>

                        <td>
                          {item.partyGSTIN || "-"}
                        </td>

                        <td>{item.hsn || "-"}</td>

                        <td>
                          ₹ {money(item.taxableAmount)}
                        </td>

                        <td>
                          ₹ {money(item.cgst)}
                        </td>

                        <td>
                          ₹ {money(item.sgst)}
                        </td>

                        <td>
                          ₹ {money(item.igst)}
                        </td>
                      </tr>
                    ))}
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
