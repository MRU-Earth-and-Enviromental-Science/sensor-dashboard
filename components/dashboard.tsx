"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Play, Square, Download, Wifi, WifiOff, Database, Moon, Sun } from "lucide-react"
import { DataTable } from "./data-table"
import { RealTimeChart } from "./real-time-chart"
import { ChartModal } from "./chart-modal"
import { Footer } from "./footer"

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

interface ChartData {
  timestamp: string
  value: number
  fullTimestamp: string
}

interface DashboardProps {
  isConnected: boolean
  isLogging: boolean
  loggedCount: number
  error: string
  currentData: SerialData | null
  chartData: ChartData[]
  allChartData: Record<string, ChartData[]>
  selectedChart: string
  isDarkMode: boolean
  onToggleDarkMode: () => void
  onDisconnect: () => void
  onStartLogging: () => void
  onStopLogging: () => void
  onExportCSV: () => void
  onChartChange: (value: string) => void
}

export function Dashboard({
  isConnected,
  isLogging,
  loggedCount,
  error,
  currentData,
  chartData,
  allChartData,
  selectedChart,
  isDarkMode,
  onToggleDarkMode,
  onDisconnect,
  onStartLogging,
  onStopLogging,
  onExportCSV,
  onChartChange,
}: DashboardProps) {
  const [isChartModalOpen, setIsChartModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background dashboard-fade-in flex flex-col">
      <div className="flex-1">
        <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Environmental Sensor Dashboard</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                Real-time monitoring of air quality and environmental data
              </p>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                onClick={onToggleDarkMode}
                variant="outline"
                size="icon"
                className="hover:scale-110 transition-transform duration-200"
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={`flex items-center gap-2 ${isConnected ? "bg-blue-600 text-white" : ""}`}
              >
                {isConnected ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
              <Button
                onClick={onDisconnect}
                variant="outline"
                size="sm"
                className="hover:scale-105 transition-transform duration-200"
              >
                Disconnect
              </Button>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Logging Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-green-500 hover:text-green-600 transition-transform hover:scale-110" />
                Data Logging
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium">Status: {isLogging ? "Recording" : "Stopped"}</div>
                    <div className="text-sm text-muted-foreground">
                      {isLogging ? `${loggedCount} records logged` : "Click start to begin logging"}
                    </div>
                  </div>
                  <Badge variant={isLogging ? "default" : "secondary"}>{isLogging ? "Recording" : "Idle"}</Badge>
                </div>
                <div className="flex gap-2">
                  {!isLogging ? (
                    <Button onClick={onStartLogging} className="bg-blue-700 text-white hover:scale-105 transition-transform duration-200">
                      <Play className="h-4 w-4 mr-2" />
                      Start Logging
                    </Button>
                  ) : (
                    <Button
                      onClick={onStopLogging}
                      variant="outline"
                      className="hover:scale-105 transition-transform duration-200"
                    >
                      <Square className="h-4 w-4 mr-2" />
                      Stop Logging
                    </Button>
                  )}
                  <Button
                    onClick={onExportCSV}
                    variant="outline"
                    disabled={loggedCount === 0}
                    className="hover:scale-105 transition-transform duration-200 disabled:hover:scale-100"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 pb-8">
            <DataTable currentData={currentData} />
            <RealTimeChart
              chartData={chartData}
              selectedChart={selectedChart}
              onChartChange={onChartChange}
              onExpandChart={() => setIsChartModalOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* Footer with proper spacing */}
      <div className="mt-auto">
        <Footer />
      </div>

      {/* Chart Modal */}
      <ChartModal
        isOpen={isChartModalOpen}
        onClose={() => setIsChartModalOpen(false)}
        allChartData={allChartData}
        selectedChart={selectedChart}
        onChartChange={onChartChange}
      />

      <style jsx>{`
        .dashboard-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}
