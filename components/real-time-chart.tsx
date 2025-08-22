"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"
import { useMemo } from "react"

interface ChartData {
  timestamp: string
  value: number
  fullTimestamp: string
}

interface RealTimeChartProps {
  chartData: ChartData[] // This will be exactly 50 points
  selectedChart: string
  onChartChange: (value: string) => void
  onExpandChart: () => void
}

const sensorLabels = {
  resistance: "Resistance (Ω)",
  temperature: "Temperature (°C)",
  humidity: "Humidity (%)",
  co2: "CO2 (ppm)",
}

// Define colors for sensors
const sensorColors = {
  resistance: "#0080FF", // Electric blue
  temperature: "#FF6B35", // Orange-red
  humidity: "#10B981", // Green
  co2: "#6B21A8", // Purple
}

const graphableFields = Object.keys(sensorLabels) as (keyof typeof sensorLabels)[]

export function RealTimeChart({ chartData, selectedChart, onChartChange, onExpandChart }: RealTimeChartProps) {
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

  return (
    <Card
      className="cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 ease-in-out relative"
      onClick={onExpandChart}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" style={{ color: currentSensorColor }} />
          Real-time Chart Preview
        </CardTitle>
        <CardDescription>
          <div className="flex items-center justify-between">
            <span>Live data visualization (last {chartData.length} points) - Click to expand</span>
            <Select value={selectedChart} onValueChange={onChartChange}>
              <SelectTrigger className="w-48" onClick={(e) => e.stopPropagation()}>
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
          </div>
        </CardDescription>
      </CardHeader>

      {/* Added spacer div to push chart down */}
      <div className="h-8"></div>

      <CardContent className="pt-0 pb-4">
        {chartData.length > 0 ? (
          <div className="relative -ml-6 -mr-2 transform translate-y-0 -translate-x-1">
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 20, right: 5, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 10 }}
                    interval="preserveStartEnd"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    domain={["dataMin - 2", "dataMax + 2"]}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={currentSensorColor}
                    strokeWidth={2}
                    dot={false}
                    name={sensorLabels[selectedChart as keyof typeof sensorLabels]}
                    // Smooth line animations
                    isAnimationActive={true}
                    animationDuration={200}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </div>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground transform translate-y-4">
            Waiting for data to populate chart...
          </div>
        )}
      </CardContent>
    </Card>
  )
}
