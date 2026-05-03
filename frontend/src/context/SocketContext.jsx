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
    socketRef.current = io(BACKEND_URL, { autoConnect: true, transports: ['websocket', 'polling'] });

    socketRef.current.on('connect', () => {
      setConnected(true);
      if (user) {
        const token = localStorage.getItem('lyvstreem_token');
        socketRef.current.emit('authenticate', { token });
      }
    });

    socketRef.current.on('disconnect', () => setConnected(false));

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
