import xlsx from "xlsx";

import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Shift from "../models/Shift.js";
import AttendanceSetting from "../models/AttendanceSetting.js";
import Leave from "../models/Leave.js";
import Holiday from "../models/Holiday.js";
import Salary from "../models/Salary.js";
import Company from "../models/Company.js";
import PayrollSetting from "../models/PayrollSetting.js";

/* =========================================================
   COMMON HELPERS
========================================================= */

const n = (v) =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function normalizeLookupKey(v) {
  return clean(v)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[’']/g, "'")
    .trim();
}

/* =========================================================
   TIME HELPERS
========================================================= */

function timeToMinutes(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  /*
    Excel time-only value.

    Example:
    0.5  = 12:00 PM
    0.25 = 06:00 AM
    0.75 = 06:00 PM

    This is valid for TIME fields,
    but NOT for attendance DATE.
  */
  if (
    typeof value === "number" &&
    value >= 0 &&
    value < 1
  ) {
    return Math.round(value * 24 * 60);
  }

  const raw = String(value).trim();

  // Supports HH:MM, HH:MM:SS, HH.MM and optional AM/PM.
  const m = raw.match(
    /^(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(AM|PM)?$/i
  );

  if (!m) return null;

  let h = Number(m[1]);
  const mm = Number(m[2]);
  const ss = m[3] === undefined ? 0 : Number(m[3]);

  if (mm < 0 || mm > 59 || ss < 0 || ss > 59) {
    return null;
  }

  // m[4] is the optional AM/PM part. m[3] is seconds.
  const ap = (m[4] || "").toUpperCase();

  if (ap) {
    if (h < 1 || h > 12) {
      return null;
    }

    if (ap === "PM" && h < 12) {
      h += 12;
    }

    if (ap === "AM" && h === 12) {
      h = 0;
    }
  } else if (h < 0 || h > 23) {
    return null;
  }

  return h * 60 + mm;
}

function normalizeTime(value) {
  const mins = timeToMinutes(value);

  if (mins === null) {
    return "";
  }

  const h24 = Math.floor(mins / 60);
  const mm = mins % 60;

  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;

  return `${String(h12).padStart(2, "0")}:${String(mm).padStart(
    2,
    "0"
  )} ${ap}`;
}

/* =========================================================
   DATE HELPERS
========================================================= */

/*
  Supported:

  18-09-2026
  18/09/2026
  18.09.2026

  2026-09-18
  2026/09/18
  2026.09.18

  Excel serial date
  JavaScript Date

  IMPORTANT:
  Excel time-only values such as 0.5 are rejected
  as attendance dates.

  Old Excel 1900-system dates are rejected.
*/

function parseAttendanceDate(value) {
  /* -----------------------------------------
     1. JavaScript Date
  ----------------------------------------- */

  if (
    value instanceof Date &&
    !Number.isNaN(value.getTime())
  ) {
    const year = value.getFullYear();

    /*
      Prevent 1900 / 1901 / old Excel date
      from becoming attendance date.
    */
    if (year < 2000) {
      return null;
    }

    return new Date(
      Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate()
      )
    );
  }

  /* -----------------------------------------
     2. Excel numeric serial date
  ----------------------------------------- */

  if (typeof value === "number") {
    /*
      Excel time-only value.

      Example:
      0.5
      0.25
      0.75

      These are time fractions, not dates.
    */
    if (value > 0 && value < 1) {
      return null;
    }

    /*
      Excel serial date.
    */
    if (value >= 1) {
      const parsed =
        xlsx.SSF.parse_date_code(value);

      if (!parsed) {
        return null;
      }

      /*
        Reject old/invalid Excel dates.
      */
      if (
        !parsed.y ||
        parsed.y < 2000 ||
        !parsed.m ||
        !parsed.d
      ) {
        return null;
      }

      const date = new Date(
        Date.UTC(
          parsed.y,
          parsed.m - 1,
          parsed.d
        )
      );

      if (Number.isNaN(date.getTime())) {
        return null;
      }

      return date;
    }

    return null;
  }

  const raw = clean(value);

  if (!raw) {
    return null;
  }

  /* -----------------------------------------
     3. YYYY-MM-DD
  ----------------------------------------- */

  let m = raw.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/
  );

  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);

    if (
      y < 2000 ||
      mo < 1 ||
      mo > 12 ||
      d < 1 ||
      d > 31
    ) {
      return null;
    }

    const date = new Date(
      Date.UTC(y, mo - 1, d)
    );

    /*
      Prevent invalid dates such as:
      31-02-2026
    */
    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== mo - 1 ||
      date.getUTCDate() !== d
    ) {
      return null;
    }

    return date;
  }

  /* -----------------------------------------
     4. DD-MM-YYYY
        DD/MM/YYYY
        DD.MM.YYYY
  ----------------------------------------- */

  m = raw.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/
  );

  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);

    if (
      y < 2000 ||
      mo < 1 ||
      mo > 12 ||
      d < 1 ||
      d > 31
    ) {
      return null;
    }

    const date = new Date(
      Date.UTC(y, mo - 1, d)
    );

    if (
      date.getUTCFullYear() !== y ||
      date.getUTCMonth() !== mo - 1 ||
      date.getUTCDate() !== d
    ) {
      return null;
    }

    return date;
  }

  /* -----------------------------------------
     5. Other valid date strings
  ----------------------------------------- */

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  /*
    Reject 1900 / old dates.
  */
  if (parsed.getFullYear() < 2000) {
    return null;
  }

  return new Date(
    Date.UTC(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
    )
  );
}

function dateKey(date) {
  if (!date) return "";

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toISOString().slice(0, 10);
}

/* =========================================================
   EFFECTIVE ATTENDANCE RULE
========================================================= */

const attendanceDayKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

function normalizeRuleShiftIds(rule, fallbackShiftId = null) {
  const raw = Array.isArray(rule?.shiftIds)
    ? rule.shiftIds
    : rule?.shiftId
      ? [rule.shiftId]
      : fallbackShiftId
        ? [fallbackShiftId]
        : [];

  return [...new Set(raw.filter(Boolean).map((id) => String(id)))];
}

function getEffectiveAttendanceRule(settings, date) {
  const key = dateKey(date);
  const overrides = Array.isArray(settings?.dateOverrides)
    ? settings.dateOverrides
    : [];
  const override = overrides.find((item) => dateKey(item?.date) === key);

  if (override) {
    const shiftIds = normalizeRuleShiftIds(override, settings?.defaultShiftId || null);
    return {
      type: override.type || "Working",
      shiftId: shiftIds[0] || null,
      shiftIds,
      overtimeAllowed: override.overtimeAllowed !== false,
      requiredWorkMinutes:
        Number.isFinite(Number(override.requiredWorkMinutes))
          ? Number(override.requiredWorkMinutes)
          : null,
      note: override.note || "",
      source: "date",
    };
  }

  if (settings) {
    const d = new Date(`${key}T00:00:00.000Z`);
    const dayIndex = d.getUTCDay();
    const dayKey = attendanceDayKeys[dayIndex];
    const rule = dayIndex === 6 ? settings.saturday : settings.days?.[dayKey];

    if (rule) {
      const shiftIds = normalizeRuleShiftIds(rule, settings.defaultShiftId || null);
      return {
        type: rule.type || "Working",
        shiftId: shiftIds[0] || null,
        shiftIds,
        overtimeAllowed: rule.overtimeAllowed !== false,
        requiredWorkMinutes:
          Number.isFinite(Number(rule.requiredWorkMinutes))
            ? Number(rule.requiredWorkMinutes)
            : null,
        note: "",
        source: dayIndex === 6 ? "saturday" : dayKey,
      };
    }
  }

  const fallbackShiftIds = normalizeRuleShiftIds({ shiftId: settings?.defaultShiftId || null });
  return {
    type: "Working",
    shiftId: fallbackShiftIds[0] || null,
    shiftIds: fallbackShiftIds,
    overtimeAllowed: true,
    requiredWorkMinutes: null,
    note: "",
    source: "default",
  };
}

function getRuleShiftForEmployee(rule, employee, shifts = []) {
  const allowed = normalizeRuleShiftIds(rule);
  const employeeShiftId = employee?.shiftId ? String(employee.shiftId) : "";

  if (employeeShiftId && allowed.includes(employeeShiftId)) {
    return shifts.find((s) => String(s._id) === employeeShiftId) || null;
  }

  if (!allowed.length && employeeShiftId) {
    return shifts.find((s) => String(s._id) === employeeShiftId) || null;
  }

  if (allowed.length) {
    return shifts.find((s) => String(s._id) === allowed[0]) || null;
  }

  return null;
}

/* =========================================================
   TIME ADJUSTMENT
========================================================= */

function calculateTimeAdjustments(
  checkIn,
  checkOut,
  shift,
  requiredWorkMinutes = null,
  overtimeAllowed = true
) {
  const cin = timeToMinutes(checkIn);
  const cout = timeToMinutes(checkOut);

  if (cin === null || cout === null) {
    return {
      overtimeHours: 0,
      cuttingMinutes: 0,
    };
  }

  let scheduled = null;

  // A rule/date can explicitly define total required work time
  // (for example 5 hours or 4 hours) without depending on shift clock times.
  if (Number.isFinite(Number(requiredWorkMinutes))) {
    scheduled = Math.max(0, Number(requiredWorkMinutes));
  } else {
    if (!shift) {
      return {
        overtimeHours: 0,
        cuttingMinutes: 0,
      };
    }

    const scheduledStart =
      timeToMinutes(shift.startTime);

    const scheduledEnd =
      timeToMinutes(shift.endTime);

    if (
      scheduledStart === null ||
      scheduledEnd === null
    ) {
      return {
        overtimeHours: 0,
        cuttingMinutes: 0,
      };
    }

    scheduled = scheduledEnd - scheduledStart;

    if (scheduled < 0) {
      scheduled += 1440;
    }

    scheduled = Math.max(
      0,
      scheduled - n(shift.breakMinutes)
    );
  }


  let actual = cout - cin;

  if (actual < 0) {
    actual += 1440;
  }

  const delta = actual - scheduled;

  return {
    overtimeHours:
      delta > 0 && overtimeAllowed !== false
        ? Math.round((delta / 60) * 100) / 100
        : 0,

    cuttingMinutes:
      delta < 0
        ? Math.abs(delta)
        : 0,
  };
}

/* =========================================================
   EMPLOYEES
========================================================= */

export async function getEmployees(req, res) {
  try {
    const employees = await Employee.find({})
      .sort({ name: 1 });

    res.json({
      success: true,
      employees,
    });
  } catch (error) {
    console.error("getEmployees:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function createEmployee(req, res) {
  try {
    const employee =
      await Employee.create(req.body);

    res.status(201).json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error("createEmployee:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function updateEmployee(req, res) {
  try {
    const employee =
      await Employee.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        }
      );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    res.json({
      success: true,
      employee,
    });
  } catch (error) {
    console.error("updateEmployee:", error);

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/* =========================================================
   OPTIONS
========================================================= */

export async function getOptions(req, res) {
  try {
    const [employees, shifts, companies, setting] = await Promise.all([
      Employee.find({}).sort({ name: 1 }),
      Shift.find({ status: { $ne: "Inactive" } }).sort({ name: 1 }),
      Company.find({ status: { $ne: "Inactive" } }).sort({ name: 1 }),
      PayrollSetting.findOne({ key: "default" }),
    ]);

    const departmentOptions = [...new Set(employees.map(e => clean(e.department)).filter(Boolean))].sort();
    const designationOptions = [...new Set(employees.map(e => clean(e.designation)).filter(Boolean))].sort();
    const employeeTypeOptions = [...new Set(["Permanent", "Contract", "Temporary", "Intern", ...employees.map(e => clean(e.employeeType))].filter(Boolean))].sort();
    const states = [...new Set(["West Bengal", "Maharashtra", "Karnataka", "Telangana", "Andhra Pradesh", "Tamil Nadu", "Gujarat", ...employees.map(e => clean(e.state))].filter(Boolean))].sort();

    const defaults = {
      basicPercent: 60, hraPercent: 20, daPercent: 10, conveyancePercent: 5, otherAllowancePercent: 0, gratuityPercent: 4.81,
      pfPercent: 12, esiPercent: 0.75, employerPfPercent: 12, employerEsiPercent: 3.25, hraBase: "gross", daBase: "gross",
      conveyanceBase: "gross", otherAllowanceBase: "gross", gratuityBase: "basic", pfBase: "gross", pfCeilingEnabled: true,
      pfWageCeiling: 15000, esiBase: "gross", esiCeilingEnabled: true, esiWageCeiling: 21000, stateRules: {},
    };

    res.json({ success: true, employees, shifts, companies: companies.map(c => c.name), departmentOptions, designationOptions, employeeTypeOptions, states, settings: setting ? setting.toObject() : defaults });
  } catch (error) {
    console.error("getOptions:", error);
    res.status(500).json({ success: false, message: error.message });
  }
}

export async function saveOptions(req, res) {
  try {
    const settings = await PayrollSetting.findOneAndUpdate(
      { key: "default" },
      { $set: { ...req.body, key: "default" } },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, message: "Payroll options saved.", settings });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

export async function createCompany(req, res) {
  try {
    const name = clean(req.body?.name);
    if (!name) return res.status(400).json({ success: false, message: "Company name is required." });
    const company = await Company.create({ name });
    res.status(201).json({ success: true, message: "Company created.", company });
  } catch (error) {
    res.status(400).json({ success: false, message: error.code === 11000 ? "Company already exists." : error.message });
  }
}

/* =========================================================
   ATTENDANCE
========================================================= */

export async function getAttendance(req, res) {
  try {
    const {
      from,
      to,
      includeStaff,
    } = req.query;

    const query = {};

    if (from || to) {
      query.date = {};

      if (from) {
        query.date.$gte =
          new Date(`${from}T00:00:00.000Z`);
      }

      if (to) {
        query.date.$lt =
          new Date(`${to}T00:00:00.000Z`);
      }
    }

    let attendance =
      await Attendance.find(query)
        .populate(
          "employeeId",
          "employeeCode name department designation workLocation location"
        )
        .populate(
          "shiftId",
          "name startTime endTime breakMinutes graceMinutes overtimeAfterMinutes"
        )
        .sort({
          date: 1,
        });

    if (includeStaff === "1") {
      const existing = new Set(
        attendance.map(
          (a) =>
            `${a.employeeId?._id}_${dateKey(
              a.date
            )}`
        )
      );

      const employees =
        await Employee.find({})
          .sort({
            name: 1,
          });

      // Missing dates are rendered virtually. A configured holiday or
      // weekly-off day must never appear as Absent just because there is
      // no attendance document for that date.
      const [attendanceSettings, holidays, allShifts] =
        await Promise.all([
          AttendanceSetting.findOne({}),
          Holiday.find({}),
          Shift.find({}),
        ]);

      const holidayMap = new Map();

      for (const holiday of holidays) {
        holidayMap.set(
          dateKey(holiday.date),
          holiday
        );
      }

      const shiftById = new Map(
        allShifts.map((shift) => [String(shift._id), shift])
      );

      /*
       * IMPORTANT:
       * Recalculate OT / Cutting when attendance is READ.
       *
       * Older attendance records may contain wrong overtimeHours values
       * from a previous calculation bug. The UI must never trust that
       * stale stored value.
       *
       * Rule:
       *   actual < target  -> Cutting = target - actual, OT = 0
       *   actual > target  -> OT = actual - target, Cutting = 0
       *   actual = target   -> OT = 0, Cutting = 0
       *
       * Target comes from date/day rule's requiredWorkMinutes when set;
       * otherwise from the effective shift duration minus break minutes.
       */
      if (attendanceSettings) {
        for (const record of attendance) {
          if (!record || record.status !== "Present") continue;

          const recordDate = record.date;
          const employee = record.employeeId;
          const effectiveRule = getEffectiveAttendanceRule(
            attendanceSettings,
            recordDate
          );

          const employeeShift = getRuleShiftForEmployee(
            effectiveRule,
            employee,
            allShifts
          );
          const storedShift = record.shiftId?._id
            ? shiftById.get(String(record.shiftId._id)) ||
              allShifts.find((s) => String(s._id) === String(record.shiftId._id))
            : null;
          const effectiveShift =
            employeeShift ||
            storedShift ||
            (effectiveRule.shiftId
              ? shiftById.get(String(effectiveRule.shiftId)) ||
                allShifts.find((s) => String(s._id) === String(effectiveRule.shiftId))
              : null);

          const requiredWorkMinutes =
            Number.isFinite(Number(effectiveRule.requiredWorkMinutes))
              ? Number(effectiveRule.requiredWorkMinutes)
              : null;

          const adjustment = calculateTimeAdjustments(
            record.checkIn,
            record.checkOut,
            effectiveShift,
            requiredWorkMinutes,
            effectiveRule.overtimeAllowed !== false
          );

          // Convert Mongoose document to plain object before replacing
          // the calculated fields so old/stale DB values cannot leak out.
          const plain = record.toObject
            ? record.toObject()
            : record;

          plain.overtimeHours = adjustment.overtimeHours;
          plain.cuttingMinutes = adjustment.cuttingMinutes;

          // Keep the effective shift visible in the attendance table.
          if (effectiveShift) {
            plain.shiftId = effectiveShift._id;
            plain.shiftName = effectiveShift.name || plain.shiftName || "";
          }

          record.__computed = plain;
        }
      }

      // Replace recalculated records in the response array.
      attendance = attendance.map(
        (record) => record?.__computed || record
      );

      const virtualStatusForDate = (d) => {
        const key = dateKey(d);
        const effectiveRule = getEffectiveAttendanceRule(
          attendanceSettings,
          d
        );

        // Holiday master has highest priority. It is shown as Week Off
        // in this attendance view and is never treated as Absent.
        if (holidayMap.has(key)) {
          return {
            status: "Week Off",
            note: `Holiday: ${holidayMap.get(key).name || "Holiday"}`,
            shiftId: effectiveRule.shiftId || null,
            shiftName: effectiveRule.shiftId
              ? shiftById.get(String(effectiveRule.shiftId))?.name || ""
              : "",
          };
        }

        if (effectiveRule.type === "Week Off") {
          return {
            status: "Week Off",
            note: effectiveRule.note || "Weekly Off",
            shiftId: effectiveRule.shiftId || null,
            shiftName: effectiveRule.shiftId
              ? shiftById.get(String(effectiveRule.shiftId))?.name || ""
              : "",
          };
        }

        if (effectiveRule.type === "Half Day") {
          return {
            status: "Half Day",
            note: effectiveRule.note || "Half Day rule",
            shiftId: effectiveRule.shiftId || null,
            shiftName: effectiveRule.shiftId
              ? shiftById.get(String(effectiveRule.shiftId))?.name || ""
              : "",
          };
        }

        return {
          status: "Absent",
          note: effectiveRule.note || "",
          shiftId: effectiveRule.shiftId || null,
          shiftName: effectiveRule.shiftId
            ? shiftById.get(String(effectiveRule.shiftId))?.name || ""
            : "",
        };
      };

      const fromDate = from
        ? new Date(
            `${from}T00:00:00.000Z`
          )
        : null;

      const toDate = to
        ? new Date(
            `${to}T00:00:00.000Z`
          )
        : null;

      if (
        fromDate &&
        toDate &&
        fromDate.getTime() <
          toDate.getTime()
      ) {
        for (
          let d = new Date(fromDate);
          d < toDate;
          d.setUTCDate(
            d.getUTCDate() + 1
          )
        ) {
          for (const emp of employees) {
            const key =
              `${emp._id}_${dateKey(d)}`;

            if (existing.has(key)) {
              continue;
            }

            const virtual =
              virtualStatusForDate(d);

            attendance.push({
              _id: `virtual-${emp._id}-${dateKey(
                d
              )}`,

              employeeId: emp,

              date: new Date(d),

              status: virtual.status,

              checkIn: "",
              checkOut: "",

              workLocation:
                emp.workLocation ||
                emp.location ||
                "",

              shiftId: virtual.shiftId || emp.shiftId || null,
              shiftName:
                virtual.shiftName ||
                (virtual.shiftId
                  ? shiftById.get(String(virtual.shiftId))?.name || ""
                  : ""),

              overtimeHours: 0,
              cuttingMinutes: 0,

              note: virtual.note,

              virtual: true,
            });
          }
        }

        attendance.sort(
          (a, b) =>
            new Date(a.date) -
            new Date(b.date)
        );
      }
    }

    res.json({
      success: true,
      attendance,
    });
  } catch (error) {
    console.error(
      "getAttendance:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/* =========================================================
   SAVE ATTENDANCE
========================================================= */

export async function saveAttendance(req, res) {
  try {
    const {
      employeeId,
      date,
      shiftId,
      checkIn,
      checkOut,
      status,
      workLocation,
      note,
    } = req.body;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee is required.",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    /*
      IMPORTANT DATE FIX
    */
    const parsedAttendanceDate =
      parseAttendanceDate(date);

    if (!parsedAttendanceDate) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid attendance date.",
      });
    }

    if (
      status === "Present" &&
      (!checkIn || !checkOut)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Out time is mandatory to mark present.",
      });
    }

    const employee =
      await Employee.findById(
        employeeId
      );

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const attendanceSettings =
      await AttendanceSetting.findOne({});

    const effectiveRule = getEffectiveAttendanceRule(
      attendanceSettings,
      parsedAttendanceDate
    );

    let shift = null;

    const allowedShiftIds = Array.isArray(effectiveRule.shiftIds)
      ? effectiveRule.shiftIds.map(String)
      : [];
    const effectiveShiftId =
      shiftId ||
      (employee.shiftId &&
      (!allowedShiftIds.length || allowedShiftIds.includes(String(employee.shiftId)))
        ? employee.shiftId
        : effectiveRule.shiftId) ||
      null;

    if (effectiveShiftId) {
      shift = await Shift.findById(effectiveShiftId);
    }

    const normalizedCheckIn =
      normalizeTime(checkIn);

    const normalizedCheckOut =
      normalizeTime(checkOut);

    const requiredWorkMinutes =
      Number.isFinite(Number(effectiveRule.requiredWorkMinutes)) &&
      Number(effectiveRule.requiredWorkMinutes) >= 0
        ? Number(effectiveRule.requiredWorkMinutes)
        : null;

    const adjustment =
      status === "Present"
        ? calculateTimeAdjustments(
            normalizedCheckIn,
            normalizedCheckOut,
            shift,
            requiredWorkMinutes,
            effectiveRule.overtimeAllowed !== false
          )
        : {
            overtimeHours: 0,
            cuttingMinutes: 0,
          };

    const attendance =
      await Attendance.findOneAndUpdate(
        {
          employeeId,
          date: parsedAttendanceDate,
        },
        {
          $set: {
            employeeId,

            /*
              Use normalized date.
              This prevents 1900/invalid date issues.
            */
            date: parsedAttendanceDate,

            status,

            checkIn:
              normalizedCheckIn,

            checkOut:
              normalizedCheckOut,

            workLocation:
              workLocation ||
              employee.workLocation ||
              employee.location ||
              "",

            shiftId:
              shift?._id || null,

            shiftName:
              shift?.name || "",

            overtimeHours:
              adjustment.overtimeHours,

            cuttingMinutes:
              adjustment.cuttingMinutes,

            overtimeApproved: false,
            overtimeApprovedBy: null,
            overtimeApprovedAt: null,

            cuttingApproved: false,
            cuttingApprovedBy: null,
            cuttingApprovedAt: null,

            note: note || "",
          },
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    res.json({
      success: true,
      message:
        "Attendance saved successfully.",
      attendance,
    });
  } catch (error) {
    console.error(
      "saveAttendance:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/* =========================================================
   BULK EXCEL ATTENDANCE IMPORT
========================================================= */

export async function importAttendanceExcel(
  req,
  res
) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an Excel or CSV file.",
      });
    }

    const workbook = xlsx.read(req.file.buffer, {
      type: "buffer",
      cellDates: true,
    });

    const sheetName = workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: "Excel file has no worksheet.",
      });
    }

    const sheet = workbook.Sheets[sheetName];
    const matrix = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: "",
      raw: true,
      blankrows: true,
    });

    const rows = Array.isArray(matrix) ? matrix : [];

    if (!rows.length) {
      return res.status(400).json({
        success: false,
        message: "Excel file contains no attendance data.",
      });
    }

    const normalizeHeader = (v) =>
      clean(v)
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const getCell = (row, index) =>
      Array.isArray(row) ? row[index] ?? "" : "";

    const employees = await Employee.find({});
    const shifts = await Shift.find({});
    const attendanceSettings = await AttendanceSetting.findOne({});
    const holidayDocs = await Holiday.find({});
    const holidayMap = new Map(
      holidayDocs.map((holiday) => [dateKey(holiday.date), holiday])
    );

    const employeeCodeMap = new Map();
    const employeeNameMap = new Map();

    for (const employee of employees) {
      if (employee.employeeCode) {
        employeeCodeMap.set(
          normalizeLookupKey(employee.employeeCode),
          employee
        );
      }

      if (employee.name) {
        employeeNameMap.set(
          normalizeLookupKey(employee.name),
          employee
        );
      }
    }

    const shiftMap = new Map();
    for (const shift of shifts) {
      if (shift.name) {
        shiftMap.set(
          normalizeLookupKey(shift.name),
          shift
        );
      }
    }

    const resolveEmployee = (candidates) => {
      for (const candidate of candidates) {
        const value = clean(candidate);
        if (!value) continue;

        const byCode = employeeCodeMap.get(
          normalizeLookupKey(value)
        );
        if (byCode) return byCode;

        const byName = employeeNameMap.get(
          normalizeLookupKey(value)
        );
        if (byName) return byName;
      }

      return null;
    };

    const monthlyStatus = (value) => {
      const raw = clean(value).toUpperCase();

      if (!raw || raw === "-") return "";

      if (/^\d*P$/.test(raw) || raw === "PRESENT") {
        return "Present";
      }

      if (raw === "A" || raw === "ABSENT") {
        return "Absent";
      }

      if (
        raw === "HD" ||
        raw === "HALF DAY" ||
        raw === "HALFDAY"
      ) {
        return "Half Day";
      }

      if (raw === "L" || raw === "LEAVE") {
        return "Leave";
      }

      if (raw === "H" || raw === "HOLIDAY") {
        return "Holiday";
      }

      if (raw === "WO" || raw === "W/O" || raw === "WEEK OFF") {
        return "Week Off";
      }

      return null;
    };

    const monthlyLabels = new Set([
      "IN",
      "OUT",
      "WH",
      "OT",
      "F",
    ]);

    const looksLikeMonthlyReport = rows.some((row) => {
      if (!Array.isArray(row)) return false;
      const first = clean(row[0]).toUpperCase();
      return monthlyLabels.has(first);
    });

    /* =========================================================
       FORMAT 1: MONTHLY MULTI-STAFF MATRIX

       Example:
       Employee | Monthly Regular | Attendance State | 1P | WO | ...
       IN       | 09:54           | -                | ...
       OUT      | 17:00           | -                | ...
       WH       | 07:06           | -                | ...
       OT       | -               | -                | ...
       F        | -               | -                | ...

       Only working-day statuses are written to Attendance.
       WO is not written as an attendance document.
       H creates a Holiday master record so the app displays it
       as a non-working day rather than Absent.
    ========================================================= */
    if (looksLikeMonthlyReport) {
      const monthYear = clean(
        req.body?.monthYear ||
          req.body?.month ||
          req.body?.attendanceMonth
      );

      let year = Number(req.body?.year);
      let month = Number(req.body?.monthNumber);

      if (!year || !month) {
        const m = monthYear.match(/^(\d{4})[-/](\d{1,2})$/);
        if (m) {
          year = Number(m[1]);
          month = Number(m[2]);
        }
      }

      if (!year || !month || month < 1 || month > 12) {
        return res.status(400).json({
          success: false,
          message:
            "Monthly Excel format detected. Please select the attendance month in the Attendance page before uploading.",
          imported: 0,
          skipped: 0,
          total: 0,
          errors: [],
        });
      }

      const monthDays = new Date(
        Date.UTC(year, month, 0)
      ).getUTCDate();

      const blocks = [];
      let current = null;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i] || [];
        const first = clean(row[0]).toUpperCase();

        // Detail rows belong to the latest employee block.
        if (monthlyLabels.has(first)) {
          if (current) {
            current.detailRows[first] = row;
          }
          continue;
        }

        // Some attendance sheets keep "Attendance State" on its own
        // row, followed by IN / OUT. Attach it to the current employee
        // instead of treating it as a new employee block.
        if (first === "ATTENDANCE STATE") {
          if (current) {
            current.statusRow = row;
          }
          continue;
        }

        const nonEmpty = row.some((v) => clean(v));
        if (!nonEmpty) continue;

        // Employee identity can be in the first 1-3 cells.
        // The importer supports both:
        //   1) identity + day statuses on the same row
        //   2) identity row, then an "Attendance State" row
        const employeeCandidate = resolveEmployee(row.slice(0, 3));
        const third = normalizeHeader(row[2]);
        const statusCells = row
          .slice(3, 3 + monthDays)
          .map(monthlyStatus);

        const looksLikeEmployeeHeader =
          !!employeeCandidate ||
          statusCells.some((x) => x !== null && x !== "") ||
          third === "monthly regular";

        if (looksLikeEmployeeHeader) {
          current = {
            header: row,
            statusRow: null,
            detailRows: {},
            sourceRow: i + 1,
          };
          blocks.push(current);
        }
      }

      if (!blocks.length) {
        return res.status(400).json({
          success: false,
          message:
            "Monthly Excel format detected, but no employee blocks were found.",
          imported: 0,
          skipped: 0,
          total: 0,
          errors: [],
        });
      }

      let imported = 0;
      let skipped = 0;
      let ignoredNonWorking = 0;
      const errors = [];
      let holidayCount = 0;
      const touchedWorkingDays = new Set();

      for (const block of blocks) {
        try {
          const header = block.header || [];
          const employee = resolveEmployee(header.slice(0, 3));

          if (!employee) {
            throw new Error(
              `Employee "${clean(header[0])}" not found in Employee Master.`
            );
          }

          let baseShift = null;
          const headerShiftCandidate = header.find((value) => {
            const normalized = normalizeLookupKey(value);
            return normalized && shiftMap.has(normalized);
          });

          if (headerShiftCandidate) {
            baseShift = shiftMap.get(
              normalizeLookupKey(headerShiftCandidate)
            );
          }

          if (!baseShift && employee.shiftId) {
            baseShift =
              shifts.find(
                (s) => String(s._id) === String(employee.shiftId)
              ) || null;
          }

          const inRow = block.detailRows.IN || [];
          const outRow = block.detailRows.OUT || [];
          const whRow = block.detailRows.WH || [];
          const otRow = block.detailRows.OT || [];
          const fRow = block.detailRows.F || [];

          for (let day = 1; day <= monthDays; day++) {
            const col = 2 + day; // day 1 starts at column index 3

            // Support both monthly layouts:
            // A) status values on the employee row
            // B) a separate "Attendance State" row
            const statusSourceRow = block.statusRow || header;
            const rawStatus = getCell(statusSourceRow, col);
            let status = monthlyStatus(rawStatus);

            const rawCheckIn = getCell(inRow, col);
            const rawCheckOut = getCell(outRow, col);

            const checkIn = normalizeTime(rawCheckIn);
            const checkOut = normalizeTime(rawCheckOut);

            // USER RULE:
            // If status is blank and both IN + OUT exist, this is Present.
            // If status is A/HD/L, keep the explicit status.
            // Sunday/weekly-off/holiday are NOT supplied in Excel; the app
            // determines them from Attendance Settings and Holiday Master.
            if (status === "" && checkIn && checkOut) {
              status = "Present";
            }

            // Completely blank day: do not create an attendance document.
            // getAttendance() will later render a configured weekly off,
            // holiday, or working-day absence virtually.
            if (status === "") {
              continue;
            }

            if (!status) {
              skipped++;
              errors.push({
                row: block.sourceRow,
                message:
                  `Invalid monthly status "${clean(rawStatus)}" for ${employee.employeeCode} on ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}.`,
              });
              continue;
            }

            const attendanceDate = new Date(
              Date.UTC(year, month - 1, day)
            );

            const dayKey = dateKey(attendanceDate);
            const effectiveRule = getEffectiveAttendanceRule(
              attendanceSettings,
              attendanceDate
            );

            // Holiday master / weekly-off rule is applied automatically when
            // Excel has no explicit attendance state for that day.
            if (
              status === "" &&
              !checkIn &&
              !checkOut &&
              (holidayMap.has(dayKey) ||
                effectiveRule.type === "Week Off")
            ) {
              ignoredNonWorking++;
              continue;
            }

            // An app-level Half Day date rule becomes Half Day when the Excel
            // only contains IN/OUT and does not explicitly provide a status.
            if (status === "" && checkIn && checkOut) {
              if (holidayMap.has(dayKey)) {
                ignoredNonWorking++;
                continue;
              }

              if (effectiveRule.type === "Week Off") {
                ignoredNonWorking++;
                continue;
              }

              status =
                effectiveRule.type === "Half Day"
                  ? "Half Day"
                  : "Present";
            }

            if (status === "Week Off") {
              ignoredNonWorking++;
              continue;
            }

            if (status === "Holiday") {
              await Holiday.findOneAndUpdate(
                { date: attendanceDate },
                {
                  $setOnInsert: {
                    date: attendanceDate,
                    name: "Imported Holiday",
                    type: "Company",
                  },
                },
                { upsert: true, new: true }
              );
              holidayCount++;
              ignoredNonWorking++;
              continue;
            }

            touchedWorkingDays.add(dateKey(attendanceDate));

            const rawOT = getCell(otRow, col);
            const rawF = getCell(fRow, col);

            const dayShift =
              getRuleShiftForEmployee(effectiveRule, employee, shifts) ||
              baseShift;

            let calculated = {
              overtimeHours: 0,
              cuttingMinutes: 0,
            };

            if (status === "Present" && (!checkIn || !checkOut)) {
              skipped++;
              errors.push({
                row: block.sourceRow,
                message:
                  `Present attendance for ${employee.employeeCode} on ${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} needs both IN and OUT times.`,
              });
              continue;
            }

            if (status === "Present" && checkIn && checkOut) {
              const requiredWorkMinutes =
                Number.isFinite(Number(effectiveRule.requiredWorkMinutes))
                  ? Number(effectiveRule.requiredWorkMinutes)
                  : null;

              calculated = calculateTimeAdjustments(
                checkIn,
                checkOut,
                dayShift,
                requiredWorkMinutes,
                effectiveRule.overtimeAllowed !== false
              );
            }

            const explicitOTMinutes = timeToMinutes(rawOT);
            const overtimeHours =
              effectiveRule.overtimeAllowed === false
                ? 0
                : explicitOTMinutes !== null
                  ? Math.round((explicitOTMinutes / 60) * 100) / 100
                  : calculated.overtimeHours;

            // The source report's F row is retained in Note only. It is not
            // guessed as a financial Cutting amount.
            const noteParts = [
              "Monthly Excel Import",
            ];

            const rawWH = clean(getCell(whRow, col));
            if (rawWH && rawWH !== "-") {
              noteParts.push(`WH: ${rawWH}`);
            }

            if (clean(rawF) && clean(rawF) !== "-") {
              noteParts.push(`F: ${clean(rawF)}`);
            }

            await Attendance.findOneAndUpdate(
              {
                employeeId: employee._id,
                date: attendanceDate,
              },
              {
                $set: {
                  employeeId: employee._id,
                  date: attendanceDate,
                  status,
                  checkIn,
                  checkOut,
                  workLocation:
                    employee.workLocation ||
                    employee.location ||
                    "",
                  shiftId: dayShift?._id || null,
                  shiftName: dayShift?.name || "",
                  overtimeHours,
                  cuttingMinutes: calculated.cuttingMinutes,
                  overtimeApproved: false,
                  overtimeApprovedBy: null,
                  overtimeApprovedAt: null,
                  cuttingApproved: false,
                  cuttingApprovedBy: null,
                  cuttingApprovedAt: null,
                  note: noteParts.join(" | "),
                },
              },
              {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
              }
            );

            imported++;
          }
        } catch (blockError) {
          skipped++;
          errors.push({
            row: block.sourceRow,
            message: blockError.message,
          });
        }
      }

      if (imported === 0 && skipped > 0) {
        return res.status(400).json({
          success: false,
          imported,
          skipped,
          ignoredNonWorking,
          holidayCount,
          total: touchedWorkingDays.size,
          errors,
          message:
            `No working-day attendance records were imported. ${skipped} row/block error(s) found.`,
        });
      }

      return res.json({
        success: skipped === 0,
        partialSuccess: imported > 0 && skipped > 0,
        format: "monthly-multi-staff",
        sheetName,
        firstSheet: true,
        message:
          skipped > 0
            ? `Imported ${imported} working-day record(s); ${skipped} error(s) found. WO/H non-working days skipped.`
            : `Successfully imported ${imported} working-day record(s). WO/H non-working days skipped.`,
        imported,
        skipped,
        ignoredNonWorking,
        holidayCount,
        totalWorkingDates: touchedWorkingDays.size,
        errors,
      });
    }

    /* =========================================================
       FORMAT 2: DAILY MULTI-STAFF / ROW-PER-DAY
       Existing format remains supported.
    ========================================================= */

    let headerIndex = -1;
    let header = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] || [];
      const normalized = row.map(normalizeHeader);

      const hasEmployeeCode = normalized.some((x) =>
        [
          "employee code",
          "employeecode",
          "emp code",
          "empcode",
          "code",
        ].includes(x)
      );

      const hasDate = normalized.some((x) =>
        ["date", "attendance date", "attendancedate"].includes(x)
      );

      if (hasEmployeeCode && hasDate) {
        headerIndex = i;
        header = row;
        break;
      }
    }

    if (headerIndex === -1) {
      return res.status(400).json({
        success: false,
        message:
          "Could not identify the Excel format. Use the daily attendance template or the monthly multi-staff attendance format.",
        imported: 0,
        skipped: 0,
        total: 0,
        errors: [],
      });
    }

    const headerMap = new Map();
    header.forEach((value, index) => {
      headerMap.set(normalizeHeader(value), index);
    });

    const findIndex = (names) => {
      for (const name of names) {
        const index = headerMap.get(normalizeHeader(name));
        if (index !== undefined) return index;
      }
      return -1;
    };

    const employeeCodeIndex = findIndex([
      "Employee Code",
      "EmployeeCode",
      "Emp Code",
      "EmpCode",
      "Code",
    ]);

    const dateIndex = findIndex([
      "Date",
      "Attendance Date",
      "attendanceDate",
    ]);

    const statusIndex = findIndex([
      "Status",
      "Attendance Status",
    ]);

    const checkInIndex = findIndex([
      "Check In",
      "CheckIn",
      "In",
      "Start Time",
      "Start",
    ]);

    const checkOutIndex = findIndex([
      "Check Out",
      "CheckOut",
      "Out",
      "End Time",
      "End",
    ]);

    const workLocationIndex = findIndex([
      "Work Location",
      "Location",
      "WorkLocation",
    ]);

    const shiftNameIndex = findIndex([
      "Shift Name",
      "Shift",
      "ShiftName",
    ]);

    const noteIndex = findIndex([
      "Note",
      "Notes",
      "Employee Note",
      "Remarks",
    ]);

    let imported = 0;
    let skipped = 0;
    const errors = [];

    const statusMap = {
      p: "Present",
      "1p": "Present",
      present: "Present",
      a: "Absent",
      absent: "Absent",
      hd: "Half Day",
      "half day": "Half Day",
      halfday: "Half Day",
      l: "Leave",
      leave: "Leave",
      h: "Holiday",
      holiday: "Holiday",
      wo: "Week Off",
      "w/o": "Week Off",
      "week off": "Week Off",
      weekoff: "Week Off",
    };

    for (let i = headerIndex + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      if (!row.some((v) => clean(v))) continue;

      const excelRow = i + 1;

      try {
        const employeeCode = clean(getCell(row, employeeCodeIndex));
        const employee = employeeCodeMap.get(
          normalizeLookupKey(employeeCode)
        );

        if (!employeeCode) {
          throw new Error("Employee Code is missing.");
        }

        if (!employee) {
          throw new Error(
            `Employee Code "${employeeCode}" not found in Employee Master.`
          );
        }

        const parsedDate = parseAttendanceDate(
          getCell(row, dateIndex)
        );

        if (!parsedDate) {
          throw new Error(
            "Invalid or missing Date. Excel time-only/1900 dates are not accepted."
          );
        }

        let status = clean(getCell(row, statusIndex));
        status =
          statusMap[status.toLowerCase()] || status;

        if (!Object.values(statusMap).includes(status)) {
          throw new Error(`Invalid Status "${status}".`);
        }

        // Daily imports preserve existing behavior: Week Off/Holiday are
        // valid but do not require punches.
        const shiftName = clean(getCell(row, shiftNameIndex));
        const effectiveRule = getEffectiveAttendanceRule(
          attendanceSettings,
          parsedDate
        );

        let shift = shiftName
          ? shiftMap.get(normalizeLookupKey(shiftName)) || null
          : null;

        if (!shift) {
          shift = getRuleShiftForEmployee(effectiveRule, employee, shifts) || null;
        }

        const checkIn = normalizeTime(
          getCell(row, checkInIndex)
        );
        const checkOut = normalizeTime(
          getCell(row, checkOutIndex)
        );

        if (
          status === "Present" &&
          (!checkIn || !checkOut)
        ) {
          throw new Error(
            "Present attendance requires Check In and Check Out."
          );
        }

        const requiredWorkMinutes =
          Number.isFinite(Number(effectiveRule.requiredWorkMinutes)) &&
          Number(effectiveRule.requiredWorkMinutes) >= 0
            ? Number(effectiveRule.requiredWorkMinutes)
            : null;

        const adjustment =
          status === "Present"
            ? calculateTimeAdjustments(
                checkIn,
                checkOut,
                shift,
                requiredWorkMinutes,
                effectiveRule.overtimeAllowed !== false
              )
            : {
                overtimeHours: 0,
                cuttingMinutes: 0,
              };

        const finalLocation =
          clean(getCell(row, workLocationIndex)) ||
          employee.workLocation ||
          employee.location ||
          "";

        const note = clean(getCell(row, noteIndex));

        await Attendance.findOneAndUpdate(
          {
            employeeId: employee._id,
            date: parsedDate,
          },
          {
            $set: {
              employeeId: employee._id,
              date: parsedDate,
              status,
              checkIn,
              checkOut,
              workLocation: finalLocation,
              shiftId: shift?._id || null,
              shiftName: shift?.name || shiftName || "",
              overtimeHours: adjustment.overtimeHours,
              cuttingMinutes: adjustment.cuttingMinutes,
              overtimeApproved: false,
              overtimeApprovedBy: null,
              overtimeApprovedAt: null,
              cuttingApproved: false,
              cuttingApprovedBy: null,
              cuttingApprovedAt: null,
              note,
            },
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

        imported++;
      } catch (rowError) {
        skipped++;
        errors.push({
          row: excelRow,
          message: rowError.message,
        });
      }
    }

    if (imported === 0 && skipped > 0) {
      return res.status(400).json({
        success: false,
        imported,
        skipped,
        total: rows.length - headerIndex - 1,
        errors,
        message:
          `No attendance records were imported. ${skipped} row(s) were skipped.`,
      });
    }

    return res.json({
      success: skipped === 0,
      partialSuccess: imported > 0 && skipped > 0,
      format: "daily-row",
      sheetName,
      firstSheet: true,
      message:
        skipped > 0
          ? `Imported ${imported} record(s); ${skipped} row(s) skipped.`
          : `Successfully imported ${imported} record(s).`,
      imported,
      skipped,
      total: rows.length - headerIndex - 1,
      errors,
    });
  } catch (error) {
    console.error("importAttendanceExcel:", error);

    res.status(500).json({
      success: false,
      message:
        error.message ||
        "Attendance Excel import failed.",
    });
  }
}

/* =========================================================
   ATTENDANCE SETTINGS
========================================================= */

export async function getAttendanceSettings(
  req,
  res
) {
  try {
    let settings =
      await AttendanceSetting.findOne({});

    if (!settings) {
      settings =
        await AttendanceSetting.create({
          saturday: {
            type: "Working",
            shiftId: null,
            overtimeAllowed: true,
          },

          days: {
            monday: {
              type: "Working",
              shiftId: null,
              overtimeAllowed: true,
            },

            tuesday: {
              type: "Working",
              shiftId: null,
              overtimeAllowed: true,
            },

            wednesday: {
              type: "Working",
              shiftId: null,
              overtimeAllowed: true,
            },

            thursday: {
              type: "Working",
              shiftId: null,
              overtimeAllowed: true,
            },

            friday: {
              type: "Working",
              shiftId: null,
              overtimeAllowed: true,
            },

            saturday: {
              type: "Working",
              shiftId: null,
              overtimeAllowed: true,
            },

            sunday: {
              type: "Week Off",
              shiftId: null,
              overtimeAllowed: false,
            },
          },
        });
    }

    const shifts =
      await Shift.find({})
        .sort({
          name: 1,
        });

    res.json({
      success: true,
      settings,
      shifts,
    });
  } catch (error) {
    console.error(
      "getAttendanceSettings:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function saveAttendanceSettings(
  req,
  res
) {
  try {
    const body = { ...req.body };
    const normalizeSavedRule = (rule) => {
      if (!rule || typeof rule !== "object") return rule;
      const shiftIds = normalizeRuleShiftIds(rule);
      return { ...rule, shiftIds, shiftId: shiftIds[0] || null };
    };

    if (body.saturday) body.saturday = normalizeSavedRule(body.saturday);
    if (body.days && typeof body.days === "object") {
      body.days = Object.fromEntries(
        Object.entries(body.days).map(([key, rule]) => [key, normalizeSavedRule(rule)])
      );
    }
    if (Array.isArray(body.dateOverrides)) {
      body.dateOverrides = body.dateOverrides.map(normalizeSavedRule);
    }

    let settings = await AttendanceSetting.findOne({});

    if (!settings) {
      settings = await AttendanceSetting.create(body);
    } else {
      Object.assign(settings, body);
      await settings.save();
    }

    res.json({
      success: true,
      message:
        "Attendance rules saved.",
      settings,
    });
  } catch (error) {
    console.error(
      "saveAttendanceSettings:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/* =========================================================
   SHIFTS
========================================================= */

export async function getShifts(req, res) {
  try {
    const shifts =
      await Shift.find({})
        .sort({
          name: 1,
        });

    res.json({
      success: true,
      shifts,
    });
  } catch (error) {
    console.error(
      "getShifts:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function createShift(req, res) {
  try {
    const shift =
      await Shift.create({
        ...req.body,

        breakMinutes:
          n(req.body.breakMinutes),

        graceMinutes:
          n(req.body.graceMinutes),

        overtimeAfterMinutes:
          n(
            req.body.overtimeAfterMinutes
          ),
      });

    res.status(201).json({
      success: true,
      message: "Shift created.",
      shift,
    });
  } catch (error) {
    console.error(
      "createShift:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function updateShift(req, res) {
  try {
    const shift =
      await Shift.findByIdAndUpdate(
        req.params.id,

        {
          ...req.body,

          breakMinutes:
            n(req.body.breakMinutes),

          graceMinutes:
            n(req.body.graceMinutes),

          overtimeAfterMinutes:
            n(
              req.body
                .overtimeAfterMinutes
            ),
        },

        {
          new: true,
          runValidators: true,
        }
      );

    if (!shift) {
      return res.status(404).json({
        success: false,
        message: "Shift not found.",
      });
    }

    res.json({
      success: true,
      message: "Shift updated.",
      shift,
    });
  } catch (error) {
    console.error(
      "updateShift:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/* =========================================================
   LEAVES
========================================================= */

export async function getLeaves(req, res) {
  try {
    const leaves =
      await Leave.find({})
        .populate(
          "employeeId",
          "employeeCode name department designation"
        )
        .sort({
          fromDate: -1,
        });

    res.json({
      success: true,
      leaves,
    });
  } catch (error) {
    console.error(
      "getLeaves:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function createLeave(req, res) {
  try {
    const leave =
      await Leave.create(req.body);

    res.status(201).json({
      success: true,
      leave,
    });
  } catch (error) {
    console.error(
      "createLeave:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

export async function updateLeaveStatus(
  req,
  res
) {
  try {
    const leave =
      await Leave.findByIdAndUpdate(
        req.params.id,

        {
          status: req.body.status,
        },

        {
          new: true,
        }
      );

    if (!leave) {
      return res.status(404).json({
        success: false,
        message: "Leave not found.",
      });
    }

    res.json({
      success: true,
      leave,
    });
  } catch (error) {
    console.error(
      "updateLeaveStatus:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/* =========================================================
   HOLIDAYS
========================================================= */

export async function getHolidays(req, res) {
  try {
    const holidays =
      await Holiday.find({})
        .sort({
          date: 1,
        });

    res.json({
      success: true,
      holidays,
    });
  } catch (error) {
    console.error(
      "getHolidays:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function createHoliday(
  req,
  res
) {
  try {
    const holiday =
      await Holiday.create(
        req.body
      );

    res.status(201).json({
      success: true,
      holiday,
    });
  } catch (error) {
    console.error(
      "createHoliday:",
      error
    );

    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
}

/* =========================================================
   SALARY
========================================================= */

export async function getSalaries(req, res) {
  try {
    const salaries =
      await Salary.find({})
        .populate(
          "employeeId",
          "employeeCode name department designation"
        )
        .sort({
          year: -1,
          month: -1,
        });

    res.json({
      success: true,
      salaries,
    });
  } catch (error) {
    console.error(
      "getSalaries:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function generateSalary(
  req,
  res
) {
  try {
    const month =
      Number(req.body.month);

    const year =
      Number(req.body.year);

    if (
      !month ||
      !year ||
      month < 1 ||
      month > 12
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Valid month and year are required.",
      });
    }

    const employeeFilter = {};

    if (Array.isArray(req.body.employeeIds) && req.body.employeeIds.length) {
      employeeFilter._id = { $in: req.body.employeeIds };
    }

    if (req.body.companyName) {
      employeeFilter.companyName = String(req.body.companyName).trim();
    }

    const employees =
      await Employee.find(employeeFilter);

    const start = new Date(
      Date.UTC(
        year,
        month - 1,
        1
      )
    );

    const end = new Date(
      Date.UTC(
        year,
        month,
        1
      )
    );

    const attendance =
      await Attendance.find({
        date: {
          $gte: start,
          $lt: end,
        },
      });

    const generated = [];

    for (const employee of employees) {
      const employeeAttendance =
        attendance.filter(
          (a) =>
            String(a.employeeId) ===
            String(employee._id)
        );

      const presentDays =
        employeeAttendance.filter(
          (a) =>
            a.status === "Present"
        ).length;

      const halfDays =
        employeeAttendance.filter(
          (a) =>
            a.status === "Half Day"
        ).length;

      const basic =
        n(employee.basicSalary || employee.basic);

      const gross =
        n(employee.grossSalary);

      const workingDays = 26;

      const payableDays =
        presentDays +
        halfDays * 0.5;

      const attendancePay =
        gross > 0
          ? (gross / workingDays) *
            payableDays
          : 0;

      let overtimeHours = 0;
      let cuttingMinutes = 0;

      for (
        const a of employeeAttendance
      ) {
        if (a.overtimeApproved) {
          overtimeHours +=
            n(a.overtimeHours);
        }

        if (a.cuttingApproved) {
          cuttingMinutes +=
            n(a.cuttingMinutes);
        }
      }

      const overtimeRate =
        n(req.body.overtimeRate) ||
        (basic / 26 / 8) * 1.5;

      const overtimeAmount =
        overtimeHours *
        overtimeRate;

      const cuttingRate =
        basic / 26 / 8;

      const cuttingAmount =
        (cuttingMinutes / 60) *
        cuttingRate;

      const unpaidDeduction =
        Math.max(
          0,
          workingDays -
            payableDays
        ) *
        (gross / workingDays);

      const deductions =
        unpaidDeduction +
        cuttingAmount;

      const grossSalary =
        attendancePay +
        overtimeAmount;

      const netSalary =
        Math.max(
          0,
          grossSalary -
            deductions
        );

      const salary =
        await Salary.findOneAndUpdate(
          {
            employeeId:
              employee._id,

            month,
            year,
          },

          {
            $set: {
              employeeId:
                employee._id,

              month,
              year,

              workingDays,
              presentDays,
              halfDays,
              payableDays,

              overtimeHours,
              overtimeAmount,

              cuttingMinutes,
              cuttingAmount,

              grossSalary,
              deductions,
              netSalary,
              status: "Processed",
            },
          },

          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          }
        );

      generated.push(salary);
    }

    res.json({
      success: true,
      message:
        "Salary generated successfully.",
      salaries: generated,
    });
  } catch (error) {
    console.error(
      "generateSalary:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function getSalarySlip(
  req,
  res
) {
  try {
    const salary =
      await Salary.findById(
        req.params.id
      ).populate(
        "employeeId"
      );

    if (!salary) {
      return res.status(404).json({
        success: false,
        message: "Salary not found.",
      });
    }

    res.json({
      success: true,
      salary,
    });
  } catch (error) {
    console.error(
      "getSalarySlip:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

/* =========================================================
   PAYROLL APPROVAL
========================================================= */

function payrollRange(
  month,
  year
) {
  return {
    start: new Date(
      Date.UTC(
        year,
        month - 1,
        1
      )
    ),

    end: new Date(
      Date.UTC(
        year,
        month,
        1
      )
    ),
  };
}

export async function payrollApprovals(
  req,
  res
) {
  try {
    const month =
      Number(req.query.month) ||
      new Date().getMonth() + 1;

    const year =
      Number(req.query.year) ||
      new Date().getFullYear();

    const {
      start,
      end,
    } =
      payrollRange(
        month,
        year
      );

    const rows =
      await Attendance.find({
        date: {
          $gte: start,
          $lt: end,
        },

        $or: [
          {
            overtimeHours: {
              $gt: 0,
            },
          },

          {
            cuttingMinutes: {
              $gt: 0,
            },
          },
        ],
      })
        .populate(
          "employeeId",
          "employeeCode name department designation workLocation"
        )
        .populate(
          "shiftId",
          "name startTime endTime breakMinutes"
        )
        .sort({
          date: 1,
        });

    res.json({
      success: true,
      approvals: rows,
    });
  } catch (error) {
    console.error(
      "payrollApprovals:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function approvePayrollAdjustments(
  req,
  res
) {
  try {
    const ids =
      Array.isArray(req.body.ids)
        ? req.body.ids
        : [];

    if (!ids.length) {
      return res.status(400).json({
        success: false,
        message:
          "Select at least one record.",
      });
    }

    const update = {};
    const now = new Date();

    if (
      req.body.overtimeApproved !==
      undefined
    ) {
      const approved =
        Boolean(
          req.body.overtimeApproved
        );

      update.overtimeApproved =
        approved;

      update.overtimeApprovedBy =
        req.user?._id || null;

      update.overtimeApprovedAt =
        approved ? now : null;
    }

    if (
      req.body.cuttingApproved !==
      undefined
    ) {
      const approved =
        Boolean(
          req.body.cuttingApproved
        );

      update.cuttingApproved =
        approved;

      update.cuttingApprovedBy =
        req.user?._id || null;

      update.cuttingApprovedAt =
        approved ? now : null;
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({
        success: false,
        message:
          "Choose OT approval or cutting approval.",
      });
    }

    const result =
      await Attendance.updateMany(
        {
          _id: {
            $in: ids,
          },
        },

        {
          $set: update,
        }
      );

    res.json({
      success: true,

      message:
        `${result.modifiedCount} attendance adjustment(s) updated.`,

      modifiedCount:
        result.modifiedCount,
    });
  } catch (error) {
    console.error(
      "approvePayrollAdjustments:",
      error
    );

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}
