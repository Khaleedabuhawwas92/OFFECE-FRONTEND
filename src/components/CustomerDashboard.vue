<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";
import PreviewModal from "./dashboard/PreviewModal.vue";

const router = useRouter();
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

const activeTab = ref("invoices");
const invoices = ref([]);
const waybills = ref([]);
const loadingInvoices = ref(false);
const loadingWaybills = ref(false);
const errorMessage = ref("");

const previewOpen = ref(false);
const previewTitle = ref("");
const previewHtml = ref("");
const previewFileName = ref("");
const invoiceTemplateCache = ref(null);
const waybillTemplateCache = ref(null);

function handleLogout() {
  localStorage.removeItem("auth_token");
  router.push("/customer/login");
}

function getWaybillVehicleNo(wb) {
  return (
    wb?.VEHICLE_NO ||
    wb?.vehicle_no ||
    wb?.VEHICLE1_NO ||
    wb?.vehicle1_no ||
    ""
  );
}

function fillTemplate(template, obj) {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    const v = obj[key] ?? obj[key.toUpperCase()] ?? obj[key.toLowerCase()] ?? "";
    return v == null ? "" : String(v);
  });
}

function esc(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function splitJod(n) {
  const x = Number(n || 0);
  return { dinar: Math.floor(x), fils: Math.round((x - Math.floor(x)) * 1000) };
}

function asVerticalList(arr, dir = "rtl") {
  const clean = (arr || []).map((x) => String(x ?? "").trim()).filter(Boolean);
  if (!clean.length) return "";
  return clean.map((x) => `<span class="v-line" dir="${dir}">${esc(x)}</span>`).join("");
}

function splitSlashList(v) {
  return String(v || "").split("/").map((s) => s.trim()).filter(Boolean);
}

async function openInvoicePreview(inv) {
  try {
    if (!invoiceTemplateCache.value) {
      const resp = await fetch("/invoice_template.html");
      if (!resp.ok) throw new Error("Invoice template not found");
      invoiceTemplateCache.value = await resp.text();
    }
    const totalNumber = Number(inv.value_jod || 0);
    const parts = splitJod(totalNumber);
    let driverNamesArr = [];
    let vehicleNosArr = [];
    if (Array.isArray(inv.driver_names_snapshot) && inv.driver_names_snapshot.length) {
      driverNamesArr = inv.driver_names_snapshot.filter(Boolean);
    } else if (inv.driver_name_snapshot || inv.DRIVER_NAME || inv.driver_name) {
      driverNamesArr = splitSlashList(inv.driver_name_snapshot || inv.DRIVER_NAME || inv.driver_name);
    }
    if (Array.isArray(inv.vehicle_numbers_snapshot) && inv.vehicle_numbers_snapshot.length) {
      vehicleNosArr = inv.vehicle_numbers_snapshot.filter(Boolean);
    } else if (inv.vehicle_no_snapshot || inv.VEHICLE_NO || inv.vehicle_no) {
      vehicleNosArr = splitSlashList(inv.vehicle_no_snapshot || inv.VEHICLE_NO || inv.vehicle_no);
    }
    const items = Array.isArray(inv.items) ? inv.items : [];
    let itemsRowsHtml = items.map((it) => {
      const desc = esc(it?.desc || "");
      const hasDesc = desc.trim().length > 0;
      const hasAmount = String(it?.amount ?? "").trim().length > 0;
      if (!hasDesc && !hasAmount) return "";
      const amt = Number(it?.amount ?? 0);
      const cur = esc(it?.currency || "JOD");
      const rate = Number(it?.rate_to_jod ?? 1);
      const jodCalc = Number(it?.amount_jod);
      const jod = Number.isFinite(jodCalc) ? jodCalc : amt * rate;
      return `<tr><td>${desc}</td><td>النقل البري للبضائع</td><td dir="ltr">${Number.isFinite(amt) ? amt.toFixed(3) : ""}</td><td dir="ltr">${cur}</td><td dir="ltr">${Number.isFinite(rate) ? rate.toFixed(4) : ""}</td><td dir="ltr">${Number.isFinite(jod) ? Number(jod).toFixed(3) : ""}</td></tr>`;
    }).filter(Boolean).join("");
    if (!itemsRowsHtml.trim()) {
      const legacyLines = [inv.details_line1 ?? inv.DETAILS_LINE1, inv.details_line2 ?? inv.DETAILS_LINE2, inv.extra_details ?? inv.EXTRA_DETAILS].filter((x) => String(x || "").trim());
      if (legacyLines.length) {
        itemsRowsHtml = legacyLines.map((line) => `<tr><td>${esc(line)}</td><td>النقل البري للبضائع</td><td dir="ltr"></td><td dir="ltr"></td><td dir="ltr"></td><td dir="ltr"></td></tr>`).join("");
      } else {
        itemsRowsHtml = `<tr><td colspan="6" style="text-align:center;font-weight:800;">لا يوجد بنود</td></tr>`;
      }
    }
    const data = {
      COMPANY: esc(inv.company || inv.COMPANY || "—"),
      INVOICE_NO: inv.invoice_number || "",
      DATE: inv.date || "",
      DRIVER_NAME: driverNamesArr.length ? asVerticalList(driverNamesArr, "rtl") : "—",
      VEHICLE_NO: vehicleNosArr.length ? asVerticalList(vehicleNosArr, "ltr") : "—",
      ITEMS_ROWS: itemsRowsHtml,
      NOTES: esc(inv.notes || ""),
      DINAR: parts.dinar, FILS: parts.fils,
      TOTAL_DINAR: parts.dinar, TOTAL_FILS: parts.fils,
    };
    previewHtml.value = fillTemplate(invoiceTemplateCache.value, data);
    previewTitle.value = `فاتورة رقم ${inv.invoice_number || ""}`;
    previewFileName.value = `invoice_${inv.invoice_number || inv._id}.pdf`;
    previewOpen.value = true;
  } catch (err) {
    console.error("invoice preview error:", err);
    alert("صار خطأ بالمعاينة");
  }
}

async function fetchInvoices() {
  loadingInvoices.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/customer/invoices?limit=200`);
    invoices.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("invoices error:", err);
    errorMessage.value = "تعذّر تحميل الفواتير.";
  } finally {
    loadingInvoices.value = false;
  }
}

async function openWaybillPreview(wb) {
  try {
    if (!waybillTemplateCache.value) {
      const resp = await fetch("/waybill_template.html");
      if (!resp.ok) throw new Error("waybill_template.html not found");
      waybillTemplateCache.value = await resp.text();
    }
    let data = { ...(wb || {}) };
    const items = data?.goodsItems;
    let goodsRows = "";
    if (Array.isArray(items) && items.length) {
      goodsRows = items.map((it) => `<tr><td style="border-top:1px solid #222;border-right:1px solid #222;height:28px;text-align:center;" class="val-center">${esc(String(it.GOODS_NATURE ?? ""))}</td><td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(it.TARIFF_CODE ?? ""))}</td><td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(it.GROSS_WEIGHT ?? ""))}</td><td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(it.MARKS ?? ""))}</td><td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(it.PACKAGES_COUNT ?? ""))}</td><td style="border-top:1px solid #222;text-align:center;" class="val-center">${esc(String(it.PACKING_METHOD ?? ""))}</td></tr>`).join("");
    } else {
      goodsRows = `<tr><td style="border-top:1px solid #222;border-right:1px solid #222;height:28px;text-align:center;" class="val-center">${esc(String(data?.GOODS_NATURE ?? ""))}</td><td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.TARIFF_CODE ?? ""))}</td><td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.GROSS_WEIGHT ?? ""))}</td><td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.MARKS ?? ""))}</td><td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.PACKAGES_COUNT ?? ""))}</td><td style="border-top:1px solid #222;text-align:center;" class="val-center">${esc(String(data?.PACKING_METHOD ?? ""))}</td></tr>`;
    }
    data.GOODS_ROWS = goodsRows;
    data.STAMP_SIGNATURE_BLOCK = data.showStampSignature === true
      ? `<div style="position:relative;width:300px;height:110px;margin:0 auto;overflow:visible;">
           <img src="/images/company-stamp.png" alt="stamp" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:150px;height:auto;max-width:none;opacity:0.92;">
           <img src="/images/company-signature.png" alt="signature" style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:280px;height:auto;max-width:none;z-index:2;">
         </div>`
      : '<div style="height:14px"></div>';
    previewHtml.value = fillTemplate(waybillTemplateCache.value, data);
    previewTitle.value = `وثيقة نقل رقم ${wb.SERIAL_NO || wb.waybillNumber || ""}`;
    previewFileName.value = `waybill_${wb.SERIAL_NO || wb.waybillNumber || wb._id}.pdf`;
    previewOpen.value = true;
  } catch (err) {
    console.error("waybill preview error:", err);
    alert("صار خطأ بمعاينة البوليصة");
  }
}

async function fetchWaybills() {
  loadingWaybills.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/customer/waybills?limit=200`);
    waybills.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("waybills error:", err);
    errorMessage.value = "تعذّر تحميل وثائق النقل.";
  } finally {
    loadingWaybills.value = false;
  }
}

onMounted(() => {
  fetchInvoices();
  fetchWaybills();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="app-title">بوابة العملاء</div>
        <div class="app-subtitle">عرض الفواتير ووثائق النقل</div>
      </div>
      <div class="top-actions">
        <button class="btn btn--secondary btn--small" @click="handleLogout">
          🔒 خروج
        </button>
      </div>
    </header>

    <nav class="tabs">
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'invoices' }"
        @click="activeTab = 'invoices'"
      >
        <span class="tab-label">فواتيري</span>
        <span class="tab-badge">{{ invoices.length }}</span>
      </button>
      <button
        class="tab"
        :class="{ 'tab--active': activeTab === 'waybills' }"
        @click="activeTab = 'waybills'"
      >
        <span class="tab-label">بوالصي</span>
        <span class="tab-badge">{{ waybills.length }}</span>
      </button>
    </nav>

    <div class="main-area">
      <div v-if="errorMessage" class="alert alert--danger">
        {{ errorMessage }}
      </div>

      <section v-if="activeTab === 'invoices'" class="section">
        <div class="section-header">
          <h2 class="section-title">فواتيري</h2>
          <button
            class="btn btn--secondary btn--small"
            @click="fetchInvoices"
            :disabled="loadingInvoices"
          >
            🔄 تحديث
          </button>
        </div>
        <div v-if="loadingInvoices" class="status-text">جاري تحميل الفواتير...</div>
        <div v-else class="table-card">
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr><th>رقم الفاتورة</th><th>التاريخ</th><th>الشركة</th><th>القيمة (JOD)</th><th>عمليات</th></tr>
              </thead>
              <tbody>
                <tr v-for="inv in invoices" :key="inv._id">
                  <td>{{ inv.invoice_number }}</td>
                  <td>{{ inv.date }}</td>
                  <td :title="inv.company">{{ inv.company }}</td>
                  <td>{{ Number(inv.value_jod || 0).toFixed(3) }}</td>
                  <td>
                    <button class="btn btn--secondary btn--small" @click="openInvoicePreview(inv)">
                      🖨 معاينة / طباعة
                    </button>
                  </td>
                </tr>
                <tr v-if="invoices.length === 0">
                  <td colspan="5" class="table-empty">لا توجد فواتير.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section v-if="activeTab === 'waybills'" class="section">
        <div class="section-header">
          <h2 class="section-title">بوالصي</h2>
          <button
            class="btn btn--secondary btn--small"
            @click="fetchWaybills"
            :disabled="loadingWaybills"
          >
            🔄 تحديث
          </button>
        </div>
        <div v-if="loadingWaybills" class="status-text">جاري تحميل وثائق النقل...</div>
        <div v-else class="table-card">
          <div class="table-scroll">
            <table class="table">
              <thead>
                <tr><th>الرقم</th><th>التاريخ</th><th>المرسل</th><th>المستلم</th><th>رقم المركبة</th><th>عمليات</th></tr>
              </thead>
              <tbody>
                <tr v-for="wb in waybills" :key="wb._id">
                  <td>{{ wb.SERIAL_NO || wb.waybillNumber || "—" }}</td>
                  <td>{{ wb.DATE || "—" }}</td>
                  <td :title="wb.CONSIGNOR_NAME">{{ wb.CONSIGNOR_NAME || "—" }}</td>
                  <td :title="wb.CONSIGNEE_NAME">{{ wb.CONSIGNEE_NAME || "—" }}</td>
                  <td dir="ltr">{{ getWaybillVehicleNo(wb) || "—" }}</td>
                  <td>
                    <button class="btn btn--secondary btn--small" @click="openWaybillPreview(wb)">
                      🖨 معاينة / طباعة
                    </button>
                  </td>
                </tr>
                <tr v-if="waybills.length === 0">
                  <td colspan="6" class="table-empty">لا توجد وثائق نقل.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>

    <PreviewModal
      v-if="previewOpen"
      :title="previewTitle"
      :html="previewHtml"
      :file-name="previewFileName"
      @close="previewOpen = false"
    />
  </div>
</template>
<style scoped>
.page { min-height: 100vh; background: #f3f4f6; direction: rtl; font-family: "Segoe UI", Tahoma, sans-serif; }
.topbar { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
.brand { display: flex; flex-direction: column; gap: 2px; }
.app-title { font-weight: 800; font-size: 18px; color: #111827; }
.app-subtitle { font-size: 12px; color: #6b7280; }
.top-actions { display: flex; gap: 10px; align-items: center; }
.tabs { display: flex; gap: 8px; padding: 14px 18px; background: #fff; border-bottom: 1px solid #e5e7eb; }
.tab { border: 1px solid #e5e7eb; background: #f9fafb; padding: 8px 14px; border-radius: 12px; cursor: pointer; font-weight: 700; display: flex; gap: 8px; align-items: center; font-size: 14px; }
.tab--active { background: #1976d2; color: #fff; border-color: #1976d2; }
.tab-badge { background: rgba(255,255,255,0.25); padding: 2px 8px; border-radius: 999px; font-size: 12px; }
.tab--active .tab-badge { background: rgba(255,255,255,0.35); }
.main-area { padding: 14px 18px; }
.alert { padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; font-weight: 700; font-size: 14px; }
.alert--danger { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
.section { margin-bottom: 16px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.section-title { margin: 0; font-size: 16px; font-weight: 800; color: #111827; }
.status-text { padding: 14px; color: #374151; font-weight: 700; }
.table-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
.table-scroll { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { padding: 10px 12px; text-align: right; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
.table th { background: #f9fafb; font-weight: 700; color: #374151; font-size: 12px; }
.table tbody tr:hover { background: #f9fafb; }
.table-empty { text-align: center; color: #6b7280; padding: 20px; }
.btn { padding: 8px 12px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; font-weight: 700; font-size: 13px; }
.btn--secondary { background: #f3f4f6; border-color: #e5e7eb; color: #374151; }
.btn--small { padding: 6px 10px; font-size: 12px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
