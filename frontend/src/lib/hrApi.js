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

  const res = await fetch(
    `${API_URL}/api/payroll${path}`,
    {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        Authorization: token ? `Bearer ${token}` : "",
        ...(options.headers || {}),
      },
      credentials: "include",
    }
  );

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      data?.message ||
      `HR request failed (${res.status}).`;
    throw new Error(message);
  }

  return data;
}

export const hrApi = {
  employees: () => request("/employees"),

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

  attendance: (q = "") =>
    request(`/attendance${q}`),

  saveAttendance: (body) =>
    request("/attendance", {
      method: "POST",
      body: JSON.stringify(body),
    }),

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
      body: JSON.stringify({ status }),
    }),

  holidays: () =>
    request("/holidays"),

  createHoliday: (body) =>
    request("/holidays", {
      method: "POST",
      body: JSON.stringify(body),
    }),

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
