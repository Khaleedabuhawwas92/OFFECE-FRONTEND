import{_ as ht,o as ft,w as gt,c as o,a as e,t as l,b as A,d as B,v as V,n as L,e as F,F as S,r as k,f as z,g as f,h as m,u as _t,i as yt,j as a}from"./index-BBoYPVH9.js";async function bt({customerName:j="",customerAddress:x="",periodFrom:w="",periodTo:O="",rows:g=[]}){const y=u=>Number(u||0).toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:3}),d=u=>String(u??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"),$=(g||[]).map(u=>`
        <tr>
          <td class="center" dir="ltr">${d(u.invoice_number)}</td>
          <td>${d(u.company)}</td>
          <td class="center" dir="ltr">${d(u.created_at)}</td>
          <td class="right" dir="ltr">${y(u.value)}</td>
        </tr>
      `.trim()).join(`
`),T=y((g||[]).reduce((u,p)=>u+(Number(p.value||0)||0),0)),_=`<!doctype html>
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
          <div class="name">${d(j)}</div>
          <div class="lines">${d(x)}</div>
        </div>

        <table class="periodBox">
          <tr><th>فترة الكشف</th></tr>
          <tr><td>${d(w)} إلى ${d(O)}</td></tr>
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
          ${$||'<tr><td colspan="4" class="center">لا يوجد بيانات</td></tr>'}

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
</html>`,v=window.open("","_blank","width=980,height=700");if(!v)throw new Error("Popup blocked. Please allow popups for printing.");v.document.open(),v.document.write(_),v.document.close()}const xt={class:"page"},Nt={class:"topbar"},Et={class:"title"},At={class:"actions"},St=["disabled"],kt=["disabled"],wt={class:"main"},$t={key:0,class:"alert"},Tt={class:"filters"},Ct={class:"mini"},Ot={class:"mini"},Dt={class:"tabs"},Rt={class:"badge"},It={class:"badge"},Mt={class:"badge"},Bt={key:1,class:"loading"},Vt={key:2,class:"summary"},Lt={key:0,class:"sum-row"},Ft={class:"sum-card"},zt={class:"sum-val"},jt={class:"sum-card"},Ht={class:"sum-val",dir:"ltr"},Pt={key:1,class:"sum-row"},Gt={class:"sum-card"},Ut={class:"sum-val"},Wt={class:"sum-card"},qt={class:"sum-val",dir:"ltr"},Jt={key:2,class:"sum-row"},Kt={class:"sum-card"},Yt={class:"sum-val"},Qt={class:"sum-card"},Xt={class:"sum-val"},Zt={class:"sum-card"},te={class:"sum-val"},ee={class:"table-card"},se={key:0,class:"table table--invoices"},ne={class:"td-number",dir:"ltr"},le=["title"],ie={class:"td-value",dir:"ltr"},oe={class:"muted td-date",dir:"ltr"},ae={class:"muted td-entry",dir:"ltr"},re={key:0},de={key:1,class:"table"},ce={dir:"ltr"},ue={class:"mono"},me={class:"muted",dir:"ltr"},ve=["title"],pe=["title"],he={dir:"ltr"},fe={class:"driver-cell"},ge={class:"driver-cell"},_e={key:0},ye={key:2,class:"table table--invoices"},be={class:"td-number",dir:"ltr"},xe=["title"],Ne=["title"],Ee={class:"td-value",dir:"ltr"},Ae={class:"muted td-date",dir:"ltr"},Se={key:0},ke={__name:"MonthDetails",setup(j){const x="http://127.0.0.1:4000",w=yt(),O=_t(),g=f(!1),y=f(""),d=f("invoices"),$=f([]),T=f([]),D=f([]),b=f(""),_=f(""),v=f(""),u=m(()=>Number(w.params.year)),p=m(()=>Number(w.params.month));function Q(){const s=String(u.value),t=String(p.value).padStart(2,"0");return`${s}-${t}`}function H(s,t){const n=new Date(s,t-1,1),i=new Date(s,t,0),r=c=>c.toISOString().slice(0,10);return{from:r(n),to:r(i)}}function X(s){if(!s)return"";const t=new Date(s);if(!Number.isFinite(t.getTime()))return String(s);const n=t.getFullYear(),i=String(t.getMonth()+1).padStart(2,"0"),r=String(t.getDate()).padStart(2,"0");let c=t.getHours();const mt=String(t.getMinutes()).padStart(2,"0"),vt=c>=12?"م":"ص";c=c%12,c=c||12;const pt=String(c).padStart(2,"0");return`${n}-${i}-${r} ${pt}:${mt} ${vt}`}async function Z(){const{from:s,to:t}=H(u.value,p.value);await bt({customerName:"كشف حساب الشهر",customerAddress:"",periodFrom:s,periodTo:t,rows:N.value.map(n=>({invoice_number:n.invoice_number??"",company:n.company??"",created_at:(n.created_at||n.date||"").slice(0,10),value:n.value_jod??0}))})}function P(s,t){return new Date(s,t-1,1,0,0,0).getTime()}function G(s,t){return new Date(s,t,0,23,59,59).getTime()}function tt(s){const t=new Date(`${s}T00:00:00`).getTime();return Number.isFinite(t)?t:null}function et(s){const t=new Date(`${s}T23:59:59`).getTime();return Number.isFinite(t)?t:null}function h(s){if(!s)return null;const t=new Date(s).getTime();return Number.isFinite(t)?t:null}function R(s,t,n){if(s==null)return!0;const i=t?tt(t):null,r=n?et(n):null;return!(i!=null&&s<i||r!=null&&s>r)}function U(s){return String(s??"").toLowerCase().trim()}function I(s){if(!b.value)return!0;const t=U(b.value);return Object.values(s||{}).some(n=>U(n).includes(t))}function st(){O.push("/reports")}function M(s){return String(s?.SOURCE??s?.source??"").trim().toUpperCase()||"MANUAL"}function W(s){const t=[];for(let n=1;n<=50;n++){const i=s?.[`DRIVER${n}_NAME`]??s?.[`DRIVER${n}_NAME`.toLowerCase()]??"",r=s?.[`VEHICLE${n}_NO`]??s?.[`VEHICLE${n}_NO`.toLowerCase()]??"";if(!String(i||r).trim())break;t.push({name:String(i||"").trim(),vehicle:String(r||"").trim()})}if(!t.length){const n=s?.DRIVER_NAME??s?.driver_name??s?.DRIVER1_NAME??s?.driver1_name,i=s?.VEHICLE_NO??s?.vehicle_no??s?.VEHICLE1_NO??s?.vehicle1_no;String(n||i||"").trim()&&t.push({name:String(n||"").trim(),vehicle:String(i||"").trim()})}return t}function nt(s){const t=W(s).map(i=>i.vehicle).filter(Boolean);if(t.length)return t;const n=s?.VEHICLE_NO||s?.vehicle_no||s?.VEHICLE1_NO||s?.vehicle1_no||"";return n?[n]:[]}function lt(s){const t=W(s).map(i=>i.name).filter(Boolean);if(t.length)return t;const n=s?.DRIVER_NAME||s?.driver_name||s?.DRIVER1_NAME||s?.driver1_name||"";return n?[n]:[]}async function q(){g.value=!0,y.value="";try{const[s,t]=await Promise.all([z.get(`${x}/api/invoices?limit=2000`),z.get(`${x}/api/waybills?limit=2000`)]);$.value=Array.isArray(s.data)?s.data:[],T.value=Array.isArray(t.data)?t.data:[],await it()}catch(s){console.error(s),y.value="تعذّر تحميل بيانات الشهر."}finally{g.value=!1}}async function it(){try{const{from:s,to:t}=H(u.value,p.value),n=await z.get(`${x}/api/reports/office-commission?from=${s}&to=${t}`);D.value=Array.isArray(n.data)?n.data:[]}catch(s){console.error("fetchOfficeCommission error:",s)}}ft(q);const ot=m(()=>{const s=u.value,t=p.value,n=P(s,t),i=G(s,t);return($.value||[]).filter(r=>{const c=h(r?.date)??h(r?.created_at);return c!=null&&c>=n&&c<=i})}),at=m(()=>{const s=u.value,t=p.value,n=P(s,t),i=G(s,t);return(T.value||[]).filter(r=>{const c=h(r?.DATE)??h(r?.created_at);return c!=null&&c>=n&&c<=i})}),N=m(()=>ot.value.filter(s=>I(s)).filter(s=>{const t=h(s?.date)??h(s?.created_at);return R(t,_.value,v.value)})),E=m(()=>at.value.filter(s=>I(s)).filter(s=>{const t=h(s?.DATE)??h(s?.created_at);return R(t,_.value,v.value)})),J=m(()=>N.value.length),rt=m(()=>N.value.reduce((s,t)=>s+(Number(t?.value_jod||0)||0),0)),K=m(()=>E.value.length),dt=m(()=>E.value.filter(s=>M(s)==="BOT").length),ct=m(()=>E.value.filter(s=>M(s)!=="BOT").length),C=m(()=>(D.value||[]).filter(s=>I(s)).filter(s=>{const t=h(s?.date);return R(t,_.value,v.value)})),Y=m(()=>C.value.length),ut=m(()=>C.value.reduce((s,t)=>s+(Number(t?.commission_amount||0)||0),0));return gt([u,p],()=>{b.value="",_.value="",v.value=""}),(s,t)=>(a(),o("div",xt,[e("header",Nt,[e("div",null,[e("div",Et,"تفاصيل شهر "+l(Q()),1),t[6]||(t[6]=e("div",{class:"subtitle"},"بيانات الشهر كاملة + فلترة داخل الصفحة",-1))]),e("div",At,[e("button",{class:"btn btn--secondary",onClick:st}," ⬅ رجوع للتقارير "),e("button",{class:"btn btn--secondary",disabled:g.value,onClick:Z}," 🖨️ طباعة كشف الحساب ",8,St),e("button",{class:"btn btn--secondary",disabled:g.value,onClick:q}," 🔄 تحديث ",8,kt)])]),e("main",wt,[y.value?(a(),o("div",$t,l(y.value),1)):A("",!0),e("div",Tt,[B(e("input",{class:"inp","onUpdate:modelValue":t[0]||(t[0]=n=>b.value=n),placeholder:"🔎 بحث داخل الشهر..."},null,512),[[V,b.value]]),e("div",Ct,[t[7]||(t[7]=e("span",null,"من:",-1)),B(e("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[1]||(t[1]=n=>_.value=n)},null,512),[[V,_.value]])]),e("div",Ot,[t[8]||(t[8]=e("span",null,"إلى:",-1)),B(e("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[2]||(t[2]=n=>v.value=n)},null,512),[[V,v.value]])]),e("div",Dt,[e("button",{class:L(["tab",{active:d.value==="invoices"}]),onClick:t[3]||(t[3]=n=>d.value="invoices")},[t[9]||(t[9]=F(" فواتير ",-1)),e("span",Rt,l(J.value),1)],2),e("button",{class:L(["tab",{active:d.value==="waybills"}]),onClick:t[4]||(t[4]=n=>d.value="waybills")},[t[10]||(t[10]=F(" بوالص ",-1)),e("span",It,l(K.value),1)],2),e("button",{class:L(["tab",{active:d.value==="commission"}]),onClick:t[5]||(t[5]=n=>d.value="commission")},[t[11]||(t[11]=F(" عمولة المكتب ",-1)),e("span",Mt,l(Y.value),1)],2)])]),g.value?(a(),o("div",Bt,"جاري التحميل...")):(a(),o("div",Vt,[d.value==="invoices"?(a(),o("div",Lt,[e("div",Ft,[t[12]||(t[12]=e("div",{class:"sum-title"},"عدد الفواتير",-1)),e("div",zt,l(J.value),1)]),e("div",jt,[t[13]||(t[13]=e("div",{class:"sum-title"},"مجموع الفواتير (JOD)",-1)),e("div",Ht,l(Number(rt.value||0).toFixed(3)),1)])])):d.value==="commission"?(a(),o("div",Pt,[e("div",Gt,[t[14]||(t[14]=e("div",{class:"sum-title"},"عدد الفواتير",-1)),e("div",Ut,l(Y.value),1)]),e("div",Wt,[t[15]||(t[15]=e("div",{class:"sum-title"},"مجموع العمولة",-1)),e("div",qt,l(Number(ut.value||0).toFixed(3)),1)])])):(a(),o("div",Jt,[e("div",Kt,[t[16]||(t[16]=e("div",{class:"sum-title"},"عدد البوالص",-1)),e("div",Yt,l(K.value),1)]),e("div",Qt,[t[17]||(t[17]=e("div",{class:"sum-title"},"BOT",-1)),e("div",Xt,l(dt.value),1)]),e("div",Zt,[t[18]||(t[18]=e("div",{class:"sum-title"},"MANUAL",-1)),e("div",te,l(ct.value),1)])])),e("div",ee,[d.value==="invoices"?(a(),o("table",se,[t[20]||(t[20]=e("thead",null,[e("tr",null,[e("th",{class:"th-number",dir:"ltr"},"رقم"),e("th",{class:"th-company"},"الشركة"),e("th",{class:"th-value",dir:"ltr"},"القيمة"),e("th",{class:"th-date",dir:"ltr"},"التاريخ"),e("th",{class:"th-entry",dir:"ltr"},"الإدخال")])],-1)),e("tbody",null,[(a(!0),o(S,null,k(N.value,n=>(a(),o("tr",{key:n._id},[e("td",ne,l(n.invoice_number),1),e("td",{class:"clip td-company",title:n.company},l(n.company),9,le),e("td",ie,l(Number(n.value_jod||0).toFixed(3)),1),e("td",oe,l(n.date),1),e("td",ae,l(X(n.created_at)),1)]))),128)),N.value.length===0?(a(),o("tr",re,[...t[19]||(t[19]=[e("td",{colspan:"5",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):A("",!0)])])):d.value==="waybills"?(a(),o("table",de,[t[22]||(t[22]=e("thead",null,[e("tr",null,[e("th",{dir:"ltr"},"Serial"),e("th",null,"المصدر"),e("th",null,"تاريخ"),e("th",null,"المرسل"),e("th",null,"المرسل إليه"),e("th",null,"مركبة"),e("th",null,"سائق")])],-1)),e("tbody",null,[(a(!0),o(S,null,k(E.value,n=>(a(),o("tr",{key:n._id},[e("td",ce,l(n.waybillNumber||n.SERIAL_NO),1),e("td",ue,l(M(n)),1),e("td",me,l(n.DATE),1),e("td",{class:"clip",title:n.CONSIGNOR_NAME},l(n.CONSIGNOR_NAME),9,ve),e("td",{class:"clip",title:n.CONSIGNEE_NAME},l(n.CONSIGNEE_NAME),9,pe),e("td",he,[e("div",fe,[(a(!0),o(S,null,k(nt(n),(i,r)=>(a(),o("div",{key:r,class:"vehicle-no"},l(i),1))),128))])]),e("td",null,[e("div",ge,[(a(!0),o(S,null,k(lt(n),(i,r)=>(a(),o("div",{key:r,class:"driver-name"},l(i),1))),128))])])]))),128)),E.value.length===0?(a(),o("tr",_e,[...t[21]||(t[21]=[e("td",{colspan:"7",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):A("",!0)])])):d.value==="commission"?(a(),o("table",ye,[t[24]||(t[24]=e("thead",null,[e("tr",null,[e("th",{class:"th-number",dir:"ltr"},"رقم الفاتورة"),e("th",{class:"th-company"},"الشركة"),e("th",null,"البيان"),e("th",null,"العملة"),e("th",{class:"th-value",dir:"ltr"},"المبلغ"),e("th",{class:"th-date",dir:"ltr"},"التاريخ")])],-1)),e("tbody",null,[(a(!0),o(S,null,k(C.value,n=>(a(),o("tr",{key:n.invoice_id},[e("td",be,l(n.invoice_number),1),e("td",{class:"clip td-company",title:n.company},l(n.company),9,xe),e("td",{class:"clip",title:n.description},l(n.description),9,Ne),e("td",null,l(n.currency),1),e("td",Ee,l(Number(n.commission_amount||0).toFixed(3)),1),e("td",Ae,l(n.date),1)]))),128)),C.value.length===0?(a(),o("tr",Se,[...t[23]||(t[23]=[e("td",{colspan:"6",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):A("",!0)])])):A("",!0)])]))])]))}},$e=ht(ke,[["__scopeId","data-v-5f0a0c44"]]);export{$e as default};
