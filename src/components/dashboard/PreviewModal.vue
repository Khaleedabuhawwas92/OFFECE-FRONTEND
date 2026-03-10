<script setup>
import { ref, watch, onBeforeUnmount, computed, nextTick } from "vue";

const props = defineProps({
  title: { type: String, default: "Preview" },
  html: { type: String, default: "" },
});

const emit = defineEmits(["close", "print"]);

const frameRef = ref(null);
defineExpose({ frameRef });

const srcDoc = computed(() => {
  const h = String(props.html || "").trim();
  if (!h) return "<!doctype html><html><body></body></html>";

  // إذا القالب أصلاً كامل
  if (/<html[\s>]/i.test(h)) return h;

  // لو مش كامل، لفّه
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>${h}</body>
</html>`;
});

function close() {
  emit("close");
}

// ✅ ESC يغلق
function onKey(e) {
  if (e.key === "Escape") close();
}

window.addEventListener("keydown", onKey);

onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
});

/* ✅ print reliable */
async function doPrint() {
  const iframe = frameRef.value;
  const w = iframe?.contentWindow;
  if (!iframe || !w) return;

  // إذا لسا ما حمل، استنى load مرة وحدة
  if (w.document?.readyState !== "complete") {
    await new Promise((resolve) => {
      const handler = () => {
        iframe.removeEventListener("load", handler);
        resolve();
      };
      iframe.addEventListener("load", handler);
    });
  }

  w.focus();
  w.print();
}

// ✅ لما يتغير html، استنى iframe يحدث
watch(
  () => props.html,
  async () => {
    await nextTick();
  },
);
</script>

<template>
  <div class="pv-overlay" @click.self="close">
    <div class="pv-modal">
      <div class="pv-top">
        <div class="pv-title">
          <h3>{{ title }}</h3>
          <p>المعاينة تظهر كما ستُطبع على A4</p>
        </div>

        <div class="pv-actions">
          <button class="btn btn--secondary" type="button" @click="doPrint">
            🖨 طباعة
          </button>
          <button class="btn btn--x" type="button" @click="close">✕</button>
        </div>
      </div>

      <div class="pv-body">
        <iframe ref="frameRef" class="pv-iframe" :srcdoc="srcDoc"></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pv-overlay {
  position: fixed;
  inset: 0;
  background: rgba(17, 24, 39, 0.6);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 99999;
  padding: 18px;
}
.pv-modal {
  width: min(1100px, 100%);
  height: min(92vh, 900px);
  background: #fff;
  border-radius: 14px;
  border: 1px solid #ddd;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.pv-top {
  padding: 12px 14px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
.pv-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
}
.pv-title p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #666;
}
.pv-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}
.pv-body {
  flex: 1;
  background: #f3f4f6;
  padding: 10px;
}
.pv-iframe {
  width: 100%;
  height: 100%;
  border: 1px solid #ddd;
  border-radius: 10px;
  background: #fff;
}
.btn {
  padding: 8px 12px;
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
}
.btn--secondary {
  background: #f5f5f5;
  border-color: #d0d0d0;
  color: #222;
}
.btn--x {
  background: transparent;
  border: 1px solid #ddd;
  color: #333;
}
</style>
