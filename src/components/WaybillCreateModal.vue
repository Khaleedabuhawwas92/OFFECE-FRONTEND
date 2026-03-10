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
    const { data } = await axios.get(
      `${props.apiBase}/api/waybills/next-serial`,
    );
    form.value.SERIAL_NO = data?.SERIAL_NO || "";
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
  () => {
    if (!form.value.DATE) return;

    const baseDate = form.value.DATE;
    const days = Number(form.value.RESERVATION_DAYS || 2);

    // مكان الاستلام = مكان الإصدار
    form.value.TAKING_PLACE_DATE = `${form.value.ISSUING_PLACE} - ${baseDate}`;

    // مكان التسليم = نفس المكان + أيام
    const deliveryDate = addDays(baseDate, days);
    form.value.DELIVERY_PLACE_DATE = `${form.value.ISSUING_PLACE} - ${deliveryDate}`;
  },
  { immediate: true },
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

function validate() {
  // ✅ لا تشترط SERIAL_NO — السيرفر مسؤول
  if (!form.value.DATE) return "التاريخ مطلوب";
  if (!form.value.CONSIGNOR_NAME) return "اختر المرسل من البحث";
  if (!form.value.CONSIGNEE_NAME) return "اختر المستلم من البحث";
  if (!(form.value.driver_ids || []).length) return "اختر سائق/مركبة من البحث";
  if (!form.value.VEHICLE_NO) return "رقم المركبة مطلوب";
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
  loading.value = true;
  try {
    normalizeCharges();
    syncDriverFieldsFromSelected();

    // ✅ لا تحذف SERIAL_NO (لو موجود) — والسيرفر رح يقرر النهائي
    const payload = { ...form.value };

    const { data } = await axios.post(`${props.apiBase}/api/waybills`, payload);

    // ✅ خزّن الرقم النهائي الذي قرره السيرفر
    if (data?.SERIAL_NO) form.value.SERIAL_NO = data.SERIAL_NO;

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
      <div class="modal-top">
        <div class="title-block">
          <h1>➕ بوليصة جديدة</h1>
          <p>اختر المرسل/المستلم/السائق من البحث ثم اعمل معاينة أو حفظ</p>
        </div>

        <div class="top-actions">
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
            <span v-if="loading">...جاري الحفظ</span>
            <span v-else>💾 حفظ</span>
          </button>

          <button class="btn btn--x" type="button" @click="emit('close')">
            ✕
          </button>
        </div>
      </div>

      <div class="modal-body">
        <div class="page">
          <div class="card">
            <!-- 1) بيانات عامة -->
            <div class="section">
              <div class="section-title">بيانات عامة</div>

              <div class="grid">
                <div class="field">
                  <label>رقم السند (Serial No.)</label>
                  <input v-model="form.SERIAL_NO" class="input" readonly />
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
            </div>

            <!-- 2) المرسل / المستلم -->
            <div class="section">
              <div class="section-title">المرسل / المستلم (بحث)</div>

              <div class="grid2">
                <!-- CONSIGNOR -->
                <div class="subcard">
                  <div class="sub-title">المرسل (Consignor)</div>

                  <div class="chips" v-if="selectedConsignor">
                    <span class="chip">
                      {{ getPartyName(selectedConsignor) }}
                      <button
                        type="button"
                        class="chip-x"
                        @click="clearConsignor"
                      >
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
                        <span class="dd-sub" v-if="c?.code || c?.CODE">
                          {{ c?.code || c?.CODE }}
                        </span>
                      </div>
                    </button>

                    <div
                      class="dropdown-item muted"
                      v-if="
                        !loadingConsignors && filteredConsignors.length === 0
                      "
                    >
                      لا يوجد نتائج
                    </div>
                  </div>

                  <div class="mini">
                    <div>
                      <b>العنوان:</b> {{ form.CONSIGNOR_ADDRESS || "—" }}
                    </div>
                    <div><b>الهاتف:</b> {{ form.CONSIGNOR_PHONE || "—" }}</div>
                  </div>
                </div>

                <!-- CONSIGNEE -->
                <div class="subcard">
                  <div class="sub-title">المستلم (Consignee)</div>

                  <div class="chips" v-if="selectedConsignee">
                    <span class="chip">
                      {{ getPartyName(selectedConsignee) }}
                      <button
                        type="button"
                        class="chip-x"
                        @click="clearConsignee"
                      >
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
                        <span class="dd-sub" v-if="c?.code || c?.CODE">
                          {{ c?.code || c?.CODE }}
                        </span>
                      </div>
                    </button>

                    <div
                      class="dropdown-item muted"
                      v-if="
                        !loadingConsignees && filteredConsignees.length === 0
                      "
                    >
                      لا يوجد نتائج
                    </div>
                  </div>

                  <div class="mini">
                    <div>
                      <b>العنوان:</b> {{ form.CONSIGNEE_ADDRESS || "—" }}
                    </div>
                    <div><b>الهاتف:</b> {{ form.CONSIGNEE_PHONE || "—" }}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 3) السائق والمركبة (متعدد) -->
            <div class="section">
              <div class="section-title">السائق والمركبة (بحث) — متعدد</div>

              <div class="grid">
                <div class="field full">
                  <label
                    >ابحث برقم السيارة أو اسم السائق واختر (يمكن أكثر من
                    واحد)</label
                  >

                  <div class="chips" v-if="selectedDrivers.length">
                    <span
                      class="chip"
                      v-for="d in selectedDrivers"
                      :key="d._id"
                    >
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
                      class="btn btn--secondary"
                      style="padding: 6px 10px; border-radius: 999px"
                      @click="clearDrivers"
                    >
                      مسح السواقين
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

                <div class="field">
                  <label>نوع وسيلة النقل</label>
                  <input
                    v-model="form.TYPE_TRANSPORT"
                    class="input"
                    placeholder="Truck / Trailer..."
                  />
                </div>

                <div class="field">
                  <label>رقم المركبة (كل واحد بسطر)</label>
                  <textarea
                    :value="selectedVehicleNoText"
                    class="textarea"
                    rows="3"
                    readonly
                  ></textarea>
                </div>

                <div class="field">
                  <label>المنطقة / الدولة (كل واحد بسطر)</label>
                  <textarea
                    :value="selectedVehicleRegionText"
                    class="textarea"
                    rows="3"
                    readonly
                  ></textarea>
                </div>

                <div class="field">
                  <label>اسم السائق (كل واحد بسطر)</label>
                  <textarea
                    :value="selectedDriverNameText"
                    class="textarea"
                    rows="3"
                    readonly
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- باقي الأقسام كما هي -->
            <div class="section">
              <div class="section-title">خط السير والاستلام/التسليم</div>

              <div class="grid">
                <div class="field">
                  <label>مكان وتاريخ استلام البضاعة</label>
                  <input
                    v-model="form.TAKING_PLACE_DATE"
                    class="input"
                    readonly
                  />
                </div>

                <div class="field">
                  <label>مكان وتاريخ تسليم البضاعة</label>
                  <input
                    v-model="form.DELIVERY_PLACE_DATE"
                    class="input"
                    readonly
                  />
                </div>

                <div class="field full">
                  <label>خط السير (Route)</label>
                  <textarea
                    v-model="form.ROUTE"
                    class="textarea"
                    rows="2"
                    placeholder="عمّان → الحدود → بغداد"
                  ></textarea>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">تفاصيل البضاعة</div>

              <div class="grid">
                <div class="field">
                  <label>طبيعة البضاعة</label>
                  <input v-model="form.GOODS_NATURE" class="input" />
                </div>
                <div class="field">
                  <label>قيمة البضاعة</label>
                  <input v-model="form.TARIFF_CODE" class="input" />
                </div>
                <div class="field">
                  <label>Gross Weight</label>
                  <input v-model="form.GROSS_WEIGHT" class="input" />
                </div>

                <div class="field">
                  <label>عدد الطرود</label>
                  <input v-model="form.PACKAGES_COUNT" class="input" />
                </div>
                <div class="field">
                  <label>نوع التغليف</label>
                  <select v-model="form.PACKING_METHOD" class="input">
                    <option value="">— اختر نوع التغليف —</option>
                    <option value="طرد">طرد</option>
                    <option value="وحدة">وحدة</option>
                    <option value="طبلية">طبلية</option>
                    <option value="كرتونة">كرتونة</option>
                  </select>
                </div>

                <div class="field full">
                  <label>المستندات المرفقة</label>
                  <input
                    v-model="form.ANNEXED_DOCS"
                    class="input"
                    placeholder="Invoice, Packing List..."
                  />
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">تعليمات وأجور</div>

              <div class="grid">
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

                <div class="field full">
                  <label>تعليمات المرسل</label>
                  <textarea
                    v-model="form.CONSIGNER_INSTRUCTION"
                    class="textarea"
                    rows="2"
                  ></textarea>
                </div>

                <div class="field full">
                  <label>اتفاقيات خاصة</label>
                  <textarea
                    v-model="form.SPECIAL_TERMS"
                    class="textarea"
                    rows="2"
                  ></textarea>
                </div>

                <div class="field full">
                  <label>الدفع عند التسليم</label>
                  <textarea
                    v-model="form.CASH_ON_DELIVERY"
                    class="textarea"
                    rows="2"
                  ></textarea>
                </div>
              </div>
            </div>

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
    </div>
  </div>
</template>

<style scoped>
/* نفس CSS تبعك */
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 18px;
  z-index: 9999;
}
.modal {
  width: min(1200px, 100%);
  background: #fff;
  border-radius: 14px;
  border: 1px solid #ddd;
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
  overflow: hidden;
  max-height: calc(100vh - 36px);
  display: flex;
  flex-direction: column;
}
.modal-top {
  background: #fafafa;
  border-bottom: 1px solid #eee;
  padding: 12px 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}
.modal-body {
  overflow: auto;
}
.btn--x {
  background: transparent;
  border: 1px solid #ddd;
  color: #333;
}
.page {
  background: #eef0f3;
  padding: 16px 16px;
  direction: rtl;
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: #222;
}
.title-block h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}
.title-block p {
  margin: 6px 0 0;
  color: #666;
  font-size: 13px;
}
.top-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  max-width: 1100px;
  margin: 0 auto;
}
.section {
  padding: 12px 0;
  border-bottom: 1px dashed #e5e5e5;
}
.section:last-child {
  border-bottom: none;
}
.section-title {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 10px;
  color: #111;
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-title::before {
  content: "";
  width: 10px;
  height: 10px;
  border-radius: 3px;
  background: #1976d2;
  display: inline-block;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.subcard {
  border: 1px solid #e1e1e1;
  border-radius: 10px;
  padding: 12px;
  background: #fafafa;
}
.sub-title {
  font-size: 13px;
  font-weight: 800;
  margin-bottom: 10px;
  color: #222;
}
.field label {
  display: block;
  font-size: 12px;
  color: #555;
  margin-bottom: 6px;
  font-weight: 700;
}
.input,
.textarea {
  width: 100%;
  border: 1px solid #cfcfcf;
  border-radius: 8px;
  padding: 10px 10px;
  font-size: 13px;
  outline: none;
  background: #fff;
  box-sizing: border-box;
}
.textarea {
  resize: vertical;
  min-height: 80px;
  white-space: pre-wrap; /* ✅ يظهر \n */
}
.full {
  grid-column: 1 / -1;
}
.btn {
  padding: 8px 14px;
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
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
  color: #333;
}

.dropdown {
  margin-top: 6px;
  border: 1px solid #ddd;
  border-radius: 10px;
  background: #fff;
  max-height: 220px;
  overflow: auto;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08);
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
  background: #f5f7fb;
}
.dropdown-item.muted {
  cursor: default;
  color: #666;
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
  color: #666;
  font-size: 12px;
  white-space: nowrap;
}
.mini {
  margin-top: 10px;
  font-size: 12px;
  color: #444;
  display: grid;
  gap: 6px;
}
@media (max-width: 900px) {
  .grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .grid2 {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 600px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
