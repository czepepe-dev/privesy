const PASSWORD = '30666969';

document.getElementById('login-form').addEventListener('submit', function (e) {
  e.preventDefault();
  const input = document.getElementById('password').value;
  const error = document.getElementById('login-error');

  if (input === PASSWORD) {
    sessionStorage.setItem('admin_logged_in', '1');
    window.location.href = 'index.html';
  } else {
    error.textContent = 'Contrasena incorrecta.';
  }
});
