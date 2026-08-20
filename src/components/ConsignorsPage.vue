<script setup>
import { ref, onMounted } from "vue";
import axios from "axios";

const API_BASE = "http://localhost:4000";

const loading = ref(false);
const errorMessage = ref("");

const consignors = ref([]);

const form = ref({
  _id: null,
  name: "",
  address: "",
  city: "",
  country: "",
  phone: "",
  notes: "",
});

function resetForm() {
  form.value = {
    _id: null,
    name: "",
    address: "",
    city: "",
    country: "",
    phone: "",
    notes: "",
  };
}

async function fetchConsignors() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const res = await axios.get(`${API_BASE}/api/consignors`);
    consignors.value = res.data || [];
  } catch (err) {
    console.error(err);
    errorMessage.value = "تعذّر تحميل قائمة المُرسِلين.";
  } finally {
    loading.value = false;
  }
}

function editConsignor(c) {
  form.value = {
    _id: c._id,
    name: c.name || "",
    address: c.address || "",
    city: c.city || "",
    country: c.country || "",
    phone: c.phone || "",
    notes: c.notes || "",
  };
}

async function saveConsignor() {
  loading.value = true;
  errorMessage.value = "";
  try {
    if (!form.value.name.trim()) {
      errorMessage.value = "اسم المرسل مطلوب.";
      return;
    }

    if (form.value._id) {
      await axios.put(
        `${API_BASE}/api/consignors/${form.value._id}`,
        form.value,
      );
    } else {
      await axios.post(`${API_BASE}/api/consignors`, form.value);
    }

    resetForm();
    await fetchConsignors();
  } catch (err) {
    console.error(err);
    errorMessage.value = "تعذّر حفظ بيانات المرسل.";
  } finally {
    loading.value = false;
  }
}

async function deleteConsignor(c) {
  if (!confirm(`هل أنت متأكد من حذف المرسل: ${c.name} ؟`)) return;

  loading.value = true;
  errorMessage.value = "";
  try {
    await axios.delete(`${API_BASE}/api/consignors/${c._id}`);
    await fetchConsignors();
  } catch (err) {
    console.error(err);
    errorMessage.value = "تعذّر حذف المرسل.";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchConsignors();
});
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="topbar-left">
        <div class="app-title">إدارة المرسلين</div>
        <div class="app-subtitle">إدخال وتعديل بيانات المرسل (CONSIGNOR)</div>
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
              {{ form._id ? "تعديل مرسل" : "إضافة مرسل جديد" }}
            </h2>
            <button class="btn btn--secondary" @click="resetForm">
              مسح الحقول
            </button>
          </div>

          <form class="form-grid" @submit.prevent="saveConsignor">
            <label class="form-field">
              <span>اسم المرسل *</span>
              <input v-model="form.name" type="text" required />
            </label>

            <label class="form-field">
              <span>المدينة</span>
              <input v-model="form.city" type="text" />
            </label>

            <label class="form-field">
              <span>الدولة</span>
              <input v-model="form.country" type="text" />
            </label>

            <label class="form-field">
              <span>الهاتف</span>
              <input v-model="form.phone" type="text" />
            </label>

            <label class="form-field form-field--span2">
              <span>العنوان</span>
              <input v-model="form.address" type="text" />
            </label>

            <label class="form-field form-field--full">
              <span>ملاحظات</span>
              <textarea v-model="form.notes" rows="3"></textarea>
            </label>

            <div class="form-actions">
              <button
                class="btn btn--primary"
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
            <h2 class="section-title">قائمة المرسلين</h2>
            <button
              class="btn btn--primary"
              @click="fetchConsignors"
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
                  <th class="col-name">الاسم</th>
                  <th class="col-address">العنوان</th>
                  <th class="col-city">المدينة</th>
                  <th class="col-country">الدولة</th>
                  <th class="col-phone">الهاتف</th>
                  <th class="col-notes">ملاحظات</th>
                  <th class="col-actions">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in consignors" :key="c._id">
                  <td class="col-name">{{ c.name }}</td>
                  <td class="col-address">{{ c.address }}</td>
                  <td class="col-city">{{ c.city }}</td>
                  <td class="col-country">{{ c.country }}</td>
                  <td class="col-phone">{{ c.phone }}</td>
                  <td class="col-notes">{{ c.notes }}</td>
                  <td class="col-actions actions-cell">
                    <button
                      class="btn btn--secondary"
                      @click="editConsignor(c)"
                    >
                      ✏️ تعديل
                    </button>
                    <button
                      class="btn btn--secondary"
                      @click="deleteConsignor(c)"
                    >
                      🗑 حذف
                    </button>
                  </td>
                </tr>
                <tr v-if="consignors.length === 0">
                  <td colspan="7" class="table-empty">
                    لا يوجد مرسلون مسجّلون.
                  </td>
                </tr>
              </tbody>
            </table>
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
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow: hidden;
}

.content-wrapper {
  width: 100%;
  max-width: 1450px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
}

.card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  padding: 20px;
}

.form-card {
  flex-shrink: 0;
}

.list-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  font-size: 13px;
}

.form-field--span2 {
  grid-column: span 2;
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
.form-field textarea {
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 6px 10px;
  font-size: 13px;
  font-family: inherit;
  color: #222;
  background: #fff;
  box-sizing: border-box;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}

.form-field input {
  height: 38px;
}

.form-field textarea {
  min-height: 70px;
  resize: vertical;
}

.form-field input:focus,
.form-field textarea:focus {
  border-color: #1976d2;
  outline: none;
  box-shadow: 0 0 0 3px rgba(25, 118, 210, 0.12);
}

.form-actions {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-start;
  gap: 8px;
  margin-top: 4px;
}

.table-container {
  flex: 1;
  overflow: auto;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.table th,
.table td {
  padding: 10px 12px;
  white-space: nowrap;
  text-align: right;
}

.table th {
  background: #f0f2f5;
  color: #333;
  font-weight: 600;
  border-bottom: 2px solid #e0e0e0;
}

.table td {
  border-bottom: 1px solid #eee;
}

.table tbody tr:last-child td {
  border-bottom: none;
}

.table tbody tr:nth-child(even) td {
  background: #fafbfc;
}

.table tbody tr:hover td {
  background: #f5f7fa;
}

.table-empty {
  text-align: center;
  color: #777;
  padding: 20px;
}

.col-name {
  width: 230px;
  min-width: 230px;
}
.col-address {
  width: 250px;
  min-width: 250px;
}
.col-city {
  width: 140px;
  min-width: 140px;
}
.col-country {
  width: 130px;
  min-width: 130px;
}
.col-phone {
  width: 150px;
  min-width: 150px;
}
.col-notes {
  min-width: 150px;
}
.col-actions {
  width: 160px;
  min-width: 160px;
}

.actions-cell {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

.actions-cell .btn {
  padding: 4px 10px;
  font-size: 12px;
}

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: 1fr;
  }
  .form-field--span2,
  .form-field--full {
    grid-column: 1 / -1;
  }
}
</style>
