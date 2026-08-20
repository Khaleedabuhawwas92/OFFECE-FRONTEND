import{_ as ot,r as f,c,u as at,o as rt,w as dt,a,b as n,t as i,d as D,e as $,v as I,n as U,f as W,F as T,g as O,h as q,i as ct,j as r}from"./index-2Qq3hWk9.js";async function ut({customerName:B="",customerAddress:A="",periodFrom:R="",periodTo:g="",rows:_=[]}){const p=d=>Number(d||0).toLocaleString("en-US",{minimumFractionDigits:3,maximumFractionDigits:3}),u=d=>String(d??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;"),k=(_||[]).map(d=>`
        <tr>
          <td class="center" dir="ltr">${u(d.invoice_number)}</td>
          <td>${u(d.company)}</td>
          <td class="center" dir="ltr">${u(d.created_at)}</td>
          <td class="right" dir="ltr">${p(d.value)}</td>
        </tr>
      `.trim()).join(`
`),b=p((_||[]).reduce((d,S)=>d+(Number(S.value||0)||0),0)),y=`<!doctype html>
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
          <div class="name">${u(B)}</div>
          <div class="lines">${u(A)}</div>
        </div>

        <table class="periodBox">
          <tr><th>فترة الكشف</th></tr>
          <tr><td>${u(R)} إلى ${u(g)}</td></tr>
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
          ${k||'<tr><td colspan="4" class="center">لا يوجد بيانات</td></tr>'}

          <tr class="totalsRow">
            <td colspan="3" class="totalsLabel">*** إجمالي قيمة الفواتير ***</td>
            <td class="right" dir="ltr">${b}</td>
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
</html>`,m=window.open("","_blank","width=980,height=700");if(!m)throw new Error("Popup blocked. Please allow popups for printing.");m.document.open(),m.document.write(y),m.document.close()}const mt={class:"page"},vt={class:"topbar"},pt={class:"title"},ht={class:"actions"},ft=["disabled"],gt=["disabled"],_t={class:"main"},bt={key:0,class:"alert"},yt={class:"filters"},xt={class:"mini"},Et={class:"mini"},Nt={class:"tabs"},wt={class:"badge"},At={class:"badge"},kt={key:1,class:"loading"},St={key:2,class:"summary"},Tt={key:0,class:"sum-row"},Ot={class:"sum-card"},Rt={class:"sum-val"},Ct={class:"sum-card"},Dt={class:"sum-val",dir:"ltr"},$t={key:1,class:"sum-row"},It={class:"sum-card"},Bt={class:"sum-val"},Mt={class:"sum-card"},Vt={class:"sum-val"},Lt={class:"sum-card"},zt={class:"sum-val"},Ft={class:"table-card"},jt={key:0,class:"table"},Pt={dir:"ltr"},Gt=["title"],Ht={dir:"ltr"},Ut={class:"muted",dir:"ltr"},Wt={class:"muted",dir:"ltr"},qt={key:0},Jt={key:1,class:"table"},Kt={dir:"ltr"},Qt={class:"mono"},Xt={class:"muted",dir:"ltr"},Yt=["title"],Zt=["title"],te={class:"driver-cell",dir:"ltr"},ee={class:"driver-cell"},ne={key:0},J="http://127.0.0.1:4000",se={__name:"MonthDetails",setup(B){const A=at(),R=ct(),g=f(!1),_=f(""),p=f("invoices"),u=f([]),k=f([]),b=f(""),x=f(""),E=f(""),y=c(()=>Number(A.params.year)),m=c(()=>Number(A.params.month));function d(){const e=String(y.value),t=String(m.value).padStart(2,"0");return`${e}-${t}`}function S(e,t){const s=new Date(e,t-1,1),l=new Date(e,t,0),o=v=>v.toISOString().slice(0,10);return{from:o(s),to:o(l)}}async function K(){const{from:e,to:t}=S(y.value,m.value);await ut({customerName:"كشف حساب الشهر",customerAddress:"",periodFrom:e,periodTo:t,rows:N.value.map(s=>({invoice_number:s.invoice_number??"",company:s.company??"",created_at:(s.created_at||s.date||"").slice(0,10),value:s.value_jod??0}))})}function M(e,t){return new Date(e,t-1,1,0,0,0).getTime()}function V(e,t){return new Date(e,t,0,23,59,59).getTime()}function Q(e){const t=new Date(`${e}T00:00:00`).getTime();return Number.isFinite(t)?t:null}function X(e){const t=new Date(`${e}T23:59:59`).getTime();return Number.isFinite(t)?t:null}function h(e){if(!e)return null;const t=new Date(e).getTime();return Number.isFinite(t)?t:null}function L(e,t,s){if(e==null)return!0;const l=t?Q(t):null,o=s?X(s):null;return!(l!=null&&e<l||o!=null&&e>o)}function z(e){return String(e??"").toLowerCase().trim()}function F(e){if(!b.value)return!0;const t=z(b.value);return Object.values(e||{}).some(s=>z(s).includes(t))}function Y(){R.push("/reports")}function C(e){return String(e?.SOURCE??e?.source??"").trim().toUpperCase()||"MANUAL"}function j(e){const t=[];for(let s=1;s<=50;s++){const l=e?.[`DRIVER${s}_NAME`]??e?.[`DRIVER${s}_NAME`.toLowerCase()]??"",o=e?.[`VEHICLE${s}_NO`]??e?.[`VEHICLE${s}_NO`.toLowerCase()]??"";if(!String(l||o).trim())break;t.push({name:String(l||"").trim(),vehicle:String(o||"").trim()})}if(!t.length){const s=e?.DRIVER_NAME??e?.driver_name??e?.DRIVER1_NAME??e?.driver1_name,l=e?.VEHICLE_NO??e?.vehicle_no??e?.VEHICLE1_NO??e?.vehicle1_no;String(s||l||"").trim()&&t.push({name:String(s||"").trim(),vehicle:String(l||"").trim()})}return t}function Z(e){const t=j(e).map(l=>l.vehicle).filter(Boolean);if(t.length)return t;const s=e?.VEHICLE_NO||e?.vehicle_no||e?.VEHICLE1_NO||e?.vehicle1_no||"";return s?[s]:[]}function tt(e){const t=j(e).map(l=>l.name).filter(Boolean);if(t.length)return t;const s=e?.DRIVER_NAME||e?.driver_name||e?.DRIVER1_NAME||e?.driver1_name||"";return s?[s]:[]}async function P(){g.value=!0,_.value="";try{const[e,t]=await Promise.all([q.get(`${J}/api/invoices?limit=2000`),q.get(`${J}/api/waybills?limit=2000`)]);u.value=Array.isArray(e.data)?e.data:[],k.value=Array.isArray(t.data)?t.data:[]}catch(e){console.error(e),_.value="تعذّر تحميل بيانات الشهر."}finally{g.value=!1}}rt(P);const et=c(()=>{const e=y.value,t=m.value,s=M(e,t),l=V(e,t);return(u.value||[]).filter(o=>{const v=h(o?.date)??h(o?.created_at);return v!=null&&v>=s&&v<=l})}),nt=c(()=>{const e=y.value,t=m.value,s=M(e,t),l=V(e,t);return(k.value||[]).filter(o=>{const v=h(o?.DATE)??h(o?.created_at);return v!=null&&v>=s&&v<=l})}),N=c(()=>et.value.filter(e=>F(e)).filter(e=>{const t=h(e?.date)??h(e?.created_at);return L(t,x.value,E.value)})),w=c(()=>nt.value.filter(e=>F(e)).filter(e=>{const t=h(e?.DATE)??h(e?.created_at);return L(t,x.value,E.value)})),G=c(()=>N.value.length),st=c(()=>N.value.reduce((e,t)=>e+(Number(t?.value_jod||0)||0),0)),H=c(()=>w.value.length),lt=c(()=>w.value.filter(e=>C(e)==="BOT").length),it=c(()=>w.value.filter(e=>C(e)!=="BOT").length);return dt([y,m],()=>{b.value="",x.value="",E.value=""}),(e,t)=>(r(),a("div",mt,[n("header",vt,[n("div",null,[n("div",pt,"تفاصيل شهر "+i(d()),1),t[5]||(t[5]=n("div",{class:"subtitle"},"بيانات الشهر كاملة + فلترة داخل الصفحة",-1))]),n("div",ht,[n("button",{class:"btn btn--secondary",onClick:Y}," ⬅ رجوع للتقارير "),n("button",{class:"btn btn--secondary",disabled:g.value,onClick:K}," 🖨️ طباعة كشف الحساب ",8,ft),n("button",{class:"btn btn--secondary",disabled:g.value,onClick:P}," 🔄 تحديث ",8,gt)])]),n("main",_t,[_.value?(r(),a("div",bt,i(_.value),1)):D("",!0),n("div",yt,[$(n("input",{class:"inp","onUpdate:modelValue":t[0]||(t[0]=s=>b.value=s),placeholder:"🔎 بحث داخل الشهر..."},null,512),[[I,b.value]]),n("div",xt,[t[6]||(t[6]=n("span",null,"من:",-1)),$(n("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[1]||(t[1]=s=>x.value=s)},null,512),[[I,x.value]])]),n("div",Et,[t[7]||(t[7]=n("span",null,"إلى:",-1)),$(n("input",{class:"inp inp--date",type:"date","onUpdate:modelValue":t[2]||(t[2]=s=>E.value=s)},null,512),[[I,E.value]])]),n("div",Nt,[n("button",{class:U(["tab",{active:p.value==="invoices"}]),onClick:t[3]||(t[3]=s=>p.value="invoices")},[t[8]||(t[8]=W(" فواتير ",-1)),n("span",wt,i(G.value),1)],2),n("button",{class:U(["tab",{active:p.value==="waybills"}]),onClick:t[4]||(t[4]=s=>p.value="waybills")},[t[9]||(t[9]=W(" بوالص ",-1)),n("span",At,i(H.value),1)],2)])]),g.value?(r(),a("div",kt,"جاري التحميل...")):(r(),a("div",St,[p.value==="invoices"?(r(),a("div",Tt,[n("div",Ot,[t[10]||(t[10]=n("div",{class:"sum-title"},"عدد الفواتير",-1)),n("div",Rt,i(G.value),1)]),n("div",Ct,[t[11]||(t[11]=n("div",{class:"sum-title"},"مجموع الفواتير (JOD)",-1)),n("div",Dt,i(Number(st.value||0).toFixed(3)),1)])])):(r(),a("div",$t,[n("div",It,[t[12]||(t[12]=n("div",{class:"sum-title"},"عدد البوالص",-1)),n("div",Bt,i(H.value),1)]),n("div",Mt,[t[13]||(t[13]=n("div",{class:"sum-title"},"BOT",-1)),n("div",Vt,i(lt.value),1)]),n("div",Lt,[t[14]||(t[14]=n("div",{class:"sum-title"},"MANUAL",-1)),n("div",zt,i(it.value),1)])])),n("div",Ft,[p.value==="invoices"?(r(),a("table",jt,[t[16]||(t[16]=n("thead",null,[n("tr",null,[n("th",null,"رقم"),n("th",null,"الشركة"),n("th",{dir:"ltr"},"القيمة"),n("th",null,"التاريخ"),n("th",null,"الإدخال")])],-1)),n("tbody",null,[(r(!0),a(T,null,O(N.value,s=>(r(),a("tr",{key:s._id},[n("td",Pt,i(s.invoice_number),1),n("td",{class:"clip",title:s.company},i(s.company),9,Gt),n("td",Ht,i(Number(s.value_jod||0).toFixed(3)),1),n("td",Ut,i(s.date),1),n("td",Wt,i(s.created_at),1)]))),128)),N.value.length===0?(r(),a("tr",qt,[...t[15]||(t[15]=[n("td",{colspan:"5",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):D("",!0)])])):(r(),a("table",Jt,[t[18]||(t[18]=n("thead",null,[n("tr",null,[n("th",{dir:"ltr"},"Serial"),n("th",null,"المصدر"),n("th",null,"تاريخ"),n("th",null,"المرسل"),n("th",null,"المرسل إليه"),n("th",null,"مركبة"),n("th",null,"سائق")])],-1)),n("tbody",null,[(r(!0),a(T,null,O(w.value,s=>(r(),a("tr",{key:s._id},[n("td",Kt,i(s.waybillNumber||s.SERIAL_NO),1),n("td",Qt,i(C(s)),1),n("td",Xt,i(s.DATE),1),n("td",{class:"clip",title:s.CONSIGNOR_NAME},i(s.CONSIGNOR_NAME),9,Yt),n("td",{class:"clip",title:s.CONSIGNEE_NAME},i(s.CONSIGNEE_NAME),9,Zt),n("td",te,[(r(!0),a(T,null,O(Z(s),(l,o)=>(r(),a("div",{key:o,class:"vehicle-no"},i(l),1))),128))]),n("td",ee,[(r(!0),a(T,null,O(tt(s),(l,o)=>(r(),a("div",{key:o,class:"driver-name"},i(l),1))),128))])]))),128)),w.value.length===0?(r(),a("tr",ne,[...t[17]||(t[17]=[n("td",{colspan:"7",class:"empty"}," لا يوجد نتائج داخل الشهر حسب الفلترة ",-1)])])):D("",!0)])]))])]))])]))}},ie=ot(se,[["__scopeId","data-v-a7f8929e"]]);export{ie as default};
