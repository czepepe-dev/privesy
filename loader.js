
const REPO_OWNER = "czepepe-dev";
const REPO_NAME = "privesy";
const PRODUCT_PATH = "data/productos";
const POVOLENE_KATEGORIE = new Set([
  "prepravniky",
  "nakladni-privesy",
  "ostatni"
]);

let produktyCache = null;

// Sjednocení hodnot pro spolehlivé porovnávání kategorií a cen.
function normalizujHodnotu(hodnota) {
  return String(hodnota ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

// Ověří, zda je produkt prodaný.
// Kategorie "ostatni" je určena pro prodané přívěsy.
// Cena PRODÁNO slouží jako další ochrana proti zobrazení mezi aktivními.
function jeProdany(p) {
  return (
    normalizujHodnotu(p.categoria) === "ostatni" ||
    normalizujHodnotu(p.precio) === "prodano"
  );
}

async function ziskejSeznamSouboru() {
  try {
    const url =
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}` +
      `/contents/${PRODUCT_PATH}?ref=main`;

    const resp = await fetch(url, { cache: "no-store" });

    if (!resp.ok) return [];

    const files = await resp.json();

    return files
      .filter(
        f =>
          f.type === "file" &&
          f.name.toLowerCase().endsWith(".json")
      )
      .map(f => ({
        name: f.name,
        sha: f.sha
      }));
  } catch (e) {
    console.error("Nepodařilo se načíst seznam produktů:", e);
    return [];
  }
}

async function nactiVsechnyProdukty() {
  if (produktyCache) return produktyCache;

  const seznam = await ziskejSeznamSouboru();

  const produkty = await Promise.all(
    seznam.map(async entry => {
      const file = entry.name;

      try {
        // SHA v URL mění cache položku při každé změně souboru.
        const url =
          `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}` +
          `/main/${PRODUCT_PATH}/${encodeURIComponent(file)}` +
          `?v=${encodeURIComponent(entry.sha || "")}`;

        const resp = await fetch(url, {
          cache: "force-cache"
        });

        if (!resp.ok) {
          throw new Error(`Nelze načíst ${file}`);
        }

        const data = await resp.json();

        const kategorie = normalizujHodnotu(data.categoria);

        if (!POVOLENE_KATEGORIE.has(kategorie)) {
          return null;
        }

        // Uchováme původní data, ale kategorii sjednotíme.
        data.categoria = kategorie;
        data.slug = file.replace(/\.json$/i, "");

        return data;
      } catch (e) {
        console.error(`Chyba při načítání produktu ${file}:`, e);
        return null;
      }
    })
  );

  produktyCache = produkty
    .filter(Boolean)
    .sort((a, b) => {
      const aPoradi = Number(a.poradi);
      const bPoradi = Number(b.poradi);

      const aMaPoradi =
        a.poradi !== null &&
        a.poradi !== undefined &&
        String(a.poradi).trim() !== "" &&
        Number.isFinite(aPoradi);

      const bMaPoradi =
        b.poradi !== null &&
        b.poradi !== undefined &&
        String(b.poradi).trim() !== "" &&
        Number.isFinite(bPoradi);

      // Ruční pořadí z administrace má přednost.
      if (aMaPoradi && bMaPoradi) {
        return aPoradi - bPoradi;
      }

      // Produkty s ručním pořadím jsou před produkty bez něj.
      if (aMaPoradi && !bMaPoradi) return -1;
      if (!aMaPoradi && bMaPoradi) return 1;

      // Záložní řazení: nejnovější produkt první.
      const ta = Date.parse(a.datumPridani || "") || 0;
      const tb = Date.parse(b.datumPridani || "") || 0;

      if (tb !== ta) return tb - ta;

      return String(b.slug || "").localeCompare(
        String(a.slug || "")
      );
    });

  return produktyCache;
}

async function nactiProdukty(kategorie) {
  const cont = document.getElementById("produkty");

  if (cont) {
    cont.innerHTML = "<p>Načítám přívěsy...</p>";
  }

  try {
    const cilovaKategorie = normalizujHodnotu(kategorie);
    const vsechny = await nactiVsechnyProdukty();

    const produkty = vsechny.filter(p => {
      // Stránka prodaných přívěsů.
      if (cilovaKategorie === "ostatni") {
        return jeProdany(p);
      }

      // Na ostatních kategoriích zobrazujeme pouze aktivní přívěsy.
      return (
        !jeProdany(p) &&
        normalizujHodnotu(p.categoria) === cilovaKategorie
      );
    });

    vykresliKarty(produkty, "produkty");
  } catch (e) {
    console.error("Nepodařilo se načíst kategorii:", e);

    if (cont) {
      cont.innerHTML =
        "<p>Přívěsy se nepodařilo načíst. Zkuste stránku obnovit.</p>";
    }
  }
}

async function nactiNoveProdukty() {
  const cont = document.getElementById("nove-produkty");

  if (!cont) return;

  try {
    const produkty = (await nactiVsechnyProdukty()).filter(
      p =>
        !jeProdany(p) &&
        normalizujHodnotu(p.categoria) === "prepravniky"
    );

    vykresliKarty(produkty, "nove-produkty");
  } catch (e) {
    console.error("Nepodařilo se načíst nové produkty:", e);

    cont.innerHTML =
      "<p>Produkty se nepodařilo načíst.</p>";
  } finally {
    const loading = document.getElementById("products-loading");

    if (loading) loading.remove();
  }
}

function zobrazCenuProduktu(p) {
  if (jeProdany(p)) {
    return '<span class="cena-prodano">PRODÁNO</span>';
  }

  return p.precio ? p.precio : "";
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    })[m]
  );
}

function vykresliKarty(produkty, containerId) {
  const cont = document.getElementById(containerId);

  if (!cont) return;

  if (produkty.length === 0) {
    cont.innerHTML =
      "<p>Momentálně nejsou v této kategorii žádné přívěsy.</p>";
    return;
  }

  // V seznamech používáme malé náhledy.
  // Detail produktu nadále používá plnou fotografii.
  cont.innerHTML = produkty
    .map((p, index) => {
      const detailUrl =
        `/producto.html?slug=${encodeURIComponent(p.slug)}`;

      const cistyText = String(p.descripcion || "")
        .replace(/<[^>]*>?/gm, "")
        .replace(/[#*`_]/g, "");

      const shortText = cistyText.substring(0, 110);
      const image = p.imagenMiniatura || p.imagen || "";
      const loading = index === 0 ? "eager" : "lazy";
      const priority = index === 0 ? "high" : "auto";

      return `<div class="produkt-card">
      <img
        src="${escapeHtml(image)}"
        alt="${escapeHtml(p.nombre || "Přívěs")}"
        class="produkt-img"
        loading="${loading}"
        decoding="async"
        fetchpriority="${priority}"
        onclick="window.location.href='${detailUrl}'"
      >
      <h2 class="produkt-nazev">${escapeHtml(p.nombre || "")}</h2>
      <h1 class="produkt-cena">${zobrazCenuProduktu(p)}</h1>
      <div class="produkt-popis">${escapeHtml(shortText)}${cistyText.length > 110 ? "..." : ""}</div>
      <div class="produkt-buttons">
        <button
          class="produkt-btn"
          onclick="window.location.href='${detailUrl}'"
        >DETAIL</button>
        <button
          class="produkt-info-btn"
          onclick="window.location.href='contacto.html'"
        >KONTAKT</button>
      </div>
    </div>`;
    })
    .join("");
}

function scrollSlider(direction) {
  const slider = document.getElementById("nove-produkty");

  if (!slider) return;

  slider.scrollBy({
    left: direction * slider.clientWidth,
    behavior: "smooth"
  });
}
