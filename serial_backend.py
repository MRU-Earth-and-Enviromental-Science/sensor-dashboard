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

# Util: parse serial data (replicates JS logic)


def parse_multiline_serial_data(data):
    result = {}

    # Split data into lines
    lines = data.strip().split('\n')
    for line in lines:
        # Remove any leading/trailing spaces
        line = line.strip()
        # Skip empty lines
        if not line:
            continue
        # Split line by commas
        parts = line.split(',')
        for part in parts:
            if ':' not in part:
                continue
            key, value = part.split(':', 1)
            key = key.strip().lower().replace('.', '_').replace(' ', '_')
            value = value.strip()
            # Convert value to number if possible
            try:
                if '.' in value:
                    result[key] = float(value)
                else:
                    result[key] = int(value)
            except ValueError:
                result[key] = value

    # Optional: map keys if needed (e.g., pm1_0 → pm_1_0)
    key_map = {
        'temp': 'temp',
        'humid': 'humid',
        'ch4': 'ch4',
        'co2': 'co2',
        'tvoc': 'tvoc',
        'co': 'co',
        'nox': 'nox',
        'pm1_0': 'pm_1_0',
        'pm2_5': 'pm_2_5',
        'pm10_0': 'pm_10_0',
        'lat': 'lat',
        'lon': 'lon',
    }
    mapped = {}
    for k, v in result.items():
        if k in key_map:
            mapped[key_map[k]] = v

    mapped['raw'] = data
    return mapped


def serial_read_loop():
    global serial_running, serial_port, is_logging, logged_data, latest_data
    buffer_lines = []
    expected_lines_per_block = 3  # Adjust if your data blocks have different length

    while serial_running:
        with serial_thread_lock:
            port = serial_port
        if not port or not port.is_open:
            break
        try:
            line = port.readline().decode(errors='ignore').strip()
            if line:
                buffer_lines.append(line)

                if len(buffer_lines) >= expected_lines_per_block:
                    full_data = '\n'.join(buffer_lines)
                    timestamp = datetime.utcnow().isoformat()
                    parsed = parse_multiline_serial_data(full_data)
                    data_point = {
                        'timestamp': timestamp,
                        'raw': full_data,
                        **parsed,
                        'last_update': time.time()
                    }
                    latest_data = data_point
                    if is_logging:
                        logged_data.append(data_point)
                    buffer_lines = []  # Clear buffer for next block
        except Exception as e:
            print(f"Serial read error: {e}")
            break
        time.sleep(0.01)
    print("Serial read thread exited.")


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
    print(f"Trying to open port: {port} at {baudrate} baud")
    try:
        do_disconnect()  # Use helper, not Flask route
        with serial_thread_lock:
            serial_port = serial.Serial(port, baudrate, timeout=1)
        serial_running = True
        serial_thread = threading.Thread(target=serial_read_loop, daemon=True)
        serial_thread.start()
        print("Serial port opened successfully. connect button pressed")
        return jsonify({'success': True})
    except Exception as e:
        print(f"Failed to open serial port: {e}")
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
