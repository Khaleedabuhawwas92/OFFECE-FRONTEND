import{_ as ht,o as ft,w as gt,c as a,a as e,t as i,b as S,d as I,v as V,n as L,e as F,F as A,r as k,f as z,g as f,h as u,u as _t,i as yt,j as o}from"./index-CKwO4S79.js";async function bt({customerName:j="",customerAddress:b="",periodFrom:$="",periodTo:D="",rows:g=[]}){const _=d=>Number(d||0).toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:3}),r=d=>String(d??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"),w=(g||[]).map(d=>`
        <tr>
          <td class="center" dir="ltr">${r(d.invoice_number)}</td>
          <td>${r(d.company)}</td>
          <td class="center" dir="ltr">${r(d.created_at)}</td>
          <td class="right" dir="ltr">${_(d.value)}</td>
        </tr>
      `.trim()).join(`
`),C=_((g||[]).reduce((d,h)=>d+(Number(h.value||0)||0),0)),p=`<!doctype html>
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
          <div class="name">${r(j)}</div>
          <div class="lines">${r(b)}</div>
        </div>

        <table class="periodBox">
          <tr><th>فترة الكشف</th></tr>
          <tr><td>${r($)} إلى ${r(D)}</td></tr>
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
          ${w||'<tr><td colspan="4" class="center">لا يوجد بيانات</td></tr>'}

          <tr class="totalsRow">
            <td colspan="3" class="totalsLabel">*** إجمالي قيمة الفواتير ***</td>
            <td class="right" dir="ltr">${C}</td>
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
</html>`,m=window.open("","_blank","width=980,height=700");if(!m)throw new Error("Popup blocked. Please allow popups for printing.");m.document.open(),m.document.write(p),m.document.close()}const xt={class:"page"},Nt={class:"topbar"},Et={class:"title"},St={class:"actions"},At=["disabled"],kt=["disabled"],$t={class:"main"},wt={key:0,class:"alert"},Ct={class:"filters"},Tt={class:"mini"},Dt={class:"mini"},Ot={class:"tabs"},Rt={class:"badge"},Mt={class:"badge"},Bt={class:"badge"},It={key:1,class:"loading"},Vt={key:2,class:"summary"},Lt={key:0,class:"sum-row"},Ft={class:"sum-card"},zt={class:"sum-val"},jt={class:"sum-card"},Ht={class:"sum-val",dir:"ltr"},Pt={key:1,class:"sum-row"},Gt={class:"sum-card"},Ut={class:"sum-val"},Wt={class:"sum-card"},qt={class:"sum-val",dir:"ltr"},Jt={key:2,class:"sum-row"},Kt={class:"sum-card"},Yt={class:"sum-val"},Qt={class:"sum-card"},Xt={class:"sum-val"},Zt={class:"sum-card"},te={class:"sum-val"},ee={class:"table-card"},se={key:0,class:"table table--invoices"},ne={class:"td-number",dir:"ltr"},ie=["title"],le={class:"td-value",dir:"ltr"},ae={class:"muted td-date",dir:"ltr"},oe={class:"muted td-entry",dir:"ltr"},re={key:0},de={key:1,class:"table"},ce={dir:"ltr"},ue={class:"mono"},me={class:"muted",dir:"ltr"},ve=["title"],pe=["title"],he={dir:"ltr"},fe={class:"driver-cell"},ge={class:"driver-cell"},_e={key:0},ye={key:2,class:"table table--invoices"},be={class:"td-number",dir:"ltr"},xe=["title"],Ne=["title"],Ee={class:"td-value",dir:"ltr"},Se={class:"muted td-date",dir:"ltr"},Ae={key:0},ke={__name:"MonthDetails",setup(j){const b="http://127.0.0.1:4000",$=yt(),D=_t(),g=f(!1),_=f(""),r=f("invoices"),w=f([]),C=f([]),O=f([]),y=f(""),p=f(""),m=f(""),d=u(()=>Number($.params.year)),h=u(()=>Number($.params.month));function K(){const s=String(d.value),t=String(h.value).padStart(2,"0");return`${s}-${t}`}function R(s,t){const n=String(t).padStart(2,"0"),l=String(new Date(s,t,0).getDate()).padStart(2,"0");return{from:`${s}-${n}-01`,to:`${s}-${n}-${l}`}}function Y(s){if(!s)return"";const t=new Date(s);if(!Number.isFinite(t.getTime()))return String(s);const n=t.getFullYear(),l=String(t.getMonth()+1).padStart(2,"0"),c=String(t.getDate()).padStart(2,"0");let v=t.getHours();const mt=String(t.getMinutes()).padStart(2,"0"),vt=v>=12?"م":"ص";v=v%12,v=v||12;const pt=String(v).padStart(2,"0");return`${n}-${l}-${c} ${pt}:${mt} ${vt}`}async function Q(){const{from:s,to:t}=R(d.value,h.value);await bt({customerName:"كشف حساب الشهر",customerAddress:"",periodFrom:s,periodTo:t,rows:N.value.map(n=>({invoice_number:n.invoice_number??"",company:n.company??"",created_at:(n.created_at||n.date||"").slice(0,10),value:n.value_jod??0}))})}function X(s,t){return new Date(s,t-1,1,0,0,0).getTime()}function Z(s,t){return new Date(s,t,0,23,59,59).getTime()}function tt(s){const t=new Date(`${s}T00:00:00`).getTime();return Number.isFinite(t)?t:null}function et(s){const t=new Date(`${s}T23:59:59`).getTime();return Number.isFinite(t)?t:null}function x(s){if(!s)return null;const t=new Date(s).getTime();return Number.isFinite(t)?t:null}function H(s,t,n){if(s==null)return!0;const l=t?tt(t):null,c=n?et(n):null;return!(l!=null&&s<l||c!=null&&s>c)}function P(s){return String(s??"").toLowerCase().trim()}function M(s){if(!y.value)return!0;const t=P(y.value);return Object.values(s||{}).some(n=>P(n).includes(t))}function st(){D.push("/reports")}function B(s){return String(s?.SOURCE??s?.source??"").trim().toUpperCase()||"MANUAL"}function G(s){const t=[];for(let n=1;n<=50;n++){const l=s?.[`DRIVER${n}_NAME`]??s?.[`DRIVER${n}_NAME`.toLowerCase()]??"",c=s?.[`VEHICLE${n}_NO`]??s?.[`VEHICLE${n}_NO`.toLowerCase()]??"";if(!String(l||c).trim())break;t.push({name:String(l||"").trim(),vehicle:String(c||"").trim()})}if(!t.length){const n=s?.DRIVER_NAME??s?.driver_name??s?.DRIVER1_NAME??s?.driver1_name,l=s?.VEHICLE_NO??s?.vehicle_no??s?.VEHICLE1_NO??s?.vehicle1_no;String(n||l||"").trim()&&t.push({name:String(n||"").trim(),vehicle:String(l||"").trim()})}return t}function nt(s){const t=G(s).map(l=>l.vehicle).filter(Boolean);if(t.length)return t;const n=s?.VEHICLE_NO||s?.vehicle_no||s?.VEHICLE1_NO||s?.vehicle1_no||"";return n?[n]:[]}function it(s){const t=G(s).map(l=>l.name).filter(Boolean);if(t.length)return t;const n=s?.DRIVER_NAME||s?.driver_name||s?.DRIVER1_NAME||s?.driver1_name||"";return n?[n]:[]}async function U(){g.value=!0,_.value="";try{const[s,t]=await Promise.all([z.get(`${b}/api/invoices?limit=2000`),z.get(`${b}/api/waybills?limit=2000`)]);w.value=Array.isArray(s.data)?s.data:[],C.value=Array.isArray(t.data)?t.data:[],await lt()}catch(s){console.error(s),_.value="تعذّر تحميل بيانات الشهر."}finally{g.value=!1}}async function lt(){try{const{from:s,to:t}=R(d.value,h.value),n=await z.get(`${b}/api/reports/office-commission?from=${s}&to=${t}`);O.value=Array.isArray(n.data)?n.data:[]}catch(s){console.error("fetchOfficeCommission error:",s)}}ft(U);const at=u(()=>{const{from:s,to:t}=R(d.value,h.value);return(w.value||[]).filter(n=>{const l=String(n?.date||"").slice(0,10);return l.length===10&&l>=s&&l<=t})}),ot=u(()=>{const s=d.value,t=h.value,n=X(s,t),l=Z(s,t);return(C.value||[]).filter(c=>{const v=x(c?.DATE)??x(c?.created_at);return v!=null&&v>=n&&v<=l})}),N=u(()=>at.value.filter(s=>M(s)).filter(s=>{const t=String(s?.date||"").slice(0,10);return!(p.value&&(!t||t<p.value)||m.value&&(!t||t>m.value))})),E=u(()=>ot.value.filter(s=>M(s)).filter(s=>{const t=x(s?.DATE)??x(s?.created_at);return H(t,p.value,m.value)})),W=u(()=>N.value.length),rt=u(()=>N.value.reduce((s,t)=>s+(Number(t?.value_jod||0)||0),0)),q=u(()=>E.value.length),dt=u(()=>E.value.filter(s=>B(s)==="BOT").length),ct=u(()=>E.value.filter(s=>B(s)!=="BOT").length),T=u(()=>(O.value||[]).filter(s=>M(s)).filter(s=>{const t=x(s?.date);return H(t,p.value,m.value)})),J=u(()=>T.value.length),ut=u(()=>T.value.reduce((s,t)=>s+(Number(t?.commission_amount||0)||0),0));return gt([d,h],()=>{y.value="",p.value="",m.value=""}),(s,t)=>(o(),a("div",xt,[e("header",Nt,[e("div",null,[e("div",Et,"تفاصيل شهر "+i(K()),1),t[6]||(t[6]=e("div",{class:"subtitle"},"بيانات الشهر كاملة + فلترة داخل الصفحة",-1))]),e("div",St,[e("button",{class:"btn btn--secondary",onClick:st}," ⬅ رجوع للتقارير "),e("button",{class:"btn btn--secondary",disabled:g.value,onClick:Q}," 🖨️ طباعة كشف الحساب ",8,At),e("button",{class:"btn btn--secondary",disabled:g.value,onClick:U}," 🔄 تحديث ",8,kt)])]),e("main",$t,[_.value?(o(),a("div",wt,i(_.value),1)):S("",!0),e("div",Ct,[I(e("input",{class:"inp","onUpdate:modelValue":t[0]||(t[0]=n=>y.value=n),placeholder:"🔎 بحث داخل الشهر..."},null,512),[[V,y.value]]),e("div",Tt,[t[7]||(t[7]=e("span",null,"من:",-1)),I(e("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[1]||(t[1]=n=>p.value=n)},null,512),[[V,p.value]])]),e("div",Dt,[t[8]||(t[8]=e("span",null,"إلى:",-1)),I(e("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[2]||(t[2]=n=>m.value=n)},null,512),[[V,m.value]])]),e("div",Ot,[e("button",{class:L(["tab",{active:r.value==="invoices"}]),onClick:t[3]||(t[3]=n=>r.value="invoices")},[t[9]||(t[9]=F(" فواتير ",-1)),e("span",Rt,i(W.value),1)],2),e("button",{class:L(["tab",{active:r.value==="waybills"}]),onClick:t[4]||(t[4]=n=>r.value="waybills")},[t[10]||(t[10]=F(" بوالص ",-1)),e("span",Mt,i(q.value),1)],2),e("button",{class:L(["tab",{active:r.value==="commission"}]),onClick:t[5]||(t[5]=n=>r.value="commission")},[t[11]||(t[11]=F(" عمولة المكتب ",-1)),e("span",Bt,i(J.value),1)],2)])]),g.value?(o(),a("div",It,"جاري التحميل...")):(o(),a("div",Vt,[r.value==="invoices"?(o(),a("div",Lt,[e("div",Ft,[t[12]||(t[12]=e("div",{class:"sum-title"},"عدد الفواتير",-1)),e("div",zt,i(W.value),1)]),e("div",jt,[t[13]||(t[13]=e("div",{class:"sum-title"},"مجموع الفواتير (JOD)",-1)),e("div",Ht,i(Number(rt.value||0).toFixed(3)),1)])])):r.value==="commission"?(o(),a("div",Pt,[e("div",Gt,[t[14]||(t[14]=e("div",{class:"sum-title"},"عدد الفواتير",-1)),e("div",Ut,i(J.value),1)]),e("div",Wt,[t[15]||(t[15]=e("div",{class:"sum-title"},"مجموع العمولة",-1)),e("div",qt,i(Number(ut.value||0).toFixed(3)),1)])])):(o(),a("div",Jt,[e("div",Kt,[t[16]||(t[16]=e("div",{class:"sum-title"},"عدد البوالص",-1)),e("div",Yt,i(q.value),1)]),e("div",Qt,[t[17]||(t[17]=e("div",{class:"sum-title"},"BOT",-1)),e("div",Xt,i(dt.value),1)]),e("div",Zt,[t[18]||(t[18]=e("div",{class:"sum-title"},"MANUAL",-1)),e("div",te,i(ct.value),1)])])),e("div",ee,[r.value==="invoices"?(o(),a("table",se,[t[20]||(t[20]=e("thead",null,[e("tr",null,[e("th",{class:"th-number",dir:"ltr"},"رقم"),e("th",{class:"th-company"},"الشركة"),e("th",{class:"th-value",dir:"ltr"},"القيمة"),e("th",{class:"th-date",dir:"ltr"},"التاريخ"),e("th",{class:"th-entry",dir:"ltr"},"الإدخال")])],-1)),e("tbody",null,[(o(!0),a(A,null,k(N.value,n=>(o(),a("tr",{key:n._id},[e("td",ne,i(n.invoice_number),1),e("td",{class:"clip td-company",title:n.company},i(n.company),9,ie),e("td",le,i(Number(n.value_jod||0).toFixed(3)),1),e("td",ae,i(n.date),1),e("td",oe,i(Y(n.created_at)),1)]))),128)),N.value.length===0?(o(),a("tr",re,[...t[19]||(t[19]=[e("td",{colspan:"5",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):S("",!0)])])):r.value==="waybills"?(o(),a("table",de,[t[22]||(t[22]=e("thead",null,[e("tr",null,[e("th",{dir:"ltr"},"Serial"),e("th",null,"المصدر"),e("th",null,"تاريخ"),e("th",null,"المرسل"),e("th",null,"المرسل إليه"),e("th",null,"مركبة"),e("th",null,"سائق")])],-1)),e("tbody",null,[(o(!0),a(A,null,k(E.value,n=>(o(),a("tr",{key:n._id},[e("td",ce,i(n.waybillNumber||n.SERIAL_NO),1),e("td",ue,i(B(n)),1),e("td",me,i(n.DATE),1),e("td",{class:"clip",title:n.CONSIGNOR_NAME},i(n.CONSIGNOR_NAME),9,ve),e("td",{class:"clip",title:n.CONSIGNEE_NAME},i(n.CONSIGNEE_NAME),9,pe),e("td",he,[e("div",fe,[(o(!0),a(A,null,k(nt(n),(l,c)=>(o(),a("div",{key:c,class:"vehicle-no"},i(l),1))),128))])]),e("td",null,[e("div",ge,[(o(!0),a(A,null,k(it(n),(l,c)=>(o(),a("div",{key:c,class:"driver-name"},i(l),1))),128))])])]))),128)),E.value.length===0?(o(),a("tr",_e,[...t[21]||(t[21]=[e("td",{colspan:"7",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):S("",!0)])])):r.value==="commission"?(o(),a("table",ye,[t[24]||(t[24]=e("thead",null,[e("tr",null,[e("th",{class:"th-number",dir:"ltr"},"رقم الفاتورة"),e("th",{class:"th-company"},"الشركة"),e("th",null,"البيان"),e("th",null,"العملة"),e("th",{class:"th-value",dir:"ltr"},"المبلغ"),e("th",{class:"th-date",dir:"ltr"},"التاريخ")])],-1)),e("tbody",null,[(o(!0),a(A,null,k(T.value,n=>(o(),a("tr",{key:n.invoice_id},[e("td",be,i(n.invoice_number),1),e("td",{class:"clip td-company",title:n.company},i(n.company),9,xe),e("td",{class:"clip",title:n.description},i(n.description),9,Ne),e("td",null,i(n.currency),1),e("td",Ee,i(Number(n.commission_amount||0).toFixed(3)),1),e("td",Se,i(n.date),1)]))),128)),T.value.length===0?(o(),a("tr",Ae,[...t[23]||(t[23]=[e("td",{colspan:"6",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):S("",!0)])])):S("",!0)])]))])]))}},we=ht(ke,[["__scopeId","data-v-5dce5e35"]]);export{we as default};
