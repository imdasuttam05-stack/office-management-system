```javascript
import axios from "axios";

const API_URL =
  import.meta.env.VITE_API_URL ||
  "https://office-management-system-ikx8.onrender.com";

/**
 * Download the existing salary-slip PDF from the backend
 * and open WhatsApp with a ready message.
 *
 * Browser WhatsApp cannot silently attach a local PDF file.
 * Therefore this function:
 *   1. Gets the SAME PDF used by Salary Slip
 *   2. Downloads it to the user's device
 *   3. Opens WhatsApp with the salary-slip message
 *
 * The downloaded PDF can then be attached in WhatsApp.
 */
export async function shareSalarySlipOnWhatsApp({
  employeeId,
  employeeName = "",
  employeeCode = "",
  month = "",
  phone = "",
}) {
  if (!employeeId) {
    throw new Error("Employee ID is required.");
  }

  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("accessToken");

  if (!token) {
    throw new Error("Login session expired. Please login again.");
  }

  const response = await axios.get(
    `${API_URL}/api/hr/salary-slip/${employeeId}/pdf`,
    {
      params: {
        month,
      },
      responseType: "blob",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const blob = new Blob([response.data], {
    type: "application/pdf",
  });

  const url = window.URL.createObjectURL(blob);

  const safeName =
    employeeName
      .replace(/[^a-z0-9]/gi, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "") ||
    "Employee";

  const fileName =
    `Salary-Slip-${safeName}-${month || "Salary"}.pdf`;

  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => {
    window.URL.revokeObjectURL(url);
  }, 5000);

  let cleanPhone = String(phone || "")
    .replace(/\D/g, "");

  if (cleanPhone.length === 10) {
    cleanPhone = `91${cleanPhone}`;
  }

  const message = [
    `Salary Slip - ${month || ""}`,
    `Employee: ${employeeName || "-"}`,
    employeeCode
      ? `Employee Code: ${employeeCode}`
      : "",
    "",
    "Your salary slip PDF has been prepared.",
    "Please find the attached salary slip.",
  ]
    .filter(Boolean)
    .join("\n");

  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer"
  );

  return {
    success: true,
    fileName,
    whatsappUrl,
  };
}
```
