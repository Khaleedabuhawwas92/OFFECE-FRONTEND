<!-- src/components/VoucherCreateModal.vue -->
<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import axios from "axios";

const props = defineProps({
  apiBase: { type: String, required: true },
});

const emit = defineEmits(["close", "saved"]);

const loading = ref(false);
const loadingSerial = ref(false);
const loadingOpenInvoices = ref(false);
const loadingCompanies = ref(false);
const errorMessage = ref("");

// ====== FORM ======
const form = ref({
  type: "RECEIPT", // RECEIPT | PAYMENT
  date: new Date().toISOString().slice(0, 10),
  serial_no: "",

  party_name: "",
  party_phone: "",

  currency: "JOD",
  method: "CASH", // CASH | BANK | CHEQUE | OTHER
  ref_no: "",
  notes: "",

  amount_total: 0, // مبلغ السند (قيمة الشيك / الدفعة)

  allocations: [], // { invoice_id, amount }
});

const openInvoices = ref([]); // invoices with remaining_jod

// ====== COMPANY SEARCH (Autocomplete) ======
const companyQuery = ref("");
const allCompanies = ref([]);
const filteredCompanies = ref([]);
const showCompanyList = ref(false);

// لمنع إغلاق القائمة قبل click
let hideTimer = null;

// ====== Helpers ======
function toStr(x) {
  return String(x ?? "");
}
function esc(s) {
  return toStr(s).trim();
}
function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function f3(n) {
  const x = safeNumber(n, 0);
  return Number(x.toFixed(3));
}

// ====== Computed ======
const voucherAmountNum = computed(() => safeNumber(form.value.amount_total, 0));

const totalAllocated = computed(() => {
  return f3(
    (form.value.allocations || []).reduce(
      (sum, a) => sum + safeNumber(a.amount, 0),
      0,
    ),
  );
});

const diffAmount = computed(() =>
  f3(voucherAmountNum.value - totalAllocated.value),
);

const matchesVoucherAmount = computed(
  () =>
    voucherAmountNum.value > 0 &&
    totalAllocated.value > 0 &&
    Math.abs(totalAllocated.value - voucherAmountNum.value) <= 0.001,
);

const canSave = computed(() => {
  const allocs = form.value.allocations || [];

  return (
    !loading.value &&
    ["RECEIPT", "PAYMENT"].includes(form.value.type) &&
    !!esc(form.value.date) &&
    !!esc(form.value.party_name) &&
    !!esc(form.value.currency) &&
    ["CASH", "BANK", "CHEQUE", "OTHER"].includes(form.value.method) &&
    voucherAmountNum.value > 0 &&
    allocs.length > 0 &&
    totalAllocated.value > 0 &&
    matchesVoucherAmount.value
  );
});

// ====== API ======
async function fetchNextSerial() {
  loadingSerial.value = true;
  try {
    const res = await axios.get(`${props.apiBase}/api/vouchers/next-serial`);
    form.value.serial_no = res?.data?.serial_no || "";
  } catch (e) {
    console.error("next voucher serial error:", e);
  } finally {
    loadingSerial.value = false;
  }
}

// ✅ جلب الشركات من الفواتير + المرسلين (بدون تكرار)
async function fetchCompanies() {
  loadingCompanies.value = true;
  try {
    const [invRes, consRes] = await Promise.all([
      axios
        .get(`${props.apiBase}/api/invoices?limit=500`)
        .catch(() => ({ data: [] })),
      axios
        .get(`${props.apiBase}/api/consignors?limit=500`)
        .catch(() => ({ data: [] })),
    ]);
    const invRows = Array.isArray(invRes.data) ? invRes.data : [];
    const consRows = Array.isArray(consRes.data) ? consRes.data : [];

    const names = new Set([
      ...invRows.map((r) => esc(r?.company)).filter(Boolean),
      ...consRows
        .map((r) => esc(r?.name || r?.company || r?.CONSIGNOR_NAME))
        .filter(Boolean),
    ]);

    allCompanies.value = [...names].sort((a, b) => a.localeCompare(b, "ar"));
  } catch (e) {
    console.error("fetch companies error:", e);
    allCompanies.value = [];
  } finally {
    loadingCompanies.value = false;
  }
}

async function fetchOpenInvoices(company) {
  const name = esc(company);
  if (!name) {
    openInvoices.value = [];
    form.value.allocations = [];
    return;
  }

  loadingOpenInvoices.value = true;
  try {
    const res = await axios.get(
      `${props.apiBase}/api/invoices/open?company=${encodeURIComponent(name)}`,
    );
    openInvoices.value = Array.isArray(res.data) ? res.data : [];

    // ✅ لا تعمل allocations تلقائي
    form.value.allocations = [];
  } catch (e) {
    console.error("open invoices error:", e);
    openInvoices.value = [];
    form.value.allocations = [];
  } finally {
    loadingOpenInvoices.value = false;
  }
}

// ====== Company search behavior ======
watch(companyQuery, (val) => {
  const q = esc(val);

  // خزنها بالحقل الحقيقي
  form.value.party_name = q;

  if (!q) {
    filteredCompanies.value = [];
    showCompanyList.value = false;
    openInvoices.value = [];
    form.value.allocations = [];
    return;
  }

  // فلترة سريعة
  filteredCompanies.value = allCompanies.value
    .filter((name) => name.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 20);

  showCompanyList.value = true;
});

function selectCompany(name) {
  const n = esc(name);
  companyQuery.value = n;
  form.value.party_name = n;
  showCompanyList.value = false;
  fetchOpenInvoices(n);
}

function onCompanyFocus() {
  if (hideTimer) clearTimeout(hideTimer);
  showCompanyList.value = true;
}

function onCompanyBlur() {
  // نأخر الإخفاء شوي عشان click يشتغل
  hideTimer = setTimeout(() => {
    showCompanyList.value = false;
  }, 150);
}

// ====== Allocations ======
function remainingFor(inv) {
  return f3(inv?.remaining_jod ?? 0);
}

function getAlloc(invId) {
  return (form.value.allocations || []).find((a) => a.invoice_id === invId);
}

function isSelected(invId) {
  return (form.value.allocations || []).some((a) => a.invoice_id === invId);
}

function addInvoice(inv) {
  if (!inv?._id) return;
  if (isSelected(inv._id)) return;

  form.value.allocations = [
    ...(form.value.allocations || []),
    { invoice_id: inv._id, amount: remainingFor(inv) },
  ];
}

function removeInvoice(invId) {
  form.value.allocations = (form.value.allocations || []).filter(
    (a) => a.invoice_id !== invId,
  );
}

function updateAlloc(inv, rawVal) {
  if (!inv?._id) return;
  const alloc = getAlloc(inv._id);
  if (!alloc) return;

  const max = remainingFor(inv);
  let v = safeNumber(rawVal, 0);
  if (v < 0) v = 0;
  if (v > max) v = max;
  // لا يتجاوز مبلغ السند أيضاً
  if (v > voucherAmountNum.value) v = voucherAmountNum.value;

  alloc.amount = f3(v);
}

function clearAllocations() {
  form.value.allocations = [];
}

function autoAllocateSelected() {
  const invs = [...(openInvoices.value || [])]
    .filter((x) => isSelected(x._id))
    .sort((a, b) => {
      const ta = new Date(a?.date || a?.created_at || 0).getTime();
      const tb = new Date(b?.date || b?.created_at || 0).getTime();
      return ta - tb;
    });

  let left = voucherAmountNum.value;
  for (const inv of invs) {
    const alloc = getAlloc(inv._id);
    if (!alloc) continue;
    const maxForInv = remainingFor(inv);
    const put = f3(Math.min(left, maxForInv));
    alloc.amount = put;
    left = f3(left - put);
    if (left <= 0) break;
  }
}

// ====== Save ======
async function saveVoucher() {
  if (loading.value) return;
  if (!canSave.value) {
    errorMessage.value =
      "يرجى التأكد من تعبئة جميع البيانات المطلوبة بشكل صحيح.";
    return;
  }

  loading.value = true;
  errorMessage.value = "";

  try {
    const payload = {
      type: form.value.type,
      date: form.value.date,
      serial_no: form.value.serial_no,

      party_name: form.value.party_name,
      party_phone: form.value.party_phone,

      currency: form.value.currency,
      method: form.value.method,
      ref_no: form.value.ref_no,
      notes: form.value.notes,

      amount_total: f3(voucherAmountNum.value),

      allocations: (form.value.allocations || [])
        .map((a) => ({
          invoice_id: a.invoice_id,
          amount: f3(a.amount),
        }))
        .filter((a) => a.invoice_id && a.amount > 0),
    };

    if (!payload.allocations.length) {
      errorMessage.value = "لازم توزع مبلغ على الأقل على فاتورة واحدة.";
      loading.value = false;
      return;
    }

    const res = await axios.post(`${props.apiBase}/api/vouchers`, payload);
    emit("saved", res.data);
  } catch (e) {
    console.error("save voucher error:", e);
    errorMessage.value =
      e?.response?.data?.error ||
      e?.response?.data?.message ||
      "تعذّر حفظ السند.";
  } finally {
    loading.value = false;
  }
}

function close() {
  emit("close");
}

onMounted(async () => {
  console.log("API BASE:", props.apiBase);
  await fetchNextSerial();
  await fetchCompanies(); // ✅ جلب الشركات للمقترحات
});

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal">
      <div class="modal-header">
        <div class="title">
          <div class="h">إنشاء سند (قبض / تسديد)</div>
          <div class="sub">اربط السند على فواتير الشركة ووزّع المبلغ</div>
        </div>

        <button class="x" @click="close" title="إغلاق">✖</button>
      </div>

      <div v-if="errorMessage" class="alert">{{ errorMessage }}</div>

      <div class="modal-body">
        <!-- Row 1 -->
        <div class="grid">
          <div class="field">
            <label>نوع السند</label>
            <select v-model="form.type" class="input">
              <option value="RECEIPT">سند قبض</option>
              <option value="PAYMENT">سند تسديد</option>
            </select>
          </div>

          <div class="field">
            <label>التاريخ</label>
            <input v-model="form.date" type="date" class="input" />
          </div>

          <div class="field">
            <label>المبلغ</label>
            <input
              v-model.number="form.amount_total"
              class="input"
              type="number"
              min="0"
              step="0.001"
              placeholder="قيمة الشيك / الدفعة..."
              dir="ltr"
            />
          </div>
        </div>

        <!-- Party -->
        <div class="grid">
          <div class="field field--wide">
            <label>الشركة / الطرف</label>

            <div class="row">
              <div class="company-wrap">
                <input
                  v-model="companyQuery"
                  class="input"
                  placeholder="ابحث عن شركة..."
                  @focus="onCompanyFocus"
                  @blur="onCompanyBlur"
                />

                <div
                  v-if="
                    showCompanyList &&
                    (filteredCompanies.length || loadingCompanies)
                  "
                  class="company-dropdown"
                >
                  <div v-if="loadingCompanies" class="company-item muted">
                    جاري تحميل الشركات...
                  </div>

                  <button
                    v-for="name in filteredCompanies"
                    :key="name"
                    type="button"
                    class="company-item"
                    @mousedown.prevent="selectCompany(name)"
                  >
                    {{ name }}
                  </button>

                  <div
                    v-if="!loadingCompanies && !filteredCompanies.length"
                    class="company-item muted"
                  >
                    لا يوجد نتائج
                  </div>
                </div>
              </div>

              <button
                class="btn btn--secondary"
                @click="fetchOpenInvoices(companyQuery)"
                :disabled="!companyQuery"
              >
                🔎 جلب الفواتير المفتوحة
              </button>
            </div>

            <div class="hint">
              اكتب اسم الشركة واختر من القائمة، بعدين بنجيب الفواتير اللي عليها
              باقي.
            </div>
          </div>

          <div class="field">
            <label>هاتف</label>
            <input
              v-model="form.party_phone"
              class="input"
              placeholder="07xxxxxxxx"
              dir="ltr"
            />
          </div>
        </div>

        <!-- Payment info -->
        <div class="grid">
          <div class="field">
            <label>طريقة الدفع</label>
            <select v-model="form.method" class="input">
              <option value="CASH">نقدي</option>
              <option value="BANK">تحويل بنكي</option>
              <option value="CHEQUE">شيك</option>
              <option value="OTHER">أخرى</option>
            </select>
          </div>

          <div class="field">
            <label>العملة</label>
            <input v-model="form.currency" class="input" placeholder="JOD" />
          </div>
        </div>

        <div class="grid">
          <div class="field">
            <label>الرقم التسلسلي</label>
            <div class="row">
              <input v-model="form.serial_no" class="input" placeholder="" />
              <button
                class="btn btn--secondary"
                @click="fetchNextSerial"
                :disabled="loadingSerial"
                title="جلب رقم جديد"
              >
                🔄
              </button>
            </div>
          </div>

          <div class="field">
            <label>رقم مرجع</label>
            <input
              v-model="form.ref_no"
              class="input"
              placeholder="رقم شيك / حوالة..."
              dir="ltr"
            />
          </div>
        </div>

        <div class="field">
          <label>ملاحظات</label>
          <textarea
            v-model="form.notes"
            class="input"
            rows="2"
            placeholder="ملاحظات السند..."
          ></textarea>
        </div>

        <!-- Allocations -->
        <div class="alloc-header">
          <div class="alloc-title">
            <div class="h2">اختيار الفواتير المراد تسديدها</div>
            <div class="sub2" v-if="loadingOpenInvoices">
              جاري تحميل الفواتير المفتوحة...
            </div>
            <div class="sub2" v-else>
              فواتير مفتوحة: {{ openInvoices.length }}
              <span class="muted">
                | فواتير مختارة: {{ form.allocations.length }}
              </span>
            </div>
          </div>

          <div class="alloc-actions">
            <button
              class="btn btn--secondary"
              @click="clearAllocations"
              :disabled="!form.allocations.length"
            >
              🧹 إزالة كل الاختيارات
            </button>
          </div>
        </div>

        <!-- جدول الفواتير المفتوحة -->
        <div class="table-wrap" v-if="openInvoices.length">
          <table class="table">
            <thead>
              <tr>
                <th>اختيار</th>
                <th>رقم الفاتورة</th>
                <th>تاريخ</th>
                <th dir="ltr">الإجمالي (JOD)</th>
                <th dir="ltr">المدفوع (JOD)</th>
                <th dir="ltr">المتبقي (JOD)</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="inv in openInvoices" :key="inv._id">
                <td>
                  <button
                    v-if="!isSelected(inv._id)"
                    class="btn btn--secondary btn--small"
                    @click="addInvoice(inv)"
                  >
                    ➕ إضافة
                  </button>

                  <button
                    v-else
                    class="btn btn--danger btn--small"
                    @click="removeInvoice(inv._id)"
                  >
                    ✖ إزالة
                  </button>
                </td>

                <td class="td-clip" :title="inv.invoice_number">
                  {{ inv.invoice_number }}
                </td>
                <td>{{ inv.date }}</td>
                <td dir="ltr">{{ f3(inv.value_jod) }}</td>
                <td dir="ltr">{{ f3(inv.paid_jod) }}</td>
                <td dir="ltr">
                  <span class="remain">{{ f3(inv.remaining_jod) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-else class="empty">
          <div>لا يوجد فواتير مفتوحة لهذا الطرف.</div>
          <div class="muted">ابحث عن شركة ثم اضغط "جلب الفواتير المفتوحة".</div>
        </div>

        <!-- جدول الفواتير المختارة + مبلغ لكل فاتورة -->
        <div
          class="table-wrap"
          v-if="form.allocations.length"
          style="margin-top: 12px"
        >
          <table class="table">
            <thead>
              <tr>
                <th>الفاتورة</th>
                <th dir="ltr">المتبقي</th>
                <th dir="ltr">مبلغ التسديد</th>
              </tr>
            </thead>

            <tbody>
              <tr v-for="a in form.allocations" :key="a.invoice_id">
                <td>
                  {{
                    openInvoices.find((x) => x._id === a.invoice_id)
                      ?.invoice_number || a.invoice_id
                  }}
                </td>

                <td dir="ltr">
                  {{
                    f3(
                      openInvoices.find((x) => x._id === a.invoice_id)
                        ?.remaining_jod || 0,
                    )
                  }}
                </td>

                <td dir="ltr">
                  <span class="remain">{{ f3(a.amount) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="total-bar">
          <div>
            مبلغ السند:
            <span dir="ltr" class="total">{{ f3(voucherAmountNum) }}</span>
            <span class="muted">({{ form.currency }})</span>
          </div>
          <div>
            مجموع الفواتير المدرجة:
            <span dir="ltr" class="total">{{ totalAllocated }}</span>
            <span class="muted">({{ form.currency }})</span>
          </div>
        </div>

        <div
          v-if="form.allocations.length"
          style="margin-top: 8px; font-weight: 800; font-size: 13px"
        >
          <span v-if="voucherAmountNum <= 0" style="color: #374151">
            أدخل مبلغ السند أولاً
          </span>
          <span v-else-if="matchesVoucherAmount" style="color: #15803d">
            ✓ المبلغ مطابق لمجموع الفواتير
          </span>
          <span v-else style="color: #b91c1c">
            الفرق: {{ diffAmount }} {{ form.currency }}
          </span>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn--secondary" @click="close">إلغاء</button>
        <button
          class="btn btn--primary"
          :disabled="!canSave"
          @click="saveVoucher"
        >
          💾 حفظ السند
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.45);
  display: grid;
  place-items: center;
  z-index: 9999;
  padding: 18px;
}

.modal {
  width: min(1100px, 100%);
  max-height: 92vh;
  overflow: hidden;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
}

.modal-header {
  padding: 12px 14px;
  border-bottom: 1px solid #eef2f7;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  background: #f9fafb;
}

.title .h {
  font-weight: 900;
  font-size: 15px;
}
.title .sub {
  color: #6b7280;
  font-size: 12px;
  margin-top: 2px;
}

.x {
  border: 1px solid #e5e7eb;
  background: #fff;
  width: 36px;
  height: 36px;
  border-radius: 12px;
  cursor: pointer;
}

.alert {
  margin: 10px 14px 0;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  color: #9f1239;
  padding: 10px;
  border-radius: 12px;
  font-weight: 800;
  font-size: 13px;
}

.modal-body {
  padding: 12px 14px;
  overflow: auto;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin-bottom: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field--wide {
  grid-column: span 2;
}

label {
  font-size: 12px;
  color: #374151;
  font-weight: 800;
}

.input {
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 9px 10px;
  font-size: 13px;
  outline: none;
  background: #fcfcfd;
}

.input:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}

.row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.hint {
  font-size: 12px;
  color: #6b7280;
}

/* ===== Company dropdown ===== */
.company-wrap {
  position: relative;
  flex: 1;
}

.company-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  max-height: 220px;
  overflow: auto;
  z-index: 50;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
}

.company-item {
  width: 100%;
  text-align: right;
  padding: 10px 10px;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
}
.company-item:hover {
  background: #f3f4f6;
}
.company-item.muted {
  cursor: default;
}

/* ===== Tables ===== */
.alloc-header {
  margin-top: 14px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-end;
  flex-wrap: wrap;
}

.alloc-title .h2 {
  font-weight: 900;
  margin: 0;
}
.sub2 {
  color: #6b7280;
  font-size: 12px;
  margin-top: 2px;
}

.alloc-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.table-wrap {
  margin-top: 10px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  overflow: auto;
}

.table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-size: 13px;
}

.table th,
.table td {
  padding: 10px 10px;
  border-bottom: 1px solid #eef2f7;
  white-space: nowrap;
}

.table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #f9fafb;
  border-bottom: 1px solid #e5e7eb;
  font-weight: 900;
  color: #111827;
}

.td-clip {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.money {
  width: 160px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 8px 10px;
  font-size: 13px;
  outline: none;
  background: #fff;
}

.money:focus {
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.12);
}

.remain {
  font-weight: 900;
  color: #1d4ed8;
}

.empty {
  margin-top: 10px;
  border: 1px dashed #e5e7eb;
  border-radius: 14px;
  padding: 14px;
  color: #374151;
  font-weight: 800;
}

.muted {
  color: #6b7280;
  font-weight: 600;
}

.total-bar {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  background: #fcfcfd;
  font-weight: 900;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.total {
  font-size: 16px;
  color: #1976d2;
  margin: 0 6px;
}

.modal-footer {
  padding: 12px 14px;
  border-top: 1px solid #eef2f7;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  background: #f9fafb;
}

/* Buttons */
.btn {
  padding: 8px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 12px;
  border: 1px solid transparent;
  transition: 0.15s ease;
  user-select: none;
}
.btn:hover {
  transform: translateY(-1px);
}
.btn--primary {
  background: #1976d2;
  color: white;
  border-color: #1976d2;
}
.btn--primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.btn--secondary {
  background: #ffffff;
  color: #111827;
  border: 1px solid #e5e7eb;
}
.btn--small {
  padding: 7px 10px;
  font-size: 12px;
  border-radius: 10px;
}
.btn--danger {
  background: #ffebee;
  color: #b71c1c;
  border: 1px solid #ef9a9a;
}
</style>
