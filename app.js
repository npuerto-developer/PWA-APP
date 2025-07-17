// app.js
function saveData(text) {
  const data = JSON.parse(localStorage.getItem('entries') || '[]');
  data.push({ text, date: new Date().toLocaleString() });
  localStorage.setItem('entries', JSON.stringify(data));
  renderTable();
}

function renderTable() {
  const data = JSON.parse(localStorage.getItem('entries') || '[]');
  const tbody = document.querySelector('#data-table tbody');
  tbody.innerHTML = data.map(entry => `
    <tr>
      <td>${entry.text}</td>
      <td>${entry.date}</td>
    </tr>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderTable();
  document.querySelector('#entry-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.querySelector('#text-input');
    if (input.value.trim()) {
      saveData(input.value.trim());
      input.value = '';
    }
  });
});

// app.js (al final)
// if ('serviceWorker' in navigator) {
//   navigator.serviceWorker.register('/sw.js').then(() => {
//     console.log('Service Worker registrado.');
//   }).catch(console.error);
// }

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => console.log('SW registrado', reg.scope),
      (err) => console.error('SW fallo al registrar', err)
    );
  });
}