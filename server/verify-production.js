require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
const MONGO_DBNAME = process.env.MONGO_DBNAME || "waybills_db";

if (!MONGO_URI) {
  console.error("MONGO_URI not found in .env");
  process.exit(1);
}

async function main() {
  try {
    await mongoose.connect(MONGO_URI, { dbName: MONGO_DBNAME });
    console.log("Connected to production MongoDB Atlas");

    const Invoice = mongoose.connection.collection("export_invoices");

    // Helper functions matching server logic
    const normalizeDesc = (v) => String(v || "").replace(/\s+/g, " ").trim();
    const FIXED_COMMISSION_DESC_NORM = normalizeDesc("50 دولار اصدار بوليصة شحن");

    function itemMatchesFixedCommission(item) {
      return normalizeDesc(item.desc) === FIXED_COMMISSION_DESC_NORM;
    }

    function itemIsCommission(item) {
      const nd = normalizeDesc(item.desc);
      return nd.includes("عمولة مكتب") || nd.includes("عمولة المكتب");
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
      return Math.max(0, (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discount) || 0));
    }

    for (const month of ["2026-08", "2026-09"]) {
      const from = `${month}-01`;
      const to = `${month}-31`;

      const query = { date: { $gte: from, $lte: to } };
      const invoices = await Invoice.find(query).toArray();

      let invoiceTotal = 0;
      let commissionInvoiceCount = 0;
      let commissionTotal = 0;

      for (const inv of invoices) {
        const items = inv.items || [];
        let invTotal = 0;
        for (const item of items) {
          invTotal += resolveAmount(item);
        }
        invoiceTotal += invTotal;

        const commissionItems = [];
        let fixedFound = false;
        for (const item of items) {
          if (itemIsCommission(item)) commissionItems.push(item);
          if (itemMatchesFixedCommission(item)) fixedFound = true;
        }

        if (commissionItems.length > 0 || fixedFound) {
          let totalCommission = commissionItems.reduce((sum, item) => sum + resolveAmount(item), 0);
          if (fixedFound) totalCommission += 10;
          if (totalCommission > 0) {
            commissionInvoiceCount++;
            commissionTotal += totalCommission;
          }
        }
      }

      console.log(`\n=== ${month} ===`);
      console.log(`Invoices: ${invoices.length}`);
      console.log(`Total: ${Number(invoiceTotal.toFixed(3))}`);
      console.log(`Commission Invoices: ${commissionInvoiceCount}`);
      console.log(`Commission Total: ${Number(commissionTotal.toFixed(3))}`);
    }

    await mongoose.disconnect();
    console.log("\nDone.");
  } catch (err) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

main();
