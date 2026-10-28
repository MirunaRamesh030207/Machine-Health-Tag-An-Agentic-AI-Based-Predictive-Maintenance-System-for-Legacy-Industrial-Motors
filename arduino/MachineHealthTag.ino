#include <Wire.h>
#include <LiquidCrystal.h>

// LCD wiring uses digital pins 8–13:
// RS=13, E=12, D4=11, D5=10, D6=9, D7=8
LiquidCrystal lcd(13, 12, 11, 10, 9, 8);

const int CURRENT_SENSOR_PIN = A0;
const float CURRENT_BASELINE = 506.6;

// Prototype thresholds; calibrate with real labelled machine data.
const float VIBRATION_WARNING = 0.007;
const float VIBRATION_FAULT = 0.020;
const float CURRENT_WARNING_PERCENT = 8.0;
const float CURRENT_FAULT_PERCENT = 15.0;

int16_t accelX, accelY, accelZ;
bool mpuReady = false;
unsigned long lastRead = 0;

void writeMpuRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(0x68);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

bool readMpuAcceleration(float &ax, float &ay, float &az) {
  Wire.beginTransmission(0x68);
  Wire.write(0x3B); // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;

  uint8_t received = Wire.requestFrom((uint8_t)0x68, (uint8_t)6, (uint8_t)true);
  if (received != 6) return false;

  accelX = (Wire.read() << 8) | Wire.read();
  accelY = (Wire.read() << 8) | Wire.read();
  accelZ = (Wire.read() << 8) | Wire.read();

  // MPU6050 default accelerometer range is +/-2g (16384 LSB/g).
  ax = accelX / 16384.0;
  ay = accelY / 16384.0;
  az = accelZ / 16384.0;
  return true;
}

float readCurrentAverage() {
  long total = 0;
  const int samples = 40;
  for (int i = 0; i < samples; i++) {
    total += analogRead(CURRENT_SENSOR_PIN);
    delay(2);
  }
  return (float)total / samples;
}

float readVibration() {
  float ax, ay, az;
  if (!readMpuAcceleration(ax, ay, az)) return -1.0;

  // Simple prototype vibration indicator: acceleration magnitude variation
  // from 1g. This is not a calibrated industrial vibration measurement.
  float magnitude = sqrt(ax * ax + ay * ay + az * az);
  return abs(magnitude - 1.0);
}

String classifyCondition(float current, float vibration) {
  float currentDeviation = abs(current - CURRENT_BASELINE) / CURRENT_BASELINE * 100.0;

  if (vibration >= VIBRATION_FAULT || currentDeviation >= CURRENT_FAULT_PERCENT) {
    return "FAULT";
  }
  if (vibration >= VIBRATION_WARNING || currentDeviation >= CURRENT_WARNING_PERCENT) {
    return "WARNING";
  }
  return "NORMAL";
}

void printJson(float current, float vibration, String condition) {
  Serial.print("{\"current\":");
  Serial.print(current, 2);
  Serial.print(",\"vibration\":");
  Serial.print(vibration, 4);
  Serial.print(",\"condition\":\"");
  Serial.print(condition);
  Serial.println("\"}");
}

void showLcd(float current, float vibration, String condition) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("I:");
  lcd.print(current, 1);
  lcd.print(" V:");
  if (vibration >= 0) lcd.print(vibration, 3);
  else lcd.print("ERR");

  lcd.setCursor(0, 1);
  lcd.print("Status: ");
  lcd.print(condition);
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  lcd.begin(16, 2);

  // Wake MPU6050 from sleep mode.
  Wire.beginTransmission(0x68);
  Wire.write(0x6B);
  Wire.write(0);
  mpuReady = (Wire.endTransmission() == 0);

  lcd.setCursor(0, 0);
  lcd.print("Machine Health");
  lcd.setCursor(0, 1);
  lcd.print("Starting...");
  delay(1200);
}

void loop() {
  if (millis() - lastRead < 1000) return;
  lastRead = millis();

  float current = readCurrentAverage();
  float vibration = mpuReady ? readVibration() : -1.0;

  String condition;
  if (vibration < 0) {
    condition = "SENSOR_ERR";
  } else {
    condition = classifyCondition(current, vibration);
  }

  printJson(current, vibration < 0 ? 0.0 : vibration, condition);
  showLcd(current, vibration, condition);
}
