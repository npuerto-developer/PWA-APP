// app.js

// Importar funciones WebRTC desde webrtc.js
import { startConnection, acceptConnection, receiveAnswer, sendData } from './webrtc.js';

function saveData(text) {
  const data = JSON.parse(localStorage.getItem('entries') || '[]');
  const newEntry = { text, date: new Date().toLocaleString() };
  data.push(newEntry);
  localStorage.setItem('entries', JSON.stringify(data));
  renderTable();

  // Enviar al peer si hay conexión
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
}

async function setupP2P() {
  const mode = prompt("Escribe '1' para iniciar conexión (anfitrión), o '2' para conectarte:");

  if (mode === '1') {
    const offer = await startConnection(handleIncoming);
    prompt("Copia esta oferta y compártela con el otro dispositivo:", offer);
    const answer = prompt("Pega la respuesta del otro dispositivo:");
    await receiveAnswer(answer);
  } else if (mode === '2') {
    const offer = prompt("Pega la oferta del otro dispositivo:");
    const answer = await acceptConnection(offer, handleIncoming);
    prompt("Copia esta respuesta y compártela con el otro dispositivo:", answer);
  }
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

  if (!navigator.onLine) {
    const iniciar = confirm("No hay internet. ¿Quieres conectarte a otro dispositivo?");
    if (iniciar) {
      setupP2P();
    }
  } 
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (reg) => console.log('SW registrado', reg.scope),
      (err) => console.error('SW fallo al registrar', err)
    );
  });
}
