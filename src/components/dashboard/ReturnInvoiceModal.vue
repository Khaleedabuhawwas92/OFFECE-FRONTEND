<script setup>
import { ref, computed, onMounted } from "vue";
import axios from "axios";

const props = defineProps({
  invoiceId: { type: String, required: true },
});
const emit = defineEmits(["close", "created"]);

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

const loading = ref(true);
const loadError = ref("");
const original = ref(null);
const items = ref([]); // { index, desc, quantity, unitPrice, remainingQty, remainingAmount, ... }
const returns = ref([]);

const picks = ref({}); // { [index]: { checked, qty } }
const reason = ref("");
const submitting = ref(false);
const submitError = ref("");

const createdInvoice = ref(null);
const einvSubmitting = ref(false);
const einvResult = ref("");

function close() {
  emit("close");
}

async function fetchInfo() {
  loading.value = true;
  loadError.value = "";
  try {
    const res = await axios.get(
      `${API_BASE}/api/invoices/${props.invoiceId}/refund-info`,
    );
    original.value = res.data?.original || null;
    items.value = Array.isArray(res.data?.items) ? res.data.items : [];
    returns.value = Array.isArray(res.data?.returns) ? res.data.returns : [];

    const p = {};
    for (const it of items.value) {
      p[it.index] = { checked: false, qty: 0 };
    }
    picks.value = p;
  } catch (e) {
    console.error("refund-info error:", e);
    loadError.value =
      e?.response?.data?.error || "فشل تحميل بيانات الفاتورة الأصلية";
  } finally {
    loading.value = false;
  }
}

function toggleItem(it) {
  const p = picks.value[it.index];
  if (!p) return;
  p.checked = !p.checked;
  if (p.checked && !(p.qty > 0)) {
    p.qty = it.remainingQty;
  }
  if (!p.checked) {
    p.qty = 0;
  }
}

function selectFullReturn() {
  for (const it of items.value) {
    const p = picks.value[it.index];
    if (!p) continue;
    if (it.remainingQty > 0) {
      p.checked = true;
      p.qty = it.remainingQty;
    }
  }
}

function clearSelection() {
  for (const key of Object.keys(picks.value)) {
    picks.value[key].checked = false;
    picks.value[key].qty = 0;
  }
}

const selectedRows = computed(() => {
  return items.value
    .map((it) => ({ it, p: picks.value[it.index] }))
    .filter(({ p }) => p?.checked && Number(p.qty) > 0);
});

function lineTotal(it, qty) {
  const unitPrice = Number(it.unitPrice || 0);
  const q = Number(qty || 0);
  const orig = Number(it.quantity || 0);
  const discFraction = orig > 0 ? q / orig : 0;
  const discount = Number(it.discount || 0) * discFraction;
  return Math.max(0, q * unitPrice - discount);
}

const returnTotal = computed(() => {
  return Number(
    selectedRows.value
      .reduce((sum, { it, p }) => sum + lineTotal(it, p.qty), 0)
      .toFixed(3),
  );
});

// ✅ معيار الأهلية الحقيقي المستخدم في باقي الواجهة (PreviewModal
// hasJofotaraInvoice، شارة الحالة في BotDashboard): einv_status === "submitted".
// لا توجد حالة "accepted"/"approved" في هذا النظام — "submitted" هي حالة
// النجاح الفعلية بعد submitInvoiceToEInv.
const isOriginalApproved = computed(
  () => original.value?.einv_status === "submitted",
);

const validationError = computed(() => {
  if (!original.value) return "";
  if (!isOriginalApproved.value)
    return `لا يمكن إنشاء فاتورة إرجاع قبل اعتماد الفاتورة الأصلية عبر JoFotara (الحالة الحالية: ${original.value.einv_status || "غير معروفة"})`;
  if (!original.value.einv_uuid)
    return "الفاتورة الأصلية معتمدة من JoFotara لكن تعذّر استرجاع UUID الفعلي المرسل لها — لا يمكن إنشاء فاتورة إرجاع صالحة للإرسال";
  if (!String(reason.value || "").trim()) return "سبب الإرجاع مطلوب";
  if (!selectedRows.value.length)
    return "اختر بندًا واحدًا على الأقل بكمية إرجاع أكبر من صفر";
  for (const { it, p } of selectedRows.value) {
    const qty = Number(p.qty);
    if (!(qty > 0)) return `الكمية غير صالحة لـ "${it.desc}"`;
    if (qty > it.remainingQty + 1e-9)
      return `الكمية المدخلة لـ "${it.desc}" (${qty}) أكبر من المتبقي القابل للإرجاع (${it.remainingQty})`;
  }
  return "";
});

async function submitReturn() {
  submitError.value = "";
  const err = validationError.value;
  if (err) {
    submitError.value = err;
    return;
  }

  submitting.value = true;
  try {
    const payload = {
      reason: reason.value.trim(),
      items: selectedRows.value.map(({ it, p }) => ({
        index: it.index,
        quantity: Number(p.qty),
      })),
    };
    const res = await axios.post(
      `${API_BASE}/api/invoices/${props.invoiceId}/returns`,
      payload,
    );
    createdInvoice.value = res.data;
    emit("created", res.data);
  } catch (e) {
    console.error("create return invoice error:", e);
    submitError.value =
      e?.response?.data?.error || "فشل إنشاء فاتورة الإرجاع";
  } finally {
    submitting.value = false;
  }
}

async function submitToJofotara() {
  if (!createdInvoice.value?._id) return;
  einvSubmitting.value = true;
  einvResult.value = "";
  try {
    await axios.post(
      `${API_BASE}/api/einv/submit/${createdInvoice.value._id}`,
    );
    einvResult.value = "تم إرسال فاتورة الإرجاع إلى JoFotara بنجاح ✅";
  } catch (e) {
    console.error("einv submit error:", e);
    einvResult.value =
      "❌ فشل الإرسال إلى JoFotara: " +
      (e?.response?.data?.error || e?.response?.data?.message || e.message);
  } finally {
    einvSubmitting.value = false;
  }
}

onMounted(fetchInfo);
</script>

<template>
  <div class="ri-overlay" @click.self="close">
    <div class="ri-modal" dir="rtl">
      <div class="ri-header">
        <h3>🔄 إنشاء فاتورة إرجاع</h3>
        <button class="btn btn--x" type="button" @click="close">✕ إغلاق</button>
      </div>

      <div v-if="loading" class="ri-body ri-status">جاري التحميل...</div>
      <div v-else-if="loadError" class="ri-body ri-status ri-error">
        {{ loadError }}
      </div>

      <div v-else class="ri-body">
        <!-- ===== نجاح الإنشاء ===== -->
        <div v-if="createdInvoice" class="ri-success">
          <p>
            ✅ تم إنشاء فاتورة الإرجاع بنجاح — رقم:
            <strong dir="ltr">{{ createdInvoice.invoice_number }}</strong>
          </p>
          <p>قيمة الإرجاع: <strong>{{ createdInvoice.value_jod }} JOD</strong></p>

          <div class="ri-actions">
            <button
              class="btn btn--jofotara"
              type="button"
              :disabled="einvSubmitting"
              @click="submitToJofotara"
            >
              {{ einvSubmitting ? "⏳ جاري الإرسال..." : "📤 إرسال إلى JoFotara" }}
            </button>
            <button class="btn btn--secondary" type="button" @click="close">
              إغلاق
            </button>
          </div>

          <p v-if="einvResult" class="ri-einv-result">{{ einvResult }}</p>
        </div>

        <!-- ===== نموذج الإرجاع ===== -->
        <template v-else>
          <div class="ri-original-info">
            <div>
              <span class="l">الفاتورة الأصلية:</span>
              <strong dir="ltr">{{ original?.invoice_number }}</strong>
            </div>
            <div>
              <span class="l">التاريخ:</span>
              <strong>{{ original?.date }}</strong>
            </div>
            <div>
              <span class="l">الشركة:</span>
              <strong>{{ original?.company }}</strong>
            </div>
            <div>
              <span class="l">القيمة الأصلية:</span>
              <strong>{{ original?.value_jod }} JOD</strong>
            </div>
            <div>
              <span class="l">حالة JoFotara:</span>
              <strong>{{ original?.einv_status }}</strong>
            </div>
          </div>

          <p v-if="!isOriginalApproved" class="ri-warning">
            ⚠️ الفاتورة الأصلية لم تُعتمد بعد عبر JoFotara (الحالة الحالية: {{
              original?.einv_status || "غير معروفة"
            }}) — لا يمكن إنشاء فاتورة إرجاع تُرسل إليها قبل الاعتماد.
          </p>
          <p v-else-if="!original?.einv_uuid" class="ri-warning">
            ⚠️ الفاتورة الأصلية معتمدة لكن تعذّر استرجاع UUID الفعلي المرسل لها
            من JoFotara — لا يمكن إنشاء فاتورة إرجاع صالحة للإرسال حالياً.
          </p>

          <!-- ===== المرتجعات السابقة ===== -->
          <div v-if="returns.length" class="ri-history">
            <h4>المرتجعات السابقة:</h4>
            <ul>
              <li v-for="r in returns" :key="r._id">
                <strong dir="ltr">{{ r.invoice_number }}</strong>
                — {{ r.value_jod }} JOD —
                <span
                  class="badge"
                  :class="{
                    'badge--green': r.einv_status === 'submitted',
                    'badge--orange': r.einv_status === 'pending',
                    'badge--red': r.einv_status === 'failed',
                  }"
                  >{{ r.einv_status }}</span
                >
                <span v-if="r.returnReason" class="muted"> — {{ r.returnReason }}</span>
              </li>
            </ul>
          </div>

          <!-- ===== بنود الفاتورة الأصلية ===== -->
          <div class="ri-items">
            <div class="ri-items-toolbar">
              <h4>اختر البنود المطلوب إرجاعها</h4>
              <div class="ri-items-toolbar-actions">
                <button class="btn btn--secondary btn--small" type="button" @click="selectFullReturn">
                  إرجاع كامل (كل المتبقي)
                </button>
                <button class="btn btn--secondary btn--small" type="button" @click="clearSelection">
                  إلغاء التحديد
                </button>
              </div>
            </div>

            <table class="ri-table">
              <thead>
                <tr>
                  <th></th>
                  <th>البند</th>
                  <th>الكمية الأصلية</th>
                  <th>سعر الوحدة</th>
                  <th>المتبقي القابل للإرجاع</th>
                  <th>كمية الإرجاع</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="it in items" :key="it.index" :class="{ 'ri-row-disabled': it.remainingQty <= 0 }">
                  <td>
                    <input
                      type="checkbox"
                      :disabled="it.remainingQty <= 0"
                      :checked="!!picks[it.index]?.checked"
                      @change="toggleItem(it)"
                    />
                  </td>
                  <td class="ri-desc">{{ it.desc }}</td>
                  <td dir="ltr">{{ it.quantity }}</td>
                  <td dir="ltr">{{ it.unitPrice }}</td>
                  <td dir="ltr">{{ it.remainingQty }}</td>
                  <td>
                    <input
                      v-if="picks[it.index]"
                      type="number"
                      min="0"
                      :max="it.remainingQty"
                      step="0.001"
                      v-model.number="picks[it.index].qty"
                      :disabled="!picks[it.index].checked"
                    />
                  </td>
                </tr>
                <tr v-if="!items.length">
                  <td colspan="6" class="ri-empty">لا توجد بنود في الفاتورة الأصلية</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="ri-reason">
            <label>سبب الإرجاع *</label>
            <textarea
              v-model="reason"
              rows="2"
              placeholder="مثال: إرجاع جزء من البضاعة / خطأ في الكمية..."
            ></textarea>
          </div>

          <div class="ri-summary">
            <span>إجمالي فاتورة الإرجاع:</span>
            <strong>{{ returnTotal.toFixed(3) }} JOD</strong>
          </div>

          <p v-if="submitError" class="ri-error">{{ submitError }}</p>

          <div class="ri-actions">
            <button
              class="btn btn--primary"
              type="button"
              :disabled="submitting"
              @click="submitReturn"
            >
              {{ submitting ? "⏳ جاري الحفظ..." : "💾 حفظ فاتورة الإرجاع" }}
            </button>
            <button class="btn btn--secondary" type="button" @click="close">
              إلغاء
            </button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ri-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.ri-modal {
  background: #fff;
  border-radius: 12px;
  width: min(900px, 100%);
  max-height: 92vh;
  overflow: auto;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: #222;
}

.ri-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #eee;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
.ri-header h3 {
  margin: 0;
  font-size: 16px;
}

.ri-body {
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ri-status {
  text-align: center;
  padding: 30px 0;
  color: #555;
}

.ri-error {
  color: #b71c1c;
  font-weight: 700;
}

.ri-warning {
  background: #fff8e1;
  border: 1px solid #ffe082;
  color: #8a6100;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
}

.ri-original-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  background: #f7f9fc;
  border: 1px solid #e3e8f0;
  border-radius: 10px;
  padding: 12px;
  font-size: 13px;
}
.ri-original-info .l {
  color: #666;
  margin-left: 6px;
}

.ri-history {
  border: 1px dashed #d6d6d6;
  border-radius: 10px;
  padding: 10px 12px;
}
.ri-history h4 {
  margin: 0 0 8px;
  font-size: 13px;
}
.ri-history ul {
  margin: 0;
  padding-right: 18px;
  font-size: 13px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ri-items-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.ri-items-toolbar h4 {
  margin: 0;
  font-size: 14px;
}
.ri-items-toolbar-actions {
  display: flex;
  gap: 8px;
}

.ri-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.ri-table th,
.ri-table td {
  border: 1px solid #e6e6e6;
  padding: 8px;
  text-align: center;
}
.ri-desc {
  text-align: right !important;
}
.ri-row-disabled {
  opacity: 0.5;
}
.ri-table input[type="number"] {
  width: 90px;
  padding: 6px;
  border: 1px solid #cfcfcf;
  border-radius: 6px;
}
.ri-empty {
  color: #777;
  padding: 16px;
}

.ri-reason label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #555;
  margin-bottom: 6px;
}
.ri-reason textarea {
  width: 100%;
  border: 1px solid #cfcfcf;
  border-radius: 8px;
  padding: 10px;
  font-size: 13px;
  box-sizing: border-box;
  resize: vertical;
}

.ri-summary {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  font-size: 15px;
  border-top: 1px dashed #ddd;
  padding-top: 10px;
}

.ri-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.ri-success {
  text-align: center;
  padding: 10px 0;
}
.ri-success p {
  margin: 6px 0;
}
.ri-einv-result {
  margin-top: 10px;
  font-weight: 700;
}

.badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: #eee;
  color: #444;
}
.badge--green {
  background: #e6f7ec;
  color: #1e7e34;
}
.badge--orange {
  background: #fff3e0;
  color: #a15c00;
}
.badge--red {
  background: #fdecea;
  color: #b71c1c;
}
.badge--gray {
  background: #eee;
  color: #555;
}
.muted {
  color: #777;
}

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
.btn--secondary {
  background: #f5f5f5;
  border-color: #d0d0d0;
  color: #222;
}
.btn--jofotara {
  background: #0f9d58;
  color: #fff;
}
.btn--x {
  background: transparent;
  border: 1px solid #ccc;
}
.btn--small {
  padding: 6px 10px;
  font-size: 12px;
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
