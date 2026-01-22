import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { chatAPI, notificationAPI } from '../services/api';

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  // Return empty context if not within provider (for Header when not authenticated)
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
      clearNotification: () => {}
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

  // Load initial unread counts
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

  // Connect to socket when authenticated
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

    const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';
    
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

    // Handle incoming notifications
    newSocket.on('notification', (notification) => {
      console.log('Received notification:', notification);
      setNotifications(prev => [notification, ...prev]);
      setUnreadNotifications(prev => prev + 1);
      
      // If it's a message notification, also increment unread messages
      if (notification.type === 'message') {
        setUnreadMessages(prev => prev + 1);
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAuthenticated]);

  // Join a chat room
  const joinChat = useCallback((conversationId) => {
    if (socket && connected) {
      socket.emit('join:chat', conversationId);
    }
  }, [socket, connected]);

  // Leave a chat room
  const leaveChat = useCallback((conversationId) => {
    if (socket && connected) {
      socket.emit('leave:chat', conversationId);
    }
  }, [socket, connected]);

  // Send typing indicator
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

  // Listen for chat messages
  const onChatMessage = useCallback((callback) => {
    if (socket) {
      socket.on('chat:message', callback);
      return () => socket.off('chat:message', callback);
    }
    return () => {};
  }, [socket]);

  // Listen for typing indicators
  const onTyping = useCallback((callback) => {
    if (socket) {
      socket.on('typing:start', callback);
      socket.on('typing:stop', callback);
      return () => {
        socket.off('typing:start', callback);
        socket.off('typing:stop', callback);
      };
    }
    return () => {};
  }, [socket]);

  // Clear unread counts
  const clearUnreadMessages = useCallback(() => {
    setUnreadMessages(0);
  }, []);

  const clearUnreadNotifications = useCallback(() => {
    setUnreadNotifications(0);
  }, []);

  const clearNotification = useCallback((notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  }, []);

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
    clearNotification
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;