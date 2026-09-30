// ✅ تعريفات مشتركة لنموذج البوليصة (إنشاء + تعديل) — نفس الحقول، نفس
// التسميات، نفس الخيارات. أرقام الخانات مأخوذة حرفياً من القالب المطبوع
// (server/templates/waybill_template.html و public/waybill_template.html).
// الخانات التي لا تحمل رقماً في القالب المطبوع تبقى بدون رقم.
import { ref, computed } from "vue";
import axios from "axios";

export const WB_LABELS = {
  SERIAL_NO: "رقم السند",
  DATE: "التاريخ",
  ISSUING_PLACE: "مكان الإصدار",

  CONSIGNOR: "المرسل",
  CONSIGNEE: "المستلم",
  PARTY_NAME: "الاسم",
  PARTY_ADDRESS: "العنوان",
  PARTY_PHONE: "الهاتف",

  // (10) / (11) / (12) — جدول وسيلة النقل
  TYPE_TRANSPORT: "(10) نوع وسيلة النقل",
  VEHICLE_NO: "(11) رقم تسجيل المركبة",
  VEHICLE_REGION: "(11) المنطقة / الدولة",
  DRIVER_NAME: "(12) اسم السائق",

  TAKING_PLACE_DATE: "مكان وتاريخ استلام البضاعة",
  DELIVERY_PLACE_DATE: "مكان وتاريخ تسليم البضاعة",
  ROUTE: "خط السير إلى الجهة النهائية",

  // (15) → (20) — جدول البضاعة (نفس ترتيب القالب المطبوع)
  MARKS: "(15) الأرقام والعلامات",
  PACKAGES_COUNT: "(16) عدد الطرود",
  PACKING_METHOD: "(17) نوع التغليف",
  GOODS_NATURE: "(18) طبيعة البضاعة",
  TARIFF_CODE: "(19) رقم التعريفة",
  GROSS_WEIGHT: "(20) الوزن القائم/كغم",
  ANNEXED_DOCS: "المستندات المرفقة",

  // (11) ملاحظات وحجوزات الناقل
  RESERVATION_DAYS: "(11) بدل عطل (أيام)",
  FREIGHT_CHARGE: "(11) أجور الشحن",
  FREIGHT_PAY_PLACE_AR: "(11) تدفع في (عربي)",
  FREIGHT_PAY_PLACE_EN: "(11) Paid at (English)",

  DEMURRAGE_LOADING: "(23) مدة المكوث عند التحميل",
  CONSIGNER_INSTRUCTION: "(24) تعليمات المرسل",
  SPECIAL_TERMS: "(28) اتفاقيات خاصة",
  CASH_ON_DELIVERY: "(29) الدفع عند التسليم",
  CASH_ON_DELIVERY_NOTES: "(29) ملاحظات إضافية",
};

export const WB_PLACEHOLDERS = {
  TYPE_TRANSPORT: "اختر النوع",
  DRIVER_SEARCH: "اكتب رقم السيارة / اسم السائق...",
  CONSIGNOR_SEARCH: "ابحث عن المرسل...",
  CONSIGNEE_SEARCH: "ابحث عن المستلم...",
  TAKING_PLACE: "مكان الاستلام",
  DELIVERY_PLACE: "مكان التسليم",
  ROUTE: "عمّان → الحدود → بغداد",
  ANNEXED_DOCS: "Invoice, Packing List...",
};

/* ✅ نوع المركبة / التريلا — قيمة على مستوى البوليصة، لا تعدّل سجل السائق */
export const TRANSPORT_TYPE_OPTIONS = ["تريلا - سطحة", "تريلا", "سطحة"];
export const PACKING_METHOD_OPTIONS = ["طرد", "وحدة", "طبلية", "كرتونة"];

// خيارات select مع الحفاظ على أي قيمة قديمة غير موجودة في القائمة
export function optionsWith(options, current) {
  const v = String(current ?? "").trim();
  return v && !options.includes(v) ? [...options, v] : options;
}

/* =========================
   Drivers
========================= */
export function getDriverName(d) {
  return (
    d?.DRIVER_NAME ?? d?.driver_name ?? d?.name ?? d?.NAME ?? d?.fullName ??
    d?.FULL_NAME ?? d?.arabic_name ?? d?.ARABIC_NAME ?? d?.title ?? d?.TITLE ?? ""
  );
}
export function getVehicleNo(d) {
  return (
    d?.VEHICLE_NO ?? d?.vehicle_no ?? d?.vehicleNumber ?? d?.plate_no ??
    d?.PLATE_NO ?? d?.car_no ?? d?.CAR_NO ?? d?.vehicle ?? d?.VEHICLE ?? ""
  );
}
export function getVehicleRegion(d) {
  return (
    d?.VEHICLE_REGION ?? d?.vehicle_city ?? d?.vehicle_region ?? d?.region ??
    d?.REGION ?? d?.country ?? d?.COUNTRY ?? ""
  );
}

// ✅ تعبئة تلقائية من سجل السائق (vehicleType)، وإلا استنتاج من النص
export function driverTypeFromMaster(driver) {
  const vt = String(driver?.vehicleType ?? driver?.vehicle_type ?? "").trim();
  if (vt) return vt;
  const t = String(
    driver?.VEHICLE_TYPE ?? driver?.type ?? driver?.TYPE ?? driver?.notes ?? driver?.NOTES ?? "",
  ).toLowerCase();
  if (t.includes("تريلا") || t.includes("trailer")) return "تريلا";
  if (t.includes("سطحة") || t.includes("flatbed")) return "سطحة";
  return "";
}

export function makeDriverRow(d) {
  return {
    driverId: d?._id || d?.id || null,
    DRIVER_NAME: getDriverName(d) || "",
    VEHICLE_NO: getVehicleNo(d) || "",
    VEHICLE_REGION: getVehicleRegion(d) || "",
    TYPE_TRANSPORT: driverTypeFromMaster(d),
  };
}

export function driverRowKey(x) {
  return String(x?.driverId || x?._id || x?.id || x?.VEHICLE_NO || x?.DRIVER_NAME || "");
}

// ✅ نفس مخطط الحفظ لكلا الشاشتين: TYPEn/VEHICLEn/DRIVERn (ما يطبعه القالب)
// + الحقول القديمة (driver_ids, VEHICLE_NO, DRIVER_NAME, VEHICLE_REGION, TYPE_TRANSPORT)
export function driverRowsToPayload(rows) {
  const out = {};
  for (let i = 1; i <= 50; i++) {
    out[`TYPE${i}_TRANSPORT`] = "";
    out[`VEHICLE${i}_NO`] = "";
    out[`VEHICLE${i}_REGION`] = "";
    out[`DRIVER${i}_NAME`] = "";
  }
  const cleaned = (rows || []).filter((r) =>
    String(r?.DRIVER_NAME || r?.VEHICLE_NO || r?.VEHICLE_REGION || r?.TYPE_TRANSPORT || "").trim(),
  );
  cleaned.forEach((r, idx) => {
    const n = idx + 1;
    out[`TYPE${n}_TRANSPORT`] = r.TYPE_TRANSPORT || "";
    out[`VEHICLE${n}_NO`] = r.VEHICLE_NO || "";
    out[`VEHICLE${n}_REGION`] = r.VEHICLE_REGION || "";
    out[`DRIVER${n}_NAME`] = r.DRIVER_NAME || "";
  });
  const join = (k) => cleaned.map((r) => r[k]).filter(Boolean).join("\n");
  out.driver_ids = cleaned.map((r) => r.driverId).filter(Boolean).map(String);
  out.DRIVER_NAME = join("DRIVER_NAME");
  out.VEHICLE_NO = join("VEHICLE_NO");
  out.VEHICLE_REGION = join("VEHICLE_REGION");
  out.TYPE_TRANSPORT = cleaned[0]?.TYPE_TRANSPORT || "";
  return out;
}

/* =========================
   Goods
========================= */
export function makeEmptyGoodsItem() {
  return {
    GOODS_NATURE: "",
    TARIFF_CODE: "",
    GROSS_WEIGHT: 0,
    MARKS: "",
    PACKAGES_COUNT: 0,
    PACKING_METHOD: "طرد",
  };
}

// ✅ goodsItems هو المصدر الأساسي؛ البوليصات القديمة → بند واحد من الحقول المسطّحة
export function goodsItemsFromWaybill(wb) {
  if (Array.isArray(wb?.goodsItems) && wb.goodsItems.length) {
    return wb.goodsItems.map((it) => ({ ...makeEmptyGoodsItem(), ...it }));
  }
  const any = ["GOODS_NATURE", "TARIFF_CODE", "GROSS_WEIGHT", "MARKS", "PACKAGES_COUNT", "PACKING_METHOD"]
    .some((k) => String(wb?.[k] ?? "").trim());
  if (!any) return [makeEmptyGoodsItem()];
  return [
    {
      GOODS_NATURE: wb.GOODS_NATURE ?? "",
      TARIFF_CODE: wb.TARIFF_CODE ?? "",
      GROSS_WEIGHT: wb.GROSS_WEIGHT ?? 0,
      MARKS: wb.MARKS ?? "",
      PACKAGES_COUNT: wb.PACKAGES_COUNT ?? 0,
      PACKING_METHOD: wb.PACKING_METHOD || "طرد",
    },
  ];
}

// ✅ الحقول المسطّحة القديمة = أول بند (back-compat)
export function legacyGoodsFields(items) {
  const first = items?.[0];
  if (!first) return {};
  return {
    GOODS_NATURE: first.GOODS_NATURE || "",
    TARIFF_CODE: first.TARIFF_CODE || "",
    GROSS_WEIGHT: first.GROSS_WEIGHT || 0,
    MARKS: first.MARKS || "",
    PACKAGES_COUNT: first.PACKAGES_COUNT || 0,
    PACKING_METHOD: first.PACKING_METHOD || "طرد",
  };
}

// ✅ طبيعة البضاعة: قائمة من الـ API + إضافة جديد (نفس السلوك في الشاشتين)
export function useGoodsNatures(apiBase) {
  const INITIAL = ["سيارات ركوب وشحن رباعية", "علب بلاستيكية", "مواد إنشائية"];
  const goodsNatureOptions = ref([]);
  const goodsNatureOpenIndex = ref(-1);
  const goodsNatureQuery = ref("");

  async function fetchGoodsNatures() {
    try {
      const res = await axios.get(`${apiBase()}/api/goods-natures`);
      const list = Array.isArray(res.data) ? res.data : [];
      goodsNatureOptions.value = Array.from(new Set([...INITIAL, ...list]));
    } catch (e) {
      console.error("goods natures error:", e);
      goodsNatureOptions.value = [...INITIAL];
    }
  }

  const filteredGoodsNatures = computed(() => {
    const q = String(goodsNatureQuery.value || "").trim();
    if (!q) return goodsNatureOptions.value;
    return goodsNatureOptions.value.filter((n) => n.includes(q));
  });

  function isNewGoodsNature() {
    const q = String(goodsNatureQuery.value || "").trim();
    return !!q && !goodsNatureOptions.value.some((n) => n === q);
  }

  function selectGoodsNature(items, i, name) {
    items[i].GOODS_NATURE = name;
    goodsNatureOpenIndex.value = -1;
    goodsNatureQuery.value = "";
  }

  async function addGoodsNature(items, i) {
    const name = String(goodsNatureQuery.value || "").trim();
    if (!name) return;
    try {
      await axios.post(`${apiBase()}/api/goods-natures`, { name });
      if (!goodsNatureOptions.value.includes(name)) goodsNatureOptions.value.push(name);
      selectGoodsNature(items, i, name);
    } catch (e) {
      console.error("add goods nature error:", e);
    }
  }

  return {
    goodsNatureOptions,
    goodsNatureOpenIndex,
    goodsNatureQuery,
    filteredGoodsNatures,
    fetchGoodsNatures,
    isNewGoodsNature,
    selectGoodsNature,
    addGoodsNature,
  };
}

/* =========================
   Place + date ("مكان - YYYY-MM-DD")
========================= */
export function splitPlaceDate(s) {
  const v = String(s || "").trim();
  const m = v.match(/^(.*) - (\d{4}-\d{2}-\d{2})$/);
  return m ? { place: m[1], date: m[2] } : { place: v, date: "" };
}
export function joinPlaceDate(place, date) {
  const p = String(place || "").trim();
  return p && date ? `${p} - ${date}` : p;
}

/* =========================
   Numbers + validation
========================= */
export const NUMERIC_FIELDS = [
  "RESERVATION_DAYS",
  "FREIGHT_CHARGE",
  "DEMURRAGE_LOADING",
  "CHARGE1_CONSIGNEE",
  "CHARGE1_CONSIGNOR",
  "CHARGE2_CONSIGNEE",
  "CHARGE2_CONSIGNOR",
  "CHARGE3_CONSIGNEE",
  "CHARGE3_CONSIGNOR",
  "DEDUCTIONS",
];
export function normalizeNumericFields(form) {
  for (const k of NUMERIC_FIELDS) {
    if (k in form && !Number.isFinite(Number(form[k]))) form[k] = 0;
  }
}

// ✅ نفس قواعد التحقق للشاشتين. errors يُعبّأ لحقول خط السير.
export function validateWaybillForm({ form, driverRows, taking, delivery, errors }) {
  if (!form.DATE) return "التاريخ مطلوب";
  if (!String(form.CONSIGNOR_NAME || "").trim()) return "اختر المرسل من البحث";
  if (!String(form.CONSIGNEE_NAME || "").trim()) return "اختر المستلم من البحث";
  if (!(driverRows || []).length) return "اختر سائق/مركبة من البحث";
  if (!String(driverRows[0]?.VEHICLE_NO || "").trim()) return "رقم المركبة مطلوب";

  errors.takingPlace = String(taking.place || "").trim() ? "" : "يرجى اختيار مكان الاستلام";
  errors.takingDate = taking.date ? "" : "يرجى تحديد تاريخ الاستلام";
  errors.deliveryPlace = String(delivery.place || "").trim() ? "" : "يرجى اختيار مكان التسليم";
  errors.deliveryDate = delivery.date ? "" : "يرجى تحديد تاريخ التسليم";
  errors.route = String(form.ROUTE || "").trim() ? "" : "يرجى تحديد خط السير";
  if (Object.values(errors).some(Boolean)) return "يرجى تعبئة بيانات خط السير والاستلام والتسليم";
  return "";
}
