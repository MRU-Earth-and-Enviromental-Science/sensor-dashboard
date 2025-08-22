import threading
import time
import csv
import io
from datetime import datetime
from flask import Flask, request, jsonify, send_file
import serial
import serial.tools.list_ports
import re

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
    """Robustly parse sensor values from various Arduino/ESP-NOW formatted outputs.

    Supported examples:
      - [ESP-NOW] Data from CC:...: Rs=96852.27 ohms, Temp=27.80°C, Humidity=40.00%, CO2=412
      - [ESP-NOW] Full data from ...: Rs=..., Temp=... C, Hum=... %, CO2=...
      - [ESP-NOW] Temp/Hum from ...: 25.4 C, 40.0 %
      - [ESP-NOW] Resistance (legacy) from ...: 32924.53
      - Plain numeric: 32924.53
    Returns a dict with any of keys: 'resistance', 'temperature', 'humidity', 'co2' or None if nothing found.
    """
    try:
        if not data:
            return None
        s = data.strip()
        # Quick ignore for non-data status lines
        low = s.lower()
        if "waiting for esp-now" in low or "waiting for" in low or "unknown data size" in low:
            return None

        result = {}

        # Try key=value style (Rs=, Temp=, Humidity=, CO2=)
        m_rs = re.search(r'Rs\s*=\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)', s)
        m_temp = re.search(
            r'Temp(?:erature)?\s*=\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)', s, re.IGNORECASE)
        m_hum = re.search(
            r'Humidity\s*=\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)', s, re.IGNORECASE)
        m_co2 = re.search(
            r'CO2\s*(?:=|:)?\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)', s, re.IGNORECASE)
        if m_rs or m_temp or m_hum or m_co2:
            if m_rs:
                result['resistance'] = float(m_rs.group(1))
            if m_temp:
                result['temperature'] = float(m_temp.group(1))
            if m_hum:
                result['humidity'] = float(m_hum.group(1))
            if m_co2:
                try:
                    result['co2'] = float(m_co2.group(1))
                except ValueError:
                    pass
            return result

        # Try patterns like: "Resistance ... 32924.53 ohms"
        m = re.search(
            r'Resistance[^0-9+-]*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)', s, re.IGNORECASE)
        if m:
            result['resistance'] = float(m.group(1))

        # Temperature: "Temp" or "Temperature" followed by number
        m = re.search(
            r'(?:Temp(?:erature)?)\D*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)', s, re.IGNORECASE)
        if m:
            result['temperature'] = float(m.group(1))

        # Humidity: number followed by % or label
        m = re.search(
            r'Humidity\D*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)', s, re.IGNORECASE)
        if m:
            result['humidity'] = float(m.group(1))

        # CO2 ppm pattern (numeric, accept floats)
        m = re.search(
            r'CO2\D*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)', s, re.IGNORECASE)
        if m:
            try:
                result['co2'] = float(m.group(1))
            except ValueError:
                pass

        # If nothing yet, try a single plain float (legacy resistance-only payload)
        if not result:
            m = re.search(r'^\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*$', s)
            if m:
                result['resistance'] = float(m.group(1))

        return result if result else None
    except Exception:
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
                        print(
                            f"Appended to log (total={len(logged_data)}): {data_point}")
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
    try:
        output = io.StringIO()
        # Build a stable list of fieldnames as the union of all keys in logged_data
        fieldnames = []
        for row in logged_data:
            for k in row.keys():
                if k not in fieldnames:
                    fieldnames.append(k)

        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(logged_data)
        output.seek(0)
        data_bytes = output.getvalue().encode('utf-8')
        print(f"Exporting CSV: rows={len(logged_data)}, fields={fieldnames}")
        return send_file(io.BytesIO(data_bytes), mimetype='text/csv', as_attachment=True, download_name=f'serial-data-{datetime.utcnow().date()}.csv')
    except Exception as e:
        print(f"CSV export error: {e}")
        return jsonify({'success': False, 'error': str(e)})


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
