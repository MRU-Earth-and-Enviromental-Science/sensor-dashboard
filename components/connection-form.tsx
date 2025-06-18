"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RefreshCw } from "lucide-react"

interface ConnectionFormProps {
  ports: Array<{ path: string; manufacturer?: string }>
  selectedPort: string
  baudRate: string
  isConnected: boolean
  onPortChange: (port: string) => void
  onBaudRateChange: (rate: string) => void
  onConnect: () => void
  onDisconnect: () => void
  onRefreshPorts: () => void
}

export function ConnectionForm({
  ports,
  selectedPort,
  baudRate,
  isConnected,
  onPortChange,
  onBaudRateChange,
  onConnect,
  onDisconnect,
  onRefreshPorts,
}: ConnectionFormProps) {
  return (
    <>
      {/* Port Selection */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Serial Port</label>
        <Select value={selectedPort} onValueChange={onPortChange} disabled={isConnected}>
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
        <Select value={baudRate} onValueChange={onBaudRateChange} disabled={isConnected}>
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
        <Button
          onClick={onRefreshPorts}
          variant="outline"
          size="sm"
          disabled={isConnected}
          className="h-8 w-8 p-0 hover:scale-105 transition-transform duration-200"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        {!isConnected ? (
          <Button
            onClick={onConnect}
            disabled={!selectedPort}
            className="flex-1 h-8 text-sm hover:scale-105 transition-transform duration-200"
          >
            Connect
          </Button>
        ) : (
          <Button
            onClick={onDisconnect}
            variant="outline"
            className="flex-1 h-8 text-sm hover:scale-105 transition-transform duration-200"
          >
            Disconnect
          </Button>
        )}
      </div>
    </>
  )
}
