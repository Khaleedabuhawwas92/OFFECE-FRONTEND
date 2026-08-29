<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import axios from "axios";

const router = useRouter();

const email = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";

function getTokenRole(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.role || null;
  } catch {
    return null;
  }
}

async function handleLogin() {
  error.value = "";
  if (!email.value.trim() || !password.value) {
    error.value = "يرجى إدخال البريد وكلمة المرور";
    return;
  }
  loading.value = true;
  try {
    const res = await axios.post(`${API_BASE}/api/auth/login`, {
      email: email.value.trim(),
      password: password.value,
    });
    const token = res.data?.token;
    if (!token) {
      error.value = "رد غير متوقع من السيرفر";
      return;
    }
    const role = getTokenRole(token);
    if (role !== "CUSTOMER") {
      error.value = "هذا الحساب ليس حساب عميل";
      return;
    }
    localStorage.setItem("auth_token", token);
    router.push("/customer/dashboard");
  } catch (err) {
    error.value =
      err?.response?.data?.error || "فشل تسجيل الدخول، تحقق من البيانات";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1 class="login-title">بوابة العملاء</h1>
      <p class="login-subtitle">تسجيل دخول العميل</p>

      <form class="login-form" @submit.prevent="handleLogin">
        <div class="field">
          <label for="c-email">البريد الإلكتروني</label>
          <input
            id="c-email"
            v-model="email"
            type="email"
            placeholder="customer@example.com"
            autocomplete="username"
            :disabled="loading"
          />
        </div>

        <div class="field">
          <label for="c-password">كلمة المرور</label>
          <input
            id="c-password"
            v-model="password"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            :disabled="loading"
          />
        </div>

        <div v-if="error" class="error-msg">{{ error }}</div>

        <button type="submit" class="btn-login" :disabled="loading">
          <span v-if="loading">جاري الدخول...</span>
          <span v-else>دخول</span>
        </button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f3f4f6;
  direction: rtl;
}

.login-card {
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  width: 100%;
  max-width: 380px;
}

.login-title {
  margin: 0 0 0.25rem;
  font-size: 1.5rem;
  font-weight: 700;
  color: #111827;
  text-align: center;
}

.login-subtitle {
  margin: 0 0 1.5rem;
  font-size: 0.9rem;
  color: #6b7280;
  text-align: center;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.field label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #374151;
}

.field input {
  padding: 0.6rem 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.field input:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
}

.field input:disabled {
  background: #f9fafb;
  opacity: 0.7;
}

.error-msg {
  background: #fef2f2;
  color: #b91c1c;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
}

.btn-login {
  background: #2563eb;
  color: #fff;
  border: none;
  padding: 0.7rem;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-login:hover {
  background: #1d4ed8;
}

.btn-login:disabled {
  background: #93c5fd;
  cursor: not-allowed;
}
</style>
