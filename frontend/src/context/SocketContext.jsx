import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

const BACKEND_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    socketRef.current = io(BACKEND_URL, {
      autoConnect: true,
      // Try websocket first, fall back to polling. Polling is essential when
      // a free-tier service is cold-starting and the websocket upgrade hasn't
      // come up yet — without it the socket stays disconnected.
      transports: ['websocket', 'polling'],
      // Keep retrying forever; backoff up to 10 s. Cold-start can take 60 s,
      // and the user may load the app before the server is ready.
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      // Long-poll cycles can block under cold starts; allow a generous window
      // before declaring the connection lost.
      timeout: 30000,
    });

    socketRef.current.on('connect', () => {
      setConnected(true);
      if (user) {
        const token = localStorage.getItem('lyvstreem_token');
        socketRef.current.emit('authenticate', { token });
      }
    });

    socketRef.current.on('disconnect', () => setConnected(false));

    // Re-authenticate on every reconnect so userSockets stays in sync after
    // the server comes back from sleep.
    socketRef.current.on('reconnect', () => {
      const token = localStorage.getItem('lyvstreem_token');
      if (token) socketRef.current.emit('authenticate', { token });
    });

    return () => { socketRef.current?.disconnect(); };
  }, []);

  useEffect(() => {
    if (connected && user) {
      const token = localStorage.getItem('lyvstreem_token');
      socketRef.current?.emit('authenticate', { token });
    }
  }, [connected, user]);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);
