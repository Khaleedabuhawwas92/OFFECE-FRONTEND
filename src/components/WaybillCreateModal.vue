<script setup>
import { ref, computed, onMounted, watch } from "vue";
import axios from "axios";
import PreviewModal from "./dashboard/PreviewModal.vue";
import {
  WB_LABELS as L,
  WB_PLACEHOLDERS as PH,
  TRANSPORT_TYPE_OPTIONS,
  PACKING_METHOD_OPTIONS,
  optionsWith,
  getDriverName,
  getVehicleNo,
  getVehicleRegion,
  makeDriverRow,
  driverRowKey,
  driverRowsToPayload,
  makeEmptyGoodsItem,
  legacyGoodsFields,
  useGoodsNatures,
  joinPlaceDate,
  normalizeNumericFields,
  validateWaybillForm,
} from "./waybillForm.js";

const props = defineProps({
  apiBase: { type: String, required: true },
});

const emit = defineEmits(["close", "saved"]);

const loading = ref(false);
const openPreview = ref(false);
const previewHtml = ref("");
const tplCache = ref(null);
const modalRef = ref(null);
const showStampSignature = ref(false);

/* =========================
   Lists + Search
========================= */
const drivers = ref([]);
const consignors = ref([]);
const consignees = ref([]);

const loadingDrivers = ref(false);
const loadingConsignors = ref(false);
const loadingConsignees = ref(false);

const driverQuery = ref("");
const consignorQuery = ref("");
const consigneeQuery = ref("");

const showDriverList = ref(false);
const showConsignorList = ref(false);
const showConsigneeList = ref(false);

const {
  goodsNatureOpenIndex,
  goodsNatureQuery,
  filteredGoodsNatures,
  fetchGoodsNatures,
  isNewGoodsNature,
  selectGoodsNature,
  addGoodsNature,
} = useGoodsNatures(() => props.apiBase);

// ✅ السائقين/المركبات المختارة — صف لكل سائق مع نوع وسيلة النقل (10)
const driverRows = ref([]); // [{ driverId, DRIVER_NAME, VEHICLE_NO, VEHICLE_REGION, TYPE_TRANSPORT }]

const selectedConsignor = ref(null);
const selectedConsignee = ref(null);

/* =========================
   Form
========================= */
const form = ref({
  DATE: new Date().toISOString().slice(0, 10),
  ISSUING_PLACE: "عمّان",
  SERIAL_NO: "",

  CONSIGNEE_NAME: "",
  CONSIGNEE_ADDRESS: "",
  CONSIGNEE_PHONE: "",

  CONSIGNOR_NAME: "",
  CONSIGNOR_ADDRESS: "",
  CONSIGNOR_PHONE: "",

  CARRIER_NAME: "مؤسسة شرق العالم العربي للنقل البري",

  DELIVERY_PLACE_DATE: "",
  TAKING_PLACE_DATE: "",

  RESERVATION_DAYS: 0,
  FREIGHT_CHARGE: 0,
  FREIGHT_PAY_PLACE_AR: "",
  FREIGHT_PAY_PLACE_EN: "",

  TYPE_TRANSPORT: "",

  driver_ids: [],

  // ✅ نجمعهم كنص مع أسطر \n
  VEHICLE_NO: "",
  VEHICLE_REGION: "",
  DRIVER_NAME: "",

  ROUTE: "",
  ANNEXED_DOCS: "",

  // تفاصيل البضاعة
  GOODS_NATURE: "",
  TARIFF_CODE: "",
  GROSS_WEIGHT: 0,
  MARKS: "",
  PACKAGES_COUNT: 0,

  // نوع التغليف (اختيار)
  PACKING_METHOD: "طرد", // طرد | طبلية | كرتونة

  goodsItems: [makeEmptyGoodsItem()],

  // تعليمات وأجور
  DEMURRAGE_LOADING: 0,
  CONSIGNER_INSTRUCTION: "",
  SPECIAL_TERMS: "",
  CASH_ON_DELIVERY: 0,
  CASH_ON_DELIVERY_NOTES: "",

  // أجور (لا تتركها string)
  CHARGE1_CONSIGNEE: 0,
  CHARGE1_CURRENCY: "JOD",
  CHARGE1_CONSIGNOR: 0,

  CHARGE2_CONSIGNEE: 0,
  CHARGE2_CURRENCY: "JOD",
  CHARGE2_CONSIGNOR: 0,

  CHARGE3_CONSIGNEE: 0,
  CHARGE3_CURRENCY: "JOD",
  CHARGE3_CONSIGNOR: 0,

  DEDUCTIONS: 0,
});

/* =========================
   Route section split fields
========================= */
const takingPlace = ref(form.value.ISSUING_PLACE || "");
const takingDate = ref(form.value.DATE || "");
const deliveryPlace = ref(form.value.ISSUING_PLACE || "");
const deliveryDate = ref(
  addDays(form.value.DATE, form.value.RESERVATION_DAYS || 2),
);

const errors = ref({
  takingPlace: "",
  takingDate: "",
  deliveryPlace: "",
  deliveryDate: "",
  route: "",
});

const locationOptions = computed(() => {
  const set = new Set();
  if (form.value.ISSUING_PLACE) set.add(form.value.ISSUING_PLACE);
  drivers.value.forEach((d) => {
    const r = getVehicleRegion(d);
    if (r) set.add(r);
  });
  consignors.value.forEach((c) => {
    const a = getPartyAddress(c);
    if (a) set.add(a);
  });
  consignees.value.forEach((c) => {
    const a = getPartyAddress(c);
    if (a) set.add(a);
  });
  return Array.from(set).filter(Boolean);
});

watch(
  [takingPlace, takingDate],
  ([p, d]) => {
    form.value.TAKING_PLACE_DATE = joinPlaceDate(p, d);
  },
  { immediate: true },
);

watch(
  [deliveryPlace, deliveryDate],
  ([p, d]) => {
    form.value.DELIVERY_PLACE_DATE = joinPlaceDate(p, d);
  },
  { immediate: true },
);

watch(takingPlace, () => {
  errors.value.takingPlace = "";
});
watch(takingDate, () => {
  errors.value.takingDate = "";
});
watch(deliveryPlace, () => {
  errors.value.deliveryPlace = "";
});
watch(deliveryDate, () => {
  errors.value.deliveryDate = "";
});
watch(
  () => form.value.ROUTE,
  () => {
    errors.value.route = "";
  },
);

watch([selectedConsignor, selectedConsignee], ([sc, se]) => {
  if (!sc || !se) {
    form.value.ROUTE = "";
    return;
  }
  const from = getLocation(sc);
  const to = getLocation(se);
  form.value.ROUTE = from && to ? `${from} → ${to}` : "";
});

/* =========================
   Fetch lists
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

async function fetchConsignees() {
  loadingConsignees.value = true;
  try {
    const res = await axios.get(`${props.apiBase}/api/consignees`);
    consignees.value = Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error("consignees error:", e);
    consignees.value = [];
  } finally {
    loadingConsignees.value = false;
  }
}

/* =========================
   Serial (peek only)
========================= */
async function fetchNextSerial() {
  try {
    const dateParam = form.value.DATE
      ? `?date=${encodeURIComponent(form.value.DATE)}`
      : "";
    const { data } = await axios.get(
      `${props.apiBase}/api/waybills/next-serial${dateParam}`,
    );
    form.value.SERIAL_NO = data?.waybillNumber || data?.SERIAL_NO || "";
  } catch (e) {
    console.error("fetchNextSerial failed:", e);
    // للعرض فقط، ما نكسر الشغل
    form.value.SERIAL_NO = "";
  }
}

onMounted(async () => {
  await Promise.all([
    fetchDrivers(),
    fetchConsignors(),
    fetchConsignees(),
    fetchGoodsNatures(),
  ]);
  await fetchNextSerial();
});

watch(
  () => [form.value.DATE, form.value.RESERVATION_DAYS],
  ([date, days]) => {
    if (!date) return;
    takingDate.value = date;
    deliveryDate.value = addDays(date, Number(days || 0));
  },
  { immediate: true },
);

// ✅ Re-fetch serial when date changes (month-based sequencing)
watch(
  () => form.value.DATE,
  () => {
    fetchNextSerial();
  },
);

/* =========================
   Field getters
========================= */
function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function normalizeCharges() {
  normalizeNumericFields(form.value);
}

function getPartyName(p) {
  return (
    p?.name ??
    p?.NAME ??
    p?.company ??
    p?.COMPANY ??
    p?.title ??
    p?.TITLE ??
    p?.consignor_name ??
    p?.CONSIGNOR_NAME ??
    p?.consignee_name ??
    p?.CONSIGNEE_NAME ??
    ""
  );
}
function getPartyAddress(p) {
  return p?.address ?? p?.ADDRESS ?? p?.addr ?? p?.ADDR ?? "";
}
function getPartyPhone(p) {
  return p?.phone ?? p?.PHONE ?? p?.mobile ?? p?.MOBILE ?? "";
}
function getLocation(p) {
  if (!p) return "";
  return (
    p?.city ||
    p?.CITY ||
    p?.town ||
    p?.TOWN ||
    getPartyAddress(p) ||
    p?.country ||
    p?.COUNTRY ||
    getPartyName(p) ||
    ""
  );
}

/* =========================
   Filtered lists
========================= */
const filteredDrivers = computed(() => {
  const q = String(driverQuery.value || "")
    .toLowerCase()
    .trim();
  const list = drivers.value || [];
  if (!q) return list;
  return list.filter((d) => {
    const v = String(getVehicleNo(d)).toLowerCase();
    const n = String(getDriverName(d)).toLowerCase();
    const r = String(getVehicleRegion(d)).toLowerCase();
    return v.includes(q) || n.includes(q) || r.includes(q);
  });
});

const filteredConsignors = computed(() => {
  const q = String(consignorQuery.value || "")
    .toLowerCase()
    .trim();
  const list = consignors.value || [];
  if (!q) return list;
  return list.filter((c) => {
    const n = String(getPartyName(c)).toLowerCase();
    const code = String(c?.code ?? c?.CODE ?? "").toLowerCase();
    const phone = String(getPartyPhone(c)).toLowerCase();
    return n.includes(q) || code.includes(q) || phone.includes(q);
  });
});

const filteredConsignees = computed(() => {
  const q = String(consigneeQuery.value || "")
    .toLowerCase()
    .trim();
  const list = consignees.value || [];
  if (!q) return list;
  return list.filter((c) => {
    const n = String(getPartyName(c)).toLowerCase();
    const code = String(c?.code ?? c?.CODE ?? "").toLowerCase();
    const phone = String(getPartyPhone(c)).toLowerCase();
    return n.includes(q) || code.includes(q) || phone.includes(q);
  });
});

/* =========================
   Selected drivers
========================= */

function syncDriverFieldsFromSelected() {
  Object.assign(form.value, driverRowsToPayload(driverRows.value));
}

function addDriver(d) {
  const row = makeDriverRow(d);
  const key = driverRowKey(row);
  if (!key || driverRows.value.some((x) => driverRowKey(x) === key)) return;
  // ✅ نوع وسيلة النقل يُعبّأ تلقائياً من سجل السائق ويمكن تغييره لهذه البوليصة فقط
  driverRows.value.push(row);
  syncDriverFieldsFromSelected();
  driverQuery.value = "";
  showDriverList.value = false;
}

function removeDriver(idx) {
  driverRows.value.splice(idx, 1);
  syncDriverFieldsFromSelected();
}

function clearDrivers() {
  driverRows.value = [];
  syncDriverFieldsFromSelected();
}

/* =========================
   Consignor/Consignee
========================= */
function selectConsignor(c) {
  selectedConsignor.value = c || null;
  form.value.CONSIGNOR_NAME = getPartyName(c) || "";
  form.value.CONSIGNOR_ADDRESS = getPartyAddress(c) || "";
  form.value.CONSIGNOR_PHONE = getPartyPhone(c) || "";
  consignorQuery.value = "";
  showConsignorList.value = false;
}
function clearConsignor() {
  selectedConsignor.value = null;
  form.value.CONSIGNOR_NAME = "";
  form.value.CONSIGNOR_ADDRESS = "";
  form.value.CONSIGNOR_PHONE = "";
}

function selectConsignee(c) {
  selectedConsignee.value = c || null;
  form.value.CONSIGNEE_NAME = getPartyName(c) || "";
  form.value.CONSIGNEE_ADDRESS = getPartyAddress(c) || "";
  form.value.CONSIGNEE_PHONE = getPartyPhone(c) || "";
  consigneeQuery.value = "";
  showConsigneeList.value = false;
}
function clearConsignee() {
  selectedConsignee.value = null;
  form.value.CONSIGNEE_NAME = "";
  form.value.CONSIGNEE_ADDRESS = "";
  form.value.CONSIGNEE_PHONE = "";
}

/* =========================
   Goods items helpers
========================= */
function addGoodsItem() {
  form.value.goodsItems.push(makeEmptyGoodsItem());
}

function removeGoodsItem(i) {
  if (form.value.goodsItems.length === 1) return;
  form.value.goodsItems.splice(i, 1);
}

function syncGoodsItemsToLegacy() {
  Object.assign(form.value, legacyGoodsFields(form.value.goodsItems));
}

function buildGoodsRowsHtml() {
  const items = form.value.goodsItems || [];
  if (!items.length) return "";
  return items
    .map(
      (it, idx) => `
    <tr>
      <td style="border-top:1px solid #222;border-right:1px solid #222;height:28px;text-align:center;" class="val-center"></td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(String(it.GROSS_WEIGHT ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(it.TARIFF_CODE || "")}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(it.GOODS_NATURE || "")}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(it.PACKING_METHOD || "")}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(String(it.PACKAGES_COUNT ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(it.MARKS || "")}</td>
      <td style="border-top:1px solid #222;text-align:center;" class="val-center">${idx + 1}</td>
    </tr>`,
    )
    .join("");
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* =========================
   Template + helpers
========================= */
// ✅ يوحّد فقرة الملاحظات: يحوّل الأسطر اليدوية لمسافات ويبقي الفقرة المفصولة بسطر فارغ
function normalizeNotesText(v) {
  return String(v ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("<br>");
}

function fillTemplate(template, obj) {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    const v =
      obj[key] ?? obj[key.toUpperCase()] ?? obj[key.toLowerCase()] ?? "";
    if (key === "CASH_ON_DELIVERY_NOTES") return normalizeNotesText(v);
    return v == null ? "" : String(v);
  });
}

function focusFirstInvalid() {
  const first = document.querySelector(".is-invalid");
  if (first) {
    first.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => first.focus(), 300);
  }
}

function validate() {
  // ✅ لا تشترط SERIAL_NO — السيرفر مسؤول
  syncDriverFieldsFromSelected();
  return validateWaybillForm({
    form: form.value,
    driverRows: driverRows.value,
    taking: { place: takingPlace.value, date: takingDate.value },
    delivery: { place: deliveryPlace.value, date: deliveryDate.value },
    errors: errors.value,
  });
}

async function buildPreview() {
  const err = validate();
  if (err) return alert(err);

  loading.value = true;
  try {
    if (!tplCache.value) {
      const resp = await fetch("/waybill_template.html");
      if (!resp.ok) return alert("waybill_template.html مش موجود داخل public");
      tplCache.value = await resp.text();
    }

    // ✅ اجمع الحقول أولاً كنص
    syncDriverFieldsFromSelected();

    // ✅ للتمبليت فقط: حوّلها إلى HTML أسطر
    const dataForTpl = {
      ...form.value,
      GOODS_ROWS: buildGoodsRowsHtml(),
      STAMP_SIGNATURE_BLOCK: showStampSignature.value
        ? `<div style="height:14px;position:relative;overflow:visible;">
             <div style="position:absolute;width:0;height:0;left:50%;top:50%;transform:translate(-50%,-50%);overflow:visible;z-index:5;pointer-events:none;">
               <img src="/images/company-stamp.png" alt="stamp" style="position:absolute;width:150px;height:auto;left:0;top:0;transform:translate(-50%,-50%);max-width:none;opacity:0.92;">
               <img src="/images/company-signature.png" alt="signature" style="position:absolute;width:250px;height:auto;left:0;top:0;transform:translate(-50%,-50%);z-index:2;max-width:none;">
             </div>
           </div>`
        : '<div style="height:14px"></div>',
    };

    previewHtml.value = fillTemplate(tplCache.value, dataForTpl);
    openPreview.value = true;
  } finally {
    loading.value = false;
  }
}

function printPreview() {
  const iframe = modalRef.value?.frameRef;
  const w = iframe?.contentWindow;
  if (w) {
    w.focus();
    w.print();
  }
}

async function saveWaybill() {
  const err = validate();
  if (err) {
    alert(err);
    focusFirstInvalid();
    return;
  }

  loading.value = true;
  try {
    normalizeCharges();
    syncDriverFieldsFromSelected();
    syncGoodsItemsToLegacy();

    // ✅ لا تحذف SERIAL_NO (لو موجود) — والسيرفر رح يقرر النهائي
    const payload = { ...form.value, showStampSignature: showStampSignature.value };

    const { data } = await axios.post(`${props.apiBase}/api/waybills`, payload);

    // ✅ خزّن الرقم النهائي الذي قرره السيرفر
    if (data?.waybillNumber) form.value.SERIAL_NO = data.waybillNumber;
    else if (data?.SERIAL_NO) form.value.SERIAL_NO = data.SERIAL_NO;

    emit("saved", data);
    return data;
  } catch (e) {
    console.error("saveWaybill failed:", e?.response?.data || e);
    alert(
      e?.response?.data?.message ||
        e?.response?.data?.error ||
        "فشل حفظ البوليصة",
    );
    throw e;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="modal">
      <!-- Header -->
      <header class="modal-header">
        <div class="header-title">
          <h2>بوليصة جديدة</h2>
          <p>أدخل بيانات البوليصة ثم احفظ أو عاين</p>
        </div>
        <div class="header-actions">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;">
            <input type="checkbox" v-model="showStampSignature" style="width:16px;height:16px;cursor:pointer;" />
            إضافة الختم والتوقيع
          </label>
          <button
            class="btn btn--secondary"
            type="button"
            @click="buildPreview"
          >
            👁 معاينة
          </button>
          <button
            class="btn btn--primary"
            type="button"
            :disabled="loading"
            @click="saveWaybill"
          >
            <span v-if="loading">جاري الحفظ...</span>
            <span v-else>💾 حفظ</span>
          </button>
          <button class="btn btn--ghost" type="button" @click="emit('close')">
            ✕
          </button>
        </div>
      </header>

      <!-- Body -->
      <div class="modal-body">
        <!-- 1) بيانات البوليصة -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>بيانات البوليصة</h3>
          </div>
          <div class="row three-col">
            <div class="field">
              <label>{{ L.SERIAL_NO }}</label>
              <input
                v-model="form.SERIAL_NO"
                class="input input--readonly"
                readonly
              />
            </div>
            <div class="field">
              <label>{{ L.DATE }}</label>
              <input v-model="form.DATE" type="date" class="input" />
            </div>
            <div class="field">
              <label>{{ L.ISSUING_PLACE }}</label>
              <input v-model="form.ISSUING_PLACE" class="input" />
            </div>
          </div>
        </section>

        <!-- 2) أطراف الشحنة -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>أطراف الشحنة</h3>
          </div>
          <div class="row two-col">
            <!-- المرسل -->
            <div class="party-card">
              <div class="party-title">{{ L.CONSIGNOR }}</div>

              <div class="chips" v-if="selectedConsignor">
                <span class="chip">
                  {{ getPartyName(selectedConsignor) }}
                  <button type="button" class="chip-x" @click="clearConsignor">
                    ×
                  </button>
                </span>
              </div>

              <input
                v-model="consignorQuery"
                class="input"
                :placeholder="PH.CONSIGNOR_SEARCH"
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
                    <span class="dd-main">{{ getPartyName(c) }}</span>
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

              <div class="field" style="margin-top: 8px">
                <label>{{ L.PARTY_NAME }}</label>
                <input v-model="form.CONSIGNOR_NAME" class="input" />
              </div>
              <div class="field">
                <label>{{ L.PARTY_ADDRESS }}</label>
                <input v-model="form.CONSIGNOR_ADDRESS" class="input" />
              </div>
              <div class="field">
                <label>{{ L.PARTY_PHONE }}</label>
                <input v-model="form.CONSIGNOR_PHONE" class="input" />
              </div>
            </div>

            <!-- المستلم -->
            <div class="party-card">
              <div class="party-title">{{ L.CONSIGNEE }}</div>

              <div class="chips" v-if="selectedConsignee">
                <span class="chip">
                  {{ getPartyName(selectedConsignee) }}
                  <button type="button" class="chip-x" @click="clearConsignee">
                    ×
                  </button>
                </span>
              </div>

              <input
                v-model="consigneeQuery"
                class="input"
                :placeholder="PH.CONSIGNEE_SEARCH"
                @focus="showConsigneeList = true"
                @keydown.esc="showConsigneeList = false"
              />
              <div class="dropdown" v-if="showConsigneeList">
                <div class="dropdown-item muted" v-if="loadingConsignees">
                  جاري تحميل المستلمين...
                </div>
                <button
                  v-for="c in filteredConsignees"
                  :key="c._id || c.id"
                  type="button"
                  class="dropdown-item"
                  @click="selectConsignee(c)"
                >
                  <div class="dd-row">
                    <span class="dd-main">{{ getPartyName(c) }}</span>
                    <span class="dd-sub" v-if="c?.code || c?.CODE">{{
                      c?.code || c?.CODE
                    }}</span>
                  </div>
                </button>
                <div
                  class="dropdown-item muted"
                  v-if="!loadingConsignees && filteredConsignees.length === 0"
                >
                  لا يوجد نتائج
                </div>
              </div>

              <div class="field" style="margin-top: 8px">
                <label>{{ L.PARTY_NAME }}</label>
                <input v-model="form.CONSIGNEE_NAME" class="input" />
              </div>
              <div class="field">
                <label>{{ L.PARTY_ADDRESS }}</label>
                <input v-model="form.CONSIGNEE_ADDRESS" class="input" />
              </div>
              <div class="field">
                <label>{{ L.PARTY_PHONE }}</label>
                <input v-model="form.CONSIGNEE_PHONE" class="input" />
              </div>
            </div>
          </div>
        </section>

        <!-- 3) السائق والمركبة — (10) (11) (12) -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>السائق والمركبة</h3>
          </div>

          <div class="field" style="margin-bottom: 12px">
            <label>ابحث برقم السيارة أو اسم السائق</label>
            <input
              v-model="driverQuery"
              class="input"
              :placeholder="PH.DRIVER_SEARCH"
              @focus="showDriverList = true"
              @keydown.esc="showDriverList = false"
            />
            <div class="dropdown" v-if="showDriverList">
              <div class="dropdown-item muted" v-if="loadingDrivers">
                جاري تحميل السواقين...
              </div>
              <button
                v-for="d in filteredDrivers"
                :key="d._id || d.id"
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

          <div v-for="(r, idx) in driverRows" :key="idx" class="wb-driver-row">
            <div class="field">
              <label>{{ L.TYPE_TRANSPORT }}</label>
              <select v-model="r.TYPE_TRANSPORT" class="input">
                <option value="">{{ PH.TYPE_TRANSPORT }}</option>
                <option
                  v-for="t in optionsWith(TRANSPORT_TYPE_OPTIONS, r.TYPE_TRANSPORT)"
                  :key="t"
                  :value="t"
                >
                  {{ t }}
                </option>
              </select>
            </div>
            <div class="field">
              <label>{{ L.VEHICLE_NO }}</label>
              <input :value="r.VEHICLE_NO" class="input input--readonly" readonly />
            </div>
            <div class="field">
              <label>{{ L.VEHICLE_REGION }}</label>
              <input :value="r.VEHICLE_REGION" class="input input--readonly" readonly />
            </div>
            <div class="field">
              <label>{{ L.DRIVER_NAME }}</label>
              <input :value="r.DRIVER_NAME" class="input input--readonly" readonly />
            </div>
            <button
              type="button"
              class="btn btn--danger btn--small"
              title="حذف"
              @click="removeDriver(idx)"
            >
              ×
            </button>
          </div>
          <button
            v-if="driverRows.length"
            type="button"
            class="btn btn--small btn--secondary"
            @click="clearDrivers"
          >
            مسح الكل
          </button>
        </section>

        <!-- 4) خط السير والاستلام والتسليم -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>خط السير والاستلام والتسليم</h3>
          </div>
          <div class="row two-col">
            <div class="field">
              <label>{{ L.TAKING_PLACE_DATE }}</label>
              <div class="row two-col" style="gap: 8px">
                <div>
                  <input
                    v-model="takingPlace"
                    list="location-options"
                    class="input"
                    :class="{ 'is-invalid': errors.takingPlace }"
                    :placeholder="PH.TAKING_PLACE"
                  />
                  <div v-if="errors.takingPlace" class="error-msg">
                    {{ errors.takingPlace }}
                  </div>
                </div>
                <div>
                  <input
                    v-model="takingDate"
                    type="date"
                    class="input"
                    :class="{ 'is-invalid': errors.takingDate }"
                  />
                  <div v-if="errors.takingDate" class="error-msg">
                    {{ errors.takingDate }}
                  </div>
                </div>
              </div>
            </div>
            <div class="field">
              <label>{{ L.DELIVERY_PLACE_DATE }}</label>
              <div class="row two-col" style="gap: 8px">
                <div>
                  <input
                    v-model="deliveryPlace"
                    list="location-options"
                    class="input"
                    :class="{ 'is-invalid': errors.deliveryPlace }"
                    :placeholder="PH.DELIVERY_PLACE"
                  />
                  <div v-if="errors.deliveryPlace" class="error-msg">
                    {{ errors.deliveryPlace }}
                  </div>
                </div>
                <div>
                  <input
                    v-model="deliveryDate"
                    type="date"
                    class="input"
                    :class="{ 'is-invalid': errors.deliveryDate }"
                  />
                  <div v-if="errors.deliveryDate" class="error-msg">
                    {{ errors.deliveryDate }}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="field" style="margin-top: 10px">
            <label>{{ L.ROUTE }}</label>
            <input
              v-model="form.ROUTE"
              list="location-options"
              class="input"
              :class="{
                'is-invalid': errors.route,
                'input--readonly': !!(selectedConsignor && selectedConsignee),
              }"
              :readonly="!!(selectedConsignor && selectedConsignee)"
              :placeholder="PH.ROUTE"
            />
            <div v-if="errors.route" class="error-msg">
              {{ errors.route }}
            </div>
          </div>
          <datalist id="location-options">
            <option
              v-for="loc in locationOptions"
              :key="loc"
              :value="loc"
            ></option>
          </datalist>
        </section>

        <!-- 5) تفاصيل البضاعة — (15) → (20) بنفس ترتيب القالب المطبوع -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>تفاصيل البضاعة</h3>
          </div>

          <div class="wb-goods-row" v-for="(g, i) in form.goodsItems" :key="i">
            <div class="wb-goods-idx">{{ i + 1 }}</div>
            <div class="field">
              <label>{{ L.MARKS }}</label>
              <input v-model="g.MARKS" class="input" />
            </div>
            <div class="field">
              <label>{{ L.PACKAGES_COUNT }}</label>
              <input v-model="g.PACKAGES_COUNT" class="input" type="number" min="0" step="1" />
            </div>
            <div class="field">
              <label>{{ L.PACKING_METHOD }}</label>
              <select v-model="g.PACKING_METHOD" class="input">
                <option
                  v-for="p in optionsWith(PACKING_METHOD_OPTIONS, g.PACKING_METHOD)"
                  :key="p"
                  :value="p"
                >
                  {{ p }}
                </option>
              </select>
            </div>
            <div class="field" style="position: relative">
              <label>{{ L.GOODS_NATURE }}</label>
              <input
                :value="g.GOODS_NATURE"
                class="input"
                @focus="goodsNatureOpenIndex = i; goodsNatureQuery = g.GOODS_NATURE || ''"
                @input="g.GOODS_NATURE = $event.target.value; goodsNatureQuery = $event.target.value"
                @keydown.esc="goodsNatureOpenIndex = -1"
              />
              <div class="dropdown wb-goods-dd" v-if="goodsNatureOpenIndex === i">
                <div
                  v-for="n in filteredGoodsNatures"
                  :key="n"
                  class="dropdown-item"
                  @click="selectGoodsNature(form.goodsItems, i, n)"
                >
                  {{ n }}
                </div>
                <div
                  v-if="isNewGoodsNature()"
                  class="dropdown-item"
                  style="color: #1976d2; font-weight: 700"
                  @click="addGoodsNature(form.goodsItems, i)"
                >
                  ➕ إضافة "{{ goodsNatureQuery }}"
                </div>
                <div
                  class="dropdown-item muted"
                  v-if="filteredGoodsNatures.length === 0 && !isNewGoodsNature()"
                >
                  لا توجد نتائج
                </div>
              </div>
            </div>
            <div class="field">
              <label>{{ L.TARIFF_CODE }}</label>
              <input v-model="g.TARIFF_CODE" class="input" />
            </div>
            <div class="field">
              <label>{{ L.GROSS_WEIGHT }}</label>
              <input v-model="g.GROSS_WEIGHT" class="input" type="number" min="0" step="0.001" />
            </div>
            <button
              type="button"
              class="btn btn--danger btn--small"
              title="حذف"
              @click="removeGoodsItem(i)"
            >
              ×
            </button>
          </div>

          <div style="margin-top: 6px">
            <button type="button" class="btn btn--secondary btn--small" @click="addGoodsItem">
              ➕ إضافة تفصيلة
            </button>
          </div>

          <div class="field" style="margin-top: 12px">
            <label>{{ L.ANNEXED_DOCS }}</label>
            <input
              v-model="form.ANNEXED_DOCS"
              class="input"
              :placeholder="PH.ANNEXED_DOCS"
            />
          </div>
        </section>

        <!-- 6) تعليمات وأجور -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>تعليمات وأجور</h3>
          </div>
          <div class="row three-col">
            <div class="field">
              <label>{{ L.RESERVATION_DAYS }}</label>
              <input v-model.number="form.RESERVATION_DAYS" type="number" min="0" step="1" class="input" />
            </div>
            <div class="field">
              <label>{{ L.FREIGHT_CHARGE }}</label>
              <input v-model.number="form.FREIGHT_CHARGE" type="number" min="0" step="0.001" class="input" />
            </div>
            <div class="field">
              <label>{{ L.FREIGHT_PAY_PLACE_AR }}</label>
              <input v-model="form.FREIGHT_PAY_PLACE_AR" class="input" />
            </div>
            <div class="field">
              <label>{{ L.FREIGHT_PAY_PLACE_EN }}</label>
              <input v-model="form.FREIGHT_PAY_PLACE_EN" class="input" />
            </div>
            <div class="field">
              <label>{{ L.DEMURRAGE_LOADING }}</label>
              <input v-model.number="form.DEMURRAGE_LOADING" type="number" min="0" step="1" class="input" />
            </div>
          </div>
          <div class="row three-col" style="margin-top: 10px">
            <div class="field">
              <label>{{ L.CONSIGNER_INSTRUCTION }}</label>
              <textarea v-model="form.CONSIGNER_INSTRUCTION" class="textarea textarea--compact" rows="2"></textarea>
            </div>
            <div class="field">
              <label>{{ L.SPECIAL_TERMS }}</label>
              <textarea v-model="form.SPECIAL_TERMS" class="textarea textarea--compact" rows="2"></textarea>
            </div>
            <div class="field">
              <label>{{ L.CASH_ON_DELIVERY }}</label>
              <textarea v-model="form.CASH_ON_DELIVERY" class="textarea textarea--compact" rows="2"></textarea>
            </div>
            <div class="field">
              <label>{{ L.CASH_ON_DELIVERY_NOTES }}</label>
              <textarea v-model="form.CASH_ON_DELIVERY_NOTES" class="textarea textarea--compact" rows="3"></textarea>
            </div>
          </div>
        </section>

        <PreviewModal
          v-if="openPreview"
          ref="modalRef"
          title="معاينة البوليصة"
          :html="previewHtml"
          @close="openPreview = false"
          @print="printPreview"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ✅ صف سائق: (10) (11) (11) (12) + حذف */
.wb-driver-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: end;
  margin-bottom: 8px;
}
/* ✅ صف بضاعة: # (15) (16) (17) (18) (19) (20) + حذف */
.wb-goods-row {
  display: grid;
  grid-template-columns: 28px repeat(6, minmax(0, 1fr)) auto;
  gap: 8px;
  align-items: end;
  margin-bottom: 8px;
}
.wb-goods-idx {
  font-weight: 700;
  text-align: center;
  padding-bottom: 10px;
}
.wb-goods-dd {
  position: absolute;
  left: 0;
  right: 0;
  top: 100%;
  z-index: 20;
  background: #fff;
}

.overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 18px;
  z-index: 9999;
}

.modal {
  width: min(1340px, 96vw);
  max-height: 94vh;
  background: #f4f6f9;
  border-radius: 14px;
  border: 1px solid #d0d5dd;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  direction: rtl;
}

/* Header */
.modal-header {
  background: #fff;
  border-bottom: 1px solid #e2e6ec;
  padding: 14px 22px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 14px;
  position: sticky;
  top: 0;
  z-index: 30;
  flex-shrink: 0;
}

.header-title h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
  color: #111827;
}

.header-title p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

/* Body */
.modal-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Cards */
.form-card {
  background: #fff;
  border: 1px solid #d8dee8;
  border-radius: 10px;
  padding: 18px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.card-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.card-dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: #1976d2;
  flex-shrink: 0;
}

.card-head h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 800;
  color: #111827;
}

/* Rows */
.row {
  display: grid;
  gap: 12px;
}

.row.three-col {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.row.two-col {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* Party cards inside shipment section */
.party-card {
  border: 1px solid #e2e6ec;
  border-radius: 10px;
  padding: 14px;
  background: #fafbfd;
}

.party-title {
  font-size: 13px;
  font-weight: 800;
  color: #1f2937;
  margin-bottom: 10px;
}

/* Fields */
.field label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  margin-bottom: 6px;
}

.input,
.textarea {
  width: 100%;
  height: 40px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: inherit;
  color: #1f2937;
  background: #fff;
  box-sizing: border-box;
  outline: none;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.input:focus,
.textarea:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.12);
}

.input--readonly {
  background: #f3f5f8;
  color: #4b5563;
  cursor: default;
}

.textarea {
  height: auto;
  min-height: 44px;
  resize: vertical;
}

.textarea--compact {
  min-height: 44px;
}

.input.is-invalid,
.textarea.is-invalid {
  border-color: #ef4444;
  background: #fef2f2;
}

.input.is-invalid:focus,
.textarea.is-invalid:focus {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}

.error-msg {
  color: #ef4444;
  font-size: 11px;
  margin-top: 4px;
  font-weight: 600;
}

/* Buttons */
.btn {
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
}

.btn--primary {
  background: #1976d2;
  color: #fff;
}

.btn--primary:hover {
  background: #1565c0;
}

.btn--primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn--secondary {
  background: #f3f5f8;
  border-color: #d0d5dd;
  color: #1f2937;
}

.btn--secondary:hover {
  background: #e8ecf2;
}

.btn--ghost {
  background: transparent;
  border-color: #d0d5dd;
  color: #4b5563;
}

.btn--ghost:hover {
  background: #f3f5f8;
}

.btn--small {
  padding: 5px 12px;
  font-size: 12px;
}

/* Chips */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
  align-items: center;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #eff4ff;
  border: 1px solid #c7d7fe;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: #1e3a5f;
}

.chip-x {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  color: #4b5563;
  padding: 0;
}

/* Dropdown */
.dropdown {
  margin-top: 6px;
  border: 1px solid #d8dee8;
  border-radius: 8px;
  background: #fff;
  max-height: 200px;
  overflow: auto;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
  z-index: 20;
}

.dropdown-item {
  width: 100%;
  text-align: right;
  padding: 9px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-family: inherit;
}

.dropdown-item:hover {
  background: #f4f6f9;
}

.dropdown-item.muted {
  cursor: default;
  color: #6b7280;
}

.dd-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.dd-main {
  font-weight: 800;
}

.dd-sub {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}

/* Info rows under party cards */
.info-rows {
  margin-top: 10px;
  font-size: 12px;
  color: #4b5563;
  display: grid;
  gap: 4px;
}

/* Responsive */
@media (max-width: 960px) {
  .row.three-col {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .modal {
    width: 100%;
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-header {
    padding: 12px 16px;
  }

  .modal-body {
    padding: 12px;
  }

  .row.three-col,
  .row.two-col {
    grid-template-columns: 1fr;
  }

  .form-card {
    padding: 14px;
  }
}
</style>
