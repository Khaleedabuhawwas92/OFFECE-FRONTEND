const { contextBridge, ipcRenderer } = require("electron");

console.log("✅ preload loaded");

contextBridge.exposeInMainWorld("electronAPI", {
  savePdf: (payload) => ipcRenderer.invoke("save-pdf", payload),
  openWaybillPreview: (payload) =>
    ipcRenderer.invoke("open-waybill-preview", payload),
});
