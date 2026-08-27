<template>
  <div class="w-full min-h-screen bg-gray-100 p-6">
    <div class="max-w-5xl mx-auto">
      <!-- ===================== Drivers ===================== -->
      <SectionBox title="السائقين">
        <div class="flex gap-3 mb-3">
          <input v-model="driverName" placeholder="اسم السائق" class="input" />
          <button @click="addDriver" class="btn-primary">إضافة</button>
        </div>

        <table class="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>اسم السائق</th>
              <th>حذف</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(d, index) in drivers" :key="d._id">
              <td>{{ index + 1 }}</td>
              <td>{{ d.name }}</td>
              <td>
                <button @click="removeDriver(d._id)" class="btn-danger">
                  X
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </SectionBox>

      <!-- ===================== Shippers ===================== -->
      <SectionBox title="المرسلون (Shippers)">
        <div class="flex gap-3 mb-3">
          <input v-model="shipperName" placeholder="اسم المرسل" class="input" />
          <button @click="addShipper" class="btn-primary">إضافة</button>
        </div>

        <table class="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>اسم المرسل</th>
              <th>حذف</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, index) in shippers" :key="s._id">
              <td>{{ index + 1 }}</td>
              <td>{{ s.name }}</td>
              <td>
                <button @click="removeShipper(s._id)" class="btn-danger">
                  X
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </SectionBox>

      <!-- ===================== Consignees ===================== -->
      <SectionBox title="المرسل إليهم (Consignees)">
        <div class="flex gap-3 mb-3">
          <input
            v-model="consigneeName"
            placeholder="اسم المرسل إليه"
            class="input"
          />
          <button @click="addConsignee" class="btn-primary">إضافة</button>
        </div>

        <table class="tbl">
          <thead>
            <tr>
              <th>#</th>
              <th>اسم المرسل إليه</th>
              <th>حذف</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, index) in consignees" :key="c._id">
              <td>{{ index + 1 }}</td>
              <td>{{ c.name }}</td>
              <td>
                <button @click="removeConsignee(c._id)" class="btn-danger">
                  X
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </SectionBox>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import axios from "axios";

const API = (import.meta.env.VITE_API_URL || "http://127.0.0.1:4000") + "/api";

// ====== state variables ======
const drivers = ref([]);
const shippers = ref([]);
const consignees = ref([]);

const driverName = ref("");
const shipperName = ref("");
const consigneeName = ref("");

// ================= API Calls =================
async function loadAll() {
  drivers.value = (await axios.get(`${API}/drivers`)).data;
  shippers.value = (await axios.get(`${API}/shippers`)).data;
  consignees.value = (await axios.get(`${API}/consignees`)).data;
}

async function addDriver() {
  if (!driverName.value) return;
  await axios.post(`${API}/drivers`, { name: driverName.value });
  driverName.value = "";
  loadAll();
}

async function removeDriver(id) {
  await axios.delete(`${API}/drivers/${id}`);
  loadAll();
}

async function addShipper() {
  if (!shipperName.value) return;
  await axios.post(`${API}/shippers`, { name: shipperName.value });
  shipperName.value = "";
  loadAll();
}

async function removeShipper(id) {
  await axios.delete(`${API}/shippers/${id}`);
  loadAll();
}

async function addConsignee() {
  if (!consigneeName.value) return;
  await axios.post(`${API}/consignees`, { name: consigneeName.value });
  consigneeName.value = "";
  loadAll();
}

async function removeConsignee(id) {
  await axios.delete(`${API}/consignees/${id}`);
  loadAll();
}

onMounted(() => loadAll());
</script>

<style>
.input {
  @apply border px-3 py-2 rounded w-full;
}

.btn-primary {
  @apply bg-blue-600 text-white px-4 py-2 rounded;
}

.btn-danger {
  @apply bg-red-600 text-white px-2 py-1 rounded;
}

.tbl {
  @apply w-full bg-white border;
}
.tbl th {
  @apply border px-2 py-1 bg-gray-200;
}
.tbl td {
  @apply border px-2 py-1;
}
</style>

<!-- Section box reusable -->
<script>
export default {
  components: {
    SectionBox: {
      props: ["title"],
      template: `
        <div class="bg-white shadow p-4 mb-6 rounded">
          <h2 class="text-xl font-bold mb-4">{{ title }}</h2>
          <slot></slot>
        </div>
      `,
    },
  },
};
</script>
