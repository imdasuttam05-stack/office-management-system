import React,{useEffect,useMemo,useState} from "react";
const API=(import.meta.env.VITE_API_URL||"https://office-management-system-ikx8.onrender.com").replace(/\/+$/,'');
const auth=()=>({"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("token")||""}`});
async function api(path,opt={}){const r=await fetch(`${API}/api/inventory${path}`,{...opt,headers:{...auth(),...(opt.headers||{})}});const d=await r.json();if(!r.ok)throw new Error(d.message||"Request failed");return d}
const today=()=>new Date().toISOString().slice(0,10); const money=n=>Number(n||0).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2});
function Input({label,...p}){return <label className="mf"><span>{label}</span><input {...p}/></label>}
function Lines({
  items,
  setItems,
  products = [],
  allowedTypes = [],
}) {
  /*
   * IMPORTANT:
   * Inventory Master / Accounts Product Master-এর itemType
   * বিভিন্ন নামে আসতে পারে।
   *
   * তাই exact itemType match না করে normalized type ব্যবহার করছি।
   */

  const normalizeType = (value) =>
    String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");

  const getProductType = (p) =>
    normalizeType(
      p.itemType ||
        p.type ||
        p.productType ||
        p.stockType ||
        p.categoryType ||
        ""
    );

  const normalizedAllowedTypes = allowedTypes.map(normalizeType);

  /*
   * Product filtering
   *
   * যদি allowedTypes দেওয়া থাকে:
   *   - matching itemType থাকলে দেখাবে
   *
   * কিন্তু itemType missing হলে product hide করবে না।
   *
   * এতে Accounts Master থেকে তৈরি Product dropdown-এ
   * হারিয়ে যাবে না।
   */
  const options = products.filter((p) => {
    if (!normalizedAllowedTypes.length) return true;

    const type = getProductType(p);

    if (!type) return true;

    return normalizedAllowedTypes.includes(type);
  });

  const getItemId = (p) =>
    p._id ||
    p.id ||
    p.productId ||
    p.itemId ||
    p.stockItemId ||
    p.code ||
    p.name;

  const getItemName = (p) =>
    p.name ||
    p.itemName ||
    p.productName ||
    p.stockItemName ||
    "";

  const getUnit = (p) =>
    p.unit ||
    p.unitName ||
    p.stockUnit ||
    "KG";

  return (
    <div className="scroll">
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Unit</th>
            <th>Qty</th>
            <th>Rate</th>
            <th>Batch</th>
            <th>Barcode</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          {items.map((x, i) => (
            <tr key={i}>
              {/* PRODUCT DROPDOWN */}
              <td>
                <select
                  value={x.itemName || ""}
                  onChange={(e) => {
                    const selectedName = e.target.value;

                    const p = options.find(
                      (v) => getItemName(v) === selectedName
                    );

                    setItems((a) =>
                      a.map((v, j) =>
                        j === i
                          ? {
                              ...v,

                              itemName: selectedName,

                              itemId: p
                                ? getItemId(p)
                                : v.itemId || "",

                              unit: p
                                ? getUnit(p)
                                : v.unit || "KG",

                              rate:
                                v.rate ||
                                p?.purchaseRate ||
                                p?.rate ||
                                p?.salesRate ||
                                "",

                              hsn:
                                p?.hsn ||
                                p?.hsnCode ||
                                v.hsn ||
                                "",

                              gstRate:
                                p?.gstRate ??
                                p?.gst ??
                                v.gstRate ??
                                "",
                            }
                          : v
                      )
                    );
                  }}
                >
                  <option value="">
                    Select Product
                  </option>

                  {options.map((p, index) => {
                    const id = getItemId(p);
                    const name = getItemName(p);
                    const code =
                      p.code ||
                      p.itemCode ||
                      p.productCode ||
                      "";

                    return (
                      <option
                        key={`${id}-${index}`}
                        value={name}
                      >
                        {name}
                        {code ? ` (${code})` : ""}
                      </option>
                    );
                  })}
                </select>
              </td>

              {/* UNIT */}
              <td>
                <input
                  value={x.unit || "KG"}
                  readOnly
                />
              </td>

              {/* QTY */}
              <td>
                <input
                  type="number"
                  min="0"
                  value={x.qty || ""}
                  onChange={(e) =>
                    setItems((a) =>
                      a.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              qty: e.target.value,
                            }
                          : v
                      )
                    )
                  }
                />
              </td>

              {/* RATE */}
              <td>
                <input
                  type="number"
                  min="0"
                  value={x.rate || ""}
                  onChange={(e) =>
                    setItems((a) =>
                      a.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              rate: e.target.value,
                            }
                          : v
                      )
                    )
                  }
                />
              </td>

              {/* BATCH */}
              <td>
                <input
                  value={x.batchNo || ""}
                  onChange={(e) =>
                    setItems((a) =>
                      a.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              batchNo: e.target.value,
                            }
                          : v
                      )
                    )
                  }
                />
              </td>

              {/* BARCODE */}
              <td>
                <input
                  value={x.barcode || ""}
                  onChange={(e) =>
                    setItems((a) =>
                      a.map((v, j) =>
                        j === i
                          ? {
                              ...v,
                              barcode: e.target.value,
                            }
                          : v
                      )
                    )
                  }
                />
              </td>

              {/* DELETE */}
              <td>
                <button
                  type="button"
                  className="danger"
                  onClick={() =>
                    setItems((a) =>
                      a.filter((_, j) => j !== i)
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
```
