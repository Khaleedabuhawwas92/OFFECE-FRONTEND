<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";
import { useRouter } from "vue-router";
import PreviewModal from "./dashboard/PreviewModal.vue";

const API_BASE = "http://127.0.0.1:4000";
const router = useRouter();

const loading = ref(false);
const openPreview = ref(false);
const previewHtml = ref("");
const invoiceTemplateCache = ref(null);
const modalRef = ref(null);

// ✅ بعد الحفظ نخزن ID عشان نرسل للفوترة
const savedInvoiceId = ref("");
const savedInvoiceNumber = ref("");

// ✅ فوترة
const einvSubmitting = ref(false);
const einvResult = ref(null); // نخزن رد الفوترة كامل
const einvError = ref("");

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

  // =========================
  // ✅ حقول الفوترة الأردنية
  // =========================
  einv: {
    invoiceType: "EXPORT",
    incomeSourceSeq: "",
    buyerName: "",
    buyerTaxNo: "",
    buyerPhone: "",
    buyerCity: "عمان",
    buyerPostalCode: "",
    currency: "JOD",
  },
});

/* =========================
   Fetch
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

onMounted(() => {
  fetchDrivers();
  fetchConsignors();
});

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
   Items (Rows)
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
  if (!form.value.driver_ids.includes(id)) {
    form.value.driver_ids.push(id);
  }
  driverQuery.value = "";
  showDriverList.value = false;
}

function removeDriver(id) {
  form.value.driver_ids = (form.value.driver_ids || []).filter((x) => x !== id);
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
    return "اكتب رقم السيارة واختر السائق";

  const okItems = (form.value.items || []).some((it) => {
    const hasDesc = String(it?.desc || "").trim().length > 0;
    const hasAmount = String(it?.amount || "").trim().length > 0;
    return hasDesc && hasAmount;
  });
  if (!okItems) return "أدخل تفصيلة واحدة على الأقل (وصف + مبلغ)";

  return "";
}

// ✅ تحقق خاص قبل الإرسال للفوترة
function validateForEInv() {
  if (!savedInvoiceId.value) return "احفظ الفاتورة أولاً قبل الإرسال";
  if (!String(form.value.einv.incomeSourceSeq || "").trim())
    return "تسلسل مصدر الدخل مطلوب";
  if (!String(form.value.einv.buyerName || "").trim())
    return "اسم المشتري مطلوب للفوترة";
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
    INVOICE_NO: savedInvoiceNumber.value || "—",
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
   Save
========================= */
async function saveInvoice() {
  const err = validate();
  if (err) return alert(err);

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

      // ✅ نحفظ بيانات الفوترة مع الفاتورة
      einv: { ...form.value.einv },
    };

    const res = await axios.post(`${API_BASE}/api/invoices`, payload);

    const saved = res?.data || {};
    savedInvoiceId.value = saved._id || "";
    savedInvoiceNumber.value = saved.invoice_number || "";

    einvResult.value = null;
    einvError.value = "";

    alert(
      `✅ تم حفظ الفاتورة\nرقم الفاتورة: ${savedInvoiceNumber.value || "(بدون رقم)"}`,
    );
  } catch (e) {
    console.error(e);
    alert(
      "❌ فشل الحفظ. تأكد أن السيرفر شغال وفيه POST /api/invoices على 4000",
    );
  } finally {
    loading.value = false;
  }
}

/* =========================
   ✅ Submit to Jordan E-Invoicing (via your Node server)
   ✅ Server expects: POST /api/einv/submit  { invoiceId }
========================= */
async function submitToEInvoicing() {
  const err = validateForEInv();
  if (err) return alert(err);

  einvSubmitting.value = true;
  einvResult.value = null;
  einvError.value = "";

  try {
    // ✅ نفس المطلوب بالسيرفر: /api/einv/submit + body فيه invoiceId
    const res = await axios.post(`${API_BASE}/api/einv/submit`, {
      invoiceId: savedInvoiceId.value,
    });

    einvResult.value = res?.data || null;

    alert("✅ تم إرسال الفاتورة للفوترة — راجع النتيجة تحت");
  } catch (e) {
    console.error(e);

    // ✅ اعرض السبب الحقيقي لو جاي من جوفوتارا ضمن data
    const data = e?.response?.data;

    let msg =
      (typeof data === "string" ? data : data?.data) ||
      data?.error ||
      data?.message ||
      e?.message ||
      "Submit failed";

    // إذا data كان object كبير
    if (typeof msg === "object") msg = JSON.stringify(msg);

    einvError.value = String(msg);
    einvResult.value = data ?? null;

    alert("❌ فشل إرسال الفاتورة للفوترة — شوف نتيجة الخطأ تحت");
  } finally {
    einvSubmitting.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="form-header">
      <div class="header-left">
        <button class="btn btn--back" @click="goBack">← رجوع</button>
        <div class="titles">
          <h2>➕ إنشاء فاتورة جديدة</h2>
          <p>احفظ الفاتورة أولاً، ثم اضغط “إرسال للفوترة”</p>
        </div>
      </div>

      <div class="header-actions">
        <button class="btn btn--secondary" type="button" @click="buildPreview">
          👁 معاينة
        </button>

        <button
          class="btn btn--primary"
          :disabled="loading"
          type="button"
          @click="saveInvoice"
        >
          <span v-if="loading">⏳ جاري الحفظ...</span>
          <span v-else>💾 حفظ</span>
        </button>

        <button
          class="btn btn--einv"
          type="button"
          :disabled="!savedInvoiceId || einvSubmitting"
          @click="submitToEInvoicing"
          title="يرسل الفاتورة لنظام الفوترة عبر السيرفر"
        >
          <span v-if="einvSubmitting">⏳ إرسال...</span>
          <span v-else>🧾 إرسال للفوترة</span>
        </button>
      </div>
    </div>

    <form class="invoice-form" dir="rtl" @submit.prevent="saveInvoice">
      <div class="form-card">
        <h3>معلومات الفاتورة</h3>

        <div class="form-grid">
          <div class="form-group">
            <label>تاريخ الفاتورة</label>
            <input type="date" v-model="form.date" />
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
        </div>

        <div class="save-badge" v-if="savedInvoiceId">
          <div>
            <strong>تم الحفظ:</strong>
            {{ savedInvoiceNumber || savedInvoiceId }}
          </div>
        </div>
      </div>

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

      <div class="form-card">
        <h3>الفوترة الأردنية (للإرسال)</h3>

        <div class="form-grid two">
          <div class="form-group">
            <label>نوع الفاتورة</label>
            <select v-model="form.einv.invoiceType">
              <option value="EXPORT">فاتورة تصدير (EXPORT)</option>
              <option value="TAX">فاتورة ضريبية (TAX)</option>
              <option value="SIMPLIFIED">مبسطة (SIMPLIFIED)</option>
            </select>
          </div>

          <div class="form-group">
            <label>تسلسل مصدر الدخل</label>
            <input
              type="text"
              v-model="form.einv.incomeSourceSeq"
              placeholder="مثال: 1379984"
            />
          </div>

          <div class="form-group">
            <label>اسم المشتري</label>
            <input
              type="text"
              v-model="form.einv.buyerName"
              placeholder="شركة..."
            />
          </div>

          <div class="form-group">
            <label>رقم المشتري / ضريبي (اختياري)</label>
            <input type="text" v-model="form.einv.buyerTaxNo" placeholder="-" />
          </div>

          <div class="form-group">
            <label>هاتف المشتري (اختياري)</label>
            <input type="text" v-model="form.einv.buyerPhone" placeholder="-" />
          </div>

          <div class="form-group">
            <label>مدينة المشتري</label>
            <input type="text" v-model="form.einv.buyerCity" />
          </div>

          <div class="form-group">
            <label>الرمز البريدي (اختياري)</label>
            <input
              type="text"
              v-model="form.einv.buyerPostalCode"
              placeholder="-"
            />
          </div>

          <div class="form-group">
            <label>عملة الفاتورة</label>
            <select v-model="form.einv.currency">
              <option value="JOD">JOD</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="SAR">SAR</option>
              <option value="AED">AED</option>
            </select>
          </div>
        </div>

        <div class="hint">
          بعد الحفظ اضغط <strong>🧾 إرسال للفوترة</strong> — السيرفر هو اللي
          يبني XML UBL ويعمل Base64 ويرسل.
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

      <div class="form-card" v-if="einvError || einvResult">
        <h3>نتيجة الفوترة</h3>

        <div class="err" v-if="einvError">❌ {{ einvError }}</div>

        <pre class="result" v-if="einvResult">{{
          JSON.stringify(einvResult, null, 2)
        }}</pre>
      </div>

      <div class="mobile-actions">
        <button class="btn btn--secondary" type="button" @click="buildPreview">
          👁 معاينة
        </button>

        <button class="btn btn--primary" type="submit" :disabled="loading">
          <span v-if="loading">⏳</span>
          <span v-else>💾 حفظ</span>
        </button>

        <button
          class="btn btn--einv"
          type="button"
          :disabled="!savedInvoiceId || einvSubmitting"
          @click="submitToEInvoicing"
        >
          <span v-if="einvSubmitting">⏳</span>
          <span v-else>🧾 إرسال للفوترة</span>
        </button>
      </div>
    </form>

    <PreviewModal
      v-if="openPreview"
      ref="modalRef"
      title="معاينة الفاتورة"
      :html="previewHtml"
      @close="openPreview = false"
      @print="printPreview"
    />
  </div>
</template>

<style scoped>
/* نفس الستايل اللي عندك بدون تغيير */
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
  flex-wrap: wrap;
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

.btn--einv {
  background: #0f766e;
  color: #fff;
}
.btn--einv:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  flex-wrap: wrap;
}

@media (max-width: 650px) {
  .header-actions {
    display: none;
  }
  .mobile-actions {
    display: flex;
  }
}

.save-badge {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  font-size: 13px;
}

.hint {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  font-size: 13px;
  color: #1f2937;
}

.err {
  padding: 10px 12px;
  border-radius: 10px;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #9f1239;
  font-weight: 700;
}

.result {
  margin-top: 10px;
  background: #0b1220;
  color: #e5e7eb;
  padding: 12px;
  border-radius: 10px;
  overflow: auto;
  font-size: 12px;
}
</style>
