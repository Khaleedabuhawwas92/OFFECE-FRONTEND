<script setup>
// ✅ صفحة /waybills/new تستخدم نفس نموذج الإنشاء (WaybillCreateModal) —
// نموذج واحد للإنشاء بدل نسختين مختلفتين الحقول والتسميات
import { useRouter } from "vue-router";
import WaybillCreateModal from "./WaybillCreateModal.vue";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";
const router = useRouter();

function goHome() {
  router.push({ path: "/", query: { refresh: "1", type: "waybill" } });
}

function onSaved() {
  alert("✅ تم حفظ البوليصة");
  goHome();
}
</script>

<template>
  <WaybillCreateModal :api-base="API_BASE" @close="goHome" @saved="onSaved" />
</template>
