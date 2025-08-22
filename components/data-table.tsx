"use client"

import { useState, useEffect, useRef } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface SerialData {
  timestamp: string
  resistance?: number
  temperature?: number
  humidity?: number
  co2?: number
}

interface DataTableProps {
  currentData: SerialData | null
}

const sensorLabels = {
  resistance: "Resistance (Ω)",
  temperature: "Temperature (°C)",
  humidity: "Humidity (%)",
  co2: "CO2 (ppm)",
}

export function DataTable({ currentData }: DataTableProps) {
  const [displayData, setDisplayData] = useState<SerialData | null>(null)
  const [lastKnownValues, setLastKnownValues] = useState<Partial<SerialData>>({})
  const lastTimestampRef = useRef<string | null>(null)

  // Only update display data when we receive new data (different timestamp)
  useEffect(() => {
    if (currentData && currentData.timestamp !== lastTimestampRef.current) {
      // For sensor data, we simply use the current data
      const mergedData = { ...currentData }

      // Update last known values with new data
      if (currentData.resistance !== undefined && currentData.resistance !== null) {
        setLastKnownValues(prev => ({
          ...prev,
          resistance: currentData.resistance
        }))
      } else if (lastKnownValues.resistance !== undefined) {
        // Use last known resistance if current data doesn't have it
        (mergedData as any).resistance = lastKnownValues.resistance
      }

      if (currentData.temperature !== undefined && currentData.temperature !== null) {
        setLastKnownValues(prev => ({
          ...prev,
          temperature: currentData.temperature
        }))
      } else if (lastKnownValues.temperature !== undefined) {
        // Use last known temperature if current data doesn't have it
        (mergedData as any).temperature = lastKnownValues.temperature
      }

      if (currentData.humidity !== undefined && currentData.humidity !== null) {
        setLastKnownValues(prev => ({
          ...prev,
          humidity: currentData.humidity
        }))
      } else if (lastKnownValues.humidity !== undefined) {
        // Use last known humidity if current data doesn't have it
        (mergedData as any).humidity = lastKnownValues.humidity
      }

      if (currentData.co2 !== undefined && currentData.co2 !== null) {
        setLastKnownValues(prev => ({
          ...prev,
          co2: currentData.co2
        }))
      } else if (lastKnownValues.co2 !== undefined) {
        // Use last known CO2 if current data doesn't have it
        (mergedData as any).co2 = lastKnownValues.co2
      }

      setDisplayData(mergedData)
      lastTimestampRef.current = currentData.timestamp
    }
  }, [currentData, lastKnownValues])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Sensor Data</CardTitle>
        <CardDescription>Current resistance and temperature readings from ESP32</CardDescription>
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

                    // Extract unit from label, e.g., "(Ω)" -> "Ω"
                    const unitMatch = label.match(/\(([^)]+)\)/)
                    const unit = unitMatch ? unitMatch[1] : ""
                    const sensorName = label.replace(/\s*\([^)]*\)/, "") // Remove unit from name

                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{sensorName}</TableCell>
                        <TableCell className="font-mono">
                          {value !== undefined && value !== null
                            ? (typeof value === "number" ? value.toFixed(2) : value)
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
          <div className="text-center py-8 text-muted-foreground">Waiting for resistance data...</div>
        )}
      </CardContent>
    </Card>
  )
}
