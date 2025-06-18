const { app, BrowserWindow, ipcMain, dialog } = require("electron")
const { SerialPort } = require("serialport")
const { ReadlineParser } = require("@serialport/parser-readline")
const path = require("path")
const fs = require("fs")

let mainWindow
let serialPort = null
let parser = null
let isLogging = false
let loggedData = []

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
    if (serialPort && serialPort.isOpen) {
      serialPort.close()
    }
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

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

// IPC handlers
ipcMain.handle("get-serial-ports", async () => {
  try {
    const ports = await SerialPort.list()
    return ports.filter((port) => port.path)
  } catch (error) {
    console.error("Error listing ports:", error)
    return []
  }
})

ipcMain.handle("connect-serial", async (event, portPath, baudRate = 9600) => {
  try {
    if (serialPort && serialPort.isOpen) {
      serialPort.close()
    }

    serialPort = new SerialPort({
      path: portPath,
      baudRate: Number.parseInt(baudRate),
    })

    parser = serialPort.pipe(new ReadlineParser({ delimiter: "\n" }))

    serialPort.on("open", () => {
      mainWindow.webContents.send("serial-status", { connected: true, port: portPath })
    })

    serialPort.on("error", (err) => {
      mainWindow.webContents.send("serial-error", err.message)
    })

    serialPort.on("close", () => {
      mainWindow.webContents.send("serial-status", { connected: false })
    })

    parser.on("data", (data) => {
      const timestamp = new Date().toISOString()
      const parsedData = parseSerialData(data.trim())

      console.log("Raw data:", data.trim())
      console.log("Parsed data:", parsedData)

      const dataPoint = {
        timestamp,
        raw: data.trim(),
        ...parsedData,
      }

      if (isLogging) {
        loggedData.push(dataPoint)
      }

      mainWindow.webContents.send("serial-data", dataPoint)
    })

    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("disconnect-serial", async () => {
  try {
    if (serialPort && serialPort.isOpen) {
      serialPort.close()
    }
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("start-logging", async () => {
  isLogging = true
  loggedData = []
  return { success: true }
})

ipcMain.handle("stop-logging", async () => {
  isLogging = false
  return { success: true, dataCount: loggedData.length }
})

ipcMain.handle("export-csv", async () => {
  try {
    if (loggedData.length === 0) {
      return { success: false, error: "No data to export" }
    }

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `serial-data-${new Date().toISOString().split("T")[0]}.csv`,
      filters: [{ name: "CSV Files", extensions: ["csv"] }],
    })

    if (!result.canceled) {
      const csvContent = convertToCSV(loggedData)
      fs.writeFileSync(result.filePath, csvContent)
      return { success: true, filePath: result.filePath }
    }

    return { success: false, error: "Export cancelled" }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

function parseSerialData(data) {
  try {
    console.log("Parsing data:", data)

    // Initialize result object
    const result = {}

    // Remove the [ESP-NOW] RX prefix if present
    const cleanData = data.replace(/^\[ESP-NOW\]\s*RX\s*/, "").trim()
    console.log("Clean data:", cleanData)

    // Split by spaces and process each part
    const parts = cleanData.split(/\s+/)

    for (const part of parts) {
      if (part.includes(":")) {
        const [key, value] = part.split(":")

        if (key && value !== undefined) {
          const cleanKey = key.trim().toLowerCase()
          const cleanValue = value.trim()

          console.log(`Processing: ${cleanKey} = ${cleanValue}`)

          // Handle special values
          if (cleanValue === "nan" || cleanValue === "inf" || cleanValue === "-inf") {
            result[cleanKey] = null
          } else {
            const numValue = Number.parseFloat(cleanValue)
            result[cleanKey] = isNaN(numValue) ? cleanValue : numValue
          }
        }
      }
    }

    console.log("Parsed result:", result)

    // Map to expected field names
    const mappedData = {}

    if (result.t !== undefined) mappedData.temp = result.t
    if (result.h !== undefined) mappedData.humid = result.h
    if (result.ch4 !== undefined) mappedData.ch4 = result.ch4
    if (result.co2 !== undefined) mappedData.co2 = result.co2
    if (result.tvoc !== undefined) mappedData.tvoc = result.tvoc
    if (result.co !== undefined) mappedData.co = result.co
    if (result.nox !== undefined) mappedData.nox = result.nox
    if (result["pm1.0"] !== undefined) mappedData.pm_1_0 = result["pm1.0"]
    if (result["pm2.5"] !== undefined) mappedData.pm_2_5 = result["pm2.5"]
    if (result["pm10.0"] !== undefined) mappedData.pm_10_0 = result["pm10.0"]
    if (result.lat !== undefined) mappedData.lat = result.lat
    if (result.lon !== undefined) mappedData.lon = result.lon

    console.log("Final mapped data:", mappedData)
    return mappedData
  } catch (error) {
    console.error("Error parsing serial data:", error)
    return {}
  }
}

function convertToCSV(data) {
  if (data.length === 0) return ""

  // Define the column order we want
  const columnOrder = [
    "timestamp",
    "temp",
    "humid",
    "ch4",
    "co2",
    "tvoc",
    "co",
    "nox",
    "pm_1_0",
    "pm_2_5",
    "pm_10_0",
    "lat",
    "lon",
    "raw",
  ]

  // Create header row
  const csvRows = [columnOrder.join(",")]

  // Add data rows
  data.forEach((row) => {
    const values = columnOrder.map((header) => {
      const value = row[header]
      if (value === null || value === undefined) {
        return ""
      }
      // Escape commas in string values
      return typeof value === "string" && value.includes(",") ? `"${value}"` : value
    })
    csvRows.push(values.join(","))
  })

  return csvRows.join("\n")
}
