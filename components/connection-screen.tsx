"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Wifi, WifiOff, Moon, Sun } from "lucide-react"
import { ConnectionForm } from "./connection-form"
import { Footer } from "./footer"

interface ConnectionScreenProps {
  isConnected: boolean
  error: string
  isDarkMode: boolean
  onToggleDarkMode: () => void
  ports: Array<{ path: string; manufacturer?: string }>
  selectedPort: string
  baudRate: string
  onPortChange: (port: string) => void
  onBaudRateChange: (rate: string) => void
  onConnect: () => void
  onDisconnect: () => void
  onRefreshPorts: () => void
}

export function ConnectionScreen({
  isConnected,
  error,
  isDarkMode,
  onToggleDarkMode,
  ports,
  selectedPort,
  baudRate,
  onPortChange,
  onBaudRateChange,
  onConnect,
  onDisconnect,
  onRefreshPorts,
}: ConnectionScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="flex-1 flex items-center justify-center relative">
        {/* Dark Mode Toggle */}
        <Button
          onClick={onToggleDarkMode}
          variant="outline"
          size="icon"
          className="absolute top-4 right-4 hover:scale-110 transition-transform duration-200"
        >
          {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <div className="w-full max-w-xs">
          {/* Ultra Compact Connection Card */}
          <Card className="shadow-lg">
            <CardHeader className="text-center pb-2 pt-4">
              <CardTitle className="text-lg">Serial Dashboard</CardTitle>
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className="flex items-center gap-1 w-fit mx-auto text-xs"
              >
                {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                {isConnected ? "Connected" : "Disconnected"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {/* Error Alert */}
              {error && (
                <Alert variant="destructive" className="py-2">
                  <AlertDescription className="text-xs">{error}</AlertDescription>
                </Alert>
              )}

              <ConnectionForm
                ports={ports}
                selectedPort={selectedPort}
                baudRate={baudRate}
                isConnected={isConnected}
                onPortChange={onPortChange}
                onBaudRateChange={onBaudRateChange}
                onConnect={onConnect}
                onDisconnect={onDisconnect}
                onRefreshPorts={onRefreshPorts}
              />
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}
