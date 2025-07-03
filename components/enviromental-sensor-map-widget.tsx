"use client"

import { useState } from "react"
import { EnvironmentalSensorMapPreview } from "./environmental-sensor-map-preview"
import { EnvironmentalSensorMapFull } from "./environmental-sensor-map-full"
import type { LngLatBounds } from "mapbox-gl"


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

export interface EnvironmentalSensorMapWidgetProps {
    className?: string
    defaultPollutant?: string
    showPreview?: boolean
    currentData?: SerialData | null
    isRealTime?: boolean
    isDarkMode?: boolean
}

export function EnvironmentalSensorMapWidget({
    className = "",
    defaultPollutant = "pm_2_5",
    showPreview = true,
    currentData = null,
    isRealTime = false,
    isDarkMode = false,
}: EnvironmentalSensorMapWidgetProps) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [isTransitioning, setIsTransitioning] = useState(false)
    const [selectedPollutant, setSelectedPollutant] = useState(defaultPollutant)
    const [selectedArea, setSelectedArea] = useState<LngLatBounds | null>(null)
    const [isAreaLocked, setIsAreaLocked] = useState(false)

    const handleExpand = () => {
        setIsTransitioning(true)
        setTimeout(() => {
            setIsExpanded(true)
            setIsTransitioning(false)
        }, 300)
    }

    const handleClose = () => {
        setIsTransitioning(true)
        setTimeout(() => {
            setIsExpanded(false)
            setIsTransitioning(false)
        }, 300)
    }

    if (isExpanded) {
        return (
            <div
                className={`transition-all duration-300 ease-in-out ${isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
            >
                <EnvironmentalSensorMapFull
                    onClose={handleClose}
                    defaultPollutant={selectedPollutant}
                    currentData={currentData}
                    isRealTime={isRealTime}
                    isDarkMode={isDarkMode}
                    // forge.config.js

                    onAreaLock={setIsAreaLocked}
                />
            </div>
        )
    }

    if (showPreview) {
        return (
            <div
                className={`${className} transition-all duration-300 ease-in-out ${isTransitioning ? "opacity-0 scale-105" : "opacity-100 scale-100"}`}
            >
                <EnvironmentalSensorMapPreview
                    onExpand={handleExpand}
                    selectedPollutant={selectedPollutant}
                    onPollutantChange={setSelectedPollutant}
                    currentData={currentData}
                    isRealTime={isRealTime}
                    isDarkMode={isDarkMode}
                    selectedArea={selectedArea}
                    isAreaLocked={isAreaLocked}
                />
            </div>
        )
    }

    return (
        <div
            className={`transition-all duration-300 ease-in-out ${isTransitioning ? "opacity-0 scale-95" : "opacity-100 scale-100"}`}
        >
            <EnvironmentalSensorMapFull
                onClose={handleClose}
                defaultPollutant={selectedPollutant}
                currentData={currentData}
                isRealTime={isRealTime}
                isDarkMode={isDarkMode}
                onAreaSelect={setSelectedArea}
                onAreaLock={setIsAreaLocked}
            />
        </div>
    )
}
