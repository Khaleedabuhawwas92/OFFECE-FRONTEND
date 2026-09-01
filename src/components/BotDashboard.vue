<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";

import InvoiceCreateModal from "./InvoiceCreateModal.vue";
import WaybillCreateModal from "./WaybillCreateModal.vue";
import VoucherCreateModal from "./VoucherCreateModal.vue"; // ✅ جديد
import PreviewModal from "./dashboard/PreviewModal.vue";

// ✅ أفضل داخل Electron
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

// ✅ Route (للـ refresh عند الرجوع)
const route = useRoute();
const router = useRouter();

/* =========================
   Date filters
========================= */
// ✅ Invoices
const invDateMode = ref("created_at"); // created_at | date
const invDateFrom = ref(""); // yyyy-mm-dd
const invDateTo = ref(""); // yyyy-mm-dd

// ✅ Waybills
const wbDateMode = ref("created_at"); // created_at | DATE
const wbDateFrom = ref(""); // yyyy-mm-dd
const wbDateTo = ref(""); // yyyy-mm-dd

// ✅ Vouchers
const vcDateMode = ref("createdAt"); // createdAt | date
const vcDateFrom = ref("");
const vcDateTo = ref("");
const vcTypeFilter = ref("ALL"); // ALL | RECEIPT | PAYMENT

/* =========================
   Preview (Waybill)
========================= */
const openPreview = ref(false);
const previewHtml = ref("");
const waybillTemplateCache = ref(null);
const modalRef = ref(null);

/* =========================
   Search + Modals
========================= */
const invoicesSearch = ref("");
const waybillsSearch = ref("");
const vouchersSearch = ref("");

const wbSourceFilter = ref("ALL"); // ALL | BOT | MANUAL

const showCreateInvoice = ref(false);
const showCreateWaybill = ref(false);
const showCreateVoucher = ref(false); // ✅ جديد

function openCreateInvoice() {
  showCreateInvoice.value = true;
}
function closeCreateInvoice() {
  showCreateInvoice.value = false;
}
function openCreateWaybill() {
  showCreateWaybill.value = true;
}
function closeCreateWaybill() {
  showCreateWaybill.value = false;
}
function openCreateVoucher() {
  showCreateVoucher.value = true;
}
function closeCreateVoucher() {
  showCreateVoucher.value = false;
}

function handleLogout() {
  localStorage.removeItem("auth_token");
  router.push("/login");
}

/* =========================
   Date parsing helpers
========================= */
function toTimeOrNull(v) {
  if (!v) return null;

  const t1 = new Date(v).getTime();
  if (Number.isFinite(t1)) return t1;

  const s = String(v).trim();

  // dd-mm-YYYY
  let m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const t = new Date(yyyy, mm - 1, dd).getTime();
    return Number.isFinite(t) ? t : null;
  }

  // YYYY/MM/DD
  m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const yyyy = Number(m[1]);
    const mm = Number(m[2]);
    const dd = Number(m[3]);
    const t = new Date(yyyy, mm - 1, dd).getTime();
    return Number.isFinite(t) ? t : null;
  }

  // DD/MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const t = new Date(yyyy, mm - 1, dd).getTime();
    return Number.isFinite(t) ? t : null;
  }

  return null;
}

function dayStart(yyyyMmDd) {
  const t = new Date(`${yyyyMmDd}T00:00:00`).getTime();
  return Number.isFinite(t) ? t : null;
}
function dayEnd(yyyyMmDd) {
  const t = new Date(`${yyyyMmDd}T23:59:59`).getTime();
  return Number.isFinite(t) ? t : null;
}
function inDateRange(rowTime, fromStr, toStr) {
  if (rowTime == null) return true;
  const fromT = fromStr ? dayStart(fromStr) : null;
  const toT = toStr ? dayEnd(toStr) : null;
  if (fromT != null && rowTime < fromT) return false;
  if (toT != null && rowTime > toT) return false;
  return true;
}

/* =========================
   Pagination + State
========================= */
const invPage = ref(1);
const wbPage = ref(1);
const vcPage = ref(1);

const invPageSize = ref(10);
const wbPageSize = ref(10);
const vcPageSize = ref(10);

const activeTab = ref("invoices"); // invoices | waybills | vouchers

const loadingInvoices = ref(false);
const loadingWaybills = ref(false);
const loadingVouchers = ref(false);

const invoices = ref([]);
const waybills = ref([]);
const vouchers = ref([]);

const errorMessage = ref("");
const botStatus = ref({ running: false, pid: null });

/* =========================
   Invoice Preview
========================= */
const showInvoicePreview = ref(false);
const selectedInvoice = ref(null);
const invoicePreviewHtml = ref("");
const invoiceTemplateCache = ref(null);
const invoiceFrameRef = ref(null);

/* =========================
   Voucher Preview ✅
========================= */
const showVoucherPreview = ref(false);
const selectedVoucher = ref(null);
const voucherPreviewHtml = ref("");
const voucherTemplateCache = ref(null);
const voucherFrameRef = ref(null);

/* =========================
   Dashboard Stats
========================= */
const driversCount = ref(0);
const consignorsCount = ref(0);
const consigneesCount = ref(0);

/* =========================
   Drivers list (for preview mapping)
========================= */
const drivers = ref([]);
const loadingDrivers = ref(false);

/* =========================
   Sorting
========================= */
const invSort = ref({ key: "created_at", dir: "desc" }); // asc/desc
const wbSort = ref({ key: "created_at", dir: "desc" });
const vcSort = ref({ key: "createdAt", dir: "desc" });

const invoiceColumns = [
  { key: "invoice_number", label: "رقم الفاتورة", sortable: true },
  { key: "company", label: "الشركة", sortable: true },
  { key: "value_jod", label: "القيمة (JOD)", sortable: true, align: "ltr" },
  { key: "date", label: "تاريخ الفاتورة", sortable: true },
  { key: "created_at", label: "تاريخ الإدخال", sortable: true },
];

const waybillColumns = [
  { key: "waybillNumber", label: "رقم السند", sortable: true, align: "ltr" },
  { key: "__SOURCE__", label: "المصدر", sortable: true },
  { key: "DATE", label: "تاريخ الوثيقة", sortable: true },
  { key: "CONSIGNOR_NAME", label: "المرسل", sortable: true },
  { key: "CONSIGNEE_NAME", label: "المستلم", sortable: true },
  { key: "__VEHICLE__", label: "رقم المركبة", sortable: true, align: "ltr" },
  { key: "__DRIVER__", label: "السائق", sortable: true },
  { key: "GOODS_NATURE", label: "طبيعة البضاعة", sortable: true },
  { key: "GROSS_WEIGHT", label: "الوزن القائم", sortable: true, align: "ltr" },
  { key: "created_at", label: "تاريخ الإدخال", sortable: true },
];

const voucherColumns = [
  { key: "serial_no", label: "رقم السند", sortable: true, align: "ltr" },
  { key: "type", label: "النوع", sortable: true },
  { key: "party_name", label: "الطرف", sortable: true },
  { key: "amount_total", label: "المبلغ (JOD)", sortable: true, align: "ltr" },
  { key: "method", label: "طريقة الدفع", sortable: true },
  { key: "date", label: "تاريخ السند", sortable: true },
  { key: "createdAt", label: "تاريخ الإدخال", sortable: true },
];

/* =========================
   Helpers
========================= */
function normalizeText(v) {
  return String(v ?? "")
    .toLowerCase()
    .trim();
}

function rowMatchesSearch(row, q) {
  if (!q) return true;
  const query = normalizeText(q);
  return Object.values(row || {}).some((val) =>
    normalizeText(val).includes(query),
  );
}

function formatDate(d) {
  if (!d) return "";
  const t = new Date(d).getTime();
  if (Number.isFinite(t)) return new Date(t).toLocaleString("ar-JO");
  return String(d);
}

/* ✅ Template filler */
function fillTemplate(template, obj) {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    const kExact = key;
    const kUpper = key.toUpperCase();
    const kLower = key.toLowerCase();
    const val = obj[kExact] ?? obj[kUpper] ?? obj[kLower] ?? "";
    return val == null ? "" : String(val);
  });
}

/* ✅ توحيد الـ ID */
function toIdStr(x) {
  if (!x) return "";
  return String(x?._id ?? x?.id ?? x?.$oid ?? x);
}

/* ✅ قراءة اللوحة / الاسم */
function getVehicleNo(d) {
  return (
    d?.VEHICLE_NO ??
    d?.vehicle_no ??
    d?.plate_no ??
    d?.PLATE_NO ??
    d?.car_no ??
    d?.CAR_NO ??
    d?.vehicle ??
    d?.VEHICLE ??
    ""
  );
}
function getDriverName(d) {
  return (
    d?.DRIVER_NAME ??
    d?.driver_name ??
    d?.name ??
    d?.NAME ??
    d?.fullName ??
    d?.FULL_NAME ??
    d?.arabic_name ??
    d?.ARABIC_NAME ??
    d?.title ??
    d?.TITLE ??
    ""
  );
}

/* ✅ split دينار/فلس */
function splitJod(n) {
  const x = Number(n || 0);
  const dinar = Math.floor(x);
  let fils = Math.round((x - dinar) * 1000);
  if (fils >= 1000) {
    fils = 0;
    return { dinar: String(dinar + 1), fils: "000" };
  }
  return { dinar: String(dinar), fils: String(fils).padStart(3, "0") };
}

/* ✅ escape html */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ✅ حوّل array لقائمة عمودية */
function asVerticalList(arr, dir = "rtl") {
  const clean = (arr || []).map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!clean.length) return "";
  return clean
    .map((x) => `<span class="v-line" dir="${dir}">${esc(x)}</span>`)
    .join("");
}

/* ✅ إذا عندك نص قديم مفصول / حوله array */
function splitSlashList(str) {
  const s = String(str ?? "").trim();
  if (!s) return [];
  return s
    .split("/")
    .map((x) => x.trim())
    .filter(Boolean);
}

/* ✅ إظهار مصدر الإدخال */
function getWaybillSource(wb) {
  const s = String(wb?.SOURCE ?? wb?.source ?? "")
    .trim()
    .toUpperCase();
  return s || "MANUAL";
}

/* ✅ Waybill: استخراج السائق/المركبة */
function getWaybillVehicleNo(wb) {
  return (
    wb?.VEHICLE_NO || wb?.vehicle_no || wb?.VEHICLE1_NO || wb?.vehicle1_no || ""
  );
}
function getWaybillDriverName(wb) {
  // ✅ عرض كل السائقين في نفس الخانة (بدون تكرار أو أسماء فارغة)
  const names = [1, 2, 3]
    .map((n) => wb?.[`DRIVER${n}_NAME`] ?? wb?.[`driver${n}_name`])
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  const unique = [...new Set(names)];
  if (unique.length) return unique.join("\n");
  // fallback قديم: سائق واحد
  return (
    wb?.DRIVER_NAME ||
    wb?.driver_name ||
    wb?.DRIVER1_NAME ||
    wb?.driver1_name ||
    ""
  );
}

function voucherTypeLabel(t) {
  const x = String(t || "").toUpperCase();
  return x === "PAYMENT" ? "تسديد" : "قبض";
}

/* =========================
   Sorting helpers (SAFE)
========================= */
function sortArrow(col, state) {
  if (!col?.key || !state?.key) return "";
  if (state.key !== col.key) return "↕";
  return state.dir === "asc" ? "▲" : "▼";
}

function toggleSort(col, stateRef) {
  if (!col?.sortable || !col?.key) return;
  if (stateRef.value.key === col.key) {
    stateRef.value.dir = stateRef.value.dir === "asc" ? "desc" : "asc";
  } else {
    stateRef.value.key = col.key;
    stateRef.value.dir = "asc";
  }
}

function valueForSort(row, key) {
  if (!row) return "";

  if (key === "__SOURCE__") return getWaybillSource(row);
  if (key === "__VEHICLE__") return getWaybillVehicleNo(row);
  if (key === "__DRIVER__") return getWaybillDriverName(row);

  const v = row[key] ?? row[key?.toUpperCase?.()] ?? row[key?.toLowerCase?.()];
  if (v == null) return "";

  if (
    String(key).toLowerCase().includes("created_at") ||
    String(key).toLowerCase() === "createdat"
  ) {
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  const n = Number(v);
  if (Number.isFinite(n) && String(v).trim() !== "") return n;

  return String(v).toLowerCase();
}

function sortRows(rows, state) {
  const arr = Array.isArray(rows) ? [...rows] : [];
  const { key, dir } = state || {};
  if (!key) return arr;

  arr.sort((a, b) => {
    const av = valueForSort(a, key);
    const bv = valueForSort(b, key);
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });

  return arr;
}

/* =========================
   Search + Pagination + Filters
========================= */
const filteredInvoices = computed(() => {
  let base = (invoices.value || []).filter((inv) =>
    rowMatchesSearch(inv, invoicesSearch.value),
  );

  const key = invDateMode.value; // created_at | date
  base = base.filter((inv) => {
    const rowTime = toTimeOrNull(inv?.[key]);
    return inDateRange(rowTime, invDateFrom.value, invDateTo.value);
  });

  return sortRows(base, invSort.value);
});

const invTotalPages = computed(() => {
  const total = filteredInvoices.value.length;
  return Math.max(1, Math.ceil(total / invPageSize.value));
});

const pagedInvoices = computed(() => {
  const start = (invPage.value - 1) * invPageSize.value;
  const end = start + invPageSize.value;
  return filteredInvoices.value.slice(start, end);
});

watch(
  [invoicesSearch, invPageSize, invDateMode, invDateFrom, invDateTo],
  () => {
    invPage.value = 1;
  },
);
watch(invTotalPages, (tp) => {
  if (invPage.value > tp) invPage.value = tp;
});

// ===== Waybills
const filteredWaybills = computed(() => {
  let base = (waybills.value || []).filter((wb) =>
    rowMatchesSearch(wb, waybillsSearch.value),
  );

  if (wbSourceFilter.value !== "ALL") {
    base = base.filter((wb) => getWaybillSource(wb) === wbSourceFilter.value);
  }

  const key = wbDateMode.value; // created_at | DATE
  base = base.filter((wb) => {
    const rowTime = toTimeOrNull(wb?.[key]);
    return inDateRange(rowTime, wbDateFrom.value, wbDateTo.value);
  });

  return sortRows(base, wbSort.value);
});

const wbTotalPages = computed(() => {
  const total = filteredWaybills.value.length;
  return Math.max(1, Math.ceil(total / wbPageSize.value));
});

const pagedWaybills = computed(() => {
  const start = (wbPage.value - 1) * wbPageSize.value;
  const end = start + wbPageSize.value;
  return filteredWaybills.value.slice(start, end);
});

watch(
  [
    waybillsSearch,
    wbSourceFilter,
    wbPageSize,
    wbDateMode,
    wbDateFrom,
    wbDateTo,
  ],
  () => {
    wbPage.value = 1;
  },
);
watch(wbTotalPages, (tp) => {
  if (wbPage.value > tp) wbPage.value = tp;
});

// ===== Vouchers ✅
const filteredVouchers = computed(() => {
  let base = (vouchers.value || []).filter((v) =>
    rowMatchesSearch(v, vouchersSearch.value),
  );

  if (vcTypeFilter.value !== "ALL") {
    base = base.filter(
      (v) => String(v?.type || "").toUpperCase() === vcTypeFilter.value,
    );
  }

  const key = vcDateMode.value; // createdAt | date
  base = base.filter((v) => {
    const rowTime = toTimeOrNull(v?.[key]);
    return inDateRange(rowTime, vcDateFrom.value, vcDateTo.value);
  });

  return sortRows(base, vcSort.value);
});

const vcTotalPages = computed(() => {
  const total = filteredVouchers.value.length;
  return Math.max(1, Math.ceil(total / vcPageSize.value));
});

const pagedVouchers = computed(() => {
  const start = (vcPage.value - 1) * vcPageSize.value;
  const end = start + vcPageSize.value;
  return filteredVouchers.value.slice(start, end);
});

watch(
  [vouchersSearch, vcTypeFilter, vcPageSize, vcDateMode, vcDateFrom, vcDateTo],
  () => {
    vcPage.value = 1;
  },
);
watch(vcTotalPages, (tp) => {
  if (vcPage.value > tp) vcPage.value = tp;
});

/* =========================
   API Fetch
========================= */
async function fetchBotStatus() {
  try {
    const res = await axios.get(`${API_BASE}/api/bot-status`);
    botStatus.value = res.data;
  } catch (err) {
    console.error("bot-status error:", err);
  }
}

async function fetchInvoices() {
  loadingInvoices.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/invoices?limit=200`);
    invoices.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("invoices error:", err);
    errorMessage.value = "تعذّر تحميل الفواتير.";
  } finally {
    loadingInvoices.value = false;
  }
}

async function fetchWaybills() {
  loadingWaybills.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/waybills?limit=200`);
    waybills.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("waybills error:", err);
    errorMessage.value = "تعذّر تحميل وثائق النقل.";
  } finally {
    loadingWaybills.value = false;
  }
}

async function fetchVouchers() {
  loadingVouchers.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/vouchers?limit=200`);
    vouchers.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("vouchers error:", err);
    errorMessage.value = "تعذّر تحميل السندات.";
  } finally {
    loadingVouchers.value = false;
  }
}

async function deleteInvoice(inv) {
  const n = inv?.invoice_number || inv?._id;
  if (!confirm(`هل أنت متأكد من حذف الفاتورة رقم ${n} ؟`)) return;

  try {
    await axios.delete(`${API_BASE}/api/invoices/${inv._id}`);
    await fetchInvoices();
  } catch (err) {
    console.error(err);
    alert("تعذّر حذف الفاتورة");
  }
}

async function deleteWaybill(wb) {
  const serial = wb?.waybillNumber || wb?.SERIAL_NO || wb?._id;
  if (!confirm(`هل أنت متأكد من حذف البوليصة رقم ${serial} ؟`)) return;

  try {
    await axios.delete(`${API_BASE}/api/waybills/${wb._id}`);
    await fetchWaybills();
  } catch (err) {
    console.error(err);
    alert("تعذّر حذف البوليصة");
  }
}

async function deleteVoucher(v) {
  const serial = v?.serial_no || v?._id;
  if (!confirm(`هل أنت متأكد من حذف السند رقم ${serial} ؟`)) return;

  try {
    await axios.delete(`${API_BASE}/api/vouchers/${v._id}`);
    await fetchVouchers();
    await fetchInvoices();
  } catch (err) {
    console.error(err);
    alert("تعذّر حذف السند");
  }
}

/* ✅ Drivers */
async function fetchDrivers() {
  loadingDrivers.value = true;
  try {
    const res = await axios.get(`${API_BASE}/api/drivers`);
    drivers.value = Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error("drivers error:", e);
    drivers.value = [];
  } finally {
    loadingDrivers.value = false;
  }
}

/* =========================
   Dashboard Stats
========================= */
async function fetchDashboardStats() {
  try {
    const [driversRes, consignorsRes, consigneesRes] = await Promise.all([
      axios.get(`${API_BASE}/api/drivers`),
      axios.get(`${API_BASE}/api/consignors`),
      axios.get(`${API_BASE}/api/consignees`),
    ]);

    driversCount.value = Array.isArray(driversRes.data)
      ? driversRes.data.length
      : 0;
    consignorsCount.value = Array.isArray(consignorsRes.data)
      ? consignorsRes.data.length
      : 0;
    consigneesCount.value = Array.isArray(consigneesRes.data)
      ? consigneesRes.data.length
      : 0;
  } catch (err) {
    console.error("dashboard stats error:", err);
  }
}

/* =========================
   Invoice Preview ✅
========================= */
function printPreview() {
  const iframe = modalRef.value?.frameRef;
  const w = iframe?.contentWindow;
  if (w) {
    w.focus();
    w.print();
  } else {
    window.print();
  }
}

async function openInvoicePreview(inv) {
  try {
    selectedInvoice.value = inv;
    showInvoicePreview.value = true;

    if (!invoiceTemplateCache.value) {
      const resp = await fetch("/invoice_template.html");
      if (!resp.ok) throw new Error("Invoice template not found");
      invoiceTemplateCache.value = await resp.text();
    }

    const totalNumber = Number(inv.value_jod || 0);
    const parts = splitJod(totalNumber);

    let driverNamesArr = [];
    let vehicleNosArr = [];

    if (
      Array.isArray(inv.driver_names_snapshot) &&
      inv.driver_names_snapshot.length
    ) {
      driverNamesArr = inv.driver_names_snapshot.filter(Boolean);
    } else if (inv.driver_name_snapshot || inv.DRIVER_NAME || inv.driver_name) {
      driverNamesArr = splitSlashList(
        inv.driver_name_snapshot || inv.DRIVER_NAME || inv.driver_name,
      );
    }

    if (
      Array.isArray(inv.vehicle_numbers_snapshot) &&
      inv.vehicle_numbers_snapshot.length
    ) {
      vehicleNosArr = inv.vehicle_numbers_snapshot.filter(Boolean);
    } else if (inv.vehicle_no_snapshot || inv.VEHICLE_NO || inv.vehicle_no) {
      vehicleNosArr = splitSlashList(
        inv.vehicle_no_snapshot || inv.VEHICLE_NO || inv.vehicle_no,
      );
    }

    if (
      (!driverNamesArr.length || !vehicleNosArr.length) &&
      Array.isArray(inv.driver_ids) &&
      (drivers.value || []).length
    ) {
      const ids = inv.driver_ids.map(toIdStr);
      const selected = (drivers.value || []).filter((d) =>
        ids.includes(toIdStr(d)),
      );

      if (!driverNamesArr.length)
        driverNamesArr = selected.map(getDriverName).filter(Boolean);
      if (!vehicleNosArr.length)
        vehicleNosArr = selected.map(getVehicleNo).filter(Boolean);
    }

    const items = Array.isArray(inv.items) ? inv.items : [];
    let itemsRowsHtml = items
      .map((it) => {
        const desc = esc(it?.desc || "");
        const hasDesc = desc.trim().length > 0;
        const hasAmount = String(it?.amount ?? "").trim().length > 0;
        if (!hasDesc && !hasAmount) return "";

        const amt = Number(it?.amount ?? 0);
        const cur = esc(it?.currency || "JOD");
        const rate = Number(it?.rate_to_jod ?? 1);

        const jodCalc = Number(it?.amount_jod);
        const jod = Number.isFinite(jodCalc) ? jodCalc : amt * rate;

        return `
          <tr>
            <td>${desc}</td>
            <td>النقل البري للبضائع</td>
            <td dir="ltr">${Number.isFinite(amt) ? amt.toFixed(3) : ""}</td>
            <td dir="ltr">${cur}</td>
            <td dir="ltr">${Number.isFinite(rate) ? rate.toFixed(4) : ""}</td>
            <td dir="ltr">${Number.isFinite(jod) ? Number(jod).toFixed(3) : ""}</td>
          </tr>
        `;
      })
      .filter(Boolean)
      .join("");

    if (!itemsRowsHtml.trim()) {
      const legacyLines = [
        inv.details_line1 ?? inv.DETAILS_LINE1,
        inv.details_line2 ?? inv.DETAILS_LINE2,
        inv.extra_details ?? inv.EXTRA_DETAILS,
      ].filter((x) => String(x || "").trim());

      if (legacyLines.length) {
        itemsRowsHtml = legacyLines
          .map((line) => {
            const desc = esc(line);
            return `
              <tr>
                <td>${desc}</td>
                <td>النقل البري للبضائع</td>
                <td dir="ltr"></td>
                <td dir="ltr"></td>
                <td dir="ltr"></td>
                <td dir="ltr"></td>
              </tr>
            `;
          })
          .join("");
      } else {
        itemsRowsHtml = `
          <tr>
            <td colspan="6" style="text-align:center; font-weight:800;">لا يوجد بنود</td>
          </tr>
        `;
      }
    }

    const data = {
      COMPANY: esc(inv.company || inv.COMPANY || "—"),
      INVOICE_NO: inv.invoice_number || "",
      DATE: inv.date || "",
      DRIVER_NAME: driverNamesArr.length
        ? asVerticalList(driverNamesArr, "rtl")
        : "—",
      VEHICLE_NO: vehicleNosArr.length
        ? asVerticalList(vehicleNosArr, "ltr")
        : "—",
      ITEMS_ROWS: itemsRowsHtml,
      NOTES: esc(inv.notes || ""),
      DINAR: parts.dinar,
      FILS: parts.fils,
      TOTAL_DINAR: parts.dinar,
      TOTAL_FILS: parts.fils,
    };

    invoicePreviewHtml.value = fillTemplate(invoiceTemplateCache.value, data);
  } catch (err) {
    console.error("invoice preview error:", err);
    alert("صار خطأ بالمعاينة، شوف console");
  }
}

function printInvoicePreview() {
  const iframe = invoiceFrameRef.value;
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } else {
    window.print();
  }
}

/* =========================
   Voucher Preview ✅
========================= */
function buildVoucherHtml(v) {
  const typeLabel = voucherTypeLabel(v?.type);
  const title = `سند ${typeLabel}`;
  const serial = esc(v?.serial_no) || "-";
  const date = esc(v?.date) || "-";
  const party = esc(v?.party_name) || "-";
  const phone = esc(v?.party_phone) || "-";
  const method = esc(v?.method) || "-";
  const refNo = esc(v?.ref_no) || "-";
  const notes = esc(v?.notes) || "-";
  const total = Number(v?.amount_total || 0).toFixed(3);
  const currency = esc(v?.currency) || "JOD";

  const allocs = Array.isArray(v?.allocations) ? v.allocations : [];
  let allocRows = "";
  if (!allocs.length) {
    allocRows = `<tr><td colspan="4" style="text-align:center;">لا يوجد فواتير مرتبطة</td></tr>`;
  } else {
    allocRows = allocs
      .map((a) => {
        const invNo = esc(a?.invoice_number ?? a?.invoice_no ?? "-");
        const invId = a?.invoice_id?._id ?? a?.invoice_id;
        const inv = invoices.value.find((x) => toIdStr(x) === toIdStr(invId));
        const invDate = esc(inv?.date) || "-";
        const invValue = Number(inv?.value_jod ?? 0).toFixed(3);
        const allocAmt = Number(a?.amount || 0).toFixed(3);
        return `
          <tr>
            <td>${invNo}</td>
            <td>${invDate}</td>
            <td dir="ltr">${invValue}</td>
            <td dir="ltr">${allocAmt}</td>
          </tr>
        `;
      })
      .join("");
  }

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${title} - ${serial}</title>
<style>
  body { font-family:"Segoe UI",Tahoma,sans-serif; margin:0; padding:24px; color:#222; }
  .voucher { max-width:720px; margin:0 auto; border:1px solid #d0d5dd; border-radius:8px; padding:24px; }
  h1 { text-align:center; margin:0 0 16px; font-size:22px; }
  table.info { width:100%; border-collapse:collapse; margin-bottom:16px; }
  table.info td { padding:8px; border-bottom:1px solid #eef1f5; }
  table.info td:first-child { font-weight:700; color:#374151; width:140px; background:#f9fafb; }
  table.alloc { width:100%; border-collapse:collapse; margin-top:8px; }
  table.alloc th, table.alloc td { padding:8px; border:1px solid #d0d5dd; text-align:center; }
  table.alloc th { background:#f3f5f8; font-weight:700; }
  .total { text-align:center; margin-top:16px; font-size:18px; font-weight:800; }
</style>
</head>
<body>
  <div class="voucher">
    <h1>${title}</h1>
    <table class="info">
      <tr><td>رقم السند</td><td>${serial}</td></tr>
      <tr><td>التاريخ</td><td>${date}</td></tr>
      <tr><td>الشركة / الطرف</td><td>${party}</td></tr>
      <tr><td>قيمة السند</td><td dir="ltr">${total} ${currency}</td></tr>
      <tr><td>طريقة الدفع</td><td>${method}</td></tr>
      <tr><td>رقم المرجع</td><td>${refNo}</td></tr>
      <tr><td>الهاتف</td><td>${phone}</td></tr>
      <tr><td>الملاحظات</td><td>${notes}</td></tr>
    </table>
    <h2 style="font-size:16px; margin:12px 0 8px;">الفواتير المرتبطة</h2>
    <table class="alloc">
      <thead>
        <tr>
          <th>رقم الفاتورة</th>
          <th>تاريخ الفاتورة</th>
          <th>قيمة الفاتورة</th>
          <th>المبلغ المسدد بهذا السند</th>
        </tr>
      </thead>
      <tbody>${allocRows}</tbody>
    </table>
    <div class="total">إجمالي السند: ${total} ${currency}</div>
  </div>
</body>
</html>`;
}

function openVoucherPreview(v) {
  selectedVoucher.value = v;
  voucherPreviewHtml.value = buildVoucherHtml(v);
  showVoucherPreview.value = true;
}

function printVoucherPreview() {
  const iframe = voucherFrameRef.value;
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } else {
    window.print();
  }
}

/* =========================
   Waybill Preview
========================= */
async function openWaybillPreview(wb) {
  try {
    if (!waybillTemplateCache.value) {
      const resp = await fetch("/waybill_template.html");
      if (!resp.ok)
        throw new Error("waybill_template.html not found in public");
      waybillTemplateCache.value = await resp.text();
    }

    let data = { ...(wb || {}) };

    // ✅ إذا البوليصة فيها سواقين محفوظين كـ DRIVER1.. إلخ، لا تعمل override من DB
    const hasSavedDrivers =
      String(
        data?.DRIVER1_NAME || data?.VEHICLE1_NO || data?.TYPE1_TRANSPORT || "",
      ).trim().length > 0;

    // ✅ فقط إذا ما في سواقين محفوظين، وقتها خذهم من driver_ids
    if (
      !hasSavedDrivers &&
      Array.isArray(wb?.driver_ids) &&
      (drivers.value || []).length
    ) {
      const ids = wb.driver_ids.map(toIdStr);
      const selected = (drivers.value || []).filter((d) =>
        ids.includes(toIdStr(d)),
      );
      data = applyDriversToData(data, selected);
    }

    // ✅ بنود البضاعة: متعددة أو قديمة
    data.GOODS_ROWS = buildGoodsRows(data);

    data.STAMP_SIGNATURE_BLOCK = data.showStampSignature === true
      ? `<div style="position:relative;width:220px;height:70px;margin:0 auto;overflow:visible;">
           <img src="/images/company-stamp.png" alt="stamp" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:110px;height:auto;opacity:0.92;">
           <img src="/images/company-signature.png" alt="signature" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:200px;height:auto;z-index:2;">
         </div>`
      : '<div style="height:14px"></div>';

    previewHtml.value = fillTemplate(waybillTemplateCache.value, data);
    openPreview.value = true;
  } catch (e) {
    console.error("waybill preview error:", e);
    alert("❌ صار خطأ بمعاينة البوليصة");
  }
}

function applyDriversToData(data, driversList = []) {
  const d1 = driversList[0] || {};
  const d2 = driversList[1] || {};
  const d3 = driversList[2] || {};

  return {
    ...data,

    TYPE1_TRANSPORT: d1.TYPE_TRANSPORT || d1.transport_type || "",
    VEHICLE1_NO: getVehicleNo(d1) || "",
    VEHICLE1_REGION: d1.VEHICLE_REGION || d1.vehicle_city || "",
    DRIVER1_NAME: getDriverName(d1) || "",

    TYPE2_TRANSPORT: d2.TYPE_TRANSPORT || d2.transport_type || "",
    VEHICLE2_NO: getVehicleNo(d2) || "",
    VEHICLE2_REGION: d2.VEHICLE_REGION || d2.vehicle_city || "",
    DRIVER2_NAME: getDriverName(d2) || "",

    TYPE3_TRANSPORT: d3.TYPE_TRANSPORT || d3.transport_type || "",
    VEHICLE3_NO: getVehicleNo(d3) || "",
    VEHICLE3_REGION: d3.VEHICLE_REGION || d3.vehicle_city || "",
    DRIVER3_NAME: getDriverName(d3) || "",
  };
}

function buildGoodsRows(data) {
  const items = data?.goodsItems;
  if (Array.isArray(items) && items.length) {
    return items
      .map(
        (it) => `
    <tr>
      <td style="border-top:1px solid #222;border-right:1px solid #222;height:28px;text-align:center;" class="val-center">${esc(String(it.GOODS_NATURE ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(it.TARIFF_CODE ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(it.GROSS_WEIGHT ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(it.MARKS ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(it.PACKAGES_COUNT ?? ""))}</td>
      <td style="border-top:1px solid #222;text-align:center;" class="val-center">${esc(String(it.PACKING_METHOD ?? ""))}</td>
    </tr>`,
      )
      .join("");
  }
  // fallback: old single fields
  return `
    <tr>
      <td style="border-top:1px solid #222;border-right:1px solid #222;height:28px;text-align:center;" class="val-center">${esc(String(data?.GOODS_NATURE ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.TARIFF_CODE ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.GROSS_WEIGHT ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.MARKS ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.PACKAGES_COUNT ?? ""))}</td>
      <td style="border-top:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.PACKING_METHOD ?? ""))}</td>
    </tr>`;
}

/* =========================
   Refresh after edit ✅
========================= */
watch(
  () => route.query.refresh,
  async (v) => {
    if (String(v || "") !== "1") return;

    const t = String(route.query.type || "").toLowerCase();

    if (t === "waybill") await fetchWaybills();
    else if (t === "invoice") await fetchInvoices();
    else if (t === "voucher") await fetchVouchers();
    else {
      await Promise.all([fetchInvoices(), fetchWaybills(), fetchVouchers()]);
    }

    router.replace({ path: route.path, query: {} });
  },
);

/* =========================
   After create events
========================= */
async function onInvoiceCreated() {
  showCreateInvoice.value = false;
  await fetchInvoices();
}

async function onWaybillCreated() {
  showCreateWaybill.value = false;
  await fetchWaybills();
}

async function onVoucherCreated() {
  showCreateVoucher.value = false;
  await fetchVouchers();
  await fetchInvoices();
}

/* =========================
   Mounted
========================= */
onMounted(async () => {
  fetchBotStatus();
  fetchInvoices();
  fetchWaybills();
  fetchVouchers();
  fetchDashboardStats();
  await fetchDrivers();
});
</script>

<template>
  <div class="page">
    <!-- Topbar -->
    <header class="topbar">
      <div class="brand">
        <img src="/images/company-logo.png" class="company-logo" alt="logo" />
        <div class="brand-text">
          <div class="app-title">نظام الفواتير ووثائق النقل</div>
          <div class="app-subtitle">MongoDB / Node / Telegram Bot</div>
        </div>
      </div>

      <div class="top-actions">
        <div
          class="bot-pill"
          :class="{
            'bot-pill--running': botStatus.running,
            'bot-pill--stopped': !botStatus.running,
          }"
          title="حالة البوت"
        >
          <span v-if="botStatus.running"
            >🤖 شغّال (PID: {{ botStatus.pid }})</span
          >
          <span v-else>⛔ غير شغّال</span>
        </div>

        <button class="btn btn--secondary btn--small" @click="fetchBotStatus">
          🔌 تحديث
        </button>

        <nav class="main-nav">
          <RouterLink to="/" class="nav-link">الداشبورد</RouterLink>
          <RouterLink to="/reports" class="nav-link">التقارير</RouterLink>
          <RouterLink to="/drivers" class="nav-link">السائقين</RouterLink>
          <RouterLink to="/consignors" class="nav-link">المرسلون</RouterLink>
          <RouterLink to="/consignees" class="nav-link"
            >المرسل إليهم</RouterLink
          >
        </nav>

        <button class="btn btn--secondary btn--small" @click="handleLogout">
          🔒 خروج
        </button>
      </div>
    </header>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-icon">🚚</div>
        <div class="stat-label">عدد السائقين</div>
        <div class="stat-value">{{ driversCount }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📦</div>
        <div class="stat-label">عدد المرسلين</div>
        <div class="stat-value">{{ consignorsCount }}</div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">🏁</div>
        <div class="stat-label">عدد المرسل إليهم</div>
        <div class="stat-value">{{ consigneesCount }}</div>
      </div>
    </div>

    <!-- Tabs -->
    <nav class="tabs">
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'vouchers' }"
        @click="activeTab = 'vouchers'"
      >
        <span class="tab-label">سندات (قبض/تسديد)</span>
        <span class="tab-badge">{{ filteredVouchers.length }}</span>
      </button>

      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'waybills' }"
        @click="activeTab = 'waybills'"
      >
        <span class="tab-label">وثائق النقل</span>
        <span class="tab-badge">{{ filteredWaybills.length }}</span>
      </button>

      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'invoices' }"
        @click="activeTab = 'invoices'"
      >
        <span class="tab-label">فواتير التصدير</span>
        <span class="tab-badge">{{ filteredInvoices.length }}</span>
      </button>
    </nav>

    <div class="main-area">
      <div v-if="errorMessage" class="alert alert--danger">
        {{ errorMessage }}
      </div>

      <!-- =================== INVOICES =================== -->
      <section v-if="activeTab === 'invoices'" class="section">
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">فواتير التصدير</h2>
            <div class="section-hint">
              فلترة تاريخ + اضغط عنوان العمود للفرز
            </div>
          </div>

          <div class="header-actions">
            <button class="btn btn--primary" @click="openCreateInvoice">
              ➕ فاتورة جديدة
            </button>
            <button
              class="btn btn--secondary"
              @click="fetchInvoices"
              :disabled="loadingInvoices"
            >
              🔄 تحديث
            </button>
          </div>
        </div>

        <div v-if="loadingInvoices" class="status-text">
          جاري تحميل الفواتير...
        </div>

        <div v-else class="table-card">
          <!-- tools ... (نفس كودك بدون تغيير) -->
          <div class="table-tools">
            <div class="search-wrap">
              <input
                v-model="invoicesSearch"
                class="search-input"
                placeholder="🔎 ابحث في الفواتير..."
              />
              <button
                v-if="invoicesSearch"
                class="clear-btn"
                title="مسح البحث"
                @click="invoicesSearch = ''"
              >
                ✖
              </button>
            </div>

            <div class="right-tools">
              <div class="filter">
                <span>تاريخ حسب:</span>
                <select v-model="invDateMode" class="select">
                  <option value="created_at">تاريخ الإدخال</option>
                  <option value="date">تاريخ الفاتورة</option>
                </select>
              </div>

              <div class="filter">
                <span>من:</span>
                <input v-model="invDateFrom" type="date" class="select" />
              </div>

              <div class="filter">
                <span>إلى:</span>
                <input v-model="invDateTo" type="date" class="select" />
              </div>

              <button
                class="btn btn--secondary btn--small"
                @click="
                  invDateFrom = '';
                  invDateTo = '';
                "
                title="مسح فلترة التاريخ"
              >
                🧹 مسح
              </button>

              <div class="pager-size">
                <span>عرض:</span>
                <select v-model.number="invPageSize" class="select">
                  <option :value="10">10</option>
                  <option :value="25">25</option>
                  <option :value="50">50</option>
                </select>
              </div>
            </div>
          </div>

          <div class="table-scroll">
            <!-- ✅ FIX: colgroup + fixed table layout -->
            <table class="table table--fixed table--invoices">
              <colgroup>
                <col class="c-inv-no" />
                <col class="c-company" />
                <col class="c-value" />
                <col class="c-date" />
                <col class="c-created" />
                <col class="c-type" />
                <col class="c-actions" />
              </colgroup>

              <thead>
                <tr>
                  <th
                    v-for="col in invoiceColumns"
                    :key="col.key"
                    class="th-sort"
                    :class="{ 'th-sortable': col.sortable }"
                    @click="toggleSort(col, invSort)"
                    :title="col.sortable ? 'فرز' : ''"
                  >
                    <span>{{ col.label }}</span>
                    <span class="sort-arrow">{{
                      sortArrow(col, invSort.value)
                    }}</span>
                  </th>
                  <th>النوع</th>
                  <th>عمليات</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="inv in pagedInvoices" :key="inv._id">
                  <td class="cell-ellipsis">{{ inv.invoice_number }}</td>
                  <td class="td-clip cell-ellipsis" :title="inv.company">
                    {{ inv.company }}
                  </td>
                  <td class="cell-ellipsis">{{ inv.value_jod }}</td>
                  <td class="cell-ellipsis">{{ inv.date }}</td>
                  <td class="cell-ellipsis">
                    {{ formatDate(inv.created_at) }}
                  </td>

                  <td class="cell-ellipsis">
                    <span v-if="inv.einv_status === 'draft'" class="badge badge--gray">محلية</span>
                    <span v-else class="badge" :class="{
                      'badge--green': inv.einv_status === 'submitted',
                      'badge--orange': inv.einv_status === 'pending',
                      'badge--red': inv.einv_status === 'failed'
                    }">فوترة</span>
                  </td>

                  <td class="actions-cell">
                    <button
                      class="btn btn--secondary btn--small"
                      @click="openInvoicePreview(inv)"
                    >
                      👁 معاينة
                    </button>

                    <RouterLink
                      :to="`/invoices/${inv._id}/edit`"
                      class="btn btn--secondary btn--small"
                    >
                      ✏️ تعديل
                    </RouterLink>

                    <button
                      class="btn btn--danger btn--small"
                      @click="deleteInvoice(inv)"
                    >
                      🗑 حذف
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredInvoices.length === 0">
                  <td colspan="6" class="table-empty">
                    لا توجد فواتير مطابقة.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager">
            <button
              class="btn btn--secondary"
              :disabled="invPage <= 1"
              @click="invPage--"
            >
              ◀ السابق
            </button>
            <div class="pager-info">
              صفحة {{ invPage }} / {{ invTotalPages }}
              <span class="muted"> ({{ filteredInvoices.length }} نتيجة)</span>
            </div>
            <button
              class="btn btn--secondary"
              :disabled="invPage >= invTotalPages"
              @click="invPage++"
            >
              التالي ▶
            </button>
          </div>
        </div>

        <PreviewModal
          v-if="showInvoicePreview"
          :title="
            selectedInvoice
              ? `معاينة الفاتورة (${selectedInvoice.invoice_number || ''})`
              : 'معاينة الفاتورة'
          "
          :html="invoicePreviewHtml"
          :file-name="(selectedInvoice?.invoice_number || 'invoice') + '.pdf'"
          :invoice="selectedInvoice"
          @close="showInvoicePreview = false"
        />
      </section>

      <!-- =================== WAYBILLS =================== -->
      <section v-else-if="activeTab === 'waybills'" class="section">
        <!-- (نفس الهيدر والأدوات عندك) -->
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">وثائق النقل (Waybills)</h2>
            <div class="section-hint">
              فلترة مصدر + فلترة تاريخ + اضغط عنوان العمود للفرز
            </div>
          </div>

          <div class="header-actions">
            <button class="btn btn--primary" @click="openCreateWaybill">
              ➕ بوليصة جديدة
            </button>
            <button
              class="btn btn--secondary"
              @click="fetchWaybills"
              :disabled="loadingWaybills"
            >
              🔄 تحديث
            </button>
          </div>
        </div>

        <div v-if="loadingWaybills" class="status-text">
          جاري تحميل وثائق النقل...
        </div>

        <div v-else class="table-card">
          <div class="table-tools">
            <div class="search-wrap">
              <input
                v-model="waybillsSearch"
                class="search-input"
                placeholder="🔎 ابحث في وثائق النقل..."
              />
              <button
                v-if="waybillsSearch"
                class="clear-btn"
                title="مسح البحث"
                @click="waybillsSearch = ''"
              >
                ✖
              </button>
            </div>

            <div class="right-tools">
              <div class="filter">
                <span>المصدر:</span>
                <select v-model="wbSourceFilter" class="select">
                  <option value="ALL">الكل</option>
                  <option value="BOT">🤖 بوت</option>
                  <option value="MANUAL">✍️ يدوي</option>
                </select>
              </div>

              <div class="filter">
                <span>تاريخ حسب:</span>
                <select v-model="wbDateMode" class="select">
                  <option value="created_at">تاريخ الإدخال</option>
                  <option value="DATE">تاريخ الوثيقة</option>
                </select>
              </div>

              <div class="filter">
                <span>من:</span>
                <input v-model="wbDateFrom" type="date" class="select" />
              </div>

              <div class="filter">
                <span>إلى:</span>
                <input v-model="wbDateTo" type="date" class="select" />
              </div>

              <button
                class="btn btn--secondary btn--small"
                @click="
                  wbDateFrom = '';
                  wbDateTo = '';
                "
                title="مسح فلترة التاريخ"
              >
                🧹 مسح
              </button>

              <div class="pager-size">
                <span>عرض:</span>
                <select v-model.number="wbPageSize" class="select">
                  <option :value="10">10</option>
                  <option :value="25">25</option>
                  <option :value="50">50</option>
                </select>
              </div>
            </div>
          </div>

          <div class="table-scroll">
            <table class="table table--fixed table--waybills">
              <colgroup>
                <col class="c-wb-serial" />
                <col class="c-wb-source" />
                <col class="c-wb-date" />
                <col class="c-wb-consignor" />
                <col class="c-wb-consignee" />
                <col class="c-wb-vehicle" />
                <col class="c-wb-driver" />
                <col class="c-wb-goods" />
                <col class="c-wb-weight" />
                <col class="c-wb-created" />
                <col class="c-wb-actions" />
              </colgroup>

              <thead>
                <tr>
                  <th
                    v-for="col in waybillColumns"
                    :key="col.key"
                    class="th-sort"
                    :class="{ 'th-sortable': col.sortable }"
                    @click="toggleSort(col, wbSort)"
                    :title="col.sortable ? 'فرز' : ''"
                  >
                    <span>{{ col.label }}</span>
                    <span class="sort-arrow">{{
                      sortArrow(col, wbSort.value)
                    }}</span>
                  </th>
                  <th>عمليات</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="wb in pagedWaybills" :key="wb._id">
                  <td class="cell-ellipsis">
                    {{ wb.waybillNumber || wb.SERIAL_NO }}
                  </td>

                  <td class="cell-ellipsis">
                    <span
                      v-if="getWaybillSource(wb) === 'BOT'"
                      class="src src--bot"
                      >🤖 بوت</span
                    >
                    <span v-else class="src src--manual">✍️ يدوي</span>
                  </td>

                  <td class="cell-ellipsis">{{ wb.DATE }}</td>
                  <td class="td-clip cell-ellipsis" :title="wb.CONSIGNOR_NAME">
                    {{ wb.CONSIGNOR_NAME }}
                  </td>
                  <td class="td-clip cell-ellipsis" :title="wb.CONSIGNEE_NAME">
                    {{ wb.CONSIGNEE_NAME }}
                  </td>

                  <td
                    class="td-clip cell-ellipsis"
                    :title="getWaybillVehicleNo(wb)"
                  >
                    {{ getWaybillVehicleNo(wb) }}
                  </td>
                  <td
                    class="td-clip cell-ellipsis"
                    :title="getWaybillDriverName(wb)"
                  >
                    {{ getWaybillDriverName(wb) }}
                  </td>

                  <td class="td-clip cell-ellipsis" :title="wb.GOODS_NATURE">
                    {{ wb.GOODS_NATURE }}
                  </td>
                  <td class="cell-ellipsis">{{ wb.GROSS_WEIGHT }}</td>
                  <td class="cell-ellipsis">{{ formatDate(wb.created_at) }}</td>

                  <td class="actions-cell">
                    <button
                      class="btn btn--secondary btn--small"
                      @click="openWaybillPreview(wb)"
                    >
                      👁 معاينة
                    </button>

                    <RouterLink
                      :to="`/waybills/${wb._id}/edit`"
                      class="btn btn--secondary btn--small"
                    >
                      ✏️ تعديل
                    </RouterLink>

                    <button
                      class="btn btn--danger btn--small"
                      @click="deleteWaybill(wb)"
                    >
                      🗑 حذف
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredWaybills.length === 0">
                  <td colspan="11" class="table-empty">
                    لا توجد بوالص مطابقة.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager">
            <button
              class="btn btn--secondary"
              :disabled="wbPage <= 1"
              @click="wbPage--"
            >
              ◀ السابق
            </button>
            <div class="pager-info">
              صفحة {{ wbPage }} / {{ wbTotalPages }}
              <span class="muted"> ({{ filteredWaybills.length }} نتيجة)</span>
            </div>
            <button
              class="btn btn--secondary"
              :disabled="wbPage >= wbTotalPages"
              @click="wbPage++"
            >
              التالي ▶
            </button>
          </div>
        </div>
      </section>

      <!-- =================== VOUCHERS ✅ =================== -->
      <section v-else class="section">
        <div class="section-header">
          <div class="section-title-wrap">
            <h2 class="section-title">سندات (قبض / تسديد)</h2>
            <div class="section-hint">
              فلترة نوع + فلترة تاريخ + اضغط عنوان العمود للفرز
            </div>
          </div>

          <div class="header-actions">
            <button class="btn btn--primary" @click="openCreateVoucher">
              ➕ سند جديد
            </button>
            <button
              class="btn btn--secondary"
              @click="fetchVouchers"
              :disabled="loadingVouchers"
            >
              🔄 تحديث
            </button>
          </div>
        </div>

        <div v-if="loadingVouchers" class="status-text">
          جاري تحميل السندات...
        </div>

        <div v-else class="table-card">
          <div class="table-tools">
            <div class="search-wrap">
              <input
                v-model="vouchersSearch"
                class="search-input"
                placeholder="🔎 ابحث في السندات..."
              />
              <button
                v-if="vouchersSearch"
                class="clear-btn"
                title="مسح البحث"
                @click="vouchersSearch = ''"
              >
                ✖
              </button>
            </div>

            <div class="right-tools">
              <div class="filter">
                <span>النوع:</span>
                <select v-model="vcTypeFilter" class="select">
                  <option value="ALL">الكل</option>
                  <option value="RECEIPT">قبض</option>
                  <option value="PAYMENT">تسديد</option>
                </select>
              </div>

              <div class="filter">
                <span>تاريخ حسب:</span>
                <select v-model="vcDateMode" class="select">
                  <option value="createdAt">تاريخ الإدخال</option>
                  <option value="date">تاريخ السند</option>
                </select>
              </div>

              <div class="filter">
                <span>من:</span>
                <input v-model="vcDateFrom" type="date" class="select" />
              </div>

              <div class="filter">
                <span>إلى:</span>
                <input v-model="vcDateTo" type="date" class="select" />
              </div>

              <button
                class="btn btn--secondary btn--small"
                @click="
                  vcDateFrom = '';
                  vcDateTo = '';
                "
                title="مسح فلترة التاريخ"
              >
                🧹 مسح
              </button>

              <div class="pager-size">
                <span>عرض:</span>
                <select v-model.number="vcPageSize" class="select">
                  <option :value="10">10</option>
                  <option :value="25">25</option>
                  <option :value="50">50</option>
                </select>
              </div>
            </div>
          </div>

          <div class="table-scroll">
            <table class="table table--fixed table--vouchers">
              <colgroup>
                <col class="c-vc-serial" />
                <col class="c-vc-type" />
                <col class="c-vc-party" />
                <col class="c-vc-amount" />
                <col class="c-vc-method" />
                <col class="c-vc-date" />
                <col class="c-vc-created" />
                <col class="c-vc-actions" />
              </colgroup>

              <thead>
                <tr>
                  <th
                    v-for="col in voucherColumns"
                    :key="col.key"
                    class="th-sort"
                    :class="{ 'th-sortable': col.sortable }"
                    @click="toggleSort(col, vcSort)"
                    :title="col.sortable ? 'فرز' : ''"
                  >
                    <span>{{ col.label }}</span>
                    <span class="sort-arrow">{{
                      sortArrow(col, vcSort.value)
                    }}</span>
                  </th>
                  <th>عمليات</th>
                </tr>
              </thead>

              <tbody>
                <tr v-for="v in pagedVouchers" :key="v._id">
                  <td dir="ltr" class="cell-ellipsis">{{ v.serial_no }}</td>
                  <td class="cell-ellipsis">
                    <span
                      class="src"
                      :class="v.type === 'PAYMENT' ? 'src--manual' : 'src--bot'"
                    >
                      {{ voucherTypeLabel(v.type) }}
                    </span>
                  </td>
                  <td class="td-clip cell-ellipsis" :title="v.party_name">
                    {{ v.party_name }}
                  </td>
                  <td dir="ltr" class="cell-ellipsis">
                    {{ Number(v.amount_total || 0).toFixed(3) }}
                  </td>
                  <td class="cell-ellipsis">{{ v.method }}</td>
                  <td class="cell-ellipsis">{{ v.date }}</td>
                  <td class="cell-ellipsis">{{ formatDate(v.createdAt) }}</td>

                  <td class="actions-cell">
                    <button
                      class="btn btn--secondary btn--small"
                      @click="openVoucherPreview(v)"
                    >
                      👁 معاينة
                    </button>
                    <button
                      class="btn btn--danger btn--small"
                      @click="deleteVoucher(v)"
                    >
                      🗑 حذف
                    </button>
                  </td>
                </tr>

                <tr v-if="filteredVouchers.length === 0">
                  <td colspan="8" class="table-empty">لا توجد سندات مطابقة.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pager">
            <button
              class="btn btn--secondary"
              :disabled="vcPage <= 1"
              @click="vcPage--"
            >
              ◀ السابق
            </button>
            <div class="pager-info">
              صفحة {{ vcPage }} / {{ vcTotalPages }}
              <span class="muted"> ({{ filteredVouchers.length }} نتيجة)</span>
            </div>
            <button
              class="btn btn--secondary"
              :disabled="vcPage >= vcTotalPages"
              @click="vcPage++"
            >
              التالي ▶
            </button>
          </div>
        </div>

      </section>
    </div>

    <!-- Modals -->
    <InvoiceCreateModal
      v-if="showCreateInvoice"
      :api-base="API_BASE"
      @close="closeCreateInvoice"
      @saved="onInvoiceCreated"
    />

    <WaybillCreateModal
      v-if="showCreateWaybill"
      :api-base="API_BASE"
      @close="closeCreateWaybill"
      @saved="onWaybillCreated"
    />

    <VoucherCreateModal
      v-if="showCreateVoucher"
      :api-base="API_BASE"
      @close="closeCreateVoucher"
      @saved="onVoucherCreated"
    />

    <PreviewModal
      v-if="openPreview"
      ref="modalRef"
      title="معاينة البوليصة"
      :html="previewHtml"
      @close="openPreview = false"
      @print="printPreview"
    />

    <PreviewModal
      v-if="showVoucherPreview"
      :title="selectedVoucher ? `معاينة السند (${selectedVoucher.serial_no})` : 'معاينة السند'"
      :html="voucherPreviewHtml"
      @close="showVoucherPreview = false"
    />
  </div>
</template>

<style scoped>
/* ✅ نفس CSS اللي عندك + (إضافات صغيرة للجدول فقط) */
:global(body) {
  margin: 0;
}

.page {
  height: 100vh;
  width: 100%;
  background: linear-gradient(180deg, #f2f6ff 0%, #eef0f3 60%, #eef0f3 100%);
  direction: rtl;
  display: flex;
  flex-direction: column;
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: #222;
  box-sizing: border-box;
  overflow: hidden;
}

/* Topbar */
.topbar {
  background: #ffffffcc;
  backdrop-filter: blur(8px);
  padding: 12px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #d9dde6;
  flex-shrink: 0;
  gap: 14px;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10px;
}

.brand-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.company-logo {
  max-height: 44px;
  width: auto;
  object-fit: contain;
  display: block;
}

.app-title {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.2px;
}
.app-subtitle {
  color: #667085;
  font-size: 12px;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex: 1;
}

.main-nav {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.nav-link {
  font-size: 13px;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  color: #111827;
  background: #fafafa;
  transition: 0.15s ease;
  white-space: nowrap;
}
.nav-link:hover {
  transform: translateY(-1px);
}
.nav-link.router-link-active {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}

/* Bot pill */
.bot-pill {
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  border: 1px solid #e5e7eb;
  user-select: none;
  white-space: nowrap;
}
.bot-pill--running {
  background: #e8f5e9;
  color: #1b5e20;
  border-color: #a5d6a7;
}
.bot-pill--stopped {
  background: #ffebee;
  color: #b71c1c;
  border-color: #ef9a9a;
}

/* Stats */
.stats-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  padding: 14px 18px 0;
}

.stat-card {
  background: #ffffff;
  border-radius: 14px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 6px 18px rgba(16, 24, 40, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
  min-height: 120px;
}
.stat-icon {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: #f3f4f6;
  font-size: 18px;
}
.stat-label {
  font-size: 13px;
  color: #6b7280;
  font-weight: 600;
}
.stat-value {
  font-size: 24px;
  font-weight: 900;
  color: #1976d2;
  line-height: 1.2;
}

@media (max-width: 900px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
@media (max-width: 560px) {
  .stats-row {
    grid-template-columns: 1fr;
  }
  .top-actions {
    justify-content: center;
    width: 100%;
  }
}

/* Tabs */
.tabs {
  background: #ffffffcc;
  backdrop-filter: blur(8px);
  border-bottom: 1px solid #d9dde6;
  padding: 0 18px;
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  align-items: stretch;
}

.tab {
  border: none;
  background: none;
  padding: 12px 16px;
  font-size: 14px;
  cursor: pointer;
  color: #4b5563;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s ease;
  white-space: nowrap;
}
.tab:hover {
  color: #111827;
}
.tab--active {
  border-bottom: 3px solid #1976d2;
  color: #1976d2;
  font-weight: 800;
}
.tab-label {
  display: inline-block;
}
.tab-badge {
  background: #eef2ff;
  color: #3730a3;
  border: 1px solid #e0e7ff;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  min-width: 22px;
  text-align: center;
  display: inline-block;
}

/* Main */
.main-area {
  flex: 1;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.section-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.section-title {
  font-size: 18px;
  margin: 0;
  font-weight: 900;
}
.section-hint {
  font-size: 12px;
  color: #6b7280;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Buttons */
.btn {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: 0.15s ease;
  user-select: none;
}
.btn:hover {
  transform: translateY(-1px);
}
.btn--primary {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
}
.btn--primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn--secondary {
  background: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
}
.btn--danger {
  background: #ffebee;
  color: #b71c1c;
  border: 1px solid #ef9a9a;
}
.btn--small {
  padding: 7px 10px;
  font-size: 12px;
  border-radius: 10px;
}

.actions-cell {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap; /* ✅ مهم عشان ما يوسّع العمود */
}

/* Alerts */
.alert--danger {
  background: #fff1f2;
  padding: 10px;
  border-radius: 12px;
  margin-bottom: 10px;
  border: 1px solid #fecdd3;
  color: #9f1239;
  font-weight: 700;
}

.status-text {
  font-size: 13px;
  color: #374151;
  margin-bottom: 6px;
}

/* Table card */
.table-card {
  flex: 1;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 10px 24px rgba(16, 24, 40, 0.06);
  display: flex;
  flex-direction: column;
}

.table-tools {
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-bottom: 1px solid #eef2f7;
  flex-wrap: wrap;
}

.search-wrap {
  position: relative;
  flex: 1;
  min-width: 260px;
  max-width: 520px;
}
.search-input {
  width: 100%;
  padding: 10px 38px 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 13px;
  outline: none;
  background: #fcfcfd;
}
.search-input:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}
.clear-btn {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  border: 1px solid #e5e7eb;
  background: #fff;
  width: 26px;
  height: 26px;
  border-radius: 10px;
  cursor: pointer;
}

.right-tools {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.filter,
.pager-size {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: #374151;
}

.select {
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
}

.table-scroll {
  flex: 1;
  overflow: auto;
}

/* ✅ FIX الأساسي */
.table {
  width: 100%;
  border-collapse: collapse; /* بدل separate */
  font-size: 13px;
  border: 1px solid #e5e7eb; /* إطار خارجي خفيف */
}
.table--fixed {
  table-layout: fixed; /* ✅ هذا اللي يخلي كل شي تحت الهيدر */
}
.table th,
.table td {
  padding: 10px 10px;
  border: 1px solid #adb1b6; /* بوردر خفيف جداً */
  white-space: pre-line;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cell-ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #adb1b6;
  font-weight: 900;
  border-bottom: 2px solid #e5e7eb; /* خط أقوى تحت الهيدر */
  color: #111827;
}

.table tbody tr:hover td {
  background: #f8fafc;
}

.table tbody tr:nth-child(even) td {
  background: #fcfcfd;
}

.table-empty {
  text-align: center;
  color: #6b7280;
  padding: 20px;
  font-weight: 700;
}

/* Sort headers */
.th-sort {
  user-select: none;
}
.th-sortable {
  cursor: pointer;
}
.sort-arrow {
  margin-right: 6px;
  color: #6b7280;
  font-size: 12px;
}

/* Clip long text */
.td-clip {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Pager */
.pager {
  padding: 10px;
  display: flex;
  justify-content: center;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  border-top: 1px solid #eef2f7;
}
.pager-info {
  font-size: 13px;
  color: #111827;
}
.muted {
  color: #6b7280;
}

/* Preview */
.preview-wrapper {
  margin-top: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  display: flex;
  flex-direction: column;
  height: 520px;
  overflow: hidden;
  box-shadow: 0 10px 24px rgba(16, 24, 40, 0.06);
}
.preview-header {
  padding: 10px 12px;
  border-bottom: 1px solid #eef2f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f9fafb;
  font-size: 13px;
  font-weight: 800;
}
.preview-actions {
  display: flex;
  gap: 8px;
}
.preview-frame {
  flex: 1;
  border: none;
  width: 100%;
}

/* Source pill */
.src {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 900;
  border: 1px solid #e5e7eb;
}
.src--bot {
  background: #e8f5e9;
  color: #1b5e20;
  border-color: #a5d6a7;
}
.src--manual {
  background: #fff8e1;
  color: #6d4c41;
  border-color: #ffe082;
}

/* ✅ widths (تقدر تعدلها حسب ذوقك) */
.c-inv-no {
  width: 170px;
}
.c-company {
  width: 260px;
}
.c-value {
  width: 140px;
}
.c-date {
  width: 150px;
}
.c-created {
  width: 190px;
}
.c-actions {
  width: 260px;
}

.c-wb-serial {
  width: 120px;
}
.c-wb-source {
  width: 90px;
}
.c-wb-date {
  width: 120px;
}
.c-wb-consignor {
  width: 160px;
}
.c-wb-consignee {
  width: 160px;
}
.c-wb-vehicle {
  width: 110px;
}
.c-wb-driver {
  width: 180px;
}
.c-wb-goods {
  width: 150px;
}
.c-wb-weight {
  width: 100px;
}
.c-wb-created {
  width: 150px;
}
.c-wb-actions {
  width: 210px;
}

.c-vc-serial {
  width: 150px;
}
.c-vc-type {
  width: 120px;
}
.c-vc-party {
  width: 230px;
}
.c-vc-amount {
  width: 150px;
}
.c-vc-method {
  width: 160px;
}
.c-vc-date {
  width: 150px;
}
.c-vc-created {
  width: 190px;
}
.c-vc-actions {
  width: 220px;
}
.c-type {
  width: 90px;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
}
.badge--gray {
  background: #e5e7eb;
  color: #374151;
}
.badge--green {
  background: #dcfce7;
  color: #166534;
}
.badge--orange {
  background: #ffedd5;
  color: #9a3412;
}
.badge--red {
  background: #fee2e2;
  color: #991b1b;
}
</style>
