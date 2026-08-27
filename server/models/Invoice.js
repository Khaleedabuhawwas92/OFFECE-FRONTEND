const mongoose = require("mongoose");

const InvoiceItemSchema = new mongoose.Schema(
  {
    itemId: { type: String, default: "" },
    activityClassification: { type: String, default: "" },
    desc: { type: String, default: "" },
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    taxMode: { type: String, default: "EXEMPT" },
    taxCategory: { type: String, default: "O" },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    lineNet: { type: Number, default: 0 },
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
      enum: ["EXPORT", "TAX", "SIMPLIFIED", "LOCAL_CASH", "LOCAL_CREDIT"],
      default: "EXPORT",
    },
    invoiceScope: {
      type: String,
      enum: ["LOCAL", "EXPORT"],
      default: "LOCAL",
    },
    paymentType: {
      type: String,
      enum: ["CASH", "CREDIT"],
      default: "CASH",
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

    einv_status: {
      type: String,
      enum: ["draft", "pending", "submitted", "failed"],
      default: "pending",
    },
    einv_submitted_at: { type: Date, default: null },
    einv_response: { type: mongoose.Schema.Types.Mixed, default: null },
    einv_error: { type: String, default: null },

    // ✅ بيانات الفاتورة الرسمية المرجعة من JoFotara
    einv_signed_invoice: { type: String, default: null },
    einv_qr: { type: String, default: null },
    einv_num: { type: String, default: null },

    created_at: { type: Date, default: Date.now },
  },
  { versionKey: false },
);

module.exports = mongoose.model("Invoice", InvoiceSchema);
