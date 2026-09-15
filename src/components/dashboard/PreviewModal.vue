<script setup>
import {
  ref,
  watch,
  onBeforeUnmount,
  computed,
  nextTick,
  onMounted,
} from "vue";
import QRCode from "qrcode";

const props = defineProps({
  title: { type: String, default: "Preview" },
  html: { type: String, default: "" },
  fileName: { type: String, default: "" },
  invoice: { type: Object, default: null },
});

const emit = defineEmits(["close", "print"]);

const frameRef = ref(null);
defineExpose({ frameRef });

const scale = ref(100);
const MIN_SCALE = 60;
const MAX_SCALE = 160;
const AUTO_FIT_MAX = 100;

// ✅ معاينة فاتورة إرجاع (CREDIT_NOTE): تُبنى بالكامل من بيانات الفاتورة
// المخزّنة (invoice_number/originalInvoiceNumber/returnReason/items/...)
// — نفس البيانات المعروضة في تبويب "فواتير الإرجاع" — وليس من قالب
// الفاتورة العادية (invoice_template.html، مصمم لفواتير النقل بحقول
// السائق/المركبة التي لا تنطبق هنا). تبقى صحيحة حتى لو XML الموقّع لم
// يشمل حقول الإرجاع (لا تُوجد أصلاً فيه)، وتُكمَّل بـ QR الرسمي إن وُجد.
function buildCreditNoteHtml(inv) {
  const esc = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const val = (v) => {
    const s = String(v ?? "").trim();
    return s ? esc(s) : "-";
  };
  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(3) : "0.000";
  };

  const STATUS_LABELS = {
    submitted: "مقبولة (JoFotara)",
    pending: "بانتظار الإرسال",
    failed: "فشل الإرسال",
    draft: "محلية",
  };
  const statusKey = String(inv?.einv_status || "");
  const statusLabel = STATUS_LABELS[statusKey] || val(statusKey);
  const statusColor =
    statusKey === "submitted" ? "#166534" : statusKey === "failed" ? "#991b1b" : "#9a3412";
  const statusBg =
    statusKey === "submitted" ? "#dcfce7" : statusKey === "failed" ? "#fee2e2" : "#ffedd5";

  const items = Array.isArray(inv?.items) ? inv.items : [];
  const itemsRows = items
    .map((it) => {
      const qty = Number(it?.quantity || 0);
      const price = Number(it?.unitPrice || 0);
      const lineTotal = Number(it?.lineNet ?? it?.amount_jod ?? qty * price);
      return `<tr>
        <td class="r">${val(it?.desc)}</td>
        <td>${num(qty)}</td>
        <td>${num(price)}</td>
        <td>${num(lineTotal)}</td>
      </tr>`;
    })
    .join("");

  const qrImg = inv?.einv_qr
    ? `<img class="qr" src="data:image/png;base64,${inv.einv_qr}" alt="QR">`
    : "";

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<title>فاتورة إرجاع ${esc(inv?.invoice_number || "")}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { margin:0; padding:0; background:#fff; }
  body { font-family: Tahoma, Arial, sans-serif; direction: rtl; color:#111; font-size:12px; line-height:1.5; }
  .page { width:210mm; min-height:297mm; padding:12mm; }
  .title-row { display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #b71c1c; padding-bottom:10px; margin-bottom:14px; }
  .title-row h1 { font-size:20px; margin:0; color:#b71c1c; }
  .cr-no { font-size:14px; font-weight:700; direction:ltr; }
  .ref-line { background:#fff3e0; border:1px solid #ffcc80; border-radius:6px; padding:8px 12px; margin-bottom:14px; font-size:13px; font-weight:700; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; margin-bottom:14px; }
  .info-row { display:flex; border-bottom:1px dashed #ddd; padding:6px 0; }
  .info-row .l { width:40%; color:#555; font-weight:700; }
  .info-row .v { width:60%; }
  .status-badge { display:inline-block; padding:3px 10px; border-radius:999px; font-weight:700; font-size:12px; background:${statusBg}; color:${statusColor}; }
  table { width:100%; border-collapse:collapse; margin-top:6px; font-size:12px; }
  th, td { border:1px solid #ccc; padding:7px; text-align:center; }
  th { background:#f5f5f5; font-weight:700; }
  td.r { text-align:right; }
  .totals { display:flex; justify-content:flex-end; margin-top:14px; }
  .totals .box { text-align:left; min-width:220px; border:2px solid #b71c1c; border-radius:6px; padding:10px 14px; }
  .totals .box .label { color:#555; font-size:12px; }
  .totals .box .amount { font-size:18px; font-weight:800; color:#b71c1c; }
  .qr-row { margin-top:16px; text-align:center; }
  .qr { width:130px; height:130px; }
</style>
</head>
<body>
  <div class="page">
    <div class="title-row">
      <h1>فاتورة إرجاع</h1>
      <span class="cr-no">${val(inv?.invoice_number)}</span>
    </div>

    <div class="ref-line">مرجع الفاتورة الأصلية: ${val(inv?.originalInvoiceNumber)}</div>

    <div class="info-grid">
      <div class="info-row"><span class="l">الشركة / العميل:</span><span class="v">${val(inv?.company)}</span></div>
      <div class="info-row"><span class="l">تاريخ الإرجاع:</span><span class="v">${val(inv?.date)}</span></div>
      <div class="info-row"><span class="l">سبب الإرجاع:</span><span class="v">${val(inv?.returnReason)}</span></div>
      <div class="info-row"><span class="l">حالة JoFotara:</span><span class="v"><span class="status-badge">${esc(statusLabel)}</span></span></div>
    </div>

    <table>
      <thead>
        <tr><th>البند</th><th>الكمية المرتجعة</th><th>سعر الوحدة</th><th>الإجمالي</th></tr>
      </thead>
      <tbody>
        ${itemsRows || `<tr><td colspan="4">لا توجد بنود</td></tr>`}
      </tbody>
    </table>

    <div class="totals">
      <div class="box">
        <div class="label">إجمالي فاتورة الإرجاع</div>
        <div class="amount">${num(inv?.value_jod)} JOD</div>
      </div>
    </div>

    ${qrImg ? `<div class="qr-row">${qrImg}</div>` : ""}
  </div>
</body>
</html>`;
}

const srcDoc = computed(() => {
  if (props.invoice?.documentKind === "CREDIT_NOTE") {
    return buildCreditNoteHtml(props.invoice);
  }

  const h = String(props.html || "").trim();
  if (!h) return "<!doctype html><html><body></body></html>";
  if (/<html[\s>]/i.test(h)) return h;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>${h}</body>
</html>`;
});

function close() {
  emit("close");
}

function onKey(e) {
  if (e.key === "Escape") close();
}

window.addEventListener("keydown", onKey);
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
});

async function doPrint() {
  const iframe = frameRef.value;
  const w = iframe?.contentWindow;
  if (!iframe || !w) return;
  if (w.document?.readyState !== "complete") {
    await new Promise((resolve) => {
      const handler = () => {
        iframe.removeEventListener("load", handler);
        resolve();
      };
      iframe.addEventListener("load", handler);
    });
  }
  w.focus();
  w.print();
}

const downloading = ref(false);

// ✅ تنزيل PDF — Electron: نفس IPC الموجود (save-pdf) بدون تغيير
//               — متصفح: نفس HTML المعاينة + حوار طباعة المتصفح (Save as PDF)
async function doDownloadPdf() {
  // ✅ Electron — السلوك الأصلي كما هو
  if (window.electronAPI?.savePdf) {
    if (downloading.value) return;
    downloading.value = true;
    try {
      const res = await window.electronAPI.savePdf({
        html: srcDoc.value,
        defaultName: props.fileName || "document.pdf",
      });
      if (!res?.ok && !res?.canceled) {
        alert("❌ فشل حفظ PDF: " + (res?.error || "Unknown"));
      }
    } catch (e) {
      alert("❌ خطأ أثناء حفظ PDF: " + e);
    } finally {
      downloading.value = false;
    }
    return;
  }

  // ✅ Browser fallback — نفس srcDoc المعروض في المعاينة تماماً
  const printWindow = window.open("", "_blank");

  if (!printWindow) {
    alert("يرجى السماح بالنوافذ المنبثقة لتنزيل الفاتورة");
    return;
  }

  printWindow.document.open();
  printWindow.document.write(srcDoc.value);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };
}

// ✅ فاتورة الفوترة الرسمية (XML الموقّع من JoFotara) — متاحة فقط بعد الاعتماد
const hasJofotaraInvoice = computed(
  () =>
    props.invoice?.einv_status === "submitted" &&
    !!props.invoice?.einv_signed_invoice,
);

// ✅ تنزيل فاتورة الفوترة الرسمية — XML الموقّع من JoFotara فقط
// ⚠️ معالج مستقل تماماً: لا يستخدم srcDoc / print / savePdf / downloadPdf
function downloadJofotaraInvoice() {
  const invoice = props.invoice;
  if (
    invoice?.einv_status !== "submitted" ||
    !invoice?.einv_signed_invoice
  ) {
    return;
  }

  try {
    // Base64 → UTF-8 XML (الفاتورة الرسمية الموقّعة من JoFotara)
    const binary = atob(String(invoice.einv_signed_invoice).replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const xml = new TextDecoder("utf-8").decode(bytes);

    // ⚠️ octet-stream لإجبار المتصفح على التنزيل (وليس عرض XML)
    const blob = new Blob([xml], {
      type: "application/octet-stream",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoice_number || "invoice"}-JoFotara.xml`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch (e) {
    alert("❌ فشل تنزيل فاتورة الفوترة: " + e);
  }
}

/* ============================================================
   ✅ فاتورة الفوترة PDF — HTML مقروء يُولّد محلياً من XML الموقّع
   (ليست PDF رسمية مرجعة من JoFotara)
============================================================ */
const jofotaraPdfLoading = ref(false);

const INVOICE_TYPE_MAP = {
  "011": { title: "فاتورة نقدية", type: "فاتورة نقدية محلية" },
  "021": { title: "فاتورة ذمم", type: "فاتورة ذمم محلية" },
  "111": { title: "فاتورة تصدير نقدية", type: "فاتورة نقدية تصدير" },
  "121": { title: "فاتورة تصدير ذمم", type: "فاتورة ذمم تصدير" },
};

// ✅ تحليل XML الموقّع — scoped/direct-child فقط (لا قراءة من التوقيعات)
function parseJofotaraXml(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc?.documentElement;
  if (
    !root ||
    root.localName === "parsererror" ||
    doc.getElementsByTagName("parsererror").length
  ) {
    return null;
  }

  // ✅ أبناء مباشرون فقط — لا بحث عام بالـ localName
  const directChild = (parent, localName) => {
    for (const c of parent?.children || []) {
      if (c.localName === localName) return c;
    }
    return null;
  };
  const directChildren = (parent, localName) => {
    const out = [];
    for (const c of parent?.children || []) {
      if (c.localName === localName) out.push(c);
    }
    return out;
  };
  const childText = (parent, localName) =>
    directChild(parent, localName)?.textContent?.trim() || "";

  // ✅ نوع الفاتورة من السمة name — كود UBL (388) لا يُعرض للمستخدم
  const typeEl = directChild(root, "InvoiceTypeCode");
  const typeNameAttr = typeEl?.getAttribute("name")?.trim() || "";
  const mapped = INVOICE_TYPE_MAP[typeNameAttr];
  const invoiceTypeName = mapped?.type || typeNameAttr || "";
  const title = mapped?.title || "فاتورة إلكترونية";

  // ✅ البائع: Invoice > AccountingSupplierParty > Party
  const supplierParty = directChild(
    directChild(root, "AccountingSupplierParty"),
    "Party",
  );
  const supplierLegal = directChild(supplierParty, "PartyLegalEntity");
  const supplierTaxScheme = directChild(supplierParty, "PartyTaxScheme");

  // ✅ المشتري: Invoice > AccountingCustomerParty
  const customerRoot = directChild(root, "AccountingCustomerParty");
  const customerParty = directChild(customerRoot, "Party");
  const customerLegal = directChild(customerParty, "PartyLegalEntity");
  const customerIdent = directChild(customerParty, "PartyIdentification");
  const customerAddress = directChild(customerParty, "PostalAddress");
  const customerContact = directChild(customerRoot, "AccountingContact");

  // ✅ تسلسل مصدر الدخل: SellerSupplierParty > Party > PartyIdentification > ID
  const sellerIdent = directChild(
    directChild(directChild(root, "SellerSupplierParty"), "Party"),
    "PartyIdentification",
  );

  // ✅ البنود: أبناء مباشرون للجذر Invoice فقط
  const lines = directChildren(root, "InvoiceLine").map((ln) => {
    const item = directChild(ln, "Item");
    const price = directChild(ln, "Price");
    const allowance = directChild(price, "AllowanceCharge");
    return {
      id: childText(ln, "ID"),
      name: childText(item, "Name"),
      qty: childText(ln, "InvoicedQuantity"),
      lineAmount: childText(ln, "LineExtensionAmount"),
      priceAmount: childText(price, "PriceAmount"),
      discount: childText(allowance, "Amount"),
    };
  });

  // ✅ الإجماليات: Invoice > LegalMonetaryTotal المباشر فقط
  const monetary = directChild(root, "LegalMonetaryTotal");

  const note = childText(root, "Note");

  return {
    id: childText(root, "ID"),
    uuid: childText(root, "UUID"),
    issueDate: childText(root, "IssueDate"),
    issueTime: childText(root, "IssueTime"),
    invoiceTypeName,
    title,
    currency: childText(root, "DocumentCurrencyCode"),
    supplierName: childText(supplierLegal, "RegistrationName"),
    supplierTaxNo: childText(supplierTaxScheme, "CompanyID"),
    incomeSourceSeq: childText(sellerIdent, "ID"),
    customer: {
      name: childText(customerLegal, "RegistrationName"),
      id: childText(customerIdent, "ID"),
      postalZone: childText(customerAddress, "PostalZone"),
      city: childText(customerAddress, "CountrySubentityCode"),
      phone: childText(customerContact, "Telephone"),
    },
    lines,
    note,
    totals: {
      taxExclusive: childText(monetary, "TaxExclusiveAmount"),
      taxInclusive: childText(monetary, "TaxInclusiveAmount"),
      allowanceTotal: childText(monetary, "AllowanceTotalAmount"),
      payable: childText(monetary, "PayableAmount"),
    },
  };
}

// ✅ HTML عربي RTL — تصميم قريب من فاتورة الفوترة الرسمية (A4 مضغوط)
// ⚠️ يُولّد محلياً من XML الموقّع — ليس PDF رسمياً مرجعاً من JoFotara
function buildJofotaraHtml(d, invoice, qrDataUrl = "") {
  console.log("JOFOTARA NOTE:", d.note || "EMPTY");
  const esc = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const val = (v) => {
    const s = String(v ?? "").trim();
    return s ? esc(s) : "-";
  };
  const fmt = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "-";
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n.toFixed(3) : "-";
  };
  const cur = val(d.currency);

  const issueDateRaw = String(d.issueDate || "").trim();
  const issueDateOnly = issueDateRaw.split(/[T ]+/)[0] || "";
  const issueTimeOnly = String(d.issueTime || "").trim();
  const CURRENCY_NAMES = {
    JOD: "دينار أردني",
    USD: "دولار أمريكي",
    EUR: "يورو",
    SAR: "ريال سعودي",
    AED: "درهم إماراتي",
  };
  const currencyName = CURRENCY_NAMES[String(d.currency || "").toUpperCase()] || String(d.currency || "").toUpperCase();

  const lineRows = (d.lines || [])
    .map((ln, i) => {
      const qty = Number(String(ln.qty ?? "").replace(/,/g, ""));
      const price = Number(String(ln.priceAmount ?? "").replace(/,/g, ""));
      const gross =
        Number.isFinite(qty) && Number.isFinite(price)
          ? (qty * price).toFixed(3)
          : fmt(ln.lineAmount);
      return `<tr>
        <td>${esc(ln.id || i + 1)}</td>
        <td class="r">${val(ln.name)}</td>
        <td>${fmt(ln.qty)}</td>
        <td>${fmt(ln.priceAmount)}</td>
        <td>${gross}</td>
        <td>${fmt(ln.discount || "0")}</td>
        <td>${fmt(ln.lineAmount)}</td>
      </tr>`;
    })
    .join("");

  const qrImg = qrDataUrl ? `<img class="qr" src="${qrDataUrl}" alt="QR">` : "";

  // ✅ شعار الشركة — فقط من HTML الفاتورة الحالية (بدون البحث عن ملفات)
  const logoSrc = (() => {
    const html = String(props.html || "");
    const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(
      (m) => m[1],
    );
    const pick = srcs.find((s) => /logo/i.test(s)) || srcs[0] || "";
    if (!pick) return "";
    try {
      const u = new URL(pick, document.baseURI);
      return ["data:", "http:", "https:", "file:"].includes(u.protocol)
        ? u.href
        : "";
    } catch {
      return "";
    }
  })();
  const logoImg = logoSrc ? `<img class="logo" src="${logoSrc}" alt="">` : "";

  // ✅ شعار JoFotara — رابط مطلق من public يعمل في النوافذ المنبثقة ونافذة الطباعة
  const jofotaraLogoUrl = `${window.location.origin}/jofotara-logo.png`;

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<base href="${window.location.origin}/">
<title>${esc(d.title || "فاتورة إلكترونية")}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  html, body { margin:0; padding:0; background:#fff; }
  body { font-family: Tahoma, Arial, sans-serif; direction: rtl; color:#000; font-size:9px; font-weight:400; letter-spacing:0; line-height:1.2; font-kerning:normal; font-synthesis:none; text-rendering:geometricPrecision; }
  .page { width:210mm; min-height:297mm; padding:4mm 6mm 14mm; position:relative; }
  /* ===== Header: فوترة يمين / النوع وسط / الشعار يسار ===== */
  .hdr { display:flex; align-items:flex-start; min-height:32mm; }
  .hdr .brand { width:105px; text-align:center; padding-top:1mm; }
  .hdr .type { flex:1; text-align:center; white-space:nowrap; padding-top:12mm; color:#0D3A65; font-family:Tahoma, Arial, sans-serif; font-size:9px; font-weight:600; line-height:1.15; letter-spacing:0; }
  .hdr .logo-cell { width:105px; text-align:left; }
  .logo { width:100px; height:100px; object-fit:contain; }
  .jof-logo { width:80px; height:auto; display:block; margin:0 auto; }
  /* ===== صفوف المعلومات: شبكتان منفصلتان بفجوة بيضاء واضحة ===== */
  .info { margin-top:5mm; }
  .parties { display:grid; grid-template-columns:1fr 1fr; column-gap:10px; direction:rtl; margin-top:3mm; }
  .prow { min-height:26px; display:flex; align-items:center; border-bottom:1px solid #d9d9d9; font-size:9px; line-height:1.25; direction:rtl; }
  .info-pair-row { display:grid; grid-template-columns:1fr 1fr; column-gap:12mm; align-items:center; min-height:26px; border-bottom:1px solid #d9d9d9; direction:rtl; }
  .info-pair-row.no-border { border-bottom:none; }
  .info-half { display:flex; align-items:center; min-height:26px; font-size:9px; direction:rtl; }
  .l { width:38%; text-align:right; direction:rtl; color:#1683e8; font-size:9px; font-weight:700; letter-spacing:0; line-height:1.15; white-space:nowrap; }
  .v { width:62%; text-align:center; direction:rtl; color:#000; font-size:9px; font-weight:400; letter-spacing:0; line-height:1.15; white-space:nowrap; }
  .uuid { direction:ltr; unicode-bidi:embed; font-size:9px; }
  .party-title { min-height:26px; display:flex; align-items:center; justify-content:flex-start; direction:rtl; text-align:right; padding-right:4px; color:#1683e8; font-weight:700; font-size:10px; letter-spacing:0; }
  /* ===== فراغ قبل الجدول مثل المرجع ===== */
  .spacer { height:33mm; }
  /* ===== جدول البنود ===== */
  table { width:100%; border-collapse:collapse; border:1px solid #008BB9; font-size:9px; }
  th, td { border:1px solid #008BB9; text-align:center; }
  thead th { height:32px; padding:5px 4px; background:#F1F1F1 !important; border:1px solid #008BB9 !important; color:#000000; font-family:Tahoma, Arial, sans-serif; font-size:9px; font-weight:700; letter-spacing:0; line-height:1.15; }
  tbody td { height:27px; padding:4px; background:#FFFFFF; border:1px solid #008BB9 !important; font-family:Tahoma, Arial, sans-serif; font-size:9px; font-weight:400; letter-spacing:0; line-height:1.15; font-variant-numeric:tabular-nums; }
  td.r { text-align:right; }
  /* ===== الإجماليات + QR ===== */
  .summary-area { display:grid; grid-template-columns:24% 76%; direction:ltr; align-items:start; margin-top:8px; }
  .qrbox { text-align:left; }
  .qr { width:185px; height:185px; object-fit:contain; max-width:100%; display:block; }
  .totals { width:100%; }
  .total-row { display:grid; grid-template-columns:28% 72%; align-items:center; min-height:31px; border-bottom:1px solid #DDDDDD; background:#FFFFFF; }
  .total-row .tv { font-size:10px; font-weight:700; letter-spacing:0; color:#000000; padding-left:10px; text-align:left; font-variant-numeric:tabular-nums; }
  .total-row .tl { direction:rtl; text-align:right; font-size:10px; font-weight:700; letter-spacing:0; color:#007BFF; padding-right:8px; }
  .total-row.final { background:#DDDDDD; }
  /* ===== Footer ===== */
  .foot { position:fixed; bottom:3mm; left:0; right:0; text-align:center; font-size:7px; font-weight:400; color:#000; }
</style>
</head>
<body>
  <div class="page">
    <div class="hdr">
      <div class="brand"><img class="jof-logo" src="${jofotaraLogoUrl}" alt="JoFotara Logo" /></div>
      <div class="type">${val(d.invoiceTypeName)}</div>
      <div class="logo-cell">${logoImg}</div>
    </div>

    <div class="info">
      <div class="info-pair-row">
        <div class="info-half"><span class="l">رقم الفاتورة الإلكترونية:</span><span class="v">${val(invoice?.einv_num)}</span></div>
        <div class="info-half"><span class="l">نوع العملة:</span><span class="v">${esc(currencyName)}</span></div>
      </div>
      <div class="info-pair-row">
        <div class="info-half"><span class="l">وقت إصدار الفاتورة:</span><span class="v">${val(issueTimeOnly)}</span></div>
        <div class="info-half"><span class="l">رمز العملة:</span><span class="v">${cur}</span></div>
      </div>
      <div class="info-pair-row">
        <div class="info-half"><span class="l">تاريخ إصدار الفاتورة:</span><span class="v">${val(issueDateOnly || issueDateRaw)}</span></div>
        <div class="info-half"><span class="l">نوع الفاتورة:</span><span class="v">${val(d.invoiceTypeName)}</span></div>
      </div>
    </div>

    <div class="parties">
      <div class="party-col">
        <div class="party-title">البائع</div>
        <div class="prow"><span class="l">الاسم:</span><span class="v">${val(d.supplierName)}</span></div>
        <div class="prow"><span class="l">الرقم الضريبي:</span><span class="v">${val(d.supplierTaxNo)}</span></div>
        <div class="prow"><span class="l">تسلسل مصدر الدخل:</span><span class="v">${val(d.incomeSourceSeq)}</span></div>
        <div class="prow"><span class="l">رقم الهاتف:</span><span class="v">${val(d.supplierPhone)}</span></div>
        <div class="prow"><span class="l">العنوان:</span><span class="v">${val(d.supplierAddress)}</span></div>
        <div class="prow"><span class="l">الرقم البريدي:</span><span class="v">${val(d.supplierPostalCode)}</span></div>
      </div>
      <div class="party-col">
        <div class="party-title">المشتري</div>
        <div class="prow"><span class="l">الاسم:</span><span class="v">${val(d.customer.name)}</span></div>
        <div class="prow"><span class="l">رقم الهاتف:</span><span class="v">${val(d.customer.phone)}</span></div>
        <div class="prow"><span class="l">العنوان:</span><span class="v">${val(d.customer.city)}</span></div>
        <div class="prow"><span class="l">الرمز البريدي:</span><span class="v">${val(d.customer.postalZone)}</span></div>
      </div>
    </div>

    <div class="spacer"></div>

    <table>
      <colgroup>
        <col style="width:5%">
        <col style="width:30%">
        <col style="width:11%">
        <col style="width:12%">
        <col style="width:14%">
        <col style="width:11%">
        <col style="width:17%">
      </colgroup>
      <thead>
        <tr><th>#</th><th>الوصف</th><th>الكمية</th><th>سعر الوحدة</th><th>المبلغ</th><th>الخصم</th><th>المبلغ بعد الخصم</th></tr>
      </thead>
      <tbody>${lineRows || '<tr><td colspan="7">لا يوجد بنود</td></tr>'}</tbody>
    </table>

    <div class="summary-area">
      <div class="qrbox">${qrImg}</div>
      <div class="totals">
        <div class="total-row"><span class="tv">${fmt(d.totals.taxExclusive)}</span><span class="tl">إجمالي الفاتورة قبل الخصم (${cur}):</span></div>
        <div class="total-row"><span class="tv">${fmt(d.totals.allowanceTotal)}</span><span class="tl">مجموع قيمة الخصم (${cur}):</span></div>
        <div class="total-row final"><span class="tv">${fmt(d.totals.payable)}</span><span class="tl">إجمالي قيمة الفاتورة (${cur}):</span></div>
      </div>
    </div>

    ${d.note ? `<div style="margin-top:6px; padding:8px 10px; border:1px solid #1976d2; border-radius:4px; background:#fff; width:100%; direction:rtl; text-align:right; white-space:pre-wrap; font-size:9px; line-height:1.5; color:#111;"><div style="font-weight:700; color:#0D3A65; margin-bottom:4px;">ملاحظات</div><div>${esc(d.note)}</div></div>` : ""}

    <div class="foot">Page 1 of 1</div>
  </div>
</body>
</html>`;
}

// ✅ تنزيل فاتورة الفوترة PDF — من XML الموقّع فقط (معالج مستقل تماماً)
async function downloadJofotaraPdf() {
  const invoice = props.invoice;
  if (invoice?.einv_status !== "submitted" || !invoice?.einv_signed_invoice) {
    return;
  }

  let xml;
  try {
    const binary = atob(String(invoice.einv_signed_invoice).replace(/\s+/g, ""));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    xml = new TextDecoder("utf-8").decode(bytes);
  } catch (e) {
    alert("❌ فشل قراءة الفاتورة الموقّعة: " + e);
    return;
  }

  const data = parseJofotaraXml(xml);
  if (!data) {
    alert("❌ تعذّر تحليل ملف XML الموقّع");
    return;
  }

  // ✅ QR حقيقي — المصدر EINV_QR فقط (بدون تعديل القيمة)
  let qrDataUrl = "";
  if (invoice?.einv_qr) {
    try {
      qrDataUrl = await QRCode.toDataURL(String(invoice.einv_qr), {
        width: 140,
        margin: 1,
      });
    } catch (e) {
      console.error("QR generation failed:", e);
    }
  }

  const jofotaraHtml = buildJofotaraHtml(data, invoice, qrDataUrl);
  const defaultName = `${invoice.invoice_number || "invoice"}-JoFotara.pdf`;

  // ✅ Electron — نفس IPC الموجود (save-pdf)
  if (window.electronAPI?.savePdf) {
    if (jofotaraPdfLoading.value) return;
    jofotaraPdfLoading.value = true;
    try {
      const res = await window.electronAPI.savePdf({
        html: jofotaraHtml,
        defaultName,
      });
      if (!res?.ok && !res?.canceled) {
        alert("❌ فشل حفظ PDF: " + (res?.error || "Unknown"));
      }
    } catch (e) {
      alert("❌ خطأ أثناء حفظ PDF: " + e);
    } finally {
      jofotaraPdfLoading.value = false;
    }
    return;
  }

  // ✅ Chrome — نفس الـ HTML + حوار طباعة المتصفح (Save as PDF)
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("يرجى السماح بالنوافذ المنبثقة لتنزيل الفاتورة");
    return;
  }
  printWindow.document.open();
  printWindow.document.write(jofotaraHtml);
  printWindow.document.close();
  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 300);
  };
}

function zoomIn() {
  scale.value = Math.min(MAX_SCALE, scale.value + 10);
}
function zoomOut() {
  scale.value = Math.max(MIN_SCALE, scale.value - 10);
}
function resetZoom() {
  scale.value = 100;
}
function fitZoom() {
  nextTick(() => {
    requestAnimationFrame(() => {
      const viewport = document.querySelector(".pv-body");
      if (!viewport) return;
      const available = viewport.clientWidth - 40;
      const base = 793;
      const s = Math.max(
        MIN_SCALE,
        Math.min(AUTO_FIT_MAX, Math.floor((available / base) * 100)),
      );
      scale.value = s;
    });
  });
}

watch(
  () => props.html,
  async () => {
    await nextTick();
    fitZoom();
  },
);

onMounted(() => {
  fitZoom();
  window.addEventListener("resize", fitZoom);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", fitZoom);
});
</script>

<template>
  <div class="pv-overlay" @click.self="close">
    <div class="pv-modal">
      <div class="pv-toolbar">
        <div class="pv-toolbar-right">
          <h3>
            {{ title }}
            <span v-if="props.invoice?.documentKind === 'CREDIT_NOTE'" class="pv-cn-badge"
              >فاتورة إرجاع</span
            >
          </h3>
          <p v-if="props.invoice?.documentKind === 'CREDIT_NOTE'">
            مرجع الفاتورة الأصلية: <strong dir="ltr">{{ props.invoice?.originalInvoiceNumber }}</strong>
            <span v-if="props.invoice?.returnReason"> — سبب الإرجاع: {{ props.invoice.returnReason }}</span>
          </p>
          <p v-else>المعاينة تظهر كما ستطبع على A4</p>
        </div>

        <div class="pv-toolbar-left">
          <button
            class="btn btn--tool"
            type="button"
            @click="zoomOut"
            title="تصغير"
          >
            −
          </button>
          <span class="zoom-value">{{ scale }}%</span>
          <button
            class="btn btn--tool"
            type="button"
            @click="zoomIn"
            title="تكبير"
          >
            +
          </button>
          <button class="btn btn--tool" type="button" @click="fitZoom">
            ملاءمة
          </button>
          <button class="btn btn--tool" type="button" @click="resetZoom">
            100%
          </button>
          <div class="toolbar-divider"></div>
          <button class="btn btn--primary" type="button" @click="doPrint">
            🖨 طباعة
          </button>
          <button
            class="btn btn--pdf"
            type="button"
            :disabled="downloading"
            @click="doDownloadPdf"
          >
            {{ downloading ? "⏳ جاري الحفظ..." : "⬇ تنزيل PDF" }}
          </button>
          <button
            v-if="hasJofotaraInvoice"
            class="btn btn--jofotara"
            type="button"
            :disabled="jofotaraPdfLoading"
            @click.stop="downloadJofotaraPdf"
          >
            {{ jofotaraPdfLoading ? "⏳ جاري الحفظ..." : "⬇ تنزيل فاتورة الفوترة PDF" }}
          </button>
          <button class="btn btn--x" type="button" @click="close">
            ✕ إغلاق
          </button>
        </div>
      </div>

      <div class="pv-body" :style="{ '--scale': String(scale / 100) }">
        <div class="pv-scaler">
          <div class="pv-paper">
            <iframe ref="frameRef" class="pv-iframe" :srcdoc="srcDoc"></iframe>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pv-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
  padding: 18px;
}
.pv-modal {
  width: min(1500px, 96vw);
  height: 94vh;
  max-height: 94vh;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #d0d5dd;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.pv-toolbar {
  padding: 12px 18px;
  border-bottom: 1px solid #e2e6ec;
  background: #fff;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.pv-toolbar-right {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pv-toolbar-right h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: #111827;
}
.pv-toolbar-right p {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.pv-toolbar-left {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #d0d5dd;
  margin: 0 4px;
}
.zoom-value {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pv-body {
  --scale: 1;
  flex: 1;
  overflow: auto;
  background: #eef1f5;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
}
.pv-scaler {
  width: calc(793px * var(--scale));
  height: calc(1122px * var(--scale));
  margin: 0 auto;
  flex-shrink: 0;
}
.pv-paper {
  width: 793px;
  height: 1122px;
  background: #fff;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #d0d5dd;
  border-radius: 3px;
  transform: scale(var(--scale));
  transform-origin: top left;
}
.pv-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
.btn {
  padding: 7px 12px;
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
}
.btn--tool {
  background: #f3f5f8;
  border-color: #d0d5dd;
  color: #374151;
  font-weight: 600;
}
.btn--tool:hover {
  background: #e8ecf2;
}
.btn--primary {
  background: #1976d2;
  color: #fff;
  font-weight: 600;
}
.btn--primary:hover {
  background: #1565c0;
}
.btn--pdf {
  background: #2e7d32;
  color: #fff;
  font-weight: 600;
}
.btn--pdf:hover {
  background: #1b5e20;
}
.btn--pdf:disabled {
  opacity: 0.6;
  cursor: default;
}
.pv-cn-badge {
  display: inline-block;
  margin-right: 8px;
  padding: 2px 10px;
  border-radius: 999px;
  background: #fdecea;
  color: #b71c1c;
  font-size: 12px;
  font-weight: 700;
  vertical-align: middle;
}
.btn--jofotara {
  background: #0f766e;
  color: #fff;
  font-weight: 600;
}
.btn--jofotara:hover {
  background: #115e59;
}
.btn--x {
  background: transparent;
  border: 1px solid #d0d5dd;
  color: #4b5563;
}
.btn--x:hover {
  background: #f3f5f8;
}

@media (max-width: 640px) {
  .pv-overlay {
    padding: 0;
  }
  .pv-modal {
    width: 100%;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
  .pv-toolbar {
    padding: 10px 12px;
  }
  .pv-body {
    padding: 12px;
  }
}
</style>
