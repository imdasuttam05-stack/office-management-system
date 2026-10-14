
// Attach the active Company + Financial Year to every API request (fetch and Axios/XHR).
// The backend validates these headers and enforces the same scope in MongoDB queries.
(function installCompanyContextHeaders() {
  if (typeof window === "undefined" || window.__omsCompanyHeadersInstalled) return;
  window.__omsCompanyHeadersInstalled = true;
  const context = () => {
    let companyId = "";
    try { companyId = JSON.parse(localStorage.getItem("oms_active_company") || "null")?._id || ""; } catch {}
    return { companyId, financialYear: localStorage.getItem("oms_active_financial_year") || "" };
  };
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init = {}) => {
    const { companyId, financialYear } = context();
    const headers = new Headers(init.headers || (input instanceof Request ? input.headers : undefined));
    if (companyId) headers.set("X-Company-Id", companyId);
    if (financialYear) headers.set("X-Financial-Year", financialYear);
    return originalFetch(input, { ...init, headers });
  };
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    const { companyId, financialYear } = context();
    try { if (companyId) this.setRequestHeader("X-Company-Id", companyId); if (financialYear) this.setRequestHeader("X-Financial-Year", financialYear); } catch {}
    return originalSend.apply(this, args);
  };
})();

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(
  document.getElementById("root")
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
