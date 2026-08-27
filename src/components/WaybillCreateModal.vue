<script setup>
import { ref, computed, onMounted, watch } from "vue";
import axios from "axios";
import PreviewModal from "./dashboard/PreviewModal.vue";

const props = defineProps({
  apiBase: { type: String, required: true },
});

const emit = defineEmits(["close", "saved"]);

const loading = ref(false);
const openPreview = ref(false);
const previewHtml = ref("");
const tplCache = ref(null);
const modalRef = ref(null);

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

  goodsItems: [
    {
      GOODS_NATURE: "",
      TARIFF_CODE: "",
      GROSS_WEIGHT: 0,
      MARKS: "",
      PACKAGES_COUNT: 0,
      PACKING_METHOD: "طرد",
    },
  ],

  // تعليمات وأجور
  DEMURRAGE_LOADING: 0,
  CONSIGNER_INSTRUCTION: "",
  SPECIAL_TERMS: "",
  CASH_ON_DELIVERY: 0,

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
    form.value.TAKING_PLACE_DATE = p && d ? `${p} - ${d}` : "";
  },
  { immediate: true },
);

watch(
  [deliveryPlace, deliveryDate],
  ([p, d]) => {
    form.value.DELIVERY_PLACE_DATE = p && d ? `${p} - ${d}` : "";
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
  await Promise.all([fetchDrivers(), fetchConsignors(), fetchConsignees()]);
  await fetchNextSerial(); // ✅ عرض الرقم فقط (peek)
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
function toIdStr(x) {
  if (!x) return "";
  return String(x?._id ?? x?.id ?? x?.$oid ?? x);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

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

function getVehicleRegion(d) {
  return (
    d?.VEHICLE_REGION ??
    d?.vehicle_region ??
    d?.region ??
    d?.REGION ??
    d?.country ??
    d?.COUNTRY ??
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
function normalizeCharges() {
  [
    "RESERVATION_DAYS",
    "FREIGHT_CHARGE",
    "DEMURRAGE_LOADING",
    "CHARGE1_CONSIGNEE",
    "CHARGE1_CONSIGNOR",
    "CHARGE2_CONSIGNEE",
    "CHARGE2_CONSIGNOR",
    "CHARGE3_CONSIGNEE",
    "CHARGE3_CONSIGNOR",
    "DEDUCTIONS",
  ].forEach((k) => {
    if (!Number.isFinite(Number(form.value[k]))) {
      form.value[k] = 0;
    }
  });
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
const selectedDrivers = computed(() => {
  const ids = (form.value.driver_ids || []).map(String);
  return (drivers.value || []).filter((d) => ids.includes(String(d?._id)));
});

// ✅ نصوص (كل واحد بسطر) للفورم
const selectedDriverNameText = computed(() => {
  return selectedDrivers.value.map(getDriverName).filter(Boolean).join("\n");
});
const selectedVehicleNoText = computed(() => {
  return selectedDrivers.value.map(getVehicleNo).filter(Boolean).join("\n");
});
const selectedVehicleRegionText = computed(() => {
  return selectedDrivers.value.map(getVehicleRegion).filter(Boolean).join("\n");
});

/* =========================
   Select handlers
========================= */
function syncDriverFieldsFromSelected() {
  form.value.DRIVER_NAME = selectedDriverNameText.value || "";
  form.value.VEHICLE_NO = selectedVehicleNoText.value || "";
  form.value.VEHICLE_REGION = selectedVehicleRegionText.value || "";
}

function addDriver(d) {
  const id = toIdStr(d?._id);
  if (!id) return;

  const cur = (form.value.driver_ids || []).map(String);
  if (!cur.includes(String(id))) form.value.driver_ids.push(String(id));

  syncDriverFieldsFromSelected();
  driverQuery.value = "";
  showDriverList.value = false;
}

function removeDriver(id) {
  form.value.driver_ids = (form.value.driver_ids || [])
    .map(String)
    .filter((x) => x !== String(id));

  syncDriverFieldsFromSelected();
}

function clearDrivers() {
  form.value.driver_ids = [];
  form.value.DRIVER_NAME = "";
  form.value.VEHICLE_NO = "";
  form.value.VEHICLE_REGION = "";
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
function makeEmptyGoodsItem() {
  return {
    GOODS_NATURE: "",
    TARIFF_CODE: "",
    GROSS_WEIGHT: 0,
    MARKS: "",
    PACKAGES_COUNT: 0,
    PACKING_METHOD: "طرد",
  };
}

function addGoodsItem() {
  form.value.goodsItems.push(makeEmptyGoodsItem());
}

function removeGoodsItem(i) {
  if (form.value.goodsItems.length === 1) return;
  form.value.goodsItems.splice(i, 1);
}

function syncGoodsItemsToLegacy() {
  const first = form.value.goodsItems?.[0];
  if (!first) return;
  form.value.GOODS_NATURE = first.GOODS_NATURE || "";
  form.value.TARIFF_CODE = first.TARIFF_CODE || "";
  form.value.GROSS_WEIGHT = first.GROSS_WEIGHT || 0;
  form.value.MARKS = first.MARKS || "";
  form.value.PACKAGES_COUNT = first.PACKAGES_COUNT || 0;
  form.value.PACKING_METHOD = first.PACKING_METHOD || "طرد";
}

function buildGoodsRowsHtml() {
  const items = form.value.goodsItems || [];
  if (!items.length) return "";
  return items
    .map(
      (it) => `
    <tr>
      <td style="border-top:1px solid #222;border-right:1px solid #222;height:28px;text-align:center;" class="val-center">${escapeHtml(it.GOODS_NATURE || "")}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(it.TARIFF_CODE || "")}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(String(it.GROSS_WEIGHT ?? ""))}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(it.MARKS || "")}</td>
      <td style="border-top:1px solid #222;border-right:1px solid #222;text-align:center;" class="val-center">${escapeHtml(String(it.PACKAGES_COUNT ?? ""))}</td>
      <td style="border-top:1px solid #222;text-align:center;" class="val-center">${escapeHtml(it.PACKING_METHOD || "")}</td>
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
function fillTemplate(template, obj) {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    const v =
      obj[key] ?? obj[key.toUpperCase()] ?? obj[key.toLowerCase()] ?? "";
    return v == null ? "" : String(v);
  });
}

// ✅ تحويل نص متعدد الأسطر إلى HTML أسطر (للتمبليت فقط)
function textToHtmlLines(s) {
  return String(s || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => `<span class="v-line">${x}</span>`)
    .join("");
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
  if (!form.value.DATE) return "التاريخ مطلوب";
  if (!form.value.CONSIGNOR_NAME) return "اختر المرسل من البحث";
  if (!form.value.CONSIGNEE_NAME) return "اختر المستلم من البحث";
  if (!(form.value.driver_ids || []).length) return "اختر سائق/مركبة من البحث";
  if (!form.value.VEHICLE_NO) return "رقم المركبة مطلوب";

  // Route section validation
  errors.value.takingPlace = takingPlace.value.trim()
    ? ""
    : "يرجى اختيار مكان الاستلام";
  errors.value.takingDate = takingDate.value ? "" : "يرجى تحديد تاريخ الاستلام";
  errors.value.deliveryPlace = deliveryPlace.value.trim()
    ? ""
    : "يرجى اختيار مكان التسليم";
  errors.value.deliveryDate = deliveryDate.value
    ? ""
    : "يرجى تحديد تاريخ التسليم";
  errors.value.route = form.value.ROUTE?.trim() ? "" : "يرجى تحديد خط السير";

  const hasRouteErrors = Object.values(errors.value).some(Boolean);
  if (hasRouteErrors) return "يرجى تعبئة بيانات خط السير والاستلام والتسليم";

  return "";
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
      DRIVER_NAME: textToHtmlLines(form.value.DRIVER_NAME),
      VEHICLE_NO: textToHtmlLines(form.value.VEHICLE_NO),
      VEHICLE_REGION: textToHtmlLines(form.value.VEHICLE_REGION),
      GOODS_ROWS: buildGoodsRowsHtml(),
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
    const payload = { ...form.value };

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
              <label>رقم السند</label>
              <input
                v-model="form.SERIAL_NO"
                class="input input--readonly"
                readonly
              />
            </div>
            <div class="field">
              <label>التاريخ</label>
              <input v-model="form.DATE" type="date" class="input" />
            </div>
            <div class="field">
              <label>مكان الإصدار</label>
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
              <div class="party-title">المرسل</div>

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

              <div class="info-rows">
                <div><b>العنوان:</b> {{ form.CONSIGNOR_ADDRESS || "—" }}</div>
                <div><b>الهاتف:</b> {{ form.CONSIGNOR_PHONE || "—" }}</div>
              </div>
            </div>

            <!-- المستلم -->
            <div class="party-card">
              <div class="party-title">المستلم</div>

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
                placeholder="ابحث عن المستلم..."
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

              <div class="info-rows">
                <div><b>العنوان:</b> {{ form.CONSIGNEE_ADDRESS || "—" }}</div>
                <div><b>الهاتف:</b> {{ form.CONSIGNEE_PHONE || "—" }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- 3) السائق والمركبة -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>السائق والمركبة</h3>
          </div>

          <!-- Search -->
          <div class="field" style="margin-bottom: 12px">
            <label>ابحث برقم السيارة أو اسم السائق</label>
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
              <button
                v-if="selectedDrivers.length"
                type="button"
                class="btn btn--small btn--secondary"
                @click="clearDrivers"
              >
                مسح الكل
              </button>
            </div>
            <input
              v-model="driverQuery"
              class="input"
              placeholder="اكتب رقم السيارة / اسم السائق..."
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

          <div class="row three-col">
            <div class="field">
              <label>نوع وسيلة النقل</label>
              <input
                v-model="form.TYPE_TRANSPORT"
                class="input"
                placeholder="Truck / Trailer..."
              />
            </div>
            <div class="field">
              <label>رقم المركبة</label>
              <textarea
                :value="selectedVehicleNoText"
                class="textarea textarea--compact"
                rows="2"
                readonly
              ></textarea>
            </div>
            <div class="field">
              <label>المنطقة / الدولة</label>
              <textarea
                :value="selectedVehicleRegionText"
                class="textarea textarea--compact"
                rows="2"
                readonly
              ></textarea>
            </div>
          </div>
          <div class="field" style="margin-top: 10px">
            <label>اسم السائق</label>
            <textarea
              :value="selectedDriverNameText"
              class="textarea textarea--compact"
              rows="2"
              readonly
            ></textarea>
          </div>
        </section>

        <!-- 4) خط السير والاستلام والتسليم -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>خط السير والاستلام والتسليم</h3>
          </div>
          <div class="row two-col">
            <div class="field">
              <label>مكان وتاريخ استلام البضاعة</label>
              <div class="row two-col" style="gap: 8px">
                <div>
                  <input
                    v-model="takingPlace"
                    list="location-options"
                    class="input"
                    :class="{ 'is-invalid': errors.takingPlace }"
                    placeholder="مكان الاستلام"
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
              <label>مكان وتاريخ تسليم البضاعة</label>
              <div class="row two-col" style="gap: 8px">
                <div>
                  <input
                    v-model="deliveryPlace"
                    list="location-options"
                    class="input"
                    :class="{ 'is-invalid': errors.deliveryPlace }"
                    placeholder="مكان التسليم"
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
            <label>خط السير (Route)</label>
            <input
              v-model="form.ROUTE"
              list="location-options"
              class="input"
              :class="{
                'is-invalid': errors.route,
                'input--readonly': !!(selectedConsignor && selectedConsignee),
              }"
              :readonly="!!(selectedConsignor && selectedConsignee)"
              placeholder="عمّان → الحدود → بغداد"
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

        <!-- 5) تفاصيل البضاعة -->
        <section class="form-card">
          <div class="card-head">
            <span class="card-dot"></span>
            <h3>تفاصيل البضاعة</h3>
          </div>

          <div
            class="goods-row"
            v-for="(g, i) in form.goodsItems"
            :key="i"
            style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; align-items: end; margin-bottom: 8px;"
          >
            <div class="field">
              <label>طبيعة البضاعة</label>
              <input v-model="g.GOODS_NATURE" class="input" />
            </div>
            <div class="field">
              <label>الرمز الجمركي</label>
              <input v-model="g.TARIFF_CODE" class="input" />
            </div>
            <div class="field">
              <label>Gross Weight</label>
              <input v-model="g.GROSS_WEIGHT" class="input" type="number" min="0" step="0.001" />
            </div>
            <div class="field">
              <label>الأرقام والعلامات</label>
              <input v-model="g.MARKS" class="input" />
            </div>
            <div class="field">
              <label>عدد الطرود</label>
              <input v-model="g.PACKAGES_COUNT" class="input" type="number" min="0" step="1" />
            </div>
            <div class="field" style="display: flex; gap: 6px; align-items: flex-end;">
              <div style="flex: 1;">
                <label>نوع التغليف</label>
                <select v-model="g.PACKING_METHOD" class="input">
                  <option value="طرد">طرد</option>
                  <option value="وحدة">وحدة</option>
                  <option value="طبلية">طبلية</option>
                  <option value="كرتونة">كرتونة</option>
                </select>
              </div>
              <button
                type="button"
                class="btn btn--danger btn--small"
                @click="removeGoodsItem(i)"
                title="حذف"
              >
                ×
              </button>
            </div>
          </div>

          <div style="margin-top: 6px;">
            <button type="button" class="btn btn--secondary btn--small" @click="addGoodsItem">
              ➕ إضافة تفصيلة
            </button>
          </div>

          <div class="row three-col" style="margin-top: 12px;">
            <div class="field">
              <label>المستندات المرفقة</label>
              <input
                v-model="form.ANNEXED_DOCS"
                class="input"
                placeholder="Invoice, Packing List..."
              />
            </div>
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
              <label>بدل عطل (أيام)</label>
              <input
                v-model.number="form.RESERVATION_DAYS"
                type="number"
                min="0"
                step="1"
                class="input"
              />
            </div>
            <div class="field">
              <label>أجور الشحن</label>
              <input
                v-model.number="form.FREIGHT_CHARGE"
                type="number"
                min="0"
                step="0.001"
                class="input"
              />
            </div>
            <div class="field">
              <label>تدفع في (عربي)</label>
              <input v-model="form.FREIGHT_PAY_PLACE_AR" class="input" />
            </div>
            <div class="field">
              <label>Paid at (English)</label>
              <input v-model="form.FREIGHT_PAY_PLACE_EN" class="input" />
            </div>
          </div>
          <div class="row three-col" style="margin-top: 10px">
            <div class="field">
              <label>تعليمات المرسل</label>
              <textarea
                v-model="form.CONSIGNER_INSTRUCTION"
                class="textarea textarea--compact"
                rows="2"
              ></textarea>
            </div>
            <div class="field">
              <label>اتفاقيات خاصة</label>
              <textarea
                v-model="form.SPECIAL_TERMS"
                class="textarea textarea--compact"
                rows="2"
              ></textarea>
            </div>
            <div class="field">
              <label>الدفع عند التسليم</label>
              <textarea
                v-model="form.CASH_ON_DELIVERY"
                class="textarea textarea--compact"
                rows="2"
              ></textarea>
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
  width: min(1220px, 96vw);
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
