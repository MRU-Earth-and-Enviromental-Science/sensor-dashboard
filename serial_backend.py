import threading
import time
import csv
import io
from datetime import datetime
from flask import Flask, request, jsonify, send_file
import serial
import serial.tools.list_ports

app = Flask(__name__)

serial_port = None
serial_thread = None
serial_running = False
is_logging = False
logged_data = []
serial_thread_lock = threading.Lock()
latest_data = {}

# Util: parse sensor data from Arduino


def parse_sensor_data(data):
    """Parse sensor values from ESP-NOW formatted output"""
    try:
        result = {}

        # Handle new ESP-NOW format: "[ESP-NOW] Data from CC:7B:5C:97:46:7C: Rs=96852.27 ohms, Temp=27.80°C, Humidity=40.00%"
        if "Data from" in data and ("Rs=" in data or "Temp=" in data):
            # Split by comma to get individual sensor values
            parts = data.split(",")
            for part in parts:
                part = part.strip()
                if "Rs=" in part and "ohms" in part:
                    # Extract resistance value
                    resistance_part = part.split(
                        "Rs=")[1].replace("ohms", "").strip()
                    result['resistance'] = float(resistance_part)
                elif "Temp=" in part and "°C" in part:
                    # Extract temperature value
                    temp_part = part.split(
                        "Temp=")[1].replace("°C", "").strip()
                    result['temperature'] = float(temp_part)
                elif "Humidity=" in part and "%" in part:
                    # Extract humidity value
                    humidity_part = part.split("Humidity=")[
                        1].replace("%", "").strip()
                    result['humidity'] = float(humidity_part)

        # Handle ESP-NOW format for resistance: "[ESP-NOW] Resistance from CC:7B:5C:97:46:7C: 32924.53 ohms"
        elif "Resistance from" in data and "ohms" in data:
            parts = data.split(":")
            if len(parts) >= 2:
                resistance_part = parts[-1].replace("ohms", "").strip()
                resistance_value = float(resistance_part)
                result['resistance'] = resistance_value

        # Handle ESP-NOW format for temperature: "[ESP-NOW] Temperature from CC:7B:5C:97:46:7C: 25.4 °C"
        elif "Temperature from" in data and "°C" in data:
            parts = data.split(":")
            if len(parts) >= 2:
                temp_part = parts[-1].replace("°C", "").strip()
                temp_value = float(temp_part)
                result['temperature'] = temp_value

        # Handle combined data format: "Resistance: 32924.53 ohms, Temperature: 25.4 °C"
        elif "Resistance:" in data and "Temperature:" in data:
            # Split by comma to get both values
            parts = data.split(",")
            for part in parts:
                part = part.strip()
                if "Resistance:" in part and "ohms" in part:
                    resistance_part = part.split(
                        ":")[1].replace("ohms", "").strip()
                    result['resistance'] = float(resistance_part)
                elif "Temperature:" in part and "°C" in part:
                    temp_part = part.split(":")[1].replace("°C", "").strip()
                    result['temperature'] = float(temp_part)

        # Fallback: try to parse as simple float (for backward compatibility)
        else:
            try:
                value = float(data.strip())
                # Default to resistance for backward compatibility
                result['resistance'] = value
            except ValueError:
                pass

        return result if result else None
    except ValueError:
        # If parsing fails, return None
        return None


def serial_read_loop():
    global serial_running, serial_port, is_logging, logged_data, latest_data

    while serial_running:
        with serial_thread_lock:
            port = serial_port
        if not port or not port.is_open:
            break
        try:
            line = port.readline().decode(errors='ignore').strip()
            if line:
                print(f"Raw incoming data: {line}")
                # Parse sensor data from each line
                parsed = parse_sensor_data(line)
                if parsed:  # Only process if parsing was successful
                    print(f"Parsed data: {parsed}")
                    timestamp = datetime.utcnow().isoformat()
                    data_point = {
                        'timestamp': timestamp,
                        'raw': line,
                        **parsed,
                        'last_update': time.time()
                    }
                    print(f"Data point created: {data_point}")
                    latest_data = data_point
                    if is_logging:
                        logged_data.append(data_point)
                else:
                    print(f"Failed to parse data: {line}")
        except Exception as e:
            break
        time.sleep(0.01)


@app.route('/serial/ports', methods=['GET'])
def list_ports():
    ports = serial.tools.list_ports.comports()
    return jsonify([{'path': p.device, 'description': p.description} for p in ports])


@app.route('/serial/connect', methods=['POST'])
def connect_serial():
    global serial_port, serial_thread, serial_running
    data = request.json
    port = data.get('port')
    baudrate = int(data.get('baudrate', 9600))
    try:
        do_disconnect()  # Use helper, not Flask route
        with serial_thread_lock:
            serial_port = serial.Serial(port, baudrate, timeout=1)
        serial_running = True
        serial_thread = threading.Thread(target=serial_read_loop, daemon=True)
        serial_thread.start()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)})


@app.route('/serial/disconnect', methods=['POST'])
def disconnect_serial():
    do_disconnect()
    return jsonify({'success': True})


@app.route('/serial/log/start', methods=['POST'])
def start_logging():
    global is_logging, logged_data
    is_logging = True
    logged_data = []
    return jsonify({'success': True})


@app.route('/serial/log/stop', methods=['POST'])
def stop_logging():
    global is_logging
    is_logging = False
    return jsonify({'success': True, 'dataCount': len(logged_data)})


@app.route('/serial/log/export', methods=['GET'])
def export_csv():
    if not logged_data:
        return jsonify({'success': False, 'error': 'No data to export'})
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=logged_data[0].keys())
    writer.writeheader()
    writer.writerows(logged_data)
    output.seek(0)
    return send_file(io.BytesIO(output.getvalue().encode()), mimetype='text/csv', as_attachment=True, download_name=f'serial-data-{datetime.utcnow().date()}.csv')


@app.route('/serial/log/data', methods=['GET'])
def get_logged_data():
    return jsonify(logged_data)


@app.route('/serial/log/count', methods=['GET'])
def get_logged_count():
    return jsonify({'count': len(logged_data), 'isLogging': is_logging})


@app.route('/serial/latest', methods=['GET'])
def get_latest():
    return jsonify(latest_data)


def do_disconnect():
    global serial_port, serial_running
    serial_running = False
    with serial_thread_lock:
        if serial_port and serial_port.is_open:
            try:
                serial_port.close()
            except Exception:
                pass
        serial_port = None


if __name__ == '__main__':
    app.run(port=5001, host='127.0.0.1')
