const $ = (id) => document.getElementById(id);

function setStatePill(id, label, type) {
  const el = $(id);
  el.textContent = label;
  el.className = "metric-state" + (type ? ` ${type}` : "");
}
function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function statusType(label) {
  if (label === "NORMAL") return "good";
  if (label === "WARNING") return "warn";
  if (label === "FAULT") return "bad";
  return "";
}
function applyReading(reading) {
  if (!reading) return;
  const current = Number(reading.current_adc);
  const vibration = Number(reading.vibration_g);
  const deviation = Number(reading.current_deviation_pct || 0);
  const label = String(reading.label || "UNKNOWN").toUpperCase();
  const type = statusType(label);

  $("currentValue").textContent = Number.isFinite(current) ? current.toFixed(1) : "--";
  $("vibrationValue").textContent = Number.isFinite(vibration) ? vibration.toFixed(4) : "--";
  $("deviationValue").textContent = `${deviation.toFixed(2)}%`;
  $("baselineValue").textContent = `${Number(reading.current_baseline_adc || 506.6).toFixed(1)} ADC`;
  $("currentMeter").style.width = `${Math.min(100, deviation * 4)}%`;
  $("vibrationMeter").style.width = `${Math.min(100, vibration / 0.04 * 100)}%`;
  setStatePill("currentState", deviation >= 15 ? "HIGH DEVIATION" : deviation >= 8 ? "CHECK" : "STABLE", deviation >= 15 ? "bad" : deviation >= 8 ? "warn" : "good");
  setStatePill("vibrationState", vibration >= 0.020 ? "HIGH" : vibration >= 0.007 ? "ELEVATED" : "STABLE", vibration >= 0.020 ? "bad" : vibration >= 0.007 ? "warn" : "good");

  $("machineStatus").textContent = label;
  $("statusCaption").textContent = label === "NORMAL" ? "Readings within configured range" : label === "WARNING" ? "Unusual reading detected" : label === "FAULT" ? "Inspect machine before continuing" : "Status unavailable";
  $("statusRing").className = `status-ring ${label === "WARNING" ? "warning" : label === "FAULT" ? "danger" : ""}`;
  $("statusSymbol").textContent = label === "NORMAL" ? "✓" : label === "WARNING" ? "!" : label === "FAULT" ? "×" : "•";
  $("assessmentIndicator").className = `assessment-indicator ${type}`;
  $("assessmentTitle").textContent = label === "NORMAL" ? "Machine readings look stable" : label === "WARNING" ? "Attention recommended" : label === "FAULT" ? "Abnormal readings detected" : "Status unavailable";
  $("assessmentText").textContent = `Current deviation is ${deviation.toFixed(2)}% from the configured baseline. Vibration is ${vibration.toFixed(4)} g.`;
  $("recommendationText").textContent = reading.recommendation || "Review sensor readings and inspect the machine if abnormal values persist.";
  $("dataSource").textContent = reading.source === "serial" ? "Arduino serial" : (reading.source || "Sensor data");
  $("sensorTime").textContent = formatTime(reading.timestamp);
  $("lastUpdated").textContent = `Last reading · ${formatTime(reading.timestamp)}`;
}
function setConnection(connected, data) {
  $("connectionText").textContent = connected ? "Arduino connected" : "Arduino disconnected";
  $("connectionPill").querySelector(".pulse").className = `pulse ${connected ? "online" : ""}`;
  $("sidePulse").className = `pulse ${connected ? "online" : ""}`;
  $("sideConnection").textContent = connected ? "Device connected" : "Device offline";
  $("sidePort").textContent = `${data.serial_port || "COM9"} · ${data.baud_rate || 9600} baud`;
  $("portValue").textContent = data.serial_port || "COM9";
  $("baudValue").textContent = data.baud_rate || 9600;
  $("arduinoBadge").textContent = connected ? "CONNECTED" : "OFFLINE";
  $("arduinoBadge").className = `device-badge ${connected ? "online" : ""}`;
  if (data.serial_error) {
    $("connectionError").textContent = `Serial connection issue: ${data.serial_error}. Check the port and close Arduino Serial Monitor.`;
    $("connectionError").className = "error-message error";
  } else if (!connected) {
    $("connectionError").textContent = "Connect the Arduino, confirm its COM port, and close Arduino Serial Monitor so Node.js can use the port.";
    $("connectionError").className = "error-message";
  } else {
    $("connectionError").textContent = "Serial link active. Waiting for valid sensor readings if no values are displayed.";
    $("connectionError").className = "error-message";
  }
}
async function refresh() {
  try {
    const response = await fetch("/api/machine", { cache: "no-store" });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const data = await response.json();
    setConnection(data.connected, data);
    if (data.reading) applyReading(data.reading);
    else {
      $("machineStatus").textContent = "WAITING";
      $("statusCaption").textContent = "Waiting for valid sensor data";
    }
    $("apiBadge").textContent = "ONLINE";
    $("apiBadge").className = "device-badge online";
  } catch (error) {
    $("connectionText").textContent = "API unavailable";
    $("sideConnection").textContent = "API unavailable";
    $("connectionPill").querySelector(".pulse").className = "pulse";
    $("apiBadge").textContent = "OFFLINE";
    $("apiBadge").className = "device-badge";
    $("connectionError").textContent = `Could not reach the backend: ${error.message}. Start the server with npm start.`;
    $("connectionError").className = "error-message error";
  }
}
refresh();
setInterval(refresh, 2000);
