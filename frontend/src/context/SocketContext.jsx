import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { chatAPI, notificationAPI } from '../services/api';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    return {
      socket: null,
      connected: false,
      unreadMessages: 0,
      unreadNotifications: 0,
      notifications: [],
      setUnreadMessages: () => {},
      setUnreadNotifications: () => {},
      joinChat: () => {},
      leaveChat: () => {},
      startTyping: () => {},
      stopTyping: () => {},
      onChatMessage: () => () => {},
      onTyping: () => () => {},
      clearUnreadMessages: () => {},
      clearUnreadNotifications: () => {},
      clearNotification: () => {},
      onTyping: () => () => {},
      sendReadSignal: () => {}, 
      onMessagesRead: () => () => {},
    };
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState([]);

  // 1. Charger les compteurs initiaux
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadCounts = async () => {
      try {
        const [chatRes, notifRes] = await Promise.all([
          chatAPI.getUnreadCount(),
          notificationAPI.getUnreadCount()
        ]);
        setUnreadMessages(chatRes.data.count);
        setUnreadNotifications(notifRes.data.count);
      } catch (err) {
        console.error('Failed to load unread counts:', err);
      }
    };

    loadCounts();
  }, [isAuthenticated]);

  // 2. Connexion Socket
  useEffect(() => {
    if (!isAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';
    
    const newSocket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    // Gestion centralisée des notifications
    newSocket.on('notification', (notification) => {
      console.log('Received notification:', notification);
      
      // CORRECTION : Séparation stricte des flux
      if (notification.type === 'message') {
        // Si c'est un message : on incrémente UNIQUEMENT le compteur messages
        // Et on ne l'ajoute PAS à la liste des notifications générales
        setUnreadMessages(prev => prev + 1);
      } else {
        // Si c'est autre chose (Like, Visit, Match)
        // On l'ajoute à la liste ET au compteur notifs
        setNotifications(prev => [notification, ...prev]);
        setUnreadNotifications(prev => prev + 1);
      }
    });

    newSocket.on('chat:message', (message) => {
      console.log('Global message received:', message);
      // On n'incrémente pas si c'est nous qui avons envoyé le message
      // (Note: on ne vérifie pas l'ID ici car on n'a pas accès à 'user' facilement dans le useEffect sans dépendance,
      // mais le backend n'envoie 'chat:message' dans la room 'user:X' QUE au destinataire, donc c'est safe).
      setUnreadMessages(prev => prev + 1);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  // --- ACTIONS ---

  const joinChat = useCallback((conversationId) => {
    if (socket && connected) {
      socket.emit('join:chat', conversationId);
    }
  }, [socket, connected]);

  const leaveChat = useCallback((conversationId) => {
    if (socket && connected) {
      socket.emit('leave:chat', conversationId);
    }
  }, [socket, connected]);

  const startTyping = useCallback((conversationId) => {
    if (socket && connected) {
      socket.emit('typing:start', { conversationId });
    }
  }, [socket, connected]);

  const stopTyping = useCallback((conversationId) => {
    if (socket && connected) {
      socket.emit('typing:stop', { conversationId });
    }
  }, [socket, connected]);

  const sendReadSignal = useCallback((conversationId, senderId) => {
    if (socket && connected) {
      socket.emit('chat:read', { conversationId, senderId });
    }
  }, [socket, connected]);

  // --- LISTENERS ---

  const onChatMessage = useCallback((callback) => {
    if (socket) {
      socket.on('chat:message', callback);
      return () => socket.off('chat:message', callback);
    }
    return () => {};
  }, [socket]);

  const onTyping = useCallback((callback) => {
    if (!socket) return () => {};

    const handleStart = (data) => {
      callback({ ...data, type: 'typing:start' });
    };

    const handleStop = (data) => {
      callback({ ...data, type: 'typing:stop' });
    };

    socket.on('typing:start', handleStart);
    socket.on('typing:stop', handleStop);

    return () => {
      socket.off('typing:start', handleStart);
      socket.off('typing:stop', handleStop);
    };
  }, [socket]);

  // --- STATE MANAGEMENT ---

  const clearUnreadMessages = useCallback(() => {
    setUnreadMessages(0);
  }, []);

  const clearUnreadNotifications = useCallback(() => {
    setUnreadNotifications(0);
  }, []);

  const clearNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

  const onMessagesRead = useCallback((callback) => {
    if (socket) {
      socket.on('chat:read', callback);
      return () => socket.off('chat:read', callback);
    }
    return () => {};
  }, [socket]);

  const value = {
    socket,
    connected,
    unreadMessages,
    unreadNotifications,
    notifications,
    setUnreadMessages,
    setUnreadNotifications,
    joinChat,
    leaveChat,
    startTyping,
    stopTyping,
    onChatMessage,
    onTyping,
    clearUnreadMessages,
    clearUnreadNotifications,
    clearNotification,
    onTyping,
    sendReadSignal,
    onMessagesRead: useCallback((callback) => {
      if (socket) {
        socket.on('chat:read', callback);
        return () => socket.off('chat:read', callback);
      }
      return () => {};
    }, [socket]),
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;