import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { chatAPI, notificationAPI } from '../services/api';
import { WS_URL } from '../config';

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
      onMessageEdited: () => () => {},
      onTyping: () => () => {},
      onUnmatch: () => () => {},
      clearUnreadMessages: () => {},
      clearUnreadNotifications: () => {},
      clearNotification: () => {},
      sendReadSignal: () => {}, 
      onMessagesRead: () => () => {},
    };
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [notifications, setNotifications] = useState([]);
  
  const userIdRef = useRef(null);

  useEffect(() => {
    if (user) {
        userIdRef.current = user.id;
    }
  }, [user]);

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

    const newSocket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    newSocket.on('connect', () => {
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      setConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
    });

    newSocket.on('notification', (notification) => {
      // Skip the +1 if the user is already viewing this conversation
      const url = new URL(window.location.href);
      const isChat = url.pathname === '/chat';
      const activeChatId = url.searchParams.get('id');

      if (notification.type === 'message') {
        // Already on this chat conversation → ignore the unread notification (+1)
        if (
          isChat &&
          Number(activeChatId) === Number(notification.data?.conversationId)
        ) {
          return;
        }
        setUnreadNotifications((prev) => prev + 1);
      } else {
        setNotifications(prev => {
            if (prev.some(n => n.id === notification.id)) return prev;
            return [notification, ...prev];
        });
        setUnreadNotifications(prev => prev + 1);
      }
    });

    newSocket.on('chat:message', (message) => {
      if (userIdRef.current && Number(message.senderId) === Number(userIdRef.current)) {
        return;
      }

      // Same check for the global unread-message counter
      const url = new URL(window.location.href);
      const isChat = url.pathname === '/chat';
      const activeChatId = url.searchParams.get('id');
      
      if (isChat && Number(activeChatId) === Number(message.conversationId || message.conversation_id)) {
        return; 
      }

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

  const startTyping = useCallback((conversationId, toUserId) => {
    if (socket && connected) {
      socket.emit('typing:start', { conversationId, toUserId });
    }
  }, [socket, connected]);

  const stopTyping = useCallback((conversationId, toUserId) => {
    if (socket && connected) {
      socket.emit('typing:stop', { conversationId, toUserId });
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

  const onMessageEdited = useCallback((callback) => {
    if (socket) {
      socket.on('chat:message:edited', callback);
      return () => socket.off('chat:message:edited', callback);
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
    onMessageEdited,
    onTyping,
    clearUnreadMessages,
    clearUnreadNotifications,
    clearNotification,
    sendReadSignal,
    onMessagesRead: useCallback((callback) => {
      if (socket) {
        socket.on('chat:read', callback);
        return () => socket.off('chat:read', callback);
      }
      return () => {};
    }, [socket]),
    onReaction: useCallback((callback) => {
      if (socket) {
        socket.on('chat:reaction', callback);
        return () => socket.off('chat:reaction', callback);
      }
      return () => {};
    }, [socket]),
    // Live unmatch: the chat with the given user just became read-only.
    onUnmatch: useCallback((callback) => {
      if (socket) {
        socket.on('chat:unmatched', callback);
        return () => socket.off('chat:unmatched', callback);
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