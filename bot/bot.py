# bot.py -- نسخة مُجمعة ومصحّحة للاستخدام مع MongoDB (pymongo)
"""
✅ التعديلات المطلوبة حسب server.js:
1) SERIAL_NO صار مثل السيرفر: 260YYMM-0001  (مثال 2602602-0013)
   - key في counters: WAYBILL_260YYMM
   - field: seq
   - Atomic find_one_and_update $inc

2) اختيار اسم السائق فقط (من drivers) -> يملأ تلقائياً:
   DRIVER1_NAME + VEHICLE1_NO + VEHICLE1_REGION + TYPE1_TRANSPORT (إن وجد بالحقل)

3) إصلاح Unicode في كونسول ويندوز

4) ✅ إصلاح مشكلة: TypeError: datetime is not JSON serializable
   - raw_json صار يُبنى من wb (بدون created_at/updated_at)
   - تواريخ صارت timezone-aware (بدل utcnow) لتفادي DeprecationWarning في Python 3.14

الحزم:
  pip install pymongo python-telegram-bot==21.10 python-dotenv

.env:
  MONGO_URI=mongodb://localhost:27017
  MONGO_DBNAME=waybills_db
  BOT_TOKEN=xxxxxxxx

PDF:
  - wkhtmltopdf + pdfkit (أفضل لويندوز)
  - أو WeasyPrint (قد يحتاج مكتبات خارجية)
"""

from dotenv import load_dotenv
import os
import json
import re
import base64
import sys
from pathlib import Path
from datetime import datetime, timezone  # ✅

load_dotenv()

# ✅ إصلاح مشاكل Unicode في كونسول ويندوز
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# ----------------- إعدادات من البيئة -----------------
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
MONGO_DBNAME = os.getenv("MONGO_DBNAME", "waybills_db")
BOT_TOKEN = os.getenv("BOT_TOKEN", "PUT_YOUR_TOKEN_HERE")

print("MONGO_URI:", MONGO_URI)
print("MONGO_DBNAME:", MONGO_DBNAME)
if BOT_TOKEN and BOT_TOKEN != "PUT_YOUR_TOKEN_HERE":
    print("BOT_TOKEN:", BOT_TOKEN[:5] + "...")
else:
    print("BOT_TOKEN is not set!")

# محاولة استيراد pdfkit / weasyprint لكن لا تفشل لو غير مثبتين
pdfkit = None
WeasyHTML = None
try:
    import pdfkit as _pdfkit
    pdfkit = _pdfkit
except Exception:
    pdfkit = None

try:
    from weasyprint import HTML as WeasyHTML
except Exception:
    WeasyHTML = None

# pymongo
from pymongo import MongoClient, ASCENDING, DESCENDING, ReturnDocument

from telegram import Update, ReplyKeyboardMarkup, ReplyKeyboardRemove
from telegram.ext import (
    Application,
    MessageHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    filters,
)

# ----------------- States -----------------
# Invoice states (9)
(
    COMPANY,
    CUSTOMER_NAME,
    CUSTOMER_CODE,
    INVOICE_NUMBER,
    WEIGHT,
    PALLETS,
    VALUE,
    QTY,
    DATE,
) = range(9)

# Waybill states (16)
(
    WB_DATE,
    WB_CONSIGNOR_NAME,
    WB_CONSIGNOR_ADDRESS,
    WB_CONSIGNOR_PHONE,
    WB_DRIVER_PICK,
    WB_CONSIGNEE_NAME,
    WB_CONSIGNEE_ADDRESS,
    WB_CONSIGNEE_PHONE,
    WB_GOODS_NATURE,
    WB_TARIFF_CODE,
    WB_GROSS_WEIGHT,
    WB_MARKS,
    WB_PACKAGES_COUNT,
    WB_PACKING_METHOD,
    WB_ANNEXED_DOCS,
    WB_ROUTE,
) = range(16)

# ----------------- MongoDB setup -----------------
mongo_client: MongoClient = None
db = None
col_invoices = None
col_parties = None
col_routes = None
col_goods = None
col_waybills = None
col_drivers = None
col_counters = None


def init_db():
    """تهيئة الاتصال بـ MongoDB وإنشاء المجموعات والمؤشرات"""
    global mongo_client, db
    global col_invoices, col_parties, col_routes, col_goods, col_waybills, col_drivers, col_counters

    mongo_client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=5000)
    mongo_client.admin.command("ping")

    db = mongo_client[MONGO_DBNAME]

    col_invoices = db["export_invoices"]
    col_parties = db["parties"]
    col_routes = db["routes"]
    col_goods = db["goods_natures"]
    col_waybills = db["waybills"]
    col_drivers = db["drivers"]     # من الداشبورد
    col_counters = db["counters"]   # ✅ نفس السيرفر

    try:
        col_invoices.create_index([("invoice_number", ASCENDING)])
        col_invoices.create_index([("created_at", DESCENDING)])

        col_waybills.create_index([("SERIAL_NO", ASCENDING)])
        col_waybills.create_index([("created_at", DESCENDING)])

        col_parties.create_index([("type", ASCENDING), ("name", ASCENDING)])
        col_routes.create_index([("name", ASCENDING)], unique=True)
        col_goods.create_index([("name", ASCENDING)], unique=True)

        col_drivers.create_index([("name", ASCENDING)])
        col_drivers.create_index([("vehicle_no", ASCENDING)])

        # ✅ مهم جداً لتفادي duplicate keys
        col_counters.create_index([("key", ASCENDING)], unique=True)
    except Exception:
        pass

    print("✅ MongoDB connected OK")


# ======================= SERIAL مثل السيرفر =======================
# المطلوب: 260YYMM-0001
def serial_prefix_for_now(d: datetime = None) -> str:
    """
    مثل السيرفر:
      yy = آخر رقمين من السنة
      mm = شهر 2 خانات
      prefix = 260 + yy + mm
    مثال Feb 2026 -> 2602602
    """
    d = d or datetime.now()
    yy = str(d.year)[-2:]
    mm = str(d.month).zfill(2)
    return f"260{yy}{mm}"


def reserve_next_waybill_serial() -> str:
    """
    ✅ يحجز رقم (يزيد العداد مرة واحدة) — Atomic
    - key: WAYBILL_260YYMM
    - field: seq
    - الناتج: 260YYMM-0001
    """
    if col_counters is None:
        prefix = serial_prefix_for_now()
        return f"{prefix}-0001"

    prefix = serial_prefix_for_now()
    key = f"WAYBILL_{prefix}"

    doc = col_counters.find_one_and_update(
        {"key": key},
        {"$inc": {"seq": 1}, "$setOnInsert": {"key": key}},
        upsert=True,
        return_document=ReturnDocument.AFTER,
    )

    seq = int(doc.get("seq", 1) or 1)
    return f"{prefix}-{str(seq).zfill(4)}"


# ----------------- DB helpers -----------------
def save_waybill(wb: dict) -> str:
    if col_waybills is None:
        raise RuntimeError("col_waybills is None (db not initialized)")

    doc = wb.copy()

    # ✅ تمييز المصدر
    doc["SOURCE"] = "BOT"
    doc["FROM_BOT"] = 1

    # ✅ تواريخ (timezone-aware) بدل utcnow
    now = datetime.now(timezone.utc)
    doc["created_at"] = now
    doc["updated_at"] = now

    # ✅ raw_json من wb فقط لتجنب datetime داخل json
    doc["raw_json"] = json.dumps(wb, ensure_ascii=False, indent=2)

    res = col_waybills.insert_one(doc)
    return str(res.inserted_id)


def save_invoice(data: dict) -> str:
    if col_invoices is None:
        raise RuntimeError("col_invoices is None (db not initialized)")
    doc = {
        "company": data.get("company", ""),
        "customer_name": data.get("customer_name", ""),
        "customer_code": data.get("customer_code", ""),
        "invoice_number": data.get("invoice_number", ""),
        "weight": float(data.get("weight", 0) or 0),
        "pallets_count": int(data.get("pallets_count", 0) or 0),
        "value": float(data.get("value", 0) or 0),
        "quantity": int(data.get("quantity", 0) or 0),
        "date": data.get("date", ""),
        "created_at": datetime.now(timezone.utc),  # ✅
    }
    res = col_invoices.insert_one(doc)
    return str(res.inserted_id)


def add_party(type_: str, name: str, address: str, phone: str):
    if col_parties is None or not name:
        return
    q = {"type": type_, "name": name, "address": address or ""}
    if col_parties.find_one(q) is None:
        col_parties.insert_one(
            {
                "type": type_,
                "name": name,
                "address": address or "",
                "phone": phone or "",
                "created_at": datetime.now(timezone.utc),  # ✅
            }
        )


def get_parties(type_: str):
    if col_parties is None:
        return []
    rows = list(col_parties.find({"type": type_}).sort("name", 1))
    return [(str(r.get("_id")), r.get("name", ""), r.get("address", ""), r.get("phone", "")) for r in rows]


def get_party_by_name(type_: str, name: str):
    if col_parties is None:
        return None
    doc = col_parties.find_one({"type": type_, "name": name})
    if not doc:
        return None
    return (str(doc.get("_id")), doc.get("name", ""), doc.get("address", ""), doc.get("phone", ""))


def get_locations():
    if col_parties is None:
        return []
    vals = col_parties.distinct("address", {"address": {"$ne": ""}})
    vals = [v for v in vals if v]
    return sorted(set(vals))


def add_route(name: str):
    if not name or col_routes is None:
        return
    try:
        col_routes.update_one(
            {"name": name},
            {"$setOnInsert": {"name": name, "created_at": datetime.now(timezone.utc)}},  # ✅
            upsert=True
        )
    except Exception:
        pass


def get_routes():
    if col_routes is None:
        return []
    rows = list(col_routes.find({}).sort("name", 1))
    return [r.get("name", "") for r in rows if r.get("name")]


def add_goods_nature(name: str):
    if not name or col_goods is None:
        return
    try:
        col_goods.update_one(
            {"name": name},
            {"$setOnInsert": {"name": name, "created_at": datetime.now(timezone.utc)}},  # ✅
            upsert=True
        )
    except Exception:
        pass


def get_goods_natures():
    if col_goods is None:
        return []
    rows = list(col_goods.find({}).sort("name", 1))
    return [r.get("name", "") for r in rows if r.get("name")]


# -------- drivers helpers (Dashboard) --------
def _pick_transport_type(doc: dict) -> str:
    return (
        doc.get("transport_type")
        or doc.get("type_transport")
        or doc.get("TYPE_TRANSPORT")
        or doc.get("truck_type")
        or doc.get("vehicle_type")
        or ""
    ).strip()


def get_drivers_names():
    if col_drivers is None:
        return []
    rows = list(col_drivers.find({"name": {"$ne": ""}}, {"name": 1}).sort("name", 1))
    names = [r.get("name", "").strip() for r in rows if r.get("name")]
    seen, uniq = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            uniq.append(n)
    return uniq


def get_driver_by_name(name: str):
    if not name or col_drivers is None:
        return None
    return col_drivers.find_one({"name": name})


def _pick_vehicle_no(doc: dict) -> str:
    return (doc.get("vehicle_no") or doc.get("VEHICLE_NO") or doc.get("vehicleNumber") or "").strip()


def _pick_vehicle_region(doc: dict) -> str:
    return (doc.get("vehicle_region") or doc.get("VEHICLE_REGION") or doc.get("region") or "").strip()


# ----------------- HTML / PDF helpers -----------------
def generate_invoice_html_form(data: dict, invoice_id: str) -> str:
    return f"""
<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>فاتورة تصدير رقم {data.get('invoice_number','')}</title>
<style>
  body {{ font-family: Arial, sans-serif; direction: rtl; text-align: right; }}
  .box {{ border: 1px solid #000; padding: 16px; width: 600px; margin: 20px auto; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
  td {{ border: 1px solid #555; padding: 6px; }}
</style>
</head>
<body>
<div class="box">
  <h1>فاتورة تصدير</h1>
  <p><strong>رقم داخلي:</strong> {invoice_id}</p>
  <p><strong>الشركة:</strong> {data.get('company','')}</p>
  <p><strong>اسم الزبون:</strong> {data.get('customer_name','')} ({data.get('customer_code','')})</p>
  <p><strong>تاريخ:</strong> {data.get('date','')}</p>

  <table>
    <tr><td>رقم الفاتورة</td><td>{data.get('invoice_number','')}</td></tr>
    <tr><td>الوزن (طن)</td><td>{data.get('weight','')}</td></tr>
    <tr><td>عدد الطبالي</td><td>{data.get('pallets_count','')}</td></tr>
    <tr><td>القيمة</td><td>{data.get('value','')}</td></tr>
    <tr><td>العدد</td><td>{data.get('quantity','')}</td></tr>
  </table>
</div>
</body>
</html>
"""


def embed_images_in_html(html: str, base_dir: Path) -> str:
    def _repl(m):
        raw = m.group(0)
        inner = re.search(r'src\s*=\s*(?P<q>"[^"]*"|\'[^\']*\'|[^>\s]+)', raw, flags=re.IGNORECASE)
        if not inner:
            return raw
        src_val = inner.group(1).strip().strip('"').strip("'")
        src = src_val
        if src.lower().startswith(("data:", "http://", "https://", "file:")):
            return raw

        img_path = (base_dir / src).resolve()
        if not img_path.exists():
            try:
                img_path2 = Path(src).resolve()
                if img_path2.exists():
                    img_path = img_path2
                else:
                    return raw
            except Exception:
                return raw

        try:
            data = img_path.read_bytes()
            b64 = base64.b64encode(data).decode("ascii")
            suffix = img_path.suffix.lower().lstrip(".")
            mime = {
                "jpg": "image/jpeg",
                "jpeg": "image/jpeg",
                "png": "image/png",
                "gif": "image/gif",
                "svg": "image/svg+xml",
                "webp": "image/webp",
            }.get(suffix, "application/octet-stream")
            data_uri = f"data:{mime};base64,{b64}"
            return raw.replace(src_val, data_uri)
        except Exception:
            return raw

    return re.sub(r"<img[^>]+>", _repl, html, flags=re.IGNORECASE)


def generate_waybill_html_from_template(data: dict) -> str:
    template_path = Path("waybill_template.html")
    if not template_path.exists():
        return "<html><body><pre>" + json.dumps(data, ensure_ascii=False, indent=2) + "</pre></body></html>"

    html = template_path.read_text(encoding="utf-8")

    def _repl_place(match):
        key = match.group(1).strip()
        for cand in (key, key.upper(), key.lower()):
            if cand in data and data[cand] is not None:
                return str(data[cand])
        return ""

    html = re.sub(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}", _repl_place, html)
    html = re.sub(r"\{\{.*?\}\}", "", html)

    try:
        html = embed_images_in_html(html, template_path.parent)
    except Exception:
        pass
    return html


def html_to_pdf(html_str: str, pdf_path: Path):
    pdf_path = Path(pdf_path)
    wk_path = r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe"
    last_err = None

    if pdfkit is not None and Path(wk_path).exists():
        try:
            config = pdfkit.configuration(wkhtmltopdf=wk_path)
            options = {"enable-local-file-access": None}
            pdfkit.from_string(html_str, str(pdf_path), configuration=config, options=options)
            return
        except Exception as e:
            last_err = e

    if WeasyHTML is not None:
        try:
            WeasyHTML(string=html_str).write_pdf(str(pdf_path))
            return
        except Exception as e:
            last_err = e

    raise RuntimeError(f"No HTML->PDF converter available or both failed. last error: {last_err}")


# ----------------- Bot handlers -----------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "اهلاً.\n"
        "لإدخال فاتورة تصدير: /newinvoice\n"
        "لإدخال وثيقة نقل (WAYBILL): /newwaybill\n"
    )


# --------- Invoice conversation handlers ----------
def get_invoice_companies():
    if col_invoices is None:
        return []
    vals = col_invoices.distinct("company")
    vals = [v for v in vals if v]
    return sorted(set(vals))


def get_customers_for_company(company: str):
    if not company or col_invoices is None:
        return []
    vals = col_invoices.distinct("customer_name", {"company": company})
    vals = [v for v in vals if v]
    return sorted(set(vals))


def get_last_customer_code(company: str, customer_name: str):
    if not company or not customer_name or col_invoices is None:
        return None
    docs = list(
        col_invoices.find(
            {"company": company, "customer_name": customer_name, "customer_code": {"$ne": ""}},
            {"customer_code": 1},
        ).sort("created_at", -1).limit(1)
    )
    if not docs:
        return None
    return docs[0].get("customer_code")


async def newinvoice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["invoice_form"] = {}
    companies = get_invoice_companies()
    if companies:
        keyboard = [[c] for c in companies]
        await update.message.reply_text(
            "اختر اسم الشركة من القائمة أو اكتب اسم جديد:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("اكتب اسم الشركة")
    return COMPANY


async def company_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    company = update.message.text.strip()
    context.user_data["invoice_form"]["company"] = company

    customers = get_customers_for_company(company)
    if customers:
        keyboard = [[c] for c in customers]
        await update.message.reply_text(
            "اختر اسم الزبون من القائمة أو اكتب اسم جديد:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("اكتب اسم الزبون", reply_markup=ReplyKeyboardRemove())
    return CUSTOMER_NAME


async def customer_name_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    customer_name = update.message.text.strip()
    context.user_data["invoice_form"]["customer_name"] = customer_name

    company = context.user_data["invoice_form"].get("company", "")
    last_code = get_last_customer_code(company, customer_name)

    msg = "اكتب كود الزبون"
    if last_code:
        msg += f"\nآخر كود مستخدم: {last_code}"

    await update.message.reply_text(msg, reply_markup=ReplyKeyboardRemove())
    return CUSTOMER_CODE


async def customer_code_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["invoice_form"]["customer_code"] = update.message.text.strip()
    await update.message.reply_text("اكتب رقم فاتورة التصدير")
    return INVOICE_NUMBER


async def invoice_number_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["invoice_form"]["invoice_number"] = update.message.text.strip()
    await update.message.reply_text("اكتب الوزن بالطن")
    return WEIGHT


async def weight_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    txt = update.message.text.replace(",", "").strip()
    try:
        context.user_data["invoice_form"]["weight"] = float(txt)
    except ValueError:
        await update.message.reply_text("الرجاء إدخال رقم صحيح للوزن")
        return WEIGHT
    await update.message.reply_text("اكتب عدد الطبالي")
    return PALLETS


async def pallets_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        context.user_data["invoice_form"]["pallets_count"] = int(update.message.text.strip())
    except ValueError:
        await update.message.reply_text("الرجاء إدخال عدد صحيح")
        return PALLETS
    await update.message.reply_text("اكتب القيمة")
    return VALUE


async def value_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    txt = update.message.text.replace(",", "").strip()
    try:
        context.user_data["invoice_form"]["value"] = float(txt)
    except ValueError:
        await update.message.reply_text("الرجاء إدخال رقم صحيح للقيمة")
        return VALUE
    await update.message.reply_text("اكتب العدد")
    return QTY


async def qty_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    try:
        context.user_data["invoice_form"]["quantity"] = int(update.message.text.strip())
    except ValueError:
        await update.message.reply_text("الرجاء إدخال عدد صحيح")
        return QTY
    await update.message.reply_text("اكتب التاريخ")
    return DATE


async def date_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data["invoice_form"]["date"] = update.message.text.strip()
    data = context.user_data["invoice_form"]
    invoice_id = save_invoice(data)
    html = generate_invoice_html_form(data, invoice_id)

    out_dir = Path("forms/invoices")
    out_dir.mkdir(parents=True, exist_ok=True)

    html_path = out_dir / f"invoice_{invoice_id}.html"
    pdf_path = out_dir / f"invoice_{invoice_id}.pdf"
    html_path.write_text(html, encoding="utf-8")

    try:
        html_to_pdf(html, pdf_path)
        await update.message.reply_text(f"تم حفظ الفاتورة.\nرقم داخلي: {invoice_id}\nتم إنشاء PDF.")
        await update.message.reply_document(document=open(pdf_path, "rb"))
    except Exception as e:
        await update.message.reply_text(f"تم حفظ الفاتورة كـ HTML لكن فشل PDF.\nالخطأ: {e}\nسأرسل HTML.")
        await update.message.reply_document(document=open(html_path, "rb"))

    return ConversationHandler.END


# --------- Waybill conversation ----------
async def newwaybill(update: Update, context: ContextTypes.DEFAULT_TYPE):
    today_str = datetime.now().strftime("%d-%m-%Y")

    wb = {}
    wb["ISSUING_PLACE"] = "الأردن - عمان"

    # ✅ أهم سطر: نفس السيرفر تماماً
    wb["SERIAL_NO"] = reserve_next_waybill_serial()

    # صفوف السائق/المركبة مطابقة للقالب
    wb.setdefault("TYPE1_TRANSPORT", "تريلا - سطحة")
    wb.setdefault("TYPE2_TRANSPORT", "")
    wb.setdefault("TYPE3_TRANSPORT", "")

    wb.setdefault("VEHICLE1_NO", "")
    wb.setdefault("VEHICLE1_REGION", "")
    wb.setdefault("DRIVER1_NAME", "")

    wb.setdefault("VEHICLE2_NO", "")
    wb.setdefault("VEHICLE2_REGION", "")
    wb.setdefault("DRIVER2_NAME", "")

    wb.setdefault("VEHICLE3_NO", "")
    wb.setdefault("VEHICLE3_REGION", "")
    wb.setdefault("DRIVER3_NAME", "")

    context.user_data["waybill"] = wb

    await update.message.reply_text(
        f"وثيقة نقل جديدة.\n"
        f"اكتب تاريخ الوثيقة (مثال: {today_str}).\n"
        f"مكان الإصدار: {wb['ISSUING_PLACE']}\n"
        f"رقم السند (تلقائي): {wb['SERIAL_NO']}"
    )
    return WB_DATE


async def wb_date_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["DATE"] = update.message.text.strip()

    senders = get_parties("sender")
    if senders:
        keyboard = [[s[1]] for s in senders]
        await update.message.reply_text(
            "اختر اسم المرسل من القائمة أو اكتب جديد:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("اكتب اسم المرسل (Consignor / Shipper)")
    return WB_CONSIGNOR_NAME


async def wb_consignor_name_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    name = update.message.text.strip()

    row = get_party_by_name("sender", name)
    if row:
        _, n, addr, phone = row
        wb["CONSIGNOR_NAME"] = n
        wb["CONSIGNOR_ADDRESS"] = addr or ""
        wb["CONSIGNOR_PHONE"] = phone or ""
        await update.message.reply_text(f"تم اختيار المرسل المحفوظ: {n}", reply_markup=ReplyKeyboardRemove())
    else:
        wb["CONSIGNOR_NAME"] = name

    locations = get_locations()
    if locations:
        keyboard = [[loc] for loc in locations]
        await update.message.reply_text(
            "اختر عنوان المرسل من القائمة أو اكتب جديد:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("اكتب عنوان المرسل (مدينة / دولة)")
    return WB_CONSIGNOR_ADDRESS


async def wb_consignor_address_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    text = update.message.text.strip()
    wb["CONSIGNOR_ADDRESS"] = text
    add_party("location", f"loc:{text}", text, "")
    await update.message.reply_text("اكتب رقم هاتف المرسل (أو / لو لا يوجد)")
    return WB_CONSIGNOR_PHONE


async def wb_consignor_phone_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["CONSIGNOR_PHONE"] = update.message.text.strip()

    add_party("sender", wb.get("CONSIGNOR_NAME", ""), wb.get("CONSIGNOR_ADDRESS", ""), wb.get("CONSIGNOR_PHONE", ""))

    # ✅ اختيار اسم السائق فقط
    names = get_drivers_names()
    if names:
        keyboard = [[n] for n in names]
        await update.message.reply_text(
            "اختر اسم السائق من القائمة:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("لا يوجد سائقين محفوظين. اكتب اسم السائق:", reply_markup=ReplyKeyboardRemove())

    return WB_DRIVER_PICK


async def wb_driver_pick_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    picked_name = update.message.text.strip()
    wb["DRIVER1_NAME"] = picked_name

    d = get_driver_by_name(picked_name)
    if d:
        vno = _pick_vehicle_no(d)
        reg = _pick_vehicle_region(d)
        ttype = _pick_transport_type(d)

        if vno:
            wb["VEHICLE1_NO"] = vno
        if reg:
            wb["VEHICLE1_REGION"] = reg
        if ttype:
            wb["TYPE1_TRANSPORT"] = ttype

    consignees = get_parties("consignee")
    if consignees:
        keyboard = [[c[1]] for c in consignees]
        await update.message.reply_text(
            "اختر اسم المستلم من القائمة أو اكتب اسم جديد:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("اكتب اسم المستلم (Consignee)", reply_markup=ReplyKeyboardRemove())

    return WB_CONSIGNEE_NAME


async def wb_consignee_name_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    name = update.message.text.strip()

    row = get_party_by_name("consignee", name)
    if row:
        _, n, addr, phone = row
        wb["CONSIGNEE_NAME"] = n
        wb["CONSIGNEE_ADDRESS"] = addr or ""
        wb["CONSIGNEE_PHONE"] = phone or ""
        await update.message.reply_text(f"تم اختيار المستلم المحفوظ: {n}", reply_markup=ReplyKeyboardRemove())
    else:
        wb["CONSIGNEE_NAME"] = name

    locations = get_locations()
    if locations:
        keyboard = [[loc] for loc in locations]
        await update.message.reply_text(
            "اختر عنوان المستلم من القائمة أو اكتب جديد:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("اكتب عنوان المستلم (مدينة / دولة)")
    return WB_CONSIGNEE_ADDRESS


async def wb_consignee_address_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    text = update.message.text.strip()
    wb["CONSIGNEE_ADDRESS"] = text
    add_party("location", f"loc:{text}", text, "")
    await update.message.reply_text("اكتب رقم هاتف المستلم")
    return WB_CONSIGNEE_PHONE


async def wb_consignee_phone_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["CONSIGNEE_PHONE"] = update.message.text.strip()
    add_party("consignee", wb.get("CONSIGNEE_NAME", ""), wb.get("CONSIGNEE_ADDRESS", ""), wb.get("CONSIGNEE_PHONE", ""))

    goods = get_goods_natures()
    if goods:
        keyboard = [[g] for g in goods]
        await update.message.reply_text(
            "اختر طبيعة البضاعة من القائمة أو اكتب جديد:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("اكتب طبيعة البضاعة")
    return WB_GOODS_NATURE


async def wb_goods_nature_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.strip()
    if not text:
        await update.message.reply_text("الرجاء كتابة طبيعة البضاعة")
        return WB_GOODS_NATURE

    wb = context.user_data["waybill"]
    wb["GOODS_NATURE"] = text
    add_goods_nature(text)

    await update.message.reply_text("اكتب رقم التعرفة (إن وجد، أو 0)")
    return WB_TARIFF_CODE


async def wb_tariff_code_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["TARIFF_CODE"] = update.message.text.strip()
    await update.message.reply_text("اكتب الوزن القائم (كغم)")
    return WB_GROSS_WEIGHT


async def wb_gross_weight_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["GROSS_WEIGHT"] = update.message.text.strip()
    await update.message.reply_text("اكتب الأرقام والعلامات (Marks) أو 0")
    return WB_MARKS


async def wb_marks_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["MARKS"] = update.message.text.strip()
    await update.message.reply_text("اكتب عدد الطرود")
    return WB_PACKAGES_COUNT


async def wb_packages_count_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["PACKAGES_COUNT"] = update.message.text.strip()

    keyboard = [["طرد"], ["طبلية"], ["كرتونة"]]
    await update.message.reply_text(
        "اختر نوع التغليف:",
        reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
    )
    return WB_PACKING_METHOD


async def wb_packing_method_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["PACKING_METHOD"] = update.message.text.strip()
    await update.message.reply_text("اكتب المستندات المرفقة (أو 0)", reply_markup=ReplyKeyboardRemove())
    return WB_ANNEXED_DOCS


async def wb_annexed_docs_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    wb["ANNEXED_DOCS"] = update.message.text.strip()

    routes = get_routes()
    if routes:
        keyboard = [[r] for r in routes]
        await update.message.reply_text(
            "اختر خط السير من القائمة أو اكتب جديد:",
            reply_markup=ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=True),
        )
    else:
        await update.message.reply_text("اكتب خط السير")
    return WB_ROUTE


async def wb_route_step(update: Update, context: ContextTypes.DEFAULT_TYPE):
    wb = context.user_data["waybill"]
    val = update.message.text.strip()
    wb["ROUTE"] = val
    add_route(val)

    wb.setdefault("CARRIER_NAME", "مؤسسة شرق العالم العربي للنقل البري")
    wb.setdefault("DELIVERY_PLACE_DATE", "العراق - بغداد – خلال 10 أيام من تاريخ الورود")
    wb.setdefault("TAKING_PLACE_DATE", f"الأردن - عمان – {wb.get('DATE', '')}")
    wb.setdefault("RESERVATION_DAYS", "2")
    wb.setdefault("FREIGHT_CHARGE", "0")
    wb.setdefault("FREIGHT_PAY_PLACE_AR", "العراق - بغداد")
    wb.setdefault("FREIGHT_PAY_PLACE_EN", "Paid in Iraq – Baghdad")
    wb.setdefault("DEMURRAGE_LOADING", "48")

    wb.setdefault("CHARGE1_CONSIGNEE", "0")
    wb.setdefault("CHARGE1_CURRENCY", "0")
    wb.setdefault("CHARGE1_CONSIGNOR", "0")
    wb.setdefault("CHARGE2_CONSIGNEE", "0")
    wb.setdefault("CHARGE2_CURRENCY", "0")
    wb.setdefault("CHARGE2_CONSIGNOR", "0")
    wb.setdefault("CHARGE3_CONSIGNEE", "0")
    wb.setdefault("CHARGE3_CURRENCY", "0")
    wb.setdefault("CHARGE3_CONSIGNOR", "0")
    wb.setdefault("DEDUCTIONS", "0")

    wb.setdefault("CONSIGNER_INSTRUCTION", "إصدار نسخة من إذن الإدخال ...")
    wb.setdefault("SPECIAL_TERMS", "بدون اتفاقيات خاصة")
    wb.setdefault("CASH_ON_DELIVERY", "")

    waybill_id = save_waybill(wb)
    html = generate_waybill_html_from_template(wb)

    out_dir = Path("forms/waybills")
    out_dir.mkdir(parents=True, exist_ok=True)

    serial = wb.get("SERIAL_NO", f"WB{waybill_id}")
    html_path = out_dir / f"waybill_{serial}.html"
    pdf_path = out_dir / f"waybill_{serial}.pdf"
    html_path.write_text(html, encoding="utf-8")

    try:
        html_to_pdf(html, pdf_path)
        await update.message.reply_text(f"تم إنشاء وثيقة النقل رقم {serial}.\nرقم داخلي: {waybill_id}\nتم إنشاء PDF.")
        await update.message.reply_document(document=open(pdf_path, "rb"))
    except Exception as e:
        await update.message.reply_text(f"تم إنشاء الوثيقة رقم {serial} لكن فشل PDF.\nالخطأ: {e}\nسأرسل HTML بدل PDF.")
        await update.message.reply_document(document=open(html_path, "rb"))

    return ConversationHandler.END


async def cancel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text("تم إلغاء العملية.", reply_markup=ReplyKeyboardRemove())
    return ConversationHandler.END


def main():
    import asyncio

    init_db()

    app = Application.builder().token(BOT_TOKEN).build()

    invoice_conv = ConversationHandler(
        entry_points=[CommandHandler("newinvoice", newinvoice)],
        states={
            COMPANY: [MessageHandler(filters.TEXT & ~filters.COMMAND, company_step)],
            CUSTOMER_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, customer_name_step)],
            CUSTOMER_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, customer_code_step)],
            INVOICE_NUMBER: [MessageHandler(filters.TEXT & ~filters.COMMAND, invoice_number_step)],
            WEIGHT: [MessageHandler(filters.TEXT & ~filters.COMMAND, weight_step)],
            PALLETS: [MessageHandler(filters.TEXT & ~filters.COMMAND, pallets_step)],
            VALUE: [MessageHandler(filters.TEXT & ~filters.COMMAND, value_step)],
            QTY: [MessageHandler(filters.TEXT & ~filters.COMMAND, qty_step)],
            DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, date_step)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )

    waybill_conv = ConversationHandler(
        entry_points=[CommandHandler("newwaybill", newwaybill)],
        states={
            WB_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_date_step)],
            WB_CONSIGNOR_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_consignor_name_step)],
            WB_CONSIGNOR_ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_consignor_address_step)],
            WB_CONSIGNOR_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_consignor_phone_step)],
            WB_DRIVER_PICK: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_driver_pick_step)],
            WB_CONSIGNEE_NAME: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_consignee_name_step)],
            WB_CONSIGNEE_ADDRESS: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_consignee_address_step)],
            WB_CONSIGNEE_PHONE: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_consignee_phone_step)],
            WB_GOODS_NATURE: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_goods_nature_step)],
            WB_TARIFF_CODE: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_tariff_code_step)],
            WB_GROSS_WEIGHT: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_gross_weight_step)],
            WB_MARKS: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_marks_step)],
            WB_PACKAGES_COUNT: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_packages_count_step)],
            WB_PACKING_METHOD: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_packing_method_step)],
            WB_ANNEXED_DOCS: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_annexed_docs_step)],
            WB_ROUTE: [MessageHandler(filters.TEXT & ~filters.COMMAND, wb_route_step)],
        },
        fallbacks=[CommandHandler("cancel", cancel)],
        allow_reentry=True,
    )

    app.add_handler(CommandHandler("start", start))
    app.add_handler(invoice_conv)
    app.add_handler(waybill_conv)

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    print("Bot is running...")
    app.run_polling()


if __name__ == "__main__":
    main()
