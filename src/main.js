import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import axios from "axios";

// Attach Bearer token to every axios request
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const app = createApp(App);
app.use(router);

const token = localStorage.getItem("auth_token");
const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:4000";
if (token) {
  axios
    .get(`${API_BASE}/api/auth/me`, { timeout: 5000 })
    .then(() => app.mount("#app"))
    .catch(() => {
      localStorage.removeItem("auth_token");
      router.replace("/login").then(() => app.mount("#app"));
    });
} else {
  app.mount("#app");
}
