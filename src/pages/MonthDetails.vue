<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import { printStatementReport } from "../utils/printStatementReport";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";
const route = useRoute();
const router = useRouter();

const loading = ref(false);
const errorMessage = ref("");

const tab = ref("invoices"); // invoices | waybills

const invoices = ref([]);
const waybills = ref([]);

const q = ref(""); // بحث داخل الشهر
const innerFrom = ref(""); // فلترة داخل الشهر (yyyy-mm-dd)
const innerTo = ref(""); // فلترة داخل الشهر

const year = computed(() => Number(route.params.year));
const month = computed(() => Number(route.params.month)); // 1..12

function monthKey() {
  const y = String(year.value);
  const m = String(month.value).padStart(2, "0");
  return `${y}-${m}`;
}
function monthStartEndISO(y, m) {
  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0);
  const iso = (d) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return String(iso);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  let hh = d.getHours();
  const min = String(d.getMinutes()).padStart(2, "0");
  const ampm = hh >= 12 ? "م" : "ص";
  hh = hh % 12;
  hh = hh ? hh : 12;
  const hhStr = String(hh).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hhStr}:${min} ${ampm}`;
}

async function printMonthStatement() {
  const { from, to } = monthStartEndISO(year.value, month.value);

  await printStatementReport({
    customerName: "كشف حساب الشهر",
    customerAddress: "", // إذا بدك عنوان العميل/الشركة
    periodFrom: from,
    periodTo: to,
    rows: shownInvoices.value.map((x) => ({
      invoice_number: x.invoice_number ?? "",
      company: x.company ?? "",
      created_at: (x.created_at || x.date || "").slice(0, 10),
      value: x.value_jod ?? 0,
    })),
  });
}
/* =========================
   Date helpers
========================= */
function monthStartTime(y, m) {
  return new Date(y, m - 1, 1, 0, 0, 0).getTime();
}
function monthEndTime(y, m) {
  return new Date(y, m, 0, 23, 59, 59).getTime();
}
function dayStart(yyyyMmDd) {
  const t = new Date(`${yyyyMmDd}T00:00:00`).getTime();
  return Number.isFinite(t) ? t : null;
}
function dayEnd(yyyyMmDd) {
  const t = new Date(`${yyyyMmDd}T23:59:59`).getTime();
  return Number.isFinite(t) ? t : null;
}
function toTimeOrNull(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}
function inRange(t, fromStr, toStr) {
  if (t == null) return true;
  const ft = fromStr ? dayStart(fromStr) : null;
  const tt = toStr ? dayEnd(toStr) : null;
  if (ft != null && t < ft) return false;
  if (tt != null && t > tt) return false;
  return true;
}

/* =========================
   Search helper (خفيف)
========================= */
function norm(x) {
  return String(x ?? "")
    .toLowerCase()
    .trim();
}
function rowMatches(row) {
  if (!q.value) return true;
  const needle = norm(q.value);
  return Object.values(row || {}).some((v) => norm(v).includes(needle));
}

/* =========================
   Navigation
========================= */
function goBack() {
  router.push("/reports");
}

/* =========================
   Waybill helpers
========================= */
function getWaybillSource(wb) {
  const s = String(wb?.SOURCE ?? wb?.source ?? "")
    .trim()
    .toUpperCase();
  return s || "MANUAL";
}

// ✅ تجميع سواقين/مركبات متعددين من DRIVER1..50 + VEHICLE1..50 (مع back-compat)
function getWaybillDriversList(wb) {
  const out = [];
  for (let i = 1; i <= 50; i++) {
    const name =
      wb?.[`DRIVER${i}_NAME`] ?? wb?.[`DRIVER${i}_NAME`.toLowerCase()] ?? "";
    const vno =
      wb?.[`VEHICLE${i}_NO`] ?? wb?.[`VEHICLE${i}_NO`.toLowerCase()] ?? "";
    const any = String(name || vno).trim();
    if (!any) break;
    out.push({
      name: String(name || "").trim(),
      vehicle: String(vno || "").trim(),
    });
  }

  // Back-compat قديم (حقول منفردة)
  if (!out.length) {
    const name =
      wb?.DRIVER_NAME ??
      wb?.driver_name ??
      wb?.DRIVER1_NAME ??
      wb?.driver1_name;
    const vno =
      wb?.VEHICLE_NO ?? wb?.vehicle_no ?? wb?.VEHICLE1_NO ?? wb?.vehicle1_no;
    const any = String(name || vno || "").trim();
    if (any)
      out.push({
        name: String(name || "").trim(),
        vehicle: String(vno || "").trim(),
      });
  }

  return out;
}

function getWaybillVehiclesOnly(wb) {
  const list = getWaybillDriversList(wb)
    .map((x) => x.vehicle)
    .filter(Boolean);
  // لو فاضي رجّع المركبة القديمة
  if (list.length) return list;
  const single =
    wb?.VEHICLE_NO ||
    wb?.vehicle_no ||
    wb?.VEHICLE1_NO ||
    wb?.vehicle1_no ||
    "";
  return single ? [single] : [];
}

function getWaybillDriversOnly(wb) {
  const list = getWaybillDriversList(wb)
    .map((x) => x.name)
    .filter(Boolean);
  if (list.length) return list;
  const single =
    wb?.DRIVER_NAME ||
    wb?.driver_name ||
    wb?.DRIVER1_NAME ||
    wb?.driver1_name ||
    "";
  return single ? [single] : [];
}

/* =========================
   Fetch
========================= */
async function fetchAll() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const [invRes, wbRes] = await Promise.all([
      axios.get(`${API_BASE}/api/invoices?limit=2000`),
      axios.get(`${API_BASE}/api/waybills?limit=2000`),
    ]);
    invoices.value = Array.isArray(invRes.data) ? invRes.data : [];
    waybills.value = Array.isArray(wbRes.data) ? wbRes.data : [];
  } catch (e) {
    console.error(e);
    errorMessage.value = "تعذّر تحميل بيانات الشهر.";
  } finally {
    loading.value = false;
  }
}

onMounted(fetchAll);

/* =========================
   Month rows
========================= */
const monthInvoices = computed(() => {
  const y = year.value;
  const m = month.value;
  const fromT = monthStartTime(y, m);
  const toT = monthEndTime(y, m);

  return (invoices.value || []).filter((inv) => {
    const t = toTimeOrNull(inv?.date) ?? toTimeOrNull(inv?.created_at);
    return t != null && t >= fromT && t <= toT;
  });
});

const monthWaybills = computed(() => {
  const y = year.value;
  const m = month.value;
  const fromT = monthStartTime(y, m);
  const toT = monthEndTime(y, m);

  return (waybills.value || []).filter((wb) => {
    const t = toTimeOrNull(wb?.DATE) ?? toTimeOrNull(wb?.created_at);
    return t != null && t >= fromT && t <= toT;
  });
});

/* =========================
   Inner filters
========================= */
const shownInvoices = computed(() => {
  return monthInvoices.value
    .filter((inv) => rowMatches(inv))
    .filter((inv) => {
      const t = toTimeOrNull(inv?.date) ?? toTimeOrNull(inv?.created_at);
      return inRange(t, innerFrom.value, innerTo.value);
    });
});

const shownWaybills = computed(() => {
  return monthWaybills.value
    .filter((wb) => rowMatches(wb))
    .filter((wb) => {
      const t = toTimeOrNull(wb?.DATE) ?? toTimeOrNull(wb?.created_at);
      return inRange(t, innerFrom.value, innerTo.value);
    });
});

/* =========================
   Summary
========================= */
const invCount = computed(() => shownInvoices.value.length);
const invSum = computed(() =>
  shownInvoices.value.reduce(
    (acc, inv) => acc + (Number(inv?.value_jod || 0) || 0),
    0,
  ),
);

const wbCount = computed(() => shownWaybills.value.length);
const wbBot = computed(
  () => shownWaybills.value.filter((x) => getWaybillSource(x) === "BOT").length,
);
const wbManual = computed(
  () => shownWaybills.value.filter((x) => getWaybillSource(x) !== "BOT").length,
);

watch([year, month], () => {
  q.value = "";
  innerFrom.value = "";
  innerTo.value = "";
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <div class="title">تفاصيل شهر {{ monthKey() }}</div>
        <div class="subtitle">بيانات الشهر كاملة + فلترة داخل الصفحة</div>
      </div>

      <div class="actions">
        <button class="btn btn--secondary" @click="goBack">
          ⬅ رجوع للتقارير
        </button>
        <button
          class="btn btn--secondary"
          :disabled="loading"
          @click="printMonthStatement"
        >
          🖨️ طباعة كشف الحساب
        </button>
        <button
          class="btn btn--secondary"
          :disabled="loading"
          @click="fetchAll"
        >
          🔄 تحديث
        </button>
      </div>
    </header>

    <main class="main">
      <div v-if="errorMessage" class="alert">{{ errorMessage }}</div>

      <div class="filters">
        <input class="inp" v-model="q" placeholder="🔎 بحث داخل الشهر..." />

        <div class="mini">
          <span>من:</span>
          <input class="inp inp--date" type="date" v-model="innerFrom" />
        </div>
        <div class="mini">
          <span>إلى:</span>
          <input class="inp inp--date" type="date" v-model="innerTo" />
        </div>

        <div class="tabs">
          <button
            class="tab"
            :class="{ active: tab === 'invoices' }"
            @click="tab = 'invoices'"
          >
            فواتير <span class="badge">{{ invCount }}</span>
          </button>
          <button
            class="tab"
            :class="{ active: tab === 'waybills' }"
            @click="tab = 'waybills'"
          >
            بوالص <span class="badge">{{ wbCount }}</span>
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">جاري التحميل...</div>

      <div v-else class="summary">
        <!-- SUMMARY -->
        <div v-if="tab === 'invoices'" class="sum-row">
          <div class="sum-card">
            <div class="sum-title">عدد الفواتير</div>
            <div class="sum-val">{{ invCount }}</div>
          </div>
          <div class="sum-card">
            <div class="sum-title">مجموع الفواتير (JOD)</div>
            <div class="sum-val" dir="ltr">
              {{ Number(invSum || 0).toFixed(3) }}
            </div>
          </div>
        </div>

        <div v-else class="sum-row">
          <div class="sum-card">
            <div class="sum-title">عدد البوالص</div>
            <div class="sum-val">{{ wbCount }}</div>
          </div>
          <div class="sum-card">
            <div class="sum-title">BOT</div>
            <div class="sum-val">{{ wbBot }}</div>
          </div>
          <div class="sum-card">
            <div class="sum-title">MANUAL</div>
            <div class="sum-val">{{ wbManual }}</div>
          </div>
        </div>

        <!-- TABLE -->
        <div class="table-card">
          <!-- INVOICES -->
          <table class="table table--invoices" v-if="tab === 'invoices'">
            <thead>
              <tr>
                <th class="th-number" dir="ltr">رقم</th>
                <th class="th-company">الشركة</th>
                <th class="th-value" dir="ltr">القيمة</th>
                <th class="th-date" dir="ltr">التاريخ</th>
                <th class="th-entry" dir="ltr">الإدخال</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="inv in shownInvoices" :key="inv._id">
                <td class="td-number" dir="ltr">{{ inv.invoice_number }}</td>
                <td class="clip td-company" :title="inv.company">
                  {{ inv.company }}
                </td>
                <td class="td-value" dir="ltr">
                  {{ Number(inv.value_jod || 0).toFixed(3) }}
                </td>
                <td class="muted td-date" dir="ltr">{{ inv.date }}</td>
                <td class="muted td-entry" dir="ltr">
                  {{ formatDateTime(inv.created_at) }}
                </td>
              </tr>
              <tr v-if="shownInvoices.length === 0">
                <td colspan="5" class="empty">
                  لا يوجد نتائج داخل الشهر حسب الفلترة
                </td>
              </tr>
            </tbody>
          </table>

          <!-- WAYBILLS -->
          <table class="table" v-else>
            <thead>
              <tr>
                <th dir="ltr">Serial</th>
                <th>المصدر</th>
                <th>تاريخ</th>
                <th>المرسل</th>
                <th>المرسل إليه</th>
                <th>مركبة</th>
                <th>سائق</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="wb in shownWaybills" :key="wb._id">
                <td dir="ltr">{{ wb.waybillNumber || wb.SERIAL_NO }}</td>
                <td class="mono">{{ getWaybillSource(wb) }}</td>
                <td class="muted" dir="ltr">{{ wb.DATE }}</td>
                <td class="clip" :title="wb.CONSIGNOR_NAME">
                  {{ wb.CONSIGNOR_NAME }}
                </td>
                <td class="clip" :title="wb.CONSIGNEE_NAME">
                  {{ wb.CONSIGNEE_NAME }}
                </td>

                <!-- ✅ المركبات تحت بعض -->
                <td class="driver-cell" dir="ltr">
                  <div
                    v-for="(v, i) in getWaybillVehiclesOnly(wb)"
                    :key="i"
                    class="vehicle-no"
                  >
                    {{ v }}
                  </div>
                </td>

                <!-- ✅ السواقين تحت بعض -->
                <td class="driver-cell">
                  <div
                    v-for="(n, i) in getWaybillDriversOnly(wb)"
                    :key="i"
                    class="driver-name"
                  >
                    {{ n }}
                  </div>
                </td>
              </tr>

              <tr v-if="shownWaybills.length === 0">
                <td colspan="7" class="empty">
                  لا يوجد نتائج داخل الشهر حسب الفلترة
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
}

.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  direction: rtl;
  font-family: "Segoe UI", Tahoma, sans-serif;
  background: #eef0f3;
  color: #111827;
}

.topbar {
  background: #fff;
  border-bottom: 1px solid #d1d5db;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}

.title {
  font-weight: 900;
  font-size: 18px;
}
.subtitle {
  color: #6b7280;
  font-size: 12px;
  margin-top: 2px;
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 900;
  font-size: 13px;
}
.btn--secondary {
  background: #fff;
  border: 1px solid #e5e7eb;
}

.main {
  flex: 1;
  padding: 14px 18px;
  overflow: auto;
}

.alert {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #9f1239;
  padding: 10px 12px;
  border-radius: 12px;
  margin-bottom: 10px;
  font-weight: 700;
}

.filters {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 10px;
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.inp {
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  min-width: 220px;
}
.inp--date {
  min-width: 170px;
}

.mini {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: #374151;
}

.tabs {
  display: flex;
  gap: 8px;
}

.tab {
  border: 1px solid #e5e7eb;
  background: #f9fafb;
  padding: 8px 12px;
  border-radius: 12px;
  cursor: pointer;
  font-weight: 800;
  display: flex;
  gap: 8px;
  align-items: center;
}
.tab.active {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}

.badge {
  background: #eef2ff;
  border: 1px solid #e0e7ff;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  color: #3730a3;
}

.loading {
  padding: 14px;
  color: #374151;
  font-weight: 800;
}

.summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sum-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.sum-card {
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}
.sum-title {
  font-size: 13px;
  font-weight: 900;
  color: #6b7280;
}
.sum-val {
  font-size: 30px;
  font-weight: 900;
  color: #1976d2;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.table-card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 10px;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.06);
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
}

.table th,
.table td {
  border: 1px solid #e0e0e0;
  padding: 10px 12px;
  vertical-align: middle;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.table th {
  text-align: right;
  color: #333;
  font-weight: 600;
  background: #f5f5f5;
}

.table tbody tr:nth-child(even) td {
  background: #fafafa;
}

/* Invoice column widths */
.table--invoices {
  table-layout: fixed;
}

.th-number,
.td-number {
  width: 180px;
}
.th-company,
.td-company {
  width: 280px;
}
.th-value,
.td-value {
  width: 140px;
}
.th-date,
.td-date {
  width: 160px;
}
.th-entry,
.td-entry {
  width: 200px;
}

.clip {
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.muted {
  color: #6b7280;
}

.mono {
  font-variant-numeric: tabular-nums;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
}

/* ✅ المطلوب: السائق/المركبة تحت بعض */
.driver-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.2;
  min-width: 120px;
  overflow: visible;
}

.driver-name {
  font-weight: 800;
  color: #111827;
}

.vehicle-no {
  font-size: 13px;
  color: #6b7280;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.3px;
}

.empty {
  text-align: center;
  color: #6b7280;
  padding: 14px;
  font-weight: 800;
}
</style>
