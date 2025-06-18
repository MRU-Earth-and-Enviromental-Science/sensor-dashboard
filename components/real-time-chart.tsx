"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { TrendingUp } from "lucide-react"

interface ChartData {
  timestamp: string
  value: number
  fullTimestamp: string
}

interface RealTimeChartProps {
  chartData: ChartData[]
  selectedChart: string
  onChartChange: (value: string) => void
  onExpandChart: () => void
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

const graphableFields = Object.keys(sensorLabels) as (keyof typeof sensorLabels)[]

export function RealTimeChart({ chartData, selectedChart, onChartChange, onExpandChart }: RealTimeChartProps) {
  // Filter out -1 values and use last valid value
  const filteredData = chartData.reduce((acc: ChartData[], point: ChartData) => {
    if (point.value === -1) {
      // Use the last valid value if available
      const lastValidValue = acc.length > 0 ? acc[acc.length - 1].value : 0
      acc.push({
        ...point,
        value: lastValidValue,
      })
    } else {
      acc.push(point)
    }
    return acc
  }, [])

  return (
    <Card
      className="cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 ease-in-out relative"
      onClick={onExpandChart}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-red-500" />
          Real-time Chart Preview
        </CardTitle>
        <CardDescription>
          <div className="flex items-center justify-between">
            <span>Live data visualization (last 50 points) - Click to expand</span>
            <Select value={selectedChart} onValueChange={onChartChange}>
              <SelectTrigger className="w-48" onClick={(e) => e.stopPropagation()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {graphableFields.map((field) => (
                  <SelectItem key={field} value={field}>
                    {sensorLabels[field]}
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
        {filteredData.length > 0 ? (
          <div className="relative -ml-6 -mr-2 transform translate-y-0 -translate-x-1">
            <ChartContainer
              config={{
                value: {
                  label: sensorLabels[selectedChart as keyof typeof sensorLabels],
                  color: "hsl(var(--chart-1))",
                },
              }}
              className="h-[400px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={filteredData} margin={{ top: 20, right: 5, left: 0, bottom: 20 }}>
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
                    stroke="#ff0000"
                    strokeWidth={2}
                    dot={false}
                    name={sensorLabels[selectedChart as keyof typeof sensorLabels]}
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
