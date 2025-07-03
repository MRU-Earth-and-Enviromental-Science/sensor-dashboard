"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Maximize2, MapPin, Wifi, WifiOff } from "lucide-react"

// Calgary, Alberta coordinates
const CALGARY_COORDS: [number, number] = [-114.0719, 51.0447]

// Set your Mapbox access token here
mapboxgl.accessToken = "pk.eyJ1IjoiczMzd2FsaWEiLCJhIjoiY21jZHEzaW1jMGV0djJpb2pyeXY3Y2FzNyJ9.ndc2RRVzzjK21RZIXxH62Q"

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

interface SensorData {
    id: string
    latitude: number
    longitude: number
    temperature: number
    humidity: number
    ch4: number
    co2: number
    nox: number
    co: number
    pm_1_0: number
    pm_2_5: number
    pm_10_0: number
    tvoc: number
}

type PollutantType = "temp" | "humid" | "ch4" | "co2" | "nox" | "co" | "pm_1_0" | "pm_2_5" | "pm_10_0" | "tvoc"

const pollutantConfig = {
    temp: { name: "Temperature", unit: "°C", color: "#ff4444", min: -30, max: 40 },
    humid: { name: "Humidity", unit: "%", color: "#4444ff", min: 0, max: 100 },
    ch4: { name: "CH₄", unit: "ppm", color: "#ff8800", min: 0, max: 10 },
    co2: { name: "CO₂", unit: "ppm", color: "#8800ff", min: 300, max: 1000 },
    nox: { name: "NOₓ", unit: "ppm", color: "#ff0088", min: 0, max: 200 },
    co: { name: "CO", unit: "ppm", color: "#ff4400", min: 0, max: 50 },
    pm_1_0: { name: "PM1.0", unit: "μg/m³", color: "#888800", min: 0, max: 100 },
    pm_2_5: { name: "PM2.5", unit: "μg/m³", color: "#ff8888", min: 0, max: 150 },
    pm_10_0: { name: "PM10.0", unit: "μg/m³", color: "#8888ff", min: 0, max: 200 },
    tvoc: { name: "TVOCs", unit: "ppb", color: "#88ff88", min: 0, max: 1000 },
}

// Convert serial data to sensor data format
const convertSerialToSensorData = (serialData: SerialData, useLocation = false): SensorData => {
    // Use GPS coordinates if available, otherwise use Calgary area with small random offset
    const baseLatitude = useLocation && serialData.lat ? serialData.lat : CALGARY_COORDS[1]
    const baseLongitude = useLocation && serialData.lon ? serialData.lon : CALGARY_COORDS[0]

    // Add small random offset if using Calgary coordinates to simulate multiple sensors
    const latOffset = useLocation ? 0 : (Math.random() - 0.5) * 0.01
    const lngOffset = useLocation ? 0 : (Math.random() - 0.5) * 0.01

    return {
        id: `sensor-${Date.now()}`,
        latitude: baseLatitude + latOffset,
        longitude: baseLongitude + lngOffset,
        temperature: serialData.temp ?? 0,
        humidity: serialData.humid ?? 0,
        ch4: serialData.ch4 ?? 0,
        co2: serialData.co2 ?? 0,
        nox: serialData.nox ?? 0,
        co: serialData.co ?? 0,
        pm_1_0: serialData.pm_1_0 ?? 0,
        pm_2_5: serialData.pm_2_5 ?? 0,
        pm_10_0: serialData.pm_10_0 ?? 0,
        tvoc: serialData.tvoc ?? 0,
    }
}

interface EnvironmentalSensorMapPreviewProps {
    onExpand: () => void
    selectedPollutant: string
    onPollutantChange: (pollutant: string) => void
    currentData?: SerialData | null
    isRealTime?: boolean
    isDarkMode?: boolean
    selectedArea?: any // Add this prop to detect selected area
    isAreaLocked?: boolean // Add this prop
}

export function EnvironmentalSensorMapPreview({
    onExpand,
    selectedPollutant,
    onPollutantChange,
    currentData = null,
    isRealTime = false,
    isDarkMode = false,
    selectedArea,
    isAreaLocked: propIsAreaLocked = false,
}: EnvironmentalSensorMapPreviewProps) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const [isLoaded, setIsLoaded] = useState(false)
    const [sensorData, setSensorData] = useState<SensorData[]>([])
    const [isAreaLocked, setIsAreaLocked] = useState(false)
    const [selectedRegion, setSelectedRegion] = useState<mapboxgl.LngLatBounds | null>(null)

    // If there's no getCurrentLocation in preview, add this test function:
    const testGeolocation = useCallback(() => {
        console.log("🧪 [Preview] Testing geolocation...")

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    console.log("🧪 [Preview] Test success:", pos)
                    alert(`Preview Test Success!\nLat: ${pos.coords.latitude}\nLng: ${pos.coords.longitude}`)
                },
                (err) => {
                    console.log("🧪 [Preview] Test error:", err)
                    alert(`Preview Test Error: ${err.message}`)
                },
                { timeout: 10000 },
            )
        } else {
            alert("Preview: No geolocation available")
        }
    }, [])

    useEffect(() => {
        if (!mapContainer.current || map.current) return

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
            center: CALGARY_COORDS,
            zoom: 10,
            interactive: false, // Disable interaction in preview
        })

        map.current.on("load", () => {
            setIsLoaded(true)
        })

        return () => {
            if (map.current) {
                map.current.remove()
                map.current = null
            }
        }
    }, [isDarkMode])

    // Get current location on mount for preview
    useEffect(() => {
        if (map.current && isLoaded && !isAreaLocked) {
            // Try to get current location for preview
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        if (map.current && !isAreaLocked) {
                            map.current.flyTo({
                                center: [position.coords.longitude, position.coords.latitude],
                                zoom: 12,
                                duration: 1500,
                            })
                        }
                    },
                    (error) => {
                        console.log("Preview location failed, using Calgary default")
                    },
                    {
                        enableHighAccuracy: false,
                        timeout: 10000,
                        maximumAge: 300000,
                    },
                )
            }
        }
    }, [isLoaded, isAreaLocked])

    // Lock preview to area if selected
    useEffect(() => {
        if (selectedArea && map.current && isLoaded) {
            setIsAreaLocked(true)
            // Fit to the selected area bounds
            map.current.fitBounds(selectedArea, { padding: 20 })
        }
    }, [selectedArea, isLoaded])

    // Update sensor data when currentData changes
    useEffect(() => {
        if (currentData) {
            const newSensorData = convertSerialToSensorData(currentData, true)
            setSensorData((prev) => {
                // Keep last 10 readings for preview
                const updated = [newSensorData, ...prev.slice(0, 9)]
                return updated
            })
        }
    }, [currentData])

    // Update heatmap when pollutant or data changes
    useEffect(() => {
        if (!map.current || !isLoaded || sensorData.length === 0) return

        const pollutant = selectedPollutant as PollutantType
        const config = pollutantConfig[pollutant]

        // Remove existing heatmap
        if (map.current.getLayer("preview-heatmap")) {
            map.current.removeLayer("preview-heatmap")
        }
        if (map.current.getSource("preview-heatmap")) {
            map.current.removeSource("preview-heatmap")
        }

        // Add new heatmap
        const geojsonData = {
            type: "FeatureCollection" as const,
            features: sensorData.map((point) => ({
                type: "Feature" as const,
                properties: {
                    value: point[pollutant as keyof SensorData],
                },
                geometry: {
                    type: "Point" as const,
                    coordinates: [point.longitude, point.latitude],
                },
            })),
        }

        map.current.addSource("preview-heatmap", {
            type: "geojson",
            data: geojsonData,
        })

        map.current.addLayer({
            id: "preview-heatmap",
            type: "heatmap",
            source: "preview-heatmap",
            paint: {
                "heatmap-weight": ["interpolate", ["linear"], ["get", "value"], config.min, 0, config.max, 1],
                "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
                "heatmap-color": [
                    "interpolate",
                    ["linear"],
                    ["heatmap-density"],
                    0,
                    "rgba(0,0,255,0)",
                    0.2,
                    config.color + "40",
                    0.4,
                    config.color + "80",
                    0.6,
                    config.color + "CC",
                    1,
                    config.color,
                ],
                "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 2, 15, 20],
                "heatmap-opacity": 0.8,
            },
        })
    }, [selectedPollutant, sensorData, isLoaded])

    const currentValue = currentData ? currentData[selectedPollutant as keyof SerialData] : 0
    const config = pollutantConfig[selectedPollutant as PollutantType]

    return (
        <Card className="w-full max-w-4xl mx-auto shadow-lg hover:shadow-xl transition-shadow duration-300">
            <CardContent className="p-0 relative">
                {/* Map Container */}
                <div
                    className={`relative h-64 w-full overflow-hidden rounded-t-lg ${isDarkMode ? "bg-gray-900" : "bg-gray-100"}`}
                >
                    <div ref={mapContainer} className="w-full h-full transition-all duration-300 ease-in-out" />

                    {/* Overlay Controls */}
                    <div className="absolute top-3 right-3 flex gap-2">
                        {/* Pollutant Selector */}
                        <Select value={selectedPollutant} onValueChange={onPollutantChange}>
                            <SelectTrigger className="w-32 h-8 text-xs bg-white/90 backdrop-blur-sm border-white/20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {Object.entries(pollutantConfig).map(([key, config]) => (
                                    <SelectItem key={key} value={key} className="text-xs">
                                        {config.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* Expand Button */}
                        <Button
                            onClick={onExpand}
                            size="sm"
                            className="h-8 w-8 p-0 bg-white/90 hover:bg-white text-gray-700 hover:text-gray-900 backdrop-blur-sm border-white/20"
                            variant="outline"
                        >
                            <Maximize2 className="h-4 w-4" />
                        </Button>
                    </div>

                    {/* Location Badge */}
                    <div className="absolute top-3 left-3">
                        <div className="bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium text-gray-700 flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {currentData?.lat && currentData?.lon ? "GPS Location" : "Calgary, AB"}
                        </div>
                    </div>

                    {/* Real-time Status */}
                    <div className="absolute bottom-3 left-3">
                        <div
                            className={`bg-white/90 backdrop-blur-sm rounded-full px-3 py-1 text-xs font-medium flex items-center gap-1 ${isRealTime ? "text-green-700" : "text-gray-700"
                                }`}
                        >
                            {isRealTime ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                            {isRealTime ? "Live Data" : "No Data"}
                        </div>
                    </div>

                    {/* Click to Expand Overlay */}
                    <div
                        className="absolute inset-0 bg-transparent cursor-pointer flex items-center justify-center group transition-all duration-300 ease-in-out hover:bg-black/10"
                        onClick={onExpand}
                    >
                        <div className="bg-black/70 text-white px-6 py-3 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 ease-in-out transform group-hover:scale-105 backdrop-blur-sm">
                            <div className="flex items-center gap-2">
                                <Maximize2 className="h-4 w-4" />
                                Click to expand map
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Bar */}
                <div className={`p-4 rounded-b-lg ${isDarkMode ? "bg-gray-800 text-white" : "bg-gray-50"}`}>
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                                Environmental Sensor Data - Live Feed
                            </h3>
                            <p className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                                {isRealTime ? "Real-time serial data monitoring" : "Connect sensor to view live data"}
                            </p>
                        </div>

                        {config && (
                            <div className="text-right">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                                    <span className="text-sm font-medium">{config.name}</span>
                                </div>
                                <div className={`text-lg font-bold ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                                    {typeof currentValue === "number" ? currentValue.toFixed(1) : "--"} {config.unit}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
