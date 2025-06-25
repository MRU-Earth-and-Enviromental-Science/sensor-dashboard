const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const path = require("path")
const fs = require("fs")
const { spawn } = require('child_process')
const axios = require('axios')

let mainWindow
let pythonProcess = null
let pollInterval = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    titleBarStyle: "default",
    show: false,
  })

  const isDev = process.env.ELECTRON_IS_DEV === "1"

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile("out/index.html")
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })
}

function startPythonBackend() {
  const isDev = process.env.ELECTRON_IS_DEV === "1";
  const isWin = process.platform === 'win32';

  let pythonCmd, pythonArgs;

  if (isDev) {
    // Use Python script in development
    pythonCmd = 'python3';
    pythonArgs = [path.join(__dirname, '..', 'serial_backend.py')];
  } else {
    // Use binary in production
    pythonCmd = isWin
      ? path.join(__dirname, '..', 'dist', 'serial_backend.exe')
      : path.join(__dirname, '..', 'dist', 'serial_backend');
    pythonArgs = [];
  }

  try {
    pythonProcess = spawn(pythonCmd, pythonArgs, {
      stdio: 'ignore',
      detached: true
    });

    // Wait a bit for the backend to start
    setTimeout(() => {
      // Optional: check if backend is responding
    }, 2000);
  } catch (error) {
    console.error('Failed to start Python backend:', error);
  }
}

app.whenReady().then(() => {
  startPythonBackend()
  createWindow()
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// Replace IPC handlers with HTTP calls to Python backend
ipcMain.handle('get-serial-ports', async () => {
  try {
    const res = await axios.get('http://127.0.0.1:5001/serial/ports')
    return res.data
  } catch (error) {
    return []
  }
})

function startPollingSerialData() {
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(async () => {
    try {
      const res = await axios.get('http://127.0.0.1:5001/serial/latest');
      if (res.data && res.data.timestamp) {
        mainWindow.webContents.send('serial-data', res.data);
      }
    } catch (e) {
      // Optionally handle errors
    }
  }, 1000); // every second
}

ipcMain.handle('connect-serial', async (event, portPath, baudRate = 9600) => {
  try {
    const res = await axios.post('http://127.0.0.1:5001/serial/connect', {
      port: portPath,
      baudrate: baudRate,
    });
    if (res.data && res.data.success) {
      mainWindow.webContents.send('serial-status', { connected: true, port: portPath });
      startPollingSerialData();
    }
    return res.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('disconnect-serial', async () => {
  try {
    const res = await axios.post('http://127.0.0.1:5001/serial/disconnect');
    if (res.data && res.data.success) {
      if (pollInterval) clearInterval(pollInterval);
      mainWindow.webContents.send('serial-status', { connected: false });
    }
    return res.data;
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-logging', async () => {
  try {
    const res = await axios.post('http://127.0.0.1:5001/serial/log/start')
    return res.data
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('stop-logging', async () => {
  try {
    const res = await axios.post('http://127.0.0.1:5001/serial/log/stop')
    return res.data
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('export-csv', async () => {
  try {
    // Ask user where to save
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `serial-data-${new Date().toISOString().split('T')[0]}.csv`,
      filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    })
    if (result.canceled) {
      return { success: false, error: 'Export cancelled' }
    }
    // Download CSV from backend
    const response = await axios.get('http://127.0.0.1:5001/serial/log/export', {
      responseType: 'arraybuffer',
    })
    fs.writeFileSync(result.filePath, response.data)
    return { success: true, filePath: result.filePath }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
