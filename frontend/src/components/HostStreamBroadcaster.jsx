import { useEffect } from 'react';
import { useLiveStream } from '../context/LiveStreamContext';
import { useSocket } from '../context/SocketContext';
import { getIceConfig, preferH264Video } from '../utils/webrtcConfig';

// Host-side WebRTC broadcaster. Mounted once at the App level so it owns the
// peer connections to every viewer for the entire live session — independent
// of which page the host is currently on. Reads the active MediaStream from
// the LiveStream context so the connection survives page navigations.
//
// Diagnostic logging is prefixed `[lyvstream/host]` so you can filter the
// browser DevTools console while debugging.

const log  = (...a) => console.log('[lyvstream/host]', ...a);
const warn = (...a) => console.warn('[lyvstream/host]', ...a);

export default function HostStreamBroadcaster() {
  const { socket } = useSocket();
  const ctx = useLiveStream();
  const streamId = ctx?.activeStream?._id;

  useEffect(() => {
    if (!socket) { log('no socket yet — waiting'); return; }
    if (!streamId) return; // not broadcasting

    log('broadcaster active for stream', streamId);

    // viewerSocketId -> { pc, pendingIce: array, remoteSet: boolean }
    const peers = new Map();

    const closePeer = (viewerSocketId) => {
      const slot = peers.get(viewerSocketId);
      if (slot && slot.pc) { try { slot.pc.close(); } catch (_) {} }
      peers.delete(viewerSocketId);
    };

    const createPeer = async (viewerSocketId) => {
      const localStream = ctx?.localStream?.current;
      if (!localStream) {
        warn('viewer asked but localStream is null — viewer will retry', viewerSocketId);
        return;
      }
      const tracks = localStream.getTracks();
      if (!tracks.length) {
        warn('viewer asked but localStream has no tracks');
        return;
      }
      log('creating peer for viewer', viewerSocketId, 'with', tracks.length, 'tracks',
          tracks.map(t => t.kind + (t.enabled ? '' : '(disabled)')));

      closePeer(viewerSocketId);

      // Resolve the ICE config (TURN credentials from Cloudflare via the
      // backend, with STUN fallback). Cached after the first call.
      const iceConfig = await getIceConfig();
      let pc;
      try { pc = new RTCPeerConnection(iceConfig); }
      catch (e) { warn('RTCPeerConnection ctor failed:', e); return; }
      const slot = { pc, pendingIce: [], remoteSet: false };
      peers.set(viewerSocketId, slot);

      tracks.forEach(t => {
        try { pc.addTrack(t, localStream); }
        catch (e) { warn('addTrack failed for', t.kind, e); }
      });

      // iOS Safari has reliable hardware H.264 decoding but flaky VP8/VP9.
      // Push H.264 to the top of the codec list so the negotiated codec is
      // one iOS can definitely render.
      preferH264Video(pc);

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('solo_ice', { targetSocketId: viewerSocketId, candidate: e.candidate });
        }
      };
      pc.oniceconnectionstatechange = () => {
        log('peer', viewerSocketId, 'ICE state:', pc.iceConnectionState);
      };
      pc.onconnectionstatechange = () => {
        log('peer', viewerSocketId, 'connection state:', pc.connectionState);
        if (['failed', 'closed'].includes(pc.connectionState)) {
          closePeer(viewerSocketId);
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        log('sending offer to', viewerSocketId);
        socket.emit('solo_offer', { targetSocketId: viewerSocketId, offer, streamId });
      } catch (e) {
        warn('createOffer/setLocalDescription failed:', e);
        closePeer(viewerSocketId);
      }
    };

    const onViewerWants = ({ viewerSocketId }) => {
      log('viewer wants stream:', viewerSocketId);
      if (viewerSocketId) createPeer(viewerSocketId);
    };

    const onAnswer = async ({ fromSocketId, answer }) => {
      log('received answer from', fromSocketId);
      const slot = peers.get(fromSocketId);
      if (!slot || !slot.pc) { warn('no peer for', fromSocketId); return; }
      if (slot.pc.signalingState !== 'have-local-offer') {
        warn('unexpected signalingState:', slot.pc.signalingState);
        return;
      }
      try {
        // Wrap in RTCSessionDescription — older iOS Safari versions reject
        // a plain object even though modern browsers accept it.
        await slot.pc.setRemoteDescription(new RTCSessionDescription(answer));
        slot.remoteSet = true;
        for (const cand of slot.pendingIce) {
          try { await slot.pc.addIceCandidate(new RTCIceCandidate(cand)); } catch (_) {}
        }
        slot.pendingIce.length = 0;
      } catch (e) { warn('setRemoteDescription(answer) failed:', e); }
    };

    const onIce = async ({ fromSocketId, candidate }) => {
      const slot = peers.get(fromSocketId);
      if (!slot || !slot.pc || !candidate) return;
      if (!slot.remoteSet) { slot.pendingIce.push(candidate); return; }
      try { await slot.pc.addIceCandidate(new RTCIceCandidate(candidate)); }
      catch (e) { warn('addIceCandidate failed:', e); }
    };

    const onViewerLeft = ({ viewerSocketId }) => {
      log('viewer left:', viewerSocketId);
      closePeer(viewerSocketId);
    };

    socket.on('solo_viewer_wants_stream', onViewerWants);
    socket.on('solo_answer',              onAnswer);
    socket.on('solo_ice',                 onIce);
    socket.on('solo_viewer_left',         onViewerLeft);

    return () => {
      log('broadcaster shutting down for stream', streamId);
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
