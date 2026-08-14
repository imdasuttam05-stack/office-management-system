import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL =
  (import.meta.env.VITE_API_URL ||
    "https://office-management-system-ikx8.onrender.com")
    .trim()
    .replace(/^=+/, "")
    .replace(/\/+$/, "");

const emptyItem = {
  name: "",
  amount: "",
  type: "fixed",
};

export default function Payroll() {
  const [employees, setEmployees] = useState([]);
  const [payrolls, setPayrolls] = useState([]);

  const [form, setForm] = useState({
    employeeId: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),

    workingDays: 26,
    presentDays: 0,
    paidLeaveDays: 0,
    holidayDays: 0,
    weeklyOffDays: 0,
    absentDays: 0,
    lwpDays: 0,
    overtimeHours: 0,

    basicSalary: "",
  });

  const [additions, setAdditions] = useState([
    { ...emptyItem },
  ]);

  const [deductions, setDeductions] = useState([
    { ...emptyItem },
  ]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const headers = {
    Authorization:
      `Bearer ${localStorage.getItem("token")}`,
  };

  const additionTotal = useMemo(
    () =>
      additions.reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      ),
    [additions]
  );

  const deductionTotal = useMemo(
    () =>
      deductions.reduce(
        (sum, item) =>
          sum + Number(item.amount || 0),
        0
      ),
    [deductions]
  );

  const grossSalary =
    Number(form.basicSalary || 0) +
    additionTotal;

  const netSalary =
    Math.max(
      0,
      grossSalary - deductionTotal
    );

  const loadEmployees = async () => {
    try {
      const { data } =
        await axios.get(
          `${API_URL}/api/users`,
          { headers }
        );

      setEmployees(
        (data.users || []).filter(
          (user) =>
            user.isActive !== false
        )
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load employees."
      );
    }
  };

  const loadPayrolls = async () => {
    try {
      const { data } =
        await axios.get(
          `${API_URL}/api/payroll`,
          { headers }
        );

      setPayrolls(
        data.payrolls || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to load payroll."
      );
    }
  };

  useEffect(() => {
    loadEmployees();
    loadPayrolls();
  }, []);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateItem = (
    list,
    setList,
    index,
    key,
    value
  ) => {
    const next = [...list];

    next[index] = {
      ...next[index],
      [key]: value,
    };

    setList(next);
  };

  const addItem = (setList) => {
    setList((prev) => [
      ...prev,
      { ...emptyItem },
    ]);
  };

  const removeItem = (
    list,
    setList,
    index
  ) => {
    if (list.length === 1) {
      setList([{ ...emptyItem }]);
      return;
    }

    setList(
      list.filter(
        (_, i) => i !== index
      )
    );
  };

  const cleanItems = (items) =>
    items
      .filter(
        (item) =>
          String(item.name || "")
            .trim()
      )
      .map((item) => ({
        name:
          String(item.name).trim(),

        amount:
          Number(item.amount || 0),

        type:
          item.type || "fixed",
      }));

  const savePayroll = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        ...form,

        workingDays:
          Number(form.workingDays || 0),

        presentDays:
          Number(form.presentDays || 0),

        paidLeaveDays:
          Number(form.paidLeaveDays || 0),

        holidayDays:
          Number(form.holidayDays || 0),

        weeklyOffDays:
          Number(form.weeklyOffDays || 0),

        absentDays:
          Number(form.absentDays || 0),

        lwpDays:
          Number(form.lwpDays || 0),

        overtimeHours:
          Number(form.overtimeHours || 0),

        basicSalary:
          Number(form.basicSalary || 0),

        additions:
          cleanItems(additions),

        deductions:
          cleanItems(deductions),

        status: "Processed",
      };

      await axios.post(
        `${API_URL}/api/payroll`,
        payload,
        { headers }
      );

      setMessage(
        "Salary processed successfully."
      );

      await loadPayrolls();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to process salary."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f7fb",
        padding: 24,
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <h1
          style={{
            marginBottom: 5,
          }}
        >
          Payroll & Salary
        </h1>

        <p
          style={{
            color: "#667085",
          }}
        >
          Flexible additions, deductions
          and attendance-based payroll.
        </p>

        {message && (
          <div
            style={{
              background: "#ecfdf3",
              color: "#027a48",
              padding: 12,
              borderRadius: 10,
              marginBottom: 15,
            }}
          >
            {message}
          </div>
        )}

        {error && (
          <div
            style={{
              background: "#fef3f2",
              color: "#b42318",
              padding: 12,
              borderRadius: 10,
              marginBottom: 15,
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={savePayroll}>
          <section
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              marginBottom: 18,
            }}
          >
            <h2>Employee & Month</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(220px,1fr))",
                gap: 14,
              }}
            >
              <label>
                Employee
                <select
                  value={form.employeeId}
                  onChange={(e) =>
                    updateForm(
                      "employeeId",
                      e.target.value
                    )
                  }
                  required
                  style={inputStyle}
                >
                  <option value="">
                    Select employee
                  </option>

                  {employees.map(
                    (employee) => (
                      <option
                        key={employee.id}
                        value={employee.id}
                      >
                        {employee.name}{" "}
                        ({employee.mobile})
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Month
                <select
                  value={form.month}
                  onChange={(e) =>
                    updateForm(
                      "month",
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  {Array.from(
                    { length: 12 },
                    (_, i) => (
                      <option
                        key={i + 1}
                        value={i + 1}
                      >
                        {new Date(
                          2000,
                          i
                        ).toLocaleString(
                          "en",
                          {
                            month:
                              "long",
                          }
                        )}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Year
                <input
                  type="number"
                  value={form.year}
                  onChange={(e) =>
                    updateForm(
                      "year",
                      e.target.value
                    )
                  }
                  style={inputStyle}
                />
              </label>
            </div>
          </section>

          <section
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              marginBottom: 18,
            }}
          >
            <h2>Attendance</h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit,minmax(140px,1fr))",
                gap: 12,
              }}
            >
              {[
                ["workingDays", "Working Days"],
                ["presentDays", "Present"],
                ["paidLeaveDays", "Paid Leave"],
                ["holidayDays", "Holiday"],
                ["weeklyOffDays", "Weekly Off"],
                ["absentDays", "Absent"],
                ["lwpDays", "LWP"],
                ["overtimeHours", "Overtime Hours"],
              ].map(
                ([key, label]) => (
                  <label key={key}>
                    {label}

                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={form[key]}
                      onChange={(e) =>
                        updateForm(
                          key,
                          e.target.value
                        )
                      }
                      style={inputStyle}
                    />
                  </label>
                )
              )}
            </div>
          </section>

          <section
            style={sectionStyle}
          >
            <div style={headerRow}>
              <h2>Additions</h2>

              <button
                type="button"
                onClick={() =>
                  addItem(setAdditions)
                }
              >
                + Add
              </button>
            </div>

            <label>
              Basic Salary

              <input
                type="number"
                min="0"
                step="0.01"
                value={form.basicSalary}
                onChange={(e) =>
                  updateForm(
                    "basicSalary",
                    e.target.value
                  )
                }
                style={inputStyle}
                required
              />
            </label>

            {additions.map(
              (item, index) => (
                <ItemRow
                  key={index}
                  item={item}
                  index={index}
                  list={additions}
                  setList={setAdditions}
                  updateItem={updateItem}
                  removeItem={removeItem}
                  type="addition"
                />
              )
            )}
          </section>

          <section
            style={sectionStyle}
          >
            <div style={headerRow}>
              <h2>Deductions</h2>

              <button
                type="button"
                onClick={() =>
                  addItem(
                    setDeductions
                  )
                }
              >
                + Add
              </button>
            </div>

            {deductions.map(
              (item, index) => (
                <ItemRow
                  key={index}
                  item={item}
                  index={index}
                  list={deductions}
                  setList={setDeductions}
                  updateItem={updateItem}
                  removeItem={removeItem}
                  type="deduction"
                />
              )
            )}
          </section>

          <section
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 20,
              marginBottom: 18,
            }}
          >
            <h2>Salary Summary</h2>

            <SummaryRow
              label="Basic Salary"
              value={form.basicSalary}
            />

            <SummaryRow
              label="Addition"
              value={additionTotal}
            />

            <SummaryRow
              label="Gross Salary"
              value={grossSalary}
            />

            <SummaryRow
              label="Total Deduction"
              value={deductionTotal}
            />

            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop:
                  "2px solid #e4e7ec",
              }}
            >
              <SummaryRow
                label="Net Salary"
                value={netSalary}
                strong
              />
            </div>
          </section>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 14,
              border: "none",
              borderRadius: 10,
              cursor:
                loading
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 700,
            }}
          >
            {loading
              ? "Processing..."
              : "Process Salary"}
          </button>
        </form>

        <section
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: 20,
            marginTop: 20,
          }}
        >
          <h2>Recent Payroll</h2>

          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr>
                  <th style={thStyle}>
                    Employee
                  </th>

                  <th style={thStyle}>
                    Month
                  </th>

                  <th style={thStyle}>
                    Gross
                  </th>

                  <th style={thStyle}>
                    Deduction
                  </th>

                  <th style={thStyle}>
                    Net
                  </th>

                  <th style={thStyle}>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>
                {payrolls.map(
                  (payroll) => (
                    <tr
                      key={
                        payroll._id
                      }
                    >
                      <td
                        style={tdStyle}
                      >
                        {
                          payroll
                            .employeeId
                            ?.name
                        }
                      </td>

                      <td
                        style={tdStyle}
                      >
                        {payroll.month}/
                        {payroll.year}
                      </td>

                      <td
                        style={tdStyle}
                      >
                        ₹
                        {Number(
                          payroll.grossSalary
                        ).toFixed(2)}
                      </td>

                      <td
                        style={tdStyle}
                      >
                        ₹
                        {Number(
                          payroll.totalDeductions
                        ).toFixed(2)}
                      </td>

                      <td
                        style={{
                          ...tdStyle,
                          fontWeight: 700,
                        }}
                      >
                        ₹
                        {Number(
                          payroll.netSalary
                        ).toFixed(2)}
                      </td>

                      <td
                        style={tdStyle}
                      >
                        {payroll.status}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  index,
  list,
  setList,
  updateItem,
  removeItem,
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "1fr 180px 150px 90px",
        gap: 10,
        marginTop: 12,
      }}
    >
      <input
        placeholder="Item name"
        value={item.name}
        onChange={(e) =>
          updateItem(
            list,
            setList,
            index,
            "name",
            e.target.value
          )
        }
        style={inputStyle}
      />

      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="Amount"
        value={item.amount}
        onChange={(e) =>
          updateItem(
            list,
            setList,
            index,
            "amount",
            e.target.value
          )
        }
        style={inputStyle}
      />

      <select
        value={item.type}
        onChange={(e) =>
          updateItem(
            list,
            setList,
            index,
            "type",
            e.target.value
          )
        }
        style={inputStyle}
      >
        <option value="fixed">
          Fixed
        </option>

        <option value="variable">
          Variable
        </option>
      </select>

      <button
        type="button"
        onClick={() =>
          removeItem(
            list,
            setList,
            index
          )
        }
      >
        Remove
      </button>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        padding: "8px 0",
        fontSize: strong ? 18 : 15,
        fontWeight:
          strong ? 700 : 400,
      }}
    >
      <span>{label}</span>

      <span>
        ₹
        {Number(
          value || 0
        ).toFixed(2)}
      </span>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  marginTop: 6,
  padding: 11,
  border:
    "1px solid #d0d5dd",
  borderRadius: 9,
  boxSizing: "border-box",
};

const sectionStyle = {
  background: "#fff",
  borderRadius: 16,
  padding: 20,
  marginBottom: 18,
};

const headerRow = {
  display: "flex",
  justifyContent:
    "space-between",
  alignItems: "center",
};

const thStyle = {
  textAlign: "left",
  padding: 12,
  borderBottom:
    "1px solid #eaecf0",
};

const tdStyle = {
  padding: 12,
  borderBottom:
    "1px solid #f2f4f7",
};
