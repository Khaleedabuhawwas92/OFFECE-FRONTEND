<script setup>
import {
  ref,
  watch,
  onBeforeUnmount,
  computed,
  nextTick,
  onMounted,
} from "vue";

const props = defineProps({
  title: { type: String, default: "Preview" },
  html: { type: String, default: "" },
});

const emit = defineEmits(["close", "print"]);

const frameRef = ref(null);
defineExpose({ frameRef });

const scale = ref(100);
const MIN_SCALE = 60;
const MAX_SCALE = 160;
const AUTO_FIT_MAX = 100;

const srcDoc = computed(() => {
  const h = String(props.html || "").trim();
  if (!h) return "<!doctype html><html><body></body></html>";
  if (/<html[\s>]/i.test(h)) return h;
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

function onKey(e) {
  if (e.key === "Escape") close();
}

window.addEventListener("keydown", onKey);
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onKey);
});

async function doPrint() {
  const iframe = frameRef.value;
  const w = iframe?.contentWindow;
  if (!iframe || !w) return;
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

function zoomIn() {
  scale.value = Math.min(MAX_SCALE, scale.value + 10);
}
function zoomOut() {
  scale.value = Math.max(MIN_SCALE, scale.value - 10);
}
function resetZoom() {
  scale.value = 100;
}
function fitZoom() {
  nextTick(() => {
    requestAnimationFrame(() => {
      const viewport = document.querySelector(".pv-body");
      if (!viewport) return;
      const available = viewport.clientWidth - 40;
      const base = 793;
      const s = Math.max(
        MIN_SCALE,
        Math.min(AUTO_FIT_MAX, Math.floor((available / base) * 100)),
      );
      scale.value = s;
    });
  });
}

watch(
  () => props.html,
  async () => {
    await nextTick();
    fitZoom();
  },
);

onMounted(() => {
  fitZoom();
  window.addEventListener("resize", fitZoom);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", fitZoom);
});
</script>

<template>
  <div class="pv-overlay" @click.self="close">
    <div class="pv-modal">
      <div class="pv-toolbar">
        <div class="pv-toolbar-right">
          <h3>{{ title }}</h3>
          <p>المعاينة تظهر كما ستطبع على A4</p>
        </div>

        <div class="pv-toolbar-left">
          <button
            class="btn btn--tool"
            type="button"
            @click="zoomOut"
            title="تصغير"
          >
            −
          </button>
          <span class="zoom-value">{{ scale }}%</span>
          <button
            class="btn btn--tool"
            type="button"
            @click="zoomIn"
            title="تكبير"
          >
            +
          </button>
          <button class="btn btn--tool" type="button" @click="fitZoom">
            ملاءمة
          </button>
          <button class="btn btn--tool" type="button" @click="resetZoom">
            100%
          </button>
          <div class="toolbar-divider"></div>
          <button class="btn btn--primary" type="button" @click="doPrint">
            🖨 طباعة
          </button>
          <button class="btn btn--x" type="button" @click="close">✕</button>
        </div>
      </div>

      <div class="pv-body" :style="{ '--scale': String(scale / 100) }">
        <div class="pv-scaler">
          <div class="pv-paper">
            <iframe ref="frameRef" class="pv-iframe" :srcdoc="srcDoc"></iframe>
          </div>
        </div>
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
  width: min(1500px, 96vw);
  height: 94vh;
  max-height: 94vh;
  background: #fff;
  border-radius: 14px;
  border: 1px solid #d0d5dd;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.pv-toolbar {
  padding: 12px 18px;
  border-bottom: 1px solid #e2e6ec;
  background: #fff;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-shrink: 0;
  flex-wrap: wrap;
}
.pv-toolbar-right {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.pv-toolbar-right h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 900;
  color: #111827;
}
.pv-toolbar-right p {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.pv-toolbar-left {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}
.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #d0d5dd;
  margin: 0 4px;
}
.zoom-value {
  font-size: 12px;
  font-weight: 700;
  color: #374151;
  min-width: 40px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pv-body {
  --scale: 1;
  flex: 1;
  overflow: auto;
  background: #eef1f5;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 20px;
}
.pv-scaler {
  width: calc(793px * var(--scale));
  height: calc(1122px * var(--scale));
  margin: 0 auto;
  flex-shrink: 0;
}
.pv-paper {
  width: 793px;
  height: 1122px;
  background: #fff;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
  border: 1px solid #d0d5dd;
  border-radius: 3px;
  transform: scale(var(--scale));
  transform-origin: top left;
}
.pv-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
.btn {
  padding: 7px 12px;
  font-size: 13px;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid transparent;
  font-family: inherit;
}
.btn--tool {
  background: #f3f5f8;
  border-color: #d0d5dd;
  color: #374151;
  font-weight: 600;
}
.btn--tool:hover {
  background: #e8ecf2;
}
.btn--primary {
  background: #1976d2;
  color: #fff;
  font-weight: 600;
}
.btn--primary:hover {
  background: #1565c0;
}
.btn--x {
  background: transparent;
  border: 1px solid #d0d5dd;
  color: #4b5563;
}
.btn--x:hover {
  background: #f3f5f8;
}

@media (max-width: 640px) {
  .pv-overlay {
    padding: 0;
  }
  .pv-modal {
    width: 100%;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
  .pv-toolbar {
    padding: 10px 12px;
  }
  .pv-body {
    padding: 12px;
  }
}
</style>
