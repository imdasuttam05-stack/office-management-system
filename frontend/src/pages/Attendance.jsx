import React, { useEffect, useMemo, useRef, useState } from "react";
import { hrApi } from "../lib/hrApi.js";

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function monthRange(value) {
  const [y, m] = value.split("-").map(Number);
  const next = new Date(Date.UTC(y, m, 1));
  return {
    from: `${value}-01`,
    to: next.toISOString().slice(0, 10)
  };
}

function minutes(t) {
  if (!t) return null;

  const m = String(t).match(
    /(\d{1,2})[:.](\d{2})\s*(AM|PM)?/i
  );

  if (!m) return null;

  let h = Number(m[1]);
  const mm = Number(m[2]);
  const ap = m[3]?.toUpperCase();

  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;

  return h * 60 + mm;
}

function hoursWorked(a) {
  const i = minutes(a.checkIn);
  const o = minutes(a.checkOut);

  if (i === null || o === null) return "--";

  let x = o - i;

  if (x < 0) x += 1440;

  return `${Math.floor(x / 60)}h ${x % 60}m`;
}

/* OT decimal hours -> h m */
function formatOT(value) {
  const totalMinutes = Math.round(Number(value || 0) * 60);

  if (totalMinutes <= 0) return "0h 00m";

  return `${Math.floor(totalMinutes / 60)}h ${String(
    totalMinutes % 60
  ).padStart(2, "0")}m`;
}

/* Cutting minutes -> h m */
function formatCutting(value) {
  const totalMinutes = Math.round(Number(value || 0));

  if (totalMinutes <= 0) return "0h 00m";

  return `${Math.floor(totalMinutes / 60)}h ${String(
    totalMinutes % 60
  ).padStart(2, "0")}m`;
}

function normalizeAttendanceDate(value) {
  if (value === null || value === undefined || value === "") return null;

  // Excel serial dates / accidental time-only decimals
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1) return null;

    const excelEpoch = Date.UTC(1899, 11, 30);
    const d = new Date(excelEpoch + Math.round(value * 86400000));
    if (Number.isNaN(d.getTime()) || d.getUTCFullYear() < 2000) return null;
    return d;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime()) || value.getFullYear() < 2000) return null;
    return value;
  }

  const raw = String(value).trim();

  // YYYY-MM-DD
  let m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
    return d.getUTCFullYear() >= 2000 ? d : null;
  }

  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  m = raw.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
    return d.getUTCFullYear() >= 2000 ? d : null;
  }

  const d = new Date(raw);
  if (Number.isNaN(d.getTime()) || d.getFullYear() < 2000) return null;
  return d;
}

function dateKey(value) {
  const d = normalizeAttendanceDate(value);
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtDate(d) {
  const normalized = normalizeAttendanceDate(d);
  if (!normalized) return "-";

  return normalized.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function now12() {
  const d = new Date();
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "PM" : "AM";

  h = h % 12 || 12;

  return `${String(h).padStart(2, "0")}:${m} ${ap}`;
}

function shortStatus(x) {
  return x === "Present"
    ? "P"
    : x === "Half Day"
    ? "HD"
    : x === "Absent"
    ? "A"
    : x === "Leave"
    ? "L"
    : x === "Holiday"
    ? "H"
    : "WO";
}

function statusStyle(x) {
  if (x === "Present")
    return {
      background: "#dcfce7",
      color: "#166534"
    };

  if (x === "Absent")
    return {
      background: "#fee2e2",
      color: "#991b1b"
    };

  if (x === "Half Day")
    return {
      background: "#fef3c7",
      color: "#92400e"
    };

  if (x === "Leave")
    return {
      background: "#e0e7ff",
      color: "#3730a3"
    };

  return {
    background: "#eef2f7",
    color: "#475467"
  };
}

export default function Attendance() {
  const today = isoToday();

  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState(
    today.slice(0, 7)
  );

  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [settings, setSettings] = useState(null);

  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("All Locations");
  const [status, setStatus] = useState("All");
  const [view, setView] = useState("day");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [showSettings, setShowSettings] = useState(false);
  const [showShift, setShowShift] = useState(false);

  const [shiftForm, setShiftForm] = useState({
    name: "",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    graceMinutes: 10,
    overtimeAfterMinutes: 0
  });

  const [modal, setModal] = useState(null);

  const fileRef = useRef(null);

  async function load() {
    try {
      setError("");

      const range =
        view === "day"
          ? {
              from: selectedDate,
              to: new Date(
                new Date(`${selectedDate}T00:00:00Z`).getTime() +
                  86400000
              )
                .toISOString()
                .slice(0, 10)
            }
          : monthRange(selectedMonth);

      const [e, a, s] = await Promise.all([
        hrApi.employees(),
        hrApi.attendance(
          `?from=${range.from}&to=${range.to}&includeStaff=1`
        ),
        hrApi.attendanceSettings()
      ]);

      setEmployees(e.employees || []);
      setRows(a.attendance || []);
      setSettings(s.settings);
      setShifts(s.shifts || []);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, [selectedDate, selectedMonth, view]);

  const locations = useMemo(
    () => [
      "All Locations",
      ...new Set(
        employees
          .map((e) => e.workLocation || e.location)
          .filter(Boolean)
      )
    ],
    [employees]
  );

  const filtered = useMemo(
    () =>
      rows.filter((r) => {
        const emp = r.employeeId || {};
        const q = search.toLowerCase();

        const loc =
          r.workLocation ||
          emp.workLocation ||
          emp.location ||
          "";

        return (
          (!q ||
            `${emp.name} ${emp.employeeCode}`
              .toLowerCase()
              .includes(q)) &&
          (location === "All Locations" || loc === location) &&
          (status === "All" || r.status === status)
        );
      }),
    [rows, search, location, status]
  );

  const summary = useMemo(() => {
    const dayRows = rows.filter(
      (r) =>
        dateKey(r.date) ===
        selectedDate
    );

    const staff =
      location === "All Locations"
        ? employees
        : employees.filter(
            (e) =>
              (e.workLocation || e.location) === location
          );

    const overtimeMinutes = dayRows.reduce(
      (n, x) =>
        n + Math.round(Number(x.overtimeHours || 0) * 60),
      0
    );

    const cuttingMinutes = dayRows.reduce(
      (n, x) => n + Number(x.cuttingMinutes || 0),
      0
    );

    return {
      totalStaff: staff.length,

      present: dayRows.filter(
        (x) => x.status === "Present"
      ).length,

      absent: dayRows.filter(
        (x) => x.status === "Absent"
      ).length,

      halfDay: dayRows.filter(
        (x) => x.status === "Half Day"
      ).length,

      leave: dayRows.filter(
        (x) => x.status === "Leave"
      ).length,

      overtimeMinutes,

      cuttingMinutes,

      punchedIn: dayRows.filter(
        (x) => x.checkIn
      ).length,

      punchedOut: dayRows.filter(
        (x) => x.checkOut
      ).length,

      fine: dayRows.reduce(
        (n, x) => n + Number(x.fineHours || 0),
        0
      )
    };
  }, [
    rows,
    employees,
    selectedDate,
    location
  ]);

  async function upload(e) {
    const file = e.target.files?.[0];

    if (!file) return;

    try {
      setError("");
      setMessage("Uploading Excel...");

      const r = await hrApi.uploadAttendance(file);

      const imported = Number(r.imported || 0);
      const skipped = Number(r.skipped || 0);

      if (imported === 0 && skipped > 0) {
        throw new Error(
          `No records imported. ${skipped} row(s) skipped.` +
            (r.errors?.length
              ? ` First error: ${r.errors[0].message}`
              : "")
        );
      }

      if (skipped > 0) {
        setError(
          `Imported ${imported} record(s), but ${skipped} row(s) were skipped.` +
            (r.errors?.length
              ? ` First error: ${r.errors[0].message}`
              : "")
        );
        setMessage("Import completed with skipped rows.");
      } else {
        setMessage(`Successfully imported ${imported} record(s).`);
      }

      setView("month");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      e.target.value = "";
    }
  }

  async function saveRules() {
    try {
      await hrApi.saveAttendanceSettings(settings);

      setMessage("Attendance rules saved.");
      setShowSettings(false);

      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function createShift() {
    try {
      await hrApi.createShift({
        ...shiftForm,
        breakMinutes: +shiftForm.breakMinutes,
        graceMinutes: +shiftForm.graceMinutes,
        overtimeAfterMinutes:
          +shiftForm.overtimeAfterMinutes
      });

      setShowShift(false);
      setMessage("Shift created.");

      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  function openPunch(row, kind) {
    const emp = row.employeeId || {};

    setModal({
      row,
      kind,
      name: emp.name || "",
      date: dateKey(row.date),

      shiftId:
        row.shiftId?._id ||
        row.shiftId ||
        emp.shiftId ||
        "",

      checkIn: row.checkIn || "",
      checkOut: row.checkOut || "",
      status: row.status || "Absent"
    });
  }

  async function savePunch() {
    if (!modal) return;

    try {
      setError("");

      if (
        modal.status === "Present" &&
        (!modal.checkIn || !modal.checkOut)
      ) {
        throw new Error(
          "Out time is mandatory to mark present."
        );
      }

      await hrApi.saveAttendance({
        employeeId: modal.row.employeeId._id,
        date: modal.date,
        shiftId: modal.shiftId || null,
        checkIn: modal.checkIn,
        checkOut: modal.checkOut,
        status: modal.status,
        note: modal.row.note || ""
      });

      setModal(null);

      setMessage(
        "Attendance saved successfully."
      );

      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  const ruleFor = (k) =>
    settings?.days?.[k] || {
      type: "Working",
      shiftId: null,
      overtimeAllowed: true
    };

  const setDayRule = (k, f, v) =>
    setSettings((s) => ({
      ...s,
      days: {
        ...s.days,
        [k]: {
          ...ruleFor(k),
          [f]: v
        }
      }
    }));

  const saturday =
    settings?.saturday || {
      type: "Working",
      shiftId: null,
      overtimeAllowed: true
    };

  return (
    <main style={S.page}>
      <div style={S.container}>

        <header style={S.header}>
          <div>
            <h1 style={S.h1}>
              Attendance Summary
            </h1>

            <p style={S.sub}>
              All staff are shown, including staff
              with no attendance punch.
            </p>
          </div>

          <div style={S.headerActions}>
            <select
              style={S.input}
              value={location}
              onChange={(e) =>
                setLocation(e.target.value)
              }
            >
              {locations.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>

            <input
              type="date"
              style={S.input}
              value={selectedDate}
              onChange={(e) =>
                setSelectedDate(e.target.value)
              }
            />

            <button
              style={S.btn2}
              onClick={() =>
                setShowSettings((v) => !v)
              }
            >
              ⚙ Settings
            </button>
          </div>
        </header>

        {error && (
          <div style={S.error}>
            {error}
          </div>
        )}

        {message && (
          <div style={S.success}>
            {message}
          </div>
        )}

        <section style={S.cards}>

          {[
            ["Total Staff", summary.totalStaff],
            ["Present", summary.present],
            ["Absent", summary.absent],
            ["Half Day", summary.halfDay],

            [
              "Overtime",
              formatOT(
                summary.overtimeMinutes / 60
              )
            ],

            [
              "Cutting Time",
              formatCutting(
                summary.cuttingMinutes
              )
            ],

            [
              "Fine Hours",
              `${summary.fine}h`
            ],

            ["Leave", summary.leave],
            ["Punched In", summary.punchedIn],
            ["Punched Out", summary.punchedOut]
          ].map(([a, b]) => (
            <div
              style={S.card}
              key={a}
            >
              <div style={S.label}>
                {a}
              </div>

              <div style={S.value}>
                {b}
              </div>
            </div>
          ))}

        </section>

        <section style={S.actions}>

          {[
            [
              "📥",
              "Bulk Add Attendance",
              () => fileRef.current?.click()
            ],

            [
              "📅",
              "Leaves",
              () =>
                (window.location.hash =
                  "/leaves")
            ],

            [
              "🚗",
              "On Duty",
              () =>
                setMessage(
                  "On Duty module can use the same employee/date attendance data."
                )
            ],

            [
              "📝",
              "Bulk Add Work",
              () => fileRef.current?.click()
            ],

            [
              "⚠️",
              "Fine",
              () =>
                setMessage(
                  "Fine review is ready for attendance records."
                )
            ],

            [
              "⏱️",
              "Overtime",
              () =>
                setMessage(
                  "Overtime review is ready for attendance records."
                )
            ]
          ].map(([i, t, fn]) => (
            <button
              key={t}
              style={S.action}
              onClick={fn}
            >
              <span>{i}</span>
              {t}
            </button>
          ))}

        </section>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={upload}
          style={{ display: "none" }}
        />

        <section style={S.panel}>

          <div style={S.panelHead}>

            <div>
              <b style={{ fontSize: 19 }}>
                Staff Attendance
              </b>

              <div style={S.small}>
                {view === "month"
                  ? `Monthly data: ${selectedMonth}`
                  : `Daily data: ${fmtDate(
                      selectedDate
                    )}`}
              </div>
            </div>

            <div style={S.controls}>

              <button
                style={
                  view === "day"
                    ? S.btn
                    : S.btn2
                }
                onClick={() =>
                  setView("day")
                }
              >
                Daily
              </button>

              <button
                style={
                  view === "month"
                    ? S.btn
                    : S.btn2
                }
                onClick={() =>
                  setView("month")
                }
              >
                Monthly
              </button>

              {view === "month" && (
                <input
                  type="month"
                  style={S.input}
                  value={selectedMonth}
                  onChange={(e) =>
                    setSelectedMonth(
                      e.target.value
                    )
                  }
                />
              )}

              <input
                style={S.search}
                placeholder="Search employee..."
                value={search}
                onChange={(e) =>
                  setSearch(e.target.value)
                }
              />

              <select
                style={S.input}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value)
                }
              >
                {[
                  "All",
                  "Present",
                  "Absent",
                  "Half Day",
                  "Leave",
                  "Holiday",
                  "Week Off"
                ].map((x) => (
                  <option key={x}>
                    {x}
                  </option>
                ))}
              </select>

            </div>
          </div>

          <div style={S.tableHead}>
            <span>Employee</span>
            <span>Work Location</span>
            <span>Date</span>
            <span>Shift</span>
            <span>Status</span>
            <span>In</span>
            <span>Out</span>
            <span>Hours</span>
            <span>OT</span>
            <span>Cutting</span>
          </div>

          {filtered.map((a) => {
            const emp = a.employeeId || {};

            const loc =
              a.workLocation ||
              emp.workLocation ||
              emp.location ||
              "-";

            return (
              <div
                style={S.row}
                key={a._id}
              >

                <div>
                  <b>
                    {emp.name || "Unknown"}
                  </b>

                  <div style={S.small}>
                    {emp.employeeCode}
                  </div>
                </div>

                <span>
                  {loc}
                </span>

                <span>
                  {fmtDate(a.date)}
                </span>

                <span>
                  {a.shiftName ||
                    a.shift?.name ||
                    "-"}
                </span>

                <span
                  style={{
                    ...S.badge,
                    ...statusStyle(
                      a.status
                    )
                  }}
                >
                  {shortStatus(a.status)}
                </span>

                <button
                  style={S.timeBtn}
                  onClick={() =>
                    openPunch(a, "in")
                  }
                >
                  {a.checkIn || "Add In"}
                </button>

                <button
                  style={S.timeBtn}
                  onClick={() =>
                    openPunch(a, "out")
                  }
                >
                  {a.checkOut || "Add Out"}
                </button>

                <span>
                  {hoursWorked(a)}
                </span>

                <span>
                  {formatOT(
                    a.overtimeHours
                  )}
                </span>

                <span>
                  {formatCutting(
                    a.cuttingMinutes
                  )}
                </span>

              </div>
            );
          })}

          {!filtered.length && (
            <div style={S.empty}>
              No staff found.
            </div>
          )}

          <div style={S.legend}>
            <b>P</b> Present
            <b>HD</b> Half Day
            <b>A</b> Absent
            <b>L</b> Leave
            <b>WO</b> Week Off
          </div>

        </section>

        {showSettings && (
          <section style={S.panel}>

            <div style={S.panelHead}>

              <b style={{ fontSize: 19 }}>
                Attendance Rules & Shifts
              </b>

              <div>

                <button
                  style={S.btn2}
                  onClick={() =>
                    setShowShift((v) => !v)
                  }
                >
                  + Add Shift
                </button>{" "}

                <button
                  style={S.btn}
                  onClick={saveRules}
                >
                  Save Rules
                </button>

              </div>

            </div>

            <div style={S.ruleGrid}>

              {[
                "monday",
                "tuesday",
                "wednesday",
                "thursday",
                "friday",
                "saturday",
                "sunday"
              ].map((day) => {

                const r =
                  day === "saturday"
                    ? saturday
                    : ruleFor(day);

                return (
                  <div
                    style={S.ruleCard}
                    key={day}
                  >

                    <b>
                      {day.toUpperCase()}
                    </b>

                    <select
                      style={S.input}
                      value={r.type}
                      onChange={(e) =>
                        day === "saturday"
                          ? setSettings(
                              (s) => ({
                                ...s,
                                saturday: {
                                  ...saturday,
                                  type: e.target.value
                                }
                              })
                            )
                          : setDayRule(
                              day,
                              "type",
                              e.target.value
                            )
                      }
                    >
                      <option>
                        Working
                      </option>

                      <option>
                        Half Day
                      </option>

                      <option>
                        Week Off
                      </option>
                    </select>

                    <select
                      style={S.input}
                      value={r.shiftId || ""}
                      onChange={(e) =>
                        day === "saturday"
                          ? setSettings(
                              (s) => ({
                                ...s,
                                saturday: {
                                  ...saturday,
                                  shiftId:
                                    e.target.value ||
                                    null
                                }
                              })
                            )
                          : setDayRule(
                              day,
                              "shiftId",
                              e.target.value ||
                                null
                            )
                      }
                    >
                      <option value="">
                        Default Shift
                      </option>

                      {shifts.map((x) => (
                        <option
                          value={x._id}
                          key={x._id}
                        >
                          {x.name} (
                          {x.startTime}-
                          {x.endTime})
                        </option>
                      ))}
                    </select>

                    <label>
                      <input
                        type="checkbox"
                        checked={
                          r.overtimeAllowed !==
                          false
                        }
                        onChange={(e) =>
                          day ===
                          "saturday"
                            ? setSettings(
                                (s) => ({
                                  ...s,
                                  saturday: {
                                    ...saturday,
                                    overtimeAllowed:
                                      e.target.checked
                                  }
                                })
                              )
                            : setDayRule(
                                day,
                                "overtimeAllowed",
                                e.target.checked
                              )
                        }
                      />{" "}
                      Overtime allowed
                    </label>

                  </div>
                );
              })}

            </div>

            {showShift && (
              <div style={S.shiftBox}>

                {[
                  "name",
                  "startTime",
                  "endTime",
                  "breakMinutes",
                  "graceMinutes",
                  "overtimeAfterMinutes"
                ].map((k) => (
                  <input
                    key={k}
                    style={S.input}
                    placeholder={k}
                    value={shiftForm[k]}
                    onChange={(e) =>
                      setShiftForm({
                        ...shiftForm,
                        [k]: e.target.value
                      })
                    }
                  />
                ))}

                <button
                  style={S.btn}
                  onClick={createShift}
                >
                  Save Shift
                </button>

              </div>
            )}

          </section>
        )}

        {modal && (
          <div style={S.overlay}>

            <div style={S.modal}>

              <div style={S.modalHead}>

                <div>

                  <h2 style={S.modalTitle}>
                    {modal.name}
                  </h2>

                  <div style={S.pipe}>
                    |
                  </div>

                  <b>
                    {fmtDate(modal.date)}
                  </b>

                </div>

                <button
                  style={S.close}
                  onClick={() =>
                    setModal(null)
                  }
                >
                  ×
                </button>

              </div>

              <div style={S.modalBody}>

                <label style={S.modalLabel}>
                  Shift

                  <select
                    style={S.input}
                    value={
                      modal.shiftId || ""
                    }
                    onChange={(e) =>
                      setModal((m) => ({
                        ...m,
                        shiftId:
                          e.target.value
                      }))
                    }
                  >

                    <option value="">
                      Select Shift
                    </option>

                    {shifts.map((x) => (
                      <option
                        key={x._id}
                        value={x._id}
                      >
                        {x.name} (
                        {x.startTime} -{" "}
                        {x.endTime})
                      </option>
                    ))}

                  </select>
                </label>

                <div style={S.office}>
                  <b>Office Time</b>

                  <span>
                    {(
                      shifts.find(
                        (x) =>
                          x._id ===
                          modal.shiftId
                      )?.startTime
                    ) || "--:--"}{" "}
                    -{" "}
                    {(
                      shifts.find(
                        (x) =>
                          x._id ===
                          modal.shiftId
                      )?.endTime
                    ) || "--:--"}
                  </span>
                </div>

                <label style={S.modalLabel}>
                  Start Time

                  <input
                    style={S.input}
                    type="text"
                    placeholder="09:41 AM"
                    value={
                      modal.checkIn
                    }
                    onChange={(e) =>
                      setModal((m) => ({
                        ...m,
                        checkIn:
                          e.target.value
                      }))
                    }
                  />
                </label>

                <label style={S.modalLabel}>
                  End Time

                  <input
                    style={S.input}
                    type="text"
                    placeholder="05:30 PM"
                    value={
                      modal.checkOut
                    }
                    onChange={(e) =>
                      setModal((m) => ({
                        ...m,
                        checkOut:
                          e.target.value
                      }))
                    }
                  />
                </label>

                <label style={S.modalLabel}>
                  Status

                  <select
                    style={S.input}
                    value={
                      modal.status
                    }
                    onChange={(e) =>
                      setModal((m) => ({
                        ...m,
                        status:
                          e.target.value
                      }))
                    }
                  >
                    <option>
                      Present
                    </option>

                    <option>
                      Absent
                    </option>

                    <option>
                      Half Day
                    </option>

                    <option>
                      Leave
                    </option>
                  </select>
                </label>

                {modal.status ===
                  "Present" &&
                  !modal.checkOut && (
                    <div style={S.warn}>
                      Out time is mandatory
                      to mark present
                    </div>
                  )}

              </div>

              <div style={S.modalFoot}>

                <button
                  style={S.btn2}
                  onClick={() =>
                    setModal(null)
                  }
                >
                  Cancel
                </button>

                <button
                  style={S.btn}
                  onClick={savePunch}
                >
                  Save
                </button>

              </div>

            </div>
          </div>
        )}

      </div>
    </main>
  );
}

const S = {
  page: {
    padding: 24,
    background: "#f5f7fb",
    minHeight: "100vh",
    fontFamily: "Arial,sans-serif",
    color: "#172033"
  },

  container: {
    maxWidth: 1500,
    margin: "0 auto"
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
    marginBottom: 18
  },

  headerActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap"
  },

  h1: {
    margin: 0,
    fontSize: 27
  },

  sub: {
    margin: "5px 0",
    color: "#667085"
  },

  cards: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(160px,1fr))",
    gap: 12
  },

  card: {
    background: "#fff",
    border: "1px solid #e3e7ef",
    borderRadius: 12,
    padding: 16
  },

  label: {
    fontSize: 13,
    color: "#667085"
  },

  value: {
    fontSize: 26,
    fontWeight: 700,
    marginTop: 7
  },

  actions: {
    display: "grid",
    gridTemplateColumns:
      "repeat(6,1fr)",
    gap: 10,
    margin: "16px 0"
  },

  action: {
    background: "#fff",
    border: "1px solid #e3e7ef",
    borderRadius: 10,
    padding: 15,
    cursor: "pointer",
    fontWeight: 700
  },

  panel: {
    background: "#fff",
    border: "1px solid #e3e7ef",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 18
  },

  panelHead: {
    padding: 16,
    borderBottom: "1px solid #e7ebf1",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap"
  },

  controls: {
    display: "flex",
    gap: 7,
    flexWrap: "wrap"
  },

  input: {
    height: 40,
    border: "1px solid #d8dee9",
    borderRadius: 8,
    padding: "0 10px",
    background: "#fff",
    width: "100%"
  },

  search: {
    height: 40,
    width: 220,
    border: "1px solid #d8dee9",
    borderRadius: 8,
    padding: "0 10px"
  },

  btn: {
    height: 40,
    border: 0,
    borderRadius: 8,
    padding: "0 14px",
    background: "#2563eb",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer"
  },

  btn2: {
    height: 40,
    border: "1px solid #d8dee9",
    borderRadius: 8,
    padding: "0 14px",
    background: "#fff",
    fontWeight: 700,
    cursor: "pointer"
  },

  tableHead: {
    display: "grid",
    gridTemplateColumns:
      "1.4fr 1.1fr .9fr 1fr .6fr .7fr .7fr .6fr .5fr .7fr",
    gap: 8,
    padding: "11px 16px",
    background: "#f8fafc",
    fontSize: 12,
    fontWeight: 700,
    color: "#667085"
  },

  row: {
    display: "grid",
    gridTemplateColumns:
      "1.4fr 1.1fr .9fr 1fr .6fr .7fr .7fr .6fr .5fr .7fr",
    gap: 8,
    padding: "13px 16px",
    borderTop: "1px solid #edf0f4",
    alignItems: "center",
    fontSize: 13
  },

  timeBtn: {
    border: "1px solid #d8dee9",
    background: "#fff",
    borderRadius: 7,
    padding: "7px 8px",
    cursor: "pointer",
    textAlign: "left"
  },

  badge: {
    display: "inline-flex",
    justifyContent: "center",
    padding: "5px 8px",
    borderRadius: 7,
    fontWeight: 700,
    fontSize: 12
  },

  legend: {
    padding: 13,
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    borderTop: "1px solid #edf0f4",
    fontSize: 12,
    color: "#667085"
  },

  small: {
    fontSize: 12,
    color: "#667085",
    marginTop: 3
  },

  empty: {
    padding: 40,
    textAlign: "center",
    color: "#667085"
  },

  error: {
    padding: 12,
    background: "#fee4e2",
    color: "#b42318",
    borderRadius: 8,
    marginBottom: 10
  },

  success: {
    padding: 12,
    background: "#dcfce7",
    color: "#166534",
    borderRadius: 8,
    marginBottom: 10
  },

  ruleGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(210px,1fr))",
    gap: 12,
    padding: 16
  },

  ruleCard: {
    border: "1px solid #e3e7ef",
    borderRadius: 10,
    padding: 12,
    display: "flex",
    flexDirection: "column",
    gap: 7
  },

  shiftBox: {
    padding: 16,
    borderTop: "1px solid #e7ebf1",
    display: "flex",
    gap: 8,
    flexWrap: "wrap"
  },

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15,23,42,.45)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    zIndex: 1000
  },

  modal: {
    background: "#fff",
    borderRadius: 16,
    width: "min(500px,100%)",
    boxShadow:
      "0 25px 60px rgba(0,0,0,.2)"
  },

  modalHead: {
    padding: 20,
    borderBottom: "1px solid #edf0f4",
    display: "flex",
    justifyContent: "space-between"
  },

  modalTitle: {
    margin: 0,
    fontSize: 22
  },

  pipe: {
    color: "#98a2b3",
    margin: "4px 0"
  },

  close: {
    border: 0,
    background: "transparent",
    fontSize: 28,
    cursor: "pointer"
  },

  modalBody: {
    padding: 20,
    display: "grid",
    gap: 13
  },

  modalLabel: {
    display: "grid",
    gap: 6,
    fontSize: 13,
    fontWeight: 700
  },

  office: {
    padding: 12,
    borderRadius: 9,
    background: "#f8fafc",
    display: "flex",
    justifyContent: "space-between",
    gap: 10
  },

  warn: {
    padding: 11,
    borderRadius: 8,
    background: "#fff4e5",
    color: "#b54708",
    fontWeight: 700,
    fontSize: 13
  },

  modalFoot: {
    padding: 16,
    borderTop: "1px solid #edf0f4",
    display: "flex",
    justifyContent: "flex-end",
    gap: 8
  }
};
