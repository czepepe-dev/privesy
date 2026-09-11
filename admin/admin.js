const $ = id => document.getElementById(id);
let currentProduct = null;
let equipmentOptions = [];
const DEFAULT_INFO_STOCK = "Přívěs je skladem k prohlídce a odběru Veselí nad Lužnicí, okres Tábor (viz. KONTAKT). V ceně přívěsu je zahrnuta nová STK a veškerá dokumentace pro registr vozidel.";
const DEFAULT_INFO_IMPORT = "Přívěs je skladem v Nizozemsku. Lze dovézt pouze na zakázku po složení zálohy. V ceně přívěsu je zahrnuta doprava do ČR, nová STK a veškerá dokumentace pro registr vozidel.";

async function api(url, options={}) {
  const r = await fetch(url, {credentials:"same-origin", ...options});
  let data = {};
  try { data = await r.json(); } catch {}
  if (r.status === 401) { showLogin(); throw new Error("Nepřihlášen."); }
  if (!r.ok) throw new Error(data.error || "Chyba serveru.");
  return data;
}
function showLogin(){ $("login").classList.remove("hidden"); $("app").classList.add("hidden"); }
async function showApp(){
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");
  await loadEquipment();
  loadProducts();
}
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

function renderEquipmentOptions(){
  const box=$("equipment");
  if(!box)return;
  const checked=new Set([...box.querySelectorAll('input[type="checkbox"]:checked')].map(cb=>cb.value));
  box.innerHTML=equipmentOptions.map(item=>{
    const safe=escapeHtml(item);
    return `<label><input type="checkbox" value="${escapeAttr(item)}"${checked.has(item)?" checked":""}> ${safe}</label>`;
  }).join("");
}

async function loadEquipment(){
  try{
    const data=await api("/api/admin/equipment");
    equipmentOptions=Array.isArray(data.items)?data.items.filter(Boolean):[];
    renderEquipmentOptions();
    $("equipmentStatus").textContent="";
  }catch(err){
    $("equipmentStatus").textContent="Seznam výbavy se nepodařilo načíst: "+err.message;
  }
}

async function addEquipmentOption(){
  const input=$("customEquipment");
  const value=input.value.trim();
  if(!value){
    setStatus($("equipmentStatus"),"Napiš nejdříve název nové výbavy nebo stavu.");
    input.focus();
    return;
  }
  setStatus($("equipmentStatus"),"Přidávám...",true);
  try{
    const data=await api("/api/admin/equipment",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({item:value})
    });
    equipmentOptions=Array.isArray(data.items)?data.items.filter(Boolean):equipmentOptions;
    renderEquipmentOptions();
    const cb=[...$("equipment").querySelectorAll('input[type="checkbox"]')].find(x=>x.value===data.item);
    if(cb)cb.checked=true;
    input.value="";
    setStatus($("equipmentStatus"),data.created?"Nová položka byla přidána do trvalého seznamu.":"Tato položka už v seznamu je.",true);
    input.focus();
  }catch(err){setStatus($("equipmentStatus"),err.message);}
}

$("addEquipmentBtn")?.addEventListener("click",addEquipmentOption);
$("customEquipment")?.addEventListener("keydown",e=>{
  if(e.key==="Enter"){e.preventDefault();addEquipmentOption();}
});

function resetForm(){
  currentProduct=null;
  $("productForm").reset(); $("manufacturerSelect").value=""; $("manufacturerCustom").value="";
  $("originalSlug").value="";
  $("formTitle").textContent="Nový přívěs";
  $("mainPreview").innerHTML="";
  $("galleryPreview").innerHTML="";
  $("saveStatus").textContent="";
  $("customEquipment").value="";
  $("equipmentStatus").textContent="";
  $("infoStock").checked=false;
  $("infoImport").checked=false;
  $("infoStockText").value=DEFAULT_INFO_STOCK;
  $("infoImportText").value=DEFAULT_INFO_IMPORT;
  renderEquipmentOptions();
  updatePayload();
}

function fillForm(p){
  currentProduct=p;
  $("originalSlug").value=p.slug||"";
  $("formTitle").textContent="Upravit přívěs";
  $("name").value=p.nombre||"";
  $("price").value=(p.categoria==="ostatni" && p.puvodniCena) ? p.puvodniCena : (p.precio||"");
  $("category").value=p.categoria||"ostatni";
  const maker=p.vyrobce||"";
  const makerOption=[...$("manufacturerSelect").options].find(o=>o.value===maker);
  $("manufacturerSelect").value=makerOption?maker:"";
  $("manufacturerCustom").value=makerOption?"":maker;
  $("year").value=p.rokVyroby||"";
  $("month").value=p.rokVyrobyMesic||"";
  $("weight").value=p.provozniHmotnostKg??"";
  $("totalWeight").value=p.celkovaHmotnostKg??"";
  updatePayload();
  $("stk").value=p.stk||"";
  // Zobraz všechny centrálně uložené položky a zaškrtni ty, které patří k produktu.
  renderEquipmentOptions();
  $("equipment").querySelectorAll('input[type="checkbox"]').forEach(cb=>cb.checked=Array.isArray(p.vybava)&&p.vybava.includes(cb.value));
  const infoType=String(p.dalsiInfoTyp||"").toLowerCase();
  $("infoStock").checked=infoType==="skladem";
  $("infoImport").checked=infoType==="import";
  $("infoStockText").value=(p.dalsiInfoSkladem ?? DEFAULT_INFO_STOCK);
  $("infoImportText").value=(p.dalsiInfoImport ?? DEFAULT_INFO_IMPORT);
  $("mainImage").value="";
  $("gallery").value=""; galleryPreviewItems=[]; renderGalleryPreview();
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
async function prepareImage(file, maxDimension=1600, quality=0.78){
  if(!file || !file.type.startsWith("image/")) throw new Error("Soubor není obrázek.");
  const objectUrl=URL.createObjectURL(file);
  try{
    const img=await new Promise((resolve,reject)=>{
      const el=new Image();
      el.onload=()=>resolve(el);
      el.onerror=()=>reject(new Error("Obrázek se nepodařilo načíst."));
      el.src=objectUrl;
    });
    const scale=Math.min(1,maxDimension/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext("2d",{alpha:false});
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/webp",quality));
    if(!blob) throw new Error("Optimalizaci obrázku se nepodařilo dokončit.");
    return new File([blob],"foto.webp",{type:"image/webp"});
  }finally{ URL.revokeObjectURL(objectUrl); }
}

async function blobToBase64(file){
  const bytes=await file.arrayBuffer();
  let binary=""; const arr=new Uint8Array(bytes);
  for(let i=0;i<arr.length;i+=0x8000) binary+=String.fromCharCode(...arr.subarray(i,i+0x8000));
  return btoa(binary);
}

async function uploadImage(file, slug, suffix="", maxDimension=1600, quality=0.78){
  const optimized=await prepareImage(file,maxDimension,quality);
  const safe=(file.name.replace(/\.[^.]+$/," ").trim().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-zA-Z0-9_-]+/g,"-").replace(/^-|-$/g,"").slice(0,60)||"foto");
  const content=await blobToBase64(optimized);
  return api("/api/admin/images",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({slug,filename:`${safe}-${Date.now()}${suffix}.webp`,content})});
}

function showMainPreview(file){
  const box=$("mainPreview");
  if(!box)return;
  if(!file){ box.innerHTML=""; return; }
  const url=URL.createObjectURL(file);
  box.innerHTML=`<img class="thumb" src="${url}" alt="Náhled hlavní fotografie">`;
  const img=box.querySelector("img");
  img.onload=()=>URL.revokeObjectURL(url);
}


$("infoStock")?.addEventListener("change",e=>{
  if(e.target.checked) $("infoImport").checked=false;
});
$("infoImport")?.addEventListener("change",e=>{
  if(e.target.checked) $("infoStock").checked=false;
});

$("mainImage")?.addEventListener("change",e=>showMainPreview(e.target.files[0]||null));

$("productForm").addEventListener("submit",async e=>{
  e.preventDefault();
  updatePayload();
  setStatus($("saveStatus"),"Ukládám...",true);
  try{
    const name=$("name").value.trim(), slug=slugify(name);
    if(!slug)throw new Error("Zadej název přívěsu.");
    const old=currentProduct;
    const mainFile=$("mainImage").files[0];
    const galleryFiles=[...galleryPreviewItems].map(x=>x.file);

    const total = $("totalWeight").value==="" ? null : Number($("totalWeight").value);
    const operating = $("weight").value==="" ? null : Number($("weight").value);
    const payload = (total !== null && operating !== null && Number.isFinite(total) && Number.isFinite(operating))
      ? total - operating
      : null;

    const product={
      nombre:name,
      precio:(String($("category").value).toLowerCase()==="ostatni")
        ? "PRODÁNO"
        : $("price").value.trim(),
      puvodniCena:(String($("category").value).toLowerCase()==="ostatni")
        ? (old?.puvodniCena || (old?.precio && old.precio !== "PRODÁNO" ? old.precio : null))
        : null,
      categoria:$("category").value,
      vyrobce:($("manufacturerCustom").value.trim() || $("manufacturerSelect").value),
      rokVyroby:$("year").value?Number($("year").value):null,
      rokVyrobyMesic:$("month").value?Number($("month").value):null,
      provozniHmotnostKg:operating,
      celkovaHmotnostKg:total,
      uzitecnaHmotnostKg:payload,
      stk:$("stk").value.trim(),
      vybava:[...$("equipment").querySelectorAll('input[type="checkbox"]:checked')].map(cb=>cb.value),
      dalsiInfoTyp:$("infoStock").checked ? "skladem" : ($("infoImport").checked ? "import" : ""),
      dalsiInfoSkladem:$("infoStockText").value.trim(),
      dalsiInfoImport:$("infoImportText").value.trim()
    };
    if(old?.dalsi !== undefined) product.dalsi=old.dalsi;

    if(old?.datumPridani) product.datumPridani=old.datumPridani;
    if(old?.imagen) product.imagen=old.imagen;
    if(old?.imagenMiniatura) product.imagenMiniatura=old.imagenMiniatura;
    if(old?.galeria) product.galeria=old.galeria;

    if(!product.imagen && !mainFile) throw new Error("Vyber hlavní fotografii.");
    if(mainFile){
      const r=await uploadImage(mainFile,slug,"",1600,0.80);
      product.imagen=r.url;
      const thumb=await uploadImage(mainFile,slug,"-thumb",600,0.76);
      product.imagenMiniatura=thumb.url;
    }
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


// Náhled fotogalerie před uložením – přetažení mění pořadí
let galleryPreviewItems=[];
let galleryDragIndex=null;
function renderGalleryPreview(){
  const box=$("galleryPreview"); if(!box)return;
  box.innerHTML="";
  galleryPreviewItems.forEach((item,i)=>{
    const el=document.createElement("div"); el.className="gallery-item"; el.draggable=true;
    const img=document.createElement("img"); img.src=item.url; img.alt="Náhled "+(i+1);
    const pos=document.createElement("div"); pos.className="gallery-pos"; pos.textContent="Pozice "+(i+1);
    const rm=document.createElement("button"); rm.type="button"; rm.className="gallery-remove"; rm.textContent="×";
    rm.onclick=e=>{e.stopPropagation();galleryPreviewItems.splice(i,1);syncGalleryInput();renderGalleryPreview();};
    el.append(img,pos,rm);
    el.ondragstart=()=>{galleryDragIndex=i;el.classList.add("dragging");};
    el.ondragend=()=>{galleryDragIndex=null;el.classList.remove("dragging");};
    el.ondragover=e=>e.preventDefault();
    el.ondrop=e=>{e.preventDefault();if(galleryDragIndex===null||galleryDragIndex===i)return;
      const x=galleryPreviewItems.splice(galleryDragIndex,1)[0];galleryPreviewItems.splice(i,0,x);
      syncGalleryInput();renderGalleryPreview();};
    box.appendChild(el);
  });
}
function syncGalleryInput(){
  const input=$("gallery"); if(!input)return;
  const dt=new DataTransfer();
  galleryPreviewItems.forEach(x=>{if(x.file)dt.items.add(x.file);});
  input.files=dt.files;
}
$("gallery")?.addEventListener("change",e=>{
  galleryPreviewItems=Array.from(e.target.files||[]).filter(f=>f.type.startsWith("image/")).map(f=>({file:f,url:URL.createObjectURL(f)}));
  renderGalleryPreview();
});
