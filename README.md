# 🌡️ Environmental Sensor Dashboard

A cross-platform desktop application for monitoring environmental sensor data with real-time visualization and data logging capabilities. This repoistory is a submodule for the Low-Cost-Sensors repoistory and is meant to be used in tandem which can be found [here](https://github.com/MRU-Earth-and-Enviromental-Science/Low-Cost-Sensors). The project was developed with [v0.dev](https://v0.app/) for the front-end using **React** and **TypeScript** and a **Python** backend to read the serial monitor.

## Features

- **Real-time data visualization** - Monitor sensor data with live charts and graphs
- **Serial port communication** - Connect environmental sensors via USB/Serial
- **Interactive charts** - Zoom, pan, and analyze your data
- **Data logging & export** - Save and export data in CSV format
- **Cross-platform** - Works on macOS, Windows, and Linux
- **No setup required** - Python backend fully bundled
- **Dark/Light themes** - Choose your preferred interface
- **Auto-builds** - Automatically builds for all platforms via GitHub Actions

## 📥 Download & Install

### [📦 Download Latest Release](https://github.com/MRU-Earth-and-Enviromental-Science/sensor-dashboard/releases/latest)

#### For macOS:
- **Intel Macs** (2020 and earlier): Download the `.dmg` file without `-arm64`
- **Apple Silicon Macs** (M1/M2/M3): Download the `-arm64.dmg` file

#### For Windows:
- **Installer** (recommended): Download the `Setup.exe` file
- **Portable**: Download the standalone `.exe` file

## 🚀 Quick Start

1. **Download** the appropriate file for your system
2. **Install** the application:
   - **Mac**: Open DMG, drag to Applications, right-click → "Open" on first run
   - **Windows**: Run the installer or portable executable
3. **Connect** your environmental sensor via USB
4. **Launch** the application
5. **Select** your serial port and start monitoring!

## Supported Sensors

The dashboard works with environmental sensors that output data via serial communication, including:
- Temperature and humidity sensors
- Air quality monitors
- Weather stations
- Custom sensor configurations
- Arduino/ESP32 based sensor arrays

## 📋 System Requirements

- **macOS**: 10.13 or later
- **Windows**: 7 or later
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **USB port** for sensor connectivity

## 🛠️ Development

To build from source:

```bash
# Clone the repository
git clone https://github.com/MRU-Earth-and-Enviromental-Science/sensor-dashboard.git
cd sensor-dashboard

# Install dependencies
npm install

# Set up Python environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Development mode
npm run electron-dev

# Build for distribution
npm run dist-mac    # macOS
npm run dist-win    # Windows
npm run dist-linux  # Linux
```

## 📞 Support

- 🐛 **Report Issues**: [GitHub Issues](https://github.com/MRU-Earth-and-Enviromental-Science/sensor-dashboard/issues)
- **Contact**
   - [shivamwalia2006 [at] gmail [dot] com](mailto:shivamwalia2006@gmail.com)
   - [gosullivan [at] mtroyal [dot] ca](mailto:gosullivan@mtroyal.ca)
---
