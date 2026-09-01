<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { useRouter, useRoute } from "vue-router";
import PreviewModal from "./dashboard/PreviewModal.vue";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";
const router = useRouter();
const route = useRoute();

const invoiceId = computed(() => route.params.id || route.query.id || "");

/* =========================
   UI state
========================= */
const loading = ref(false);
const loadingInvoice = ref(false);

const openPreview = ref(false);
const previewHtml = ref("");
const invoiceTemplateCache = ref(null);
const modalRef = ref(null);
const showStampSignature = ref(false);

/* =========================
   Drivers (Search by Vehicle No)
========================= */
const drivers = ref([]);
const loadingDrivers = ref(false);
const driverQuery = ref("");
const showDriverList = ref(false);

/* =========================
   Consignors (Sender)
========================= */
const consignors = ref([]);
const loadingConsignors = ref(false);
const consignorQuery = ref("");
const showConsignorList = ref(false);
const selectedConsignor = ref(null);

/* =========================
   Form
========================= */
const form = ref({
  date: "",
  company: "",
  consignor_id: "",
  driver_ids: [],
  items: [
    {
      desc: "",
      amount: "",
      currency: "JOD",
      rate_to_jod: 1,
      amount_jod: 0,
    },
  ],
  notes: "",
});

// اختياري (للعرض فقط)
const invoiceNumber = ref(""); // لو السيرفر رجع invoice_number

/* =========================
   Fetch lists
========================= */
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

/* =========================
   Read Invoice By Id ✅
========================= */
function normalizeItems(items) {
  const arr = Array.isArray(items) ? items : [];
  if (!arr.length) return [makeEmptyItem()];

  return arr.map((x) => {
    const it = {
      desc: x?.desc ?? x?.DESC ?? "",
      amount: x?.amount ?? x?.AMOUNT ?? "",
      currency: x?.currency ?? x?.CURRENCY ?? "JOD",
      rate_to_jod:
        x?.rate_to_jod ?? x?.RATE_TO_JOD ?? RATES_TO_JOD[x?.currency] ?? 1,
      amount_jod: x?.amount_jod ?? x?.AMOUNT_JOD ?? 0,
    };
    // ضمان أرقام صحيحة
    if (!it.rate_to_jod) it.rate_to_jod = RATES_TO_JOD[it.currency] ?? 1;
    recalcItem(it);
    return it;
  });
}

async function fetchInvoiceById() {
  const id = String(invoiceId.value || "").trim();
  if (!id) {
    alert("❌ لا يوجد ID للفاتورة في الرابط");
    return;
  }

  loadingInvoice.value = true;
  try {
    // ✅ عدّل المسار حسب عندك
    const res = await axios.get(`${API_BASE}/api/invoices/${id}`);
    const inv = res?.data || {};

    invoiceNumber.value = inv?.invoice_number || inv?.INVOICE_NUMBER || "";

    form.value.date = inv?.date || inv?.DATE || "";
    form.value.company = inv?.company || inv?.COMPANY || "";
    form.value.consignor_id = inv?.consignor_id || inv?.CONSIGNOR_ID || "";

    // drivers: ممكن السيرفر يرجع ids أو objects
    const rawDrivers = inv?.driver_ids ?? inv?.drivers ?? [];
    const ids =
      Array.isArray(rawDrivers) && rawDrivers.length
        ? rawDrivers
            .map((d) => (typeof d === "string" ? d : d?._id || d?.id))
            .filter(Boolean)
        : [];
    form.value.driver_ids = ids;

    form.value.items = normalizeItems(inv?.items);

    form.value.notes = inv?.notes || inv?.NOTES || "";

    // ✅ حاول نحدد selectedConsignor من consignor_id أو company
    const cid = form.value.consignor_id;
    if (cid && (consignors.value || []).length) {
      const found = consignors.value.find((c) => (c?._id || c?.id) === cid);
      if (found) selectedConsignor.value = found;
    } else if (form.value.company && (consignors.value || []).length) {
      const found = consignors.value.find(
        (c) => getConsignorName(c) === form.value.company
      );
      if (found) {
        selectedConsignor.value = found;
        form.value.consignor_id = found?._id || found?.id || "";
      }
    }
  } catch (e) {
    console.error("fetch invoice error:", e);
    alert("❌ فشل تحميل الفاتورة. تأكد من GET /api/invoices/:id");
  } finally {
    loadingInvoice.value = false;
  }
}

/* =========================
   Field readers (safe)
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
   Items
========================= */
function makeEmptyItem() {
  return {
    desc: "",
    amount: "",
    currency: "JOD",
    rate_to_jod: 1,
    amount_jod: 0,
  };
}

function addItemRow() {
  form.value.items.push(makeEmptyItem());
}

function removeItemRow(i) {
  if (form.value.items.length === 1) {
    form.value.items[0] = makeEmptyItem();
    return;
  }
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
  const amt = parseFloat(it.amount);
  const rate = parseFloat(it.rate_to_jod);

  const a = isNaN(amt) ? 0 : amt;
  const r = isNaN(rate) ? 1 : rate;

  it.amount_jod = Number((a * r).toFixed(3));
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
   Drivers selection computed
========================= */
const filteredDrivers = computed(() => {
  const q = String(driverQuery.value || "")
    .toLowerCase()
    .trim();
  const list = drivers.value || [];
  if (!q) return list;

  return list.filter((d) => {
    const name = String(getDriverName(d)).toLowerCase();
    return name.includes(q);
  });
});

const selectedDriver = computed(() => {
  const id = (form.value.driver_ids || [])[0];
  if (!id) return null;
  return (drivers.value || []).find((d) => d._id === id) || null;
});

function selectDriver(d) {
  const id = d?._id;
  if (!id) return;
  form.value.driver_ids = [id];
  driverQuery.value = "";
  showDriverList.value = false;
}

function clearDriver() {
  form.value.driver_ids = [];
  driverQuery.value = "";
}

/* =========================
   Consignors computed
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
function goBack() {
  router.push("/");
}

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
    return "اختر المرسل (اسم الشركة)";
  if (!(form.value.driver_ids || []).length)
    return "اختر السائق";

  const okItems = (form.value.items || []).some((it) => {
    const hasDesc = String(it?.desc || "").trim().length > 0;
    const hasAmount = String(it?.amount || "").trim().length > 0;
    return hasDesc && hasAmount;
  });
  if (!okItems) return "أدخل تفصيلة واحدة على الأقل (وصف + مبلغ)";

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
      (x) => String(x?.desc || "").trim() || String(x?.amount || "").trim()
    )
    .map((it) => {
      const escDesc = String(it?.desc || "")
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

  const driverNamesArr = selectedDriver.value
    ? [getDriverName(selectedDriver.value)].filter(Boolean)
    : [];
  const vehicleNosArr = selectedDriver.value
    ? [getVehicleNo(selectedDriver.value)].filter(Boolean)
    : [];

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
    INVOICE_NO: invoiceNumber.value || "—",
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
    STAMP_SIGNATURE_BLOCK: showStampSignature.value
      ? `<div style="position:relative;width:100%;height:44px;margin-top:4px;display:flex;justify-content:center;align-items:center;">
           <img src="./images/company-stamp.png" alt="stamp" style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);height:40px;width:auto;object-fit:contain;opacity:0.92;">
           <img src="./images/company-signature.png" alt="signature" style="position:absolute;bottom:3px;left:50%;transform:translateX(-50%);height:22px;width:auto;object-fit:contain;z-index:2;">
         </div>`
      : "",
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
   Update (Save Edit) ✅
========================= */
async function updateInvoice() {
  const err = validate();
  if (err) return alert(err);

  const id = String(invoiceId.value || "").trim();
  if (!id) return alert("❌ لا يوجد ID للفاتورة");

  loading.value = true;
  try {
    (form.value.items || []).forEach((it) => recalcItem(it));

    const payload = {
      date: form.value.date,
      company: form.value.company,
      consignor_id: form.value.consignor_id || undefined,
      driver_ids: form.value.driver_ids,
      items: form.value.items,
      value_jod: Number(itemsTotal.value.toFixed(3)),
      notes: form.value.notes,
    };

    // ✅ إذا عندك PATCH بدل PUT غيّرها
    const res = await axios.put(`${API_BASE}/api/invoices/${id}`, payload);

    const saved = res?.data || {};
    const number = saved.invoice_number || invoiceNumber.value || "(بدون رقم)";

    alert(`✅ تم تعديل الفاتورة\nرقم الفاتورة: ${number}`);
    router.push("/");
  } catch (e) {
    console.error(e);
    alert("❌ فشل التعديل. تأكد أن السيرفر شغال وفيه PUT /api/invoices/:id");
  } finally {
    loading.value = false;
  }
}

/* =========================
   Init
========================= */
onMounted(async () => {
  await Promise.all([fetchDrivers(), fetchConsignors()]);
  await fetchInvoiceById();
});
</script>

<template>
  <div class="page">
    <div class="form-header">
      <div class="header-left">
        <button class="btn btn--back" @click="goBack">← رجوع</button>
        <div class="titles">
          <h2>✏️ تعديل فاتورة</h2>
          <p v-if="invoiceNumber">
            رقم الفاتورة: <strong>{{ invoiceNumber }}</strong>
          </p>
          <p v-else>عدّل البيانات ثم احفظ أو اعرض المعاينة</p>
        </div>
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
          :disabled="loadingInvoice"
        >
          👁 معاينة
        </button>
        <button
          class="btn btn--primary"
          :disabled="loading || loadingInvoice"
          type="button"
          @click="updateInvoice"
        >
          <span v-if="loadingInvoice">⏳ تحميل...</span>
          <span v-else-if="loading">⏳ جاري الحفظ...</span>
          <span v-else>💾 حفظ التعديل</span>
        </button>
      </div>
    </div>

    <div class="form-card" v-if="loadingInvoice">
      جاري تحميل بيانات الفاتورة...
    </div>

    <form v-else class="invoice-form" dir="rtl" @submit.prevent="updateInvoice">
      <div class="form-card">
        <h3>معلومات الفاتورة</h3>

        <div class="form-grid">
          <div class="form-group">
            <label>تاريخ الفاتورة</label>
            <input type="date" v-model="form.date" />
          </div>

          <!-- ✅ المرسل -->
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
                  <span class="dd-sub" v-if="c?.code || c?.CODE">
                    {{ c?.code || c?.CODE }}
                  </span>
                </div>
              </button>

              <div
                class="dropdown-item muted"
                v-if="!loadingConsignors && filteredConsignors.length === 0"
              >
                لا يوجد نتائج
              </div>
            </div>

            <!-- fallback: لو المستخدم بده يكتب الشركة يدوي -->
            <div style="margin-top: 8px">
              <label style="margin: 0 0 6px; display: block"
                >أو اكتب اسم الشركة يدويًا</label
              >
              <input
                type="text"
                v-model="form.company"
                placeholder="اسم الشركة..."
              />
            </div>
          </div>

          <!-- ✅ السائق -->
          <div class="form-group">
            <label>السائق</label>

            <div class="chips" v-if="selectedDriver">
              <span class="chip">
                {{ getDriverName(selectedDriver) }}
                <button type="button" class="chip-x" @click="clearDriver">
                  ×
                </button>
              </span>
            </div>

            <input
              type="text"
              v-model="driverQuery"
              placeholder="ابحث عن السائق..."
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
                @click="selectDriver(d)"
              >
                <div class="dd-row">
                  <span class="dd-main">{{ getDriverName(d) }}</span>
                  <span class="dd-sub">{{ getVehicleNo(d) }}</span>
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

      <!-- ✅ البنود -->
      <div class="form-card">
        <h3>التفاصيل (كل تفصيلة + سعر) — Enter يفتح سطر جديد</h3>

        <div class="items-table">
          <div class="items-head">
            <div>التفصيلة</div>
            <div>المبلغ</div>
            <div>العملة</div>
            <div>نسبة التحويل</div>
            <div>المبلغ (JOD)</div>
            <div></div>
          </div>

          <div class="items-row" v-for="(it, i) in form.items" :key="i">
            <input
              :id="`item-desc-${i}`"
              type="text"
              v-model="it.desc"
              placeholder="مثال: أجور نقل / رسوم بوليصة..."
              @keydown.enter="onItemEnter(i, $event)"
            />

            <input
              type="number"
              v-model="it.amount"
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

            <input
              type="number"
              v-model="it.rate_to_jod"
              step="0.0001"
              @input="recalcItem(it)"
            />

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
      </div>

      <!-- ✅ ملاحظات -->
      <div class="form-card">
        <h3>ملاحظات</h3>
        <div class="form-grid two">
          <div class="form-group">
            <label>ملاحظات</label>
            <input type="text" v-model="form.notes" placeholder="اختياري" />
          </div>
        </div>
      </div>

      <div class="mobile-actions">
        <button class="btn btn--secondary" type="button" @click="buildPreview">
          👁 معاينة
        </button>
        <button class="btn btn--primary" type="submit" :disabled="loading">
          <span v-if="loading">⏳</span>
          <span v-else>💾 حفظ التعديل</span>
        </button>
      </div>
    </form>

    <PreviewModal
      ref="modalRef"
      v-if="openPreview"
      title="معاينة فاتورة"
      :html="previewHtml"
      @close="openPreview = false"
      @print="printPreview"
    />
  </div>
</template>

<style scoped>
/* نفس CSS تبع صفحة الإنشاء */
.page {
  min-height: 100vh;
  background: #eef0f3;
  padding: 16px 24px;
  direction: rtl;
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: #222;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.titles h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}
.titles p {
  margin: 6px 0 0;
  color: #666;
  font-size: 12px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.form-card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 16px;
  margin-bottom: 14px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.04);
}

.form-card h3 {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 800;
  padding-bottom: 10px;
  border-bottom: 1px dashed #e9e9e9;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
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
  margin-bottom: 12px;
}

label {
  font-size: 12px;
  font-weight: 700;
  color: #555;
  margin-bottom: 6px;
}

input,
textarea,
select {
  width: 100%;
  border: 1px solid #cfcfcf;
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

/* Chips */
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
  color: #333;
}

/* Dropdown */
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

/* Buttons */
.btn {
  padding: 8px 14px;
  font-size: 13px;
  border-radius: 10px;
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
.btn--back {
  background: transparent;
  border: 1px solid #ccc;
}
.btn--back:hover {
  background: #f5f5f5;
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

/* Items table */
.items-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.items-head {
  display: grid;
  grid-template-columns: 1fr 130px 90px 130px 140px 44px;
  gap: 8px;
  font-weight: 800;
  font-size: 12px;
  color: #555;
}

.items-row {
  display: grid;
  grid-template-columns: 1fr 130px 90px 130px 140px 44px;
  gap: 8px;
  align-items: center;
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

.mobile-actions {
  display: none;
  gap: 10px;
  margin-top: 12px;
}

@media (max-width: 650px) {
  .header-actions {
    display: none;
  }
  .mobile-actions {
    display: flex;
  }
}
</style>
