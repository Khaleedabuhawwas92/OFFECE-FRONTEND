// electron/main.js (أو main.cjs حسب مشروعك)
const { app, BrowserWindow, dialog, ipcMain, net } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

let mainWin = null;
let serverProcess = null;

function downloadToBuffer(url) {
  return new Promise((resolve, reject) => {
    const request = net.request(url);

    request.on("response", (response) => {
      if (response.statusCode && response.statusCode >= 400) {
        reject(
          new Error(`HTTP ${response.statusCode} while downloading: ${url}`),
        );
        return;
      }

      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(Buffer.concat(chunks)));
      response.on("error", reject);
    });

    request.on("error", reject);
    request.end();
  });
}

// ✅ انتظار Vite بدلاً من المحاولة العمياء
function waitForDevServer(devUrl, tries = 60, delayMs = 300) {
  return new Promise((resolve, reject) => {
    let count = 0;

    const ping = () => {
      const req = net.request(devUrl);
      req.on("response", (res) => {
        // أي response معناها السيرفر شغال
        res.on("data", () => {});
        res.on("end", () => resolve(true));
      });
      req.on("error", () => {
        count += 1;
        if (count >= tries)
          reject(new Error(`Dev server not reachable: ${devUrl}`));
        else setTimeout(ping, delayMs);
      });
      req.end();
    };

    ping();
  });
}

async function createWindow() {
  mainWin = new BrowserWindow({
    width: 1300,
    height: 850,
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // ✅ افتح devtools مؤقتاً حتى نشوف console
  mainWin.webContents.openDevTools({ mode: "detach" });

  // ✅ لو فشل اللود لأي سبب، اطبع السبب
  mainWin.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL) => {
      console.error("❌ did-fail-load:", {
        errorCode,
        errorDescription,
        validatedURL,
      });

      mainWin.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(`
            <div style="font-family:Tahoma;padding:20px">
              <h2>❌ فشل تحميل الصفحة</h2>
              <p><b>URL:</b> ${validatedURL}</p>
              <p><b>Error:</b> ${errorDescription} (${errorCode})</p>
              <hr/>
              <p>جرّب:</p>
              <ul>
                <li>شغّل Vite: <b>npm run dev</b></li>
                <li>وتأكد البورت 5173 شغال</li>
              </ul>
            </div>
          `),
      );
    },
  );

  const isDev = !app.isPackaged;

  if (isDev) {
    const devUrl = process.env.VITE_DEV_SERVER_URL || "http://127.0.0.1:5173/";

    console.log("✅ DEV mode. Loading:", devUrl);

    try {
      await mainWin.loadURL(devUrl);
    } catch (e) {
      console.error("❌ loadURL failed:", e);
      // رح ينمسك من did-fail-load غالباً
    }
  } else {
    const distPath = path.join(process.cwd(), "dist", "index.html");
    console.log("✅ PROD mode. Loading file:", distPath);

    if (!fs.existsSync(distPath)) {
      console.error("❌ dist/index.html not found:", distPath);
      mainWin.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(`
            <div style="font-family:Tahoma;padding:20px">
              <h2>❌ dist/index.html مش موجود</h2>
              <p>${distPath}</p>
              <p>لازم تعمل build:</p>
              <pre>npm run build</pre>
            </div>
          `),
      );
      return;
    }

    await mainWin.loadFile(distPath);
  }
}

// ✅ نافذة معاينة + أزرار فوق (ما تطلع بالطباعة)
function openPreviewWindow({ previewUrl, pdfUrl, defaultName }) {
  const previewWin = new BrowserWindow({
    width: 1100,
    height: 900,
    title: "معاينة البوليصة",
    backgroundColor: "#ffffff",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  previewWin.loadURL(previewUrl);

  previewWin.webContents.on("did-finish-load", async () => {
    const safePdfUrl = String(pdfUrl || "")
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`");
    const safeName = String(defaultName || "waybill.pdf")
      .replace(/\\/g, "\\\\")
      .replace(/`/g, "\\`");

    const inject = `
      (function () {
        if (document.getElementById('__awb_toolbar__')) return;

        // ✅ CSS للطباعة: اخفاء الشريط + اخفاء أي إضافات
        const style = document.createElement('style');
        style.textContent = \`
          @media print {
            #__awb_toolbar__ { display: none !important; }
            body { margin: 0 !important; padding: 0 !important; }
          }
        \`;
        document.head.appendChild(style);

        const bar = document.createElement('div');
        bar.id = '__awb_toolbar__';
        bar.style.cssText = [
          'position:fixed',
          'top:10px',
          'left:10px',
          'right:10px',
          'z-index:999999',
          'display:flex',
          'gap:10px',
          'justify-content:flex-end',
          'align-items:center',
          'padding:10px',
          'background:rgba(255,255,255,0.98)',
          'border:1px solid #ddd',
          'border-radius:12px',
          'box-shadow:0 6px 18px rgba(0,0,0,0.14)'
        ].join(';');

        const btn = (text) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.textContent = text;
          b.style.cssText = [
            'padding:8px 12px',
            'border-radius:10px',
            'border:1px solid #ccc',
            'background:#f7f7f7',
            'cursor:pointer',
            'font-family:Tahoma,Arial',
            'font-size:13px'
          ].join(';');
          b.onmouseover = () => b.style.background = '#eee';
          b.onmouseout  = () => b.style.background = '#f7f7f7';
          return b;
        };

        const printBtn = btn('🖨 طباعة');
        printBtn.onclick = () => {
          // ✅ اخفاء الشريط قبل الطباعة لتفادي صفحتين
          bar.style.display = 'none';
          setTimeout(() => {
            window.print();
            setTimeout(() => { bar.style.display = 'flex'; }, 250);
          }, 50);
        };

        const exportBtn = btn('⬇️ تصدير PDF');
        exportBtn.onclick = async () => {
          try {
            if (!window.electronAPI?.savePdf) {
              alert('Electron API غير متوفر');
              return;
            }
            if (!\`${safePdfUrl}\`) {
              alert('رابط PDF غير موجود');
              return;
            }
            const res = await window.electronAPI.savePdf({
              url: \`${safePdfUrl}\`,
              defaultName: \`${safeName}\`
            });

            if (res?.ok) alert('✅ تم الحفظ: ' + res.filePath);
            else if (res?.canceled) {}
            else alert('❌ فشل الحفظ: ' + (res?.error || 'Unknown'));
          } catch (e) {
            alert('❌ خطأ: ' + e);
          }
        };

        const closeBtn = btn('✖ إغلاق');
        closeBtn.onclick = () => window.close();

        bar.appendChild(exportBtn);
        bar.appendChild(printBtn);
        bar.appendChild(closeBtn);

        document.body.appendChild(bar);
        // ✅ أهم نقطة: لا نضيف paddingTop حتى ما نخرب مقاس A4
      })();
    `;

    try {
      await previewWin.webContents.executeJavaScript(inject);
    } catch (e) {
      console.error("inject toolbar failed:", e);
    }
  });
}

// ✅ IPC: فتح نافذة معاينة جديدة
ipcMain.handle("open-waybill-preview", async (event, payload) => {
  try {
    const { previewUrl, pdfUrl, defaultName } = payload || {};
    if (!previewUrl) return { ok: false, error: "Missing previewUrl" };

    openPreviewWindow({ previewUrl, pdfUrl, defaultName });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

// ✅ IPC: حفظ PDF
ipcMain.handle("save-pdf", async (event, { url, defaultName }) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: "حفظ ملف PDF",
    defaultPath: defaultName || "document.pdf",
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });

  if (canceled || !filePath) return { ok: false, canceled: true };

  try {
    const pdfBuffer = await downloadToBuffer(url);
    fs.writeFileSync(filePath, pdfBuffer);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
});

function startBackend() {
  if (serverProcess) return;

  // In dev mode, backend is managed by npm scripts via concurrently
  if (process.env.VITE_DEV_SERVER_URL) {
    console.log(
      "ℹ️ Dev mode detected: backend managed by npm scripts, skipping spawn.",
    );
    return;
  }

  const serverDir = path.join(__dirname, "server");
  const serverScript = path.join(serverDir, "server.js");

  if (!fs.existsSync(serverScript)) {
    console.error("❌ Backend script not found:", serverScript);
    return;
  }

  console.log("🚀 Starting backend server:", serverScript);

  serverProcess = spawn("node", ["server.js"], {
    cwd: serverDir,
    env: { ...process.env, PORT: "4000" },
    stdio: "pipe",
  });

  console.log("🚀 Backend process started, PID:", serverProcess.pid);

  serverProcess.stdout.on("data", (data) =>
    console.log("[BACKEND STDOUT]", data.toString().trim()),
  );
  serverProcess.stderr.on("data", (data) =>
    console.error("[BACKEND STDERR]", data.toString().trim()),
  );

  serverProcess.on("close", (code) => {
    console.log("⚠️ Backend process exited with code", code);
    serverProcess = null;
  });

  serverProcess.on("error", (err) => {
    console.error("❌ Backend process error:", err);
    serverProcess = null;
  });
}

function stopBackend() {
  if (serverProcess) {
    console.log("🛑 Stopping backend process, PID:", serverProcess.pid);
    try {
      serverProcess.kill("SIGTERM");
    } catch (e) {
      console.error("Error killing backend:", e);
    }
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  startBackend();

  // Wait briefly for backend to start before opening window
  await new Promise((resolve) => setTimeout(resolve, 1500));

  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  stopBackend();
  if (process.platform !== "darwin") app.quit();
});
