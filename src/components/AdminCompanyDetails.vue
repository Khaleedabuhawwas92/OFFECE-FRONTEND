<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";

const props = defineProps({ id: String });
const router = useRouter();
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

const company = ref(null);
const loading = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const email = ref("");
const password = ref("");

async function fetchCompany() {
  loading.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/admin/companies/${props.id}`);
    company.value = res.data || null;
    email.value = company.value?.customerEmail || "";
  } catch (err) {
    console.error("fetch company error:", err);
    errorMessage.value = err?.response?.data?.error || "تعذّر تحميل بيانات الشركة.";
  } finally {
    loading.value = false;
  }
}

async function saveAccount() {
  errorMessage.value = "";
  successMessage.value = "";
  if (!email.value.trim() || !password.value.trim()) {
    errorMessage.value = "البريد وكلمة المرور مطلوبان.";
    return;
  }
  loading.value = true;
  try {
    await axios.post(`${API_BASE}/api/admin/customer-portal`, {
      companyId: props.id,
      companyName: company.value?.name || "",
      email: email.value.trim(),
      password: password.value,
    });
    successMessage.value = "✅ تم إنشاء/تحديث الحساب.";
    password.value = "";
    await fetchCompany();
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || "تعذّر حفظ الحساب.";
  } finally {
    loading.value = false;
  }
}

async function togglePortal(enabled) {
  errorMessage.value = "";
  successMessage.value = "";
  loading.value = true;
  try {
    await axios.patch(`${API_BASE}/api/admin/customer-portal/${props.id}`, {
      portalEnabled: enabled,
    });
    successMessage.value = enabled ? "✅ تم فتح البوابة." : "✅ تم إغلاق البوابة.";
    await fetchCompany();
  } catch (err) {
    errorMessage.value = err?.response?.data?.error || "تعذّر تغيير الحالة.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchCompany();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="app-title">إدارة الشركة</div>
        <div class="app-subtitle">{{ company?.name || "..." }}</div>
      </div>
      <div class="top-actions">
        <RouterLink to="/admin/companies" class="btn btn--secondary btn--small">← الشركات</RouterLink>
        <button class="btn btn--secondary btn--small" @click="fetchCompany" :disabled="loading">🔄 تحديث</button>
      </div>
    </header>

    <div class="main-area">
      <div v-if="errorMessage" class="alert alert--danger">{{ errorMessage }}</div>
      <div v-if="successMessage" class="alert alert--success">{{ successMessage }}</div>
      <div v-if="loading" class="status-text">جاري التحميل...</div>

      <div v-else-if="company" class="cards">
        <div class="card">
          <h3 class="card-title">📋 بيانات الشركة</h3>
          <div class="info-grid">
            <div class="info-row"><span class="info-label">الاسم:</span><span class="info-value">{{ company.name || "—" }}</span></div>
            <div class="info-row"><span class="info-label">العنوان:</span><span class="info-value">{{ company.address || "—" }}</span></div>
            <div class="info-row"><span class="info-label">المدينة:</span><span class="info-value">{{ company.city || "—" }}</span></div>
            <div class="info-row"><span class="info-label">الدولة:</span><span class="info-value">{{ company.country || "—" }}</span></div>
            <div class="info-row"><span class="info-label">الهاتف:</span><span class="info-value">{{ company.phone || "—" }}</span></div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">📊 الإحصائيات</h3>
          <div class="stats">
            <div class="stat">
              <div class="stat-label">الفواتير</div>
              <div class="stat-value">{{ company.invoicesCount }}</div>
            </div>
            <div class="stat">
              <div class="stat-label">البوالص</div>
              <div class="stat-value">{{ company.waybillsCount }}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title">🌐 بوابة العميل</h3>
          <div class="portal-status">
            <span class="portal-label">الحالة:</span>
            <span class="badge" :class="company.portalEnabled ? 'badge--on' : 'badge--off'">
              {{ company.portalEnabled ? "مفتوحة" : "مغلقة" }}
            </span>
          </div>
          <div class="portal-form">
            <label class="field">
              <span>البريد الإلكتروني</span>
              <input v-model="email" type="email" :disabled="loading" />
            </label>
            <label class="field">
              <span>كلمة المرور الجديدة</span>
              <input v-model="password" type="password" placeholder="••••••••" :disabled="loading" />
            </label>
          </div>
          <div class="portal-actions">
            <button class="btn btn--primary" :disabled="loading" @click="saveAccount">
              💾 إنشاء/تحديث الحساب
            </button>
            <button
              v-if="!company.portalEnabled"
              class="btn btn--success"
              :disabled="loading || !company.customerEmail"
              @click="togglePortal(true)"
            >
              🔓 فتح بوابة الشركة
            </button>
            <button
              v-else
              class="btn btn--danger"
              :disabled="loading"
              @click="togglePortal(false)"
            >
              🔒 إغلاق البوابة
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.page { min-height: 100vh; background: #f3f4f6; direction: rtl; font-family: "Segoe UI", Tahoma, sans-serif; }
.topbar { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; }
.brand { display: flex; flex-direction: column; gap: 2px; }
.app-title { font-weight: 800; font-size: 18px; color: #111827; }
.app-subtitle { font-size: 12px; color: #6b7280; }
.top-actions { display: flex; gap: 10px; align-items: center; }
.main-area { padding: 14px 18px; max-width: 960px; margin: 0 auto; }
.alert { padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; font-weight: 700; font-size: 14px; }
.alert--danger { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
.alert--success { background: #d1fae5; border: 1px solid #a7f3d0; color: #065f46; }
.status-text { padding: 14px; color: #374151; font-weight: 700; }
.cards { display: flex; flex-direction: column; gap: 14px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; }
.card-title { margin: 0 0 12px; font-size: 15px; font-weight: 800; color: #111827; }
.info-grid { display: flex; flex-direction: column; gap: 8px; }
.info-row { display: flex; gap: 8px; font-size: 13px; }
.info-label { font-weight: 700; color: #374151; min-width: 70px; }
.info-value { color: #111827; }
.stats { display: flex; gap: 14px; }
.stat { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px 16px; flex: 1; text-align: center; }
.stat-label { font-size: 12px; color: #6b7280; font-weight: 700; }
.stat-value { font-size: 22px; font-weight: 800; color: #111827; margin-top: 4px; }
.portal-status { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; font-size: 13px; }
.portal-label { font-weight: 700; color: #374151; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.badge--on { background: #d1fae5; color: #065f46; }
.badge--off { background: #fee2e2; color: #991b1b; }
.portal-form { display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
.field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }
.field span { font-weight: 600; color: #444; }
.field input { padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 13px; outline: none; }
.field input:focus { border-color: #1976d2; box-shadow: 0 0 0 3px rgba(25,118,210,0.12); }
.portal-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.portal-actions .btn { flex: 1; min-width: 160px; }
.btn { padding: 8px 12px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
.btn--secondary { background: #f3f4f6; border-color: #e5e7eb; color: #374151; }
.btn--small { padding: 6px 10px; font-size: 12px; }
.btn--primary { background: #1976d2; color: #fff; }
.btn--success { background: #059669; color: #fff; }
.btn--danger { background: #dc2626; color: #fff; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
