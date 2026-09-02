const mongoose = require("mongoose");

const DriverSchema = new mongoose.Schema({
  name: String,
  phone: String,
  vehicle_no: String,
  vehicle_city: String, // ✅ جديد
  vehicleType: String, // ✅ نوع المركبة / التريلا
  license_no: String,
  notes: String,
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Driver", DriverSchema);
