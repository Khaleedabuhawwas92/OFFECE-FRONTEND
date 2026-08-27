<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

const route = useRoute();
const router = useRouter();
const waybillId = computed(() => route.params.id);

const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

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
   ✅ Multi Drivers (same box)
========================= */
const selectedDrivers = ref([]); // [{ driverId, DRIVER_NAME, VEHICLE_NO, VEHICLE_REGION, TYPE_TRANSPORT }]
const driverQuery = ref("");
const showDriverList = ref(false);

/* =========================
   Form (core fields)
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

  GOODS_NATURE: "",
  TARIFF_CODE: "",
  GROSS_WEIGHT: "",
  MARKS: "",
  PACKAGES_COUNT: "",
  PACKING_METHOD: "",
  ANNEXED_DOCS: "",
  ROUTE: "",
  DEMURRAGE_LOADING: "",
});

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

function getDriverName(d) {
  return d?.name ?? d?.NAME ?? d?.driver_name ?? d?.DRIVER_NAME ?? "";
}
function getPhone(x) {
  return x?.phone ?? x?.PHONE ?? x?.mobile ?? x?.MOBILE ?? "";
}
function getAddress(x) {
  return x?.address ?? x?.ADDRESS ?? x?.addr ?? x?.ADDR ?? "";
}
function getVehicleNo(d) {
  return d?.vehicle_no ?? d?.VEHICLE_NO ?? d?.vehicleNumber ?? "";
}
function getVehicleRegion(d) {
  return (
    d?.vehicle_city ?? d?.vehicle_region ?? d?.VEHICLE_REGION ?? d?.region ?? ""
  );
}

/**
 * ✅ تحديد نوع النقل تلقائيًا
 */
function inferTransportType(driver) {
  const raw =
    String(
      driver?.vehicle_type ??
        driver?.VEHICLE_TYPE ??
        driver?.type ??
        driver?.TYPE ??
        "",
    ).trim() || String(driver?.notes ?? driver?.NOTES ?? "").trim();

  const t = raw.toLowerCase();
  if (t.includes("تريلا") || t.includes("trailer")) return "تريلا";
  if (t.includes("سطحة") || t.includes("flatbed")) return "سطحة";
  return "تريلا - سطحة";
}

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
function selectConsignor(c) {
  selectedConsignor.value = c || null;

  form.value.CONSIGNOR_NAME = getConsignorName(c) || "";
  form.value.CONSIGNOR_PHONE = getPhone(c) || form.value.CONSIGNOR_PHONE || "";
  form.value.CONSIGNOR_ADDRESS =
    getAddress(c) || form.value.CONSIGNOR_ADDRESS || "";

  consignorQuery.value = "";
  showConsignorList.value = false;
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
}
function clearConsignee() {
  selectedConsignee.value = null;
  showConsigneeList.value = false;
}

/* =========================
   ✅ Selectors: Multi Drivers
========================= */
function driverKey(x) {
  return String(x?.driverId || x?._id || x?.id || x?.DRIVER_NAME || "");
}

function makeSelectedDriverFromDb(d) {
  return {
    driverId: d?._id || d?.id || null,
    DRIVER_NAME: getDriverName(d) || "",
    VEHICLE_NO: getVehicleNo(d) || "",
    VEHICLE_REGION: getVehicleRegion(d) || "",
    TYPE_TRANSPORT: inferTransportType(d) || "تريلا - سطحة",
  };
}

function selectDriver(d) {
  const item = makeSelectedDriverFromDb(d);
  const key = driverKey(item);
  if (selectedDrivers.value.some((x) => driverKey(x) === key)) return;

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

      GOODS_NATURE: wb.GOODS_NATURE || "",
      TARIFF_CODE: wb.TARIFF_CODE || "",
      GROSS_WEIGHT: wb.GROSS_WEIGHT || "",
      MARKS: wb.MARKS || "",
      PACKAGES_COUNT: wb.PACKAGES_COUNT || "",
      PACKING_METHOD: wb.PACKING_METHOD || "",
      ANNEXED_DOCS: wb.ANNEXED_DOCS || "",
      ROUTE: wb.ROUTE || "",
      DEMURRAGE_LOADING: wb.DEMURRAGE_LOADING || "",
    };

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
        TYPE_TRANSPORT: ttype || "تريلا - سطحة",
      });
    }

    // Back-compat قديم
    if (!arr.length) {
      const oldAny = String(wb?.DRIVER_NAME || wb?.VEHICLE_NO || "").trim();
      if (oldAny) {
        arr.push({
          driverId: null,
          DRIVER_NAME: wb?.DRIVER_NAME || "",
          VEHICLE_NO: wb?.VEHICLE_NO || "",
          VEHICLE_REGION: wb?.VEHICLE_REGION || "",
          TYPE_TRANSPORT: wb?.TYPE1_TRANSPORT || "تريلا - سطحة",
        });
      }
    }

    // ✅ match مع DB
    const drvList = drivers.value || [];
    selectedDrivers.value = arr.map((x) => {
      const found =
        (x.VEHICLE_NO &&
          drvList.find(
            (d) => String(getVehicleNo(d)) === String(x.VEHICLE_NO),
          )) ||
        (x.DRIVER_NAME &&
          drvList.find(
            (d) => String(getDriverName(d)) === String(x.DRIVER_NAME),
          ));
      return found ? makeSelectedDriverFromDb(found) : x;
    });

    // consignor/consignee match
    const consList = consignors.value || [];
    const cneeList = consignees.value || [];

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
  if (!String(form.value.DATE || "").trim()) return "تاريخ الوثيقة مطلوب";
  if (!String(form.value.CONSIGNOR_NAME || "").trim()) return "اختر المرسل";
  if (!String(form.value.CONSIGNEE_NAME || "").trim())
    return "اختر المرسل إليه";

  if (!selectedDrivers.value.length) return "اختر سائق واحد على الأقل";

  const r0 = selectedDrivers.value[0];
  if (!String(r0?.VEHICLE_NO || "").trim())
    return "رقم المركبة (السائق 1) مطلوب";
  if (!String(r0?.DRIVER_NAME || "").trim())
    return "اسم السائق (السائق 1) مطلوب";

  return "";
}

function buildSavePayload() {
  const payload = { ...form.value };

  // ✅ امسح/فرّغ القديم صراحةً (حتى ما يضل بالـ DB)
  for (let i = 1; i <= 50; i++) {
    payload[`TYPE${i}_TRANSPORT`] = "";
    payload[`VEHICLE${i}_NO`] = "";
    payload[`VEHICLE${i}_REGION`] = "";
    payload[`DRIVER${i}_NAME`] = "";
  }

  // ✅ خذ من selectedDrivers (مش driverRows)
  const cleanedRows = (selectedDrivers.value || []).filter((r) =>
    String(
      r?.DRIVER_NAME ||
        r?.VEHICLE_NO ||
        r?.VEHICLE_REGION ||
        r?.TYPE_TRANSPORT ||
        "",
    ).trim(),
  );

  cleanedRows.forEach((r, idx) => {
    const n = idx + 1;
    payload[`TYPE${n}_TRANSPORT`] = r.TYPE_TRANSPORT || "";
    payload[`VEHICLE${n}_NO`] = r.VEHICLE_NO || "";
    payload[`VEHICLE${n}_REGION`] = r.VEHICLE_REGION || "";
    payload[`DRIVER${n}_NAME`] = r.DRIVER_NAME || "";
  });

  // ✅ back-compat للجدول
  payload.driver_ids = cleanedRows.map((r) => r.driverId).filter(Boolean);
  payload.VEHICLE_NO = cleanedRows[0]?.VEHICLE_NO || "";
  payload.VEHICLE_REGION = cleanedRows[0]?.VEHICLE_REGION || "";
  payload.DRIVER_NAME = cleanedRows[0]?.DRIVER_NAME || "";

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
  window.open(
    `${API_BASE}/api/waybills/${waybillId.value}/regenerate-pdf`,
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
  await Promise.all([fetchConsignors(), fetchConsignees(), fetchDrivers()]);
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
        <!-- Card 1 -->
        <div class="card accent accent--blue">
          <div class="card-head">
            <h3>معلومات الوثيقة</h3>
            <span class="badge">أساسي</span>
          </div>

          <div class="grid">
            <label class="field">
              <span>رقم السند (ثابت)</span>
              <input v-model="form.SERIAL_NO" type="text" readonly />
            </label>

            <label class="field">
              <span>تاريخ الوثيقة</span>
              <input
                v-model="form.DATE"
                type="text"
                placeholder="مثال: 2026/01/15"
              />
            </label>

            <label class="field full">
              <span>مكان الإصدار</span>
              <input
                v-model="form.ISSUING_PLACE"
                type="text"
                placeholder="مثال: عمّان"
              />
            </label>
          </div>
        </div>

        <!-- Card 2 -->
        <div class="card accent accent--green">
          <div class="card-head">
            <h3>المرسل والمرسل إليه</h3>
            <span class="badge">DB</span>
          </div>

          <div class="grid">
            <!-- Consignor -->
            <div class="field full">
              <span>المرسل</span>

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
                    placeholder="ابحث..."
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

              <input
                v-model="form.CONSIGNOR_NAME"
                type="text"
                placeholder="أو اكتب يدويًا..."
              />
            </div>

            <label class="field">
              <span>هاتف المرسل</span>
              <input v-model="form.CONSIGNOR_PHONE" type="text" />
            </label>

            <label class="field full">
              <span>عنوان المرسل</span>
              <input v-model="form.CONSIGNOR_ADDRESS" type="text" />
            </label>

            <!-- Consignee -->
            <div class="field full">
              <span>المرسل إليه</span>

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
                    placeholder="ابحث..."
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

              <input
                v-model="form.CONSIGNEE_NAME"
                type="text"
                placeholder="أو اكتب يدويًا..."
              />
            </div>

            <label class="field">
              <span>هاتف المرسل إليه</span>
              <input v-model="form.CONSIGNEE_PHONE" type="text" />
            </label>

            <label class="field full">
              <span>عنوان المرسل إليه</span>
              <input v-model="form.CONSIGNEE_ADDRESS" type="text" />
            </label>
          </div>
        </div>

        <!-- ✅ Card 3: Multi Drivers -->
        <div class="card">
          <div class="card-head">
            <h3>السائقين والمركبات (نفس الخانة)</h3>
            <div class="head-right">
              <span class="badge">Multi</span>
              <button
                type="button"
                class="btn btn--danger btn--small"
                @click="clearAllDrivers"
              >
                مسح الكل
              </button>
            </div>
          </div>

          <div class="field full">
            <span>اختَر من القائمة (كل اختيار ينضاف Chip وتقدر تحذف)</span>

            <div class="chips" v-if="selectedDrivers.length">
              <span class="chip" v-for="(d, idx) in selectedDrivers" :key="idx">
                {{ d.DRIVER_NAME }} — {{ d.VEHICLE_NO }} •
                {{ d.VEHICLE_REGION }} • {{ d.TYPE_TRANSPORT }}
                <button
                  type="button"
                  class="chip-x"
                  @click="removeSelectedDriver(idx)"
                >
                  ×
                </button>
              </span>
            </div>

            <div class="picker">
              <div class="picker-row">
                <input
                  class="picker-input"
                  v-model="driverQuery"
                  type="text"
                  placeholder="ابحث بالاسم/المركبة/المنطقة..."
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
                    <span class="dd-main">{{ getDriverName(d) }}</span>
                    <span class="dd-sub"
                      >{{ getVehicleNo(d) }} • {{ getVehicleRegion(d) }}</span
                    >
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
        </div>

        <!-- Card 4 -->
        <div class="card">
          <div class="card-head">
            <h3>بيانات البضاعة</h3>
            <span class="badge">تفاصيل</span>
          </div>

          <div class="grid">
            <label class="field full">
              <span>طبيعة البضاعة</span>
              <input v-model="form.GOODS_NATURE" type="text" />
            </label>

            <label class="field">
              <span>قيمة البضاعة</span>
              <input v-model="form.TARIFF_CODE" type="text" />
            </label>

            <label class="field">
              <span>الوزن القائم</span>
              <input v-model="form.GROSS_WEIGHT" type="text" />
            </label>

            <label class="field">
              <span>العلامات والأرقام</span>
              <input v-model="form.MARKS" type="text" />
            </label>

            <label class="field">
              <span>عدد الطرود</span>
              <input v-model="form.PACKAGES_COUNT" type="text" />
            </label>

            <label class="field">
              <span>نوع التغليف</span>
              <input v-model="form.PACKING_METHOD" type="text" />
            </label>

            <label class="field full">
              <span>المستندات المرفقة</span>
              <input v-model="form.ANNEXED_DOCS" type="text" />
            </label>
          </div>
        </div>

        <!-- Card 5 -->
        <div class="card">
          <div class="card-head">
            <h3>خط السير ومدة المكوث</h3>
            <span class="badge">مسار</span>
          </div>

          <div class="grid">
            <label class="field full">
              <span>خط السير</span>
              <input v-model="form.ROUTE" type="text" />
            </label>

            <label class="field">
              <span>مدة المكوث على أرض التحميل</span>
              <input v-model="form.DEMURRAGE_LOADING" type="text" />
            </label>
          </div>
        </div>

        <div class="footer-actions">
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
input {
  width: 100%;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  padding: 10px 10px;
  font-size: 13px;
  outline: none;
  background: #fff;
  color: #111827;
}
input:focus {
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
