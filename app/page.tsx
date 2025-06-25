"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ConnectionScreen } from "@/components/connection-screen"
import { ConnectAnimation } from "@/components/connect-animation"
import { DisconnectAnimation } from "@/components/disconnect-animation"
import { Dashboard } from "@/components/dashboard"

interface SerialData {
  timestamp: string
  raw: string
  temp?: number
  humid?: number
  ch4?: number
  co2?: number
  tvoc?: number
  co?: number
  nox?: number
  pm_1_0?: number
  pm_2_5?: number
  pm_10_0?: number
  lat?: number
  lon?: number
}

interface SerialPort {
  path: string
  manufacturer?: string
  serialNumber?: string
  vendorId?: string
  productId?: string
}

declare global {
  interface Window {
    electronAPI: {
      getSerialPorts: () => Promise<SerialPort[]>
      connectSerial: (port: string, baudRate: string) => Promise<{ success: boolean; error?: string }>
      disconnectSerial: () => Promise<{ success: boolean; error?: string }>
      startLogging: () => Promise<{ success: boolean }>
      stopLogging: () => Promise<{ success: boolean; dataCount: number }>
      exportCSV: () => Promise<{ success: boolean; error?: string; filePath?: string }>
      onSerialData: (callback: (event: any, data: SerialData) => void) => void
      onSerialStatus: (callback: (event: any, status: { connected: boolean; port?: string }) => void) => void
      onSerialError: (callback: (event: any, error: string) => void) => void
      removeAllListeners: (channel: string) => void
    }
  }
}

const sensorLabels = {
  temp: "Temperature (°C)",
  humid: "Humidity (%)",
  ch4: "CH4 (ppm)",
  co2: "CO2 (ppm)",
  tvoc: "TVOC (ppb)",
  co: "CO (ppm)",
  nox: "NOx (ppm)",
  pm_1_0: "PM1.0 (μg/m³)",
  pm_2_5: "PM2.5 (μg/m³)",
  pm_10_0: "PM10.0 (μg/m³)",
}

export default function SerialDashboard() {
  const [ports, setPorts] = useState<SerialPort[]>([])
  const [selectedPort, setSelectedPort] = useState<string>("")
  const [baudRate, setBaudRate] = useState<string>("9600")
  const [isConnected, setIsConnected] = useState(false)
  const [isLogging, setIsLogging] = useState(false)
  const [currentData, setCurrentData] = useState<SerialData | null>(null)
  const [recentData, setRecentData] = useState<SerialData[]>([])

  // Separate state for preview chart (50 points) and full history chart
  const [previewChartData, setPreviewChartData] = useState<any[]>([])
  const [fullHistoryData, setFullHistoryData] = useState<Record<string, any[]>>({})

  const [selectedChart, setSelectedChart] = useState<keyof typeof sensorLabels>("temp")
  const [loggedCount, setLoggedCount] = useState(0)
  const [error, setError] = useState<string>("")
  const [isElectron, setIsElectron] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)
  const [showDashboard, setShowDashboard] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [showDisconnectAnimation, setShowDisconnectAnimation] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Refs to maintain rolling window for preview (exactly 50 points)
  const previewDataBuffers = useRef<Record<string, any[]>>({})

  useEffect(() => {
    try {
      console.log("Checking for Electron environment...")
      console.log("window.electronAPI:", window.electronAPI)
      console.log("typeof window.electronAPI:", typeof window.electronAPI)

      const checkElectron = () => {
        try {
          const hasElectron = typeof window !== "undefined" && window.electronAPI !== undefined
          console.log("Electron detected:", hasElectron)
          setIsElectron(hasElectron)
          return hasElectron
        } catch (error) {
          console.error("Error checking Electron:", error)
          setIsElectron(false)
          return false
        }
      }

      // Check immediately
      if (!checkElectron()) {
        // If not detected, retry a few times with delays
        let retries = 0
        const maxRetries = 5
        const checkInterval = setInterval(() => {
          try {
            retries++
            console.log(`Retry ${retries}/${maxRetries} for Electron detection`)
            if (checkElectron() || retries >= maxRetries) {
              clearInterval(checkInterval)
            }
          } catch (error) {
            console.error("Error in retry:", error)
            clearInterval(checkInterval)
          }
        }, 500)
      }

      // Check for saved theme preference
      const savedTheme = localStorage.getItem("theme")
      if (savedTheme === "dark") {
        setIsDarkMode(true)
        document.documentElement.classList.add("dark")
      }
    } catch (error) {
      console.error("Error in useEffect:", error)
      setIsElectron(false)
    }
  }, [])

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode)
    if (!isDarkMode) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  const loadPorts = useCallback(async () => {
    if (!isElectron) return

    try {
      const availablePorts = await window.electronAPI.getSerialPorts()
      setPorts(availablePorts)
    } catch (err) {
      setError("Failed to load serial ports")
    }
  }, [isElectron])

  useEffect(() => {
    if (!isElectron) return

    loadPorts()

    const handleSerialData = (event: any, data: SerialData) => {
      setCurrentData(data)
      setRecentData((prev) => [data, ...prev.slice(0, 99)])

      // Process each sensor's data
      Object.keys(sensorLabels).forEach((sensor) => {
        const sensorKey = sensor as keyof typeof sensorLabels
        const sensorValue = data[sensorKey]

        if (sensorValue !== undefined && sensorValue !== null) {
          const dataPoint = {
            timestamp: new Date(data.timestamp).toLocaleTimeString(),
            value: sensorValue === -1 ? previewDataBuffers.current[sensor]?.slice(-1)[0]?.value || 0 : sensorValue,
            fullTimestamp: data.timestamp,
          }

          // Update preview buffer (rolling window of exactly 50 points)
          if (!previewDataBuffers.current[sensor]) {
            previewDataBuffers.current[sensor] = []
          }

          previewDataBuffers.current[sensor] = [
            ...previewDataBuffers.current[sensor].slice(-49), // Keep last 49 points
            dataPoint, // Add new point (total = 50)
          ]

          // Update full history (unlimited)
          setFullHistoryData((prev) => ({
            ...prev,
            [sensor]: [...(prev[sensor] || []), dataPoint],
          }))
        }
      })

      // Update preview chart data for currently selected sensor
      if (previewDataBuffers.current[selectedChart]) {
        setPreviewChartData([...previewDataBuffers.current[selectedChart]])
      }

      if (isLogging) {
        setLoggedCount((prev) => prev + 1)
      }
    }

    const handleSerialStatus = (event: any, status: { connected: boolean; port?: string }) => {
      setIsConnected(status.connected)
      if (status.connected && !showDashboard) {
        // Trigger slide animation when first connected
        setShowAnimation(true)
        setTimeout(() => {
          setShowAnimation(false)
          setShowDashboard(true)
        }, 800)
      }
      if (!status.connected) {
        setIsLogging(false)
        setLoggedCount(0)
        setShowDashboard(false)
        setPreviewChartData([])
        setFullHistoryData({})
        // Clear preview buffers
        previewDataBuffers.current = {}
      }
    }

    const handleSerialError = (event: any, errorMsg: string) => {
      setError(errorMsg)
    }

    window.electronAPI.onSerialData(handleSerialData)
    window.electronAPI.onSerialStatus(handleSerialStatus)
    window.electronAPI.onSerialError(handleSerialError)

    return () => {
      window.electronAPI.removeAllListeners("serial-data")
      window.electronAPI.removeAllListeners("serial-status")
      window.electronAPI.removeAllListeners("serial-error")
    }
  }, [isElectron, isLogging, selectedChart, showDashboard])

  // Update preview chart when selected chart changes
  useEffect(() => {
    if (previewDataBuffers.current[selectedChart]) {
      setPreviewChartData([...previewDataBuffers.current[selectedChart]])
    } else {
      setPreviewChartData([])
    }
  }, [selectedChart])

  const handleConnect = async () => {
    if (!selectedPort) return

    try {
      const result = await window.electronAPI.connectSerial(selectedPort, baudRate)
      if (!result.success) {
        setError(result.error || "Failed to connect")
      } else {
        setError("")
      }
    } catch (err) {
      setError("Connection failed")
    }
  }

  const handleDisconnect = async () => {
    try {
      // Start disconnect animation immediately
      setShowDisconnectAnimation(true)

      // Disconnect and clean up
      await window.electronAPI.disconnectSerial()
      setCurrentData(null)
      setRecentData([])
      setPreviewChartData([])
      setFullHistoryData({})

      // After animation completes, reset states
      setTimeout(() => {
        setShowDisconnectAnimation(false)
        setShowDashboard(false)
        setShowAnimation(false)
      }, 800)
    } catch (err) {
      setError("Disconnection failed")
    }
  }

  const handleStartLogging = async () => {
    try {
      const result = await window.electronAPI.startLogging()
      if (result.success) {
        setIsLogging(true)
        setLoggedCount(0)
      }
    } catch (err) {
      setError("Failed to start logging")
    }
  }

  const handleStopLogging = async () => {
    try {
      const result = await window.electronAPI.stopLogging()
      if (result.success) {
        setIsLogging(false)
      }
    } catch (err) {
      setError("Failed to stop logging")
    }
  }

  const handleExportCSV = async () => {
    try {
      const result = await window.electronAPI.exportCSV()
      if (result.success) {
        setError("")
      } else {
        setError(result.error || "Export failed")
      }
    } catch (err) {
      setError("Export failed")
    }
  }

  if (!isElectron) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Electron Required</CardTitle>
            <CardDescription>This application needs to run in Electron to access serial ports.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please run: <code className="bg-muted px-1 rounded">npm run electron-dev</code>
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Show disconnect animation
  if (showDisconnectAnimation) {
    return (
      <DisconnectAnimation
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        ports={ports}
        selectedPort={selectedPort}
        baudRate={baudRate}
        error={error}
        isLogging={isLogging}
        loggedCount={loggedCount}
      />
    )
  }

  // Show connect animation
  if (showAnimation) {
    return <ConnectAnimation selectedPort={selectedPort} baudRate={baudRate} />
  }

  // Show dashboard
  if (showDashboard) {
    return (
      <Dashboard
        isConnected={isConnected}
        isLogging={isLogging}
        loggedCount={loggedCount}
        error={error}
        currentData={currentData}
        chartData={previewChartData} // 50-point preview data
        allChartData={fullHistoryData} // Full history data
        selectedChart={selectedChart}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
        onDisconnect={handleDisconnect}
        onStartLogging={handleStartLogging}
        onStopLogging={handleStopLogging}
        onExportCSV={handleExportCSV}
        onChartChange={(value) => setSelectedChart(value as keyof typeof sensorLabels)}
      />
    )
  }

  // Show connection screen
  return (
    <ConnectionScreen
      isConnected={isConnected}
      error={error}
      isDarkMode={isDarkMode}
      onToggleDarkMode={toggleDarkMode}
      ports={ports}
      selectedPort={selectedPort}
      baudRate={baudRate}
      onPortChange={setSelectedPort}
      onBaudRateChange={setBaudRate}
      onConnect={handleConnect}
      onDisconnect={handleDisconnect}
      onRefreshPorts={loadPorts}
    />
  )
}
