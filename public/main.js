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
  const isMac = process.platform === 'darwin';

  let pythonCmd, pythonArgs;

  if (isDev) {
    // Use Python script in development
    pythonCmd = 'python3';
    pythonArgs = [path.join(__dirname, '..', 'serial_backend.py')];
  } else {
    // Use binary in production - look in extraResources
    let backendName;
    if (isWin) {
      backendName = 'serial_backend.exe';
    } else {
      backendName = 'serial_backend';
    }

    const resourcePath = path.join(process.resourcesPath, backendName);

    // Check if the backend file exists
    if (!fs.existsSync(resourcePath)) {
      console.error(`Backend not found at: ${resourcePath}`);
      // Fallback to Python script if available
      const fallbackScript = path.join(process.resourcesPath, 'serial_backend.py');
      if (fs.existsSync(fallbackScript)) {
        console.log('Using fallback Python script');
        // Try different Python commands
        const pythonCommands = ['python', 'python3', 'py'];
        let pythonFound = false;

        for (const cmd of pythonCommands) {
          try {
            // Test if Python is available
            require('child_process').execSync(`${cmd} --version`, { stdio: 'ignore' });
            pythonCmd = cmd;
            pythonArgs = [fallbackScript];
            pythonFound = true;
            break;
          } catch (e) {
            // Python command not found, try next
          }
        }

        if (!pythonFound) {
          console.error('Python not found. Please install Python 3.x for Windows backend support.');
          // Show user-friendly error
          setTimeout(() => {
            dialog.showErrorBox('Python Required',
              'The sensor backend requires Python 3.x to be installed.\n\n' +
              'Please install Python from python.org and restart the application.\n\n' +
              'Alternatively, download the release version from GitHub which includes a pre-built backend.'
            );
          }, 3000);
          return;
        }
      } else {
        console.error('No backend available');
        setTimeout(() => {
          dialog.showErrorBox('Backend Missing',
            'The sensor backend is not available.\n\n' +
            'Please download the latest release from GitHub for proper backend support.'
          );
        }, 3000);
        return;
      }
    } else {
      pythonCmd = resourcePath;
      pythonArgs = [];
    }
  }

  try {
    console.log(`Starting backend: ${pythonCmd} ${pythonArgs.join(' ')}`);
    pythonProcess = spawn(pythonCmd, pythonArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false
    });

    pythonProcess.stdout.on('data', (data) => {
      console.log(`Backend stdout: ${data}`);
    });

    pythonProcess.stderr.on('data', (data) => {
      console.error(`Backend stderr: ${data}`);
    });

    pythonProcess.on('close', (code) => {
      console.log(`Backend process exited with code ${code}`);
    });

    // Wait a bit for the backend to start
    setTimeout(() => {
      // Optional: check if backend is responding
      checkBackendHealth();
    }, 2000);
  } catch (error) {
    console.error('Failed to start Python backend:', error);
  }
}

function checkBackendHealth() {
  // Simple health check
  axios.get('http://localhost:5000/health')
    .then(response => {
      console.log('Backend is healthy');
    })
    .catch(error => {
      console.error('Backend health check failed:', error.message);
    });
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

ipcMain.handle('get-logged-count', async () => {
  try {
    const res = await axios.get('http://127.0.0.1:5001/serial/log/count')
    return res.data
  } catch (error) {
    return { count: 0, isLogging: false }
  }
})
