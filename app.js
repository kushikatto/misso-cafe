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
  $("menuGrid").innerHTML=visible.length?visible.map(x=>`<article class="menu-card">${x.image_url?`<img class="menu-image" src="${escapeHtml(x.image_url)}" alt="${escapeHtml(x.name)}">`:`<div class="menu-image placeholder">✳</div>`}<div class="menu-info"><h3>${escapeHtml(x.name)}</h3><p>${escapeHtml(x.description||"")}</p><div class="price-row"><span class="price">${money(x.price)} ${escapeHtml(x.currency||cfg.CURRENCY||"تومان")}</span>${x.available===false?'<span class="unavailable">ناموجود</span>':""}</div></div></article>`).join(""):'<div class="empty">در این صفحه هنوز محصولی ثبت نشده است.</div>';
  $("adminPanel").classList.toggle("hidden",!isAdmin);$("loginBtn").classList.toggle("hidden",isAdmin);$("logoutBtn").classList.toggle("hidden",!isAdmin);
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
