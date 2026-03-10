<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";

const router = useRouter();
const API_BASE = "http://127.0.0.1:4000";

const loading = ref(false);
const errorMessage = ref("");

const tab = ref("invoices"); // invoices | waybills

const dateFrom = ref(""); // yyyy-mm-dd
const dateTo = ref(""); // yyyy-mm-dd

const invoices = ref([]);
const waybills = ref([]);

/* =========================
   Date helpers
========================= */
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
function inDateRange(rowTime, fromStr, toStr) {
  if (rowTime == null) return true;
  const fromT = fromStr ? dayStart(fromStr) : null;
  const toT = toStr ? dayEnd(toStr) : null;
  if (fromT != null && rowTime < fromT) return false;
  if (toT != null && rowTime > toT) return false;
  return true;
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
function getWaybillVehicleNo(wb) {
  return (
    wb?.VEHICLE_NO || wb?.vehicle_no || wb?.VEHICLE1_NO || wb?.vehicle1_no || ""
  );
}
function getWaybillDriverName(wb) {
  return (
    wb?.DRIVER_NAME ||
    wb?.driver_name ||
    wb?.DRIVER1_NAME ||
    wb?.driver1_name ||
    ""
  );
}

/* =========================
   Navigation
========================= */
function goBack() {
  router.push({ path: "/", query: { refresh: "1" } });
}
function goToMonth(m) {
  router.push({
    name: "ReportsMonthDetails",
    params: {
      year: String(m.year),
      month: String(m.month).padStart(2, "0"),
    },
  });
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
    errorMessage.value = "تعذّر تحميل بيانات التقارير.";
  } finally {
    loading.value = false;
  }
}

onMounted(fetchAll);

/* =========================
   Filtered rows (حسب الفلترة)
========================= */
const filteredInvoices = computed(() => {
  return (invoices.value || []).filter((inv) => {
    const t = toTimeOrNull(inv?.date) ?? toTimeOrNull(inv?.created_at);
    return inDateRange(t, dateFrom.value, dateTo.value);
  });
});

const filteredWaybills = computed(() => {
  return (waybills.value || []).filter((wb) => {
    const t = toTimeOrNull(wb?.DATE) ?? toTimeOrNull(wb?.created_at);
    return inDateRange(t, dateFrom.value, dateTo.value);
  });
});

/* =========================
   Monthly cards (حسب التاب + الفلترة)
========================= */
function ymKey(y, m) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

const months = computed(() => {
  const map = new Map();

  if (tab.value === "invoices") {
    for (const inv of filteredInvoices.value) {
      const t = toTimeOrNull(inv?.date) ?? toTimeOrNull(inv?.created_at);
      if (!t) continue;
      const d = new Date(t);

      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = ymKey(y, m);

      const cur = map.get(key) || {
        key,
        year: y,
        month: m,
        label: key, // YYYY-MM
        count: 0,
        sum: 0,
      };

      cur.count += 1;
      cur.sum += Number(inv?.value_jod || 0) || 0;
      map.set(key, cur);
    }
  } else {
    for (const wb of filteredWaybills.value) {
      const t = toTimeOrNull(wb?.DATE) ?? toTimeOrNull(wb?.created_at);
      if (!t) continue;
      const d = new Date(t);

      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const key = ymKey(y, m);

      const cur = map.get(key) || {
        key,
        year: y,
        month: m,
        label: key, // YYYY-MM
        count: 0,
        bot: 0,
        manual: 0,
      };

      cur.count += 1;
      if (getWaybillSource(wb) === "BOT") cur.bot += 1;
      else cur.manual += 1;

      map.set(key, cur);
    }
  }

  return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
});

/* =========================
   Overall stats
========================= */
const invCount = computed(() => filteredInvoices.value.length);
const invSumJod = computed(() => {
  return filteredInvoices.value.reduce((acc, inv) => {
    const n = Number(inv?.value_jod ?? inv?.VALUE_JOD ?? 0);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
});

const topCompanies = computed(() => {
  const map = new Map();
  for (const inv of filteredInvoices.value) {
    const name = String(inv?.company ?? inv?.COMPANY ?? "—").trim() || "—";
    const val = Number(inv?.value_jod ?? inv?.VALUE_JOD ?? 0);
    const cur = map.get(name) || { count: 0, sum: 0 };
    cur.count += 1;
    cur.sum += Number.isFinite(val) ? val : 0;
    map.set(name, cur);
  }
  return [...map.entries()]
    .map(([company, v]) => ({ company, count: v.count, sum: v.sum }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 10);
});

const wbCount = computed(() => filteredWaybills.value.length);
const wbBotCount = computed(
  () =>
    filteredWaybills.value.filter((x) => getWaybillSource(x) === "BOT").length,
);
const wbManualCount = computed(
  () =>
    filteredWaybills.value.filter((x) => getWaybillSource(x) !== "BOT").length,
);

const topDrivers = computed(() => {
  const map = new Map();
  for (const wb of filteredWaybills.value) {
    const driver = String(getWaybillDriverName(wb) || "—").trim() || "—";
    map.set(driver, (map.get(driver) || 0) + 1);
  }
  return [...map.entries()]
    .map(([driver, count]) => ({ driver, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
});

const topVehicles = computed(() => {
  const map = new Map();
  for (const wb of filteredWaybills.value) {
    const v = String(getWaybillVehicleNo(wb) || "—").trim() || "—";
    map.set(v, (map.get(v) || 0) + 1);
  }
  return [...map.entries()]
    .map(([vehicle, count]) => ({ vehicle, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
});

/* =========================
   CSV export
========================= */
function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportInvoicesCsv() {
  const rows = filteredInvoices.value;
  const header = [
    "invoice_number",
    "company",
    "value_jod",
    "date",
    "created_at",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) =>
      header
        .map((k) => `"${String(r?.[k] ?? "").replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");

  downloadTextFile(
    `reports_invoices_${dateFrom.value || "all"}_${dateTo.value || "all"}.csv`,
    csv,
  );
}

function exportWaybillsCsv() {
  const rows = filteredWaybills.value;
  const header = [
    "SERIAL_NO",
    "DATE",
    "CONSIGNOR_NAME",
    "CONSIGNEE_NAME",
    "VEHICLE_NO",
    "DRIVER_NAME",
    "SOURCE",
    "created_at",
  ];
  const csv = [
    header.join(","),
    ...rows.map((r) => {
      const obj = {
        SERIAL_NO: r?.SERIAL_NO ?? "",
        DATE: r?.DATE ?? "",
        CONSIGNOR_NAME: r?.CONSIGNOR_NAME ?? "",
        CONSIGNEE_NAME: r?.CONSIGNEE_NAME ?? "",
        VEHICLE_NO: getWaybillVehicleNo(r),
        DRIVER_NAME: getWaybillDriverName(r),
        SOURCE: getWaybillSource(r),
        created_at: r?.created_at ?? "",
      };
      return header
        .map((k) => `"${String(obj?.[k] ?? "").replace(/"/g, '""')}"`)
        .join(",");
    }),
  ].join("\n");

  downloadTextFile(
    `reports_waybills_${dateFrom.value || "all"}_${dateTo.value || "all"}.csv`,
    csv,
  );
}
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="title-wrap">
        <div class="title">التقارير</div>
        <div class="subtitle">
          فلترة تاريخ + إحصائيات + كروت شهرية + تصدير CSV
        </div>
      </div>

      <div class="actions">
        <button class="btn btn--secondary" type="button" @click="goBack">
          ⬅ رجوع للداشبورد
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

    <div class="main">
      <div v-if="errorMessage" class="alert">{{ errorMessage }}</div>

      <div class="filters">
        <div class="filter">
          <span>من:</span>
          <input v-model="dateFrom" type="date" class="inp" />
        </div>
        <div class="filter">
          <span>إلى:</span>
          <input v-model="dateTo" type="date" class="inp" />
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

        <div class="right">
          <button
            v-if="tab === 'invoices'"
            class="btn btn--primary"
            @click="exportInvoicesCsv"
          >
            ⬇️ CSV فواتير
          </button>
          <button v-else class="btn btn--primary" @click="exportWaybillsCsv">
            ⬇️ CSV بوالص
          </button>
        </div>
      </div>

      <div v-if="loading" class="loading">جاري التحميل...</div>

      <!-- ✅ Monthly cards -->
      <div v-else class="months-wrap">
        <div class="months-title">
          كروت الشهور (اضغط على الشهر لعرض تفاصيل الشهر)
        </div>

        <div class="months-grid">
          <button
            v-for="m in months"
            :key="m.key"
            class="month-card"
            type="button"
            @click="goToMonth(m)"
          >
            <div class="month-title">{{ m.label }}</div>

            <div class="month-stats" v-if="tab === 'invoices'">
              <div class="ms">
                <div class="ms-label">عدد</div>
                <div class="ms-val">{{ m.count }}</div>
              </div>
              <div class="ms">
                <div class="ms-label">المجموع (JOD)</div>
                <div class="ms-val" dir="ltr">
                  {{ Number(m.sum || 0).toFixed(3) }}
                </div>
              </div>
            </div>

            <div class="month-stats" v-else>
              <div class="ms">
                <div class="ms-label">عدد</div>
                <div class="ms-val">{{ m.count }}</div>
              </div>
              <div class="ms">
                <div class="ms-label">BOT</div>
                <div class="ms-val">{{ m.bot }}</div>
              </div>
              <div class="ms">
                <div class="ms-label">MANUAL</div>
                <div class="ms-val">{{ m.manual }}</div>
              </div>
            </div>

            <div class="month-hint">اضغط لفتح جدول الشهر</div>
          </button>

          <div v-if="months.length === 0" class="empty-months">
            لا يوجد بيانات ضمن الفترة الحالية.
          </div>
        </div>
      </div>

      <!-- ✅ Existing stats below -->
      <div v-if="!loading" class="grid" style="margin-top: 14px">
        <template v-if="tab === 'invoices'">
          <div class="card">
            <div class="card-title">عدد الفواتير</div>
            <div class="card-val">{{ invCount }}</div>
          </div>

          <div class="card">
            <div class="card-title">مجموع الفواتير (JOD)</div>
            <div class="card-val" dir="ltr">
              {{ Number(invSumJod || 0).toFixed(3) }}
            </div>
          </div>

          <div class="card wide">
            <div class="card-title">أعلى 10 شركات حسب المجموع</div>
            <table class="table">
              <thead>
                <tr>
                  <th>الشركة</th>
                  <th dir="ltr">عدد</th>
                  <th dir="ltr">المجموع (JOD)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in topCompanies" :key="i">
                  <td class="clip" :title="r.company">{{ r.company }}</td>
                  <td dir="ltr">{{ r.count }}</td>
                  <td dir="ltr">{{ Number(r.sum || 0).toFixed(3) }}</td>
                </tr>
                <tr v-if="topCompanies.length === 0">
                  <td colspan="3" class="empty">لا يوجد بيانات ضمن الفترة</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>

        <template v-else>
          <div class="card">
            <div class="card-title">عدد البوالص</div>
            <div class="card-val">{{ wbCount }}</div>
          </div>

          <div class="card">
            <div class="card-title">BOT</div>
            <div class="card-val">{{ wbBotCount }}</div>
          </div>

          <div class="card">
            <div class="card-title">MANUAL</div>
            <div class="card-val">{{ wbManualCount }}</div>
          </div>

          <div class="card wide">
            <div class="card-title">أعلى 10 سائقين</div>
            <table class="table">
              <thead>
                <tr>
                  <th>السائق</th>
                  <th dir="ltr">عدد</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in topDrivers" :key="i">
                  <td class="clip" :title="r.driver">{{ r.driver }}</td>
                  <td dir="ltr">{{ r.count }}</td>
                </tr>
                <tr v-if="topDrivers.length === 0">
                  <td colspan="2" class="empty">لا يوجد بيانات ضمن الفترة</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="card wide">
            <div class="card-title">أعلى 10 مركبات</div>
            <table class="table">
              <thead>
                <tr>
                  <th>المركبة</th>
                  <th dir="ltr">عدد</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(r, i) in topVehicles" :key="i">
                  <td class="clip" :title="r.vehicle">{{ r.vehicle }}</td>
                  <td dir="ltr">{{ r.count }}</td>
                </tr>
                <tr v-if="topVehicles.length === 0">
                  <td colspan="2" class="empty">لا يوجد بيانات ضمن الفترة</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
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
  align-items: center;
  gap: 12px;
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
.filter {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: #374151;
}
.inp {
  padding: 8px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
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
  color: #111827;
  display: flex;
  align-items: center;
  gap: 8px;
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

.right {
  margin-right: auto;
  display: flex;
  gap: 8px;
}

.btn {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 900;
  font-size: 13px;
}
.btn--primary {
  background: #1976d2;
  color: #fff;
}
.btn--secondary {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #111827;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading {
  padding: 14px;
  color: #374151;
  font-weight: 800;
}

/* ===== Monthly cards ===== */
.months-title {
  font-weight: 900;
  color: #374151;
  margin: 6px 0 10px;
}
.months-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
}
.month-card {
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  cursor: pointer;
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: 0.15s ease;
}
.month-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 26px rgba(0, 0, 0, 0.08);
}
.month-title {
  font-weight: 900;
  color: #1976d2;
}
.month-stats {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.ms {
  flex: 1;
  min-width: 110px;
  border: 1px solid #eef2f7;
  background: #f9fafb;
  border-radius: 14px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: center; /* العنوان فوق الرقم */
  text-align: center;
  gap: 6px;
}
.ms-label {
  font-size: 12px;
  font-weight: 900;
  color: #6b7280;
}
.ms-val {
  font-size: 22px;
  font-weight: 900;
  color: #111827;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
.month-hint {
  font-size: 12px;
  color: #6b7280;
  font-weight: 800;
}
.empty-months {
  padding: 14px;
  border: 1px dashed #d1d5db;
  border-radius: 14px;
  background: #fff;
  color: #6b7280;
  font-weight: 900;
  text-align: center;
}

/* ===== Existing cards ===== */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
}
.card {
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
/* ✅ خلي العنوان والرقم فوق بعض مضبوط */
.card-title,
.card-val {
  width: 100%;
  display: block;
  text-align: center;
}

/* ✅ لو الرقم dir="ltr" لسا بنطّ */
.card-val[dir="ltr"] {
  direction: ltr;
  text-align: center;
}

/* ✅ كمان نفس الفكرة داخل كروت الشهر */
.ms-label,
.ms-val {
  width: 100%;
  display: block;
  text-align: center;
}

.ms-val[dir="ltr"] {
  direction: ltr;
  text-align: center;
}

.table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
  font-size: 13px;
}
.table th,
.table td {
  border-bottom: 1px solid #eef2f7;
  padding: 8px 8px;
}
.table th {
  text-align: right;
  color: #111827;
  font-weight: 900;
  background: #f9fafb;
}
.clip {
  max-width: 360px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.empty {
  text-align: center;
  color: #6b7280;
  padding: 12px;
  font-weight: 800;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
