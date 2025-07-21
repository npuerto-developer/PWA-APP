import { startConnection, acceptConnection, receiveAnswer, sendData } from './webrtc.js';

function saveData(text) {
  const data = JSON.parse(localStorage.getItem('entries') || '[]');
  const newEntry = { text, date: new Date().toLocaleString() };
  data.push(newEntry);
  localStorage.setItem('entries', JSON.stringify(data));
  renderTable();

  sendData({ type: 'new-entry', ...newEntry });
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

function handleIncoming(data) {
  if (data.type === 'new-entry') {
    const current = JSON.parse(localStorage.getItem('entries') || '[]');
    current.push({ text: data.text, date: data.date });
    localStorage.setItem('entries', JSON.stringify(current));
    renderTable();
  }

  if (data.type === 'request-sync') {
    const allData = JSON.parse(localStorage.getItem('entries') || '[]');
    sendData({ type: 'sync-data', data: allData });
  }

  if (data.type === 'sync-data') {
    localStorage.setItem('entries', JSON.stringify(data.data));
    renderTable();
  }
}

async function setupP2P() {
  try {
    const offer = await startConnection(handleIncoming);
    mostrarQR(offer);

    const answer = prompt("Pega la respuesta del otro dispositivo:");
    if (answer) {
      await receiveAnswer(answer);
    }
  } catch (e) {
    console.error("No se pudo iniciar conexión P2P:", e);
  }
}

function mostrarQR(texto) {
  const qr = document.createElement('div');
  qr.style.position = 'absolute';
  qr.style.top = '1rem';
  qr.style.right = '1rem';
  qr.style.background = 'white';
  qr.style.padding = '1rem';
  qr.style.border = '1px solid #ccc';

  const pre = document.createElement('pre');
  pre.textContent = texto;
  qr.appendChild(pre);

  const close = document.createElement('button');
  close.textContent = 'Cerrar';
  close.onclick = () => qr.remove();
  qr.appendChild(close);

  document.body.appendChild(qr);
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

  document.querySelector('#sync-btn').addEventListener('click', () => {
    sendData({ type: "request-sync" });
  });

  if (!navigator.onLine) {
    document.querySelector('#sync-btn').style.display = 'inline-block';
    setupP2P();
  }

  window.addEventListener('online', () => {
    alert("✅ Internet restaurado. Se desactiva conexión local.");
    document.querySelector('#sync-btn').style.display = 'none';
  });

  window.addEventListener('offline', () => {
    alert("🚫 Sin conexión. Iniciando modo local...");
    document.querySelector('#sync-btn').style.display = 'inline-block';
    setupP2P();
  });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => console.log('SW registrado', reg.scope),
      (err) => console.error('SW fallo al registrar', err)
    );
  });
}
