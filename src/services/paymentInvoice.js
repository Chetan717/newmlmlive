import { jsPDF } from "jspdf";
const amount = (p) => `INR ${(Number(p || 0) / 100).toFixed(2)}`;
const clean = (v) =>
  String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 180);
const date = (v) =>
  v
    ? new Date(v).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      })
    : "—";
// Browser canvas preserves Hindi/customer names using the device's font shaping.
// English/numeric fields remain selectable PDF text.
function unicodeValue(text) {
  const canvas = document.createElement("canvas"),
    ctx = canvas.getContext("2d");
  if (!ctx)
    throw Error(
      "Invoice rendering is unavailable in this browser. Please use an updated browser.",
    );
  ctx.font = "17px sans-serif";
  const lines = [];
  let row = "";
  const characters =
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(text),
          (part) => part.segment,
        )
      : Array.from(text);
  for (const char of characters) {
    if (ctx.measureText(row + char).width > 330 && row) {
      lines.push(row);
      row = "";
    }
    row += char;
  }
  if (row) lines.push(row);
  canvas.width = 330;
  canvas.height = Math.max(24, lines.length * 26);
  ctx.font = "17px sans-serif";
  ctx.fillStyle = "#1d2537";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => ctx.fillText(line, 0, i * 26 + 2));
  return { image: canvas.toDataURL("image/png"), height: canvas.height / 6 };
}
export function createPaymentInvoice(invoice) {
  if (
    !invoice?.paymentId ||
    !["paid", "refunded", "partially_refunded", "disputed"].includes(
      invoice.status,
    )
  )
    throw Error("A verified payment is required to download an invoice.");
  const measure = new jsPDF({ unit: "mm", format: [105, 190] });
  measure.setFontSize(8);
  const rows = [
    ["Invoice / reference", invoice.invoiceId],
    ["Paid on (IST)", date(invoice.paidAtMs)],
    ["Customer", invoice.customerName],
    ["Mobile", invoice.mobileNo],
    ["Plan", invoice.planName],
    ["Validity", `${invoice.durationDays} days`],
    ["Payment method", invoice.paymentMethod],
    ["Order ID", invoice.orderId],
    ["Payment ID", invoice.paymentId],
    ["Plan amount", amount(invoice.price.basePaise)],
  ];
  if (invoice.price.discountPaise)
    rows.push(["Discount", `- ${amount(invoice.price.discountPaise)}`]);
  rows.push(
    [`GST (${invoice.price.gstBps / 100}%)`, amount(invoice.price.gstPaise)],
    ["Amount paid", amount(invoice.price.totalPaise)],
  );
  if (invoice.refundedPaise)
    rows.push(["Refunded", amount(invoice.refundedPaise)]);
  rows.push(["Status", invoice.status.replaceAll("_", " ")]);
  const prepared = rows.map(([label, value]) => {
    const text = clean(value);
    const unicode = /[^\x20-\x7e]/.test(text) ? unicodeValue(text) : null;
    const lines = unicode ? null : measure.splitTextToSize(text || "—", 55);
    return {
      label,
      lines,
      unicode,
      height: Math.max(6, unicode ? unicode.height + 2 : lines.length * 4 + 2),
    };
  });
  const height = Math.max(165, 45 + prepared.reduce((n, r) => n + r.height, 0));
  const pdf = new jsPDF({ unit: "mm", format: [105, height] });
  pdf.setFillColor(25, 102, 222);
  pdf.rect(0, 0, 105, 26, "F");
  pdf.setTextColor(255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(17);
  pdf.text("MLM LIVE", 8, 12);
  pdf.setFontSize(9);
  pdf.text(
    invoice.mode === "test" ? "TEST PAYMENT INVOICE" : "PAYMENT INVOICE",
    8,
    20,
  );
  pdf.setFont("helvetica", "normal");
  let y = 34;
  for (const row of prepared) {
    pdf.setFontSize(8);
    pdf.setTextColor(104, 112, 130);
    pdf.text(row.label, 8, y);
    pdf.setTextColor(29, 37, 55);
    if (row.unicode)
      pdf.addImage(row.unicode.image, "PNG", 42, y - 3, 55, row.unicode.height);
    else pdf.text(row.lines, 42, y);
    y += row.height;
  }
  pdf.setFontSize(7);
  pdf.setTextColor(104, 112, 130);
  pdf.text(
    pdf.splitTextToSize(
      invoice.mode === "test"
        ? "Test transaction. No live service entitlement."
        : "Payment acknowledgement issued by MLM LIVE.",
      89,
    ),
    8,
    y + 4,
  );
  return pdf;
}
export async function downloadPaymentInvoice(invoice) {
  if (document.fonts?.ready) await document.fonts.ready;
  const pdf = createPaymentInvoice(invoice),
    fileName = `MLMLIVE_Invoice_${clean(invoice.invoiceId).replace(/[^A-Za-z0-9_-]/g, "")}.pdf`;
  if (window.ReactNativeWebView) {
    const base64 = pdf.output("datauristring");
    window.ReactNativeWebView.postMessage(
      JSON.stringify({
        type: /Android/i.test(navigator.userAgent)
          ? "DOWNLOAD_PDF"
          : "SHARE_SOMETHING",
        base64,
        fileName,
        mimeType: "application/pdf",
        text: "MLM LIVE payment invoice",
      }),
    );
  } else pdf.save(fileName);
  return { fileName, pages: pdf.getNumberOfPages() };
}
