"use client"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceArea } from "recharts"
import { Download, X } from "lucide-react"
import { useEffect, useMemo, useState, useRef, useCallback } from "react"

interface ChartData {
  timestamp: string
  value: number
  fullTimestamp: string
}

interface ChartModalProps {
  isOpen: boolean
  onClose: () => void
  allChartData: Record<string, ChartData[]>
  selectedChart: string
  onChartChange: (value: string) => void
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

// Define colors for each sensor (same as real-time chart)
const sensorColors = {
  temp: "#0080FF", // Electric blue
  humid: "#FF6B35", // Orange
  ch4: "#FF1744", // Red
  co2: "#4CAF50", // Green
  tvoc: "#FFEB3B", // Yellow
  co: "#795548", // Brown
  nox: "#9C27B0", // Purple
  pm_1_0: "#607D8B", // Blue grey
  pm_2_5: "#E91E63", // Pink
  pm_10_0: "#00BCD4", // Cyan
}

const graphableFields = Object.keys(sensorLabels) as (keyof typeof sensorLabels)[]

export function ChartModal({ isOpen, onClose, allChartData, selectedChart, onChartChange }: ChartModalProps) {
  // Use local state to maintain stable chart data
  const [modalChartData, setModalChartData] = useState<ChartData[]>([])
  const lastDataLengthRef = useRef<number>(0)
  const currentSensorRef = useRef<string>(selectedChart)

  // Selection state for drag-to-select functionality
  const [selectionStart, setSelectionStart] = useState<string | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStats, setSelectionStats] = useState<{
    startValue: number
    endValue: number
    change: number
    changePercent: number
    startTime: string
    endTime: string
  } | null>(null)

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener("keydown", handleEscape)
      return () => document.removeEventListener("keydown", handleEscape)
    }
  }, [isOpen, onClose])

  // Update chart data only when new points are added or sensor changes
  useEffect(() => {
    const rawData = allChartData[selectedChart] || []

    // If sensor changed, replace all data
    if (currentSensorRef.current !== selectedChart) {
      currentSensorRef.current = selectedChart
      lastDataLengthRef.current = 0

      // Process all data for new sensor
      const processedData = rawData.reduce((acc: ChartData[], point: ChartData) => {
        if (point.value === -1) {
          const lastValidValue = acc.length > 0 ? acc[acc.length - 1].value : 0
          acc.push({ ...point, value: lastValidValue })
        } else {
          acc.push(point)
        }
        return acc
      }, [])

      setModalChartData(processedData)
      lastDataLengthRef.current = rawData.length
      return
    }

    // If new data points added, only process the new ones
    if (rawData.length > lastDataLengthRef.current) {
      const newPoints = rawData.slice(lastDataLengthRef.current)

      setModalChartData((prevData) => {
        const updatedData = [...prevData]

        newPoints.forEach((point) => {
          if (point.value === -1) {
            const lastValidValue = updatedData.length > 0 ? updatedData[updatedData.length - 1].value : 0
            updatedData.push({ ...point, value: lastValidValue })
          } else {
            updatedData.push(point)
          }
        })

        return updatedData
      })

      lastDataLengthRef.current = rawData.length
    }
  }, [allChartData, selectedChart])

  // Reset data when modal opens
  useEffect(() => {
    if (isOpen) {
      const rawData = allChartData[selectedChart] || []
      const processedData = rawData.reduce((acc: ChartData[], point: ChartData) => {
        if (point.value === -1) {
          const lastValidValue = acc.length > 0 ? acc[acc.length - 1].value : 0
          acc.push({ ...point, value: lastValidValue })
        } else {
          acc.push(point)
        }
        return acc
      }, [])

      setModalChartData(processedData)
      lastDataLengthRef.current = rawData.length
      currentSensorRef.current = selectedChart
    }
  }, [isOpen, selectedChart, allChartData])

  // Handle mouse events for selection
  const handleMouseDown = useCallback((e: any) => {
    if (e && e.activeLabel) {
      setSelectionStart(e.activeLabel)
      setSelectionEnd(e.activeLabel)
      setIsSelecting(true)
      setSelectionStats(null)
    }
  }, [])

  const handleMouseMove = useCallback(
    (e: any) => {
      if (isSelecting && e && e.activeLabel) {
        setSelectionEnd(e.activeLabel)
      }
    },
    [isSelecting],
  )

  const handleMouseUp = useCallback(() => {
    if (isSelecting && selectionStart && selectionEnd) {
      // Calculate selection statistics
      const startIndex = modalChartData.findIndex((d) => d.timestamp === selectionStart)
      const endIndex = modalChartData.findIndex((d) => d.timestamp === selectionEnd)

      if (startIndex !== -1 && endIndex !== -1) {
        const actualStart = Math.min(startIndex, endIndex)
        const actualEnd = Math.max(startIndex, endIndex)

        const startPoint = modalChartData[actualStart]
        const endPoint = modalChartData[actualEnd]

        const change = endPoint.value - startPoint.value
        const changePercent = startPoint.value !== 0 ? (change / startPoint.value) * 100 : 0

        setSelectionStats({
          startValue: startPoint.value,
          endValue: endPoint.value,
          change: change,
          changePercent: changePercent,
          startTime: new Date(startPoint.fullTimestamp).toLocaleString(),
          endTime: new Date(endPoint.fullTimestamp).toLocaleString(),
        })
      }
    }
    setIsSelecting(false)
  }, [isSelecting, selectionStart, selectionEnd, modalChartData])

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectionStart(null)
    setSelectionEnd(null)
    setSelectionStats(null)
    setIsSelecting(false)
  }, [])

  // Memoize chart config with sensor-specific colors
  const chartConfig = useMemo(
    () => ({
      value: {
        label: sensorLabels[selectedChart as keyof typeof sensorLabels],
        color: sensorColors[selectedChart as keyof typeof sensorColors],
      },
    }),
    [selectedChart],
  )

  // Get the color for the current sensor
  const currentSensorColor = sensorColors[selectedChart as keyof typeof sensorColors]

  const exportChartData = () => {
    if (modalChartData.length === 0) return

    const csvContent = [
      "timestamp,value",
      ...modalChartData.map((point) => `${point.fullTimestamp},${point.value}`),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${selectedChart}-chart-data.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-lg max-w-6xl w-full max-h-[90vh] overflow-hidden m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: currentSensorColor }} />
              {sensorLabels[selectedChart as keyof typeof sensorLabels]} - Full History
            </h2>
            <div className="flex items-center gap-2">
              <Select value={selectedChart} onValueChange={onChartChange}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {graphableFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: sensorColors[field] }} />
                        {sensorLabels[field]}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectionStats && (
                <Button
                  onClick={clearSelection}
                  variant="outline"
                  size="sm"
                  className="hover:scale-105 transition-transform duration-200"
                >
                  Clear Selection
                </Button>
              )}
              <Button
                onClick={exportChartData}
                variant="outline"
                size="sm"
                disabled={modalChartData.length === 0}
                className="hover:scale-105 transition-transform duration-200 disabled:hover:scale-100"
              >
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button
                onClick={onClose}
                variant="default"
                size="sm"
                className="bg-black hover:bg-gray-800 text-white hover:scale-105 transition-all duration-200"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Selection Statistics Display */}
          {selectionStats && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="font-medium text-muted-foreground">Start Value</div>
                  <div className="text-lg font-semibold">{selectionStats.startValue.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{selectionStats.startTime}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">End Value</div>
                  <div className="text-lg font-semibold">{selectionStats.endValue.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{selectionStats.endTime}</div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">Change</div>
                  <div
                    className={`text-lg font-semibold ${selectionStats.change >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {selectionStats.change >= 0 ? "+" : ""}
                    {selectionStats.change.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="font-medium text-muted-foreground">Change %</div>
                  <div
                    className={`text-lg font-semibold ${selectionStats.changePercent >= 0 ? "text-green-600" : "text-red-600"}`}
                  >
                    {selectionStats.changePercent >= 0 ? "+" : ""}
                    {selectionStats.changePercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          <div>
            {modalChartData.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground flex items-center justify-between">
                  <span>
                    Showing {modalChartData.length} data points from{" "}
                    {new Date(modalChartData[0]?.fullTimestamp).toLocaleString()} to{" "}
                    {new Date(modalChartData[modalChartData.length - 1]?.fullTimestamp).toLocaleString()}
                  </span>
                  <span className="text-xs">💡 Click and drag on the chart to measure changes</span>
                </div>
                <ChartContainer config={chartConfig} className="h-[500px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={modalChartData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="timestamp"
                        tick={{ fontSize: 10 }}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 12 }} domain={["dataMin - 5", "dataMax + 5"]} />
                      <ChartTooltip
                        content={<ChartTooltipContent />}
                        labelFormatter={(value, payload) => {
                          if (payload && payload[0]) {
                            return new Date(payload[0].payload.fullTimestamp).toLocaleString()
                          }
                          return value
                        }}
                      />

                      {/* Selection Area */}
                      {selectionStart && selectionEnd && (
                        <ReferenceArea
                          x1={selectionStart}
                          x2={selectionEnd}
                          fill={currentSensorColor}
                          fillOpacity={0.2}
                          stroke={currentSensorColor}
                          strokeOpacity={0.6}
                          strokeWidth={2}
                          strokeDasharray="5 5"
                        />
                      )}

                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke={currentSensorColor}
                        strokeWidth={2}
                        dot={false}
                        name={sensorLabels[selectedChart as keyof typeof sensorLabels]}
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </div>
            ) : (
              <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                No data available for {sensorLabels[selectedChart as keyof typeof sensorLabels]}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
