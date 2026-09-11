const REPO_OWNER = "czepepe-dev";
const REPO_NAME = "privesy";
const PRODUCT_PATH = "data/productos";
const POVOLENE_KATEGORIE = new Set(["prepravniky", "nakladni-privesy", "ostatni"]);
let produktyCache = null;

async function ziskejSeznamSouboru() {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${PRODUCT_PATH}?ref=main`;
    const resp = await fetch(url, { cache: "force-cache" });
    if (!resp.ok) return [];
    const files = await resp.json();
    return files
      .filter(f => f.type === "file" && f.name.toLowerCase().endsWith(".json"))
      .map(f => f.name);
  } catch (e) {
    return [];
  }
}

async function nactiVsechnyProdukty() {
  if (produktyCache) return produktyCache;

  const seznam = await ziskejSeznamSouboru();
  const produkty = await Promise.all(seznam.map(async file => {
    try {
      // Všechny produkty načítáme souběžně místo jednoho po druhém.
      // Bez ?t=Date.now() může prohlížeč/CDN odpověď efektivně cachovat.
      const resp = await fetch(
        `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${PRODUCT_PATH}/${encodeURIComponent(file)}`,
        { cache: "force-cache" }
      );
      if (!resp.ok) throw new Error(`Nelze načíst ${file}`);
      const data = await resp.json();
      const kat = String(data.categoria || "").toLowerCase().trim();
      if (!POVOLENE_KATEGORIE.has(kat)) return null;
      data.slug = file.replace(/\.json$/i, "");
      return data;
    } catch (e) {
      return null;
    }
  }));

  produktyCache = produkty.filter(Boolean).sort((a, b) => {
    const ta = Date.parse(a.datumPridani || "") || 0;
    const tb = Date.parse(b.datumPridani || "") || 0;
    if (tb !== ta) return tb - ta;
    return String(b.slug || "").localeCompare(String(a.slug || ""));
  });

  return produktyCache;
}

async function nactiProdukty(kategorie) {
  const cont = document.getElementById("produkty");
  if (cont) cont.innerHTML = "<p>Načítám přívěsy...</p>";
  const produkty = (await nactiVsechnyProdukty())
    .filter(p => String(p.categoria).toLowerCase() === String(kategorie).toLowerCase());
  vykresliKarty(produkty, "produkty");
}

async function nactiNoveProdukty() {
  const cont = document.getElementById("nove-produkty");
  if (!cont) return;

  try {
    const produkty = (await nactiVsechnyProdukty())
      .filter(p => String(p.categoria || "").toLowerCase() !== "ostatni");
    const limit = window.innerWidth < 768 ? 3 : 10;
    vykresliKarty(produkty.slice(0, limit), "nove-produkty");
  } catch (e) {
    cont.innerHTML = "<p>Produkty se nepodařilo načíst.</p>";
  } finally {
    const loading = document.getElementById("products-loading");
    if (loading) loading.remove();
  }
}

function zobrazCenuProduktu(p){
  if(String(p.categoria||"").toLowerCase()==="ostatni" && String(p.precio||"").toUpperCase()==="PRODÁNO"){
    return '<span class="cena-prodano">PRODÁNO</span>';
  }
  return p.precio ? p.precio : "";
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

function vykresliKarty(produkty, containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return;

  if (produkty.length === 0) {
    cont.innerHTML = "<p>Momentálně nejsou v této kategorii žádné přívěsy.</p>";
    return;
  }

  // Použijeme malé náhledy pro seznamy. Detail dál používá plnou fotografii.
  cont.innerHTML = produkty.map((p, index) => {
    const detailUrl = `/producto.html?slug=${encodeURIComponent(p.slug)}`;
    const cistyText = String(p.descripcion || "")
      .replace(/<[^>]*>?/gm, "")
      .replace(/[#*`_]/g, "");
    const shortText = cistyText.substring(0, 110);
    const image = p.imagenMiniatura || p.imagen || "";
    const loading = index === 0 ? "eager" : "lazy";
    const priority = index === 0 ? "high" : "auto";

    return `<div class="produkt-card">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(p.nombre || "Přívěs")}" class="produkt-img" loading="${loading}" decoding="async" fetchpriority="${priority}" onclick="window.location.href='${detailUrl}'">
      <h2 class="produkt-nazev">${escapeHtml(p.nombre || "")}</h2>
      <h1 class="produkt-cena">${zobrazCenuProduktu(p)}</h1>
      <div class="produkt-popis">${escapeHtml(shortText)}${cistyText.length > 110 ? "..." : ""}</div>
      <div class="produkt-buttons">
        <button class="produkt-btn" onclick="window.location.href='${detailUrl}'">DETAIL</button>
        <button class="produkt-info-btn" onclick="window.location.href='contacto.html'">KONTAKT</button>
      </div>
    </div>`;
  }).join("");
}

function scrollSlider(direction) {
  const slider = document.getElementById("nove-produkty");
  if (!slider) return;
  slider.scrollBy({ left: direction * slider.clientWidth, behavior: "smooth" });
}
