async function cargarDatos() {
  const res = await fetch('data/productos.json?t=' + Date.now());
  return await res.json();
}

function getParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

const nombresCategorias = {
  paneles: 'Paneles Solares',
  powerbanks: 'Powerbanks Solares',
  luces: 'Luces Solares',
  sistemas: 'Sistemas Solares'
};

function ordenarPorNuevo(lista) {
  return lista.slice().sort((a, b) => Number(b.id) - Number(a.id));
}

// ==========================
// INDEX – NOVÉ PRODUKTY
// ==========================
async function nactiNoveProdukty() {
  const cont = document.getElementById('nove-produkty');
  if (!cont) return;

  const datos = await cargarDatos();

  let vsechny = [];

  Object.keys(datos).forEach(cat => {
    vsechny = vsechny.concat(
      (datos[cat] || []).map(p => ({ ...p, cat }))
    );
  });

  vsechny = ordenarPorNuevo(vsechny);

  const tri = vsechny.slice(0, 3);

  cont.innerHTML = tri.map(p => `
    <a class="card" href="producto.html?slug=${p.slug}">
      <h3>${p.nombre}</h3>
      <p>${p.precio}</p>
    </a>
  `).join('');
}

// ==========================
// KATEGORIE
// ==========================
if (window.location.pathname.endsWith('categoria.html')) {
  (async () => {
    const cat = getParam('cat');
    const datos = await cargarDatos();

    let lista = datos[cat] || [];
    lista = ordenarPorNuevo(lista);

    const titulo = document.getElementById('titulo-categoria');
    const cont = document.getElementById('lista-productos');

    titulo.textContent = nombresCategorias[cat] || 'Productos';

    cont.innerHTML = lista.map(p => `
      <a class="card" href="producto.html?slug=${p.slug}">
        <h3>${p.nombre}</h3>
        <p>${p.precio}</p>
      </a>
    `).join('');
  })();
}

// ==========================
// PRODUKT
// ==========================
if (window.location.pathname.endsWith('producto.html')) {
  (async () => {
    const slug = getParam('slug');
    if (!slug) return;

    const resp = await fetch(`/data/productos/${slug}.json?t=${Date.now()}`);
    const prod = await resp.json();

    const cont = document.getElementById('detalle-producto');

    document.getElementById("p-img").src = prod.imagen;
    document.getElementById("p-nazev").textContent = prod.nombre;
    document.getElementById("p-cena").textContent = prod.precio;
    document.getElementById("p-popis").innerHTML = marked.parse(prod.descripcion || "");

    const gal = document.getElementById("galerie");
    if (prod.galeria) {
      prod.galeria.forEach(item => {
        const img = document.createElement("img");
        img.src = item.imagen;
        img.onclick = (e) => {
          e.stopPropagation();
          openLightbox(item.imagen);
        };
        gal.appendChild(img);
      });
    }
  })();
}

// ==========================
// DEN / NOC
// ==========================
const btn = document.getElementById('theme-toggle');
const themeLink = document.getElementById('theme-style');

if (btn) {
  btn.addEventListener('click', () => {
    if (themeLink.getAttribute('href').includes('day')) {
      themeLink.setAttribute('href', 'assets/css/style-night.css');
      btn.textContent = 'Día';
    } else {
      themeLink.setAttribute('href', 'assets/css/style-day.css');
      btn.textContent = 'Noche';
    }
  });
}
