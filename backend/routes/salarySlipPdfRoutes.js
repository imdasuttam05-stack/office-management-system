import express from "express";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const router = express.Router();
const STORAGE_DIR = path.join(process.cwd(), "tmp", "salary-slip-pdfs");
const COMPANY_NAME = "Hansaria Food Pvt Ltd";
const COMPANY_ADDRESS = "207 MD Road 6th Floor, Room No - 111, Kolkata-700007";

function n(value) { const x = Number(value); return Number.isFinite(x) ? x : 0; }
function money(value) { return `Rs. ${n(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function cleanText(value) { return String(value ?? "").replace(/[\\()]/g, "\\$&").replace(/[\r\n]+/g, " ").trim(); }
function pdfText(text, x, y, size = 9, bold = false) { return `BT /${bold ? "F2" : "F1"} ${size} Tf ${x} ${y} Td (${cleanText(text)}) Tj ET`; }
function pdfLine(x1, y1, x2, y2, width = 0.6) { return `${width} w ${x1} ${y1} m ${x2} ${y2} l S`; }
function pdfRect(x, y, w, h) { return `${x} ${y} ${w} ${h} re S`; }

function buildPdf(slip, companyName, companyAddress) {
  const e = slip?.earnings || {}, d = slip?.deductions || {}, t = slip?.totals || {};
  const rows = [
    ["Basic", money(e.basic), "Basic", money(e.basic), "ESI Employee", money(d.esi)],
    ["HRA", money(e.hra), "HRA", money(e.hra), "PF Employee", money(d.pf)],
    ["Conveyance", money(e.conveyance), "Conveyance", money(e.conveyance), "Professional Tax", money(d.professionalTax)],
    ["Others", money(e.others), "Others", money(e.others), "Fine / Cutting", money(d.cutting)],
    ["OT Approved", money(t.overtimeAmount), "OT Approved", money(t.overtimeAmount), "Other / LOP", money(d.other)],
  ];
  const parts = [];
  const left = 38, right = 557, width = right - left;
  parts.push("0 0 0 rg 0 0 0 RG");
  parts.push(pdfText(companyName || COMPANY_NAME, left, 795, 18, true));
  parts.push(pdfText(companyAddress || COMPANY_ADDRESS, left, 777, 9));
  parts.push(pdfText(`Salary Slip - Month: ${slip.monthLabel || ""}`, left, 754, 12, true));
  parts.push(pdfLine(left, 744, right, 744, 1.2));

  const infoTop = 728, infoRow = 25;
  const infoRows = [
    ["Employee's Name", slip.employeeName, "UAN No.", slip.uanNo], ["Designation", slip.designation, "ESIC No.", slip.esiNo],
    ["DOB", slip.dob, "Days", slip.days], ["DOJ", slip.doj, "Paid Days", slip.paidDays],
    ["Bank Name", slip.bankName, "LOP", slip.lop], ["IFSC Code", slip.ifscCode, "Account No.", slip.accountNo],
  ];
  const col = [left, left + 105, left + 300, left + 390, right];
  parts.push(pdfRect(left, infoTop - infoRows.length * infoRow, width, infoRows.length * infoRow));
  for (let i = 1; i < 4; i++) parts.push(pdfLine(col[i], infoTop - infoRows.length * infoRow, col[i], infoTop, 0.5));
  for (let i = 0; i <= infoRows.length; i++) parts.push(pdfLine(left, infoTop - i * infoRow, right, infoTop - i * infoRow, 0.5));
  infoRows.forEach((r, i) => {
    const y = infoTop - i * infoRow - 16;
    parts.push(pdfText(r[0], col[0] + 5, y, 7.5, true)); parts.push(pdfText(r[1], col[1] + 5, y, 7.5));
    parts.push(pdfText(r[2], col[2] + 5, y, 7.5, true)); parts.push(pdfText(r[3], col[3] + 5, y, 7.5));
  });

  const top = infoTop - infoRows.length * infoRow - 18, headH = 24, rowH = 23;
  const x = [left, left + 65, left + 137, left + 205, left + 278, left + 380, right];
  const tableH = headH + rows.length * rowH + rowH;
  parts.push(pdfRect(left, top - tableH, width, tableH));
  parts.push("0.93 0.96 0.99 rg"); parts.push(`${left} ${top - headH} ${width} ${headH} re f`); parts.push("0 0 0 rg");
  for (let i = 1; i < x.length - 1; i++) parts.push(pdfLine(x[i], top - tableH, x[i], top, 0.5));
  for (let i = 0; i <= rows.length + 1; i++) parts.push(pdfLine(left, top - headH - i * rowH, right, top - headH - i * rowH, 0.5));
  parts.push(pdfText("Actuals", left + 17, top - 16, 8, true)); parts.push(pdfText("Earnings", x[2] + 13, top - 16, 8, true)); parts.push(pdfText("Deductions", x[4] + 12, top - 16, 8, true));
  rows.forEach((r, i) => { const y = top - headH - i * rowH - 15; parts.push(pdfText(r[0], x[0] + 5, y, 7.5)); parts.push(pdfText(r[1], x[1] + 4, y, 7.5)); parts.push(pdfText(r[2], x[2] + 5, y, 7.5)); parts.push(pdfText(r[3], x[3] + 4, y, 7.5)); parts.push(pdfText(r[4], x[4] + 5, y, 7.5)); parts.push(pdfText(r[5], x[5] + 4, y, 7.5)); });
  const totalY = top - tableH + 8;
  parts.push(pdfText("Total Rs.", x[0] + 5, totalY, 8, true)); parts.push(pdfText(money(t.earnings), x[1] + 4, totalY, 8, true));
  parts.push(pdfText("Total Rs.", x[2] + 5, totalY, 8, true)); parts.push(pdfText(money(t.earnings), x[3] + 4, totalY, 8, true));
  parts.push(pdfText("Total Rs.", x[4] + 5, totalY, 8, true)); parts.push(pdfText(money(t.deductions), x[5] + 4, totalY, 8, true));

  const netTop = top - tableH - 18;
  parts.push("0.94 0.97 1 rg"); parts.push(`${left} ${netTop - 48} ${width} 48 re f`); parts.push("0 0 0 rg"); parts.push(pdfRect(left, netTop - 48, width, 48));
  parts.push(pdfText("Total Net Payable", left + 10, netTop - 18, 10, true)); parts.push(pdfText("Net salary after approved deductions", left + 10, netTop - 33, 7.5)); parts.push(pdfText(money(t.netPayable), right - 110, netTop - 25, 14, true));
  const wordsY = netTop - 68; parts.push(pdfRect(left, wordsY - 35, width, 35)); parts.push(pdfText("In Words:", left + 9, wordsY - 14, 8, true)); parts.push(pdfText(slip.inWords || "", left + 60, wordsY - 14, 8));
  parts.push(pdfText("This salary slip is system generated.", left, 50, 7));

  const content = parts.join("\n") + "\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
  ];
  let pdf = "%PDF-1.4\n"; const offsets = [0];
  objects.forEach((obj, index) => { offsets[index + 1] = Buffer.byteLength(pdf, "latin1"); pdf += `${index + 1} 0 obj\n${obj}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf, "latin1"); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

router.post("/", async (req, res) => {
  try {
    const slip = req.body?.slip;
    if (!slip || typeof slip !== "object") return res.status(400).json({ success: false, message: "Salary slip data is required." });
    const companyName = String(req.body?.companyName || slip.companyName || COMPANY_NAME).trim() || COMPANY_NAME;
    const companyAddress = String(req.body?.companyAddress || slip.companyAddress || COMPANY_ADDRESS).trim() || COMPANY_ADDRESS;
    const pdf = buildPdf(slip, companyName, companyAddress);
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    const id = crypto.randomBytes(10).toString("hex");
    const safeCode = String(slip.employeeCode || slip.employeeName || "employee").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 50);
    const fileName = `salary-slip-${safeCode}-${id}.pdf`;
    await fs.writeFile(path.join(STORAGE_DIR, fileName), pdf);
    const base = `${req.protocol}://${req.get("host")}`;
    return res.json({ success: true, fileName, pdfUrl: `${base}/api/payroll/salary-slip-pdf/${encodeURIComponent(fileName)}` });
  } catch (error) {
    console.error("Salary slip PDF generation failed:", error);
    return res.status(500).json({ success: false, message: error?.message || "Unable to generate salary slip PDF." });
  }
});

router.get("/:fileName", async (req, res) => {
  try {
    const fileName = path.basename(String(req.params.fileName || ""));
    if (!fileName.toLowerCase().endsWith(".pdf")) return res.status(400).send("Invalid PDF file.");
    const filePath = path.join(STORAGE_DIR, fileName);
    const stat = await fs.stat(filePath);
    res.setHeader("Content-Type", "application/pdf"); res.setHeader("Content-Length", stat.size); res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
    return res.sendFile(filePath);
  } catch { return res.status(404).json({ success: false, message: "Salary slip PDF not found or expired." }); }
});

export default router;
