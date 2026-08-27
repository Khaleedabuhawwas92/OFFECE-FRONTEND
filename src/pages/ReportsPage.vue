<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";

const router = useRouter();
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

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
    "waybillNumber",
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
        waybillNumber: r?.waybillNumber || r?.SERIAL_NO || "",
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
      <div class="topbar-left">
        <div class="app-title">التقارير</div>
        <div class="app-subtitle">
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

    <div class="main-area">
      <div class="content-wrapper">
        <div v-if="errorMessage" class="alert alert--danger">
          {{ errorMessage }}
        </div>

        <!-- Filter Card -->
        <section class="card filter-card">
          <div class="filter-row">
            <div class="filter-group">
              <label class="filter-label">
                <span>من:</span>
                <input v-model="dateFrom" type="date" class="inp" />
              </label>
              <label class="filter-label">
                <span>إلى:</span>
                <input v-model="dateTo" type="date" class="inp" />
              </label>
            </div>

            <div class="tabs">
              <button
                class="tab"
                :class="{ active: tab === 'invoices' }"
                @click="tab = 'invoices'"
              >
                الفواتير <span class="badge">{{ invCount }}</span>
              </button>
              <button
                class="tab"
                :class="{ active: tab === 'waybills' }"
                @click="tab = 'waybills'"
              >
                وثائق النقل <span class="badge">{{ wbCount }}</span>
              </button>
            </div>

            <div class="filter-actions">
              <button
                v-if="tab === 'invoices'"
                class="btn btn--primary"
                @click="exportInvoicesCsv"
              >
                ⬇️ CSV فواتير
              </button>
              <button
                v-else
                class="btn btn--primary"
                @click="exportWaybillsCsv"
              >
                ⬇️ CSV بوالص
              </button>
            </div>
          </div>
        </section>

        <div v-if="loading" class="status-text">جاري التحميل...</div>

        <template v-else>
          <!-- Summary Cards -->
          <section class="summary-section">
            <div v-if="tab === 'invoices'" class="summary-grid">
              <div class="stat-card">
                <div class="stat-label">عدد الفواتير</div>
                <div class="stat-val">{{ invCount }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">مجموع الفواتير (JOD)</div>
                <div class="stat-val" dir="ltr">
                  {{ Number(invSumJod || 0).toFixed(3) }}
                </div>
              </div>
            </div>
            <div v-else class="summary-grid">
              <div class="stat-card">
                <div class="stat-label">عدد البوالص</div>
                <div class="stat-val">{{ wbCount }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">BOT</div>
                <div class="stat-val">{{ wbBotCount }}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">MANUAL</div>
                <div class="stat-val">{{ wbManualCount }}</div>
              </div>
            </div>
          </section>

          <!-- Monthly Cards -->
          <section class="card months-section">
            <div class="section-header">
              <h2 class="section-title">كروت الشهور</h2>
              <span class="section-hint">اضغط على الشهر لعرض التفاصيل</span>
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
                    <div class="ms-label">بوت</div>
                    <div class="ms-val">{{ m.bot }}</div>
                  </div>
                  <div class="ms">
                    <div class="ms-label">يدوي</div>
                    <div class="ms-val">{{ m.manual }}</div>
                  </div>
                </div>
              </button>

              <div v-if="months.length === 0" class="empty-state">
                لا يوجد بيانات ضمن الفترة الحالية.
              </div>
            </div>
          </section>

          <!-- Top 10 Tables -->
          <section class="tables-section">
            <template v-if="tab === 'invoices'">
              <div class="card table-card">
                <div class="section-header">
                  <h2 class="section-title">أعلى 10 شركات حسب المجموع</h2>
                </div>
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th class="th-company">الشركة</th>
                        <th class="th-number" dir="ltr">عدد</th>
                        <th class="th-number" dir="ltr">المجموع (JOD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(r, i) in topCompanies" :key="i">
                        <td class="clip" :title="r.company">
                          {{ r.company }}
                        </td>
                        <td dir="ltr">{{ r.count }}</td>
                        <td dir="ltr">
                          {{ Number(r.sum || 0).toFixed(3) }}
                        </td>
                      </tr>
                      <tr v-if="topCompanies.length === 0">
                        <td colspan="3" class="table-empty">
                          لا يوجد بيانات ضمن الفترة
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="card table-card">
                <div class="section-header">
                  <h2 class="section-title">أعلى 10 سائقين</h2>
                </div>
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th class="th-name">السائق</th>
                        <th class="th-number" dir="ltr">عدد</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(r, i) in topDrivers" :key="i">
                        <td class="clip" :title="r.driver">{{ r.driver }}</td>
                        <td dir="ltr">{{ r.count }}</td>
                      </tr>
                      <tr v-if="topDrivers.length === 0">
                        <td colspan="2" class="table-empty">
                          لا يوجد بيانات ضمن الفترة
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div class="card table-card">
                <div class="section-header">
                  <h2 class="section-title">أعلى 10 مركبات</h2>
                </div>
                <div class="table-container">
                  <table class="table">
                    <thead>
                      <tr>
                        <th class="th-name">المركبة</th>
                        <th class="th-number" dir="ltr">عدد</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(r, i) in topVehicles" :key="i">
                        <td class="clip" :title="r.vehicle">
                          {{ r.vehicle }}
                        </td>
                        <td dir="ltr">{{ r.count }}</td>
                      </tr>
                      <tr v-if="topVehicles.length === 0">
                        <td colspan="2" class="table-empty">
                          لا يوجد بيانات ضمن الفترة
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </template>
          </section>
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
  width: 100%;
  background: #eef0f3;
  direction: rtl;
  display: flex;
  flex-direction: column;
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: #222;
  box-sizing: border-box;
  overflow: hidden;
}

.topbar {
  background: #ffffff;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ccc;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  flex-direction: column;
}

.app-title {
  font-size: 20px;
  font-weight: 600;
}

.app-subtitle {
  color: #666;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}

.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-wrapper {
  width: 100%;
  max-width: 1450px;
  margin: 0 auto;
  padding: 20px 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: auto;
  box-sizing: border-box;
  gap: 20px;
}

/* Cards */
.card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 20px 24px;
}

.filter-card {
  padding: 14px 20px;
}

/* Filter row */
.filter-row {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.filter-group {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #444;
}

.inp {
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: #fff;
  font-size: 13px;
  font-family: inherit;
  height: 36px;
  box-sizing: border-box;
}

/* Tabs */
.tabs {
  display: flex;
  gap: 8px;
  align-items: center;
}

.tab {
  border: 1px solid #ccc;
  background: #f5f5f5;
  padding: 6px 14px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  color: #333;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.15s ease;
  font-family: inherit;
}

.tab.active {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}

.badge {
  background: rgba(0, 0, 0, 0.08);
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
}

.tab.active .badge {
  background: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.filter-actions {
  margin-right: auto;
  display: flex;
  gap: 8px;
}

/* Buttons */
.btn {
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
  font-family: inherit;
  font-weight: 600;
}

.btn--primary {
  background: #1976d2;
  color: white;
  border: none;
}

.btn--primary:hover {
  background: #1565c0;
}

.btn--secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ccc;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Alerts */
.alert--danger {
  background: #ffebee;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid #ef9a9a;
  color: #b71c1c;
  font-size: 13px;
  font-weight: 600;
}

.status-text {
  font-size: 13px;
  color: #444;
  text-align: center;
  padding: 20px;
}

/* Section headers */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
}

.section-title {
  font-size: 16px;
  margin: 0;
  font-weight: 600;
  color: #222;
}

.section-hint {
  font-size: 12px;
  color: #666;
}

/* Summary */
.summary-section {
  margin: 0;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}

.stat-card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 8px;
}

.stat-label {
  font-size: 13px;
  font-weight: 500;
  color: #666;
}

.stat-val {
  font-size: 28px;
  font-weight: 700;
  color: #1976d2;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.stat-val[dir="ltr"] {
  direction: ltr;
}

/* Monthly section */
.months-section {
  padding: 16px;
  width: 100%;
  box-sizing: border-box;
}

.months-section .section-header {
  margin-bottom: 12px;
}

.months-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 260px));
  gap: 8px;
  justify-content: start;
}

.month-card {
  border: 1px solid #ddd;
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition: all 0.15s ease;
}

.month-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.08);
  border-color: #1976d2;
}

.month-title {
  font-weight: 700;
  font-size: 15px;
  color: #1976d2;
}

.month-stats {
  display: flex;
  gap: 8px;
}

.ms {
  flex: 1;
  min-width: 70px;
  border: 1px solid #e8e8e8;
  background: #fafafa;
  border-radius: 6px;
  padding: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
}

.ms-label {
  font-size: 11px;
  font-weight: 600;
  color: #666;
}

.ms-val {
  font-size: 18px;
  font-weight: 700;
  color: #222;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.ms-val[dir="ltr"] {
  direction: ltr;
}

.empty-state {
  grid-column: 1 / -1;
  padding: 24px;
  border: 1px dashed #ccc;
  border-radius: 8px;
  background: #fafafa;
  color: #777;
  font-weight: 600;
  text-align: center;
  font-size: 13px;
}

/* Tables section */
.tables-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.table-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-container {
  overflow: auto;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}

.table th,
.table td {
  border: 1px solid #e0e0e0;
  padding: 10px 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  vertical-align: middle;
}

.table th {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
  position: sticky;
  top: 0;
  z-index: 1;
}

.table tr:nth-child(even) td {
  background: #fafafa;
}

.table-empty {
  text-align: center;
  color: #777;
  padding: 20px;
  font-weight: 500;
}

.clip {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.th-company {
  width: 60%;
}

.th-name {
  width: 70%;
}

.th-number {
  width: 30%;
}

/* Responsive */
@media (max-width: 900px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-group {
    justify-content: center;
  }

  .filter-actions {
    margin-right: 0;
    justify-content: center;
  }

  .tabs {
    justify-content: center;
  }

  .summary-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .tables-section {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .content-wrapper {
    padding: 16px;
  }

  .card {
    padding: 16px;
  }

  .table th,
  .table td {
    padding: 8px;
  }
}
</style>
