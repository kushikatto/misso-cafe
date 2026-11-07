/* Digital Menu starter — Supabase-backed */
const cfg = window.MENU_CONFIG || {};
const ready = cfg.SUPABASE_URL && !cfg.SUPABASE_URL.includes("YOUR-PROJECT") && cfg.SUPABASE_ANON_KEY && !cfg.SUPABASE_ANON_KEY.includes("YOUR_");
const sb = ready ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
let pages = [], items = [], activePage = null, isAdmin = false, currentUser = null;
const $ = id => document.getElementById(id);
const money = n => new Intl.NumberFormat("fa-IR").format(Number(n || 0));
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2600)}
function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function initBrand(){const name=cfg.CAFE_NAME||"منوی کافه";$("brandName").textContent=name;$("footerName").textContent=name;document.title=name}
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
function addToCart(id){const x=items.find(i=>i.id===id);if(!x||x.available===false)return;const row=cart.find(c=>c.id===id);if(row)row.quantity++;else cart.push({id,quantity:1});persistCart();toast("به سبد خرید اضافه شد.")}
function updateCartUI(){const count=cart.reduce((a,b)=>a+b.quantity,0);if($("cartCount"))$("cartCount").textContent=fmt(count);if($("cartBar"))$("cartBar").classList.toggle("hidden",!count);if($("cartSummary"))$("cartSummary").textContent=`${fmt(count)} قلم در سبد خرید`}
function cartTotal(){return cart.reduce((sum,c)=>{const x=items.find(i=>i.id===c.id);return sum+(Number(x?.price)||0)*c.quantity},0)}
function showCart(){if(!cart.length){toast("سبد خرید خالی است.");return}$("cartLines").innerHTML=cart.map(c=>{const x=items.find(i=>i.id===c.id);if(!x)return "";return `<div class="cart-line"><span>${escapeHtml(x.name)} × ${fmt(c.quantity)}</span><strong>${fmt(x.price*c.quantity)} ${escapeHtml(x.currency||"تومان")}</strong><div><button class="small-btn" data-minus="${c.id}">−</button><button class="small-btn" data-plus="${c.id}">+</button><button class="small-btn danger" data-remove="${c.id}">حذف</button></div></div>`}).join("");$("cartTotal").textContent=fmt(cartTotal())+" تومان";$("cartLines").querySelectorAll("[data-minus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.minus,-1));$("cartLines").querySelectorAll("[data-plus]").forEach(b=>b.onclick=()=>changeQty(b.dataset.plus,1));$("cartLines").querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>{cart=cart.filter(c=>c.id!==b.dataset.remove);persistCart();showCart()});$("cartDialog").showModal()}
function changeQty(id,d){const c=cart.find(x=>x.id===id);if(c)c.quantity+=d;cart=cart.filter(x=>x.quantity>0);persistCart();showCart()}
$("cartBtn").onclick=showCart;$("openCart").onclick=showCart;
$("checkoutForm").onsubmit=async e=>{e.preventDefault();if(!sb){$("checkoutMessage").textContent="برای ثبت سفارش باید اتصال Supabase فعال باشد.";return}const lines=cart.map(c=>({id:c.id,quantity:c.quantity}));const {data,error}=await sb.rpc("submit_cafe_order",{p_customer_name:$("customerName").value.trim(),p_lines:lines});if(error){console.error(error);$("checkoutMessage").textContent="ثبت سفارش انجام نشد: "+error.message;return}cart=[];persistCart();$("checkoutDialog")?.close();$("cartDialog").close();toast("سفارش شما ثبت شد و منتظر تأیید کافه است.");$("checkoutForm").reset()};
function switchAdminTab(tab){["menu","orders","reports"].forEach(k=>{$("admin"+(k[0].toUpperCase()+k.slice(1))).classList.toggle("hidden",k!==tab)});document.querySelectorAll("[data-admin-tab]").forEach(b=>b.classList.toggle("active",b.dataset.adminTab===tab));if(tab==="orders")loadOrders();if(tab==="reports")loadReport()}
document.querySelectorAll("[data-admin-tab]").forEach(b=>b.addEventListener("click",()=>switchAdminTab(b.dataset.adminTab)));
async function loadOrders(){if(!isAdmin||!sb)return;const {data,error}=await sb.from("orders").select("*,order_items(*)").in("status",["pending","approved"]).order("created_at",{ascending:false});if(error){$("ordersList").textContent="خطا در دریافت سفارشات: "+error.message;return}orderCache=data||[];$("pendingCount").textContent=fmt(orderCache.filter(o=>o.status==="pending").length);$("ordersList").innerHTML=orderCache.length?orderCache.map(o=>`<article class="order-card"><div class="order-head"><strong>${o.order_number?"سفارش شماره "+fmt(o.order_number):"سفارش جدید"}</strong><span class="status ${o.status}">${o.status==="pending"?"در انتظار تأیید":"تأیید شده"}</span></div><p>مشتری: ${escapeHtml(o.customer_name)} · ${new Date(o.created_at).toLocaleTimeString("fa-IR",{hour:"2-digit",minute:"2-digit"})}</p><ul>${(o.order_items||[]).map(i=>`<li>${escapeHtml(i.item_name)} × ${fmt(i.quantity)} — ${fmt(i.line_total)}</li>`).join("")}</ul><strong>جمع کل: ${fmt(o.total)} تومان</strong><div class="order-actions">${o.status==="pending"?`<button class="button button-dark" data-approve="${o.id}">تأیید و تخصیص شماره</button>`:`<button class="button button-dark" data-single-settle="${o.id}">تسویه و چاپ رسید</button><button class="small-btn" data-print="${o.id}">چاپ پیش‌فاکتور</button>`}</div></article>`).join(""):'<div class="empty">سفارشی در انتظار اقدام وجود ندارد.</div>';
$("groupOrderList").innerHTML=orderCache.filter(o=>o.status==="approved").map(o=>`<label class="check-label"><input type="checkbox" class="group-order" value="${o.id}" data-total="${o.total}"> ${o.order_number?"#"+fmt(o.order_number):"سفارش"} · ${escapeHtml(o.customer_name)} · ${fmt(o.total)} تومان</label>`).join("");
$("ordersList").querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>approveOrder(b.dataset.approve));$("ordersList").querySelectorAll("[data-print]").forEach(b=>b.onclick=()=>printReceipt(orderCache.find(o=>o.id===b.dataset.print)));$("ordersList").querySelectorAll("[data-single-settle]").forEach(b=>b.onclick=()=>settleSingle(b.dataset.singleSettle));}
async function approveOrder(id){const {data,error}=await sb.rpc("approve_cafe_order",{p_order:id});if(error){toast("تأیید سفارش ناموفق بود: "+error.message);return}toast("سفارش با شماره "+fmt(data)+" تأیید شد.");loadOrders()}
async function settleSingle(id){const o=orderCache.find(x=>x.id===id);if(!o)return;const cash=Number(prompt(`مبلغ نقدی از ${fmt(o.total)} تومان:`,"0")||0);const card=Number(prompt(`مبلغ کارت (باقی‌مانده ${fmt(Number(o.total)-cash)} تومان):`,String(Number(o.total)-cash))||0);if(cash+card!==Number(o.total)){toast("مجموع نقدی و کارت باید دقیقاً برابر مبلغ سفارش باشد.");return}const {error}=await sb.rpc("settle_cafe_orders",{p_order_ids:[id],p_cash:cash,p_card:card});if(error){toast("تسویه ناموفق بود: "+error.message);return}printReceipt(o);toast("سفارش تسویه شد؛ رسید برای چاپ آماده است.");await loadOrders();await loadReport()}
async function settleSelected(){const ids=[...document.querySelectorAll(".group-order:checked")].map(x=>x.value);if(!ids.length){toast("ابتدا سفارش‌ها را انتخاب کنید.");return}const cash=Number($("groupCash").value||0),card=Number($("groupCard").value||0);const sum=ids.reduce((a,id)=>a+Number(orderCache.find(o=>o.id===id)?.total||0),0);if(Math.round((cash+card)*100)!==Math.round(sum*100)){toast("جمع نقدی و کارت باید برابر جمع سفارش‌ها باشد.");return}const {error}=await sb.rpc("settle_cafe_orders",{p_order_ids:ids,p_cash:cash,p_card:card});if(error){toast("تسویه ناموفق بود: "+error.message);return}toast("تسویه انجام شد؛ رسیدها برای چاپ آماده‌اند.");ids.forEach(id=>printReceipt(orderCache.find(o=>o.id===id)));await loadOrders();await loadReport()}
$("settleGroup").onclick=settleSelected;
function printReceipt(o){if(!o)return;const rows=(o.order_items||[]).map(i=>`<tr><td>${escapeHtml(i.item_name)} × ${fmt(i.quantity)}</td><td>${fmt(i.line_total)}</td></tr>`).join("");const w=window.open("","_blank","width=420,height=700");if(!w){toast("اجازه بازشدن پنجره چاپ را بدهید.");return}w.document.write(`<html lang="fa" dir="rtl"><meta charset="utf-8"><title>رسید سفارش</title><style>body{font-family:Tahoma,Arial;padding:16px;width:280px}h2,p{text-align:center}table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px dashed #aaa}.total{font-weight:bold;margin-top:18px}</style><h2>Misooo Cafe</h2><p>رسید سفارش</p><p>شماره ${fmt(o.order_number||0)} | ${new Date(o.created_at).toLocaleString("fa-IR")}</p><p>${escapeHtml(o.customer_name)}</p><table>${rows}</table><p class="total">جمع کل: ${fmt(o.total)} تومان</p><p>از خرید شما سپاسگزاریم</p><script>window.onload=()=>window.print()<\/script></html>`);w.document.close()}
async function loadReport(){if(!isAdmin||!sb)return;const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());const {data,error}=await sb.from("orders").select("*,order_items(*)").eq("status","paid").eq("order_day",today);if(error){$("reportSummary").textContent="خطا: "+error.message;return}const orders=data||[];const total=orders.reduce((a,o)=>a+Number(o.total),0),cash=orders.reduce((a,o)=>a+Number(o.cash_amount),0),card=orders.reduce((a,o)=>a+Number(o.card_amount),0);const products={};orders.forEach(o=>(o.order_items||[]).forEach(i=>{products[i.item_name]??={qty:0,total:0};products[i.item_name].qty+=i.quantity;products[i.item_name].total+=Number(i.line_total)}));$("reportSummary").innerHTML=[ ["تعداد سفارش",orders.length],["فروش کل",fmt(total)+" تومان"],["نقدی",fmt(cash)+" تومان"],["کارت",fmt(card)+" تومان"] ].map(x=>`<div class="report-tile"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join("");$("productReport").innerHTML=Object.entries(products).map(([n,v])=>`<p>${escapeHtml(n)}: ${fmt(v.qty)} عدد · ${fmt(v.total)} تومان</p>`).join("")||"هنوز فروش تسویه‌شده‌ای ثبت نشده است.";window.todayReport={today,orders,total,cash,card,products};}
function jalaliDate(iso){const d=new Date(iso+"T12:00:00+03:30");return new Intl.DateTimeFormat("fa-IR-u-ca-persian-nu-latn",{timeZone:"Asia/Tehran",year:"numeric",month:"2-digit",day:"2-digit"}).format(d).replaceAll("/","-")}
$("downloadReport").onclick=()=>{const r=window.todayReport;if(!r)return;const lines=["گزارش فروش Misooo Cafe",`تاریخ شمسی: ${jalaliDate(r.today)}`,`تعداد سفارش: ${r.orders.length}`,`فروش کل: ${r.total} تومان`,`نقدی: ${r.cash} تومان`,`کارت: ${r.card} تومان`,"","محصولات فروخته‌شده:",...Object.entries(r.products).map(([n,v])=>`${n}: ${v.qty} عدد - ${v.total} تومان`)];const blob=new Blob(["\ufeff"+lines.join("\n")],{type:"text/plain;charset=utf-8"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`Misooo-Cafe-${jalaliDate(r.today)}.txt`;a.click();URL.revokeObjectURL(a.href)};
$("closeBusinessDay").onclick=async()=>{const r=window.todayReport;if(!r)return;if(!confirm("ابتدا گزارش TXT را دانلود کرده‌اید؟ پس از تأیید، جزئیات سفارش‌های پرداخت‌شده امروز آرشیو و از جدول سفارشات حذف می‌شوند."))return;const {error}=await sb.rpc("archive_cafe_day",{p_day:r.today});if(error){toast("آرشیو ناموفق بود: "+error.message);return}$("archiveMessage").textContent="گزارش روز آرشیو شد؛ خلاصه فروش در دیتابیس باقی مانده است.";await loadReport()};
setInterval(()=>{if(isAdmin&&!$("adminOrders").classList.contains("hidden"))loadOrders()},60000);
