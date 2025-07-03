const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const path = require("path")
const fs = require("fs")
const { spawn } = require('child_process')
const axios = require('axios')

let mainWindow
let pythonProcess = null
let pollInterval = null

function createWindow() {
  const isDev = process.env.ELECTRON_IS_DEV === "1"

  let preloadPath
  if (isDev) {
    preloadPath = path.join(__dirname, "preload.js")
  } else {
    preloadPath = path.join(process.resourcesPath, "app.asar.unpacked", "public", "preload.js")
  }

  console.log("Preload path:", preloadPath)
  console.log("__dirname:", __dirname)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath,
    },
    titleBarStyle: "default",
    show: false,
  })

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    console.log('Permission requested:', permission);
    if (permission === 'geolocation') {
      console.log('Granting geolocation permission');
      callback(true);
    } else {
      console.log('Denying permission:', permission);
      callback(false);
    }
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission) => {
    console.log('Permission check:', permission);
    if (permission === 'geolocation') {
      console.log('Geolocation permission check: GRANTED');
      return true;
    }
    console.log('Permission check denied:', permission);
    return false;
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000")
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, "out", "index.html"))
    mainWindow.webContents.openDevTools() // Add this line
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
    // Use binary in production - look in app.asar.unpacked
    const resourcePath = process.platform === 'darwin'
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'serial_backend')
      : path.join(process.resourcesPath, 'app.asar.unpacked', 'serial_backend.exe');
    pythonCmd = resourcePath;
    pythonArgs = [];
  }

  try {
    pythonProcess = spawn(pythonCmd, pythonArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true
    });
    pythonProcess.unref()

    pythonProcess.stdout.on("data", data => {
      console.log(`PYTHON OUT: ${data.toString()}`);
    });

    pythonProcess.stderr.on("data", data => {
      console.error(`PYTHON ERR: ${data.toString()}`);
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

// IPC handler for IP-based geolocation lookup
ipcMain.handle("get-ip-location", async () => {
  try {
    console.log("Getting IP-based location...")
    const response = await axios.get("http://ip-api.com/json/", {
      timeout: 10000,
    })
    console.log("IP location response:", response.data)
    return {
      success: true,
      latitude: response.data.lat,
      longitude: response.data.lon,
      city: response.data.city,
      region: response.data.regionName,
      country: response.data.country,
      accuracy: 10000, // IP location is not very accurate
      method: "IP-based",
    }
  } catch (error) {
    console.error("IP location error:", error)
    return { success: false, error: error.message }
  }
})
