"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Signal } from "lucide-react"

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
}

export function DataTable({ currentData }: DataTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Signal className="h-5 w-5 text-blue-500 hover:text-blue-600 transition-transform hover:scale-110" />
          Live Sensor Data
        </CardTitle>
        <CardDescription>Current readings from all sensors</CardDescription>
      </CardHeader>
      <CardContent>
        {currentData ? (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">
              Last updated: {new Date(currentData.timestamp).toLocaleTimeString()}
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
                    const value = currentData[key as keyof SerialData]
                    const unit = label.match(/\(([^)]+)\)/)?.[1] || ""
                    const sensorName = label.replace(/\s*\([^)]+\)/, "")
                    console.log("💡 Current Data in Table:", currentData)

                    return (
                      <TableRow key={key}>
                        <TableCell className="font-medium">{sensorName}</TableCell>
                        <TableCell className="font-mono">
                          {typeof value === "number" && !isNaN(value) ? value.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{unit}</TableCell>
                      </TableRow>
                    )
                  })}
                  {typeof currentData.lat === "number" && typeof currentData.lon === "number" && (
                    <>
                      <TableRow>
                        <TableCell className="font-medium">Latitude</TableCell>
                        <TableCell className="font-mono">{Number(currentData.lat).toFixed(6)}</TableCell>
                        <TableCell className="text-muted-foreground">°</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Longitude</TableCell>
                        <TableCell className="font-mono">{Number(currentData.lon).toFixed(6)}</TableCell>
                        <TableCell className="text-muted-foreground">°</TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        ) : (
          <div className="mt-40 text-center py-8 text-muted-foreground">Waiting for sensor data...</div>
        )}
      </CardContent>
    </Card>
  )
}
