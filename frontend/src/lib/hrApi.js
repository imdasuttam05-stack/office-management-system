import axios from "axios";

const API_URL = (
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com"
)
  .trim()
  .replace(/^=+/, "")
  .replace(/\/+$/, "");

function getToken() {
  return localStorage.getItem("token") || "";
}

async function request(path, options = {}) {
  const token = getToken();

  try {
    const response = await axios({
      url: `${API_URL}/api/payroll${path}`,
      method: options.method || "GET",
      data: options.body
        ? JSON.parse(options.body)
        : undefined,
      headers: {
        ...(token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),
        ...(options.headers || {}),
      },
      withCredentials: true,
    });

    return response.data;
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;

    if (status === 401) {
      throw new Error(
        data?.message ||
          "Session expired. Please login again."
      );
    }

    if (status === 403) {
      throw new Error(
        data?.message ||
          "You do not have permission for this action."
      );
    }

    throw new Error(
      data?.message ||
        error?.message ||
        `HR request failed (${
          status || "network error"
        }).`
    );
  }
}

export const hrApi = {
  // =========================
  // EMPLOYEES
  // =========================

  employees: () =>
    request("/employees"),

  options: () =>
    request("/options"),

  saveOptions: (body) =>
    request("/options", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  createCompany: (name) =>
    request("/companies", {
      method: "POST",
      body: JSON.stringify({
        name,
      }),
    }),

  createEmployee: (body) =>
    request("/employees", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateEmployee: (id, body) =>
    request(`/employees/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  employeeTasks: (q = "") =>
    request(`/employee-tasks${q}`),

  createEmployeeTask: (body) =>
    request("/employee-tasks", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateEmployeeTask: (id, body) =>
    request(`/employee-tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  employeeLetterTypes: () =>
    request("/employee-letter-types"),

  previewEmployeeLetter: (body) =>
    request("/employee-letters/preview", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  sendEmployeeLetter: (body) =>
    request("/employee-letters/send", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  employeeLetters: (q = "") =>
    request(`/employee-letters${q}`),

  // =========================
  // ATTENDANCE
  // =========================

  attendance: (q = "") =>
    request(`/attendance${q}`),

  saveAttendance: (body) =>
    request("/attendance", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  uploadAttendance: async (file) => {
    const token = getToken();

    const form = new FormData();

    form.append("file", file);

    try {
      const response = await axios.post(
        `${API_URL}/api/payroll/attendance/import`,
        form,
        {
          headers: {
            ...(token
              ? {
                  Authorization: `Bearer ${token}`,
                }
              : {}),
          },
          withCredentials: true,
        }
      );

      return response.data;
    } catch (error) {
      const status =
        error?.response?.status;

      const data =
        error?.response?.data;

      if (status === 401) {
        throw new Error(
          data?.message ||
            "Session expired. Please login again."
        );
      }

      if (status === 403) {
        throw new Error(
          data?.message ||
            "You do not have permission for this action."
        );
      }

      throw new Error(
        data?.message ||
          error?.message ||
          `Attendance upload failed (${
            status || "network error"
          }).`
      );
    }
  },

  attendanceSettings: () =>
    request("/attendance/settings"),

  saveAttendanceSettings: (body) =>
    request("/attendance/settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // =========================
  // SHIFTS
  // =========================

  shifts: () =>
    request("/shifts"),

  createShift: (body) =>
    request("/shifts", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateShift: (id, body) =>
    request(`/shifts/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  // =========================
  // PAYROLL APPROVALS
  // =========================

  payrollApprovals: (q = "") =>
    request(`/approvals${q}`),

  approvePayrollAdjustments: (body) =>
    request("/approvals/bulk", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // =========================
  // LEAVE
  // =========================

  leaves: (q = "") =>
    request(`/leaves${q}`),

  createLeave: (body) =>
    request("/leaves", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateLeaveStatus: (id, status) =>
    request(`/leaves/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }),

  // =========================
  // HOLIDAYS
  // =========================

  holidays: () =>
    request("/holidays"),

  createHoliday: (body) =>
    request("/holidays", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  // =========================
  // SALARY
  // =========================

  salaries: (q = "") =>
    request(`/salaries${q}`),

  generateSalary: (body) =>
    request("/salaries/generate", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  salarySlip: (id) =>
    request(`/salaries/${id}/slip`),
};
