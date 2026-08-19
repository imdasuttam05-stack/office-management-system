export const PERMISSIONS = [
  "dashboard.view",

  "users.view",
  "users.create",
  "users.edit",
  "users.disable",
  "users.changeRole",
  "users.changePermission",
  "users.manageAdmin",

  "employees.view",
  "employees.create",
  "employees.edit",
  "employees.delete",

  "attendance.view",
  "attendance.create",
  "attendance.edit",

  "leave.view",
  "leave.create",
  "leave.approve",

  "payroll.view",
  "payroll.create",
  "payroll.edit",
  "payroll.generate",

  "expense.view",
  "expense.create",
  "expense.edit",
  "expense.delete",
  "expense.approve",
  "expense.reject",

  "purchase.view",
  "purchase.create",
  "purchase.edit",
  "purchase.delete",

  "sales.view",
  "sales.create",
  "sales.edit",
  "sales.delete",

  "stock.view",
  "stock.issue",
  "stock.receive",
  "stock.transfer",
  "stock.adjust",

  "accounts.view",
  "accounts.payment",
  "accounts.receipt",
  "accounts.journal",
  "accounts.debitNote",
  "accounts.creditNote",

  "manufacturing.view",
  "manufacturing.jobOrder",
  "manufacturing.production",
  "manufacturing.packing",
  "manufacturing.costing",

  "reports.view",
  "reports.export",

  "security.audit",
  "security.sessions",
];

const ALL_BUSINESS_PERMISSIONS = PERMISSIONS.filter(
  (permission) =>
    !permission.startsWith("users.manageAdmin") &&
    permission !== "users.changePermission"
);

export const ROLE_DEFAULT_PERMISSIONS = {
  Admin: ALL_BUSINESS_PERMISSIONS,

  Manager: [
    "dashboard.view",
    "users.view",
    "employees.view",
    "employees.create",
    "employees.edit",
    "attendance.view",
    "attendance.create",
    "attendance.edit",
    "leave.view",
    "leave.approve",
    "expense.view",
    "expense.create",
    "expense.edit",
    "expense.approve",
    "expense.reject",
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "sales.view",
    "sales.create",
    "sales.edit",
    "stock.view",
    "stock.issue",
    "stock.receive",
    "stock.transfer",
    "manufacturing.view",
    "manufacturing.jobOrder",
    "manufacturing.production",
    "manufacturing.packing",
    "manufacturing.costing",
    "accounts.view",
    "reports.view",
    "reports.export",
  ],

  HR: [
    "dashboard.view",
    "users.view",
    "employees.view",
    "employees.create",
    "employees.edit",
    "attendance.view",
    "attendance.create",
    "attendance.edit",
    "leave.view",
    "leave.create",
    "leave.approve",
    "payroll.view",
    "payroll.create",
    "payroll.edit",
    "payroll.generate",
    "reports.view",
    "reports.export",
  ],

  BM: [
    "dashboard.view",
    "users.view",
    "employees.view",
    "employees.create",
    "employees.edit",
    "attendance.view",
    "attendance.create",
    "leave.view",
    "leave.approve",
    "expense.view",
    "expense.create",
    "expense.approve",
    "purchase.view",
    "purchase.create",
    "sales.view",
    "sales.create",
    "stock.view",
    "stock.issue",
    "stock.receive",
    "stock.transfer",
    "accounts.view",
    "reports.view",
  ],

  HO: [
    "dashboard.view",
    "users.view",
    "employees.view",
    "attendance.view",
    "leave.view",
    "payroll.view",
    "expense.view",
    "purchase.view",
    "sales.view",
    "stock.view",
    "accounts.view",
    "manufacturing.view",
    "reports.view",
    "reports.export",
  ],

  Accountant: [
    "dashboard.view",
    "accounts.view",
    "accounts.payment",
    "accounts.receipt",
    "accounts.journal",
    "accounts.debitNote",
    "accounts.creditNote",
    "expense.view",
    "expense.create",
    "expense.edit",
    "reports.view",
    "reports.export",
  ],

  Sales: [
    "dashboard.view",
    "sales.view",
    "sales.create",
    "sales.edit",
    "accounts.view",
    "accounts.receipt",
    "reports.view",
  ],

  Purchase: [
    "dashboard.view",
    "purchase.view",
    "purchase.create",
    "purchase.edit",
    "accounts.view",
    "reports.view",
  ],

  Store: [
    "dashboard.view",
    "stock.view",
    "stock.issue",
    "stock.receive",
    "stock.transfer",
    "stock.adjust",
    "purchase.view",
    "sales.view",
    "reports.view",
  ],

  Employee: [
    "dashboard.view",
    "employees.view",
    "attendance.view",
    "attendance.create",
    "leave.view",
    "leave.create",
    "expense.view",
    "expense.create",
  ],
};

export function getDefaultPermissionsForUser(user) {
  if (user?.isMainAdmin) {
    return ["*"];
  }

  const custom = Array.isArray(user?.permissions)
    ? user.permissions.filter(Boolean)
    : [];

  if (custom.length) {
    return [...new Set(custom)];
  }

  return [...(ROLE_DEFAULT_PERMISSIONS[user?.role] || [])];
}
