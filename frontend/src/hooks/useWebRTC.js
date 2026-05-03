import { useRef, useState, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ],
};

export default function useWebRTC({ socket, localStream }) {
  const peersRef = useRef({});
  const [peerStreams, setPeerStreams] = useState({});

  const removePeer = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].close();
      delete peersRef.current[socketId];
    }
    setPeerStreams(prev => { const n = { ...prev }; delete n[socketId]; return n; });
  }, []);

  const createPeer = useCallback((targetSocketId, initiator, seatIndex, peerUser) => {
    if (peersRef.current[targetSocketId]) {
      peersRef.current[targetSocketId].close();
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peersRef.current[targetSocketId] = pc;

    if (localStream) {
      localStream.getTracks().forEach(track => {
        const existing = pc.getSenders().find(s => s.track?.kind === track.kind);
        if (!existing) pc.addTrack(track, localStream);
      });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && socket) {
        socket.emit('rtc_ice_candidate', { targetSocketId, candidate: e.candidate, seatIndex });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0];
      if (stream) {
        setPeerStreams(prev => ({ ...prev, [targetSocketId]: { stream, seatIndex, user: peerUser } }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        removePeer(targetSocketId);
      }
    };

    if (initiator && socket) {
      pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
        .then(offer => pc.setLocalDescription(offer))
        .then(() => socket.emit('rtc_offer', { targetSocketId, offer: pc.localDescription, seatIndex }))
        .catch(console.error);
    }
    return pc;
  }, [socket, localStream, removePeer]);

  const handleOffer = useCallback(async ({ fromSocketId, offer, seatIndex, peerUser }) => {
    let pc = peersRef.current[fromSocketId];
    if (!pc) pc = createPeer(fromSocketId, false, seatIndex, peerUser);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket?.emit('rtc_answer', { targetSocketId: fromSocketId, answer: pc.localDescription, seatIndex });
    } catch (err) { console.error('handleOffer:', err); }
  }, [socket, createPeer]);

  const handleAnswer = useCallback(async ({ fromSocketId, answer }) => {
    const pc = peersRef.current[fromSocketId];
    if (pc && pc.signalingState === 'have-local-offer') {
      try { await pc.setRemoteDescription(new RTCSessionDescription(answer)); }
      catch (err) { console.error('handleAnswer:', err); }
    }
  }, []);

  const handleIceCandidate = useCallback(async ({ fromSocketId, candidate }) => {
    const pc = peersRef.current[fromSocketId];
    if (pc && candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (err) { console.error('ICE:', err); }
    }
  }, []);

  const cleanup = useCallback(() => {
    Object.values(peersRef.current).forEach(pc => pc.close());
    peersRef.current = {};
    setPeerStreams({});
  }, []);

  return { peerStreams, createPeer, handleOffer, handleAnswer, handleIceCandidate, removePeer, cleanup };
}
