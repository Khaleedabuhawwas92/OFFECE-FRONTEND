// server/models/Waybill.js
const mongoose = require("mongoose");

const WaybillSchema = new mongoose.Schema(
  {
    waybillNumber: { type: String, unique: true, sparse: true },
    showStampSignature: { type: Boolean, default: false },
  },
  {
    strict: false,
    collection: "waybills",
  },
);

module.exports = mongoose.model("Waybill", WaybillSchema);
