<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";
import {
  WB_LABELS as L,
  WB_PLACEHOLDERS as PH,
  TRANSPORT_TYPE_OPTIONS,
  PACKING_METHOD_OPTIONS,
  optionsWith,
  getDriverName,
  getVehicleNo,
  getVehicleRegion,
  driverTypeFromMaster,
  makeDriverRow,
  driverRowKey,
  driverRowsToPayload,
  makeEmptyGoodsItem,
  goodsItemsFromWaybill,
  legacyGoodsFields,
  useGoodsNatures,
  splitPlaceDate,
  joinPlaceDate,
  normalizeNumericFields,
  validateWaybillForm,
} from "./waybillForm.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

const route = useRoute();
const router = useRouter();
const waybillId = computed(() => route.params.id);

const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const showStampSignature = ref(false);

/* =========================
   DB Lists
========================= */
const consignors = ref([]);
const consignees = ref([]);
const drivers = ref([]);

const loadingConsignors = ref(false);
const loadingConsignees = ref(false);
const loadingDrivers = ref(false);

/* =========================
   Pickers: Consignor / Consignee
========================= */
const consignorQuery = ref("");
const consigneeQuery = ref("");
const showConsignorList = ref(false);
const showConsigneeList = ref(false);

const selectedConsignor = ref(null);
const selectedConsignee = ref(null);

/* =========================
   ✅ Multi Drivers — صف لكل سائق (10) (11) (12)
========================= */
const selectedDrivers = ref([]); // [{ driverId, DRIVER_NAME, VEHICLE_NO, VEHICLE_REGION, TYPE_TRANSPORT }]
const driverQuery = ref("");
const showDriverList = ref(false);

const {
  goodsNatureOpenIndex,
  goodsNatureQuery,
  filteredGoodsNatures,
  fetchGoodsNatures,
  isNewGoodsNature,
  selectGoodsNature,
  addGoodsNature,
} = useGoodsNatures(() => API_BASE);

/* =========================
   Form — نفس حقول شاشة الإنشاء
========================= */
const form = ref({
  _id: null,
  SERIAL_NO: "",
  DATE: "",
  ISSUING_PLACE: "",

  CONSIGNOR_NAME: "",
  CONSIGNOR_ADDRESS: "",
  CONSIGNOR_PHONE: "",

  CONSIGNEE_NAME: "",
  CONSIGNEE_ADDRESS: "",
  CONSIGNEE_PHONE: "",

  TAKING_PLACE_DATE: "",
  DELIVERY_PLACE_DATE: "",
  ROUTE: "",

  goodsItems: [makeEmptyGoodsItem()],
  ANNEXED_DOCS: "",

  RESERVATION_DAYS: 0,
  FREIGHT_CHARGE: 0,
  FREIGHT_PAY_PLACE_AR: "",
  FREIGHT_PAY_PLACE_EN: "",
  DEMURRAGE_LOADING: 0,
  CONSIGNER_INSTRUCTION: "",
  SPECIAL_TERMS: "",
  CASH_ON_DELIVERY: 0,
  CASH_ON_DELIVERY_NOTES: "",
});

/* =========================
   Route section split fields ("مكان - YYYY-MM-DD")
========================= */
const takingPlace = ref("");
const takingDate = ref("");
const deliveryPlace = ref("");
const deliveryDate = ref("");

const errors = ref({
  takingPlace: "",
  takingDate: "",
  deliveryPlace: "",
  deliveryDate: "",
  route: "",
});

watch([takingPlace, takingDate], ([p, d]) => {
  form.value.TAKING_PLACE_DATE = joinPlaceDate(p, d);
  errors.value.takingPlace = "";
  errors.value.takingDate = "";
});
watch([deliveryPlace, deliveryDate], ([p, d]) => {
  form.value.DELIVERY_PLACE_DATE = joinPlaceDate(p, d);
  errors.value.deliveryPlace = "";
  errors.value.deliveryDate = "";
});
watch(
  () => form.value.ROUTE,
  () => {
    errors.value.route = "";
  },
);

/* =========================
   Helpers
========================= */
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
function getConsigneeName(c) {
  return (
    c?.name ??
    c?.NAME ??
    c?.consignee_name ??
    c?.CONSIGNEE_NAME ??
    c?.company ??
    c?.COMPANY ??
    c?.title ??
    c?.TITLE ??
    ""
  );
}

function getPhone(x) {
  return x?.phone ?? x?.PHONE ?? x?.mobile ?? x?.MOBILE ?? "";
}
function getAddress(x) {
  return x?.address ?? x?.ADDRESS ?? x?.addr ?? x?.ADDR ?? "";
}
// ✅ نفس منطق خط السير في شاشة الإنشاء (مدينة → عنوان → دولة → اسم)
function getLocation(p) {
  if (!p) return "";
  return (
    p?.city ||
    p?.CITY ||
    p?.town ||
    p?.TOWN ||
    getAddress(p) ||
    p?.country ||
    p?.COUNTRY ||
    getConsignorName(p) ||
    ""
  );
}

const locationOptions = computed(() => {
  const set = new Set();
  if (form.value.ISSUING_PLACE) set.add(form.value.ISSUING_PLACE);
  drivers.value.forEach((d) => {
    const r = getVehicleRegion(d);
    if (r) set.add(r);
  });
  consignors.value.forEach((c) => {
    const a = getAddress(c);
    if (a) set.add(a);
  });
  consignees.value.forEach((c) => {
    const a = getAddress(c);
    if (a) set.add(a);
  });
  return Array.from(set).filter(Boolean);
});

function goBack() {
  router.push({ path: "/", query: { refresh: "1", type: "waybill" } });
}
/* =========================
   Fetch Lists
========================= */
async function fetchConsignors() {
  loadingConsignors.value = true;
  try {
    const res = await axios.get(`${API_BASE}/api/consignors`);
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
    const res = await axios.get(`${API_BASE}/api/consignees`);
    consignees.value = Array.isArray(res.data) ? res.data : [];
  } catch (e) {
    console.error("consignees error:", e);
    consignees.value = [];
  } finally {
    loadingConsignees.value = false;
  }
}

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
   Filtered Dropdowns
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
    const phone = String(getPhone(c)).toLowerCase();
    return nm.includes(q) || code.includes(q) || phone.includes(q);
  });
});

const filteredConsignees = computed(() => {
  const q = String(consigneeQuery.value || "")
    .toLowerCase()
    .trim();
  const list = consignees.value || [];
  if (!q) return list;

  return list.filter((c) => {
    const nm = String(getConsigneeName(c)).toLowerCase();
    const code = String(c?.code ?? c?.CODE ?? "").toLowerCase();
    const phone = String(getPhone(c)).toLowerCase();
    return nm.includes(q) || code.includes(q) || phone.includes(q);
  });
});

const filteredDrivers = computed(() => {
  const q = String(driverQuery.value || "")
    .toLowerCase()
    .trim();
  const list = drivers.value || [];
  if (!q) return list;

  return list.filter((d) => {
    const nm = String(getDriverName(d)).toLowerCase();
    const vno = String(getVehicleNo(d)).toLowerCase();
    const vreg = String(getVehicleRegion(d)).toLowerCase();
    const phone = String(getPhone(d)).toLowerCase();
    return (
      nm.includes(q) || vno.includes(q) || vreg.includes(q) || phone.includes(q)
    );
  });
});

/* =========================
   Selectors: Consignor / Consignee
========================= */
// ✅ خط السير يُحدَّث فقط عند اختيار المستخدم (لا عند التحميل) كي لا يُستبدل المحفوظ
function updateRouteFromParties() {
  const sc = selectedConsignor.value;
  const se = selectedConsignee.value;
  if (!sc || !se) return;
  const from = getLocation(sc);
  const to = getLocation(se);
  if (from && to) form.value.ROUTE = `${from} → ${to}`;
}

function selectConsignor(c) {
  selectedConsignor.value = c || null;

  form.value.CONSIGNOR_NAME = getConsignorName(c) || "";
  form.value.CONSIGNOR_PHONE = getPhone(c) || form.value.CONSIGNOR_PHONE || "";
  form.value.CONSIGNOR_ADDRESS =
    getAddress(c) || form.value.CONSIGNOR_ADDRESS || "";

  consignorQuery.value = "";
  showConsignorList.value = false;
  updateRouteFromParties();
}
function clearConsignor() {
  selectedConsignor.value = null;
  showConsignorList.value = false;
}

function selectConsignee(c) {
  selectedConsignee.value = c || null;

  form.value.CONSIGNEE_NAME = getConsigneeName(c) || "";
  form.value.CONSIGNEE_PHONE = getPhone(c) || form.value.CONSIGNEE_PHONE || "";
  form.value.CONSIGNEE_ADDRESS =
    getAddress(c) || form.value.CONSIGNEE_ADDRESS || "";

  consigneeQuery.value = "";
  showConsigneeList.value = false;
  updateRouteFromParties();
}
function clearConsignee() {
  selectedConsignee.value = null;
  showConsigneeList.value = false;
}

/* =========================
   ✅ Selectors: Multi Drivers
========================= */
function selectDriver(d) {
  const item = makeDriverRow(d);
  const key = driverRowKey(item);
  if (!key || selectedDrivers.value.some((x) => driverRowKey(x) === key)) return;

  selectedDrivers.value.push(item);
  driverQuery.value = "";
  showDriverList.value = false;
}

function removeSelectedDriver(idx) {
  selectedDrivers.value.splice(idx, 1);
}

function clearAllDrivers() {
  selectedDrivers.value = [];
}

/* =========================
   Goods items
========================= */
function addGoodsItem() {
  form.value.goodsItems.push(makeEmptyGoodsItem());
}
function removeGoodsItem(i) {
  if (form.value.goodsItems.length === 1) return;
  form.value.goodsItems.splice(i, 1);
}

/* =========================
   Fetch Waybill
========================= */
async function fetchWaybill() {
  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const res = await axios.get(`${API_BASE}/api/waybills/${waybillId.value}`);
    const wb = res.data || {};

    form.value = {
      _id: wb._id,
      SERIAL_NO: wb.waybillNumber || wb.SERIAL_NO || "",
      DATE: wb.DATE || "",
      ISSUING_PLACE: wb.ISSUING_PLACE || "",

      CONSIGNOR_NAME: wb.CONSIGNOR_NAME || "",
      CONSIGNOR_ADDRESS: wb.CONSIGNOR_ADDRESS || "",
      CONSIGNOR_PHONE: wb.CONSIGNOR_PHONE || "",

      CONSIGNEE_NAME: wb.CONSIGNEE_NAME || "",
      CONSIGNEE_ADDRESS: wb.CONSIGNEE_ADDRESS || "",
      CONSIGNEE_PHONE: wb.CONSIGNEE_PHONE || "",

      TAKING_PLACE_DATE: wb.TAKING_PLACE_DATE || "",
      DELIVERY_PLACE_DATE: wb.DELIVERY_PLACE_DATE || "",
      ROUTE: wb.ROUTE || "",

      // ✅ goodsItems هو المصدر الأساسي؛ القديمة → بند واحد من الحقول المسطّحة
      goodsItems: goodsItemsFromWaybill(wb),
      ANNEXED_DOCS: wb.ANNEXED_DOCS || "",

      RESERVATION_DAYS: wb.RESERVATION_DAYS ?? 0,
      FREIGHT_CHARGE: wb.FREIGHT_CHARGE ?? 0,
      FREIGHT_PAY_PLACE_AR: wb.FREIGHT_PAY_PLACE_AR || "",
      FREIGHT_PAY_PLACE_EN: wb.FREIGHT_PAY_PLACE_EN || "",
      DEMURRAGE_LOADING: wb.DEMURRAGE_LOADING ?? 0,
      CONSIGNER_INSTRUCTION: wb.CONSIGNER_INSTRUCTION || "",
      SPECIAL_TERMS: wb.SPECIAL_TERMS || "",
      CASH_ON_DELIVERY: wb.CASH_ON_DELIVERY ?? 0,
      CASH_ON_DELIVERY_NOTES: wb.CASH_ON_DELIVERY_NOTES || "",
    };

    const taking = splitPlaceDate(wb.TAKING_PLACE_DATE);
    const delivery = splitPlaceDate(wb.DELIVERY_PLACE_DATE);
    takingPlace.value = taking.place;
    takingDate.value = taking.date;
    deliveryPlace.value = delivery.place;
    deliveryDate.value = delivery.date;

    showStampSignature.value = wb.showStampSignature === true;

    const drvList = drivers.value || [];
    const findDriver = (x) =>
      (x.VEHICLE_NO &&
        drvList.find((d) => String(getVehicleNo(d)) === String(x.VEHICLE_NO))) ||
      (x.DRIVER_NAME &&
        drvList.find((d) => String(getDriverName(d)) === String(x.DRIVER_NAME)));

    // ✅ رجّع السواقين من DRIVER1..50
    const arr = [];
    for (let i = 1; i <= 50; i++) {
      const name = wb?.[`DRIVER${i}_NAME`];
      const vno = wb?.[`VEHICLE${i}_NO`];
      const vreg = wb?.[`VEHICLE${i}_REGION`];
      const ttype = wb?.[`TYPE${i}_TRANSPORT`];

      const any = String(name || vno || vreg || ttype || "").trim();
      if (!any) break;

      arr.push({
        driverId: null,
        DRIVER_NAME: name || "",
        VEHICLE_NO: vno || "",
        VEHICLE_REGION: vreg || "",
        TYPE_TRANSPORT: ttype || "",
      });
    }

    if (arr.length) {
      // ✅ القيمة الفعّالة: المحفوظة بالبوليصة أولاً، وإلا من سجل السائق vehicleType
      selectedDrivers.value = arr.map((x) => {
        const found = findDriver(x);
        return found
          ? {
              ...makeDriverRow(found),
              TYPE_TRANSPORT: x.TYPE_TRANSPORT || driverTypeFromMaster(found),
            }
          : x;
      });
    } else {
      // Back-compat: بوليصات الإنشاء القديمة (driver_ids + TYPE_TRANSPORT على مستوى البوليصة)
      const ids = (Array.isArray(wb?.driver_ids) ? wb.driver_ids : []).map(String);
      const fromIds = ids
        .map((id) => drvList.find((d) => String(d?._id || d?.id) === id))
        .filter(Boolean)
        .map((d) => ({
          ...makeDriverRow(d),
          TYPE_TRANSPORT: wb?.TYPE_TRANSPORT || driverTypeFromMaster(d),
        }));
      if (fromIds.length) {
        selectedDrivers.value = fromIds;
      } else if (String(wb?.DRIVER_NAME || wb?.VEHICLE_NO || "").trim()) {
        const x = {
          driverId: null,
          DRIVER_NAME: wb?.DRIVER_NAME || "",
          VEHICLE_NO: wb?.VEHICLE_NO || "",
          VEHICLE_REGION: wb?.VEHICLE_REGION || "",
          TYPE_TRANSPORT: wb?.TYPE1_TRANSPORT || wb?.TYPE_TRANSPORT || "",
        };
        const found = findDriver(x);
        selectedDrivers.value = [
          found ? { ...makeDriverRow(found), TYPE_TRANSPORT: x.TYPE_TRANSPORT || driverTypeFromMaster(found) } : x,
        ];
      } else {
        selectedDrivers.value = [];
      }
    }

    // consignor/consignee match
    const consList = consignors.value || [];
    const cneeList = consignees.value || [];
    selectedConsignor.value = null;
    selectedConsignee.value = null;

    if (form.value.CONSIGNOR_NAME && consList.length) {
      const found = consList.find(
        (x) => getConsignorName(x) === form.value.CONSIGNOR_NAME,
      );
      if (found) selectedConsignor.value = found;
    }
    if (form.value.CONSIGNEE_NAME && cneeList.length) {
      const found = cneeList.find(
        (x) => getConsigneeName(x) === form.value.CONSIGNEE_NAME,
      );
      if (found) selectedConsignee.value = found;
    }
  } catch (err) {
    console.error(err);
    errorMessage.value = "تعذّر تحميل بيانات البوليصة.";
  } finally {
    loading.value = false;
  }
}

/* =========================
   Save / Delete / PDF
========================= */
function validate() {
  if (!String(form.value.SERIAL_NO || "").trim()) return "رقم السند مطلوب";
  return validateWaybillForm({
    form: form.value,
    driverRows: selectedDrivers.value,
    taking: { place: takingPlace.value, date: takingDate.value },
    delivery: { place: deliveryPlace.value, date: deliveryDate.value },
    errors: errors.value,
  });
}

function buildSavePayload() {
  const payload = { ...form.value };
  normalizeNumericFields(payload);

  // ✅ نفس مخطط الحفظ في شاشة الإنشاء: TYPEn/VEHICLEn/DRIVERn + الحقول القديمة
  Object.assign(payload, driverRowsToPayload(selectedDrivers.value));

  // ✅ goodsItems كاملة + الحقول المسطّحة القديمة من أول بند
  Object.assign(payload, legacyGoodsFields(payload.goodsItems));

  payload.showStampSignature = showStampSignature.value === true;

  return payload;
}

async function saveWaybill() {
  const err = validate();
  if (err) {
    console.warn("VALIDATION ERROR:", err);
    alert(err);
    return;
  }

  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const payload = buildSavePayload();

    console.log("PUT URL:", `${API_BASE}/api/waybills/${waybillId.value}`);
    console.log("PAYLOAD:", JSON.parse(JSON.stringify(payload)));

    const res = await axios.put(
      `${API_BASE}/api/waybills/${waybillId.value}`,
      payload,
    );

    console.log("PUT OK:", res?.data);

    successMessage.value = "✅ تم حفظ التعديلات بنجاح.";
    await fetchWaybill();
  } catch (err) {
    console.error("PUT FAILED:", err);
    console.log("ERR RESPONSE:", err?.response?.status, err?.response?.data);
    errorMessage.value =
      err?.response?.data?.message ||
      err?.response?.data?.error ||
      "تعذّر حفظ تعديلات البوليصة.";
  } finally {
    saving.value = false;
  }
}

async function deleteCurrentWaybill() {
  if (!confirm("هل أنت متأكد من حذف هذه البوليصة نهائياً؟")) return;

  try {
    await axios.delete(`${API_BASE}/api/waybills/${waybillId.value}`);
    router.push("/");
  } catch (err) {
    console.error(err);
    errorMessage.value = "فشل حذف البوليصة.";
  }
}

function generatePdf() {
  const qs = showStampSignature.value ? "?showStampSignature=true" : "";
  window.open(
    `${API_BASE}/api/waybills/${waybillId.value}/regenerate-pdf${qs}`,
    "_blank",
  );
}

/* =========================
   UX: close dropdowns on Esc
========================= */
function onEsc(e) {
  if (e.key === "Escape") {
    showConsignorList.value = false;
    showConsigneeList.value = false;
    showDriverList.value = false;
    goodsNatureOpenIndex.value = -1;
  }
}

watch(consignorQuery, (v) => {
  if (v && v.trim()) showConsignorList.value = true;
});
watch(consigneeQuery, (v) => {
  if (v && v.trim()) showConsigneeList.value = true;
});
watch(driverQuery, (v) => {
  if (v && v.trim()) showDriverList.value = true;
});

/* =========================
   Init
========================= */
onMounted(async () => {
  window.addEventListener("keydown", onEsc);
  await Promise.all([
    fetchConsignors(),
    fetchConsignees(),
    fetchDrivers(),
    fetchGoodsNatures(),
  ]);
  await fetchWaybill();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar-left">
        <div class="app-title">تعديل وثيقة النقل</div>
        <div class="app-subtitle">
          <span class="mono" v-if="form.SERIAL_NO">{{ form.SERIAL_NO }}</span>
          <span class="dot">•</span>
          <span class="mono">ID: {{ waybillId }}</span>
        </div>
      </div>

      <nav class="main-nav">
        <RouterLink to="/" class="nav-link">الداشبورد</RouterLink>
        <RouterLink to="/drivers" class="nav-link">السائقين</RouterLink>
        <RouterLink to="/consignors" class="nav-link">المرسلون</RouterLink>
        <RouterLink to="/consignees" class="nav-link">المرسل إليهم</RouterLink>
      </nav>
    </header>

    <div class="main-area">
      <div v-if="errorMessage" class="alert alert--danger">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert--success">
        {{ successMessage }}
      </div>

      <div class="section-header">
        <div class="section-title-wrap">
          <h2 class="section-title">بيانات البوليصة</h2>
          <p class="section-subtitle">
            <span v-if="saving">جارٍ الحفظ...</span>
            <span v-else>جاهز</span>
          </p>
        </div>

        <div class="header-actions">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;">
            <input type="checkbox" v-model="showStampSignature" style="width:16px;height:16px;cursor:pointer;" />
            إضافة الختم والتوقيع
          </label>
          <button class="btn btn--ghost" type="button" @click="goBack">
            ⬅ رجوع
          </button>
          <button class="btn btn--secondary" type="button" @click="generatePdf">
            🧾 PDF
          </button>
          <button
            class="btn btn--danger"
            type="button"
            @click="deleteCurrentWaybill"
          >
            🗑 حذف
          </button>
          <button
            class="btn btn--primary"
            :disabled="saving"
            @click="saveWaybill"
          >
            💾 حفظ
          </button>
        </div>
      </div>

      <div v-if="loading" class="skeleton">
        <div class="sk-line" style="width: 40%"></div>
        <div class="sk-line" style="width: 85%"></div>
        <div class="sk-line" style="width: 70%"></div>
      </div>

      <form v-else id="wbForm" class="form" @submit.prevent="saveWaybill">
        <!-- 1) بيانات البوليصة -->
        <div class="card accent accent--blue">
          <div class="card-head">
            <h3>بيانات البوليصة</h3>
            <span class="badge">أساسي</span>
          </div>

          <div class="grid grid--3">
            <label class="field">
              <span>{{ L.SERIAL_NO }}</span>
              <input v-model="form.SERIAL_NO" type="text" readonly class="is-readonly" />
            </label>

            <label class="field">
              <span>{{ L.DATE }}</span>
              <input v-model="form.DATE" type="date" />
            </label>

            <label class="field">
              <span>{{ L.ISSUING_PLACE }}</span>
              <input v-model="form.ISSUING_PLACE" type="text" />
            </label>
          </div>
        </div>

        <!-- 2) أطراف الشحنة -->
        <div class="card accent accent--green">
          <div class="card-head">
            <h3>أطراف الشحنة</h3>
            <span class="badge">DB</span>
          </div>

          <div class="grid">
            <!-- المرسل -->
            <div class="party-card">
              <div class="party-title">{{ L.CONSIGNOR }}</div>

              <div class="chips" v-if="selectedConsignor">
                <span class="chip">
                  {{ getConsignorName(selectedConsignor) }}
                  <button type="button" class="chip-x" @click="clearConsignor">
                    ×
                  </button>
                </span>
              </div>

              <div class="picker">
                <div class="picker-row">
                  <input
                    class="picker-input"
                    v-model="consignorQuery"
                    type="text"
                    :placeholder="PH.CONSIGNOR_SEARCH"
                    @focus="showConsignorList = true"
                  />
                  <button
                    type="button"
                    class="btn--mini"
                    @click="showConsignorList = !showConsignorList"
                  >
                    ▾
                  </button>
                </div>

                <div class="dropdown" v-if="showConsignorList">
                  <div class="dropdown-item muted" v-if="loadingConsignors">
                    جاري تحميل...
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
                      <span class="dd-sub">{{
                        c?.code || c?.CODE || getPhone(c)
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

              <label class="field">
                <span>{{ L.PARTY_NAME }}</span>
                <input v-model="form.CONSIGNOR_NAME" type="text" />
              </label>
              <label class="field">
                <span>{{ L.PARTY_ADDRESS }}</span>
                <input v-model="form.CONSIGNOR_ADDRESS" type="text" />
              </label>
              <label class="field">
                <span>{{ L.PARTY_PHONE }}</span>
                <input v-model="form.CONSIGNOR_PHONE" type="text" />
              </label>
            </div>

            <!-- المستلم -->
            <div class="party-card">
              <div class="party-title">{{ L.CONSIGNEE }}</div>

              <div class="chips" v-if="selectedConsignee">
                <span class="chip">
                  {{ getConsigneeName(selectedConsignee) }}
                  <button type="button" class="chip-x" @click="clearConsignee">
                    ×
                  </button>
                </span>
              </div>

              <div class="picker">
                <div class="picker-row">
                  <input
                    class="picker-input"
                    v-model="consigneeQuery"
                    type="text"
                    :placeholder="PH.CONSIGNEE_SEARCH"
                    @focus="showConsigneeList = true"
                  />
                  <button
                    type="button"
                    class="btn--mini"
                    @click="showConsigneeList = !showConsigneeList"
                  >
                    ▾
                  </button>
                </div>

                <div class="dropdown" v-if="showConsigneeList">
                  <div class="dropdown-item muted" v-if="loadingConsignees">
                    جاري تحميل...
                  </div>
                  <button
                    v-for="c in filteredConsignees"
                    :key="c._id || c.id"
                    type="button"
                    class="dropdown-item"
                    @click="selectConsignee(c)"
                  >
                    <div class="dd-row">
                      <span class="dd-main">{{ getConsigneeName(c) }}</span>
                      <span class="dd-sub">{{
                        c?.code || c?.CODE || getPhone(c)
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
              </div>

              <label class="field">
                <span>{{ L.PARTY_NAME }}</span>
                <input v-model="form.CONSIGNEE_NAME" type="text" />
              </label>
              <label class="field">
                <span>{{ L.PARTY_ADDRESS }}</span>
                <input v-model="form.CONSIGNEE_ADDRESS" type="text" />
              </label>
              <label class="field">
                <span>{{ L.PARTY_PHONE }}</span>
                <input v-model="form.CONSIGNEE_PHONE" type="text" />
              </label>
            </div>
          </div>
        </div>

        <!-- 3) السائق والمركبة — (10) (11) (12) -->
        <div class="card">
          <div class="card-head">
            <h3>السائق والمركبة</h3>
          </div>

          <div class="field full">
            <span>ابحث برقم السيارة أو اسم السائق</span>
            <div class="picker">
              <div class="picker-row">
                <input
                  class="picker-input"
                  v-model="driverQuery"
                  type="text"
                  :placeholder="PH.DRIVER_SEARCH"
                  @focus="showDriverList = true"
                />
                <button
                  type="button"
                  class="btn--mini"
                  @click="showDriverList = !showDriverList"
                >
                  ▾
                </button>
              </div>

              <div class="dropdown" v-if="showDriverList">
                <div class="dropdown-item muted" v-if="loadingDrivers">
                  جاري تحميل...
                </div>

                <button
                  v-for="d in filteredDrivers"
                  :key="d._id || d.id"
                  type="button"
                  class="dropdown-item"
                  @click="selectDriver(d)"
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
          </div>

          <div v-for="(r, idx) in selectedDrivers" :key="idx" class="wb-driver-row">
            <label class="field">
              <span>{{ L.TYPE_TRANSPORT }}</span>
              <select v-model="r.TYPE_TRANSPORT">
                <option value="">{{ PH.TYPE_TRANSPORT }}</option>
                <option
                  v-for="t in optionsWith(TRANSPORT_TYPE_OPTIONS, r.TYPE_TRANSPORT)"
                  :key="t"
                  :value="t"
                >
                  {{ t }}
                </option>
              </select>
            </label>
            <label class="field">
              <span>{{ L.VEHICLE_NO }}</span>
              <input :value="r.VEHICLE_NO" type="text" readonly class="is-readonly" />
            </label>
            <label class="field">
              <span>{{ L.VEHICLE_REGION }}</span>
              <input :value="r.VEHICLE_REGION" type="text" readonly class="is-readonly" />
            </label>
            <label class="field">
              <span>{{ L.DRIVER_NAME }}</span>
              <input :value="r.DRIVER_NAME" type="text" readonly class="is-readonly" />
            </label>
            <button
              type="button"
              class="btn btn--danger btn--small"
              title="حذف"
              @click="removeSelectedDriver(idx)"
            >
              ×
            </button>
          </div>
          <button
            v-if="selectedDrivers.length"
            type="button"
            class="btn btn--secondary btn--small"
            @click="clearAllDrivers"
          >
            مسح الكل
          </button>
        </div>

        <!-- 4) خط السير والاستلام والتسليم -->
        <div class="card">
          <div class="card-head">
            <h3>خط السير والاستلام والتسليم</h3>
          </div>

          <div class="grid">
            <div class="field">
              <span>{{ L.TAKING_PLACE_DATE }}</span>
              <div class="grid">
                <div>
                  <input
                    v-model="takingPlace"
                    list="wb-location-options"
                    type="text"
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
                    :class="{ 'is-invalid': errors.takingDate }"
                  />
                  <div v-if="errors.takingDate" class="error-msg">
                    {{ errors.takingDate }}
                  </div>
                </div>
              </div>
            </div>
            <div class="field">
              <span>{{ L.DELIVERY_PLACE_DATE }}</span>
              <div class="grid">
                <div>
                  <input
                    v-model="deliveryPlace"
                    list="wb-location-options"
                    type="text"
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
                    :class="{ 'is-invalid': errors.deliveryDate }"
                  />
                  <div v-if="errors.deliveryDate" class="error-msg">
                    {{ errors.deliveryDate }}
                  </div>
                </div>
              </div>
            </div>

            <label class="field full">
              <span>{{ L.ROUTE }}</span>
              <input
                v-model="form.ROUTE"
                list="wb-location-options"
                type="text"
                :class="{
                  'is-invalid': errors.route,
                  'is-readonly': !!(selectedConsignor && selectedConsignee),
                }"
                :readonly="!!(selectedConsignor && selectedConsignee)"
                :placeholder="PH.ROUTE"
              />
              <div v-if="errors.route" class="error-msg">
                {{ errors.route }}
              </div>
            </label>
          </div>
          <datalist id="wb-location-options">
            <option
              v-for="loc in locationOptions"
              :key="loc"
              :value="loc"
            ></option>
          </datalist>
        </div>

        <!-- 5) تفاصيل البضاعة — (15) → (20) بنفس ترتيب القالب المطبوع -->
        <div class="card">
          <div class="card-head">
            <h3>تفاصيل البضاعة</h3>
            <span class="badge">تفاصيل</span>
          </div>

          <div class="wb-goods-row" v-for="(g, i) in form.goodsItems" :key="i">
            <div class="wb-goods-idx">{{ i + 1 }}</div>
            <label class="field">
              <span>{{ L.MARKS }}</span>
              <input v-model="g.MARKS" type="text" />
            </label>
            <label class="field">
              <span>{{ L.PACKAGES_COUNT }}</span>
              <input v-model="g.PACKAGES_COUNT" type="number" min="0" step="1" />
            </label>
            <label class="field">
              <span>{{ L.PACKING_METHOD }}</span>
              <select v-model="g.PACKING_METHOD">
                <option
                  v-for="p in optionsWith(PACKING_METHOD_OPTIONS, g.PACKING_METHOD)"
                  :key="p"
                  :value="p"
                >
                  {{ p }}
                </option>
              </select>
            </label>
            <div class="field" style="position: relative">
              <span>{{ L.GOODS_NATURE }}</span>
              <input
                :value="g.GOODS_NATURE"
                type="text"
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
            <label class="field">
              <span>{{ L.TARIFF_CODE }}</span>
              <input v-model="g.TARIFF_CODE" type="text" />
            </label>
            <label class="field">
              <span>{{ L.GROSS_WEIGHT }}</span>
              <input v-model="g.GROSS_WEIGHT" type="number" min="0" step="0.001" />
            </label>
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

          <label class="field full" style="margin-top: 12px">
            <span>{{ L.ANNEXED_DOCS }}</span>
            <input
              v-model="form.ANNEXED_DOCS"
              type="text"
              :placeholder="PH.ANNEXED_DOCS"
            />
          </label>
        </div>

        <!-- 6) تعليمات وأجور -->
        <div class="card">
          <div class="card-head">
            <h3>تعليمات وأجور</h3>
          </div>

          <div class="grid grid--3">
            <label class="field">
              <span>{{ L.RESERVATION_DAYS }}</span>
              <input v-model.number="form.RESERVATION_DAYS" type="number" min="0" step="1" />
            </label>
            <label class="field">
              <span>{{ L.FREIGHT_CHARGE }}</span>
              <input v-model.number="form.FREIGHT_CHARGE" type="number" min="0" step="0.001" />
            </label>
            <label class="field">
              <span>{{ L.FREIGHT_PAY_PLACE_AR }}</span>
              <input v-model="form.FREIGHT_PAY_PLACE_AR" type="text" />
            </label>
            <label class="field">
              <span>{{ L.FREIGHT_PAY_PLACE_EN }}</span>
              <input v-model="form.FREIGHT_PAY_PLACE_EN" type="text" />
            </label>
            <label class="field">
              <span>{{ L.DEMURRAGE_LOADING }}</span>
              <input v-model.number="form.DEMURRAGE_LOADING" type="number" min="0" step="1" />
            </label>
          </div>
          <div class="grid grid--3" style="margin-top: 10px">
            <label class="field">
              <span>{{ L.CONSIGNER_INSTRUCTION }}</span>
              <textarea v-model="form.CONSIGNER_INSTRUCTION" rows="2"></textarea>
            </label>
            <label class="field">
              <span>{{ L.SPECIAL_TERMS }}</span>
              <textarea v-model="form.SPECIAL_TERMS" rows="2"></textarea>
            </label>
            <label class="field">
              <span>{{ L.CASH_ON_DELIVERY }}</span>
              <textarea v-model="form.CASH_ON_DELIVERY" rows="2"></textarea>
            </label>
            <label class="field">
              <span>{{ L.CASH_ON_DELIVERY_NOTES }}</span>
              <textarea v-model="form.CASH_ON_DELIVERY_NOTES" rows="3"></textarea>
            </label>
          </div>
        </div>

        <div class="footer-actions">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;">
            <input type="checkbox" v-model="showStampSignature" style="width:16px;height:16px;cursor:pointer;" />
            إضافة الختم والتوقيع
          </label>
          <button class="btn btn--ghost" type="button" @click="goBack">
            ⬅ رجوع
          </button>
          <button class="btn btn--secondary" type="button" @click="generatePdf">
            🧾 PDF
          </button>
          <button
            class="btn btn--danger"
            type="button"
            @click="deleteCurrentWaybill"
          >
            🗑 حذف
          </button>
          <button class="btn btn--primary" type="submit" :disabled="saving">
            💾 حفظ
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<style scoped>
/* ✅ نفس تخطيط شاشة الإنشاء */
.grid--3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
.party-card {
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 12px;
  background: #fafbfd;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.party-title {
  font-weight: 900;
  font-size: 14px;
}
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
}
.is-readonly {
  background: #f3f5f8;
  color: #4b5563;
}
.is-invalid {
  border-color: #ef4444 !important;
  background: #fef2f2;
}
.error-msg {
  color: #ef4444;
  font-size: 11px;
  margin-top: 4px;
  font-weight: 600;
}

/* نفس CSS تبعك بدون تغيير */
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
  color: #111827;
  overflow: hidden;
}
.topbar {
  background: #fff;
  padding: 14px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #d1d5db;
  flex-shrink: 0;
}
.app-title {
  font-size: 18px;
  font-weight: 900;
}
.app-subtitle {
  color: #6b7280;
  font-size: 12px;
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}
.dot {
  opacity: 0.6;
}
.mono {
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono",
    "Courier New", monospace;
  font-size: 11px;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 999px;
}
.main-nav {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.nav-link {
  font-size: 13px;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  color: #111827;
  background: #f9fafb;
}
.nav-link.router-link-active {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}
.main-area {
  flex: 1;
  padding: 14px 18px;
  overflow: auto;
}
.alert {
  padding: 10px 12px;
  border-radius: 14px;
  margin-bottom: 12px;
  font-size: 13px;
}
.alert--danger {
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #9f1239;
}
.alert--success {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #065f46;
}
.section-header {
  position: sticky;
  top: 0;
  z-index: 5;
  background: #eef0f3;
  padding: 8px 0 12px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-end;
  flex-wrap: wrap;
}
.section-title {
  margin: 0;
  font-size: 18px;
  font-weight: 900;
}
.section-subtitle {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.btn {
  padding: 10px 14px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 12px;
  border: 1px solid transparent;
  font-weight: 800;
}
.btn--primary {
  background: #1976d2;
  color: #fff;
}
.btn--secondary {
  background: #f3f4f6;
  color: #111827;
  border: 1px solid #d1d5db;
}
.btn--ghost {
  background: #fff;
  color: #111827;
  border: 1px solid #d1d5db;
}
.btn--danger {
  background: #fff1f2;
  color: #9f1239;
  border: 1px solid #fecdd3;
}
.btn--small {
  padding: 8px 10px;
  font-size: 12px;
  border-radius: 10px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 14px 28px rgba(0, 0, 0, 0.12);
}
.card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 10px;
}
.head-right {
  display: flex;
  gap: 8px;
  align-items: center;
}
.badge {
  font-size: 11px;
  font-weight: 900;
  padding: 4px 10px;
  border-radius: 999px;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}
.accent {
  border-left: 6px solid transparent;
}
.accent--blue {
  border-left-color: #60a5fa;
}
.accent--green {
  border-left-color: #34d399;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
}
.field.full {
  grid-column: 1/-1;
}
.field span {
  font-size: 12px;
  font-weight: 900;
  color: #374151;
}
input,
select,
textarea {
  width: 100%;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  padding: 10px 10px;
  font-size: 13px;
  outline: none;
  background: #fff;
  color: #111827;
}
input:focus,
select:focus,
textarea:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
}
.picker {
  margin-bottom: 10px;
}
.picker-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.picker-input {
  flex: 1;
}
.btn--mini {
  padding: 10px 10px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #f3f4f6;
  cursor: pointer;
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
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  padding: 6px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
}
.chip-x {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 16px;
  line-height: 1;
  opacity: 0.8;
}
.chip-x:hover {
  opacity: 1;
}
.chip-type-select {
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  font-weight: 800;
  padding: 2px 6px;
  cursor: pointer;
}
.dropdown {
  margin-top: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: #fff;
  max-height: 240px;
  overflow: auto;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
}
.dropdown-item {
  width: 100%;
  text-align: right;
  padding: 10px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #111827;
}
.dropdown-item:hover {
  background: #f3f4f6;
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
  font-weight: 900;
}
.dd-sub {
  color: #6b7280;
  font-size: 12px;
  white-space: nowrap;
}
.footer-actions {
  display: none;
  position: sticky;
  bottom: 0;
  background: rgba(238, 240, 243, 0.92);
  backdrop-filter: blur(8px);
  padding: 10px 0;
  gap: 8px;
  justify-content: space-between;
}
@media (max-width: 820px) {
  .grid {
    grid-template-columns: 1fr;
  }
  .header-actions {
    display: none;
  }
  .footer-actions {
    display: flex;
  }
}
.skeleton {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
}
.sk-line {
  height: 14px;
  border-radius: 999px;
  background: #e5e7eb;
  margin: 10px 0;
}
</style>
