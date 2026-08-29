<script setup>
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";

const router = useRouter();
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

const companies = ref([]);
const loading = ref(false);
const errorMessage = ref("");

async function fetchCompanies() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/admin/companies`);
    companies.value = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("fetch companies error:", err);
    errorMessage.value = err?.response?.data?.error || "تعذّر تحميل الشركات.";
  } finally {
    loading.value = false;
  }
}

function goToDetails(id) {
  router.push(`/admin/companies/${id}`);
}

onMounted(() => {
  fetchCompanies();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="brand">
        <div class="app-title">إدارة الشركات</div>
        <div class="app-subtitle">قائمة الشركات والبوابات</div>
      </div>
      <div class="top-actions">
        <RouterLink to="/" class="btn btn--secondary btn--small">← الداشبورد</RouterLink>
        <button class="btn btn--secondary btn--small" @click="fetchCompanies" :disabled="loading">🔄 تحديث</button>
      </div>
    </header>

    <div class="main-area">
      <div v-if="errorMessage" class="alert alert--danger">{{ errorMessage }}</div>
      <div v-if="loading" class="status-text">جاري التحميل...</div>
      <div v-else class="table-card">
        <div class="table-scroll">
          <table class="table">
            <thead>
              <tr>
                <th>الشركة</th>
                <th>الحالة</th>
                <th>بريد العميل</th>
                <th>الفواتير</th>
                <th>البوالص</th>
                <th>عمليات</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in companies" :key="c._id">
                <td>{{ c.name || "—" }}</td>
                <td>
                  <span class="badge" :class="c.portalEnabled ? 'badge--on' : 'badge--off'">
                    {{ c.portalEnabled ? "مفتوحة" : "مغلقة" }}
                  </span>
                </td>
                <td>{{ c.customerEmail || "—" }}</td>
                <td>{{ c.invoicesCount }}</td>
                <td>{{ c.waybillsCount }}</td>
                <td>
                  <button class="btn btn--secondary btn--small" @click="goToDetails(c._id)">⚙️ إدارة الشركة</button>
                </td>
              </tr>
              <tr v-if="companies.length === 0">
                <td colspan="6" class="table-empty">لا توجد شركات.</td>
              </tr>
            </tbody>
          </table>
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
.main-area { padding: 14px 18px; }
.alert { padding: 10px 12px; border-radius: 10px; margin-bottom: 12px; font-weight: 700; font-size: 14px; }
.alert--danger { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; }
.status-text { padding: 14px; color: #374151; font-weight: 700; }
.table-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
.table-scroll { overflow-x: auto; }
.table { width: 100%; border-collapse: collapse; font-size: 13px; }
.table th, .table td { padding: 10px 12px; text-align: right; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
.table th { background: #f9fafb; font-weight: 700; color: #374151; font-size: 12px; }
.table tbody tr:hover { background: #f9fafb; }
.table-empty { text-align: center; color: #6b7280; padding: 20px; }
.btn { padding: 8px 12px; border-radius: 8px; border: 1px solid transparent; cursor: pointer; font-weight: 700; font-size: 13px; text-decoration: none; display: inline-flex; align-items: center; }
.btn--secondary { background: #f3f4f6; border-color: #e5e7eb; color: #374151; }
.btn--small { padding: 6px 10px; font-size: 12px; }
.btn:disabled { opacity: 0.6; cursor: not-allowed; }
.badge { padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.badge--on { background: #d1fae5; color: #065f46; }
.badge--off { background: #fee2e2; color: #991b1b; }
</style>
