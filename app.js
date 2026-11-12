/* Digital Menu starter — Supabase-backed */
const cfg = window.MENU_CONFIG || {};
const ready = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
const sb = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
let pages = [], items = [], activePage = null, isAdmin = false, currentUser = null;
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("fa-IR").format(Number(n || 0));
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function initBrand(){const name="Misu";$("brandName").textContent=name;$("footerName").textContent=name;document.title="Misu | کافه رستوران میسو"}
async function loadData(){
  if(!sb){pages=[{id:"demo",name:"پیشنهادهای کافه",description:"نمونه نمایشی"}];items=[
    {id:"d1",page_id:"demo",name:"کاپوچینو",description:"اسپرسو، شیر بخار داده‌شده و فوم لطیف",price:85000,currency:"تومان",available:true,image_url:""},
    {id:"d2",page_id:"demo",name:"لاته",description:"ترکیب متعادل اسپرسو و شیر",price:90000,currency:"تومان",available:true,image_url:""},
    {id:"d3",page_id:"demo",name:"چیزکیک",description:"دسر روز کافه",price:120000,currency:"تومان",available:false,image_url:""}
  ];render();return}
  const [p,i]=await Promise.all([sb.from("menu_pages").select("*").order("sort_order"),sb.from("menu_items").select("*").order("sort_order")]);
  if(p.error||i.error){toast("دریافت منو با خطا مواجه شد.");console.error(p.error||i.error);return}
  pages=p.data||[];items=i.data||[];if(!activePage||!pages.some(x=>x.id===activePage))activePage=pages[0]?.id||null;render();
}
function render(){
  $("pageTabs").innerHTML=pages.map(p=>`<button class="page-tab ${p.id===activePage?"active":""}" data-page="${p.id}">${escapeHtml(p.name)}</button>`).join("");
  $("pageTabs").querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>{activePage=b.dataset.page;render()});
  const page=pages.find(p=>p.id===activePage);$("currentPageTitle").textContent=page?.name||"منو";$("itemCount").textContent=`${items.filter(x=>x.page_id===activePage).length} محصول`;
  const visible=items.filter(x=>x.page_id===activePage && (isAdmin||x.is_published!==false));
  $("menuGrid").innerHTML=visible.length?visible.map(x=>`<article class="menu-card">${x.image_url?`<img class="menu-image" src="${escapeHtml(x.image_url)}" alt="${escapeHtml(x.name)}">`:`<div class="menu-image placeholder">✳</div>`}<div class="menu-info"><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.description||"")}</p><div class="price-row"><span class="price">${money(x.price)} ${escapeHtml(x.currency||cfg.CURRENCY||"تومان")}</span>${x.available===false?'<span class="unavailable">ناموجود</span>':""}<button class="small-btn add-cart" data-add="${x.id}" ${x.available===false?"disabled":""}>افزودن به سبد</button></div></div></article>`).join(""):'<div class="empty">در این صفحه هنوز محصولی ثبت نشده است.</div>';
  $("adminPanel").classList.toggle("hidden",!isAdmin);$("loginBtn").classList.toggle("hidden",isAdmin);$("logoutBtn").classList.toggle("hidden",!isAdmin);
  document.querySelectorAll("[data-add]").forEach(b=>b.onclick=()=>addToCart(b.dataset.add));
  updateCartUI();
  if(isAdmin)renderAdmin();
}
function renderAdmin(){
  $("itemPage").innerHTML=pages.map(p=>`<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
  $("pagesManage").innerHTML=pages.map(p=>`<div class="manage-row"><span>${escapeHtml(p.name)}</span><div class="manage-actions"><button class="small-btn" data-rename="${p.id}">تغییر نام</button><button class="small-btn danger" data-delpage="${p.id}">حذف</button></div></div>`).join("");
  $("itemsManage").innerHTML=items.map(x=>`<div class="manage-row"><span>${escapeHtml(x.name)} · ${money(x.price)}</span><div class="manage-actions"><button class="small-btn" data-edit="${x.id}">ویرایش</button><button class="small-btn danger" data-delitem="${x.id}">حذف</button></div></div>`).join("");
  $("pagesManage").querySelectorAll("[data-rename]").forEach(b=>b.onclick=()=>renamePage(b.dataset.rename));
  $("pagesManage").querySelectorAll("[data-delpage]").forEach(b=>b.onclick=()=>deletePage(b.dataset.delpage));
  $("itemsManage").querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>editItem(b.dataset.edit));
  $("itemsManage").querySelectorAll("[data-delitem]").forEach(b=>b.onclick=()=>deleteItem(b.dataset.delitem));
  makeQr("adminQr");
}
function makeQr(id){const el=$(id);if(!el)return;el.innerHTML="";if(window.QRCode)new QRCode(el,{text:location.href.split("#")[0],width:128,height:128,colorDark:"#26352a",colorLight:"#ffffff"});}
async function refreshAuth(){
  if(!sb)return;const {data}=await sb.auth.getSession();currentUser=data.session?.user||null;
  if(currentUser){const {data:profile}=await sb.from("profiles").select("role").eq("id",currentUser.id).single();isAdmin=profile?.role==="admin"}else isAdmin=false;
  render();
}
$("loginBtn").onclick=()=>$("authDialog").showModal();
$("logoutBtn").onclick=async()=>{await sb?.auth.signOut();isAdmin=false;currentUser=null;render();toast("خارج شدید.")};
$("authForm").onsubmit=async e=>{e.preventDefault();if(!sb){$("authMessage").textContent="ابتدا تنظیمات Supabase را در config.js وارد کنید.";return}
  const {data,error}=await sb.auth.signInWithPassword({email:$("authEmail").value,password:$("authPassword").value});
  if(error){$("authMessage").textContent="ورود ناموفق بود؛ ایمیل و رمز را بررسی کنید.";return}
  currentUser=data.user;await refreshAuth();$("authDialog").close();$("authMessage").textContent="";toast(isAdmin?"خوش آمدید، مدیر.":"این حساب دسترسی مدیریت ندارد.");
};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$ (b.dataset.close).close());
$("qrBtn").onclick=()=>{$("qrDialog").showModal();makeQr("customerQr")};
$("copyLink").onclick=async()=>{try{await navigator.clipboard.writeText(location.href);toast("لینک منو کپی شد.")}catch{toast("امکان کپی خودکار وجود ندارد.")}};
$("pageForm").onsubmit=async e=>{e.preventDefault();if(!isAdmin)return;const name=$("pageName").value.trim();const {error}=await sb.from("menu_pages").insert({name,description:$("pageDescription").value.trim(),sort_order:pages.length,is_published:true});if(error){toast("ساخت صفحه انجام نشد.");console.error(error);return}$("pageForm").reset();await loadData();toast("صفحه جدید ساخته شد.")};
$("itemForm").onsubmit=async e=>{e.preventDefault();if(!isAdmin)return;let image_url=null;const file=$("itemImage").files[0];if(file){const ext=file.name.split(".").pop().toLowerCase();const path=`${currentUser.id}/${crypto.randomUUID()}.${ext}`;const up=await sb.storage.from("menu-images").upload(path,file,{upsert:false});if(up.error){toast("آپلود تصویر ناموفق بود.");return}image_url=sb.storage.from("menu-images").getPublicUrl(path).data.publicUrl}
  const id=$("itemId").value;const row={page_id:$("itemPage").value,name:$("itemName").value.trim(),description:$("itemDescription").value.trim(),price:Number($("itemPrice").value),currency:$("currency").value.trim()||"تومان",available:$("itemAvailable").checked,is_published:true,...(image_url?{image_url}:{})};
  const result=id?await sb.from("menu_items").update(row).eq("id",id):await sb.from("menu_items").insert(row);
  if(result.error){toast("ذخیره محصول انجام نشد.");console.error(result.error);return}resetItemForm();await loadData();toast("محصول ذخیره شد.")
};
function resetItemForm(){$("itemForm").reset();$("itemId").value="";$("itemFormTitle").textContent="افزودن محصول";$("cancelEdit").classList.add("hidden");$("currency").value=cfg.CURRENCY||"تومان"}
function editItem(id){const x=items.find(a=>a.id===id);if(!x)return;$("itemId").value=x.id;$("itemPage").value=x.page_id;$("itemName").value=x.name;$("itemDescription").value=x.description||"";$("itemPrice").value=x.price;$("currency").value=x.currency||"تومان";$("itemAvailable").checked=x.available!==false;$("itemFormTitle").textContent="ویرایش محصول";$("cancelEdit").classList.remove("hidden");$("itemForm").scrollIntoView({behavior:"smooth",block:"start"})}
$("cancelEdit").onclick=resetItemForm;
async function deleteItem(id){if(!confirm("این محصول حذف شود؟"))return;const {error}=await sb.from("menu_items").delete().eq("id",id);if(error){toast("حذف محصول ناموفق بود.");return}await loadData();toast("محصول حذف شد.")}
async function renamePage(id){const p=pages.find(x=>x.id===id);const name=prompt("نام جدید صفحه:",p?.name);if(!name?.trim())return;const {error}=await sb.from("menu_pages").update({name:name.trim()}).eq("id",id);if(error){toast("تغییر نام ناموفق بود.");return}await loadData()}
async function deletePage(id){if(!confirm("صفحه و تمام محصولات آن حذف شوند؟"))return;const {error}=await sb.from("menu_pages").delete().eq("id",id);if(error){toast("حذف صفحه ناموفق بود.");return}activePage=null;await loadData();toast("صفحه حذف شد.")}
initBrand();resetItemForm();
(async()=>{await loadData();if(sb){await refreshAuth();sb.auth.onAuthStateChange(()=>setTimeout(refreshAuth,0))}else toast("حالت پیش‌نمایش فعال است؛ برای مدیریت، Supabase را متصل کنید.")})();


// Ordering, payments and daily reports
let cart = JSON.parse(localStorage.getItem("misooo-cart") || "[]");
let orderCache = [];
const fmt = n => new Intl.NumberFormat("fa-IR").format(Number(n||0));
function persistCart(){localStorage.setItem("misooo-cart",JSON.stringify(cart));updateCartUI()}

let cartExtrasCache=[];
async function loadCartExtras(){
 if(!sb)return;
 const {data,error}=await sb.from("menu_extras").select("id,name,price,max_quantity").eq("is_active",true);
 if(!error)cartExtrasCache=data||[];
}
function addToCart(id){const x=items.find(i=>i.id===id);if(!x||x.available===false)return;const row=cart.find(c=>c.id===id);if(row)row.quantity++;else cart.push({id,quantity:1,extras:[]});persistCart();toast("به سبد خرید اضافه شد.")}
function updateCartUI(){const count=cart.reduce((a,b)=>a+b.quantity,0);if($("cartCount"))$("cartCount").textContent=fmt(count);if($("cartBar"))$("cartBar").classList.toggle("hidden",!count);if($("cartSummary"))$("cartSummary").textContent=`${fmt(count)} قلم در سبد خرید`}
function cartTotal(){
 return cart.reduce((sum,c)=>{const x=items.find(i=>i.id===c.id);const base=(Number(x?.price)||0)*c.quantity;const extra=(c.extras||[]).reduce((a,e)=>a+(Number(cartExtrasCache.find(x=>x.id===e.id)?.price)||0),0);return sum+base+extra},0)
}
async function showCart(){
 if(!cart.length){toast("سبد خرید خالی است.");return}
 await loadCartExtras();
 const links=await sb.from("product_extras").select("menu_item_id,extra_id");
 const linked=links.data||[];
 $("cartLines").innerHTML=cart.map(c=>{
  const x=items.find(i=>i.id===c.id);if(!x)return "";
  const allowed=new Set(linked.filter(l=>l.menu_item_id===c.id).map(l=>l.extra_id));
  const extras=cartExtrasCache.filter(e=>allowed.has(e.id));
  const extraMarkup=extras.length?`<div class="cart-extras"><strong>افزودنی‌ها (قیمت هر نوع فقط یک‌بار برای این محصول):</strong>${extras.map(e=>{const selected=(c.extras||[]).find(v=>v.id===e.id);return `<label class="extra-choice"><input type="checkbox" data-extra="${e.id}" data-product="${c.id}" ${selected?"checked":""}><span>${escapeHtml(e.name)} · ${fmt(e.price)} تومان</span>${selected?`<input aria-label="تعداد ${escapeHtml(e.name)}" type="number" min="1" ${e.max_quantity?`max="${e.max_quantity}"`:""} value="${selected.quantity}" data-extra-qty="${e.id}" data-product="${c.id}">`:""}</label>`}).join("")}</div>`:"";
  const exTotal=(c.extras||[]).reduce((a,e)=>a+(Number(cartExtrasCache.find(v=>v.id===e.id)?.price)||0),0);
  return `<div class="cart-line"><span>${escapeHtml(x.name)} × ${fmt(c.quantity)}</span><strong>${fmt(Number(x.price)*c.quantity+exTotal)} ${escapeHtml(x.currency||"تومان")}</strong><div><button class="small-btn" data-minus="${c.id}">−</button><button class="small-btn" data-plus="${c.id}">+</button><button class="small-btn danger" data-remove="${c.id}">حذف</button></div>${extraMarkup}</div>`
 }).join("");
 $("cartTotal").textContent=fmt(cartTotal())+" تومان";
 $("cartLines").querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));
 $("cartLines").querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));
 $("cartLines").querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{cart=cart.filter(c=>c.id!==b.dataset.remove);persistCart();showCart()});
 $("cartLines").querySelectorAll("[data-extra]").forEach(b=>b.onchange=()=>{const c=cart.find(v=>v.id===b.dataset.product);if(!c)return;c.extras??=[];if(b.checked){const e=cartExtrasCache.find(v=>v.id===b.dataset.extra);c.extras.push({id:e.id,quantity:1})}else c.extras=c.extras.filter(v=>v.id!==b.dataset.extra);persistCart();showCart()});
 $("cartLines").querySelectorAll("[data-extra-qty]").forEach(b=>b.onchange=()=>{const c=cart.find(v=>v.id===b.dataset.product);const e=cartExtrasCache.find(v=>v.id===b.dataset.extra);const row=c?.extras?.find(v=>v.id===b.dataset.extra);if(row){let q=Math.max(1,Number(b.value)||1);if(e?.max_quantity)q=Math.min(q,e.max_quantity);row.quantity=q;persistCart();showCart()}});
 $("cartDialog").showModal()
}
function changeQty(id,d){const c=cart.find(x=>x.id===id);if(c)c.quantity+=d;cart=cart.filter(x=>x.quantity>0);persistCart();showCart()}
$("cartBtn").onclick=showCart;$("openCart").onclick=showCart;
$("checkoutForm").onsubmit=async e=>{
 e.preventDefault();if(!sb){$("checkoutMessage").textContent="برای ثبت سفارش باید اتصال Supabase فعال باشد.";return}
 const lines=cart.map(c=>({id:c.id,quantity:c.quantity,extras:c.extras||[]}));
 const coupon=$("couponInput")?.value.trim().toUpperCase()||null;
 const eventId=$("checkoutEvent")?.value||null;
 const phone=$("eventRegistrationPhone")?.value.trim()||null;
 const rpcName=eventId?"submit_cafe_event_order":"submit_cafe_order_v2";
 const args={p_customer_name:$("customerName").value.trim(),p_lines:lines,p_coupon_code:coupon};
 if(eventId){args.p_event_id=eventId;args.p_registration_phone=phone}
 const {data,error}=await sb.rpc(rpcName,args);
 if(error){console.error(error);$("checkoutMessage").textContent="ثبت سفارش انجام نشد: "+error.message;return}
 cart=[];persistCart();$("cartDialog").close();toast("سفارش شما ثبت شد و منتظر تأیید کافه است.");$("checkoutForm").reset()
};
function switchAdminTab(tab){["menu","orders","reports","features"].forEach(k=>{$("admin"+(k[0].toUpperCase()+k.slice(1))).classList.toggle("hidden",k!==tab)});document.querySelectorAll("[data-admin-tab]").forEach(b=>b.classList.toggle("active",b.dataset.adminTab===tab));if(tab==="orders")loadOrders();if(tab==="reports")loadReport();if(tab==="features")loadFeatures()}
document.querySelectorAll("[data-admin-tab]").forEach(b=>b.addEventListener("click",()=>switchAdminTab(b.dataset.adminTab)));
async function loadOrders(){if(!isAdmin||!sb)return;const {data,error}=await sb.from("orders").select("*,order_items(*,order_item_extras(*))").in("status",["pending","approved"]).order("created_at",{ascending:false});if(error){$("ordersList").textContent="خطا در دریافت سفارشات: "+error.message;return}orderCache=data||[];$("pendingCount").textContent=fmt(orderCache.filter(o=>o.status==="pending").length);$("ordersList").innerHTML=orderCache.length?orderCache.map(o=>`<article class="order-card"><div class="order-head"><strong>${o.order_number?"سفارش شماره "+fmt(o.order_number):"سفارش جدید"}</strong><span class="status ${o.status}">${o.status==="pending"?"در انتظار تأیید":"تأیید شده"}</span></div><p>مشتری: ${escapeHtml(o.customer_name)} · ${new Date(o.created_at).toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"})}</p><ul>${(o.order_items||[]).map(i=>`<li>${escapeHtml(i.item_name)} × ${fmt(i.quantity)} — ${fmt(i.line_total)}${(i.order_item_extras||[]).map(x=>`<small> + ${escapeHtml(x.extra_name)} (${fmt(x.quantity)})</small>`).join("")}</li>`).join("")}</ul>${Number(o.discount_total||0)>0?`<p>تخفیف: ${fmt(o.discount_total)} تومان ${o.coupon_code?`(${escapeHtml(o.coupon_code)})`:""}</p>`:""}<strong>جمع کل: ${fmt(o.total)} تومان</strong><div class="order-actions">${o.status==="pending"?`<button class="button button-dark" data-approve="${o.id}">تأیید و تخصیص شماره</button>`:`<button class="button button-dark" data-single-settle="${o.id}">تسویه و چاپ رسید</button><button class="small-btn" data-print="${o.id}">چاپ پیش‌فاکتور</button>`}</div></article>`).join(""):'<div class="empty">سفارشی در انتظار اقدام وجود ندارد.</div>';
$("groupOrderList").innerHTML=orderCache.filter(o=>o.status==="approved").map(o=>`<label class="check-label"><input type="checkbox" class="group-order" value="${o.id}" data-total="${o.total}"> ${o.order_number?"#"+fmt(o.order_number):"سفارش"} · ${escapeHtml(o.customer_name)} · ${fmt(o.total)} تومان</label>`).join("");
$("ordersList").querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>approveOrder(b.dataset.approve));$("ordersList").querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>printReceipt(orderCache.find(o=>o.id===b.dataset.print)));$("ordersList").querySelectorAll("[data-single-settle]").forEach(b=>b.onclick=()=>settleSingle(b.dataset.singleSettle));}
async function approveOrder(id){const {data,error}=await sb.rpc("approve_cafe_order",{p_order:id});if(error){toast("تأیید سفارش ناموفق بود: "+error.message);return}toast("سفارش با شماره "+fmt(data)+" تأیید شد.");loadOrders()}
async function settleSingle(id){const o=orderCache.find(x=>x.id===id);if(!o)return;const cash=Number(prompt(`مبلغ نقدی از ${fmt(o.total)} تومان:`,"0")||0);const card=Number(prompt(`مبلغ کارت (باقی‌مانده ${fmt(Number(o.total)-cash)} تومان):`,String(Number(o.total)-cash))||0);if(cash+card!==Number(o.total)){toast("مجموع نقدی و کارت باید دقیقاً برابر مبلغ سفارش باشد.");return}const {error}=await sb.rpc("settle_cafe_orders",{p_order_ids:[id],p_cash:cash,p_card:card});if(error){toast("تسویه ناموفق بود: "+error.message);return}printReceipt(o);toast("سفارش تسویه شد؛ رسید برای چاپ آماده است.");await loadOrders();await loadReport()}
async function settleSelected(){const ids=[...document.querySelectorAll(".group-order:checked")].map(x=>x.value);if(!ids.length){toast("ابتدا سفارش‌ها را انتخاب کنید.");return}const cash=Number($("groupCash").value||0),card=Number($("groupCard").value||0);const sum=ids.reduce((a,id)=>a+Number(orderCache.find(o=>o.id===id)?.total||0),0);if(Math.round((cash+card)*100)!==Math.round(sum*100)){toast("جمع نقدی و کارت باید برابر جمع سفارش‌ها باشد.");return}const {error}=await sb.rpc("settle_cafe_orders",{p_order_ids:ids,p_cash:cash,p_card:card});if(error){toast("تسویه ناموفق بود: "+error.message);return}toast("تسویه انجام شد؛ رسیدها برای چاپ آماده‌اند.");ids.forEach(id=>printReceipt(orderCache.find(o=>o.id===id)));await loadOrders();await loadReport()}
$("settleGroup").onclick=settleSelected;
function printReceipt(o){
  if(!o)return;
  const rows=(o.order_items||[]).map(i=>`<tr><td>${escapeHtml(i.item_name)}${(i.order_item_extras||[]).map(x=>`<small style="display:block">+ ${escapeHtml(x.extra_name)} × ${fmt(x.quantity)}</small>`).join("")}</td><td>${fmt(i.quantity)}</td><td>${fmt(i.line_total+(i.order_item_extras||[]).reduce((a,x)=>a+Number(x.line_total||0),0))}</td></tr>`).join("");
  const w=window.open("","_blank","width=420,height=760");
  if(!w){toast("اجازه بازشدن پنجره چاپ را بدهید.");return}
  const logo=new URL("assets/misu-logo.jpg",location.href).href;
  const orderNo=o.order_number?fmt(o.order_number):"—";
  const stamp=new Date(o.created_at).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"});
  w.document.write(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>رسید Misu</title>
  <style>
    @page{size:80mm auto;margin:3mm}
    *{box-sizing:border-box}body{font-family:Tahoma,Arial,sans-serif;color:#542b14;width:100%;max-width:74mm;margin:0 auto;padding:3mm;font-size:12px}
    .logo{display:block;width:42mm;height:auto;margin:0 auto 5mm}.brand{text-align:center;font-size:15px;font-weight:bold;margin:0 0 3mm}
    .meta{display:flex;justify-content:space-between;gap:8px;font-weight:bold;margin:3mm 0}
    .rule{border:0;border-top:1px solid #542b14;margin:3mm 0}
    table{width:100%;border-collapse:collapse}th{background:#542b14;color:#fff;padding:8px 4px;font-size:11px}td{padding:7px 3px;border-bottom:1px dashed #a88b76;vertical-align:top}
    td:last-child,th:last-child{text-align:left;white-space:nowrap}td:nth-child(2),th:nth-child(2){text-align:center}.total{display:flex;justify-content:space-between;background:#542b14;color:#fff;padding:10px 8px;margin-top:4mm;font-weight:bold;font-size:15px}
    .thanks{text-align:center;font-weight:bold;font-size:15px;margin:7mm 0 4mm}
    .contact{text-align:center;line-height:1.9;font-size:10px;overflow-wrap:anywhere}
    @media print{body{width:74mm}}
  </style>
  <div class="brand"><img class="logo" src="${logo}" alt="لوگوی میسو">کافه رستوران میسو</div>
  <div class="meta"><span>نام مشتری: ${escapeHtml(o.customer_name)}</span><span>کد سفارش: #${orderNo}</span></div>
  <div class="meta"><span>تاریخ: ${stamp}</span></div><hr class="rule">
  <table><thead><tr><th>شرح کالا</th><th>تعداد</th><th>قیمت کل</th></tr></thead><tbody>${rows}</tbody></table>
  ${Number(o.discount_total||0)>0?`<div class="meta"><span>تخفیف ${o.coupon_code?`(${escapeHtml(o.coupon_code)})`:""}</span><span>− ${fmt(o.discount_total)} تومان</span></div>`:""}<div class="total"><span>جمع کل</span><span>${fmt(o.total)} تومان</span></div>
  <div class="thanks">از انتخاب شما متشکریم</div>
  <hr class="rule"><div class="contact">
  تهران، کارگر شمالی، بین صادقی و دکتر فاطمی، بازارچه لاله<br>
  اینستاگرام: misu_cafe_rastaurant<br>تلفن: ۰۲۱-۸۶۰۵۲۰۵۵
  </div><script>window.onload=()=>{const im=document.querySelector(".logo");if(im.complete)window.print();else im.onload=()=>window.print()}<\/script></html>`);
  w.document.close();
}async function loadReport(){if(!isAdmin||!sb)return;const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());const {data,error}=await sb.from("orders").select("*,order_items(*,order_item_extras(*))").eq("status","paid").eq("order_day",today);if(error){$("reportSummary").textContent="خطا: "+error.message;return}const orders=data||[];const total=orders.reduce((a,o)=>a+Number(o.total),0),cash=orders.reduce((a,o)=>a+Number(o.cash_amount),0),card=orders.reduce((a,o)=>a+Number(o.card_amount),0);const products={};orders.forEach(o=>(o.order_items||[]).forEach(i=>{products[i.item_name]??={qty:0,total:0};products[i.item_name].qty+=i.quantity;products[i.item_name].total+=Number(i.line_total)}));$("reportSummary").innerHTML=[ ["تعداد سفارش",orders.length],["فروش کل",fmt(total)+" تومان"],["نقدی",fmt(cash)+" تومان"],["کارت",fmt(card)+" تومان"] ].map(x=>`<div class="report-tile"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");$("productReport").innerHTML=Object.entries(products).map(([n,v])=>`<p>${escapeHtml(n)}: ${fmt(v.qty)} عدد · ${fmt(v.total)} تومان</p>`).join("")||"هنوز فروش تسویه‌شده‌ای ثبت نشده است.";window.todayReport={today,orders,total,cash,card,products};}
function jalaliDate(iso){const d=new Date(iso+"T12:00:00+03:30");return new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(d).replaceAll("/","-")}
$("downloadReport").onclick=()=>{const r=window.todayReport;if(!r)return;const lines=["گزارش فروش Misu",`تاریخ شمسی: ${jalaliDate(r.today)}`,`تعداد سفارش: ${r.orders.length}`,`فروش کل: ${r.total} تومان`,`نقدی: ${r.cash} تومان`,`کارت: ${r.card} تومان`,"","محصولات فروخته‌شده:",...Object.entries(r.products).map(([n,v])=>`${n}: ${v.qty} عدد - ${v.total} تومان`)];const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Misu-${jalaliDate(r.today)}.txt`;a.click();URL.revokeObjectURL(a.href)};
$("closeBusinessDay").onclick=async()=>{const r=window.todayReport;if(!r)return;if(!confirm("گزارش TXT را دانلود کرده‌اید؟ خلاصه فروش روز ثبت می‌شود و جزئیات سفارش‌ها در سوابق باقی می‌مانند."))return;const {error}=await sb.rpc("archive_cafe_day",{p_day:r.today});if(error){toast("آرشیو ناموفق بود: "+error.message);return}$("archiveMessage").textContent="خلاصه گزارش روز ثبت شد؛ همه سفارش‌ها و جزئیاتشان در سوابق باقی ماندند.";await loadReport()};
setInterval(()=>{if(isAdmin&&!$("adminOrders").classList.contains("hidden"))loadOrders()},60000);



// Optional Misu features (requires features-migration.sql)
let featureData={extras:[],discounts:[],coupons:[],events:[],music:[]};
const isoInput=id=>$(id).value?new Date($(id).value).toISOString():null;
function localDateLabel(v){return v?new Date(v).toLocaleString("fa-IR",{timeZone:"Asia/Tehran"}):"بدون زمان"}
async function loadFeatures(){
 if(!isAdmin||!sb)return;
 const specs=[["extras","menu_extras","*"],["discounts","product_discounts","*,menu_items(name)"],["coupons","coupon_codes","*"],["events","cafe_events","*"],["music","music_suggestions","*"]];
 const results=await Promise.all(specs.map(async ([k,t,q])=>{const r=await sb.from(t).select(q).order("created_at",{ascending:false});if(r.error){console.warn(t,r.error);return [k,[]]}return [k,r.data||[]]}));
 featureData=Object.fromEntries(results);
 $("discountProduct").innerHTML=items.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
 $("extraProducts").innerHTML=items.map(x=>`<option value="${x.id}">${escapeHtml(x.name)}</option>`).join("");
 $("extrasManage").innerHTML=featureData.extras.map(x=>`<div class="manage-row"><span>${escapeHtml(x.name)} · ${fmt(x.price)} تومان ${x.max_quantity?`· سقف ${x.max_quantity}`:"· نامحدود"}</span><button class="small-btn" data-extra-toggle="${x.id}" data-active="${x.is_active}">${x.is_active?"غیرفعال‌سازی":"فعال‌سازی"}</button><button class="small-btn danger" data-extra-del="${x.id}">حذف</button></div>`).join("")||"افزودنی ثبت نشده است.";
 $("discountsManage").innerHTML=featureData.discounts.map(x=>`<div class="manage-row"><span>${escapeHtml(x.menu_items?.name||"محصول")} · ${fmt(x.percent)}٪ · ${x.is_active?"فعال":"غیرفعال"}</span><button class="small-btn" data-discount-toggle="${x.id}" data-active="${x.is_active}">${x.is_active?"غیرفعال‌سازی":"فعال‌سازی"}</button><button class="small-btn danger" data-discount-del="${x.id}">حذف</button></div>`).join("")||"تخفیفی ثبت نشده است.";
 $("couponsManage").innerHTML=featureData.coupons.map(x=>`<div class="manage-row"><span>${escapeHtml(x.code)} · ${x.discount_type==="percent"?fmt(x.discount_value)+"٪":fmt(x.discount_value)+" تومان"} · ${x.is_active?"فعال":"غیرفعال"}</span><button class="small-btn" data-coupon-toggle="${x.id}" data-active="${x.is_active}">${x.is_active?"غیرفعال‌سازی":"فعال‌سازی"}</button><button class="small-btn danger" data-coupon-del="${x.id}">حذف</button></div>`).join("")||"کدی ثبت نشده است.";
 $("eventsManage").innerHTML=featureData.events.map(x=>`<div class="manage-row"><span>${escapeHtml(x.title)} · ${x.status} · حداقل ${fmt(x.min_attendees)} نفر</span><button class="small-btn" data-event-toggle="${x.id}" data-status="${x.status}">${x.status==="published"?"پیش‌نویس":"انتشار"}</button><button class="small-btn danger" data-event-del="${x.id}">حذف</button></div>`).join("")||"رویدادی ثبت نشده است.";
 $("musicManage").innerHTML=featureData.music.map(x=>`<div class="manage-row"><span>${escapeHtml(x.song_title)} ${x.artist?"— "+escapeHtml(x.artist):""} · ${x.status}</span><select data-music-status="${x.id}"><option value="new" ${x.status==="new"?"selected":""}>جدید</option><option value="approved" ${x.status==="approved"?"selected":""}>تأیید</option><option value="played" ${x.status==="played"?"selected":""}>پخش شد</option><option value="rejected" ${x.status==="rejected"?"selected":""}>رد شد</option></select></div>`).join("")||"پیشنهادی ثبت نشده است.";
 $("extrasManage").querySelectorAll("[data-extra-del]").forEach(b=>b.onclick=()=>deleteFeature("menu_extras",b.dataset.extraDel));
 $("extrasManage").querySelectorAll("[data-extra-toggle]").forEach(b=>b.onclick=()=>toggleFeature("menu_extras",b.dataset.extraToggle,b.dataset.active==="true"));
 $("discountsManage").querySelectorAll("[data-discount-toggle]").forEach(b=>b.onclick=()=>toggleFeature("product_discounts",b.dataset.discountToggle,b.dataset.active==="true"));
 $("couponsManage").querySelectorAll("[data-coupon-toggle]").forEach(b=>b.onclick=()=>toggleFeature("coupon_codes",b.dataset.couponToggle,b.dataset.active==="true"));
 $("discountsManage").querySelectorAll("[data-discount-del]").forEach(b=>b.onclick=()=>deleteFeature("product_discounts",b.dataset.discountDel));
 $("couponsManage").querySelectorAll("[data-coupon-del]").forEach(b=>b.onclick=()=>deleteFeature("coupon_codes",b.dataset.couponDel));
 $("eventsManage").querySelectorAll("[data-event-del]").forEach(b=>b.onclick=()=>deleteFeature("cafe_events",b.dataset.eventDel));
 $("eventsManage").querySelectorAll("[data-event-toggle]").forEach(b=>b.onclick=async()=>{const next=b.dataset.status==="published"?"draft":"published";const {error}=await sb.from("cafe_events").update({status:next}).eq("id",b.dataset.eventToggle);if(error){toast("تغییر وضعیت رویداد انجام نشد.");return}loadFeatures();loadPublicEvents()});
 $("musicManage").querySelectorAll("[data-music-status]").forEach(sel=>sel.onchange=async()=>{const {error}=await sb.from("music_suggestions").update({status:sel.value}).eq("id",sel.dataset.musicStatus);if(error)toast("تغییر وضعیت پیشنهاد ناموفق بود.")});
 $("eventAdminSelect").innerHTML=featureData.events.map(ev=>`<option value="${ev.id}">${escapeHtml(ev.title)}</option>`).join("");
 await loadEventAdminDetails();
}
async function toggleFeature(table,id,active){const {error}=await sb.from(table).update({is_active:!active}).eq("id",id);if(error){toast("تغییر وضعیت انجام نشد.");return}loadFeatures()}
async function deleteFeature(table,id){if(!confirm("این مورد حذف شود؟"))return;const {error}=await sb.from(table).delete().eq("id",id);if(error){toast("حذف انجام نشد؛ دسترسی یا وابستگی را بررسی کنید.");return}loadFeatures()}
async function loadEventAdminDetails(){
 const id=$("eventAdminSelect").value;if(!id)return;
 const [r,m]=await Promise.all([sb.from("event_registrations").select("*").eq("event_id",id).order("created_at",{ascending:false}),sb.from("event_manual_items").select("*").eq("event_id",id).order("created_at",{ascending:false})]);
 $("eventAttendees").innerHTML=(r.data||[]).map(a=>`<div class="manage-row"><span>${escapeHtml(a.customer_name)} · ${escapeHtml(a.phone)} · ${fmt(a.attendee_count)} نفر</span><small>${localDateLabel(a.created_at)}</small></div>`).join("")||"هنوز ثبت‌نامی وجود ندارد.";
 $("eventManualList").innerHTML=(m.data||[]).map(x=>`<div class="manage-row"><span>${escapeHtml(x.title)} · ${fmt(x.price)} تومان</span><button class="small-btn danger" data-manual-del="${x.id}">حذف</button></div>`).join("")||"قلم دستی ثبت نشده است.";
 $("eventManualList").querySelectorAll("[data-manual-del]").forEach(b=>b.onclick=async()=>{const {error}=await sb.from("event_manual_items").delete().eq("id",b.dataset.manualDel);if(error)toast("حذف قلم ناموفق بود.");else loadEventAdminDetails()});
}
$("eventAdminSelect").onchange=loadEventAdminDetails;
$("eventManualForm").onsubmit=async e=>{e.preventDefault();const eventId=$("eventAdminSelect").value;if(!eventId){toast("ابتدا رویداد را انتخاب کنید.");return}const {error}=await sb.from("event_manual_items").insert({event_id:eventId,title:$("manualItemTitle").value.trim(),price:Number($("manualItemPrice").value)});if(error){toast("ثبت قلم ناموفق بود: "+error.message);return}$("eventManualForm").reset();loadEventAdminDetails()};

$("extraForm").onsubmit=async e=>{e.preventDefault();if(!isAdmin)return;const limit=$("extraLimit").value;const {data,error}=await sb.from("menu_extras").insert({name:$("extraName").value.trim(),price:Number($("extraPrice").value),max_quantity:limit?Number(limit):null}).select().single();if(error){toast("ثبت افزودنی ناموفق بود: "+error.message);return}const productIds=[...$("extraProducts").selectedOptions].map(o=>o.value);if(productIds.length){const links=productIds.map(menu_item_id=>({menu_item_id,extra_id:data.id}));const linked=await sb.from("product_extras").insert(links);if(linked.error){toast("افزودنی ساخته شد، اما اتصال به محصولات کامل نشد: "+linked.error.message);loadFeatures();return}}$("extraForm").reset();$("extraPrice").value=0;loadFeatures();toast("افزودنی و اتصال محصولات ثبت شد.")};
$("discountForm").onsubmit=async e=>{e.preventDefault();if(!isAdmin)return;const row={menu_item_id:$("discountProduct").value,percent:Number($("discountPercent").value),starts_at:isoInput("discountStart"),ends_at:isoInput("discountEnd"),is_active:true};const {error}=await sb.from("product_discounts").upsert(row,{onConflict:"menu_item_id"});if(error){toast("ثبت تخفیف ناموفق بود: "+error.message);return}$("discountForm").reset();loadFeatures();toast("تخفیف ثبت شد.")};
$("couponForm").onsubmit=async e=>{e.preventDefault();if(!isAdmin)return;const row={code:$("couponCode").value.trim().toUpperCase(),discount_type:$("couponType").value,discount_value:Number($("couponValue").value),usage_limit:$("couponLimit").value?Number($("couponLimit").value):null,starts_at:isoInput("couponStart"),ends_at:isoInput("couponEnd")};const {error}=await sb.from("coupon_codes").insert(row);if(error){toast("ساخت کد تخفیف ناموفق بود: "+error.message);return}$("couponForm").reset();loadFeatures();toast("کد تخفیف ساخته شد.")};
$("eventForm").onsubmit=async e=>{e.preventDefault();if(!isAdmin)return;const row={title:$("eventTitle").value.trim(),description:$("eventDescription").value.trim(),image_url:$("eventImage").value.trim()||null,starts_at:isoInput("eventStart"),ends_at:isoInput("eventEnd"),min_attendees:Number($("eventMinimum").value),prepayment_percent:Number($("eventPrepay").value),status:"published"};const {error}=await sb.from("cafe_events").insert(row);if(error){toast("ساخت رویداد ناموفق بود: "+error.message);return}$("eventForm").reset();$("eventMinimum").value=1;$("eventPrepay").value=0;loadFeatures();loadPublicEvents();toast("رویداد منتشر شد.")};
async function loadPublicEvents(){
 if(!sb){$("publicEvents").innerHTML='<p class="muted">برای مشاهده رویدادها اتصال سامانه لازم است.</p>';return}
 const {data,error}=await sb.from("cafe_events").select("*").eq("status","published").order("starts_at",{ascending:true});
 if(error){$("publicEvents").innerHTML='<p class="muted">دریافت رویدادها ممکن نشد.</p>';return}
 if(!data?.length){$("publicEvents").innerHTML='<p class="muted">فعلاً رویدادی اعلام نشده است.</p>';return}
 $("checkoutEvent").innerHTML='<option value="">سفارش عادی</option>'+data.map(ev=>`<option value="${ev.id}">${escapeHtml(ev.title)}</option>`).join("");
 const counts=await sb.rpc("public_event_counts");
 const countMap=Object.fromEntries((counts.data||[]).map(x=>[x.event_id,Number(x.attendee_total)]));
 $("publicEvents").innerHTML=data.map(ev=>`<article class="event-card">${ev.image_url?`<img src="${escapeHtml(ev.image_url)}" alt="${escapeHtml(ev.title)}">`:""}<div class="event-body"><h3>${escapeHtml(ev.title)}</h3><p>${escapeHtml(ev.description||"")}</p><p>زمان: ${localDateLabel(ev.starts_at)}</p><p>حداقل نفرات: ${fmt(ev.min_attendees)} · ثبت‌نام: ${fmt(countMap[ev.id]||0)} نفر</p><p class="muted">پیش‌پرداخت موردنیاز: ${fmt(ev.prepayment_percent)}٪ ${ev.prepayment_percent>0?"(هماهنگی پرداخت با کافه؛ درگاه هنوز فعال نیست)":""}</p><button class="button button-dark" data-register-event="${ev.id}">ثبت‌نام</button></div></article>`).join("");
 $("publicEvents").querySelectorAll("[data-register-event]").forEach(b=>b.onclick=()=>{$("registerEventId").value=b.dataset.registerEvent;$("eventRegisterMessage").textContent="";$("eventRegisterDialog").showModal()});
}
$("checkoutEvent").onchange=()=>{$("eventPhoneWrap").classList.toggle("hidden",!$("checkoutEvent").value)};
$("eventRegisterForm").onsubmit=async e=>{e.preventDefault();if(!sb){$("eventRegisterMessage").textContent="اتصال سامانه برقرار نیست.";return}const {data,error}=await sb.rpc("register_cafe_event",{p_event:$("registerEventId").value,p_name:$("registerName").value.trim(),p_phone:$("registerPhone").value.trim(),p_count:Number($("registerCount").value)});if(error){$("eventRegisterMessage").textContent="ثبت‌نام ناموفق بود: "+error.message;return}$("eventRegisterMessage").textContent="درخواست حضور شما ثبت شد. برای پیش‌پرداخت با کافه هماهنگ کنید.";$("eventRegisterForm").reset();await loadPublicEvents()};
$("musicForm").onsubmit=async e=>{e.preventDefault();if(!sb){$("musicMessage").textContent="اتصال سامانه برقرار نیست.";return}const {error}=await sb.rpc("submit_music_suggestion",{p_name:$("musicName").value.trim()||"مهمان",p_song:$("musicSong").value.trim(),p_artist:$("musicArtist").value.trim()});if(error){$("musicMessage").textContent="ارسال پیشنهاد انجام نشد: "+error.message;return}$("musicForm").reset();$("musicMessage").textContent="ممنون! پیشنهادت برای بررسی به کافه رسید."};
(async()=>{await loadPublicEvents()})();
