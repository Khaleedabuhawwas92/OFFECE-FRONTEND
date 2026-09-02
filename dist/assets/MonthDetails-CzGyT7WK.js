import{_ as ht,o as ft,w as gt,c as o,a as s,t as l,b as S,d as I,v as V,n as L,e as F,F as A,r as k,f as z,g as f,h as m,u as _t,i as yt,j as a}from"./index-B3WAAdLT.js";async function bt({customerName:j="",customerAddress:x="",periodFrom:$="",periodTo:D="",rows:g=[]}){const y=c=>Number(c||0).toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:3}),r=c=>String(c??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"),w=(g||[]).map(c=>`
        <tr>
          <td class="center" dir="ltr">${r(c.invoice_number)}</td>
          <td>${r(c.company)}</td>
          <td class="center" dir="ltr">${r(c.created_at)}</td>
          <td class="right" dir="ltr">${y(c.value)}</td>
        </tr>
      `.trim()).join(`
`),T=y((g||[]).reduce((c,p)=>c+(Number(p.value||0)||0),0)),_=`<!doctype html>
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
          <div class="lines">${r(x)}</div>
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
            <td class="right" dir="ltr">${T}</td>
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
</html>`,v=window.open("","_blank","width=980,height=700");if(!v)throw new Error("Popup blocked. Please allow popups for printing.");v.document.open(),v.document.write(_),v.document.close()}const xt={class:"page"},Nt={class:"topbar"},Et={class:"title"},St={class:"actions"},At=["disabled"],kt=["disabled"],$t={class:"main"},wt={key:0,class:"alert"},Tt={class:"filters"},Ct={class:"mini"},Dt={class:"mini"},Ot={class:"tabs"},Rt={class:"badge"},Mt={class:"badge"},Bt={class:"badge"},It={key:1,class:"loading"},Vt={key:2,class:"summary"},Lt={key:0,class:"sum-row"},Ft={class:"sum-card"},zt={class:"sum-val"},jt={class:"sum-card"},Ht={class:"sum-val",dir:"ltr"},Pt={key:1,class:"sum-row"},Gt={class:"sum-card"},Ut={class:"sum-val"},Wt={class:"sum-card"},qt={class:"sum-val",dir:"ltr"},Jt={key:2,class:"sum-row"},Kt={class:"sum-card"},Yt={class:"sum-val"},Qt={class:"sum-card"},Xt={class:"sum-val"},Zt={class:"sum-card"},te={class:"sum-val"},ee={class:"table-card"},se={key:0,class:"table table--invoices"},ne={class:"td-number",dir:"ltr"},le=["title"],ie={class:"td-value",dir:"ltr"},oe={class:"muted td-date",dir:"ltr"},ae={class:"muted td-entry",dir:"ltr"},re={key:0},de={key:1,class:"table"},ce={dir:"ltr"},ue={class:"mono"},me={class:"muted",dir:"ltr"},ve=["title"],pe=["title"],he={dir:"ltr"},fe={class:"driver-cell"},ge={class:"driver-cell"},_e={key:0},ye={key:2,class:"table table--invoices"},be={class:"td-number",dir:"ltr"},xe=["title"],Ne=["title"],Ee={class:"td-value",dir:"ltr"},Se={class:"muted td-date",dir:"ltr"},Ae={key:0},ke={__name:"MonthDetails",setup(j){const x="http://127.0.0.1:4000",$=yt(),D=_t(),g=f(!1),y=f(""),r=f("invoices"),w=f([]),T=f([]),O=f([]),b=f(""),_=f(""),v=f(""),c=m(()=>Number($.params.year)),p=m(()=>Number($.params.month));function Q(){const e=String(c.value),t=String(p.value).padStart(2,"0");return`${e}-${t}`}function H(e,t){const n=String(t).padStart(2,"0"),i=String(new Date(e,t,0).getDate()).padStart(2,"0");return{from:`${e}-${n}-01`,to:`${e}-${n}-${i}`}}function X(e){if(!e)return"";const t=new Date(e);if(!Number.isFinite(t.getTime()))return String(e);const n=t.getFullYear(),i=String(t.getMonth()+1).padStart(2,"0"),d=String(t.getDate()).padStart(2,"0");let u=t.getHours();const mt=String(t.getMinutes()).padStart(2,"0"),vt=u>=12?"م":"ص";u=u%12,u=u||12;const pt=String(u).padStart(2,"0");return`${n}-${i}-${d} ${pt}:${mt} ${vt}`}async function Z(){const{from:e,to:t}=H(c.value,p.value);await bt({customerName:"كشف حساب الشهر",customerAddress:"",periodFrom:e,periodTo:t,rows:N.value.map(n=>({invoice_number:n.invoice_number??"",company:n.company??"",created_at:(n.created_at||n.date||"").slice(0,10),value:n.value_jod??0}))})}function P(e,t){return new Date(e,t-1,1,0,0,0).getTime()}function G(e,t){return new Date(e,t,0,23,59,59).getTime()}function tt(e){const t=new Date(`${e}T00:00:00`).getTime();return Number.isFinite(t)?t:null}function et(e){const t=new Date(`${e}T23:59:59`).getTime();return Number.isFinite(t)?t:null}function h(e){if(!e)return null;const t=new Date(e).getTime();return Number.isFinite(t)?t:null}function R(e,t,n){if(e==null)return!0;const i=t?tt(t):null,d=n?et(n):null;return!(i!=null&&e<i||d!=null&&e>d)}function U(e){return String(e??"").toLowerCase().trim()}function M(e){if(!b.value)return!0;const t=U(b.value);return Object.values(e||{}).some(n=>U(n).includes(t))}function st(){D.push("/reports")}function B(e){return String(e?.SOURCE??e?.source??"").trim().toUpperCase()||"MANUAL"}function W(e){const t=[];for(let n=1;n<=50;n++){const i=e?.[`DRIVER${n}_NAME`]??e?.[`DRIVER${n}_NAME`.toLowerCase()]??"",d=e?.[`VEHICLE${n}_NO`]??e?.[`VEHICLE${n}_NO`.toLowerCase()]??"";if(!String(i||d).trim())break;t.push({name:String(i||"").trim(),vehicle:String(d||"").trim()})}if(!t.length){const n=e?.DRIVER_NAME??e?.driver_name??e?.DRIVER1_NAME??e?.driver1_name,i=e?.VEHICLE_NO??e?.vehicle_no??e?.VEHICLE1_NO??e?.vehicle1_no;String(n||i||"").trim()&&t.push({name:String(n||"").trim(),vehicle:String(i||"").trim()})}return t}function nt(e){const t=W(e).map(i=>i.vehicle).filter(Boolean);if(t.length)return t;const n=e?.VEHICLE_NO||e?.vehicle_no||e?.VEHICLE1_NO||e?.vehicle1_no||"";return n?[n]:[]}function lt(e){const t=W(e).map(i=>i.name).filter(Boolean);if(t.length)return t;const n=e?.DRIVER_NAME||e?.driver_name||e?.DRIVER1_NAME||e?.driver1_name||"";return n?[n]:[]}async function q(){g.value=!0,y.value="";try{const[e,t]=await Promise.all([z.get(`${x}/api/invoices?limit=2000`),z.get(`${x}/api/waybills?limit=2000`)]);w.value=Array.isArray(e.data)?e.data:[],T.value=Array.isArray(t.data)?t.data:[],await it()}catch(e){console.error(e),y.value="تعذّر تحميل بيانات الشهر."}finally{g.value=!1}}async function it(){try{const{from:e,to:t}=H(c.value,p.value),n=await z.get(`${x}/api/reports/office-commission?from=${e}&to=${t}`);O.value=Array.isArray(n.data)?n.data:[]}catch(e){console.error("fetchOfficeCommission error:",e)}}ft(q);const ot=m(()=>{const e=c.value,t=p.value,n=P(e,t),i=G(e,t);return(w.value||[]).filter(d=>{const u=h(d?.date)??h(d?.created_at);return u!=null&&u>=n&&u<=i})}),at=m(()=>{const e=c.value,t=p.value,n=P(e,t),i=G(e,t);return(T.value||[]).filter(d=>{const u=h(d?.DATE)??h(d?.created_at);return u!=null&&u>=n&&u<=i})}),N=m(()=>ot.value.filter(e=>M(e)).filter(e=>{const t=h(e?.date)??h(e?.created_at);return R(t,_.value,v.value)})),E=m(()=>at.value.filter(e=>M(e)).filter(e=>{const t=h(e?.DATE)??h(e?.created_at);return R(t,_.value,v.value)})),J=m(()=>N.value.length),rt=m(()=>N.value.reduce((e,t)=>e+(Number(t?.value_jod||0)||0),0)),K=m(()=>E.value.length),dt=m(()=>E.value.filter(e=>B(e)==="BOT").length),ct=m(()=>E.value.filter(e=>B(e)!=="BOT").length),C=m(()=>(O.value||[]).filter(e=>M(e)).filter(e=>{const t=h(e?.date);return R(t,_.value,v.value)})),Y=m(()=>C.value.length),ut=m(()=>C.value.reduce((e,t)=>e+(Number(t?.commission_amount||0)||0),0));return gt([c,p],()=>{b.value="",_.value="",v.value=""}),(e,t)=>(a(),o("div",xt,[s("header",Nt,[s("div",null,[s("div",Et,"تفاصيل شهر "+l(Q()),1),t[6]||(t[6]=s("div",{class:"subtitle"},"بيانات الشهر كاملة + فلترة داخل الصفحة",-1))]),s("div",St,[s("button",{class:"btn btn--secondary",onClick:st}," ⬅ رجوع للتقارير "),s("button",{class:"btn btn--secondary",disabled:g.value,onClick:Z}," 🖨️ طباعة كشف الحساب ",8,At),s("button",{class:"btn btn--secondary",disabled:g.value,onClick:q}," 🔄 تحديث ",8,kt)])]),s("main",$t,[y.value?(a(),o("div",wt,l(y.value),1)):S("",!0),s("div",Tt,[I(s("input",{class:"inp","onUpdate:modelValue":t[0]||(t[0]=n=>b.value=n),placeholder:"🔎 بحث داخل الشهر..."},null,512),[[V,b.value]]),s("div",Ct,[t[7]||(t[7]=s("span",null,"من:",-1)),I(s("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[1]||(t[1]=n=>_.value=n)},null,512),[[V,_.value]])]),s("div",Dt,[t[8]||(t[8]=s("span",null,"إلى:",-1)),I(s("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[2]||(t[2]=n=>v.value=n)},null,512),[[V,v.value]])]),s("div",Ot,[s("button",{class:L(["tab",{active:r.value==="invoices"}]),onClick:t[3]||(t[3]=n=>r.value="invoices")},[t[9]||(t[9]=F(" فواتير ",-1)),s("span",Rt,l(J.value),1)],2),s("button",{class:L(["tab",{active:r.value==="waybills"}]),onClick:t[4]||(t[4]=n=>r.value="waybills")},[t[10]||(t[10]=F(" بوالص ",-1)),s("span",Mt,l(K.value),1)],2),s("button",{class:L(["tab",{active:r.value==="commission"}]),onClick:t[5]||(t[5]=n=>r.value="commission")},[t[11]||(t[11]=F(" عمولة المكتب ",-1)),s("span",Bt,l(Y.value),1)],2)])]),g.value?(a(),o("div",It,"جاري التحميل...")):(a(),o("div",Vt,[r.value==="invoices"?(a(),o("div",Lt,[s("div",Ft,[t[12]||(t[12]=s("div",{class:"sum-title"},"عدد الفواتير",-1)),s("div",zt,l(J.value),1)]),s("div",jt,[t[13]||(t[13]=s("div",{class:"sum-title"},"مجموع الفواتير (JOD)",-1)),s("div",Ht,l(Number(rt.value||0).toFixed(3)),1)])])):r.value==="commission"?(a(),o("div",Pt,[s("div",Gt,[t[14]||(t[14]=s("div",{class:"sum-title"},"عدد الفواتير",-1)),s("div",Ut,l(Y.value),1)]),s("div",Wt,[t[15]||(t[15]=s("div",{class:"sum-title"},"مجموع العمولة",-1)),s("div",qt,l(Number(ut.value||0).toFixed(3)),1)])])):(a(),o("div",Jt,[s("div",Kt,[t[16]||(t[16]=s("div",{class:"sum-title"},"عدد البوالص",-1)),s("div",Yt,l(K.value),1)]),s("div",Qt,[t[17]||(t[17]=s("div",{class:"sum-title"},"BOT",-1)),s("div",Xt,l(dt.value),1)]),s("div",Zt,[t[18]||(t[18]=s("div",{class:"sum-title"},"MANUAL",-1)),s("div",te,l(ct.value),1)])])),s("div",ee,[r.value==="invoices"?(a(),o("table",se,[t[20]||(t[20]=s("thead",null,[s("tr",null,[s("th",{class:"th-number",dir:"ltr"},"رقم"),s("th",{class:"th-company"},"الشركة"),s("th",{class:"th-value",dir:"ltr"},"القيمة"),s("th",{class:"th-date",dir:"ltr"},"التاريخ"),s("th",{class:"th-entry",dir:"ltr"},"الإدخال")])],-1)),s("tbody",null,[(a(!0),o(A,null,k(N.value,n=>(a(),o("tr",{key:n._id},[s("td",ne,l(n.invoice_number),1),s("td",{class:"clip td-company",title:n.company},l(n.company),9,le),s("td",ie,l(Number(n.value_jod||0).toFixed(3)),1),s("td",oe,l(n.date),1),s("td",ae,l(X(n.created_at)),1)]))),128)),N.value.length===0?(a(),o("tr",re,[...t[19]||(t[19]=[s("td",{colspan:"5",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):S("",!0)])])):r.value==="waybills"?(a(),o("table",de,[t[22]||(t[22]=s("thead",null,[s("tr",null,[s("th",{dir:"ltr"},"Serial"),s("th",null,"المصدر"),s("th",null,"تاريخ"),s("th",null,"المرسل"),s("th",null,"المرسل إليه"),s("th",null,"مركبة"),s("th",null,"سائق")])],-1)),s("tbody",null,[(a(!0),o(A,null,k(E.value,n=>(a(),o("tr",{key:n._id},[s("td",ce,l(n.waybillNumber||n.SERIAL_NO),1),s("td",ue,l(B(n)),1),s("td",me,l(n.DATE),1),s("td",{class:"clip",title:n.CONSIGNOR_NAME},l(n.CONSIGNOR_NAME),9,ve),s("td",{class:"clip",title:n.CONSIGNEE_NAME},l(n.CONSIGNEE_NAME),9,pe),s("td",he,[s("div",fe,[(a(!0),o(A,null,k(nt(n),(i,d)=>(a(),o("div",{key:d,class:"vehicle-no"},l(i),1))),128))])]),s("td",null,[s("div",ge,[(a(!0),o(A,null,k(lt(n),(i,d)=>(a(),o("div",{key:d,class:"driver-name"},l(i),1))),128))])])]))),128)),E.value.length===0?(a(),o("tr",_e,[...t[21]||(t[21]=[s("td",{colspan:"7",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):S("",!0)])])):r.value==="commission"?(a(),o("table",ye,[t[24]||(t[24]=s("thead",null,[s("tr",null,[s("th",{class:"th-number",dir:"ltr"},"رقم الفاتورة"),s("th",{class:"th-company"},"الشركة"),s("th",null,"البيان"),s("th",null,"العملة"),s("th",{class:"th-value",dir:"ltr"},"المبلغ"),s("th",{class:"th-date",dir:"ltr"},"التاريخ")])],-1)),s("tbody",null,[(a(!0),o(A,null,k(C.value,n=>(a(),o("tr",{key:n.invoice_id},[s("td",be,l(n.invoice_number),1),s("td",{class:"clip td-company",title:n.company},l(n.company),9,xe),s("td",{class:"clip",title:n.description},l(n.description),9,Ne),s("td",null,l(n.currency),1),s("td",Ee,l(Number(n.commission_amount||0).toFixed(3)),1),s("td",Se,l(n.date),1)]))),128)),C.value.length===0?(a(),o("tr",Ae,[...t[23]||(t[23]=[s("td",{colspan:"6",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):S("",!0)])])):S("",!0)])]))])]))}},we=ht(ke,[["__scopeId","data-v-1088d191"]]);export{we as default};
