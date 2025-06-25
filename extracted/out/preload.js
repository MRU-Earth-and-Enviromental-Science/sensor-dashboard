const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
  getSerialPorts: () => ipcRenderer.invoke("get-serial-ports"),
  connectSerial: (port, baudRate) => ipcRenderer.invoke("connect-serial", port, baudRate),
  disconnectSerial: () => ipcRenderer.invoke("disconnect-serial"),
  startLogging: () => ipcRenderer.invoke("start-logging"),
  stopLogging: () => ipcRenderer.invoke("stop-logging"),
  exportCSV: () => ipcRenderer.invoke("export-csv"),

  onSerialData: (callback) => ipcRenderer.on("serial-data", callback),
  onSerialStatus: (callback) => ipcRenderer.on("serial-status", callback),
  onSerialError: (callback) => ipcRenderer.on("serial-error", callback),

  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
})
