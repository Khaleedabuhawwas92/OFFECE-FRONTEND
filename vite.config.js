import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],

  // ✅ مهم جدًا للـ Electron (لما تفتح dist/index.html كـ file://)
  base: "./",

  // (اختياري بس مفيد)
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
