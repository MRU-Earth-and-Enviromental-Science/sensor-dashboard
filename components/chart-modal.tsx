"use client"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { Download, X } from "lucide-react"
import { useEffect } from "react"

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

const graphableFields = Object.keys(sensorLabels) as (keyof typeof sensorLabels)[]

export function ChartModal({ isOpen, onClose, allChartData, selectedChart, onChartChange }: ChartModalProps) {
    const rawData = allChartData[selectedChart] || []

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

    // Filter out -1 values and use last valid value
    const currentData = rawData.reduce((acc: ChartData[], point: ChartData) => {
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

    const exportChartData = () => {
        if (currentData.length === 0) return

        const csvContent = ["timestamp,value", ...currentData.map((point) => `${point.fullTimestamp},${point.value}`)].join(
            "\n",
        )

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
                        <h2 className="text-xl font-semibold">
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
                                            {sensorLabels[field]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={exportChartData}
                                variant="outline"
                                size="sm"
                                disabled={currentData.length === 0}
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

                    <div>
                        {currentData.length > 0 ? (
                            <div className="space-y-4">
                                <div className="text-sm text-muted-foreground">
                                    Showing {currentData.length} data points from{" "}
                                    {new Date(currentData[0]?.fullTimestamp).toLocaleString()} to{" "}
                                    {new Date(currentData[currentData.length - 1]?.fullTimestamp).toLocaleString()}
                                </div>
                                <ChartContainer
                                    config={{
                                        value: {
                                            label: sensorLabels[selectedChart as keyof typeof sensorLabels],
                                            color: "hsl(var(--chart-1))",
                                        },
                                    }}
                                    className="h-[500px] w-full"
                                >
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={currentData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
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
                                            <Line
                                                type="monotone"
                                                dataKey="value"
                                                stroke="var(--color-value)"
                                                strokeWidth={2}
                                                dot={false}
                                                name={sensorLabels[selectedChart as keyof typeof sensorLabels]}
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
