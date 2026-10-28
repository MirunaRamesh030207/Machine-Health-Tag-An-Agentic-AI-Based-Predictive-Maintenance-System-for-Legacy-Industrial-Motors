const express = require("express");
const cors = require("cors");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SERIAL_PORT = process.env.SERIAL_PORT || "COM9";
const BAUD_RATE = Number(process.env.BAUD_RATE || 9600);
const CURRENT_BASELINE = 506.6;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let latestReading = null;
let lastSerialAt = null;
let serialStatus = "not_started";
let serialError = null;
let lastRawLine = "";

function classify(current, vibration) {
  const currentDeviation = Math.abs(current - CURRENT_BASELINE) / CURRENT_BASELINE * 100;

  if (vibration >= 0.020 || currentDeviation >= 15) {
    return { label: "FAULT", severity: "danger", recommendation: "Stop the machine safely and inspect the motor, load and mounting." };
  }
  if (vibration >= 0.007 || currentDeviation >= 8) {
    return { label: "WARNING", severity: "warning", recommendation: "Check for unusual vibration, changing load, loose mounting or sensor movement." };
  }
  return { label: "NORMAL", severity: "normal", recommendation: "Machine readings are within the prototype's configured baseline range." };
}

function handleSerialLine(line) {
  lastRawLine = line;
  try {
    const data = JSON.parse(line);
    const current = Number(data.current);
    const vibration = Number(data.vibration);
    if (!Number.isFinite(current) || !Number.isFinite(vibration)) {
      throw new Error("JSON must contain numeric current and vibration fields");
    }

    const result = classify(current, vibration);
    latestReading = {
      current_adc: Number(current.toFixed(2)),
      vibration_g: Number(vibration.toFixed(4)),
      current_baseline_adc: CURRENT_BASELINE,
      current_deviation_pct: Number((Math.abs(current - CURRENT_BASELINE) / CURRENT_BASELINE * 100).toFixed(2)),
      label: result.label,
      severity: result.severity,
      recommendation: result.recommendation,
      device_condition: String(data.condition || result.label).toUpperCase(),
      timestamp: new Date().toISOString(),
      source: "serial"
    };
    lastSerialAt = new Date().toISOString();
  } catch (error) {
    console.warn("Skipping invalid serial line:", line, "-", error.message);
  }
}

try {
  const serial = new SerialPort({
    path: SERIAL_PORT,
    baudRate: BAUD_RATE,
    autoOpen: false
  });
  const parser = serial.pipe(new ReadlineParser({ delimiter: "\n" }));

  serial.open((error) => {
    if (error) {
      serialStatus = "disconnected";
      serialError = error.message;
      console.error(`Could not open ${SERIAL_PORT}: ${error.message}`);
      console.error("Check the Arduino connection, COM port, and that Serial Monitor is closed.");
      return;
    }
    serialStatus = "connected";
    serialError = null;
    console.log(`Serial connected: ${SERIAL_PORT} at ${BAUD_RATE} baud`);
  });

  serial.on("error", (error) => {
    serialStatus = "disconnected";
    serialError = error.message;
    console.error("Serial error:", error.message);
  });
  serial.on("close", () => {
    serialStatus = "disconnected";
    console.warn("Serial connection closed.");
  });
  parser.on("data", (line) => handleSerialLine(line.trim()));
} catch (error) {
  serialStatus = "disconnected";
  serialError = error.message;
  console.error("Serial setup failed:", error.message);
}

app.get("/api/machine", (req, res) => {
  res.json({
    connected: serialStatus === "connected",
    serial_port: SERIAL_PORT,
    baud_rate: BAUD_RATE,
    serial_status: serialStatus,
    serial_error: serialError,
    last_serial_at: lastSerialAt,
    reading: latestReading
  });
});

app.get("/api/ai", (req, res) => {
  if (!latestReading) {
    return res.status(503).json({
      available: false,
      model: "Rule-based prototype validation",
      message: "Waiting for valid sensor data from the Arduino."
    });
  }

  res.json({
    available: true,
    model: "Rule-based prototype validation",
    note: "This endpoint currently uses configured thresholds. A trained Decision Tree model must be trained and integrated before claiming ML predictions.",
    prediction: latestReading.label,
    severity: latestReading.severity,
    recommendation: latestReading.recommendation,
    inputs: {
      current_adc: latestReading.current_adc,
      vibration_g: latestReading.vibration_g,
      current_deviation_pct: latestReading.current_deviation_pct
    },
    timestamp: latestReading.timestamp
  });
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "Machine Health Tag API", time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Machine Health Tag dashboard: http://localhost:${PORT}`);
  console.log(`Expected Arduino serial port: ${SERIAL_PORT} (${BAUD_RATE} baud)`);
});
