<script setup>
import { ref } from "vue";
import axios from "axios";
import PreviewModal from "./dashboard/PreviewModal.vue";
import { useRouter } from "vue-router";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";
const router = useRouter();

const loading = ref(false);
const openPreview = ref(false);
const previewHtml = ref("");
const tplCache = ref(null);
const modalRef = ref(null);
const showStampSignature = ref(false);

// ✅ نموذج البوليصة (نفس أسماء placeholders)
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

  RESERVATION_DAYS: "",
  FREIGHT_CHARGE: "",
  FREIGHT_PAY_PLACE_AR: "",
  FREIGHT_PAY_PLACE_EN: "",

  TYPE_TRANSPORT: "",
  VEHICLE_NO: "",
  VEHICLE_REGION: "",
  DRIVER_NAME: "",
  ROUTE: "",

  ANNEXED_DOCS: "",

  GOODS_NATURE: "",
  TARIFF_CODE: "",
  GROSS_WEIGHT: "",
  MARKS: "",
  PACKAGES_COUNT: "",
  PACKING_METHOD: "",

  DEMURRAGE_LOADING: "",
  CONSIGNER_INSTRUCTION: "",
  SPECIAL_TERMS: "",
  CASH_ON_DELIVERY: "",

  // optional fields used in charges area if you want
  CHARGE1_CONSIGNEE: "",
  CHARGE1_CURRENCY: "",
  CHARGE1_CONSIGNOR: "",
  CHARGE2_CONSIGNEE: "",
  CHARGE2_CURRENCY: "",
  CHARGE2_CONSIGNOR: "",
  CHARGE3_CONSIGNEE: "",
  CHARGE3_CURRENCY: "",
  CHARGE3_CONSIGNOR: "",
  DEDUCTIONS: "",
});

function fillTemplate(template, obj) {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_, key) => {
    const v =
      obj[key] ?? obj[key.toUpperCase()] ?? obj[key.toLowerCase()] ?? "";
    return v == null ? "" : String(v);
  });
}

function validate() {
  if (!form.value.SERIAL_NO) return "رقم السند (Serial No.) مطلوب";
  if (!form.value.DATE) return "التاريخ مطلوب";
  if (!form.value.CONSIGNOR_NAME) return "اسم المرسل مطلوب";
  if (!form.value.CONSIGNEE_NAME) return "اسم المستلم مطلوب";
  if (!form.value.DRIVER_NAME) return "اسم السائق مطلوب";
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

    // ✅ مهم: اعمل render بعد ما تخلص تحميل
    previewHtml.value = fillTemplate(tplCache.value, {
      ...form.value,
      STAMP_SIGNATURE_BLOCK: showStampSignature.value
        ? `<div style="position:relative;width:100%;height:56px;margin-top:2px;">
             <img src="./images/company-stamp.png" alt="stamp" style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:100px;height:55px;object-fit:contain;opacity:0.92;">
             <img src="./images/company-signature.png" alt="signature" style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);width:170px;height:35px;object-fit:contain;z-index:2;">
           </div>`
        : '<div style="height:14px"></div>',
    });
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
  if (err) return alert(err);

  loading.value = true;
  try {
    // ✅ سكّر أي معاينة مفتوحة قبل الحفظ
    openPreview.value = false;

    await axios.post(`${API_BASE}/api/waybills`, form.value);

    // ✅ بدّل alert برسالة داخل الصفحة إذا بتحب (أريح للإلكترون)
    alert("✅ تم حفظ البوليصة");
    window.location.hash = "#/"; // أو router.push('/') إذا عندك router
  } catch (e) {
    console.error(e);
    alert("❌ فشل حفظ البوليصة");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="top">
      <div class="title-block">
        <h1>➕ بوليصة جديدة</h1>
        <p>أدخل بيانات البوليصة ثم اعمل معاينة أو حفظ</p>
      </div>

      <div class="top-actions">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px;font-weight:700;white-space:nowrap;">
          <input type="checkbox" v-model="showStampSignature" style="width:16px;height:16px;cursor:pointer;" />
          إضافة الختم والتوقيع
        </label>
        <button class="btn btn--secondary" type="button" @click="buildPreview">
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
      </div>
    </div>

    <div class="card">
      <!-- 1) بيانات عامة -->
      <div class="section">
        <div class="section-title">بيانات عامة</div>

        <div class="grid">
          <div class="field">
            <label>رقم السند (Serial No.)</label>
            <input
              v-model="form.SERIAL_NO"
              class="input"
              placeholder="مثال: 2025/001"
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
      </div>

      <!-- 2) المرسل / المستلم -->
      <div class="section">
        <div class="section-title">المرسل / المستلم</div>

        <div class="grid2">
          <div class="subcard">
            <div class="sub-title">المرسل (Consignor)</div>

            <div class="field">
              <label>الاسم</label>
              <input v-model="form.CONSIGNOR_NAME" class="input" />
            </div>
            <div class="field">
              <label>العنوان</label>
              <input v-model="form.CONSIGNOR_ADDRESS" class="input" />
            </div>
            <div class="field">
              <label>الهاتف</label>
              <input v-model="form.CONSIGNOR_PHONE" class="input" />
            </div>
          </div>

          <div class="subcard">
            <div class="sub-title">المستلم (Consignee)</div>

            <div class="field">
              <label>الاسم</label>
              <input v-model="form.CONSIGNEE_NAME" class="input" />
            </div>
            <div class="field">
              <label>العنوان</label>
              <input v-model="form.CONSIGNEE_ADDRESS" class="input" />
            </div>
            <div class="field">
              <label>الهاتف</label>
              <input v-model="form.CONSIGNEE_PHONE" class="input" />
            </div>
          </div>
        </div>
      </div>

      <!-- 3) المركبة والسائق -->
      <div class="section">
        <div class="section-title">السائق والمركبة</div>

        <div class="grid">
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
            <input
              v-model="form.VEHICLE_NO"
              class="input"
              placeholder="مثال: 12345"
            />
          </div>

          <div class="field">
            <label>المنطقة / الدولة</label>
            <input
              v-model="form.VEHICLE_REGION"
              class="input"
              placeholder="JO / KSA ..."
            />
          </div>

          <div class="field">
            <label>اسم السائق</label>
            <input v-model="form.DRIVER_NAME" class="input" />
          </div>
        </div>
      </div>

      <!-- 4) خط السير واستلام/تسليم -->
      <div class="section">
        <div class="section-title">خط السير والاستلام/التسليم</div>

        <div class="grid">
          <div class="field">
            <label>مكان وتاريخ استلام البضاعة</label>
            <input
              v-model="form.TAKING_PLACE_DATE"
              class="input"
              placeholder="عمّان - 2025-12-24"
            />
          </div>

          <div class="field">
            <label>مكان وتاريخ تسليم البضاعة</label>
            <input
              v-model="form.DELIVERY_PLACE_DATE"
              class="input"
              placeholder="بغداد - 2025-12-26"
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

      <!-- 5) البضاعة -->
      <div class="section">
        <div class="section-title">تفاصيل البضاعة</div>

        <div class="grid">
          <div class="field">
            <label>طبيعة البضاعة</label>
            <input v-model="form.GOODS_NATURE" class="input" />
          </div>
          <div class="field">
            <label>Tariff Code</label>
            <input v-model="form.TARIFF_CODE" class="input" />
          </div>
          <div class="field">
            <label>Gross Weight</label>
            <input v-model="form.GROSS_WEIGHT" class="input" />
          </div>
          <div class="field">
            <label>Marks</label>
            <input v-model="form.MARKS" class="input" />
          </div>
          <div class="field">
            <label>عدد الطرود</label>
            <input v-model="form.PACKAGES_COUNT" class="input" />
          </div>
          <div class="field">
            <label>نوع التغليف</label>
            <input v-model="form.PACKING_METHOD" class="input" />
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

      <!-- 6) تعليمات / أجور -->
      <div class="section">
        <div class="section-title">تعليمات وأجور</div>

        <div class="grid">
          <div class="field">
            <label>بدل عطل (أيام)</label>
            <input v-model="form.RESERVATION_DAYS" class="input" />
          </div>

          <div class="field">
            <label>أجور الشحن</label>
            <input v-model="form.FREIGHT_CHARGE" class="input" />
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

      <div class="bottom-actions">
        <button class="btn btn--secondary" type="button" @click="buildPreview">
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
</template>

<style scoped>
.page {
  min-height: 100vh;
  background: #eef0f3;
  padding: 16px 24px;
  direction: rtl;
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: #222;
}

.top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.title-block h1 {
  margin: 0;
  font-size: 22px;
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
}

.card {
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 10px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  max-width: 1200px;
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
}
.input:focus,
.textarea:focus {
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.12);
}

.textarea {
  resize: vertical;
  min-height: 80px;
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

.bottom-actions {
  display: none;
  gap: 10px;
  margin-top: 12px;
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
  .top-actions {
    display: none;
  }
  .bottom-actions {
    display: flex;
  }
}
</style>
