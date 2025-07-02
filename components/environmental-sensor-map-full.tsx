"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import mapboxgl from "mapbox-gl"
import "mapbox-gl/dist/mapbox-gl.css"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MapPin, Layers, Navigation, Pencil, Trash2, CheckCircle, X, Wifi, WifiOff, Undo } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
    timestamp: Date
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

interface DrawingPoint {
    lng: number
    lat: number
}

interface UserLocation {
    latitude: number
    longitude: number
    accuracy: number
}

const pollutantConfig = {
    temp: { name: "Temperature", unit: "°C", color: "#ff4444", min: -30, max: 40 },
    humid: { name: "Humidity", unit: "%", color: "#4444ff", min: 0, max: 100 },
    ch4: { name: "Methane (CH₄)", unit: "ppm", color: "#ff8800", min: 0, max: 10 },
    co2: { name: "Carbon Dioxide (CO₂)", unit: "ppm", color: "#8800ff", min: 300, max: 1000 },
    nox: { name: "Nitrogen Oxides (NOₓ)", unit: "ppm", color: "#ff0088", min: 0, max: 200 },
    co: { name: "Carbon Monoxide (CO)", unit: "ppm", color: "#ff4400", min: 0, max: 50 },
    pm_1_0: { name: "PM1.0", unit: "μg/m³", color: "#888800", min: 0, max: 100 },
    pm_2_5: { name: "PM2.5", unit: "μg/m³", color: "#ff8888", min: 0, max: 150 },
    pm_10_0: { name: "PM10.0", unit: "μg/m³", color: "#8888ff", min: 0, max: 200 },
    tvoc: { name: "TVOCs", unit: "ppb", color: "#88ff88", min: 0, max: 1000 },
}

// Convert serial data to sensor data format
const convertSerialToSensorData = (serialData: SerialData, bounds?: mapboxgl.LngLatBounds): SensorData => {
    let latitude, longitude

    if (serialData.lat && serialData.lon) {
        // Use actual GPS coordinates
        latitude = serialData.lat
        longitude = serialData.lon
    } else if (bounds) {
        // Generate within selected area bounds
        const sw = bounds.getSouthWest()
        const ne = bounds.getNorthEast()
        latitude = sw.lat + Math.random() * (ne.lat - sw.lat)
        longitude = sw.lng + Math.random() * (ne.lng - sw.lng)
    } else {
        // Use Calgary area with random offset
        latitude = CALGARY_COORDS[1] + (Math.random() - 0.5) * 0.01
        longitude = CALGARY_COORDS[0] + (Math.random() - 0.5) * 0.01
    }

    return {
        id: `sensor-${Date.now()}-${Math.random()}`,
        timestamp: new Date(serialData.timestamp),
        latitude,
        longitude,
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

interface EnvironmentalSensorMapFullProps {
    onClose: () => void
    defaultPollutant?: string
    currentData?: SerialData | null
    isRealTime?: boolean
    isDarkMode?: boolean
    onAreaSelect?: (area: mapboxgl.LngLatBounds | null) => void
    onAreaLock?: (locked: boolean) => void
}

export function EnvironmentalSensorMapFull({
    onClose,
    defaultPollutant = "pm_2_5",
    currentData = null,
    isRealTime = false,
    isDarkMode = false,
    onAreaSelect,
    onAreaLock,
}: EnvironmentalSensorMapFullProps) {
    const mapContainer = useRef<HTMLDivElement>(null)
    const map = useRef<mapboxgl.Map | null>(null)
    const userLocationMarker = useRef<mapboxgl.Marker | null>(null)
    const drawingMarkers = useRef<mapboxgl.Marker[]>([])

    // State management
    const [isLoaded, setIsLoaded] = useState(false)
    const [sensorData, setSensorData] = useState<SensorData[]>([])
    const [selectedPollutant, setSelectedPollutant] = useState<PollutantType>(defaultPollutant as PollutantType)
    const [selectedRegion, setSelectedRegion] = useState<mapboxgl.LngLatBounds | null>(null)
    const [timeRange, setTimeRange] = useState([0])
    const [visibleLayers, setVisibleLayers] = useState<Set<PollutantType>>(new Set([defaultPollutant as PollutantType]))

    // Location and drawing states
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
    const [locationError, setLocationError] = useState<string | null>(null)
    const [isDrawing, setIsDrawing] = useState(false)
    const [drawingPoints, setDrawingPoints] = useState<DrawingPoint[]>([])
    const [drawnPolygon, setDrawnPolygon] = useState<DrawingPoint[] | null>(null)
    const [isAreaLocked, setIsAreaLocked] = useState(false)
    // Refs to always have latest value in callbacks
    const isAreaLockedRef = useRef(isAreaLocked)
    const isDrawingRef = useRef(isDrawing)

    useEffect(() => { isAreaLockedRef.current = isAreaLocked }, [isAreaLocked])
    useEffect(() => { isDrawingRef.current = isDrawing }, [isDrawing])

    // Get user's current location with fallback strategies
    const getCurrentLocation = useCallback(async () => {
        console.log("🔍 getCurrentLocation called with fallback strategies")
        setLocationError(null)

        // Strategy 1: Try network-based geolocation first (faster, works indoors)
        console.log("🔍 Strategy 1: Trying network-based geolocation...")
        try {
            const networkLocation = await new Promise<GeolocationPosition>((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject(new Error("Geolocation not supported"))
                    return
                }

                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: false, // Network-based (WiFi/cell towers)
                    timeout: 15000, // 15 seconds
                    maximumAge: 300000, // Accept 5-minute-old cache
                })
            })

            console.log("✅ Network geolocation success:", networkLocation)
            const location: UserLocation = {
                latitude: networkLocation.coords.latitude,
                longitude: networkLocation.coords.longitude,
                accuracy: networkLocation.coords.accuracy,
            }
            setUserLocation(location)
            updateMapLocation(location)
            return
        } catch (networkError) {
            console.log("⚠️ Network geolocation failed:", networkError)
        }

        // Strategy 2: Try IP-based location
        console.log("🔍 Strategy 2: Trying IP-based location...")
        try {
            if (window.electronAPI?.getIpLocation) {
                const ipLocation = await window.electronAPI.getIpLocation()
                if (ipLocation.success) {
                    console.log("✅ IP location success:", ipLocation)
                    const location: UserLocation = {
                        latitude: ipLocation.latitude,
                        longitude: ipLocation.longitude,
                        accuracy: ipLocation.accuracy,
                    }
                    setUserLocation(location)
                    updateMapLocation(location)
                    setLocationError(`Using approximate location (${ipLocation.city}, ${ipLocation.region})`)
                    return
                }
            }
        } catch (ipError) {
            console.log("⚠️ IP location failed:", ipError)
        }

        // Strategy 3: Try high-accuracy GPS (last resort)
        console.log("🔍 Strategy 3: Trying high-accuracy GPS...")
        try {
            const gpsLocation = await new Promise<GeolocationPosition>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: true, // GPS
                    timeout: 30000, // 30 seconds
                    maximumAge: 60000, // Accept 1-minute-old cache
                })
            })

            console.log("✅ GPS location success:", gpsLocation)
            const location: UserLocation = {
                latitude: gpsLocation.coords.latitude,
                longitude: gpsLocation.coords.longitude,
                accuracy: gpsLocation.coords.accuracy,
            }
            setUserLocation(location)
            updateMapLocation(location)
            return
        } catch (gpsError) {
            console.log("⚠️ GPS location failed:", gpsError)
        }

        // All strategies failed
        console.error("❌ All location strategies failed")
        setLocationError("Unable to determine location. Please check your internet connection and location settings.")
    }, [])

    // Helper function to update map location
    const updateMapLocation = useCallback(
        (location: UserLocation) => {
            if (map.current) {
                // Only fly to location if not locked to an area AND not drawing (using refs for latest value)
                if (!isAreaLockedRef.current && !selectedRegion && !isDrawingRef.current) {
                    console.log("🗺️ Flying to user location:", location)
                    map.current.flyTo({
                        center: [location.longitude, location.latitude],
                        zoom: 15,
                        duration: 2000,
                    })
                } else {
                    console.log("🔒 Skipping flyTo - map is locked or drawing", { isAreaLocked: isAreaLockedRef.current, selectedRegion, isDrawing: isDrawingRef.current })
                }

                if (userLocationMarker.current) {
                    userLocationMarker.current.remove()
                }

                const el = document.createElement("div")
                el.className = "user-location-marker"
                el.style.cssText = `
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #4285f4;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      cursor: pointer;
    `

                userLocationMarker.current = new mapboxgl.Marker(el)
                    .setLngLat([location.longitude, location.latitude])
                    .addTo(map.current)

                console.log("✅ User location marker added to map")
            }
        },
        [selectedRegion],
    )

    // Update polygon preview as points are added
    const updatePolygonPreview = useCallback((points: DrawingPoint[]) => {
        console.log("🔄 Updating polygon preview with", points.length, "points")

        if (!map.current || points.length < 2) {
            console.log("❌ Not enough points or no map for preview")
            return
        }

        // Remove existing preview - CHECK IF THEY EXIST FIRST
        if (map.current.getSource("polygon-preview")) {
            if (map.current.getLayer("polygon-preview-fill")) {
                map.current.removeLayer("polygon-preview-fill")
            }
            if (map.current.getLayer("polygon-preview-line")) {
                map.current.removeLayer("polygon-preview-line")
            }
            map.current.removeSource("polygon-preview")
        }

        // Create the appropriate geometry based on point count
        let geoJSON
        if (points.length >= 3) {
            // Create polygon for 3+ points
            geoJSON = {
                type: "FeatureCollection" as const,
                features: [
                    {
                        type: "Feature" as const,
                        geometry: {
                            type: "Polygon" as const,
                            coordinates: [[...points.map((p) => [p.lng, p.lat]), [points[0].lng, points[0].lat]]],
                        },
                        properties: {},
                    },
                ],
            }
        } else {
            // Create line for 2 points
            geoJSON = {
                type: "FeatureCollection" as const,
                features: [
                    {
                        type: "Feature" as const,
                        geometry: {
                            type: "LineString" as const,
                            coordinates: points.map((p) => [p.lng, p.lat]),
                        },
                        properties: {},
                    },
                ],
            }
        }

        // Add the preview source
        map.current.addSource("polygon-preview", {
            type: "geojson",
            data: geoJSON,
        })

        // Add fill layer for polygons (3+ points)
        if (points.length >= 3) {
            map.current.addLayer({
                id: "polygon-preview-fill",
                type: "fill",
                source: "polygon-preview",
                paint: {
                    "fill-color": "#FF4444", // Bright red
                    "fill-opacity": 0.3,
                },
            })
        }

        // Add the line layer (clean single line)
        map.current.addLayer({
            id: "polygon-preview-line",
            type: "line",
            source: "polygon-preview",
            paint: {
                "line-color": "#FF0000", // Bright red
                "line-width": 4,
                "line-opacity": 1.0,
            },
        })

        // Force map to update
        map.current.triggerRepaint()
        console.log("✅ Clean polygon preview updated")
    }, [])

    // Drawing functions
    const startDrawing = useCallback(() => {
        console.log("🎨 Starting drawing mode - STAYING EXACTLY WHERE USER IS")

        // LOCK THE MAP IMMEDIATELY when drawing starts - DO THIS FIRST
        if (map.current) {
            map.current.getCanvas().style.cursor = "crosshair"

            // DISABLE MAP INTERACTIONS IMMEDIATELY
            map.current.dragPan.disable()
            map.current.scrollZoom.disable()
            map.current.doubleClickZoom.disable()
            map.current.touchZoomRotate.disable()
        }

        // Set state after disabling map interactions
        setIsAreaLocked(true) // Ensure area is locked before starting drawing
        onAreaLock?.(true)
        setIsDrawing(true)
        setDrawingPoints([])
        setDrawnPolygon(null)

        // Clear any existing selection
        if (map.current && map.current.getSource("selected-area")) {
            if (map.current.getLayer("selected-area-fill")) {
                map.current.removeLayer("selected-area-fill")
            }
            if (map.current.getLayer("selected-area-line")) {
                map.current.removeLayer("selected-area-line")
            }
            map.current.removeSource("selected-area")
        }

        // Clear existing markers (but we're not creating any now)
        drawingMarkers.current.forEach((marker) => marker.remove())
        drawingMarkers.current = []

        console.log("✅ Drawing mode activated - NO MAP MOVEMENT, NO MARKERS")
    }, [onAreaLock])

    const addPoint = useCallback(
        (point: DrawingPoint) => {
            console.log("🎯 Adding point:", point)
            setDrawingPoints((prev) => {
                const newPoints = [...prev, point]

                // NO MARKERS - just update the polygon preview
                updatePolygonPreview(newPoints)

                return newPoints
            })
        },
        [updatePolygonPreview],
    )

    const removeLastPoint = useCallback(() => {
        if (drawingPoints.length > 0) {
            const newPoints = drawingPoints.slice(0, -1)
            setDrawingPoints(newPoints)

            // Update the polygon preview (no markers to remove)
            updatePolygonPreview(newPoints)
        }
    }, [drawingPoints, updatePolygonPreview])

    const completeDrawing = useCallback(() => {
        if (drawingPoints.length >= 3) {
            setDrawnPolygon([...drawingPoints])
            setIsDrawing(false)

            // NOW lock the map after drawing is complete
            setIsAreaLocked(true)
            onAreaLock?.(true)

            const lngs = drawingPoints.map((p) => p.lng)
            const lats = drawingPoints.map((p) => p.lat)
            const bounds = new mapboxgl.LngLatBounds(
                [Math.min(...lngs), Math.min(...lats)],
                [Math.max(...lngs), Math.max(...lats)],
            )
            setSelectedRegion(bounds)
            onAreaSelect?.(bounds)

            if (map.current) {
                // Remove preview layers (including outline)
                if (map.current.getLayer("polygon-preview-line")) {
                    map.current.removeLayer("polygon-preview-line")
                }
                if (map.current.getLayer("polygon-preview-outline")) {
                    map.current.removeLayer("polygon-preview-outline")
                }
                if (map.current.getLayer("polygon-preview-fill")) {
                    map.current.removeLayer("polygon-preview-fill")
                }
                if (map.current.getSource("polygon-preview")) {
                    map.current.removeSource("polygon-preview")
                }

                // Create the final polygon GeoJSON
                const polygonGeoJSON = {
                    type: "FeatureCollection" as const,
                    features: [
                        {
                            type: "Feature" as const,
                            geometry: {
                                type: "Polygon" as const,
                                coordinates: [
                                    [...drawingPoints.map((p) => [p.lng, p.lat]), [drawingPoints[0].lng, drawingPoints[0].lat]],
                                ],
                            },
                            properties: {},
                        },
                    ],
                }

                // Add the final source
                map.current.addSource("selected-area", {
                    type: "geojson",
                    data: polygonGeoJSON,
                })

                // Add the final fill layer (light blue)
                map.current.addLayer({
                    id: "selected-area-fill",
                    type: "fill",
                    source: "selected-area",
                    paint: {
                        "fill-color": "#87CEEB", // Light blue
                        "fill-opacity": 0.4,
                    },
                })

                // Add the final outline layer (orange)
                map.current.addLayer({
                    id: "selected-area-line",
                    type: "line",
                    source: "selected-area",
                    paint: {
                        "line-color": "#FF8C00", // Orange
                        "line-width": 4,
                        "line-opacity": 1.0,
                    },
                })

                // Force map to update
                map.current.triggerRepaint()

                // Zoom to fit the polygon
                setTimeout(() => {
                    if (map.current) {
                        map.current.fitBounds(bounds, {
                            padding: 80,
                            maxZoom: 15,
                            duration: 1000,
                        })
                    }
                }, 100)

                // NOW disable map interactions after completion
                setTimeout(() => {
                    if (map.current) {
                        map.current.dragPan.disable()
                        map.current.scrollZoom.disable()
                        map.current.doubleClickZoom.disable()
                        map.current.touchZoomRotate.disable()
                    }
                }, 1200) // Wait for zoom animation to complete
            }
        }
    }, [drawingPoints, onAreaSelect, onAreaLock])

    const cancelDrawing = useCallback(() => {
        setIsDrawing(false)
        setDrawingPoints([])
        setIsAreaLocked(false) // Unlock when canceling
        onAreaLock?.(false)

        // Clean up preview - CHECK IF THEY EXIST FIRST
        if (map.current && map.current.getSource("polygon-preview")) {
            if (map.current.getLayer("polygon-preview-line")) {
                map.current.removeLayer("polygon-preview-line")
            }
            if (map.current.getLayer("polygon-preview-fill")) {
                map.current.removeLayer("polygon-preview-fill")
            }
            map.current.removeSource("polygon-preview")

            // Reset cursor and re-enable interactions
            map.current.getCanvas().style.cursor = ""
            map.current.dragPan.enable()
            map.current.scrollZoom.enable()
            map.current.doubleClickZoom.enable()
            map.current.touchZoomRotate.enable()
        }

        // Clear markers
        drawingMarkers.current.forEach((marker) => marker.remove())
        drawingMarkers.current = []
    }, [onAreaLock])

    const clearSelection = useCallback(() => {
        setSelectedRegion(null)
        setDrawnPolygon(null)
        setDrawingPoints([])
        setIsAreaLocked(false)
        setSensorData([])
        onAreaSelect?.(null)
        onAreaLock?.(false)

        if (map.current) {
            // Remove all layers and sources
            if (map.current.getLayer("selected-area-fill")) {
                map.current.removeLayer("selected-area-fill")
            }
            if (map.current.getLayer("selected-area-line")) {
                map.current.removeLayer("selected-area-line")
            }
            if (map.current.getLayer("polygon-preview-line")) {
                map.current.removeLayer("polygon-preview-line")
            }
            if (map.current.getLayer("polygon-preview-fill")) {
                map.current.removeLayer("polygon-preview-fill")
            }
            if (map.current.getSource("selected-area")) {
                map.current.removeSource("selected-area")
            }
            if (map.current.getSource("polygon-preview")) {
                map.current.removeSource("polygon-preview")
            }

            // Re-enable map interactions
            map.current.dragPan.enable()
            map.current.scrollZoom.enable()
            map.current.doubleClickZoom.enable()
            map.current.touchZoomRotate.enable()

            // Force map to update
            map.current.triggerRepaint()

            // Move map back to user location or Calgary
            setTimeout(() => {
                if (map.current) {
                    if (userLocation) {
                        map.current.flyTo({
                            center: [userLocation.longitude, userLocation.latitude],
                            zoom: 15,
                            duration: 1500,
                        })
                    } else {
                        map.current.flyTo({
                            center: CALGARY_COORDS,
                            zoom: 10,
                            duration: 1500,
                        })
                    }
                }
            }, 100)
        }

        // Clear markers
        drawingMarkers.current.forEach((marker) => marker.remove())
        drawingMarkers.current = []
    }, [userLocation, onAreaSelect, onAreaLock])

    // Initialize map
    useEffect(() => {
        if (!mapContainer.current || map.current) return

        map.current = new mapboxgl.Map({
            container: mapContainer.current,
            style: isDarkMode ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
            center: CALGARY_COORDS,
            zoom: 10,
        })

        map.current.on("load", () => {
            setIsLoaded(true)
            console.log("🗺️ Map loaded and ready for drawing")
        })

        // Better click handler with more debugging
        map.current.on("click", (e) => {
            console.log("🖱️ Map clicked at:", e.lngLat, "Drawing mode:", isDrawing)

            if (isDrawing) {
                console.log("✅ In drawing mode, adding point...")

                const newPoint: DrawingPoint = {
                    lng: e.lngLat.lng,
                    lat: e.lngLat.lat,
                }

                console.log("📍 New point created:", newPoint)
                addPoint(newPoint)
            } else {
                console.log("❌ Not in drawing mode, ignoring click")
            }
        })

        // Add cursor change for drawing mode
        map.current.on("mouseenter", () => {
            if (isDrawing) {
                map.current!.getCanvas().style.cursor = "crosshair"
            }
        })

        map.current.on("mouseleave", () => {
            map.current!.getCanvas().style.cursor = ""
        })

        return () => {
            if (map.current) {
                map.current.remove()
                map.current = null
            }
        }
    }, [isDrawing, isDarkMode]) // Remove addPoint from dependencies

    // Update sensor data when currentData changes
    useEffect(() => {
        if (currentData && selectedRegion) {
            const newSensorData = convertSerialToSensorData(currentData, selectedRegion)
            setSensorData((prev) => {
                // Keep last 50 readings for the selected area
                const updated = [newSensorData, ...prev.slice(0, 49)]
                return updated
            })
        }
    }, [currentData, selectedRegion])

    // Update heatmap when data changes
    useEffect(() => {
        if (!map.current || !isLoaded || sensorData.length === 0 || !selectedRegion) return

        // Remove existing heatmap layers
        Object.keys(pollutantConfig).forEach((pollutant) => {
            if (map.current!.getLayer(`heatmap-${pollutant}`)) {
                map.current!.removeLayer(`heatmap-${pollutant}`)
            }
            if (map.current!.getSource(`heatmap-${pollutant}`)) {
                map.current!.removeSource(`heatmap-${pollutant}`)
            }
        })

        // Add heatmap layers for visible pollutants
        visibleLayers.forEach((pollutant) => {
            const config = pollutantConfig[pollutant]

            const geojsonData = {
                type: "FeatureCollection" as const,
                features: sensorData.map((point) => ({
                    type: "Feature" as const,
                    properties: {
                        value: point[pollutant],
                    },
                    geometry: {
                        type: "Point" as const,
                        coordinates: [point.longitude, point.latitude],
                    },
                })),
            }

            map.current!.addSource(`heatmap-${pollutant}`, {
                type: "geojson",
                data: geojsonData,
            })

            map.current!.addLayer({
                id: `heatmap-${pollutant}`,
                type: "heatmap",
                source: `heatmap-${pollutant}`,
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
                    "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 3, 15, 25],
                    "heatmap-opacity": 0.8,
                },
            })
        })
    }, [sensorData, visibleLayers, isLoaded, selectedRegion])

    const goToCurrentLocation = useCallback(() => {
        if (userLocation && map.current && !isAreaLocked && !selectedRegion) {
            map.current.flyTo({
                center: [userLocation.longitude, userLocation.latitude],
                zoom: 15,
                duration: 2000,
            })
        } else if (!userLocation) {
            getCurrentLocation()
        }
    }, [userLocation, getCurrentLocation, isAreaLocked, selectedRegion])

    const togglePollutantLayer = (pollutant: PollutantType) => {
        const newLayers = new Set(visibleLayers)
        if (newLayers.has(pollutant)) {
            newLayers.delete(pollutant)
        } else {
            newLayers.add(pollutant)
        }
        setVisibleLayers(newLayers)
    }

    // Lock map to selected area
    useEffect(() => {
        if (map.current && selectedRegion && isAreaLocked) {
            // Disable map interactions when locked to area
            map.current.dragPan.disable()
            map.current.scrollZoom.disable()
            map.current.doubleClickZoom.disable()
            map.current.touchZoomRotate.disable()
        } else if (map.current) {
            // Re-enable map interactions
            map.current.dragPan.enable()
            map.current.scrollZoom.enable()
            map.current.doubleClickZoom.enable()
            map.current.touchZoomRotate.enable()
        }
    }, [selectedRegion, isAreaLocked])

    return (
        <div
            className={`fixed inset-0 z-50 transition-all duration-500 ease-in-out ${isDarkMode ? "bg-gray-900" : "bg-white"}`}
        >
            <div className="w-full h-screen flex gap-4">
                {/* Map Container */}
                <div className="flex-1 relative">
                    <div ref={mapContainer} className="w-full h-full transition-all duration-300 ease-in-out" />

                    {/* Close Button */}
                    <div className="absolute top-4 right-4">
                        <Button
                            onClick={onClose}
                            variant="outline"
                            size="sm"
                            className={`shadow-lg transition-all duration-200 ${isDarkMode
                                ? "bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                                : "bg-white text-black border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Map Controls */}
                    <div className="absolute top-4 left-4 space-y-2">
                        <Button
                            onClick={goToCurrentLocation}
                            variant="outline"
                            className={`shadow-lg transition-all duration-200 ${isDarkMode
                                ? "bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                                : "bg-white text-black border-gray-300 hover:bg-gray-50"
                                }`}
                        >
                            <Navigation className="w-4 h-4 mr-2" />
                            {userLocation ? "Go to Current Location" : "Use Current Location"}
                        </Button>

                        {!isDrawing ? (
                            <Button
                                onClick={startDrawing}
                                variant="outline"
                                className={`shadow-lg transition-all duration-200 ${isDarkMode
                                    ? "bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                                    : "bg-white text-black border-gray-300 hover:bg-gray-50"
                                    }`}
                            >
                                <Pencil className="w-4 h-4 mr-2" />
                                Select Area
                            </Button>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <Badge variant="default" className="bg-orange-600 text-white">
                                    Drawing Mode: Click to add points ({drawingPoints.length} points)
                                </Badge>
                                <div className="flex gap-2">
                                    <Button
                                        onClick={completeDrawing}
                                        disabled={drawingPoints.length < 3}
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white transition-all duration-200"
                                    >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Complete ({drawingPoints.length} points)
                                    </Button>
                                    <Button
                                        onClick={removeLastPoint}
                                        disabled={drawingPoints.length === 0}
                                        size="sm"
                                        variant="outline"
                                        className={`transition-all duration-200 ${isDarkMode
                                            ? "bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                                            : "bg-white text-black border-gray-300 hover:bg-gray-50"
                                            }`}
                                    >
                                        <Undo className="w-4 h-4 mr-1" />
                                        Undo
                                    </Button>
                                    <Button
                                        onClick={cancelDrawing}
                                        variant="outline"
                                        size="sm"
                                        className={`transition-all duration-200 ${isDarkMode
                                            ? "bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                                            : "bg-white text-black border-gray-300 hover:bg-gray-50"
                                            }`}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        )}

                        {(selectedRegion || drawnPolygon) && (
                            <Button
                                onClick={clearSelection}
                                variant="outline"
                                className={`shadow-lg transition-all duration-200 ${isDarkMode
                                    ? "bg-gray-800 text-white border-gray-600 hover:bg-gray-700"
                                    : "bg-white text-black border-gray-300 hover:bg-gray-50"
                                    }`}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Clear Polygon
                            </Button>
                        )}

                        {isAreaLocked && (
                            <Badge variant="default" className="bg-yellow-600 text-white">
                                🔒 Area Locked - Live Data Feed
                            </Badge>
                        )}
                    </div>

                    {/* Status Indicators */}
                    <div className="absolute top-4 right-16 space-y-2">
                        <Badge variant="default" className={`${isRealTime ? "bg-green-600" : "bg-gray-600"} text-white`}>
                            {isRealTime ? <Wifi className="w-3 h-3 mr-1" /> : <WifiOff className="w-3 h-3 mr-1" />}
                            {isRealTime ? "Live Serial Data" : "No Serial Data"}
                        </Badge>

                        {userLocation && (
                            <Badge
                                variant="outline"
                                className={
                                    isDarkMode ? "bg-gray-800 text-white border-gray-600" : "bg-white text-black border-gray-300"
                                }
                            >
                                <MapPin className="w-3 h-3 mr-1" />
                                GPS: ±{userLocation.accuracy.toFixed(0)}m
                            </Badge>
                        )}

                        {drawnPolygon && (
                            <Badge variant="default" className="bg-orange-600 text-white">
                                Polygon: {drawnPolygon.length} vertices
                            </Badge>
                        )}
                    </div>

                    {/* Location Error Alert */}
                    {locationError && (
                        <div className="absolute bottom-4 left-4 right-4">
                            <Alert className={isDarkMode ? "bg-red-900 border-red-700 text-red-100" : "bg-red-50 border-red-200"}>
                                <AlertDescription className={isDarkMode ? "text-red-100" : "text-red-800"}>
                                    {locationError}
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                </div>

                {/* Control Panel */}
                <Card
                    className={`w-80 h-full overflow-y-auto ${isDarkMode ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200"}`}
                >
                    <CardHeader className={`border-b ${isDarkMode ? "border-gray-700" : "border-gray-200"}`}>
                        <CardTitle className={`flex items-center gap-2 ${isDarkMode ? "text-white" : "text-gray-900"}`}>
                            <Layers className="w-5 h-5" />
                            Live Environmental Data
                        </CardTitle>
                    </CardHeader>
                    <CardContent className={`space-y-6 ${isDarkMode ? "text-gray-100" : "text-gray-900"}`}>
                        {/* Serial Data Status */}
                        <div className="space-y-2">
                            <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Serial Connection</h3>
                            <div className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                                <p>Status: {isRealTime ? "🟢 Connected & Logging" : "🔴 Disconnected"}</p>
                                <p>Data Points: {sensorData.length}</p>
                                {currentData?.lat && currentData?.lon && (
                                    <p>
                                        GPS: {currentData.lat.toFixed(6)}, {currentData.lon.toFixed(6)}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Polygon Drawing Instructions */}
                        <div className="space-y-2">
                            <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Polygon Drawing</h3>
                            <div className={`text-sm ${isDarkMode ? "text-gray-300" : "text-gray-600"}`}>
                                {isDrawing ? (
                                    <div className="space-y-1">
                                        <p>• Click on the map to add vertices</p>
                                        <p>• Minimum 3 points required</p>
                                        <p>• Points added: {drawingPoints.length}</p>
                                        <p>• Use "Undo" to remove last point</p>
                                        <p className="text-orange-400">• Orange lines show your polygon</p>
                                    </div>
                                ) : drawnPolygon ? (
                                    <div className="space-y-1">
                                        <p className="text-green-400">✓ Polygon completed with {drawnPolygon.length} vertices</p>
                                        <p className="text-blue-400">🔒 Map locked to selected area</p>
                                        <p className="text-yellow-400">📊 Displaying live serial data...</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <p>1. Click "Draw Polygon" to start</p>
                                        <p>2. Click points on the map to create vertices</p>
                                        <p>3. Click "Complete" when finished (min 3 points)</p>
                                        <p>4. Live data will appear in the polygon area</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Current Readings */}
                        {currentData && (
                            <div className="space-y-2">
                                <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Current Readings</h3>
                                <div className="text-sm space-y-1">
                                    {Object.entries(pollutantConfig).map(([key, config]) => {
                                        const value = currentData[key as keyof SerialData]
                                        return (
                                            <div key={key} className="flex justify-between">
                                                <span>{config.name}:</span>
                                                <span className="font-mono">
                                                    {typeof value === "number" ? value.toFixed(1) : "--"} {config.unit}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Pollutant Layers */}
                        <div className="space-y-3">
                            <h3 className={`font-semibold ${isDarkMode ? "text-white" : "text-gray-900"}`}>Pollutant Layers</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {Object.entries(pollutantConfig).map(([key, config]) => (
                                    <div
                                        key={key}
                                        className={`flex items-center justify-between p-2 border rounded ${isDarkMode ? "border-gray-600" : "border-gray-200"}`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded" style={{ backgroundColor: config.color }} />
                                            <div>
                                                <p className="text-sm font-medium">{config.name}</p>
                                                <p className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>{config.unit}</p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={visibleLayers.has(key as PollutantType)}
                                            onCheckedChange={() => togglePollutantLayer(key as PollutantType)}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Primary Pollutant Selection */}
                        <div className="space-y-2">
                            <Label className={isDarkMode ? "text-white" : "text-gray-900"}>Primary Focus</Label>
                            <Select value={selectedPollutant} onValueChange={(value) => setSelectedPollutant(value as PollutantType)}>
                                <SelectTrigger
                                    className={isDarkMode ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300"}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(pollutantConfig).map(([key, config]) => (
                                        <SelectItem key={key} value={key}>
                                            {config.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Time Range Control */}
                        <div className="space-y-2">
                            <Label className={isDarkMode ? "text-white" : "text-gray-900"}>Time Range (Hours Ago)</Label>
                            <Slider value={timeRange} onValueChange={setTimeRange} max={24} min={0} step={1} className="w-full" />
                            <div className={`text-xs ${isDarkMode ? "text-gray-400" : "text-gray-500"}`}>
                                Showing data from {timeRange[0]} hours ago
                            </div>
                        </div>

                        {/* Data Source Info */}
                        <div
                            className={`text-xs pt-4 border-t ${isDarkMode ? "text-gray-400 border-gray-700" : "text-gray-500 border-gray-200"}`}
                        >
                            <p>Data Source: Live Serial Communication</p>
                            <p>Update Frequency: Real-time</p>
                            <p>Map Provider: Mapbox GL JS</p>
                            <p>Location: {currentData?.lat && currentData?.lon ? "GPS Coordinates" : "Calgary, Alberta"}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
