const $ = id => document.getElementById(id);
let currentProduct = null;

async function api(url, options={}) {
  const r = await fetch(url, {credentials:"same-origin", ...options});
  let data = {};
  try { data = await r.json(); } catch {}
  if (r.status === 401) { showLogin(); throw new Error("Nepřihlášen."); }
  if (!r.ok) throw new Error(data.error || "Chyba serveru.");
  return data;
}
function showLogin(){ $("login").classList.remove("hidden"); $("app").classList.add("hidden"); }
function showApp(){ $("login").classList.add("hidden"); $("app").classList.remove("hidden"); loadProducts(); }
function slugify(s){ return s.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80); }
function setStatus(el,msg,ok=false){ el.textContent=msg; el.style.color=ok?"#176b3a":"#b42318"; }

$("loginForm").addEventListener("submit", async e=>{
  e.preventDefault();
  setStatus($("loginStatus"),"Přihlašuji...",true);
  try {
    await api("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:$("password").value})});
    $("password").value="";
    showApp();
  } catch(err){ setStatus($("loginStatus"),err.message); }
});

$("logoutBtn").onclick=async()=>{await api("/api/admin/logout",{method:"POST"});showLogin();};
$("newBtn").onclick=resetForm;
$("cancelBtn").onclick=resetForm;

function resetForm(){
  currentProduct=null;
  $("productForm").reset(); $("manufacturerSelect").value=""; $("manufacturerCustom").value="";
  $("originalSlug").value="";
  $("formTitle").textContent="Nový přívěs";
  $("mainPreview").innerHTML="";
  $("galleryPreview").innerHTML="";
  $("saveStatus").textContent="";
  updatePayload();
}

function fillForm(p){
  currentProduct=p;
  $("originalSlug").value=p.slug||"";
  $("formTitle").textContent="Upravit přívěs";
  $("name").value=p.nombre||"";
  $("price").value=p.precio||"";
  $("category").value=p.categoria||"ostatni";
  const maker = p.vyrobce || "";
  const makerOption = [...$("manufacturerSelect").options].find(o => o.value === maker);
  $("manufacturerSelect").value = makerOption ? maker : "";
  $("manufacturerCustom").value = makerOption ? "" : maker;
  $("year").value=p.rokVyroby||"";
  $("weight").value=p.provozniHmotnostKg??"";
  $("totalWeight").value=p.celkovaHmotnostKg??"";
  updatePayload();
  $("stk").value=p.stk||"";
  $("description").value=p.descripcion||"";
  $("mainImage").value="";
  $("gallery").value="";
  $("mainPreview").innerHTML=p.imagen?`<img class="thumb" src="${p.imagen}">`:"";
  $("galleryPreview").innerHTML=(p.galeria||[]).map(x=>`<img class="thumb" src="${x.imagen}">`).join("");
  window.scrollTo({top:0,behavior:"smooth"});
}

function updatePayload(){
  const total = Number($("totalWeight").value);
  const operating = Number($("weight").value);
  if (Number.isFinite(total) && Number.isFinite(operating) &&
      $("totalWeight").value !== "" && $("weight").value !== "") {
    const payload = total - operating;
    $("payload").value = payload >= 0 ? payload : "";
  } else {
    $("payload").value = "";
  }
}

$("weight").addEventListener("input", updatePayload);
$("totalWeight").addEventListener("input", updatePayload);

async function loadProducts(){
  try{
    const data=await api("/api/admin/products");
    $("products").innerHTML=data.products.length?data.products.map(p=>`
      <div class="product">
        <img src="${p.imagen||""}" onerror="this.style.visibility='hidden'">
        <div><strong>${escapeHtml(p.nombre||"Bez názvu")}</strong><div class="muted">${escapeHtml(p.precio||"")} · ${escapeHtml(labelCat(p.categoria))}<br>přidáno: ${p.datumPridani?new Date(p.datumPridani).toLocaleString("cs-CZ"):"neuvedeno"}</div></div>
        <div class="actions row"><button class="secondary" data-edit="${escapeAttr(p.slug)}">Upravit</button><button class="danger" data-delete="${escapeAttr(p.slug)}">Smazat</button></div>
      </div>`).join(""):"<p>Žádné přívěsy.</p>";
    document.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>fillForm(data.products.find(p=>p.slug===b.dataset.edit)));
    document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>deleteProduct(b.dataset.delete));
  }catch(err){ $("products").innerHTML=`<p>${escapeHtml(err.message)}</p>`; }
}
function labelCat(c){return c==="prepravniky"?"Přívěsy na koně":c==="nakladni-privesy"?"Nákladní přívěsy":"Ostatní";}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function escapeAttr(s){return escapeHtml(s);}
async function deleteProduct(slug){
  if(!confirm("Opravdu smazat tento přívěs?"))return;
  try{await api("/api/admin/products/"+encodeURIComponent(slug),{method:"DELETE"});if(currentProduct?.slug===slug)resetForm();loadProducts();}catch(err){alert(err.message);}
}
async function uploadImage(file, slug){
  const bytes=await file.arrayBuffer();
  let binary=""; const arr=new Uint8Array(bytes);
  for(let i=0;i<arr.length;i+=0x8000) binary+=String.fromCharCode(...arr.subarray(i,i+0x8000));
  const content=btoa(binary);
  const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"");
  const safe=(file.name.replace(/\.[^.]+$/,"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"foto");
  return api("/api/admin/images",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,filename:`${safe}-${Date.now()}.${ext}`,content})});
}

$("productForm").addEventListener("submit",async e=>{
  e.preventDefault();
  updatePayload();
  setStatus($("saveStatus"),"Ukládám...",true);
  try{
    const name=$("name").value.trim(), slug=slugify(name);
    if(!slug)throw new Error("Zadej název přívěsu.");
    const old=currentProduct;
    const mainFile=$("mainImage").files[0];
    const galleryFiles=[...$("gallery").files];

    const total = $("totalWeight").value==="" ? null : Number($("totalWeight").value);
    const operating = $("weight").value==="" ? null : Number($("weight").value);
    const payload = (total !== null && operating !== null && Number.isFinite(total) && Number.isFinite(operating))
      ? total - operating
      : null;

    const product={
      nombre:name,
      precio:$("price").value.trim(),
      categoria:$("category").value,
      vyrobce:($("manufacturerCustom").value.trim() || $("manufacturerSelect").value),
      rokVyroby:$("year").value?Number($("year").value):null,
      provozniHmotnostKg:operating,
      celkovaHmotnostKg:total,
      uzitecnaHmotnostKg:payload,
      stk:$("stk").value.trim(),
      descripcion:$("description").value
    };

    if(old?.datumPridani) product.datumPridani=old.datumPridani;
    if(old?.imagen) product.imagen=old.imagen;
    if(old?.galeria) product.galeria=old.galeria;

    if(!product.imagen && !mainFile) throw new Error("Vyber hlavní fotografii.");
    if(mainFile){ const r=await uploadImage(mainFile,slug); product.imagen=r.url; }
    if(galleryFiles.length){
      product.galeria=product.galeria||[];
      for(const f of galleryFiles){ const r=await uploadImage(f,slug); product.galeria.push({imagen:r.url}); }
    }

    const r=await api("/api/admin/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,originalSlug:old?.slug||"",product})});
    setStatus($("saveStatus"),r.message,true);
    resetForm();
    loadProducts();
  }catch(err){setStatus($("saveStatus"),err.message);}
});

(async()=>{try{await api("/api/admin/me");showApp();}catch{showLogin();}})();


// --- Náhled a změna pořadí fotogalerie před uložením ---
let galleryItems = [];
let galleryDragIndex = null;

function renderGalleryPreview() {
  const box = document.getElementById("galleryPreview");
  if (!box) return;
  box.innerHTML = "";
  galleryItems.forEach((item, index) => {
    const wrap = document.createElement("div");
    wrap.className = "gallery-item";
    wrap.draggable = true;
    wrap.dataset.index = index;

    const img = document.createElement("img");
    img.src = item.preview;
    img.alt = "Náhled fotografie " + (index + 1);

    const pos = document.createElement("div");
    pos.className = "gallery-pos";
    pos.textContent = "Pozice " + (index + 1);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "gallery-remove";
    remove.textContent = "×";
    remove.title = "Odebrat fotografii";
    remove.addEventListener("click", (e) => {
      e.stopPropagation();
      galleryItems.splice(index, 1);
      renderGalleryPreview();
    });

    wrap.appendChild(img);
    wrap.appendChild(pos);
    wrap.appendChild(remove);

    wrap.addEventListener("dragstart", () => {
      galleryDragIndex = index;
      wrap.classList.add("dragging");
    });
    wrap.addEventListener("dragend", () => {
      galleryDragIndex = null;
      wrap.classList.remove("dragging");
    });
    wrap.addEventListener("dragover", (e) => e.preventDefault());
    wrap.addEventListener("drop", (e) => {
      e.preventDefault();
      if (galleryDragIndex === null || galleryDragIndex === index) return;
      const moved = galleryItems.splice(galleryDragIndex, 1)[0];
      galleryItems.splice(index, 0, moved);
      renderGalleryPreview();
    });

    box.appendChild(wrap);
  });
}

function initGalleryPreview() {
  const input = document.querySelector('input[type="file"][multiple]') || document.querySelector('input[type="file"]');
  if (!input) return;
  input.addEventListener("change", () => {
    const files = Array.from(input.files || []);
    files.forEach(file => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = e => {
        galleryItems.push({file, preview:e.target.result, existing:false});
        renderGalleryPreview();
      };
      reader.readAsDataURL(file);
    });
  });
}

document.addEventListener("DOMContentLoaded", initGalleryPreview);


function getGalleryFilesInOrder() {
  return galleryItems.filter(x => x.file).map(x => x.file);
}

// Galerie: pořadí položek v galleryItems je autoritativní pořadí náhledu před uložením.
