let peer = null;
let channel = null;

export async function startConnection(onMessage) {
  peer = new RTCPeerConnection();
  channel = peer.createDataChannel("sync");

  console.log("Creando canal de datos...");

  channel.onopen = () => console.log("Conexión P2P abierta");
  channel.onmessage = (e) => onMessage(JSON.parse(e.data));

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  console.log("Oferta generada:", peer.localDescription);
  return JSON.stringify(peer.localDescription);
}

export async function acceptConnection(remoteSDP, onMessage) {
  peer = new RTCPeerConnection();

  peer.ondatachannel = (e) => {
    console.log("Canal recibido");
    channel = e.channel;

    channel.onopen = () => console.log("Canal abierto");
    channel.onmessage = (e) => onMessage(JSON.parse(e.data));
  };

  await peer.setRemoteDescription(JSON.parse(remoteSDP));
  console.log("Oferta recibida");
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);
  console.log("Respuesta generada:", peer.localDescription);
  return JSON.stringify(peer.localDescription);
}

export async function receiveAnswer(answerSDP) {
  console.log("Respuesta recibida");
  await peer.setRemoteDescription(JSON.parse(answerSDP));
}

export function sendData(data) {
  if (channel?.readyState === "open") {
    console.log("Enviando datos por P2P", data);
    channel.send(JSON.stringify(data));
  } else {
    console.warn("Canal no está abierto aún");
  }
}
