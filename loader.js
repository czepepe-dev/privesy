const REPO_OWNER = "czepepe-dev";
const REPO_NAME = "solarcity";
const PRODUCT_PATH = "data/productos";

async function ziskejSeznamSouboru() {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${PRODUCT_PATH}?ref=main&t=${Date.now()}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const files = await resp.json();
    return files.filter(f => f.name.endsWith('.json')).map(f => f.name);
  } catch (e) { return []; }
}

async function nactiProdukty(kategorie) {
  const seznam = await ziskejSeznamSouboru(); 
  const produkty = [];
  const container = document.getElementById("produkty");
  if (container) container.innerHTML = "<p>Cargando productos...</p>";

  for (const file of seznam) {
    try {
      const resp = await fetch(`/${PRODUCT_PATH}/${file}?t=${Date.now()}`);
      const data = await resp.json();
      const katVJsonu = String(data.categoria || "").toLowerCase().trim();
      const katHledana = String(kategorie || "").toLowerCase().trim();
      if (katVJsonu === katHledana) {
        data.slug = file.replace(".json", "");
        produkty.push(data);
      }
    } catch (e) {}
  }
  vykresliKarty(produkty, "produkty");
}

async function nactiNoveProdukty() {
  const seznam = await ziskejSeznamSouboru();
  if (seznam.length === 0) return;

  // Na mobilu jen 3, na PC 10
  const limit = window.innerWidth < 768 ? 3 : 10;
  const novinky = seznam.slice(0, limit); 

  const produkty = [];
  for (const file of novinky) {
    try {
      const resp = await fetch(`/${PRODUCT_PATH}/${file}?t=${Date.now()}`);
      const data = await resp.json();
      data.slug = file.replace(".json", "");
      produkty.push(data);
    } catch (e) {
      console.error("Chyba načítání:", file);
    }
  }
  
  console.log("Načteno novinek:", produkty.length);
  vykresliKarty(produkty, "nove-produkty");
}

function vykresliKarty(produkty, containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.innerHTML = produkty.length === 0 ? "<p>No hay productos disponibles.</p>" : "";
  produkty.forEach(p => {
    const detailUrl = `/producto.html?slug=${p.slug}`;
    const cistyText = (p.descripcion || "").replace(/<[^>]*>?/gm, '').replace(/[#*`_]/g, "");
    const shortText = cistyText.substring(0, 100);
    cont.innerHTML += `
      <div class="produkt-card">
        <img src="${p.imagen}" alt="${p.nombre}" class="produkt-img" onclick="window.location.href='${detailUrl}'">
        <h2 class="produkt-nazev">${p.nombre}</h2>
        <h1 class="produkt-cena">${p.precio}</h1>
        <div class="produkt-popis">${shortText}...</div>
        <div class="produkt-buttons">
          <button class="produkt-btn" onclick="window.location.href='contacto.html'">ORDENAR</button>
          <button class="produkt-info-btn" onclick="window.location.href='${detailUrl}'">DETALLES</button>
        </div>
      </div>`;
  });
}

// POSUN SLIDERU
function scrollSlider(direction) {
  const slider = document.getElementById("nove-produkty");
  if (!slider) return;
  // Na mobilu i PC posune o šířku aktuálně viditelného okna
  const scrollAmount = slider.clientWidth; 
  slider.scrollBy({
    left: direction * scrollAmount,
    behavior: 'smooth'
  });
}
