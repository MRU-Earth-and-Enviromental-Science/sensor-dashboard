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


def parse_serial_data(data):
    result = {}
    clean_data = data.replace('[ESP-NOW] RX', '').strip()
    parts = clean_data.split()
    for part in parts:
        if ':' in part:
            key, value = part.split(':', 1)
            clean_key = key.strip().lower()
            clean_value = value.strip()
            if clean_value in ['nan', 'inf', '-inf']:
                result[clean_key] = None
            else:
                try:
                    num_value = float(clean_value)
                    result[clean_key] = num_value
                except ValueError:
                    result[clean_key] = clean_value
    # Map keys to frontend expected keys
    mapped = {}
    if 't' in result:
        mapped['temp'] = result['t']
    if 'h' in result:
        mapped['humid'] = result['h']
    if 'ch4' in result:
        mapped['ch4'] = result['ch4']
    if 'co2' in result:
        mapped['co2'] = result['co2']
    if 'tvoc' in result:
        mapped['tvoc'] = result['tvoc']
    if 'co' in result:
        mapped['co'] = result['co']
    if 'nox' in result:
        mapped['nox'] = result['nox']
    if 'pm1.0' in result:
        mapped['pm_1_0'] = result['pm1.0']
    if 'pm2.5' in result:
        mapped['pm_2_5'] = result['pm2.5']
    if 'pm10.0' in result:
        mapped['pm_10_0'] = result['pm10.0']
    if 'lat' in result:
        mapped['lat'] = result['lat']
    if 'lon' in result:
        mapped['lon'] = result['lon']
    mapped['raw'] = data
    return mapped

# Serial reading thread


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
                timestamp = datetime.utcnow().isoformat()
                parsed = parse_serial_data(line)
                data_point = {'timestamp': timestamp, 'raw': line, **parsed}
                latest_data = data_point  # Save latest data for polling
                if is_logging:
                    logged_data.append(data_point)
        except Exception as e:
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
