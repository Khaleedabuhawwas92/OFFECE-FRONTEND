const mongoose = require("mongoose");

const InvoiceItemSchema = new mongoose.Schema(
  {
    desc: { type: String, default: "" },
    amount: { type: Number, default: 0 },
    currency: { type: String, default: "JOD" },
    rate_to_jod: { type: Number, default: 1 },
    amount_jod: { type: Number, default: 0 },
  },
  { _id: false },
);

// ✅ E-Invoicing fields
const EInvSchema = new mongoose.Schema(
  {
    invoiceType: {
      type: String,
      enum: ["EXPORT", "TAX", "SIMPLIFIED"],
      default: "EXPORT",
    },
    incomeSourceSeq: { type: String, default: "" },

    buyerName: { type: String, default: "" },
    buyerTaxNo: { type: String, default: "" },
    buyerPhone: { type: String, default: "" },
    buyerCity: { type: String, default: "عمان" },
    buyerPostalCode: { type: String, default: "" },

    currency: { type: String, default: "JOD" },
  },
  { _id: false },
);

const InvoiceSchema = new mongoose.Schema(
  {
    invoice_number: { type: String, unique: true, sparse: true },
    date: { type: String, required: true },

    // company = اسم المرسل/الشركة
    company: { type: String, required: true },

    // ✅ ربط المرسل (اختياري)
    consignor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Consignor",
      default: null,
    },

    driver_ids: [{ type: mongoose.Schema.Types.ObjectId, ref: "Driver" }],

    driver_names_snapshot: { type: [String], default: [] },
    vehicle_numbers_snapshot: { type: [String], default: [] },

    items: { type: [InvoiceItemSchema], default: [] },

    value_jod: { type: Number, default: 0 },
    paid_total: { type: Number, default: 0 },
    payment_status: {
      type: String,
      enum: ["UNPAID", "PARTIAL", "PAID"],
      default: "UNPAID",
    },

    notes: { type: String, default: "" },

    details_line1: { type: String, default: "" },
    details_line2: { type: String, default: "" },
    extra_details: { type: String, default: "" },

    // ✅ تخزين بيانات الفوترة مع الفاتورة
    einv: { type: EInvSchema, default: () => ({}) },

    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

module.exports = mongoose.model("Invoice", InvoiceSchema);
