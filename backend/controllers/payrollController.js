import Payroll from "../models/Payroll.js";
import User from "../models/User.js";

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function totalItems(items = []) {
  return items.reduce(
    (sum, item) => sum + num(item.amount),
    0
  );
}

function calculatePayroll(data) {
  const basicSalary = num(data.basicSalary);

  const additions = Array.isArray(data.additions)
    ? data.additions
    : [];

  const deductions = Array.isArray(data.deductions)
    ? data.deductions
    : [];

  const additionTotal = totalItems(additions);
  const deductionTotal = totalItems(deductions);

  const grossSalary =
    basicSalary + additionTotal;

  const netSalary =
    Math.max(0, grossSalary - deductionTotal);

  return {
    basicSalary,
    grossSalary,
    totalDeductions: deductionTotal,
    netSalary,
  };
}

export const createPayroll = async (req, res) => {
  try {
    const {
      employeeId,
      month,
      year,
      workingDays,
      presentDays,
      paidLeaveDays,
      holidayDays,
      weeklyOffDays,
      absentDays,
      lwpDays,
      overtimeHours,
      basicSalary,
      additions,
      deductions,
      status,
    } = req.body;

    if (!employeeId || !month || !year) {
      return res.status(400).json({
        success: false,
        message:
          "Employee, month and year are required.",
      });
    }

    const employee = await User.findById(employeeId);

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found.",
      });
    }

    const calculated = calculatePayroll({
      basicSalary,
      additions,
      deductions,
    });

    const payroll =
      await Payroll.findOneAndUpdate(
        {
          employeeId,
          month: Number(month),
          year: Number(year),
        },
        {
          employeeId,
          month: Number(month),
          year: Number(year),

          workingDays: num(workingDays),
          presentDays: num(presentDays),
          paidLeaveDays: num(paidLeaveDays),
          holidayDays: num(holidayDays),
          weeklyOffDays: num(weeklyOffDays),
          absentDays: num(absentDays),
          lwpDays: num(lwpDays),
          overtimeHours: num(overtimeHours),

          basicSalary: calculated.basicSalary,
          additions: Array.isArray(additions)
            ? additions
            : [],
          deductions: Array.isArray(deductions)
            ? deductions
            : [],

          grossSalary:
            calculated.grossSalary,

          totalDeductions:
            calculated.totalDeductions,

          netSalary:
            calculated.netSalary,

          status: status || "Draft",

          processedAt:
            status === "Processed" ||
            status === "Paid"
              ? new Date()
              : null,
        },
        {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true,
        }
      );

    const populated =
      await payroll.populate(
        "employeeId",
        "name email mobile role"
      );

    return res.status(200).json({
      success: true,
      message: "Payroll saved successfully.",
      payroll: populated,
    });
  } catch (error) {
    console.error(
      "CREATE PAYROLL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to save payroll.",
    });
  }
};

export const getPayrolls = async (req, res) => {
  try {
    const { month, year, employeeId } = req.query;

    const filter = {};

    if (month) {
      filter.month = Number(month);
    }

    if (year) {
      filter.year = Number(year);
    }

    if (employeeId) {
      filter.employeeId = employeeId;
    }

    const payrolls =
      await Payroll.find(filter)
        .populate(
          "employeeId",
          "name email mobile role"
        )
        .sort({
          year: -1,
          month: -1,
          createdAt: -1,
        });

    return res.json({
      success: true,
      payrolls,
    });
  } catch (error) {
    console.error(
      "GET PAYROLL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load payroll.",
    });
  }
};

export const getPayrollById = async (req, res) => {
  try {
    const payroll =
      await Payroll.findById(
        req.params.id
      ).populate(
        "employeeId",
        "name email mobile role"
      );

    if (!payroll) {
      return res.status(404).json({
        success: false,
        message: "Payroll not found.",
      });
    }

    return res.json({
      success: true,
      payroll,
    });
  } catch (error) {
    console.error(
      "GET PAYROLL BY ID ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load payroll.",
    });
  }
};
