# Machine Health Tag — complete reconstructed project

This folder contains a complete working baseline for the Machine Health Tag IoT prototype:
- Arduino Uno + MPU6050 vibration sensor + analog current sensor + 16x2 LCD
- Node.js/Express backend reading JSON lines from the Arduino serial port
- Browser dashboard with live readings, status, recommendations, and connection details
- API endpoints: `/api/machine`, `/api/ai`, `/api/health`

**Important:** This is a reconstructed implementation based on the project architecture/settings we recovered, not the exact lost original source. The `/api/ai` endpoint currently performs rule-based prototype validation. A trained Decision Tree model is planned but is not included or claimed to be trained here.

## 1. Wiring assumed by the Arduino sketch

- Current sensor analog output -> Arduino A0
- MPU6050 -> 5V/3.3V as required by your specific breakout board, GND, SDA -> A4, SCL -> A5
- 16x2 LCD in 4-bit parallel mode:
  - RS -> D13
  - E -> D12
  - D4 -> D11
  - D5 -> D10
  - D6 -> D9
  - D7 -> D8
  - LCD VSS -> GND, VDD -> suitable supply, RW -> GND, VO -> contrast potentiometer
- Confirm wiring against your actual hardware before powering it. The LCD pin mapping may need to be adjusted to match the wiring you already built.

## 2. Arduino setup

1. Open `arduino/MachineHealthTag.ino` in Arduino IDE.
2. Select **Arduino Uno** and the correct COM port.
3. Upload the sketch.
4. The sketch sends one JSON line per second at **9600 baud**.
5. After uploading, close Arduino Serial Monitor. The Node.js backend needs exclusive access to the COM port.

Example serial line:
```json
{"current":506.60,"vibration":0.0062,"condition":"NORMAL"}
```

## 3. Start the dashboard/backend on Windows

Install Node.js first if needed. Open Command Prompt in this project folder and run:

```bat
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

The default serial port is `COM9`. If your Arduino uses another port, set it before starting the server:

**Command Prompt**
```bat
set SERIAL_PORT=COM9
npm start
```

Change `COM9` to the port shown in Arduino IDE. The default baud rate is 9600.

## 4. API endpoints

- `GET /api/machine` — serial connection state and latest sensor reading
- `GET /api/ai` — current rule-based prototype assessment (not a trained ML prediction)
- `GET /api/health` — backend health check

## 5. Calibrate before demonstrations

`CURRENT_BASELINE = 506.6` and the vibration/current thresholds are prototype settings based on earlier sample readings. Sensor type, mounting, motor load, and ADC calibration can change readings. Collect labelled normal and abnormal samples and validate thresholds before making any real machine-safety decisions. Do not use this prototype as a certified industrial protection system.

## Troubleshooting

- **Port busy:** Close Arduino Serial Monitor and any other program using the COM port.
- **Port not found:** Check Device Manager / Arduino IDE and set `SERIAL_PORT`.
- **Dashboard loads but says offline:** Backend may be running but serial failed; read the terminal error.
- **No sensor values:** Confirm sketch uploaded, baud is 9600, and serial output is valid JSON.
- **MPU6050 error/zero-like readings:** Verify I2C wiring and address `0x68`; some boards use different configurations.
