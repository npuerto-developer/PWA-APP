// webrtc.js
let peer = null;
let channel = null;

export async function startConnection(onMessage) {
  peer = new RTCPeerConnection();
  channel = peer.createDataChannel("sync");

  channel.onopen = () => console.log("Conexión P2P abierta");
  channel.onmessage = (e) => onMessage(JSON.parse(e.data));

  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);

  return JSON.stringify(peer.localDescription); // para copiar
}

export async function acceptConnection(remoteSDP, onMessage) {
  peer = new RTCPeerConnection();

  peer.ondatachannel = (e) => {
    channel = e.channel;
    channel.onopen = () => console.log("Canal abierto");
    channel.onmessage = (e) => onMessage(JSON.parse(e.data));
  };

  await peer.setRemoteDescription(JSON.parse(remoteSDP));
  const answer = await peer.createAnswer();
  await peer.setLocalDescription(answer);

  return JSON.stringify(peer.localDescription); // para copiar
}

export async function receiveAnswer(answerSDP) {
  await peer.setRemoteDescription(JSON.parse(answerSDP));
}

export function sendData(data) {
  if (channel?.readyState === "open") {
    channel.send(JSON.stringify(data));
  }
}
