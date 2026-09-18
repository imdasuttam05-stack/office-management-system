import xlsx from "xlsx";

import Employee from "../models/Employee.js";
import Attendance from "../models/Attendance.js";
import Shift from "../models/Shift.js";
import AttendanceSetting from "../models/AttendanceSetting.js";
import Leave from "../models/Leave.js";
import Holiday from "../models/Holiday.js";
import Salary from "../models/Salary.js";

/* =========================================================
   COMMON HELPERS
========================================================= */

const n = (v) =>
  Number.isFinite(Number(v)) ? Number(v) : 0;

function clean(v) {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function timeToMinutes(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  // Excel can sometimes provide a numeric fraction of a day.
  if (typeof value === "number" && value >= 0 && value < 1) {
    return Math.round(value * 24 * 60);
  }

  const raw = String(value).trim();

  // 10.12 / 10:12 / 10:12 AM / 18:50
  const m = raw.match(
    /^(\d{1,2})[:.](\d{2})\s*(AM|PM)?$/i
  );

  if (!m) return null;

  let h = Number(m[1]);
  const mm = Number(m[2]);

  if (mm < 0 || mm > 59) return null;

  const ap = (m[3] || "").toUpperCase();

  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;

  if (h < 0 || h > 23) return null;

  return h * 60 + mm;
}

function normalizeTime(value) {
  const mins = timeToMinutes(value);

  if (mins === null) return "";

  const h24 = Math.floor(mins / 60);
  const mm = mins % 60;

  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;

  return `${String(h12).padStart(2, "0")}:${String(mm).padStart(
    2,
    "0"
  )} ${ap}`;
}

/*
  Date parser supports:

  18-09-2026
  18/09/2026
  18.09.2026
  2026-09-18
  Excel serial date
  JS Date
*/
function parseAttendanceDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(
        value.getFullYear(),
        value.getMonth(),
        value.getDate()
      )
    );
  }

  if (typeof value === "number") {
    // Excel serial date
    const parsed = xlsx.SSF.parse_date_code(value);

    if (parsed) {
      return new Date(
        Date.UTC(
          parsed.y,
          parsed.m - 1,
          parsed.d
        )
      );
    }
  }

  const raw = clean(value);

  if (!raw) return null;

  // YYYY-MM-DD
  let m = raw.match(
    /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/
  );

  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);

    const date = new Date(Date.UTC(y, mo - 1, d));

    return Number.isNaN(date.getTime()) ? null : date;
  }

  // DD-MM-YYYY / DD/MM/YYYY / DD.MM.YYYY
  m = raw.match(
    /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/
  );

  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);

    const date = new Date(Date.UTC(y, mo - 1, d));

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) return null;

  return new Date(
    Date.UTC(
      parsed.getFullYear(),
      parsed.getMonth(),
      parsed.getDate()
    )
  );
}

function dateKey(date) {
  return new Date(date)
    .toISOString()
    .slice(0, 10);
}

/*
  Calculate OT and cutting.

  IMPORTANT:
  The calculation uses the shift's breakMinutes.
  Example:

  Shift = 10:00 AM - 6:30 PM
  Break = 0
  Actual = 10:12 AM - 6:50 PM

  Scheduled = 8h30m
  Actual = 8h38m
  OT = 8 minutes
*/
function calculateTimeAdjustments(
  checkIn,
  checkOut,
  shift
) {
  const cin = timeToMinutes(checkIn);
  const cout = timeToMinutes(checkOut);

  if (
    cin === null ||
    cout === null ||
    !shift
  ) {
    return {
      overtimeHours: 0,
      cuttingMinutes: 0,
    };
  }

  const scheduledStart = timeToMinutes(
    shift.startTime
  );

  const scheduledEnd = timeToMinutes(
    shift.endTime
  );

  if (
    scheduledStart === null ||
    scheduledEnd === null
  ) {
    return {
      overtimeHours: 0,
      cuttingMinutes: 0,
    };
  }

  let scheduled =
    scheduledEnd - scheduledStart;

  if (scheduled < 0) {
    scheduled += 1440;
  }

  /*
    Break is deducted only when configured.
    If your shift should count the full
    10:00-18:30 period, keep breakMinutes = 0.
  */
  scheduled = Math.max(
    0,
    scheduled - n(shift.breakMinutes)
  );

  let actual = cout - cin;

  if (actual < 0) {
    actual += 1440;
  }

  const delta = actual - scheduled;

  return {
    overtimeHours:
      delta > 0
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
    const employee = await Employee.create(req.body);

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
    const [employees, shifts] =
      await Promise.all([
        Employee.find({}).sort({ name: 1 }),
        Shift.find({ status: { $ne: "Inactive" } }).sort({
          name: 1,
        }),
      ]);

    res.json({
      success: true,
      employees,
      shifts,
    });
  } catch (error) {
    console.error("getOptions:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

export async function saveOptions(req, res) {
  res.json({
    success: true,
    message: "Options saved.",
  });
}

export async function createCompany(req, res) {
  res.status(201).json({
    success: true,
    message: "Company created.",
    company: req.body,
  });
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

    let attendance = await Attendance.find(query)
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

    /*
      includeStaff=1 means employees without an
      attendance record must also appear.
    */
    if (includeStaff === "1") {
      const existing = new Set(
        attendance.map(
          (a) =>
            `${a.employeeId?._id}_${dateKey(a.date)}`
        )
      );

      const employees = await Employee.find({})
        .sort({ name: 1 });

      const fromDate = from
        ? new Date(`${from}T00:00:00.000Z`)
        : null;

      const toDate = to
        ? new Date(`${to}T00:00:00.000Z`)
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
          d.setUTCDate(d.getUTCDate() + 1)
        ) {
          for (const emp of employees) {
            const key =
              `${emp._id}_${dateKey(d)}`;

            if (existing.has(key)) continue;

            attendance.push({
              _id: `virtual-${emp._id}-${dateKey(d)}`,
              employeeId: emp,
              date: new Date(d),
              status: "Absent",
              checkIn: "",
              checkOut: "",
              workLocation:
                emp.workLocation ||
                emp.location ||
                "",
              shiftId: null,
              shiftName: "",
              overtimeHours: 0,
              cuttingMinutes: 0,
              note: "",
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
    console.error("getAttendance:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

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
      await Employee.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    let shift = null;

    if (shiftId) {
      shift = await Shift.findById(shiftId);
    }

    const adjustment =
      status === "Present"
        ? calculateTimeAdjustments(
            checkIn,
            checkOut,
            shift
          )
        : {
            overtimeHours: 0,
            cuttingMinutes: 0,
          };

    const attendance =
      await Attendance.findOneAndUpdate(
        {
          employeeId,
          date: new Date(date),
        },
        {
          $set: {
            employeeId,
            date: new Date(date),
            status,
            checkIn: normalizeTime(checkIn),
            checkOut: normalizeTime(checkOut),
            workLocation:
              workLocation ||
              employee.workLocation ||
              employee.location ||
              "",
            shiftId: shift?._id || null,
            shiftName: shift?.name || "",
            overtimeHours:
              adjustment.overtimeHours,
            cuttingMinutes:
              adjustment.cuttingMinutes,

            /*
              New attendance save requires
              fresh approval.
            */
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
      message: "Attendance saved successfully.",
      attendance,
    });
  } catch (error) {
    console.error("saveAttendance:", error);

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
        message:
          "Please upload an Excel or CSV file.",
      });
    }

    const workbook =
      xlsx.read(req.file.buffer, {
        type: "buffer",
        cellDates: true,
      });

    const sheetName =
      workbook.SheetNames[0];

    if (!sheetName) {
      return res.status(400).json({
        success: false,
        message: "Excel file has no worksheet.",
      });
    }

    const sheet =
      workbook.Sheets[sheetName];

    const data =
      xlsx.utils.sheet_to_json(sheet, {
        defval: "",
        raw: true,
      });

    if (!data.length) {
      return res.status(400).json({
        success: false,
        message:
          "Excel file contains no attendance rows.",
      });
    }

    /*
      Accept common variations of column names.
    */
    function getValue(row, names) {
      for (const name of names) {
        if (
          Object.prototype.hasOwnProperty.call(
            row,
            name
          )
        ) {
          return row[name];
        }
      }

      /*
        Case-insensitive fallback.
      */
      const keys = Object.keys(row);

      for (const name of names) {
        const found = keys.find(
          (key) =>
            key.trim().toLowerCase() ===
            name.trim().toLowerCase()
        );

        if (found) return row[found];
      }

      return "";
    }

    const employees =
      await Employee.find({});

    const employeeMap = new Map();

    for (const employee of employees) {
      if (employee.employeeCode) {
        employeeMap.set(
          clean(employee.employeeCode).toLowerCase(),
          employee
        );
      }
    }

    const shifts =
      await Shift.find({});

    const shiftMap = new Map();

    for (const shift of shifts) {
      if (shift.name) {
        shiftMap.set(
          clean(shift.name).toLowerCase(),
          shift
        );
      }
    }

    let imported = 0;
    let skipped = 0;

    const errors = [];

    for (
      let index = 0;
      index < data.length;
      index++
    ) {
      const row = data[index];

      const excelRow = index + 2;

      try {
        const employeeCode =
          clean(
            getValue(row, [
              "Employee Code",
              "EmployeeCode",
              "Employee code",
              "Emp Code",
              "EmpCode",
              "Code",
            ])
          );

        const rawDate =
          getValue(row, [
            "Date",
            "Attendance Date",
            "attendanceDate",
          ]);

        const rawStatus =
          clean(
            getValue(row, [
              "Status",
              "Attendance Status",
            ])
          );

        const rawCheckIn =
          getValue(row, [
            "Check In",
            "CheckIn",
            "In",
            "Start Time",
            "Start",
          ]);

        const rawCheckOut =
          getValue(row, [
            "Check Out",
            "CheckOut",
            "Out",
            "End Time",
            "End",
          ]);

        const workLocation =
          clean(
            getValue(row, [
              "Work Location",
              "Location",
              "WorkLocation",
            ])
          );

        const shiftName =
          clean(
            getValue(row, [
              "Shift Name",
              "Shift",
              "ShiftName",
            ])
          );

        const note =
          clean(
            getValue(row, [
              "Note",
              "Notes",
              "Employee Note",
              "Remarks",
            ])
          );

        if (!employeeCode) {
          throw new Error(
            "Employee Code is missing."
          );
        }

        const employee =
          employeeMap.get(
            employeeCode.toLowerCase()
          );

        if (!employee) {
          throw new Error(
            `Employee Code "${employeeCode}" not found in Employee Master.`
          );
        }

        const parsedDate =
          parseAttendanceDate(rawDate);

        if (!parsedDate) {
          throw new Error(
            "Invalid or missing Date."
          );
        }

        /*
          Normalize status.
        */
        let status = rawStatus;

        const statusMap = {
          p: "Present",
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
          "week off": "Week Off",
          weekoff: "Week Off",
        };

        status =
          statusMap[
            status.toLowerCase()
          ] || status;

        const validStatuses = [
          "Present",
          "Absent",
          "Half Day",
          "Leave",
          "Holiday",
          "Week Off",
        ];

        if (
          !validStatuses.includes(status)
        ) {
          throw new Error(
            `Invalid Status "${rawStatus}".`
          );
        }

        /*
          Find shift by name.
        */
        let shift = null;

        if (shiftName) {
          shift =
            shiftMap.get(
              shiftName.toLowerCase()
            ) || null;

          if (!shift) {
            throw new Error(
              `Shift "${shiftName}" not found.`
            );
          }
        }

        /*
          Normalize times.
        */
        const checkIn =
          normalizeTime(rawCheckIn);

        const checkOut =
          normalizeTime(rawCheckOut);

        /*
          Present attendance requires both
          In and Out.
        */
        if (
          status === "Present" &&
          (!checkIn || !checkOut)
        ) {
          throw new Error(
            "Present attendance requires Check In and Check Out."
          );
        }

        const adjustment =
          status === "Present"
            ? calculateTimeAdjustments(
                checkIn,
                checkOut,
                shift
              )
            : {
                overtimeHours: 0,
                cuttingMinutes: 0,
              };

        /*
          Employee location is the fallback.
        */
        const finalLocation =
          workLocation ||
          employee.workLocation ||
          employee.location ||
          "";

        /*
          UPSERT:
          Same Employee + Date will update
          the existing attendance record.
        */
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

              shiftId:
                shift?._id || null,

              shiftName:
                shift?.name ||
                shiftName ||
                "",

              overtimeHours:
                adjustment.overtimeHours,

              cuttingMinutes:
                adjustment.cuttingMinutes,

              /*
                New imported attendance needs
                fresh payroll approval.
              */
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

    res.json({
      success: true,
      message:
        "Attendance Excel import completed.",
      imported,
      skipped,
      total: data.length,
      errors,
    });
  } catch (error) {
    console.error(
      "importAttendanceExcel:",
      error
    );

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
      await Shift.find({}).sort({
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
    let settings =
      await AttendanceSetting.findOne({});

    if (!settings) {
      settings =
        await AttendanceSetting.create(
          req.body
        );
    } else {
      Object.assign(
        settings,
        req.body
      );

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
      await Shift.find({}).sort({
        name: 1,
      });

    res.json({
      success: true,
      shifts,
    });
  } catch (error) {
    console.error("getShifts:", error);

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
    console.error("createShift:", error);

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
              req.body.overtimeAfterMinutes
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
    console.error("getLeaves:", error);

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
    console.error("createLeave:", error);

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
      await Holiday.find({}).sort({
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
      await Holiday.create(req.body);

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

    const employees =
      await Employee.find({});

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
        n(employee.basic);

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

      for (const a of employeeAttendance) {
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
    } = payrollRange(
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
    const ids = Array.isArray(
      req.body.ids
    )
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
