if (sessionStorage.getItem('admin_logged_in') !== '1') {
  window.location.href = 'login.html';
}

async function cargarJSON() {
  const res = await fetch('../data/productos.json');
  const data = await res.json();
  document.getElementById('editor-json').value = JSON.stringify(data, null, 2);
}

cargarJSON();

document.getElementById('guardar').addEventListener('click', () => {
  const contenido = document.getElementById('editor-json').value;
  try {
    JSON.parse(contenido);
  } catch (e) {
    document.getElementById('estado').textContent = 'JSON inválido. Revisa el formato.';
    return;
  }

  const blob = new Blob([contenido], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'productos.json';
  a.click();
  URL.revokeObjectURL(url);
  document.getElementById('estado').textContent = 'Archivo descargado. Súbelo de nuevo al proyecto para aplicar cambios.';
});
