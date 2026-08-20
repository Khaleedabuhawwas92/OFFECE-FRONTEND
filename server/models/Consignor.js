// server/models/Consignor.js
const mongoose = require("mongoose");

const consignorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // اسم المرسل
    address: { type: String },
    city: { type: String },
    country: { type: String },
    phone: { type: String },
    notes: { type: String },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

module.exports = mongoose.model("Consignor", consignorSchema);
