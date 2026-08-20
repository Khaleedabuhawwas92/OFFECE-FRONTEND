const mongoose = require("mongoose");

const VoucherSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["RECEIPT", "PAYMENT"], required: true }, // قبض/تسديد
    date: { type: String, required: true }, // yyyy-mm-dd
    serial_no: { type: String, required: true, unique: true },

    party_name: { type: String, required: true }, // نفس company
    party_phone: { type: String, default: "" },

    currency: { type: String, default: "JOD" },
    method: {
      type: String,
      enum: ["CASH", "BANK", "CHEQUE", "OTHER"],
      default: "CASH",
    },
    ref_no: { type: String, default: "" },
    notes: { type: String, default: "" },

    allocations: [
      {
        invoice_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Invoice",
          required: true,
        },
        invoice_number: { type: String, default: "" }, // snapshot
        invoice_date: { type: String, default: "" }, // snapshot
        invoice_total: { type: Number, default: 0 }, // snapshot (value_jod)
        prev_paid: { type: Number, default: 0 }, // snapshot
        amount: { type: Number, required: true }, // المبلغ المسدد على هذه الفاتورة
      },
    ],

    amount_total: { type: Number, required: true },
  },
  { timestamps: true, versionKey: false },
);

module.exports = mongoose.model("Voucher", VoucherSchema);
