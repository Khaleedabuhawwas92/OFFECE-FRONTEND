<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import axios from "axios";
import PreviewModal from "./dashboard/PreviewModal.vue";

const props = defineProps({
  apiBase: { type: String, required: true },
});

const emit = defineEmits(["close", "saved"]);

const loading = ref(false);
const openPreview = ref(false);
const previewHtml = ref("");
const invoiceTemplateCache = ref(null);
const modalRef = ref(null);

/* =========================
   E-Invoicing (JoFotara) ✅ NEW
========================= */
const lastSavedInvoice = ref(null);
const einvLoading = ref(false);
const einvResult = ref(null);
const einvError = ref("");
const activeTab = ref("local"); // 'local' | 'einv'

/* =========================
   Drivers
========================= */
const drivers = ref([]);
const loadingDrivers = ref(false);
const driverQuery = ref("");
const showDriverList = ref(false);

/* =========================
   Consignors
========================= */
const consignors = ref([]);
const loadingConsignors = ref(false);
const consignorQuery = ref("");
const showConsignorList = ref(false);
const selectedConsignor = ref(null);

const form = ref({
  date: new Date().toISOString().slice(0, 10),
  company: "",
  consignor_id: "",
  driver_ids: [],
  items: [
    { itemId: "", activityClassification: "", desc: "", quantity: 1, unitPrice: 0, discount: 0, taxMode: "EXEMPT", taxCategory: "O", taxPercent: 0, taxAmount: 0, lineNet: 0, amount_jod: 0 },
  ],
  notes: "",

  // بيانات الفوترة الإلكترونية
  einv: {
    invoiceScope: "LOCAL",
    paymentType: "CASH",
    incomeSourceSeq: "1379984",
    currency: "JOD",
    buyerIdType: "TIN",
    buyerId: "",
    buyerTaxNo: "",
    buyerName: "",
    buyerCityCode: "",
    buyerCity: "",
    buyerPhone: "",
    buyerPostalCode: "",
  },
});

/* =========================
   Fetch
========================= */
async function fetchDrivers() {
  loadingDrivers.value = true;
  try {
    const res = await axios.get(`${props.apiBase}/api/drivers`);
    drivers.value = Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error("drivers error:", e);
    drivers.value = [];
  } finally {
    loadingDrivers.value = false;
  }
}

async function fetchConsignors() {
  loadingConsignors.value = true;
  try {
    const res = await axios.get(`${props.apiBase}/api/consignors`);
    consignors.value = Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error("consignors error:", e);
    consignors.value = [];
  } finally {
    loadingConsignors.value = false;
  }
}

onMounted(async () => {
  await Promise.all([fetchDrivers(), fetchConsignors()]);
});

/* =========================
   Field readers
========================= */
function getVehicleNo(d) {
  return (
    d?.VEHICLE_NO ??
    d?.vehicle_no ??
    d?.plate_no ??
    d?.PLATE_NO ??
    d?.car_no ??
    d?.CAR_NO ??
    d?.VEHICLE ??
    d?.vehicle ??
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
    ""
  );
}

function getConsignorName(c) {
  return (
    c?.name ??
    c?.NAME ??
    c?.consignor_name ??
    c?.CONSIGNOR_NAME ??
    c?.company ??
    c?.COMPANY ??
    c?.title ??
    c?.TITLE ??
    ""
  );
}

/* =========================
   Close helpers
========================= */
function close() {
  emit("close");
}

function onKeydown(e) {
  if (e.key === "Escape") close();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

function onBackdropClick(e) {
  if (e.target?.classList?.contains("modal-backdrop")) close();
}

/* =========================
   Rates
========================= */
const RATES_TO_JOD = {
  JOD: 1,
  USD: 0.709,
  EUR: 0.77,
  SAR: 0.189,
  AED: 0.193,
};

/* =========================
   Items (Rows)
========================= */
function makeEmptyItem() {
  return {
    itemId: "",
    activityClassification: "النقل البري للبضائع",
    desc: "",
    quantity: 1,
    unitPrice: 0,
    discount: 0,
    taxMode: "EXEMPT",
    taxCategory: "O",
    taxPercent: 0,
    taxAmount: 0,
    lineNet: 0,
    currency: "JOD",
    rate_to_jod: 1,
    amount_jod: 0,
  };
}

function addItemRow() {
  form.value.items.push(makeEmptyItem());
}

function removeItemRow(i) {
  if (form.value.items.length === 1) return;
  form.value.items.splice(i, 1);
}

function onItemEnter(i, e) {
  e.preventDefault();
  form.value.items.splice(i + 1, 0, makeEmptyItem());
  requestAnimationFrame(() => {
    const el = document.querySelector(`#item-desc-${i + 1}`);
    el?.focus();
  });
}

function recalcItem(it) {
  const qty = Number(it?.quantity || 0);
  const up = Number(it?.unitPrice || 0);
  const disc = Number(it?.discount || 0);
  const gross = qty * up;
  const lineNet = Math.max(0, gross - disc);
  it.lineNet = Number(lineNet.toFixed(3));
  const rate = Number(it?.rate_to_jod || 1);
  it.amount_jod = Number((lineNet * rate).toFixed(3));
}

function onItemCurrencyChange(it) {
  it.rate_to_jod = RATES_TO_JOD[it.currency] ?? 1;
  recalcItem(it);
}

const itemsTotal = computed(() => {
  return (form.value.items || []).reduce((sum, it) => {
    const n = parseFloat(it?.amount_jod);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
});

/* =========================
   Drivers selection
========================= */
const filteredDrivers = computed(() => {
  const q = String(driverQuery.value || "")
    .toLowerCase()
    .trim();
  const list = drivers.value || [];
  if (!q) return list;

  return list.filter((d) => {
    const vehicle = String(getVehicleNo(d)).toLowerCase();
    const name = String(getDriverName(d)).toLowerCase();
    return vehicle.includes(q) || name.includes(q);
  });
});

const selectedDrivers = computed(() => {
  const ids = form.value.driver_ids || [];
  return (drivers.value || []).filter((d) => ids.includes(d._id));
});

function addDriver(d) {
  const id = d?._id;
  if (!id) return;
  if (!form.value.driver_ids.includes(id)) form.value.driver_ids.push(id);
  driverQuery.value = "";
  showDriverList.value = false;
}

function removeDriver(id) {
  form.value.driver_ids = (form.value.driver_ids || []).filter((x) => x !== id);
}

/* =========================
   Consignors selection
========================= */
const filteredConsignors = computed(() => {
  const q = String(consignorQuery.value || "")
    .toLowerCase()
    .trim();
  const list = consignors.value || [];
  if (!q) return list;

  return list.filter((c) => {
    const nm = String(getConsignorName(c)).toLowerCase();
    const code = String(c?.code ?? c?.CODE ?? "").toLowerCase();
    return nm.includes(q) || code.includes(q);
  });
});

function selectConsignor(c) {
  selectedConsignor.value = c || null;
  const name = getConsignorName(c) || "";
  form.value.company = name;
  form.value.consignor_id = c?._id || c?.id || "";
  consignorQuery.value = "";
  showConsignorList.value = false;
}

function clearConsignor() {
  selectedConsignor.value = null;
  form.value.company = "";
  form.value.consignor_id = "";
}

/* =========================
   Helpers
========================= */
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

function fillTemplate(template, obj) {
  const map = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const ks = String(k);
    map[ks] = v;
    map[ks.toUpperCase()] = v;
    map[ks.toLowerCase()] = v;
    map[ks.replace(/[^\w]/g, "")] = v;
  }

  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey) => {
    const key = String(rawKey).trim();
    const clean = key.replace(/[^\w]/g, "");
    const val = map[key] ?? map[clean] ?? "";
    return val == null ? "" : String(val);
  });
}

function validate() {
  if (!form.value.date) return "التاريخ مطلوب";
  if (!String(form.value.company || "").trim())
    return "اسم العميل / الشركة مطلوب";

  const okItems = (form.value.items || []).some((it) => {
    const hasDesc = String(it?.desc || "").trim().length > 0;
    const qty = Number(it?.quantity || 0);
    const up = Number(it?.unitPrice || 0);
    const net = Number(it?.amount_jod || it?.lineNet || 0);
    return hasDesc && qty > 0 && up > 0 && net > 0;
  });
  if (!okItems) return "أدخل تفصيلة واحدة على الأقل (وصف + مبلغ)";

  if (activeTab.value !== "local") {
    const e = form.value.einv || {};
    if (!String(e.invoiceType || "").trim())
      return "نوع الفاتورة الإلكترونية مطلوب";
    if (!String(e.incomeSourceSeq || "").trim())
      return "تسلسل مصدر الدخل مطلوب";
    if (!String(e.currency || "").trim())
      return "عملة الفاتورة الإلكترونية مطلوبة";
    if (!(form.value.driver_ids || []).length)
      return "اكتب رقم السيارة واختر السائق";
  }

  return "";
}

/* =========================
   Preview
========================= */
async function buildPreview() {
  const err = validate();
  if (err) return alert(err);

  if (!invoiceTemplateCache.value) {
    const resp = await fetch("/invoice_template.html");
    if (!resp.ok) return alert("invoice_template.html مش موجود داخل public");
    invoiceTemplateCache.value = await resp.text();
  }

  (form.value.items || []).forEach((it) => recalcItem(it));

  const totalNumber = Number(itemsTotal.value || 0);
  const parts = splitJod(totalNumber);

  const itemsRowsHtml = (form.value.items || [])
    .filter(
      (x) => String(x?.desc || "").trim() || String(x?.amount || "").trim(),
    )
    .map((it) => {
      const escDesc = String(it?.desc || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const escClass = String(it?.activityClassification || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      const amt = Number(it?.amount ?? 0);
      const rate = Number(it?.rate_to_jod ?? 1);
      const jod = Number(it?.amount_jod ?? 0);

      const amtStr = Number.isFinite(amt) ? amt.toFixed(3) : "";
      const rateStr = Number.isFinite(rate) ? rate.toFixed(4) : "";
      const jodStr = Number.isFinite(jod) ? jod.toFixed(3) : "";

      return `<tr>
        <td>${escDesc}</td>
        <td>النقل البري للبضائع</td>
        <td dir="ltr">${amtStr}</td>
        <td dir="ltr">${String(it?.currency || "")}</td>
        <td dir="ltr">${rateStr}</td>
        <td dir="ltr">${jodStr}</td>
      </tr>`;
    })
    .join("");

  const driverNamesArr = (selectedDrivers.value || [])
    .map(getDriverName)
    .filter(Boolean);
  const vehicleNosArr = (selectedDrivers.value || [])
    .map(getVehicleNo)
    .filter(Boolean);

  const esc = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  const asVerticalList = (arr, dir = "rtl") => {
    const clean = (arr || []).map((x) => esc(x)).filter((x) => x.trim());
    if (!clean.length) return "—";
    return clean
      .map((x) => `<span class="v-line" dir="${dir}">${x}</span>`)
      .join("");
  };

  const data = {
    INVOICE_NO: lastSavedInvoice.value?.invoice_number || "—",
    DATE: form.value.date || "",
    COMPANY: esc(form.value.company || ""),
    DRIVER_NAME: asVerticalList(driverNamesArr, "rtl"),
    VEHICLE_NO: asVerticalList(vehicleNosArr, "ltr"),
    ITEMS_ROWS:
      itemsRowsHtml ||
      `<tr><td colspan="6" style="text-align:center;font-weight:800">لا يوجد بنود</td></tr>`,
    NOTES: esc(form.value.notes || ""),
    DINAR: parts.dinar,
    FILS: parts.fils,
    TOTAL_DINAR: parts.dinar,
    TOTAL_FILS: parts.fils,
  };

  previewHtml.value = fillTemplate(invoiceTemplateCache.value, data);
  openPreview.value = true;
}

function printPreview() {
  const iframe = modalRef.value?.frameRef;
  const w = iframe?.contentWindow;
  if (w) {
    w.focus();
    w.print();
  }
}

/* =========================
   Save (returns saved invoice)
   Supports both create and update
========================= */
async function saveInvoice({ submitToEInv = false } = {}) {
  const err = validate();
  if (err) {
    alert(err);
    throw new Error(err);
  }

  loading.value = true;
  einvError.value = "";
  try {
    (form.value.items || []).forEach((it) => recalcItem(it));

    const payload = {
      submitToEInv,
      date: form.value.date,
      company: form.value.company,
      consignor_id: form.value.consignor_id || undefined,
      driver_ids: form.value.driver_ids,
      items: (form.value.items || []).map((it, i) => ({
        itemId: String(i + 1),
        activityClassification: "النقل البري للبضائع",
        desc: it?.desc ?? "",
        quantity: Number(it?.quantity ?? 1),
        unitPrice: Number(it?.unitPrice ?? 0),
        discount: Number(it?.discount ?? 0),
        taxMode: it?.taxMode ?? "EXEMPT",
        taxCategory: it?.taxCategory ?? "O",
        taxPercent: Number(it?.taxPercent ?? 0),
        taxAmount: Number(it?.taxAmount ?? 0),
        lineNet: Number(it?.lineNet ?? 0),
        amount_jod: Number(it?.amount_jod ?? 0),
        amount: it?.amount,
        currency: it?.currency,
        rate_to_jod: it?.rate_to_jod,
      })),
      value_jod: Number(itemsTotal.value.toFixed(3)),
      notes: form.value.notes,
      einv: {
        invoiceScope: form.value.einv?.invoiceScope ?? "LOCAL",
        paymentType: form.value.einv?.paymentType ?? "CASH",
        incomeSourceSeq: form.value.einv?.incomeSourceSeq ?? "1379984",
        currency: form.value.einv?.currency ?? "JOD",
        buyerIdType: form.value.einv?.buyerIdType ?? "TIN",
        buyerId: form.value.einv?.buyerId ?? "",
        buyerTaxNo: form.value.einv?.buyerTaxNo ?? "",
        buyerName: form.value.company || "",
        buyerCityCode: form.value.einv?.buyerCityCode ?? "",
        buyerCity: form.value.einv?.buyerCity ?? "",
        buyerPhone: form.value.einv?.buyerPhone ?? "",
        buyerPostalCode: form.value.einv?.buyerPostalCode ?? "",
      },
    };

    const existingId = lastSavedInvoice.value?._id || lastSavedInvoice.value?.id;
    let res;
    if (existingId) {
      res = await axios.put(`${props.apiBase}/api/invoices/${existingId}`, payload);
    } else {
      res = await axios.post(`${props.apiBase}/api/invoices`, payload);
    }

    lastSavedInvoice.value = res?.data || null;

    emit("saved", lastSavedInvoice.value);
    return lastSavedInvoice.value;
  } catch (e) {
    console.error(e);
    alert("❌ فشل الحفظ. تأكد أن السيرفر شغال.");
    throw e;
  } finally {
    loading.value = false;
  }
}

/* =========================
   Local save only
========================= */
async function saveLocal() {
  einvError.value = "";
  einvResult.value = null;
  try {
    await saveInvoice({ submitToEInv: false });
    einvResult.value = { ok: true, message: "تم حفظ الفاتورة في النظام", einv_status: "draft" };
  } catch (e) {
    // error already shown in saveInvoice
  }
}

/* =========================
   Save + submit to JoFotara
========================= */
async function saveAndSend() {
  einvError.value = "";
  einvResult.value = null;

  const existingId = lastSavedInvoice.value?._id || lastSavedInvoice.value?.id;

  if (!existingId) {
    try {
      const saved = await saveInvoice({ submitToEInv: true });
      if (saved?.einv_status === "submitted") {
        einvResult.value = { ok: true, message: "تم حفظ وإرسال واعتماد الفاتورة بنجاح", einv_status: "submitted" };
      } else if (saved?.einv_status === "failed") {
        einvError.value = saved?.einv_error || "فشل إرسال الفاتورة للفوترة";
      } else {
        einvResult.value = { ok: true, message: "تم حفظ وإرسال الفاتورة", einv_status: saved?.einv_status };
      }
    } catch (e) {
      // error already shown
    }
    return;
  }

  try {
    await saveInvoice({ submitToEInv: false });
  } catch (e) {
    return;
  }

  if (lastSavedInvoice.value?.einv_status === "submitted") {
    einvResult.value = { ok: true, message: "تم إرسال واعتماد الفاتورة بنجاح", einv_status: "submitted" };
    return;
  }

  einvLoading.value = true;
  try {
    const res = await axios.post(`${props.apiBase}/api/einv/submit`, {
      invoiceId: existingId,
    });
    einvResult.value = res?.data || null;
  } catch (e) {
    const data = e?.response?.data;
    if (e?.response?.status === 409 && data?.einv_status === "submitted") {
      einvResult.value = { ok: true, message: "تم إرسال واعتماد الفاتورة بنجاح", einv_status: "submitted" };
    } else {
      console.error(data || e);
      einvError.value = data?.error || e?.message || "فشل الإرسال";
    }
  } finally {
    einvLoading.value = false;
  }
}

const canSubmitEInv = computed(() => !!lastSavedInvoice.value?._id);
</script>

<template>
  <div class="modal-backdrop" @mousedown="onBackdropClick">
    <div class="modal-card" dir="rtl">
      <div class="modal-head">
        <div class="head-titles">
          <h2>➕ إنشاء فاتورة جديدة</h2>
          <p>احفظ الفاتورة ثم (اختياري) أرسلها للفوترة الأردنية</p>

          <div class="tiny" v-if="lastSavedInvoice?.invoice_number">
            رقم الفاتورة: <b>{{ lastSavedInvoice.invoice_number }}</b>
          </div>
        </div>

        <div class="head-actions">
          <button
            class="btn btn--secondary"
            type="button"
            @click="buildPreview"
          >
            👁 معاينة
          </button>

          <button class="btn btn--ghost" type="button" @click="close">✖</button>
        </div>
      </div>

      <!-- ✅ Tabs -->
      <div class="tabs-bar">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'local' }"
          type="button"
          @click="activeTab = 'local'"
        >
          💾 حفظ محلي
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'einv' }"
          type="button"
          @click="activeTab = 'einv'"
        >
          📤 إرسال للفوترة
        </button>
      </div>

      <!-- ✅ Status box -->
      <div class="status-bar" v-if="einvError || einvResult">
        <div v-if="einvError" class="status status--err">
          ❌ {{ einvError }}
        </div>

        <div v-else class="status status--ok">
          ✅ تم استقبال رد من السيرفر
          <span class="muted" v-if="einvResult?.EINV_STATUS">
            — الحالة: {{ einvResult.EINV_STATUS }}</span
          >
        </div>

        <details class="status-details" v-if="einvResult">
          <summary>عرض التفاصيل</summary>
          <pre>{{ JSON.stringify(einvResult, null, 2) }}</pre>
        </details>
      </div>

      <div class="modal-body">
        <div class="form-card">
          <h3>معلومات الفاتورة</h3>

          <div class="form-grid">
            <template v-if="activeTab === 'local'">
              <div class="form-group">
                <label>تاريخ الفاتورة</label>
                <input type="date" v-model="form.date" />
              </div>

              <div class="form-group">
                <label>اسم العميل / الشركة</label>
                <input
                  type="text"
                  v-model="form.company"
                  placeholder="اسم المشتري..."
                  @focus="showConsignorList = true; consignorQuery = ''"
                  @input="consignorQuery = form.company"
                  @keydown.esc="showConsignorList = false"
                />
                <div class="dropdown" v-if="showConsignorList">
                  <div class="dropdown-item muted" v-if="loadingConsignors">
                    جاري تحميل المرسلين...
                  </div>

                  <button
                    v-for="c in filteredConsignors"
                    :key="c._id || c.id"
                    type="button"
                    class="dropdown-item"
                    @click="selectConsignor(c)"
                  >
                    <div class="dd-row">
                      <span class="dd-main">{{ getConsignorName(c) }}</span>
                      <span class="dd-sub" v-if="c?.code || c?.CODE">{{
                        c?.code || c?.CODE
                      }}</span>
                    </div>
                  </button>

                  <div
                    class="dropdown-item muted"
                    v-if="!loadingConsignors && filteredConsignors.length === 0"
                  >
                    لا يوجد نتائج
                  </div>
                </div>
              </div>
            </template>

            <template v-else>
              <div class="form-group">
                <label>نطاق الفاتورة</label>
                <select v-model="form.einv.invoiceScope">
                  <option value="LOCAL">محلية</option>
                  <option value="EXPORT">تصدير</option>
                </select>
              </div>

              <div class="form-group">
                <label>نوع الفاتورة</label>
                <select v-model="form.einv.paymentType">
                  <option value="CASH">نقدية</option>
                  <option value="CREDIT">ذمم</option>
                </select>
              </div>

              <div class="form-group">
                <label>تاريخ الفاتورة</label>
                <input type="date" v-model="form.date" />
              </div>

              <div class="form-group">
                <label>العملة</label>
                <select v-model="form.einv.currency">
                  <option value="JOD">JOD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                </select>
              </div>

              <div class="form-group">
                <label>تسلسل مصدر الدخل</label>
                <input type="text" v-model="form.einv.incomeSourceSeq" placeholder="مثال: 1379984" />
              </div>

              <div class="form-group">
                <label>المرسل (اسم الشركة) — من الداتا بيس</label>

                <div class="chips" v-if="selectedConsignor">
                  <span class="chip">
                    {{ getConsignorName(selectedConsignor) }}
                    <button type="button" class="chip-x" @click="clearConsignor">
                      ×
                    </button>
                  </span>
                </div>

                <input
                  type="text"
                  v-model="consignorQuery"
                  placeholder="ابحث عن المرسل..."
                  @focus="showConsignorList = true"
                  @keydown.esc="showConsignorList = false"
                />

                <div class="dropdown" v-if="showConsignorList">
                  <div class="dropdown-item muted" v-if="loadingConsignors">
                    جاري تحميل المرسلين...
                  </div>

                  <button
                    v-for="c in filteredConsignors"
                    :key="c._id || c.id"
                    type="button"
                    class="dropdown-item"
                    @click="selectConsignor(c)"
                  >
                    <div class="dd-row">
                      <span class="dd-main">{{ getConsignorName(c) }}</span>
                      <span class="dd-sub" v-if="c?.code || c?.CODE">{{
                        c?.code || c?.CODE
                      }}</span>
                    </div>
                  </button>

                  <div
                    class="dropdown-item muted"
                    v-if="!loadingConsignors && filteredConsignors.length === 0"
                  >
                    لا يوجد نتائج
                  </div>
                </div>
              </div>

              <div class="form-group">
                <label>ابحث برقم السيارة (اللوحة) واختر السائق</label>

                <div class="chips" v-if="selectedDrivers.length">
                  <span class="chip" v-for="d in selectedDrivers" :key="d._id">
                    {{ getVehicleNo(d) }} - {{ getDriverName(d) }}
                    <button
                      type="button"
                      class="chip-x"
                      @click="removeDriver(d._id)"
                    >
                      ×
                    </button>
                  </span>
                </div>

                <input
                  type="text"
                  v-model="driverQuery"
                  placeholder="اكتب رقم السيارة للبحث..."
                  @focus="showDriverList = true"
                  @keydown.esc="showDriverList = false"
                />

                <div class="dropdown" v-if="showDriverList">
                  <div class="dropdown-item muted" v-if="loadingDrivers">
                    جاري تحميل السواقين...
                  </div>

                  <button
                    v-for="d in filteredDrivers"
                    :key="d._id"
                    type="button"
                    class="dropdown-item"
                    @click="addDriver(d)"
                  >
                    <div class="dd-row">
                      <span class="dd-main">{{ getVehicleNo(d) }}</span>
                      <span class="dd-sub">{{ getDriverName(d) }}</span>
                    </div>
                  </button>

                  <div
                    class="dropdown-item muted"
                    v-if="!loadingDrivers && filteredDrivers.length === 0"
                  >
                    لا يوجد نتائج
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="form-card">
          <h3>تفاصيل البنود</h3>

          <div class="items-wrap">
            <div v-if="activeTab === 'local'" class="items-table items-table-local">
              <div class="items-head items-head-local">
                <div>الوصف</div>
                <div>الكمية</div>
                <div>سعر الوحدة</div>
                <div>الخصم</div>
                <div>العملة</div>
                <div>نسبة التحويل</div>
                <div>الإجمالي بالعملة</div>
                <div>الإجمالي JOD</div>
                <div></div>
              </div>

              <div class="items-row items-row-local" v-for="(it, i) in form.items" :key="i">
                <input
                  :id="`item-desc-${i}`"
                  type="text"
                  v-model="it.desc"
                  placeholder="مثال: أجور نقل / رسوم بوليصة..."
                  @keydown.enter="onItemEnter(i, $event)"
                />

                <input
                  type="number"
                  v-model="it.quantity"
                  placeholder="1"
                  min="0"
                  step="1"
                  @input="recalcItem(it)"
                />

                <input
                  type="number"
                  v-model="it.unitPrice"
                  placeholder="0"
                  min="0"
                  step="0.001"
                  @input="recalcItem(it)"
                />

                <input
                  type="number"
                  v-model="it.discount"
                  placeholder="0"
                  min="0"
                  step="0.001"
                  @input="recalcItem(it)"
                />

                <select v-model="it.currency" @change="onItemCurrencyChange(it)">
                  <option value="JOD">JOD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                </select>

                <input type="number" :value="it.rate_to_jod" disabled />

                <input type="number" :value="it.lineNet" disabled />

                <input type="number" :value="it.amount_jod" disabled />

                <button
                  type="button"
                  class="btn btn--danger btn--small"
                  @click="removeItemRow(i)"
                  title="حذف السطر"
                >
                  ×
                </button>
              </div>
            </div>

            <div v-else class="items-table">
              <div class="items-head">
                <div>التصنيف الوطني</div>
                <div>الوصف</div>
                <div>الكمية</div>
                <div>سعر الوحدة</div>
                <div>الخصم</div>
                <div>نوع الضريبة</div>
                <div>نسبة الضريبة</div>
                <div>قيمة الضريبة</div>
                <div>صافي البند</div>
                <div>العملة</div>
                <div>نسبة التحويل</div>
                <div>الإجمالي بالعملة</div>
                <div>الإجمالي JOD</div>
                <div></div>
              </div>

              <div class="items-row" v-for="(it, i) in form.items" :key="i">
                <input
                  type="text"
                  :value="it.activityClassification || 'النقل البري للبضائع'"
                  readonly
                  tabindex="-1"
                />

                <input
                  :id="`item-desc-${i}`"
                  type="text"
                  v-model="it.desc"
                  placeholder="مثال: أجور نقل / رسوم بوليصة..."
                  @keydown.enter="onItemEnter(i, $event)"
                />

                <input
                  type="number"
                  v-model="it.quantity"
                  placeholder="1"
                  min="0"
                  step="1"
                  @input="recalcItem(it)"
                />

                <input
                  type="number"
                  v-model="it.unitPrice"
                  placeholder="0"
                  min="0"
                  step="0.001"
                  @input="recalcItem(it)"
                />

                <input
                  type="number"
                  v-model="it.discount"
                  placeholder="0"
                  min="0"
                  step="0.001"
                  @input="recalcItem(it)"
                />

                <select v-model="it.taxMode">
                  <option value="EXEMPT">معفى</option>
                  <option value="ZERO">صفرية</option>
                  <option value="STANDARD">خاضع</option>
                  <option value="SPECIAL">خاصة</option>
                </select>

                <input
                  type="number"
                  v-model="it.taxPercent"
                  placeholder="0"
                  min="0"
                  step="0.01"
                />

                <input type="number" :value="it.taxAmount" disabled />

                <input type="number" :value="it.lineNet" disabled />

                <select v-model="it.currency" @change="onItemCurrencyChange(it)">
                  <option value="JOD">JOD</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="SAR">SAR</option>
                  <option value="AED">AED</option>
                </select>

                <input type="number" :value="it.rate_to_jod" disabled />

                <input type="number" :value="it.lineNet" disabled />

                <input type="number" :value="it.amount_jod" disabled />

                <button
                  type="button"
                  class="btn btn--danger btn--small"
                  @click="removeItemRow(i)"
                  title="حذف السطر"
                >
                  ×
                </button>
              </div>
            </div>
          </div>

          <div class="items-actions">
            <button
              type="button"
              class="btn btn--secondary"
              @click="addItemRow"
            >
              ➕ إضافة سطر
            </button>

            <div class="items-total">
              <span>المجموع:</span>
              <strong>{{ itemsTotal.toFixed(3) }}</strong>
              <span>JOD</span>
            </div>
          </div>
        </div>

        <div class="form-card" v-if="activeTab === 'einv'">
          <h3>بيانات المشتري</h3>
          <div class="form-grid">
            <div class="form-group">
              <label>اسم المشتري</label>
              <div style="padding:10px 10px;background:#f3f5f8;border:1px solid #d6d9e3;border-radius:10px;font-size:13px;color:#334155;">
                {{ form.company || "—" }}
              </div>
            </div>

            <div class="form-group">
              <label>نوع الهوية</label>
              <select v-model="form.einv.buyerIdType">
                <option value="TIN">TIN</option>
                <option value="NIN">NIN</option>
                <option value="OTHER">OTHER</option>
              </select>
            </div>

            <div class="form-group">
              <label>رقم الهوية / التعريف</label>
              <input type="text" v-model="form.einv.buyerId" placeholder="" />
            </div>

            <div class="form-group">
              <label>الرقم الضريبي</label>
              <input type="text" v-model="form.einv.buyerTaxNo" placeholder="" />
            </div>

            <div class="form-group">
              <label>كود المدينة</label>
              <input type="text" v-model="form.einv.buyerCityCode" placeholder="" />
            </div>

            <div class="form-group">
              <label>المدينة</label>
              <input type="text" v-model="form.einv.buyerCity" placeholder="" />
            </div>

            <div class="form-group">
              <label>رقم الهاتف</label>
              <input type="text" v-model="form.einv.buyerPhone" placeholder="" />
            </div>

            <div class="form-group">
              <label>الرمز البريدي</label>
              <input type="text" v-model="form.einv.buyerPostalCode" placeholder="" />
            </div>
          </div>
        </div>

        <div class="form-card">
          <h3>ملاحظات</h3>
          <div class="form-grid two">
            <div class="form-group">
              <label>ملاحظات</label>
              <input type="text" v-model="form.notes" placeholder="اختياري" />
            </div>
          </div>
        </div>
      </div>

      <div class="modal-foot">
        <button class="btn btn--secondary" type="button" @click="buildPreview">
          👁 معاينة
        </button>

        <button
          v-if="activeTab === 'local'"
          class="btn btn--primary"
          type="button"
          :disabled="loading"
          @click="saveLocal"
        >
          <span v-if="loading">⏳</span>
          <span v-else>💾 حفظ الفاتورة</span>
        </button>

        <button
          v-else
          class="btn btn--einvoicing"
          type="button"
          :disabled="einvLoading || loading"
          @click="saveAndSend"
        >
          <span v-if="einvLoading || loading">⏳</span>
          <span v-else>💾📤 حفظ وإرسال للفوترة</span>
        </button>
      </div>

      <PreviewModal
        v-if="openPreview"
        ref="modalRef"
        title="معاينة الفاتورة"
        :html="previewHtml"
        @close="openPreview = false"
        @print="printPreview"
      />
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  z-index: 9999;
}

.modal-card {
  width: min(1100px, 100%);
  max-height: calc(100vh - 32px);
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-head {
  padding: 14px 16px;
  border-bottom: 1px solid #eef2f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  background: #fbfcfe;
}

.head-titles h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}
.head-titles p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 12px;
}
.tiny {
  margin-top: 6px;
  font-size: 12px;
  color: #334155;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

/* ✅ Tabs */
.tabs-bar {
  display: flex;
  gap: 0;
  border-bottom: 1px solid #e2e6ec;
  background: #fbfcfe;
}
.tab-btn {
  flex: 1;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 800;
  border: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  border-bottom: 3px solid transparent;
  transition: all 0.15s ease;
}
.tab-btn:hover {
  background: #f1f5f9;
  color: #334155;
}
.tab-btn.active {
  color: #0f766e;
  border-bottom-color: #0f766e;
  background: #fff;
}

.status-bar {
  padding: 10px 16px;
  border-bottom: 1px solid #eef2f7;
  background: #fff;
}
.status {
  padding: 10px 12px;
  border-radius: 10px;
  font-weight: 800;
  font-size: 13px;
  border: 1px solid transparent;
}
.status--err {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #9f1239;
}
.status--ok {
  background: #ecfdf5;
  border-color: #bbf7d0;
  color: #065f46;
}
.muted {
  color: #64748b;
  font-weight: 700;
}
.status-details {
  margin-top: 10px;
}
.status-details pre {
  margin: 10px 0 0;
  background: #0b1020;
  color: #e2e8f0;
  padding: 10px 12px;
  border-radius: 10px;
  overflow: auto;
  font-size: 12px;
}

.modal-body {
  padding: 14px 16px;
  overflow: auto;
  background: #f6f7fb;
}

.form-card {
  background: #fff;
  border: 1px solid #e6e8ef;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
}

.form-card h3 {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 900;
  padding-bottom: 10px;
  border-bottom: 1px dashed #eef2f7;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  align-items: start;
}
.form-grid.two {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.form-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
  position: relative;
  margin-bottom: 10px;
}

label {
  font-size: 12px;
  font-weight: 800;
  color: #475569;
  margin-bottom: 6px;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid #d6d9e3;
  border-radius: 10px;
  padding: 10px 10px;
  font-size: 13px;
  outline: none;
  background: #fff;
  box-sizing: border-box;
}

input:focus,
textarea:focus,
select:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.12);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #f1f5ff;
  border: 1px solid #cfe0ff;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
}
.chip-x {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: #334155;
}

.dropdown {
  margin-top: 6px;
  border: 1px solid #e6e8ef;
  border-radius: 12px;
  background: #fff;
  max-height: 220px;
  overflow: auto;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
  z-index: 10;
}
.dropdown-item {
  width: 100%;
  text-align: right;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
}
.dropdown-item:hover {
  background: #f6f7fb;
}
.dropdown-item.muted {
  cursor: default;
  color: #64748b;
}
.dd-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.dd-main {
  font-weight: 900;
}
.dd-sub {
  color: #64748b;
  font-size: 12px;
  white-space: nowrap;
}

.btn {
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid transparent;
  font-weight: 800;
}
.btn--primary {
  background: #1976d2;
  color: #fff;
}
.btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn--secondary {
  background: #f5f5f5;
  border-color: #d0d0d0;
  color: #222;
}
.btn--ghost {
  background: #fff;
  border-color: #d0d0d0;
}
.btn--danger {
  background: #ffebee;
  color: #b71c1c;
  border: 1px solid #ef9a9a;
}
.btn--small {
  padding: 6px 10px;
  font-size: 12px;
}

/* ✅ NEW: JoFotara button style */
.btn--einvoicing {
  background: #0f766e;
  color: #fff;
}
.btn--einvoicing:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.items-wrap {
  overflow-x: auto;
  border: 1px solid #e6e8ef;
  border-radius: 12px;
  padding: 10px;
  background: #fbfcfe;
}
.items-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 1100px;
}
.items-head,
.items-row {
  display: grid;
  grid-template-columns: 110px 2fr 80px 100px 80px 110px 90px 90px 90px 100px 44px;
  gap: 8px;
  align-items: center;
}
.items-head {
  font-weight: 900;
  font-size: 12px;
  color: #475569;
}
.items-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.items-total {
  display: flex;
  gap: 8px;
  align-items: baseline;
  font-size: 13px;
}

.modal-foot {
  padding: 12px 16px;
  border-top: 1px solid #eef2f7;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  background: #fbfcfe;
}

@media (max-width: 700px) {
  .items-head,
  .items-row {
    grid-template-columns: 100px 2fr 70px 90px 70px 100px 80px 80px 80px 90px 44px;
  }
}
@media (max-width: 560px) {
  .modal-foot {
    flex-direction: column;
  }
  .items-head {
    display: none;
  }
  .items-row {
    grid-template-columns: 1fr;
  }
  .items-head-local {
    display: none;
  }
  .items-row-local {
    grid-template-columns: 1fr;
  }
}

.items-table-local {
  min-width: 600px;
}
.items-head-local,
.items-row-local {
  display: grid;
  grid-template-columns: 2fr 80px 100px 80px 100px 44px;
  gap: 8px;
  align-items: center;
}
</style>
