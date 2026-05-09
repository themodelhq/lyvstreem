import { useEffect } from 'react';
import { useLiveStream } from '../context/LiveStreamContext';
import { useSocket } from '../context/SocketContext';

// Host-side WebRTC broadcaster. Mounted once at the App level so it owns the
// peer connections to every viewer for the entire live session — independent
// of which page the host is currently on. Previously this lived inside
// GoLivePage, so minimising the stream (or anything that unmounted GoLivePage)
// silently shut down broadcasting, and viewers saw nothing.
//
// Reads the active MediaStream from the LiveStream context (where it's kept
// for the duration of the session). When the context's activeStream id
// changes (start, restart, or end) the effect re-establishes peer-connection
// state.

const ICE_SERVERS = { iceServers: [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]};

export default function HostStreamBroadcaster() {
  const { socket } = useSocket();
  const ctx = useLiveStream();
  const streamId = ctx?.activeStream?._id;

  useEffect(() => {
    if (!socket || !streamId) return;

    // viewerSocketId -> { pc, pendingIce: array, remoteSet: boolean }
    const peers = new Map();

    const closePeer = (viewerSocketId) => {
      const slot = peers.get(viewerSocketId);
      if (slot && slot.pc) { try { slot.pc.close(); } catch (_) {} }
      peers.delete(viewerSocketId);
    };

    const createPeer = async (viewerSocketId) => {
      // Refuse to broadcast if we don't actually have a MediaStream yet
      const localStream = ctx?.localStream?.current;
      if (!localStream || !localStream.getTracks().length) return;

      closePeer(viewerSocketId);

      let pc;
      try { pc = new RTCPeerConnection(ICE_SERVERS); }
      catch (_) { return; }
      const slot = { pc, pendingIce: [], remoteSet: false };
      peers.set(viewerSocketId, slot);

      try {
        localStream.getTracks().forEach(t => {
          try { pc.addTrack(t, localStream); } catch (_) {}
        });
      } catch (_) {}

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('solo_ice', { targetSocketId: viewerSocketId, candidate: e.candidate });
      };
      pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          closePeer(viewerSocketId);
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('solo_offer', { targetSocketId: viewerSocketId, offer, streamId });
      } catch (_) { closePeer(viewerSocketId); }
    };

    const onViewerWants = ({ viewerSocketId }) => { if (viewerSocketId) createPeer(viewerSocketId); };

    const onAnswer = async ({ fromSocketId, answer }) => {
      const slot = peers.get(fromSocketId);
      if (!slot || !slot.pc) return;
      if (slot.pc.signalingState !== 'have-local-offer') return;
      try {
        await slot.pc.setRemoteDescription(answer);
        slot.remoteSet = true;
        // Drain any ICE candidates that arrived before the answer
        for (const cand of slot.pendingIce) {
          try { await slot.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
        }
        slot.pendingIce.length = 0;
      } catch (_) {}
    };

    const onIce = async ({ fromSocketId, candidate }) => {
      const slot = peers.get(fromSocketId);
      if (!slot || !slot.pc || !candidate) return;
      if (!slot.remoteSet) { slot.pendingIce.push(candidate); return; }
      try { await slot.pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
    };

    const onViewerLeft = ({ viewerSocketId }) => closePeer(viewerSocketId);

    socket.on('solo_viewer_wants_stream', onViewerWants);
    socket.on('solo_answer',              onAnswer);
    socket.on('solo_ice',                 onIce);
    socket.on('solo_viewer_left',         onViewerLeft);

    return () => {
      socket.off('solo_viewer_wants_stream', onViewerWants);
      socket.off('solo_answer',              onAnswer);
      socket.off('solo_ice',                 onIce);
      socket.off('solo_viewer_left',         onViewerLeft);
      peers.forEach((slot) => { try { slot.pc?.close(); } catch (_) {} });
      peers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, streamId]);

  return null;
}
