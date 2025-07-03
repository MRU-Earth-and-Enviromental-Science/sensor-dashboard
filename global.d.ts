export {};

declare global {

    interface SerialData {
        timestamp: string;
        raw: string;
        temp?: number;
        humid?: number;
        ch4?: number;
        co2?: number;
        tvoc?: number;
        co?: number;
        nox?: number;
        pm_1_0?: number;
        pm_2_5?: number;
        pm_10_0?: number;
        lat?: number;
        lon?: number;
    }
    interface ElectronAPI {
        getSerialPorts: () => Promise<SerialPort[]>;
        connectSerial: (port: string, baudRate: string) => Promise<{ success: boolean; error?: string }>;
        disconnectSerial: () => Promise<void>;
        startLogging: () => Promise<{ success: boolean; error?: string }>;
        stopLogging: () => Promise<{ success: boolean; error?: string }>;
        exportCSV: () => Promise<{ success: boolean; error?: string }>;
        onSerialData: (callback: (event: any, data: SerialData) => void) => void;
        onSerialStatus: (callback: (event: any, status: { connected: boolean; port?: string }) => void) => void;
        onSerialError: (callback: (event: any, error: string) => void) => void;
        removeAllListeners: (channel: string) => void;
        getIpLocation: () => Promise<{
            success: boolean;
            latitude?: number;
            longitude?: number;
            city?: string;
            region?: string;
            country?: string;
            accuracy?: number;
            method?: string;
            error?: string;
        }>;
    }

    interface Window {
        electronAPI: ElectronAPI;
    }
}