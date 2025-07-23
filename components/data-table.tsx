"use client"

import { useState, useEffect, useRef } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SerialData {
  timestamp: string
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
  alt?: number // Added altitude
}

interface DataTableProps {
  currentData: SerialData | null
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
  lat: "Latitude (°)", // Added unit for clarity
  lon: "Longitude (°)", // Added unit for clarity
  alt: "Altitude (m)", // Added altitude
}

export function DataTable({ currentData }: DataTableProps) {
  const [displayData, setDisplayData] = useState<SerialData | null>(null)
  const [lastKnownValues, setLastKnownValues] = useState<Partial<SerialData>>({})
  const lastTimestampRef = useRef<string | null>(null)

  // Only update display data when we receive new data (different timestamp)
  useEffect(() => {
    if (currentData && currentData.timestamp !== lastTimestampRef.current) {
      // Merge new data with last known values to prevent gaps
      const mergedData = { ...currentData }

      // For each sensor, use new value if available, otherwise keep last known value
      Object.keys(sensorLabels).forEach(key => {
        const sensorKey = key as keyof SerialData
        if (currentData[sensorKey] === undefined || currentData[sensorKey] === null) {
          // Use last known value if current data doesn't have this sensor
          if (lastKnownValues[sensorKey] !== undefined && lastKnownValues[sensorKey] !== null) {
            (mergedData as any)[sensorKey] = lastKnownValues[sensorKey]
          }
        } else {
          // Update last known values with new data
          setLastKnownValues(prev => ({
            ...prev,
            [sensorKey]: currentData[sensorKey]
          }))
        }
      })

      setDisplayData(mergedData)
      lastTimestampRef.current = currentData.timestamp
      console.log("📊 Table updated with new data:", currentData.timestamp)
    }
  }, [currentData, lastKnownValues])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Sensor Data</CardTitle>
        <CardDescription>Current readings from all sensors</CardDescription>
      </CardHeader>
      <CardContent>
        {displayData ? (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Last updated: {new Date(displayData.timestamp).toLocaleTimeString()}
            </div>
            <ScrollArea className="h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sensor</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(sensorLabels).map(([key, label]) => {
                    const value = displayData[key as keyof SerialData]

                    // Debug PM values
                    if (key.startsWith('pm_')) {
                      console.log(`PM Debug - ${key}:`, value, typeof value)
                    }

                    // Extract unit from label, e.g., "(°C)" -> "°C"
                    const unitMatch = label.match(/\(([^)]+)\)/)
                    const unit = unitMatch ? unitMatch[1] : ""
                    const sensorName = label.replace(/\s*\([^)]*\)/, "") // Remove unit from name

                    // Always show GPS coordinates (lat, lon, alt) even if no data
                    const isGPSData = key === 'lat' || key === 'lon' || key === 'alt'

                    // Always show PM sensors (pm_1_0, pm_2_5, pm_10_0) even if no data
                    const isPMData = key.startsWith('pm_')

                    // Skip if value is undefined or null (except for GPS data and PM data)
                    // Note: We explicitly check for undefined/null, not falsy values like 0
                    if (!isGPSData && !isPMData && (value === undefined || value === null)) {
                      return null
                    }

                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{sensorName}</TableCell>
                        <TableCell className="font-mono">
                          {value !== undefined && value !== null
                            ? (typeof value === "number" ? value.toFixed(key === 'lat' || key === 'lon' ? 6 : key === 'alt' ? 1 : 2) : value)
                            : "—"
                          }
                        </TableCell>
                        <TableCell className="text-muted-foreground">{unit}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">Waiting for sensor data...</div>
        )}
      </CardContent>
    </Card>
  )
}
