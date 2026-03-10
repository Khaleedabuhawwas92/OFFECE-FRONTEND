<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import axios from "axios";

const API_BASE = "http://127.0.0.1:4000";

const route = useRoute();
const router = useRouter();

const id = computed(() => route.params.id); // ممكن يكون "new" أو id
const isNew = computed(() => String(id.value) === "new");

const loading = ref(false);
const saving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const form = ref({
  _id: null,
  name: "",
  code: "",
  phone: "",
  address: "",
  notes: "",
});

function goBack() {
  router.push({ path: "/consignees", query: { refresh: "1" } });
}

async function fetchOne() {
  if (isNew.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/consignees/${id.value}`);
    const x = res.data || {};
    form.value = {
      _id: x._id,
      name: x.name ?? x.NAME ?? "",
      code: x.code ?? x.CODE ?? "",
      phone: x.phone ?? x.PHONE ?? "",
      address: x.address ?? x.ADDRESS ?? "",
      notes: x.notes ?? x.NOTES ?? "",
    };
  } catch (e) {
    console.error(e);
    errorMessage.value = "تعذّر تحميل بيانات المرسل إليه.";
  } finally {
    loading.value = false;
  }
}

function validate() {
  if (!String(form.value.name || "").trim()) return "اسم المرسل إليه مطلوب";
  return "";
}

async function save() {
  const err = validate();
  if (err) return alert(err);

  saving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  try {
    const payload = {
      name: String(form.value.name || "").trim(),
      code: String(form.value.code || "").trim(),
      phone: String(form.value.phone || "").trim(),
      address: String(form.value.address || "").trim(),
      notes: String(form.value.notes || "").trim(),
    };

    if (isNew.value) {
      const res = await axios.post(`${API_BASE}/api/consignees`, payload);
      successMessage.value = "✅ تم إنشاء المرسل إليه.";
      // روح على صفحة التعديل للـ id الجديد
      router.replace(`/consignees/${res.data?._id || res.data?.id || ""}/edit`);
    } else {
      await axios.put(`${API_BASE}/api/consignees/${id.value}`, payload);
      successMessage.value = "✅ تم حفظ التعديلات.";
      await fetchOne();
    }
  } catch (e) {
    console.error(e);
    errorMessage.value =
      e?.response?.data?.message ||
      e?.response?.data?.error ||
      "تعذّر حفظ البيانات.";
  } finally {
    saving.value = false;
  }
}

// ✅ هذا بده Endpoint بالباك-إند (رح أعطيك تحته)
function printPdf() {
  if (isNew.value) return alert("احفظ أولاً ثم اطبع.");
  window.open(`${API_BASE}/api/consignees/${id.value}/pdf`, "_blank");
}

onMounted(fetchOne);
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div>
        <div class="title">
          {{ isNew ? "إضافة مرسل إليه" : "تعديل مرسل إليه" }}
        </div>
        <div class="sub" v-if="!isNew" dir="ltr">ID: {{ id }}</div>
      </div>

      <div class="actions">
        <button class="btn btn--secondary" @click="goBack">⬅ رجوع</button>
        <button
          class="btn btn--secondary"
          :disabled="saving || loading"
          @click="printPdf"
        >
          🖨 PDF
        </button>
        <button
          class="btn btn--primary"
          :disabled="saving || loading"
          @click="save"
        >
          💾 حفظ
        </button>
      </div>
    </header>

    <div class="main">
      <div v-if="errorMessage" class="alert alert--danger">
        {{ errorMessage }}
      </div>
      <div v-if="successMessage" class="alert alert--success">
        {{ successMessage }}
      </div>

      <div v-if="loading" class="card">جاري التحميل...</div>

      <div v-else class="card">
        <div class="grid">
          <label class="field">
            <span>الاسم</span>
            <input
              v-model="form.name"
              type="text"
              placeholder="اسم المرسل إليه"
            />
          </label>

          <label class="field">
            <span>الرمز/الكود</span>
            <input v-model="form.code" type="text" placeholder="اختياري" />
          </label>

          <label class="field">
            <span>الهاتف</span>
            <input
              v-model="form.phone"
              type="text"
              placeholder="مثال: 079..."
            />
          </label>

          <label class="field full">
            <span>العنوان</span>
            <input v-model="form.address" type="text" placeholder="العنوان" />
          </label>

          <label class="field full">
            <span>ملاحظات</span>
            <textarea
              v-model="form.notes"
              rows="4"
              placeholder="اختياري"
            ></textarea>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(body) {
  margin: 0;
}
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  direction: rtl;
  font-family: "Segoe UI", Tahoma, sans-serif;
  background: #eef0f3;
  color: #111827;
}
.topbar {
  background: #fff;
  border-bottom: 1px solid #d1d5db;
  padding: 14px 18px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}
.title {
  font-size: 18px;
  font-weight: 900;
}
.sub {
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}
.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.main {
  flex: 1;
  overflow: auto;
  padding: 14px 18px;
}
.card {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.06);
}
.alert {
  padding: 10px 12px;
  border-radius: 12px;
  margin-bottom: 10px;
  font-weight: 800;
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
.btn {
  padding: 8px 12px;
  border-radius: 12px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 900;
  font-size: 13px;
}
.btn--primary {
  background: #1976d2;
  color: #fff;
}
.btn--secondary {
  background: #fff;
  border: 1px solid #e5e7eb;
  color: #111827;
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
textarea {
  width: 100%;
  border-radius: 14px;
  border: 1px solid #e5e7eb;
  padding: 10px;
  font-size: 13px;
  outline: none;
  background: #fff;
  color: #111827;
}
input:focus,
textarea:focus {
  border-color: #60a5fa;
  box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.18);
}
@media (max-width: 820px) {
  .grid {
    grid-template-columns: 1fr;
  }
}
</style>
