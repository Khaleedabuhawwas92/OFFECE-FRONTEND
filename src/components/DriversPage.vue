<script setup>
import { ref, onMounted } from "vue";
import axios from "axios";

const API_BASE = "http://localhost:4000";

const loading = ref(false);
const errorMessage = ref("");
const drivers = ref([]);

const form = ref({
  _id: null,
  name: "",
  phone: "",
  vehicle_no: "",
  vehicle_city: "", // ✅ جديد
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
      <div v-if="errorMessage" class="alert alert--danger">
        {{ errorMessage }}
      </div>

      <section class="section">
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

          <label class="form-field">
            <span>رقم الرخصة</span>
            <input v-model="form.license_no" type="text" />
          </label>

          <label class="form-field form-field--full">
            <span>ملاحظات</span>
            <textarea v-model="form.notes" rows="2"></textarea>
          </label>

          <div class="form-actions">
            <button class="btn btn--primary" type="submit" :disabled="loading">
              💾 حفظ
            </button>
          </div>
        </form>

        <hr class="divider" />

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

        <div v-if="loading" class="status-text">جاري التحميل...</div>

        <div v-else class="table-container">
          <table class="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الهاتف</th>
                <th>رقم المركبة</th>
                <th>مدينة المركبة</th>
                <!-- ✅ جديد -->
                <th>رقم الرخصة</th>
                <th>ملاحظات</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in drivers" :key="d._id">
                <td>{{ d.name }}</td>
                <td>{{ d.phone }}</td>
                <td>{{ d.vehicle_no }}</td>
                <td>{{ d.vehicle_city }}</td>
                <!-- ✅ جديد -->
                <td>{{ d.license_no }}</td>
                <td>{{ d.notes }}</td>
                <td>
                  <button class="btn btn--secondary" @click="editDriver(d)">
                    ✏️ تعديل
                  </button>
                  <button class="btn btn--secondary" @click="deleteDriver(d)">
                    🗑 حذف
                  </button>
                </td>
              </tr>
              <tr v-if="drivers.length === 0">
                <td colspan="7" class="table-empty">لا يوجد سائقون مسجّلون.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
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

.main-area {
  flex: 1;
  padding: 12px 24px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  font-size: 18px;
  margin: 0;
}

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

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 20px;
  margin-bottom: 16px;
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
  margin-bottom: 4px;
}

.form-field input,
.form-field textarea {
  border-radius: 4px;
  border: 1px solid #ccc;
  padding: 6px 8px;
  font-size: 13px;
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

.divider {
  margin: 12px 0;
  border: none;
  border-top: 1px solid #ccc;
}

.table-container {
  flex: 1;
  overflow: auto;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 4px;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th,
.table td {
  border: 1px solid #ddd;
  padding: 8px;
  white-space: nowrap;
}

.table th {
  background: #f5f5f5;
  font-weight: bold;
}

.table tr:nth-child(even) td {
  background: #fafafa;
}

.table-empty {
  text-align: center;
  color: #777;
  padding: 20px;
}
</style>
