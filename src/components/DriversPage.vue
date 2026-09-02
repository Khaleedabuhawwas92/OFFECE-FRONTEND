<script setup>
import { ref, computed, watch, onMounted } from "vue";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

const loading = ref(false);
const errorMessage = ref("");
const drivers = ref([]);

const searchQuery = ref("");
const currentPage = ref(1);
const pageSize = 10;

const filteredDrivers = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return drivers.value;
  return drivers.value.filter((d) =>
    (d.name || "").toLowerCase().includes(q)
  );
});

const totalPages = computed(() =>
  Math.max(1, Math.ceil(filteredDrivers.value.length / pageSize))
);

const pageNumbers = computed(() => {
  const pages = [];
  for (let i = 1; i <= totalPages.value; i++) pages.push(i);
  return pages;
});

watch(totalPages, (tp) => {
  if (currentPage.value > tp) currentPage.value = tp;
});

watch(searchQuery, () => {
  currentPage.value = 1;
});

const paginatedDrivers = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return filteredDrivers.value.slice(start, start + pageSize);
});

/* ✅ خيارات نوع المركبة / التريلا (نفس خيارات صفحة تعديل البوليصة) */
const VEHICLE_TYPE_OPTIONS = ["تريلا - سطحة", "تريلا", "سطحة"];

const form = ref({
  _id: null,
  name: "",
  phone: "",
  vehicle_no: "",
  vehicle_city: "", // ✅ جديد
  vehicleType: "", // ✅ نوع المركبة / التريلا
  license_no: "",
  notes: "",
});

function resetForm() {
  form.value = {
    _id: null,
    name: "",
    phone: "",
    vehicle_no: "",
    vehicle_city: "", // ✅ جديد
    vehicleType: "",
    license_no: "",
    notes: "",
  };
}

async function fetchDrivers() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/drivers`);
    drivers.value = res.data || [];
  } catch (err) {
    console.error(err);
    errorMessage.value = "تعذّر تحميل قائمة السائقين.";
  } finally {
    loading.value = false;
  }
}

function editDriver(d) {
  form.value = {
    _id: d._id,
    name: d.name || "",
    phone: d.phone || "",
    vehicle_no: d.vehicle_no || "",
    vehicle_city: d.vehicle_city || "", // ✅ جديد
    vehicleType: d.vehicleType || "",
    license_no: d.license_no || "",
    notes: d.notes || "",
  };
}

async function saveDriver() {
  loading.value = true;
  errorMessage.value = "";
  try {
    if (!form.value.name.trim()) {
      errorMessage.value = "اسم السائق مطلوب.";
      return;
    }

    // ✅ (اختياري) تحقق بسيط: إذا كتب رقم مركبة بدون مدينة
    if (form.value.vehicle_no?.trim() && !form.value.vehicle_city?.trim()) {
      // مش شرط تمنعه، بس تنبيه
      // errorMessage.value = "مدينة المركبة مطلوبة عند إدخال رقم مركبة.";
      // return;
    }

    if (form.value._id) {
      await axios.put(`${API_BASE}/api/drivers/${form.value._id}`, form.value);
    } else {
      await axios.post(`${API_BASE}/api/drivers`, form.value);
    }

    resetForm();
    await fetchDrivers();
  } catch (err) {
    console.error(err);
    errorMessage.value = "تعذّر حفظ بيانات السائق.";
  } finally {
    loading.value = false;
  }
}

async function deleteDriver(d) {
  if (!confirm(`هل أنت متأكد من حذف السائق: ${d.name} ؟`)) return;

  loading.value = true;
  errorMessage.value = "";
  try {
    await axios.delete(`${API_BASE}/api/drivers/${d._id}`);
    await fetchDrivers();
  } catch (err) {
    console.error(err);
    errorMessage.value = "تعذّر حذف السائق.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchDrivers();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar-left">
        <div class="app-title">إدارة السائقين</div>
        <div class="app-subtitle">إدخال وتعديل بيانات السائقين</div>
      </div>

      <nav class="main-nav">
        <RouterLink to="/" class="nav-link">الداشبورد</RouterLink>
        <RouterLink to="/drivers" class="nav-link">السائقين</RouterLink>
        <RouterLink to="/consignors" class="nav-link">المرسلون</RouterLink>
        <RouterLink to="/consignees" class="nav-link">المرسل إليهم</RouterLink>
      </nav>
    </header>

    <div class="main-area">
      <div class="content-wrapper">
        <div v-if="errorMessage" class="alert alert--danger">
          {{ errorMessage }}
        </div>

        <section class="card form-card">
          <div class="section-header">
            <h2 class="section-title">
              {{ form._id ? "تعديل سائق" : "إضافة سائق جديد" }}
            </h2>
            <button class="btn btn--secondary" @click="resetForm">
              مسح الحقول
            </button>
          </div>

          <form class="form-grid" @submit.prevent="saveDriver">
            <label class="form-field">
              <span>اسم السائق *</span>
              <input v-model="form.name" type="text" required />
            </label>

            <label class="form-field">
              <span>رقم الهاتف</span>
              <input v-model="form.phone" type="text" />
            </label>

            <label class="form-field">
              <span>رقم المركبة</span>
              <input v-model="form.vehicle_no" type="text" />
            </label>

            <!-- ✅ جديد -->
            <label class="form-field">
              <span>مدينة / منطقة المركبة</span>
              <input v-model="form.vehicle_city" type="text" />
            </label>

            <!-- ✅ نوع المركبة / التريلا -->
            <label class="form-field">
              <span>نوع المركبة / التريلا</span>
              <select v-model="form.vehicleType">
                <option value="">—</option>
                <option v-for="t in VEHICLE_TYPE_OPTIONS" :key="t" :value="t">
                  {{ t }}
                </option>
                <option
                  v-if="
                    form.vehicleType &&
                    !VEHICLE_TYPE_OPTIONS.includes(form.vehicleType)
                  "
                  :value="form.vehicleType"
                >
                  {{ form.vehicleType }}
                </option>
              </select>
            </label>

            <label class="form-field">
              <span>رقم الرخصة</span>
              <input v-model="form.license_no" type="text" />
            </label>

            <label class="form-field form-field--full">
              <span>ملاحظات</span>
              <textarea v-model="form.notes" rows="2"></textarea>
            </label>

            <div class="form-actions">
              <button
                class="btn btn--primary btn--save"
                type="submit"
                :disabled="loading"
              >
                💾 حفظ
              </button>
            </div>
          </form>
        </section>

        <section class="card list-card">
          <div class="section-header">
            <h2 class="section-title">قائمة السائقين</h2>
            <button
              class="btn btn--primary"
              @click="fetchDrivers"
              :disabled="loading"
            >
              🔄 تحديث
            </button>
          </div>

          <div class="search-row">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="بحث عن السائق..."
              class="search-input"
            />
          </div>

          <div v-if="loading" class="status-text">جاري التحميل...</div>

          <div v-else class="table-container">
            <table class="table">
              <thead>
                <tr>
                  <th class="th-name">الاسم</th>
                  <th class="th-phone">الهاتف</th>
                  <th class="th-vehicle">رقم المركبة</th>
                  <th class="th-city">مدينة المركبة</th>
                  <!-- ✅ جديد -->
                  <th class="th-license">رقم الرخصة</th>
                  <th class="th-notes">ملاحظات</th>
                  <th class="th-actions">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="d in paginatedDrivers" :key="d._id">
                  <td>{{ d.name }}</td>
                  <td>{{ d.phone }}</td>
                  <td>{{ d.vehicle_no }}</td>
                  <td>{{ d.vehicle_city }}</td>
                  <!-- ✅ جديد -->
                  <td>{{ d.license_no }}</td>
                  <td class="td-notes">{{ d.notes }}</td>
                  <td>
                    <div class="actions-cell">
                      <button
                        class="btn btn--secondary btn--compact"
                        @click="editDriver(d)"
                      >
                        ✏️ تعديل
                      </button>
                      <button
                        class="btn btn--secondary btn--compact"
                        @click="deleteDriver(d)"
                      >
                        🗑 حذف
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredDrivers.length === 0">
                  <td colspan="7" class="table-empty">
                    لا يوجد سائقون مسجّلون.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="pagination" v-if="totalPages > 1">
            <button
              class="btn btn--secondary btn--compact"
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              السابق
            </button>
            <button
              v-for="p in pageNumbers"
              :key="p"
              class="btn btn--compact"
              :class="{ 'btn--primary': currentPage === p, 'btn--secondary': currentPage !== p }"
              @click="currentPage = p"
            >
              {{ p }}
            </button>
            <button
              class="btn btn--secondary btn--compact"
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              التالي
            </button>
          </div>
        </section>
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
  width: 100%;
  background: #eef0f3;
  direction: rtl;
  display: flex;
  flex-direction: column;
  font-family: "Segoe UI", Tahoma, sans-serif;
  color: #222;
  box-sizing: border-box;
  overflow: hidden;
}

/* Header — kept exactly as original */
.topbar {
  background: #ffffff;
  padding: 16px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ccc;
  flex-shrink: 0;
}

.topbar-left {
  display: flex;
  flex-direction: column;
}

.app-title {
  font-size: 20px;
  font-weight: 600;
}

.app-subtitle {
  color: #666;
  font-size: 12px;
}

.main-nav {
  display: flex;
  gap: 8px;
  align-items: center;
}

.nav-link {
  font-size: 13px;
  text-decoration: none;
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #ddd;
  color: #333;
  background: #fafafa;
}

.nav-link.router-link-active {
  background: #1976d2;
  color: #fff;
  border-color: #1976d2;
}

/* Main area & centered content wrapper */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.content-wrapper {
  width: 100%;
  max-width: 1450px;
  margin: 0 auto;
  padding: 20px 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
}

/* Cards */
.card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  padding: 20px 24px;
}

.form-card {
  margin-bottom: 20px;
}

.list-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Section header */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-title {
  font-size: 18px;
  margin: 0;
  font-weight: 600;
}

/* Buttons */
.btn {
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 4px;
}

.btn--primary {
  background: #1976d2;
  color: white;
  border: none;
}
.btn--primary:disabled {
  opacity: 0.5;
}

.btn--secondary {
  background: #f5f5f5;
  color: #333;
  border: 1px solid #ccc;
}

.btn--save {
  padding: 8px 24px;
  font-size: 14px;
  border-radius: 6px;
}

.btn--compact {
  padding: 4px 10px;
  font-size: 12px;
}

.alert--danger {
  background: #ffebee;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 10px;
  border: 1px solid #ef9a9a;
  color: #b71c1c;
}

.status-text {
  font-size: 13px;
  color: #444;
  margin-bottom: 6px;
}

/* Form grid — 3 columns on desktop */
.form-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px 20px;
}

.form-field {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.form-field--full {
  grid-column: 1 / -1;
}

.form-field span {
  margin-bottom: 6px;
  font-weight: 500;
  color: #444;
}

.form-field input,
.form-field select,
.form-field textarea {
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 8px 10px;
  font-size: 13px;
  font-family: inherit;
  color: #222;
  background: #fff;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
  box-sizing: border-box;
}

.form-field input,
.form-field select {
  height: 38px;
}

.form-field textarea {
  resize: vertical;
  min-height: 60px;
}

.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.12);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  margin-top: 4px;
}

/* Table */
.table-container {
  flex: 1;
  overflow: auto;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 6px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}

.table th,
.table td {
  border: 1px solid #e0e0e0;
  padding: 10px 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: right;
  vertical-align: middle;
}

.table th {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
  position: sticky;
  top: 0;
  z-index: 1;
}

.table tr:nth-child(even) td {
  background: #fafafa;
}

.table-empty {
  text-align: center;
  color: #777;
  padding: 20px;
}

/* Explicit column widths */
.th-name {
  width: 230px;
}
.th-phone {
  width: 150px;
}
.th-vehicle {
  width: 140px;
}
.th-city {
  width: 160px;
}
.th-license {
  width: 150px;
}
.th-notes {
  width: auto;
}
.th-actions {
  width: 160px;
}

.td-notes {
  white-space: normal;
}

.actions-cell {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-start;
}

/* Search & Pagination */
.search-row {
  margin-bottom: 12px;
}
.search-input {
  width: 100%;
  max-width: 320px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #ccc;
  font-size: 13px;
  font-family: inherit;
  box-sizing: border-box;
}
.search-input:focus {
  outline: none;
  border-color: #1976d2;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.12);
}

.pagination {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: center;
  margin-top: 12px;
  flex-wrap: wrap;
}

/* Responsive */
@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .content-wrapper {
    padding: 16px;
  }
  .card {
    padding: 16px;
  }
  .form-grid {
    grid-template-columns: 1fr;
  }
  .table th,
  .table td {
    padding: 8px;
  }
}
</style>
