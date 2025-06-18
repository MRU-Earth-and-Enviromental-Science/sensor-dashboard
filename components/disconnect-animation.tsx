"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { WifiOff, RefreshCw, Moon, Sun, Database, TrendingUp, Wifi } from "lucide-react"

interface DisconnectAnimationProps {
  isDarkMode: boolean
  onToggleDarkMode: () => void
  ports: Array<{ path: string; manufacturer?: string }>
  selectedPort: string
  baudRate: string
  error: string
  isLogging: boolean
  loggedCount: number
}

export function DisconnectAnimation({
  isDarkMode,
  onToggleDarkMode,
  ports,
  selectedPort,
  baudRate,
  error,
  isLogging,
  loggedCount,
}: DisconnectAnimationProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      {/* Dashboard fading out */}
      <div className="dashboard-fade-out absolute inset-0">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Environmental Sensor Dashboard</h1>
              <p className="text-muted-foreground">Real-time monitoring of air quality and environmental data</p>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" disabled>
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Badge variant="secondary" className="flex items-center gap-2">
                <Wifi className="h-4 w-4" />
                Disconnecting
              </Badge>
              <Button variant="outline" size="sm" disabled>
                Disconnect
              </Button>
            </div>
          </div>

          {/* Logging Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Data Logging
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="font-medium">Status: {isLogging ? "Recording" : "Stopped"}</div>
                    <div className="text-sm text-muted-foreground">
                      {isLogging ? `${loggedCount} records logged` : "Disconnecting..."}
                    </div>
                  </div>
                  <Badge variant="secondary">Disconnecting</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Main Content - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Data Table Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Live Sensor Data</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">Disconnecting...</div>
              </CardContent>
            </Card>

            {/* Chart Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Real-time Chart
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-96 flex items-center justify-center text-muted-foreground">Disconnecting...</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Connection screen sliding in from left */}
      <div className="w-full max-w-xs slide-in-animation">
        {/* Dark Mode Toggle */}
        <Button onClick={onToggleDarkMode} variant="outline" size="icon" className="absolute top-4 right-4">
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2 pt-4">
            <CardTitle className="text-lg">Serial Dashboard</CardTitle>
            <Badge variant="secondary" className="flex items-center gap-1 w-fit mx-auto text-xs">
              <WifiOff className="h-3 w-3" />
              Disconnected
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            {/* Error Alert */}
            {error && (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {/* Port Selection */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Serial Port</label>
              <Select value={selectedPort} disabled>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select port" />
                </SelectTrigger>
                <SelectContent>
                  {ports.map((port) => (
                    <SelectItem key={port.path} value={port.path} className="text-sm">
                      {port.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Baud Rate */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Baud Rate</label>
              <Select value={baudRate} disabled>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9600">9600</SelectItem>
                  <SelectItem value="19200">19200</SelectItem>
                  <SelectItem value="38400">38400</SelectItem>
                  <SelectItem value="57600">57600</SelectItem>
                  <SelectItem value="115200">115200</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" disabled className="h-8 w-8 p-0">
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button disabled className="flex-1 h-8 text-sm">
                Disconnected
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <style jsx>{`
        .dashboard-fade-out {
          animation: fadeOut 0.8s ease-in-out forwards;
        }
        
        .slide-in-animation {
          animation: slideIn 0.8s ease-in-out forwards;
        }
        
        @keyframes fadeOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        
        @keyframes slideIn {
          0% {
            transform: translateX(-100vw);
            opacity: 0;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}
