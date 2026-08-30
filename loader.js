const REPO_OWNER = "czepepe-dev";
const REPO_NAME = "privesy";
const PRODUCT_PATH = "data/productos";
const POVOLENE_KATEGORIE = new Set(["prepravniky", "nakladni-privesy", "ostatni"]);
async function ziskejSeznamSouboru() {
  try {
    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${PRODUCT_PATH}?ref=main&t=${Date.now()}`;
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const files = await resp.json();
    return files.filter(f => f.type === 'file' && f.name.endsWith('.json')).map(f => f.name);
  } catch (e) { return []; }
}
async function nactiVsechnyProdukty() {
  const seznam = await ziskejSeznamSouboru();
  const produkty = [];
  for (const file of seznam) {
    try {
      const resp = await fetch(`/${PRODUCT_PATH}/${file}?t=${Date.now()}`);
      const data = await resp.json();
      const kat = String(data.categoria || '').toLowerCase().trim();
      if (!POVOLENE_KATEGORIE.has(kat)) continue;
      data.slug = file.replace(/\.json$/i, '');
      produkty.push(data);
    } catch (e) {}
  }
  return produkty;
}
async function nactiProdukty(kategorie) {
  const cont = document.getElementById('produkty');
  if (cont) cont.innerHTML = '<p>Načítám přívěsy...</p>';
  const produkty = (await nactiVsechnyProdukty()).filter(p => String(p.categoria).toLowerCase() === String(kategorie).toLowerCase());
  vykresliKarty(produkty, 'produkty');
}
async function nactiNoveProdukty() {
  const cont = document.getElementById('nove-produkty');
  if (!cont) return;
  const produkty = await nactiVsechnyProdukty();
  const limit = window.innerWidth < 768 ? 3 : 10;
  vykresliKarty(produkty.slice(0, limit), 'nove-produkty');
}
function vykresliKarty(produkty, containerId) {
  const cont = document.getElementById(containerId);
  if (!cont) return;
  cont.innerHTML = produkty.length === 0 ? '<p>Momentálně nejsou v této kategorii žádné přívěsy.</p>' : '';
  produkty.forEach(p => {
    const detailUrl = `/producto.html?slug=${encodeURIComponent(p.slug)}`;
    const cistyText = String(p.descripcion || '').replace(/<[^>]*>?/gm, '').replace(/[#*`_]/g, '');
    const shortText = cistyText.substring(0, 110);
    cont.innerHTML += `<div class="produkt-card">
      <img src="${p.imagen}" alt="${p.nombre}" class="produkt-img" onclick="window.location.href='${detailUrl}'">
      <h2 class="produkt-nazev">${p.nombre}</h2>
      <h1 class="produkt-cena">${p.precio}</h1>
      <div class="produkt-popis">${shortText}${cistyText.length > 110 ? '...' : ''}</div>
      <div class="produkt-buttons">
        <button class="produkt-info-btn" onclick="window.location.href='${detailUrl}'">DETAIL</button>
        <button class="produkt-btn" onclick="window.location.href='contacto.html'">KONTAKT</button>
      </div>
    </div>`;
  });
}
function scrollSlider(direction) {
  const slider = document.getElementById('nove-produkty');
  if (!slider) return;
  slider.scrollBy({ left: direction * slider.clientWidth, behavior: 'smooth' });
}
