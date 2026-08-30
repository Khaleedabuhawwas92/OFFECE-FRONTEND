// server/server.js
require("dotenv").config({
  path: require("path").join(__dirname, "..", ".env"),
});
console.log(
  "EINV_CLIENT_ID loaded:",
  !!process.env.EINV_CLIENT_ID ? "YES" : "NO",
);
console.log(
  "EINV_SECRET_KEY loaded:",
  !!process.env.EINV_SECRET_KEY ? "YES" : "NO",
);
console.log(
  "EINV_SECRET_KEY length:",
  String(process.env.EINV_SECRET_KEY || "").length,
);

const path = require("path");
const fs = require("fs");
const cors = require("cors");
const puppeteer = require("puppeteer");
const axios = require("axios");
const express = require("express");
const mongoose = require("mongoose");
const { spawn } = require("child_process");
const { randomUUID } = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const Invoice = require("./models/Invoice");
const Waybill = require("./models/Waybill");
const Driver = require("./models/Driver");
const Consignor = require("./models/Consignor");
const Consignee = require("./models/Consignee");
const Counter = require("./models/Counter");
const Voucher = require("./models/Voucher");
const User = require("./models/User");

const app = express();

/* =======================
   CORS + JSON
   ✅ لا تستخدم app.options("*") ولا app.options("/*") عشان Express 5
======================= */
const ALLOWED_ORIGINS = [
  "http://127.0.0.1:4000",
  "http://localhost:4000",
  "http://localhost:5173",
  "https://offece-frontend-production.up.railway.app",
  "https://arabworldeast.com",
  "https://www.arabworldeast.com",
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "10mb" }));

app.use("/images", express.static(path.join(__dirname, "images")));
app.use("/templates", express.static(path.join(__dirname, "templates")));

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017";
const MONGO_DBNAME = process.env.MONGO_DBNAME || "waybills_db";
const PORT = Number(process.env.PORT || 4000);

console.log("MONGO_DBNAME:", MONGO_DBNAME);

/* ======================= Mongo ======================= */
mongoose
  .connect(MONGO_URI, { dbName: MONGO_DBNAME })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    return seedAdmin();
  })
  .catch((err) => console.error("❌ MongoDB connection error:", err));

/* ======================= BOT ======================= */
let botProcess = null;

function startBot() {
  if (botProcess) return;

  const botPath = path.join(__dirname, "..", "bot", "bot.py");
  botProcess = spawn("python", [botPath], {
    cwd: path.join(__dirname, "..", "bot"),
    env: { ...process.env },
  });

  console.log("🚀 bot.py started, PID:", botProcess.pid);

  botProcess.stdout.on("data", (data) =>
    console.log("[BOT STDOUT]", data.toString()),
  );
  botProcess.stderr.on("data", (data) =>
    console.error("[BOT STDERR]", data.toString()),
  );

  botProcess.on("close", (code) => {
    console.log("⚠️ bot.py exited with code", code);
    botProcess = null;
  });
}
if (process.env.BOT_ENABLED === "true") startBot();

/* ======================= Helpers ======================= */
function toIdStr(x) {
  if (!x) return "";
  return String(x?._id ?? x?.id ?? x?.$oid ?? x);
}

function safeNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function asIsoDate(d) {
  const x = String(d || "").trim();
  if (!x) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(x)) return x;

  const m = x.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;

  return x;
}

/* =======================
   SERIAL HELPERS (YYMMDD-XXXX, per-month)
======================= */
function datePrefixFromDate(d = new Date()) {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}${mm}${dd}`;
}

function monthPrefixFromDate(d = new Date()) {
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}

async function getNextSerialForMonth(model, field, monthPrefix, datePrefix) {
  const counterKey = `${field}_${monthPrefix}`;

  // Baseline from existing records for this month prefix (YYMM) — legacy catch-up hint only.
  // This read is NOT used after the increment; the final serial comes from ONE atomic op below.
  const regex = new RegExp(`^${monthPrefix}\\d{2}-`);
  const existing = await model
    .find({ [field]: regex })
    .select(field)
    .lean();
  let maxExisting = 0;
  for (const doc of existing) {
    const val = doc[field] || "";
    const m = val.match(new RegExp(`^${monthPrefix}\\d{2}-(\\d+)$`));
    if (m) maxExisting = Math.max(maxExisting, parseInt(m[1], 10));
  }

  // ONE atomic counter operation: seq = max(current counter, maxExisting) + 1
  // Concurrent calls serialize on the counter document => unique numbers.
  const counter = await Counter.findOneAndUpdate(
    { key: counterKey },
    [
      {
        $set: {
          key: counterKey,
          seq: { $add: [{ $max: ["$seq", maxExisting] }, 1] },
        },
      },
    ],
    { new: true, upsert: true, updatePipeline: true },
  );

  return `${datePrefix}-${String(counter.seq).padStart(4, "0")}`;
}

async function peekNextSerialForMonth(model, field, monthPrefix, datePrefix) {
  const counterKey = `${field}_${monthPrefix}`;
  const counter = await Counter.findOne({ key: counterKey });
  const counterSeq = Number(counter?.seq || 0) + 1;

  // Query existing records for this month prefix (YYMM)
  const regex = new RegExp(`^${monthPrefix}\\d{2}-`);
  const existing = await model
    .find({ [field]: regex })
    .select(field)
    .lean();
  let maxExisting = 0;
  for (const doc of existing) {
    const val = doc[field] || "";
    const m = val.match(new RegExp(`^${monthPrefix}\\d{2}-(\\d+)$`));
    if (m) maxExisting = Math.max(maxExisting, parseInt(m[1], 10));
  }

  const seq = Math.max(counterSeq, maxExisting + 1);
  return `${datePrefix}-${String(seq).padStart(4, "0")}`;
}

/* =======================
   SERIAL (Waybill) — per-month
======================= */
async function reserveNextWaybillSerial(docDate = new Date()) {
  const monthPrefix = monthPrefixFromDate(docDate);
  const datePrefix = datePrefixFromDate(docDate);
  return getNextSerialForMonth(
    Waybill,
    "waybillNumber",
    monthPrefix,
    datePrefix,
  );
}

async function peekNextWaybillSerial(docDate = new Date()) {
  const monthPrefix = monthPrefixFromDate(docDate);
  const datePrefix = datePrefixFromDate(docDate);
  return peekNextSerialForMonth(
    Waybill,
    "waybillNumber",
    monthPrefix,
    datePrefix,
  );
}

/* =======================
   SERIAL (Invoice) — per-month
======================= */
async function reserveNextInvoiceNumber(docDate = new Date()) {
  const monthPrefix = `INV-${monthPrefixFromDate(docDate)}`;
  const datePrefix = `INV-${datePrefixFromDate(docDate)}`;
  return getNextSerialForMonth(
    Invoice,
    "invoice_number",
    monthPrefix,
    datePrefix,
  );
}

async function peekNextInvoiceNumber(docDate = new Date()) {
  const monthPrefix = `INV-${monthPrefixFromDate(docDate)}`;
  const datePrefix = `INV-${datePrefixFromDate(docDate)}`;
  return peekNextSerialForMonth(
    Invoice,
    "invoice_number",
    monthPrefix,
    datePrefix,
  );
}

/* ======================= HEALTH ======================= */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

/* ======================= AUTH ======================= */
const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-change-me";

function authMiddleware(req, res, next) {
  // Allow login
  if (req.path === "/auth/login") return next();
  // Allow PDF downloads (used via window.open without headers)
  if (/^\/waybills\/[^/]+\/regenerate-pdf$/.test(req.path)) return next();

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user || !user.active) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    if (user.role === "CUSTOMER" && user.portalEnabled !== true) {
      return res.status(403).json({ error: "Customer portal is disabled" });
    }
    const tokenPayload = { email: user.email, role: user.role };
    if (user.role === "CUSTOMER") {
      tokenPayload.companyId = user.companyId || "";
      tokenPayload.companyName = user.companyName || "";
    }
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: "7d" });
    return res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ error: "Login failed" });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({
    email: req.user.email,
    role: req.user.role,
    companyId: req.user.companyId || "",
    companyName: req.user.companyName || "",
  });
});

// Protect all subsequent /api routes
app.use("/api", authMiddleware);

async function seedAdmin() {
  try {
    const initEmail = String(process.env.INITIAL_ADMIN_EMAIL || "").trim();
    const plainPassword = String(process.env.INITIAL_ADMIN_PASSWORD || "");
    if (!initEmail || !plainPassword) return;

    const existing = await User.findOne({ email: initEmail.toLowerCase() });
    if (existing) return;

    const passwordHash = await bcrypt.hash(plainPassword, 12);
    await User.create({
      email: initEmail.toLowerCase(),
      passwordHash,
      role: "ADMIN",
      active: true,
    });
  } catch (err) {
    console.error("❌ Admin seed error:", err);
  }
}



app.get("/api/waybills/next-serial", async (req, res) => {
  try {
    const docDate = req.query.date ? new Date(req.query.date) : new Date();
    const nextSerial = await peekNextWaybillSerial(docDate);
    return res.json({ SERIAL_NO: nextSerial, waybillNumber: nextSerial });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Failed to peek serial", error: String(e) });
  }
});

app.get("/api/invoices/next-serial", async (req, res) => {
  try {
    const docDate = req.query.date ? new Date(req.query.date) : new Date();
    const nextNumber = await peekNextInvoiceNumber(docDate);
    return res.json({ invoice_number: nextNumber });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Failed to peek invoice serial", error: String(e) });
  }
});

/* =======================
   SERIAL (Voucher)
   مثال: VC-260YYMM-0001
======================= */
function voucherPrefixForNow(d = new Date()) {
  return `VC-${serialPrefixForNow(d)}`;
}

async function peekNextVoucherSerial() {
  const prefix = voucherPrefixForNow(new Date());
  const key = `VOUCHER_${prefix}`;
  const counter = await Counter.findOne({ key });
  const current = Number(counter?.seq || 0);
  const next = current + 1;
  const seq = String(next).padStart(4, "0");
  return `${prefix}-${seq}`;
}

async function reserveNextVoucherSerial() {
  const prefix = voucherPrefixForNow(new Date());
  const key = `VOUCHER_${prefix}`;
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { seq: 1 }, $setOnInsert: { key } },
    { new: true, upsert: true },
  );
  const seq = String(counter.seq).padStart(4, "0");
  return `${prefix}-${seq}`;
}

app.get("/api/vouchers/next-serial", async (req, res) => {
  try {
    const nextSerial = await peekNextVoucherSerial();
    return res.json({ serial_no: nextSerial });
  } catch (e) {
    return res
      .status(500)
      .json({ message: "Failed to peek voucher serial", error: String(e) });
  }
});

/* ======================= BOT STATUS ======================= */
app.get("/api/bot-status", (req, res) => {
  res.json({ running: !!botProcess, pid: botProcess ? botProcess.pid : null });
});

/* ======================= INVOICES ======================= */
app.get("/api/invoices", async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const invoices = await Invoice.find({})
      .sort({ created_at: -1 })
      .limit(Number(limit));
    res.json(invoices);
  } catch (err) {
    console.error("Error getting invoices:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// فواتير مفتوحة لطرف
app.get("/api/invoices/open", async (req, res) => {
  try {
    const company = String(req.query.company || "").trim();
    if (!company) return res.status(400).json({ error: "company is required" });

    const invs = await Invoice.find({ company }).sort({ created_at: -1 });
    const invIds = invs.map((x) => x._id);

    const vchs = await Voucher.find(
      { "allocations.invoice_id": { $in: invIds } },
      { allocations: 1 },
    ).lean();

    const paidMap = new Map();
    for (const v of vchs) {
      for (const a of Array.isArray(v.allocations) ? v.allocations : []) {
        const id = toIdStr(a.invoice_id);
        if (!id) continue;
        paidMap.set(id, (paidMap.get(id) || 0) + safeNumber(a.amount, 0));
      }
    }

    const out = invs.map((inv) => {
      const id = toIdStr(inv._id);
      const total = safeNumber(inv.value_jod, 0);
      const paid = safeNumber(paidMap.get(id), 0);
      const remaining = Math.max(0, Number((total - paid).toFixed(3)));
      return {
        ...inv.toObject(),
        paid_jod: Number(paid.toFixed(3)),
        remaining_jod: remaining,
      };
    });

    res.json(out.filter((x) => safeNumber(x.remaining_jod, 0) > 0));
  } catch (e) {
    console.error("GET /api/invoices/open error:", e);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: e.message });
  }
});

function normalizeEInv(raw) {
  const x = raw && typeof raw === "object" ? raw : {};
  return {
    invoiceType: String(x.invoiceType || "EXPORT").toUpperCase(),
    invoiceScope: String(x.invoiceScope || "LOCAL").toUpperCase(),
    paymentType: String(x.paymentType || "CASH").toUpperCase(),
    incomeSourceSeq: String(
      x.incomeSourceSeq || process.env.EINV_INCOME_SOURCE_SEQ || "",
    ).trim(),
    buyerName: String(x.buyerName || "").trim(),
    buyerTaxNo: String(x.buyerTaxNo || "").trim(),
    buyerPhone: String(x.buyerPhone || "").trim(),
    buyerCity: String(x.buyerCity || "عمان").trim() || "عمان",
    buyerPostalCode: String(x.buyerPostalCode || "").trim(),
    currency: String(x.currency || "JOD").toUpperCase() || "JOD",
  };
}

app.post("/api/invoices", async (req, res) => {
  try {
    const raw = req.body.driver_ids ?? req.body.driver_id ?? [];
    const driverIds = (Array.isArray(raw) ? raw : [raw])
      .map(toIdStr)
      .filter(Boolean);

    let driverNamesSnapshot = [];
    let driverVehiclesSnapshot = [];

    if (driverIds.length) {
      const drivers = await Driver.find(
        { _id: { $in: driverIds } },
        { name: 1, vehicle_no: 1, vehicle_city: 1 },
      );
      driverNamesSnapshot = drivers.map((d) => d?.name).filter(Boolean);
      driverVehiclesSnapshot = drivers
        .map((d) => d?.vehicle_no)
        .filter(Boolean);
    }

    const rawItems = req.body.items ?? [];
    const items = Array.isArray(rawItems)
      ? rawItems
          .map((it) => {
            const desc = String(it?.desc ?? "").trim();
            const amount = Number(it?.amount ?? 0);
            const currency = String(it?.currency ?? "JOD").trim() || "JOD";
            const rate_to_jod = Number(it?.rate_to_jod ?? 1);

            const safeAmount = Number.isFinite(amount) ? amount : 0;
            const safeRate = Number.isFinite(rate_to_jod) ? rate_to_jod : 1;
            const computedAmountJod = Number((safeAmount * safeRate).toFixed(3));
            const amount_jod = Number.isFinite(Number(it?.amount_jod))
              ? Number(it.amount_jod)
              : computedAmountJod;

            return {
              itemId: String(it?.itemId ?? ""),
              activityClassification: String(it?.activityClassification ?? ""),
              desc,
              quantity: Number(it?.quantity ?? 1),
              unitPrice: Number(
                Number(it?.unitPrice ?? it?.price ?? it?.unit_price ?? 0).toFixed(3),
              ),
              discount: Number(Number(it?.discount ?? 0).toFixed(3)),
              taxMode: String(it?.taxMode ?? "EXEMPT"),
              taxCategory: String(it?.taxCategory ?? "O"),
              taxPercent: Number(it?.taxPercent ?? 0),
              taxAmount: Number(it?.taxAmount ?? 0),
              lineNet: Number(Number(it?.lineNet ?? 0).toFixed(3)),
              amount: Number(safeAmount.toFixed(3)),
              currency,
              rate_to_jod: Number(safeRate.toFixed(4)),
              amount_jod: Number(amount_jod.toFixed(3)),
            };
          })
          .filter((x) => x.desc || Number(x.amount_jod || 0) !== 0)
      : [];

    const itemsTotal = Number(
      items
        .reduce((sum, it) => sum + (Number(it.amount_jod) || 0), 0)
        .toFixed(3),
    );

    const finalValueJod =
      items.length > 0 ? itemsTotal : safeNumber(req.body.value_jod, 0);
    const einv = normalizeEInv(req.body.einv);

    const submitToEInv = req.body.submitToEInv === true;

    const inv = await Invoice.create({
      invoice_number: await reserveNextInvoiceNumber(
        req.body.date ? new Date(req.body.date) : new Date(),
      ),
      date: req.body.date,
      company: req.body.company,

      consignor_id: req.body.consignor_id || undefined,

      driver_ids: driverIds,
      driver_names_snapshot: driverNamesSnapshot,
      vehicle_numbers_snapshot: driverVehiclesSnapshot,

      items,
      value_jod: finalValueJod,

      notes: req.body.notes || "",
      details_line1: req.body.details_line1 || "",
      details_line2: req.body.details_line2 || "",
      extra_details: req.body.extra_details || "",

      einv,
      einv_status: submitToEInv ? "pending" : "draft",
    });

    // Auto-submit to JoFotara only when explicitly requested
    if (submitToEInv) {
      try {
        await submitInvoiceToEInv(inv._id);
      } catch (e) {
        console.error("Auto-submit unexpected error:", e);
      }
    }

    // Return fresh invoice with submission state
    const freshInv = await Invoice.findById(inv._id);
    res.json(freshInv);
  } catch (e) {
    if (String(e?.code) === "11000") {
      return res.status(409).json({
        error: "DuplicateKey",
        message: "Serial conflict: duplicate invoice_number",
      });
    }
    console.error("POST /api/invoices error:", e);
    res.status(500).json({
      error: "Internal Server Error",
      message: e?.message || String(e),
      name: e?.name,
    });
  }
});

app.put("/api/invoices/:id", async (req, res) => {
  try {
    const rawDrivers = req.body.driver_ids ?? req.body.driver_id ?? undefined;

    const driverIds =
      rawDrivers === undefined
        ? undefined
        : (Array.isArray(rawDrivers) ? rawDrivers : [rawDrivers])
            .map(toIdStr)
            .filter(Boolean);

    let driverNamesSnapshot = undefined;
    let driverVehiclesSnapshot = undefined;

    if (driverIds && driverIds.length) {
      const drivers = await Driver.find(
        { _id: { $in: driverIds } },
        { name: 1, vehicle_no: 1 },
      );
      driverNamesSnapshot = drivers.map((d) => d?.name).filter(Boolean);
      driverVehiclesSnapshot = drivers
        .map((d) => d?.vehicle_no)
        .filter(Boolean);
    }

    const rawItems = req.body.items;
    let items = undefined;
    let itemsTotal = undefined;

    if (rawItems !== undefined) {
      items = Array.isArray(rawItems)
        ? rawItems
            .map((it) => {
              const desc = String(it?.desc ?? "").trim();
              const amount = Number(it?.amount ?? 0);
              const currency = String(it?.currency ?? "JOD").trim() || "JOD";
              const rate_to_jod = Number(it?.rate_to_jod ?? 1);

              const safeAmount = Number.isFinite(amount) ? amount : 0;
              const safeRate = Number.isFinite(rate_to_jod) ? rate_to_jod : 1;
              const computedAmountJod = Number((safeAmount * safeRate).toFixed(3));
              const amount_jod = Number.isFinite(Number(it?.amount_jod))
                ? Number(it.amount_jod)
                : computedAmountJod;

              return {
                itemId: String(it?.itemId ?? ""),
                activityClassification: String(it?.activityClassification ?? ""),
                desc,
                quantity: Number(it?.quantity ?? 1),
                unitPrice: Number(
                  Number(it?.unitPrice ?? it?.price ?? it?.unit_price ?? 0).toFixed(3),
                ),
                discount: Number(Number(it?.discount ?? 0).toFixed(3)),
                taxMode: String(it?.taxMode ?? "EXEMPT"),
                taxCategory: String(it?.taxCategory ?? "O"),
                taxPercent: Number(it?.taxPercent ?? 0),
                taxAmount: Number(it?.taxAmount ?? 0),
                lineNet: Number(Number(it?.lineNet ?? 0).toFixed(3)),
                amount: Number(safeAmount.toFixed(3)),
                currency,
                rate_to_jod: Number(safeRate.toFixed(4)),
                amount_jod: Number(amount_jod.toFixed(3)),
              };
            })
            .filter((x) => x.desc || Number(x.amount_jod || 0) !== 0)
        : [];

      itemsTotal = Number(
        items
          .reduce((sum, it) => sum + (Number(it.amount_jod) || 0), 0)
          .toFixed(3),
      );
    }

    const payload = {
      ...(req.body.invoice_number
        ? { invoice_number: req.body.invoice_number }
        : {}),
      ...(req.body.date !== undefined ? { date: req.body.date } : {}),
      ...(req.body.company !== undefined ? { company: req.body.company } : {}),
      ...(req.body.consignor_id !== undefined
        ? { consignor_id: req.body.consignor_id || undefined }
        : {}),
      ...(req.body.notes !== undefined ? { notes: req.body.notes || "" } : {}),
      ...(req.body.details_line1 !== undefined
        ? { details_line1: req.body.details_line1 || "" }
        : {}),
      ...(req.body.details_line2 !== undefined
        ? { details_line2: req.body.details_line2 || "" }
        : {}),
      ...(req.body.extra_details !== undefined
        ? { extra_details: req.body.extra_details || "" }
        : {}),

      ...(driverIds !== undefined ? { driver_ids: driverIds } : {}),
      ...(driverNamesSnapshot !== undefined
        ? { driver_names_snapshot: driverNamesSnapshot }
        : {}),
      ...(driverVehiclesSnapshot !== undefined
        ? { vehicle_numbers_snapshot: driverVehiclesSnapshot }
        : {}),

      ...(items !== undefined ? { items } : {}),
      ...(itemsTotal !== undefined
        ? { value_jod: itemsTotal }
        : req.body.value_jod !== undefined
          ? { value_jod: safeNumber(req.body.value_jod, 0) }
          : {}),

      ...(req.body.einv !== undefined
        ? { einv: normalizeEInv(req.body.einv) }
        : {}),
    };

    const inv = await Invoice.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });
    if (!inv) return res.status(404).json({ error: "Not found" });
    res.json(inv);
  } catch (err) {
    console.error("Error updating invoice:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
});

app.get("/api/invoices/:id", async (req, res) => {
  try {
    const inv = await Invoice.findById(req.params.id);
    if (!inv) return res.status(404).json({ error: "Not found" });
    res.json(inv);
  } catch (err) {
    console.error("Error getting invoice by id:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: err.message });
  }
});

app.delete("/api/invoices/:id", async (req, res) => {
  try {
    const inv = await Invoice.findByIdAndDelete(req.params.id);
    if (!inv) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting invoice:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ======================= REPORTS: Office Commission ======================= */
app.get("/api/reports/office-commission", async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = {};
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const invoices = await Invoice.find(query).lean();

    // ✅ قاعدة ثابتة مشتقة من بنود الفاتورة الحالية (تشمل الفواتير القديمة تلقائياً):
    // فاتورة تحتوي بند "50 دولار اصدار بوليصة شحن" => عمولة مكتب 10 JOD (مرة واحدة فقط لكل فاتورة)
    const FIXED_COMMISSION_AMOUNT = 10;
    const normalizeDesc = (v) => String(v || "").replace(/\s+/g, " ").trim();
    const FIXED_COMMISSION_DESC_NORM = normalizeDesc(
      "50 دولار اصدار بوليصة شحن",
    );

    function itemMatchesFixedCommission(item) {
      const hay = [
        item.desc,
        item.description,
        item.name,
        item.item,
        item.details,
      ]
        .map((v) => normalizeDesc(v))
        .join(" ");
      return hay.includes(FIXED_COMMISSION_DESC_NORM);
    }

    function itemIsCommission(item) {
      const hay = [
        item.desc,
        item.description,
        item.name,
        item.item,
        item.details,
      ]
        .map((v) => String(v || ""))
        .join(" ");
      return hay.includes("عمولة مكتب");
    }

    function resolveAmount(item) {
      let amt = Number(item.amount_jod);
      if (amt > 0) return amt;
      amt = Number(item.lineNet);
      if (amt > 0) return amt;
      amt = Number(item.total);
      if (amt > 0) return amt;
      amt = Number(item.amount);
      if (amt > 0) return amt;
      return Math.max(
        0,
        (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) -
          (Number(item.discount) || 0),
      );
    }

    const results = [];
    for (const inv of invoices) {
      const items = inv.items || [];
      const commissionItems = items.filter(itemIsCommission);
      const fixedItems = items.filter(itemMatchesFixedCommission);

      if (commissionItems.length === 0 && fixedItems.length === 0) continue;

      // ✅ 10 JOD ثابتة مرة واحدة لكل فاتورة مطابقة حتى لو تكرر الوصف
      let totalCommission = commissionItems.reduce(
        (sum, item) => sum + resolveAmount(item),
        0,
      );
      if (fixedItems.length > 0) totalCommission += FIXED_COMMISSION_AMOUNT;

      const matchedItems = [...fixedItems, ...commissionItems];
      const descriptions = matchedItems
        .map(
          (item) =>
            item.desc ||
            item.description ||
            item.name ||
            item.item ||
            item.details ||
            "",
        )
        .filter(Boolean)
        .join(" + ");
      const currency = fixedItems.length
        ? "JOD"
        : commissionItems[0]?.currency || inv.einv?.currency || "JOD";

      results.push({
        invoice_id: inv._id,
        invoice_number: inv.invoice_number,
        date: inv.date,
        company: inv.company,
        description: descriptions,
        currency,
        commission_amount: Number(totalCommission.toFixed(3)),
      });
    }

    res.json(results);
  } catch (err) {
    console.error("Office commission report error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ======================= VOUCHERS ======================= */
app.get("/api/vouchers", async (req, res) => {
  try {
    const { limit = 200 } = req.query;
    const rows = await Voucher.find({})
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .populate("allocations.invoice_id");
    res.json(rows);
  } catch (e) {
    console.error("GET /api/vouchers error:", e);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: e.message });
  }
});

app.get("/api/vouchers/:id", async (req, res) => {
  try {
    const row = await Voucher.findById(req.params.id).populate(
      "allocations.invoice_id",
    );
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(row);
  } catch (e) {
    console.error("GET /api/vouchers/:id error:", e);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: e.message });
  }
});

app.post("/api/vouchers", async (req, res) => {
  let doc = null;
  try {
    const body = req.body || {};
    const type = String(body.type || "").toUpperCase();
    if (!["RECEIPT", "PAYMENT"].includes(type)) {
      return res.status(400).json({ error: "يجب أن يكون نوع السند قبض أو تسديد" });
    }

    const date = asIsoDate(body.date || new Date().toISOString().slice(0, 10));
    if (!date) {
      return res.status(400).json({ error: "التاريخ مطلوب" });
    }

    const party_name = String(body.party_name || "").trim();
    if (!party_name) {
      return res.status(400).json({ error: "اسم الشركة / الطرف مطلوب" });
    }

    const currency = String(body.currency || "").trim();
    if (!currency) {
      return res.status(400).json({ error: "العملة مطلوبة" });
    }

    const method = String(body.method || "").toUpperCase();
    if (!["CASH", "BANK", "CHEQUE", "OTHER"].includes(method)) {
      return res.status(400).json({ error: "طريقة الدفع مطلوبة" });
    }

    const allocations = (
      Array.isArray(body.allocations) ? body.allocations : []
    )
      .map((a) => {
        const invoice_id = toIdStr(a?.invoice_id);
        const amount = safeNumber(a?.amount, 0);
        return { invoice_id, amount: Number(amount.toFixed(3)) };
      })
      .filter((a) => a.invoice_id && a.amount > 0);

    if (!allocations.length) {
      return res.status(400).json({ error: "يجب اختيار فاتورة واحدة على الأقل" });
    }

    const amount_total = Number(
      allocations.reduce((sum, a) => sum + safeNumber(a.amount, 0), 0).toFixed(3),
    );

    if (amount_total <= 0) {
      return res.status(400).json({ error: "يجب أن يكون إجمالي السند أكبر من صفر" });
    }

    // التحقق من عدم تجاوز المبلغ المتبقي لكل فاتورة
    const invIds = allocations.map((a) => a.invoice_id);
    const invoices = await Invoice.find({ _id: { $in: invIds } }).lean();
    const invMap = new Map(invoices.map((i) => [toIdStr(i._id), i]));

    const existingVouchers = await Voucher.find(
      { "allocations.invoice_id": { $in: invIds } },
      { allocations: 1 },
    ).lean();

    const paidMap = new Map();
    for (const v of existingVouchers) {
      for (const a of Array.isArray(v.allocations) ? v.allocations : []) {
        const id = toIdStr(a.invoice_id);
        if (!id) continue;
        paidMap.set(id, (paidMap.get(id) || 0) + safeNumber(a.amount, 0));
      }
    }

    for (const a of allocations) {
      const inv = invMap.get(a.invoice_id);
      if (!inv) {
        return res.status(400).json({ error: "إحدى الفواتير المختارة غير موجودة" });
      }
      const total = safeNumber(inv.value_jod, 0);
      const alreadyPaid = safeNumber(paidMap.get(a.invoice_id), 0);
      const remaining = Math.max(0, Number((total - alreadyPaid).toFixed(3)));
      if (a.amount > remaining + 0.001) {
        return res.status(400).json({
          error: `المبلغ الموزع (${a.amount}) يتجاوز الرصيد المفتوح (${remaining}) للفاتورة ${inv.invoice_number || ""}`,
        });
      }
    }

    let serial_no = String(body.serial_no || "").trim();
    let attempts = 0;
    while (attempts < 3) {
      attempts++;
      if (!serial_no) {
        serial_no = await reserveNextVoucherSerial();
      }
      try {
        doc = await Voucher.create({
          type,
          date,
          serial_no,
          party_name,
          party_phone: String(body.party_phone || "").trim(),
          currency,
          method,
          ref_no: String(body.ref_no || "").trim(),
          notes: String(body.notes || "").trim(),
          allocations: allocations.map((a) => {
            const inv = invMap.get(a.invoice_id);
            return {
              invoice_id: a.invoice_id,
              amount: a.amount,
              invoice_number: inv?.invoice_number || "",
              invoice_date: inv?.date || "",
              invoice_total: safeNumber(inv?.value_jod, 0),
              prev_paid: safeNumber(paidMap.get(a.invoice_id), 0),
            };
          }),
          amount_total,
        });
        break;
      } catch (e) {
        if (String(e?.code) === "11000" && attempts < 3) {
          serial_no = "";
          continue;
        }
        throw e;
      }
    }

    if (!doc) {
      return res.status(409).json({ error: "تعذر إنشاء رقم سند فريد، يرجى المحاولة مجدداً" });
    }

    // تحديث رصيد الفواتير
    try {
      for (const a of allocations) {
        const inv = invMap.get(a.invoice_id);
        const total = safeNumber(inv.value_jod, 0);
        const newPaid = safeNumber(paidMap.get(a.invoice_id), 0) + a.amount;
        const newRemaining = Math.max(0, Number((total - newPaid).toFixed(3)));
        let status = "UNPAID";
        if (newRemaining <= 0) status = "PAID";
        else if (newPaid > 0) status = "PARTIAL";

        await Invoice.findByIdAndUpdate(a.invoice_id, {
          paid_total: Number(newPaid.toFixed(3)),
          payment_status: status,
        });
      }
    } catch (updateErr) {
      // التراجع عن إنشاء السند إذا فشل تحديث الفواتير
      await Voucher.findByIdAndDelete(doc._id);
      throw updateErr;
    }

    const full = await Voucher.findById(doc._id).populate("allocations.invoice_id");
    res.status(201).json(full);
  } catch (e) {
    console.error("POST /api/vouchers error:", e);
    res
      .status(500)
      .json({ error: "حدث خطأ أثناء حفظ السند", message: e.message });
  }
});

app.delete("/api/vouchers/:id", async (req, res) => {
  try {
    const row = await Voucher.findByIdAndDelete(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/vouchers/:id error:", e);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: e.message });
  }
});

/* =======================
   E-INVOICING (Jordan)
   ✅ حسب الدليل: POST على /core/invoices/ (مش /submit)
   headers: Client-Id, Secret-Key
   body: { "invoice": "<base64 xml>" }
======================= */
function buildUblInvoiceXml(inv) {
  const issueDate = asIsoDate(
    inv?.date || new Date().toISOString().slice(0, 10),
  );
  const invoiceId = inv?.invoice_number || `INV-${inv?._id}`;
  const uuid = randomUUID();

  const einv = normalizeEInv(inv?.einv);

  const supplierName = "مؤسسة شرق العالم العربي للنقل البري";
  const supplierTax = String(process.env.EINV_SUPPLIER_TAXNO || "").trim();

  const buyerName = String(inv?.company || "").trim();
  const currency = einv.currency || "JOD";

  const items = Array.isArray(inv?.items) ? inv.items : [];
  const validItems = items.filter(
    (x) => String(x?.desc || "").trim() || Number(x?.amount_jod || 0),
  );

  const totalNum = Number(inv?.value_jod || 0);
  const total = totalNum.toFixed(3);
  const lineCount = validItems.length || 1;

  let typeCodeName = "011";
  const scope = String(einv.invoiceScope || "").toUpperCase();
  const payment = String(einv.paymentType || "").toUpperCase();
  if (scope === "LOCAL" && payment === "CASH") typeCodeName = "011";
  else if (scope === "LOCAL" && payment === "CREDIT") typeCodeName = "021";
  else if (scope === "EXPORT" && payment === "CASH") typeCodeName = "111";
  else if (scope === "EXPORT" && payment === "CREDIT") typeCodeName = "121";
  else if (einv.invoiceType === "EXPORT") typeCodeName = "111";
  else if (einv.invoiceType === "TRANSIT") typeCodeName = "311";
  else if (einv.invoiceType === "FOREIGN") typeCodeName = "411";
  else if (einv.invoiceType === "LOCAL") typeCodeName = "011";
  else if (einv.invoiceType === "LOCAL_CASH") typeCodeName = "011";
  else if (einv.invoiceType === "LOCAL_CREDIT") typeCodeName = "021";

  const linesXml = validItems
    .map((it, idx) => {
      const lineId = idx + 1;
      const desc = escapeXml(it?.desc || "");
      const quantity = Number(it?.quantity || 0);
      const unitPrice = Number(it?.unitPrice || 0);
      const discount = Number(it?.discount || 0);
      const gross = quantity * unitPrice;
      const lineNet = Math.max(0, gross - discount);

      return `
  <cac:InvoiceLine>
    <cbc:ID>${lineId}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${quantity.toFixed(3)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${escapeXml(currency)}">${lineNet.toFixed(3)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${desc}</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${escapeXml(currency)}">${unitPrice.toFixed(3)}</cbc:PriceAmount>
      <cac:AllowanceCharge>
        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
        <cbc:AllowanceChargeReason>DISCOUNT</cbc:AllowanceChargeReason>
        <cbc:Amount currencyID="${escapeXml(currency)}">${discount.toFixed(3)}</cbc:Amount>
      </cac:AllowanceCharge>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join("");

  const icvValue = String(inv?.invoice_number || inv?.serial || "1");
  const incomeSourceSeq = String(einv.incomeSourceSeq || "").trim();

  const grossTotal = validItems.reduce((sum, it) => {
    const q = Number(it?.quantity || 0);
    const up = Number(it?.unitPrice || 0);
    return sum + (q * up);
  }, 0);
  const discountTotal = validItems.reduce((sum, it) => sum + Number(it?.discount || 0), 0);
  const finalTotal = Math.max(0, grossTotal - discountTotal);

  console.log("EINV ITEMS:", validItems.map(i => ({
    quantity: i.quantity,
    unitPrice: i.unitPrice,
    discount: i.discount
  })));

  console.log("EINV TOTALS:", {
    grossTotal,
    discountTotal,
    finalTotal
  });

  let buyerSchemeId = "";
  if (einv.buyerIdType === "TIN") buyerSchemeId = "TN";
  else if (einv.buyerIdType === "NIN") buyerSchemeId = "NIN";
  else if (einv.buyerIdType === "OTHER") buyerSchemeId = "PN";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(invoiceId)}</cbc:ID>
  <cbc:UUID>${escapeXml(uuid)}</cbc:UUID>
  <cbc:IssueDate>${escapeXml(issueDate)}</cbc:IssueDate>
  <cbc:InvoiceTypeCode name="${typeCodeName}">388</cbc:InvoiceTypeCode>
  ${inv.notes ? `<cbc:Note>${escapeXml(inv.notes)}</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>${escapeXml(currency)}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>${escapeXml(currency)}</cbc:TaxCurrencyCode>
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${escapeXml(icvValue)}</cbc:UUID>
  </cac:AdditionalDocumentReference>

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cac:Country>
          <cbc:IdentificationCode>JO</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(supplierTax)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(supplierName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <cac:Party>
      ${einv.buyerId ? `<cac:PartyIdentification><cbc:ID schemeID="${buyerSchemeId || 'PN'}">${escapeXml(einv.buyerId)}</cbc:ID></cac:PartyIdentification>` : ''}
      <cac:PostalAddress>
        ${einv.buyerPostalCode ? `<cbc:PostalZone>${escapeXml(einv.buyerPostalCode)}</cbc:PostalZone>` : ""}
        ${einv.buyerCountrySubentityCode ? `<cbc:CountrySubentityCode>${escapeXml(einv.buyerCountrySubentityCode)}</cbc:CountrySubentityCode>` : ""}
        <cac:Country>
          <cbc:IdentificationCode>JO</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(buyerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
    ${einv.buyerPhone ? `<cac:AccountingContact><cbc:Telephone>${escapeXml(einv.buyerPhone)}</cbc:Telephone></cac:AccountingContact>` : ""}
  </cac:AccountingCustomerParty>

  ${incomeSourceSeq ? `<cac:SellerSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID>${escapeXml(incomeSourceSeq)}</cbc:ID>
      </cac:PartyIdentification>
    </cac:Party>
  </cac:SellerSupplierParty>` : ""}
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReason>discount</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="${escapeXml(currency)}">${discountTotal.toFixed(3)}</cbc:Amount>
  </cac:AllowanceCharge>
  <cac:LegalMonetaryTotal>
    <cbc:TaxExclusiveAmount currencyID="${escapeXml(currency)}">${grossTotal.toFixed(3)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${escapeXml(currency)}">${finalTotal.toFixed(3)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${escapeXml(currency)}">${discountTotal.toFixed(3)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="${escapeXml(currency)}">${finalTotal.toFixed(3)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${linesXml}
</Invoice>`;

  return xml.trim();
}

async function submitInvoiceToEInv(invoiceId, res = null) {
  const inv = await Invoice.findById(invoiceId);
  if (!inv) {
    if (res) return res.status(404).json({ error: "Invoice not found" });
    return { ok: false, error: "Invoice not found", status: 404 };
  }

  if (inv.einv_status === "submitted") {
    if (res)
      return res
        .status(409)
        .json({ error: "Invoice already submitted", einv_status: "submitted" });
    return {
      ok: false,
      error: "Invoice already submitted",
      status: 409,
      einv_status: "submitted",
    };
  }

  if (!String(inv?.company || "").trim()) {
    const err = "Invoice company (buyer) is required for JoFotara submission";
    inv.einv_status = "failed";
    inv.einv_error = err;
    await inv.save();
    if (res) return res.status(400).json({ error: err });
    return { ok: false, error: err, status: 400 };
  }

  try {
    const xml = buildUblInvoiceXml(inv);
    const invoiceBase64 = Buffer.from(xml, "utf8").toString("base64");

    const urlRaw = String(process.env.EINV_URL || "").trim();
    const clientId = String(process.env.EINV_CLIENT_ID || "").trim();
    const secretKey = String(process.env.EINV_SECRET_KEY || "").trim();

    if (!urlRaw) {
      inv.einv_status = "failed";
      inv.einv_error = "Missing EINV_URL in .env";
      await inv.save();
      if (res) return res.status(500).json({ error: inv.einv_error });
      return { ok: false, error: inv.einv_error, status: 500 };
    }
    if (!clientId || !secretKey) {
      inv.einv_status = "failed";
      inv.einv_error = "Missing EINV_CLIENT_ID or EINV_SECRET_KEY in .env";
      await inv.save();
      if (res) return res.status(500).json({ error: inv.einv_error });
      return { ok: false, error: inv.einv_error, status: 500 };
    }

    const url = urlRaw.replace(/\s+/g, ""); // تنظيف مسافات
    console.log("EINV URL:", url);
    console.log("ClientId len:", clientId.length);
    console.log("SecretKey len:", secretKey.length);

    const einv = normalizeEInv(inv?.einv);
    console.log("IncomeSourceSeq:", einv.incomeSourceSeq || "[MISSING]");
    console.log(
      "SupplierTax (.env):",
      String(process.env.EINV_SUPPLIER_TAXNO || "") || "[MISSING]",
    );
    const xmlBytes = Buffer.byteLength(xml, "utf8");
    const roundTrip = xml === Buffer.from(invoiceBase64, "base64").toString("utf8");
    console.log("XML UTF-8 bytes:", xmlBytes);
    console.log("Base64 length:", invoiceBase64.length);
    console.log("Base64 round-trip:", roundTrip ? "YES" : "NO");

    const resp = await axios.post(
      url,
      { invoice: invoiceBase64 },
      {
        headers: {
          "Content-Type": "application/json",
          "Client-Id": clientId,
          "Secret-Key": secretKey,
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) JoFotaraClient/1.0",
        },
        timeout: 60_000,
        validateStatus: () => true,
        responseType: "text",
      },
    );

    if (resp.status >= 400) {
      console.error("EINV rejected status:", resp.status);
      console.error("EINV rejected body:", resp.data);

      inv.einv_status = "failed";
      inv.einv_error = `EINV rejected: HTTP ${resp.status}`;
      inv.einv_response = { status: resp.status, data: resp.data };
      inv.einv_submitted_at = null;
      await inv.save();

      if (res)
        return res.status(resp.status).json({
          error: "EINV rejected",
          status: resp.status,
          data: resp.data,
        });
      return {
        ok: false,
        error: inv.einv_error,
        status: resp.status,
        einv_status: "failed",
      };
    }

    inv.einv_status = "submitted";
    inv.einv_submitted_at = new Date();
    inv.einv_response = resp.data;
    inv.einv_error = null;

    // ✅ حفظ الفاتورة الرسمية المرجعة من JoFotara (بدون تغيير منطق الإرسال)
    let einvData = resp.data;
    if (typeof einvData === "string") {
      try {
        einvData = JSON.parse(einvData);
      } catch {
        einvData = null;
      }
    }
    if (einvData && typeof einvData === "object") {
      if (einvData.EINV_SINGED_INVOICE)
        inv.einv_signed_invoice = String(einvData.EINV_SINGED_INVOICE);
      if (einvData.EINV_QR) inv.einv_qr = String(einvData.EINV_QR);
      if (einvData.EINV_NUM) inv.einv_num = String(einvData.EINV_NUM);
    }

    await inv.save();

    if (res)
      return res.json({
        ok: true,
        sent_invoice_id: invoiceId,
        invoice_number: inv.invoice_number,
        response: resp.data,
      });
    return {
      ok: true,
      sent_invoice_id: invoiceId,
      invoice_number: inv.invoice_number,
      einv_status: "submitted",
    };
  } catch (e) {
    console.error("EINV submit exception:", e?.message || e);
    inv.einv_status = "failed";
    inv.einv_error = String(e?.message || e);
    inv.einv_response = null;
    await inv.save();

    if (res)
      return res
        .status(500)
        .json({ error: "EINV submit failed", message: inv.einv_error });
    return {
      ok: false,
      error: inv.einv_error,
      status: 500,
      einv_status: "failed",
    };
  }
}

app.post("/api/einv/submit/:invoiceId", async (req, res) => {
  try {
    return await submitInvoiceToEInv(req.params.invoiceId, res);
  } catch (e) {
    console.error("EINV submit failed:", e?.message || e);
    return res
      .status(500)
      .json({ error: "EINV submit failed", message: e?.message || String(e) });
  }
});

app.post("/api/einv/submit", async (req, res) => {
  try {
    const invoiceId = req.body?.invoiceId;
    if (!invoiceId)
      return res.status(400).json({ error: "invoiceId is required" });
    return await submitInvoiceToEInv(invoiceId, res);
  } catch (e) {
    console.error("EINV submit failed:", e?.message || e);
    return res
      .status(500)
      .json({ error: "EINV submit failed", message: e?.message || String(e) });
  }
});

/* ======================= WAYBILLS ======================= */
app.get("/api/waybills", async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const waybills = await Waybill.find({})
      .sort({ created_at: -1 })
      .limit(Number(limit));
    res.json(waybills);
  } catch (err) {
    console.error("Error getting waybills:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/waybills", async (req, res) => {
  try {
    const payload = req.body || {};

    const fromBot =
      String(req.get("x-from-bot") || "") === "1" ||
      String(payload.SOURCE || "")
        .trim()
        .toUpperCase() === "BOT" ||
      payload.FROM_BOT === true ||
      payload.FROM_BOT === 1 ||
      String(payload.FROM_BOT || "").trim() === "1";

    const source = fromBot
      ? "BOT"
      : String(payload.SOURCE || "")
          .trim()
          .toUpperCase() || "MANUAL";

    // Backend is authoritative: ignore any client-supplied waybillNumber
    // and always reserve the final serial from the submitted document date.
    const docDate = payload.DATE ? new Date(payload.DATE) : new Date();
    const waybillNumber = await reserveNextWaybillSerial(docDate);

    const waybillToSave = {
      ...payload,
      waybillNumber,
      SERIAL_NO: waybillNumber, // display field synced to the authoritative serial
      SOURCE: source,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const saved = await Waybill.create(waybillToSave);
    return res.status(201).json(saved);
  } catch (e) {
    if (String(e?.code) === "11000") {
      return res.status(409).json({
        message: "Serial conflict: duplicate waybillNumber",
        error: "DuplicateKey",
      });
    }
    console.error("POST /api/waybills error:", e);
    return res
      .status(500)
      .json({ message: "Failed to create waybill", error: String(e) });
  }
});

app.get("/api/waybills/:id", async (req, res) => {
  try {
    const wb = await Waybill.findById(req.params.id);
    if (!wb) return res.status(404).json({ error: "Not found" });
    res.json(wb);
  } catch (err) {
    console.error("Error getting waybill:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/waybills/:id", async (req, res) => {
  try {
    const payload = { ...req.body, updated_at: new Date() };
    const wb = await Waybill.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });
    if (!wb) return res.status(404).json({ error: "Not found" });
    res.json(wb);
  } catch (err) {
    console.error("Error updating waybill:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/api/waybills/:id", async (req, res) => {
  try {
    const wb = await Waybill.findByIdAndDelete(req.params.id);
    if (!wb) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting waybill:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ======================= DRIVERS ======================= */
app.get("/api/drivers", async (req, res) => {
  try {
    const drivers = await Driver.find({}).sort({ created_at: -1 });
    res.json(drivers);
  } catch (err) {
    console.error("Error getting drivers:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/drivers", async (req, res) => {
  try {
    const payload = {
      name: req.body.name || "",
      phone: req.body.phone || "",
      vehicle_no: req.body.vehicle_no || "",
      vehicle_city: req.body.vehicle_city || "",
      license_no: req.body.license_no || "",
      notes: req.body.notes || "",
    };
    const driver = new Driver(payload);
    await driver.save();
    res.status(201).json(driver);
  } catch (err) {
    console.error("Error creating driver:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/vehicles", async (req, res) => {
  try {
    const rows = await Driver.find(
      { vehicle_no: { $ne: "" } },
      { vehicle_no: 1, vehicle_city: 1, name: 1, phone: 1 },
    ).sort({ vehicle_no: 1 });
    res.json(rows);
  } catch (err) {
    console.error("Error getting vehicles:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/drivers/:id", async (req, res) => {
  try {
    const payload = {
      name: req.body.name || "",
      phone: req.body.phone || "",
      vehicle_no: req.body.vehicle_no || "",
      vehicle_city: req.body.vehicle_city || "",
      license_no: req.body.license_no || "",
      notes: req.body.notes || "",
    };
    const driver = await Driver.findByIdAndUpdate(req.params.id, payload, {
      new: true,
    });
    if (!driver) return res.status(404).json({ error: "Not found" });
    res.json(driver);
  } catch (err) {
    console.error("Error updating driver:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/api/drivers/:id", async (req, res) => {
  try {
    const driver = await Driver.findByIdAndDelete(req.params.id);
    if (!driver) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting driver:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ======================= CONSIGNORS ======================= */
app.get("/api/consignors", async (req, res) => {
  try {
    const consignors = await Consignor.find({}).sort({ created_at: -1 });
    res.json(consignors);
  } catch (err) {
    console.error("Error getting consignors:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/consignors", async (req, res) => {
  try {
    const consignor = new Consignor(req.body);
    await consignor.save();
    res.status(201).json(consignor);
  } catch (err) {
    console.error("Error creating consignor:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/consignors/:id", async (req, res) => {
  try {
    const consignor = await Consignor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!consignor) return res.status(404).json({ error: "Not found" });
    res.json(consignor);
  } catch (err) {
    console.error("Error updating consignor:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/api/consignors/:id", async (req, res) => {
  try {
    const consignor = await Consignor.findByIdAndDelete(req.params.id);
    if (!consignor) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting consignor:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ======================= CONSIGNEES ======================= */
app.get("/api/consignees", async (req, res) => {
  try {
    const consignees = await Consignee.find({}).sort({ created_at: -1 });
    res.json(consignees);
  } catch (err) {
    console.error("Error getting consignees:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/consignees", async (req, res) => {
  try {
    const consignee = new Consignee(req.body);
    await consignee.save();
    res.status(201).json(consignee);
  } catch (err) {
    console.error("Error creating consignee:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.put("/api/consignees/:id", async (req, res) => {
  try {
    const consignee = await Consignee.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!consignee) return res.status(404).json({ error: "Not found" });
    res.json(consignee);
  } catch (err) {
    console.error("Error updating consignee:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.delete("/api/consignees/:id", async (req, res) => {
  try {
    const consignee = await Consignee.findByIdAndDelete(req.params.id);
    if (!consignee) return res.status(404).json({ error: "Not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("Error deleting consignee:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ======================= PDF (Waybill) ======================= */
function fillTemplateString(template, obj) {
  return template.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (match, key) => {
    const val =
      obj[key] ??
      obj[String(key).toUpperCase()] ??
      obj[String(key).toLowerCase()] ??
      "";
    return val == null ? "" : String(val);
  });
}

function generateWaybillHtmlFromTemplateNode(waybillDoc) {
  const templatePath = path.join(
    __dirname,
    "templates",
    "waybill_template.html",
  );
  if (!fs.existsSync(templatePath)) {
    const plain = waybillDoc.toObject ? waybillDoc.toObject() : waybillDoc;
    return `<html><body style="font-family:tahoma; direction:rtl">
      <h3>Template not found: ${templatePath}</h3>
      <pre>${JSON.stringify(plain, null, 2)}</pre>
    </body></html>`;
  }
  const raw = fs.readFileSync(templatePath, "utf-8");
  const plain = waybillDoc.toObject ? waybillDoc.toObject() : waybillDoc;
  return fillTemplateString(raw, plain);
}

app.get("/api/waybills/:id/regenerate-pdf", async (req, res) => {
  try {
    const wb = await Waybill.findById(req.params.id);
    if (!wb) return res.status(404).json({ error: "Waybill not found" });

    const html = generateWaybillHtmlFromTemplateNode(wb);

    const outDir = path.join(__dirname, "forms", "waybills");
    fs.mkdirSync(outDir, { recursive: true });

    const serial = wb.SERIAL_NO || `WB${wb._id}`;
    const pdfPath = path.join(outDir, `waybill_${serial}.pdf`);

    const browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      margin: { top: "5mm", right: "5mm", bottom: "5mm", left: "5mm" },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="waybill_${serial}.pdf"`,
    );
    fs.createReadStream(pdfPath).pipe(res);
  } catch (err) {
    console.error("regenerate-pdf error:", err);
    res
      .status(500)
      .json({ error: "Internal Server Error", details: String(err) });
  }
});

app.get("/api/waybills/:id/preview", async (req, res) => {
  try {
    const wb = await Waybill.findById(req.params.id);
    if (!wb) return res.status(404).send("Waybill not found");
    const html = generateWaybillHtmlFromTemplateNode(wb);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("preview error:", err);
    res.status(500).send("Internal Server Error");
  }
});

/* ======================= CUSTOMER PORTAL ======================= */
app.get("/api/customer/invoices", async (req, res) => {
  try {
    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const companyValues = [req.user.companyId, req.user.companyName].filter(Boolean);
    if (!companyValues.length) {
      return res.json([]);
    }
    const { limit = 100 } = req.query;
    const invoices = await Invoice.find({ company: { $in: companyValues } })
      .sort({ created_at: -1 })
      .limit(Number(limit));
    res.json(invoices);
  } catch (err) {
    console.error("Error getting customer invoices:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/customer/waybills", async (req, res) => {
  try {
    if (req.user.role !== "CUSTOMER") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const companyValues = [req.user.companyId, req.user.companyName].filter(Boolean);
    if (!companyValues.length) {
      return res.json([]);
    }
    const { limit = 100 } = req.query;
    const waybills = await Waybill.find({ CONSIGNOR_NAME: { $in: companyValues } })
      .sort({ created_at: -1 })
      .limit(Number(limit));
    res.json(waybills);
  } catch (err) {
    console.error("Error getting customer waybills:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* ======================= ADMIN CUSTOMER PORTAL ======================= */
function requireAdmin(req, res, next) {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ error: "Admin only" });
  }
  next();
}

app.post("/api/admin/customer-portal", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { companyId, companyName, email, password } = req.body || {};
    const normalizedEmail = String(email || "").toLowerCase().trim();
    if (!normalizedEmail || !password || !companyId) {
      return res.status(400).json({ error: "email, password, and companyId are required" });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    const passwordHash = await bcrypt.hash(String(password), 12);

    if (existing) {
      existing.passwordHash = passwordHash;
      existing.companyId = String(companyId);
      existing.companyName = String(companyName || "");
      existing.role = "CUSTOMER";
      await existing.save();
      return res.json({
        email: existing.email,
        companyId: existing.companyId,
        companyName: existing.companyName,
        portalEnabled: existing.portalEnabled,
      });
    }

    const created = await User.create({
      email: normalizedEmail,
      passwordHash,
      role: "CUSTOMER",
      companyId: String(companyId),
      companyName: String(companyName || ""),
      portalEnabled: false,
      active: true,
    });

    return res.status(201).json({
      email: created.email,
      companyId: created.companyId,
      companyName: created.companyName,
      portalEnabled: created.portalEnabled,
    });
  } catch (err) {
    console.error("POST /api/admin/customer-portal error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.patch("/api/admin/customer-portal/:companyId", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const companyId = String(req.params.companyId || "").trim();
    const { portalEnabled } = req.body || {};
    if (!companyId) {
      return res.status(400).json({ error: "companyId is required" });
    }

    const user = await User.findOne({ companyId, role: "CUSTOMER" });
    if (!user) {
      return res.status(404).json({ error: "Customer user not found for this company" });
    }

    user.portalEnabled = portalEnabled === true;
    await user.save();

    return res.json({
      email: user.email,
      companyId: user.companyId,
      companyName: user.companyName,
      portalEnabled: user.portalEnabled,
    });
  } catch (err) {
    console.error("PATCH /api/admin/customer-portal error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/admin/customer-portal/:companyId", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const companyId = String(req.params.companyId || "").trim();
    if (!companyId) {
      return res.status(400).json({ error: "companyId is required" });
    }

    const user = await User.findOne({ companyId, role: "CUSTOMER" });
    if (!user) {
      return res.status(404).json({ error: "Customer user not found for this company" });
    }

    return res.json({
      email: user.email,
      companyId: user.companyId,
      companyName: user.companyName,
      portalEnabled: user.portalEnabled,
    });
  } catch (err) {
    console.error("GET /api/admin/customer-portal error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/admin/companies", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const consignors = await Consignor.find({}).lean();
    const customerUsers = await User.find({ role: "CUSTOMER" }).lean();
    const userMap = new Map();
    for (const u of customerUsers) {
      userMap.set(String(u.companyId), u);
    }

    const results = [];
    for (const c of consignors) {
      const cid = String(c._id);
      const user = userMap.get(cid);
      const companyName = c.name || "";
      const companyValues = [cid, companyName].filter(Boolean);
      const [invCount, wbCount] = await Promise.all([
        Invoice.countDocuments({ company: { $in: companyValues } }),
        Waybill.countDocuments({ CONSIGNOR_NAME: { $in: companyValues } }),
      ]);
      results.push({
        _id: cid,
        name: companyName,
        address: c.address || "",
        city: c.city || "",
        country: c.country || "",
        phone: c.phone || "",
        customerEmail: user?.email || "",
        portalEnabled: user?.portalEnabled === true,
        invoicesCount: invCount,
        waybillsCount: wbCount,
      });
    }
    return res.json(results);
  } catch (err) {
    console.error("GET /api/admin/companies error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/admin/companies/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id) {
      return res.status(400).json({ error: "id is required" });
    }
    const c = await Consignor.findById(id).lean();
    if (!c) {
      return res.status(404).json({ error: "Company not found" });
    }
    const user = await User.findOne({ companyId: id, role: "CUSTOMER" }).lean();
    const companyName = c.name || "";
    const companyValues = [id, companyName].filter(Boolean);
    const [invCount, wbCount] = await Promise.all([
      Invoice.countDocuments({ company: { $in: companyValues } }),
      Waybill.countDocuments({ CONSIGNOR_NAME: { $in: companyValues } }),
    ]);
    return res.json({
      _id: id,
      name: companyName,
      address: c.address || "",
      city: c.city || "",
      country: c.country || "",
      phone: c.phone || "",
      customerEmail: user?.email || "",
      portalEnabled: user?.portalEnabled === true,
      invoicesCount: invCount,
      waybillsCount: wbCount,
    });
  } catch (err) {
    console.error("GET /api/admin/companies/:id error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
});
