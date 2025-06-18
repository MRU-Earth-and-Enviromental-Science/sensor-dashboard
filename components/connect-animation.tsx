"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Wifi, RefreshCw } from "lucide-react"

interface ConnectAnimationProps {
  selectedPort: string
  baudRate: string
}

export function ConnectAnimation({ selectedPort, baudRate }: ConnectAnimationProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center relative overflow-hidden">
      <div className="w-full max-w-xs slide-out-animation">
        <Card className="shadow-lg">
          <CardHeader className="text-center pb-2 pt-4">
            <CardTitle className="text-lg">Serial Dashboard</CardTitle>
            <Badge variant="default" className="flex items-center gap-1 w-fit mx-auto text-xs">
              <Wifi className="h-3 w-3" />
              Connected
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3 pb-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Serial Port</label>
              <Select value={selectedPort} disabled>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Baud Rate</label>
              <Select value={baudRate} disabled>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
              </Select>
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" size="sm" disabled className="h-8 w-8 p-0">
                <RefreshCw className="h-3 w-3" />
              </Button>
              <Button variant="outline" disabled className="flex-1 h-8 text-sm">
                Connected
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <style jsx>{`
        .slide-out-animation {
          animation: slideOut 0.8s ease-in-out forwards;
        }
        
        @keyframes slideOut {
          0% {
            transform: translateX(0);
            opacity: 1;
          }
          100% {
            transform: translateX(-100vw);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
