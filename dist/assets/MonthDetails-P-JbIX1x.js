import{_ as ct,r as g,c as u,u as ut,o as mt,w as vt,a as r,b as n,t as a,d as R,e as C,v as I,n as U,f as W,F as T,g as $,h as q,i as pt,j as d}from"./index-3_VouVtM.js";async function ht({customerName:M="",customerAddress:S="",periodFrom:D="",periodTo:f="",rows:_=[]}){const p=c=>Number(c||0).toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:3}),m=c=>String(c??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"),A=(_||[]).map(c=>`
        <tr>
          <td class="center" dir="ltr">${m(c.invoice_number)}</td>
          <td>${m(c.company)}</td>
          <td class="center" dir="ltr">${m(c.created_at)}</td>
          <td class="right" dir="ltr">${p(c.value)}</td>
        </tr>
      `.trim()).join(`
`),y=p((_||[]).reduce((c,k)=>c+(Number(k.value||0)||0),0)),b=`<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>كشف حساب جاري</title>

    <style>
      :root {
        --blue: #2f42ff;
        --rowA: #ffffff;
        --rowB: #c6cdcf;
        --text: #111;
        --muted: #444;
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        font-family: "Tahoma", Arial, sans-serif;
        color: var(--text);
        background: #fff;
      }

      .page {
        width: 900px;
        margin: 18px auto;
        padding: 8px 10px 20px;
      }

      /* Header */
      .top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 10px;
      }

      .brand {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .logo {
        width: 52px;
        height: 52px;
        background: #111;
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 36px;
        border-radius: 2px;
      }

      .brand h1 {
        margin: 0;
        font-size: 26px;
        letter-spacing: 0.5px;
      }

      .brand .addr {
        margin-top: 2px;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.5;
      }

      .titleBlock {
        text-align: left;
        margin-top: 6px;
        min-width: 260px;
      }

      .titleBlock .title {
        font-size: 14px;
        font-weight: 700;
      }

      .titleBlock .pageNo {
        font-size: 12px;
        color: var(--muted);
        margin-top: 2px;
      }

      .divider {
        height: 2px;
        background: #111;
        margin: 8px 0 12px;
      }

      /* Customer + Period */
      .infoRow {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        align-items: flex-start;
        margin: 6px 0 14px;
      }

      .customer {
        padding-right: 8px;
        border-right: 3px solid #111;
        min-width: 360px;
      }

      .customer .name {
        font-weight: 800;
        font-size: 14px;
        margin-bottom: 2px;
      }

      .customer .lines {
        font-size: 13px;
        line-height: 1.4;
        white-space: pre-line;
      }

      .periodBox {
        width: 360px;
        border-collapse: collapse;
        font-size: 13px;
      }

      .periodBox th {
        background: var(--blue);
        color: #fff;
        padding: 6px 8px;
        text-align: center;
        font-weight: 800;
      }

      .periodBox td {
        padding: 7px 8px;
        border: 1px solid #c9d3ff;
        text-align: center;
        font-weight: 700;
      }

      /* Table */
      table.statement {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
      }

      table.statement th {
        background: var(--blue);
        color: #fff;
        padding: 6px 8px;
        text-align: center;
        font-weight: 800;
        border-right: 2px solid #fff;
      }

      table.statement th:last-child { border-right: none; }

      table.statement td {
        padding: 8px 10px; /* ✅ خليتها طبيعية بدل 72px */
        vertical-align: middle;
      }

      table.statement tbody tr:nth-child(odd) td { background: var(--rowA); }
      table.statement tbody tr:nth-child(even) td { background: var(--rowB); }

      .right { text-align: right; }
      .center { text-align: center; }

      .totalsRow td {
        background: var(--rowB) !important;
        font-weight: 800;
        padding: 10px 10px;
      }

      .totalsLabel {
        text-align: center;
        letter-spacing: 0.5px;
      }

      @media print {
        .page { width: auto; margin: 0; }
      }
    </style>
  </head>

  <body>
    <div class="page">
      <div class="top">
        <div class="brand">
          <div class="logo">س</div>
          <div>
            <h1>مؤسسة شرق العالم العربي للنقل البري</h1>
            <div class="addr">
              عمّان - أبو علندا - بجانب البنك الإسلامي تلفاكس: \\ 4162136 /
              4162133 ص.ب 44 رمز بريدي 11592 عمّان - الأردن
            </div>
          </div>
        </div>

        <div class="titleBlock">
          <div class="title">كشف حساب جاري</div>
          <div class="pageNo">الصفحة: 1 من 1</div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="infoRow">
        <div class="customer">
          <div class="name">${m(M)}</div>
          <div class="lines">${m(S)}</div>
        </div>

        <table class="periodBox">
          <tr><th>فترة الكشف</th></tr>
          <tr><td>${m(D)} إلى ${m(f)}</td></tr>
        </table>
      </div>

      <table class="statement">
        <thead>
          <tr>
            <th>رقم الفاتورة</th>
            <th>اسم الشركة</th>
            <th>تاريخ الإدخال</th>
            <th>قيمة الفاتورة</th>
          </tr>
        </thead>

        <tbody>
          ${A||'<tr><td colspan="4" class="center">لا يوجد بيانات</td></tr>'}

          <tr class="totalsRow">
            <td colspan="3" class="totalsLabel">*** إجمالي قيمة الفواتير ***</td>
            <td class="right" dir="ltr">${y}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <script>
      // اطبع بعد ما تجهز الصفحة
      window.onload = () => {
        window.focus();
        window.print();
      };
    <\/script>
  </body>
</html>`,v=window.open("","_blank","width=980,height=700");if(!v)throw new Error("Popup blocked. Please allow popups for printing.");v.document.open(),v.document.write(b),v.document.close()}const gt={class:"page"},ft={class:"topbar"},_t={class:"title"},yt={class:"actions"},bt=["disabled"],xt=["disabled"],Nt={class:"main"},Et={key:0,class:"alert"},wt={class:"filters"},St={class:"mini"},At={class:"mini"},kt={class:"tabs"},Tt={class:"badge"},$t={class:"badge"},Dt={key:1,class:"loading"},Ot={key:2,class:"summary"},Rt={key:0,class:"sum-row"},Ct={class:"sum-card"},It={class:"sum-val"},Mt={class:"sum-card"},Bt={class:"sum-val",dir:"ltr"},Vt={key:1,class:"sum-row"},Lt={class:"sum-card"},Ft={class:"sum-val"},zt={class:"sum-card"},jt={class:"sum-val"},Ht={class:"sum-card"},Pt={class:"sum-val"},Gt={class:"table-card"},Ut={key:0,class:"table table--invoices"},Wt={class:"td-number",dir:"ltr"},qt=["title"],Jt={class:"td-value",dir:"ltr"},Kt={class:"muted td-date",dir:"ltr"},Yt={class:"muted td-entry",dir:"ltr"},Qt={key:0},Xt={key:1,class:"table"},Zt={dir:"ltr"},te={class:"mono"},ee={class:"muted",dir:"ltr"},ne=["title"],se=["title"],le={class:"driver-cell",dir:"ltr"},ie={class:"driver-cell"},ae={key:0},J="http://127.0.0.1:4000",oe={__name:"MonthDetails",setup(M){const S=ut(),D=pt(),f=g(!1),_=g(""),p=g("invoices"),m=g([]),A=g([]),y=g(""),x=g(""),N=g(""),b=u(()=>Number(S.params.year)),v=u(()=>Number(S.params.month));function c(){const e=String(b.value),t=String(v.value).padStart(2,"0");return`${e}-${t}`}function k(e,t){const s=new Date(e,t-1,1),l=new Date(e,t,0),i=o=>o.toISOString().slice(0,10);return{from:i(s),to:i(l)}}function K(e){if(!e)return"";const t=new Date(e);if(!Number.isFinite(t.getTime()))return String(e);const s=t.getFullYear(),l=String(t.getMonth()+1).padStart(2,"0"),i=String(t.getDate()).padStart(2,"0");let o=t.getHours();const ot=String(t.getMinutes()).padStart(2,"0"),rt=o>=12?"م":"ص";o=o%12,o=o||12;const dt=String(o).padStart(2,"0");return`${s}-${l}-${i} ${dt}:${ot} ${rt}`}async function Y(){const{from:e,to:t}=k(b.value,v.value);await ht({customerName:"كشف حساب الشهر",customerAddress:"",periodFrom:e,periodTo:t,rows:E.value.map(s=>({invoice_number:s.invoice_number??"",company:s.company??"",created_at:(s.created_at||s.date||"").slice(0,10),value:s.value_jod??0}))})}function B(e,t){return new Date(e,t-1,1,0,0,0).getTime()}function V(e,t){return new Date(e,t,0,23,59,59).getTime()}function Q(e){const t=new Date(`${e}T00:00:00`).getTime();return Number.isFinite(t)?t:null}function X(e){const t=new Date(`${e}T23:59:59`).getTime();return Number.isFinite(t)?t:null}function h(e){if(!e)return null;const t=new Date(e).getTime();return Number.isFinite(t)?t:null}function L(e,t,s){if(e==null)return!0;const l=t?Q(t):null,i=s?X(s):null;return!(l!=null&&e<l||i!=null&&e>i)}function F(e){return String(e??"").toLowerCase().trim()}function z(e){if(!y.value)return!0;const t=F(y.value);return Object.values(e||{}).some(s=>F(s).includes(t))}function Z(){D.push("/reports")}function O(e){return String(e?.SOURCE??e?.source??"").trim().toUpperCase()||"MANUAL"}function j(e){const t=[];for(let s=1;s<=50;s++){const l=e?.[`DRIVER${s}_NAME`]??e?.[`DRIVER${s}_NAME`.toLowerCase()]??"",i=e?.[`VEHICLE${s}_NO`]??e?.[`VEHICLE${s}_NO`.toLowerCase()]??"";if(!String(l||i).trim())break;t.push({name:String(l||"").trim(),vehicle:String(i||"").trim()})}if(!t.length){const s=e?.DRIVER_NAME??e?.driver_name??e?.DRIVER1_NAME??e?.driver1_name,l=e?.VEHICLE_NO??e?.vehicle_no??e?.VEHICLE1_NO??e?.vehicle1_no;String(s||l||"").trim()&&t.push({name:String(s||"").trim(),vehicle:String(l||"").trim()})}return t}function tt(e){const t=j(e).map(l=>l.vehicle).filter(Boolean);if(t.length)return t;const s=e?.VEHICLE_NO||e?.vehicle_no||e?.VEHICLE1_NO||e?.vehicle1_no||"";return s?[s]:[]}function et(e){const t=j(e).map(l=>l.name).filter(Boolean);if(t.length)return t;const s=e?.DRIVER_NAME||e?.driver_name||e?.DRIVER1_NAME||e?.driver1_name||"";return s?[s]:[]}async function H(){f.value=!0,_.value="";try{const[e,t]=await Promise.all([q.get(`${J}/api/invoices?limit=2000`),q.get(`${J}/api/waybills?limit=2000`)]);m.value=Array.isArray(e.data)?e.data:[],A.value=Array.isArray(t.data)?t.data:[]}catch(e){console.error(e),_.value="تعذّر تحميل بيانات الشهر."}finally{f.value=!1}}mt(H);const nt=u(()=>{const e=b.value,t=v.value,s=B(e,t),l=V(e,t);return(m.value||[]).filter(i=>{const o=h(i?.date)??h(i?.created_at);return o!=null&&o>=s&&o<=l})}),st=u(()=>{const e=b.value,t=v.value,s=B(e,t),l=V(e,t);return(A.value||[]).filter(i=>{const o=h(i?.DATE)??h(i?.created_at);return o!=null&&o>=s&&o<=l})}),E=u(()=>nt.value.filter(e=>z(e)).filter(e=>{const t=h(e?.date)??h(e?.created_at);return L(t,x.value,N.value)})),w=u(()=>st.value.filter(e=>z(e)).filter(e=>{const t=h(e?.DATE)??h(e?.created_at);return L(t,x.value,N.value)})),P=u(()=>E.value.length),lt=u(()=>E.value.reduce((e,t)=>e+(Number(t?.value_jod||0)||0),0)),G=u(()=>w.value.length),it=u(()=>w.value.filter(e=>O(e)==="BOT").length),at=u(()=>w.value.filter(e=>O(e)!=="BOT").length);return vt([b,v],()=>{y.value="",x.value="",N.value=""}),(e,t)=>(d(),r("div",gt,[n("header",ft,[n("div",null,[n("div",_t,"تفاصيل شهر "+a(c()),1),t[5]||(t[5]=n("div",{class:"subtitle"},"بيانات الشهر كاملة + فلترة داخل الصفحة",-1))]),n("div",yt,[n("button",{class:"btn btn--secondary",onClick:Z}," ⬅ رجوع للتقارير "),n("button",{class:"btn btn--secondary",disabled:f.value,onClick:Y}," 🖨️ طباعة كشف الحساب ",8,bt),n("button",{class:"btn btn--secondary",disabled:f.value,onClick:H}," 🔄 تحديث ",8,xt)])]),n("main",Nt,[_.value?(d(),r("div",Et,a(_.value),1)):R("",!0),n("div",wt,[C(n("input",{class:"inp","onUpdate:modelValue":t[0]||(t[0]=s=>y.value=s),placeholder:"🔎 بحث داخل الشهر..."},null,512),[[I,y.value]]),n("div",St,[t[6]||(t[6]=n("span",null,"من:",-1)),C(n("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[1]||(t[1]=s=>x.value=s)},null,512),[[I,x.value]])]),n("div",At,[t[7]||(t[7]=n("span",null,"إلى:",-1)),C(n("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[2]||(t[2]=s=>N.value=s)},null,512),[[I,N.value]])]),n("div",kt,[n("button",{class:U(["tab",{active:p.value==="invoices"}]),onClick:t[3]||(t[3]=s=>p.value="invoices")},[t[8]||(t[8]=W(" فواتير ",-1)),n("span",Tt,a(P.value),1)],2),n("button",{class:U(["tab",{active:p.value==="waybills"}]),onClick:t[4]||(t[4]=s=>p.value="waybills")},[t[9]||(t[9]=W(" بوالص ",-1)),n("span",$t,a(G.value),1)],2)])]),f.value?(d(),r("div",Dt,"جاري التحميل...")):(d(),r("div",Ot,[p.value==="invoices"?(d(),r("div",Rt,[n("div",Ct,[t[10]||(t[10]=n("div",{class:"sum-title"},"عدد الفواتير",-1)),n("div",It,a(P.value),1)]),n("div",Mt,[t[11]||(t[11]=n("div",{class:"sum-title"},"مجموع الفواتير (JOD)",-1)),n("div",Bt,a(Number(lt.value||0).toFixed(3)),1)])])):(d(),r("div",Vt,[n("div",Lt,[t[12]||(t[12]=n("div",{class:"sum-title"},"عدد البوالص",-1)),n("div",Ft,a(G.value),1)]),n("div",zt,[t[13]||(t[13]=n("div",{class:"sum-title"},"BOT",-1)),n("div",jt,a(it.value),1)]),n("div",Ht,[t[14]||(t[14]=n("div",{class:"sum-title"},"MANUAL",-1)),n("div",Pt,a(at.value),1)])])),n("div",Gt,[p.value==="invoices"?(d(),r("table",Ut,[t[16]||(t[16]=n("thead",null,[n("tr",null,[n("th",{class:"th-number",dir:"ltr"},"رقم"),n("th",{class:"th-company"},"الشركة"),n("th",{class:"th-value",dir:"ltr"},"القيمة"),n("th",{class:"th-date",dir:"ltr"},"التاريخ"),n("th",{class:"th-entry",dir:"ltr"},"الإدخال")])],-1)),n("tbody",null,[(d(!0),r(T,null,$(E.value,s=>(d(),r("tr",{key:s._id},[n("td",Wt,a(s.invoice_number),1),n("td",{class:"clip td-company",title:s.company},a(s.company),9,qt),n("td",Jt,a(Number(s.value_jod||0).toFixed(3)),1),n("td",Kt,a(s.date),1),n("td",Yt,a(K(s.created_at)),1)]))),128)),E.value.length===0?(d(),r("tr",Qt,[...t[15]||(t[15]=[n("td",{colspan:"5",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):R("",!0)])])):(d(),r("table",Xt,[t[18]||(t[18]=n("thead",null,[n("tr",null,[n("th",{dir:"ltr"},"Serial"),n("th",null,"المصدر"),n("th",null,"تاريخ"),n("th",null,"المرسل"),n("th",null,"المرسل إليه"),n("th",null,"مركبة"),n("th",null,"سائق")])],-1)),n("tbody",null,[(d(!0),r(T,null,$(w.value,s=>(d(),r("tr",{key:s._id},[n("td",Zt,a(s.waybillNumber||s.SERIAL_NO),1),n("td",te,a(O(s)),1),n("td",ee,a(s.DATE),1),n("td",{class:"clip",title:s.CONSIGNOR_NAME},a(s.CONSIGNOR_NAME),9,ne),n("td",{class:"clip",title:s.CONSIGNEE_NAME},a(s.CONSIGNEE_NAME),9,se),n("td",le,[(d(!0),r(T,null,$(tt(s),(l,i)=>(d(),r("div",{key:i,class:"vehicle-no"},a(l),1))),128))]),n("td",ie,[(d(!0),r(T,null,$(et(s),(l,i)=>(d(),r("div",{key:i,class:"driver-name"},a(l),1))),128))])]))),128)),w.value.length===0?(d(),r("tr",ae,[...t[17]||(t[17]=[n("td",{colspan:"7",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):R("",!0)])]))])]))])]))}},de=ct(oe,[["__scopeId","data-v-792855fc"]]);export{de as default};
