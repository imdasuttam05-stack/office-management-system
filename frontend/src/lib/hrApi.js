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
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      withCredentials: true,
    });

    return response.data;
  } catch (error) {
    const status = error?.response?.status;
    const data = error?.response?.data;

    if (status === 401) {
      throw new Error(data?.message || "Session expired. Please login again.");
    }

    if (status === 403) {
      throw new Error(data?.message || "You do not have permission for this action.");
    }

    throw new Error(
      data?.message ||
        error?.message ||
        `HR request failed (${status || "network error"}).`
    );
  }
}

export const hrApi = {
  employees: () => request("/employees"),
  options: () => request("/options"),
  saveOptions: (body) => request("/options", { method: "PUT", body: JSON.stringify(body) }),
  createCompany: (name) => request("/companies", { method: "POST", body: JSON.stringify({ name }) }),
  createEmployee: (body) => request("/employees", { method: "POST", body: JSON.stringify(body) }),
  updateEmployee: (id, body) => request(`/employees/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  attendance: (q = "") => request(`/attendance${q}`),
  saveAttendance: (body) => request("/attendance", { method: "POST", body: JSON.stringify(body) }),
  leaves: (q = "") => request(`/leaves${q}`),
  createLeave: (body) => request("/leaves", { method: "POST", body: JSON.stringify(body) }),
  updateLeaveStatus: (id, status) => request(`/leaves/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  holidays: () => request("/holidays"),
  createHoliday: (body) => request("/holidays", { method: "POST", body: JSON.stringify(body) }),
  salaries: (q = "") => request(`/salaries${q}`),
  generateSalary: (body) => request("/salaries/generate", { method: "POST", body: JSON.stringify(body) }),
  salarySlip: (id) => request(`/salaries/${id}/slip`),
};
