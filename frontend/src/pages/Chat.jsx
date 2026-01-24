import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { chatAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { 
  Send, Loader, MessageCircle, Circle, ArrowLeft, 
  ChevronLeft, User, Check, CheckCheck
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Chat = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { joinChat, leaveChat, onChatMessage, startTyping, stopTyping, onTyping, clearUnreadMessages } = useSocket();
  
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [hasMore, setHasMore] = useState(false);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Load conversations
  useEffect(() => {
    loadConversations();
  }, []);

  // Handle URL param for direct conversation
  useEffect(() => {
    const conversationId = searchParams.get('id');
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === parseInt(conversationId));
      if (conv) {
        setActiveConversation(conv);
      }
    }
  }, [searchParams, conversations]);

  // Join/leave chat room
  useEffect(() => {
    if (activeConversation) {
      joinChat(activeConversation.id);
      loadMessages(activeConversation.id);
      markAsRead(activeConversation.id);
      
      return () => {
        leaveChat(activeConversation.id);
      };
    }
  }, [activeConversation?.id]);

  // -----------------------------------------------------------------------
  // LE CŒUR DU PROBLÈME : Listen for new messages
  // -----------------------------------------------------------------------
  // Listen for new messages
  useEffect(() => {
    const unsubscribe = onChatMessage((message) => {
      console.log("📩 Socket Message reçu sur Chat.jsx:", message);

      if (message.senderId === user.id) return;

      // Stop typing
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[message.senderId];
        return next;
      });

      const msgConvId = Number(message.conversationId || message.conversation_id);
      const activeConvId = activeConversation ? Number(activeConversation.id) : null;

      // 1. Si on est SUR la conversation active : Ajouter le message + Scroll
      if (activeConvId === msgConvId) {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, { ...message, isOwn: false }];
        });
        scrollToBottom();
        markAsRead(activeConvId);
      }

      // 2. Mise à jour de la Sidebar (Pour TOUTES les conversations)
      setConversations(prev => {
        const index = prev.findIndex(c => Number(c.id) === msgConvId);

        // Si nouvelle conversation (inconnue), on recharge tout par sécurité
        if (index === -1) {
          loadConversations();
          return prev;
        }

        // On sort la conversation, on la met à jour, on la place en haut
        const updatedConv = { ...prev[index] };
        const otherConvs = prev.filter(c => Number(c.id) !== msgConvId);

        updatedConv.lastMessage = message.content;
        updatedConv.lastMessageAt = message.createdAt || new Date().toISOString();

        // Calcul Pastille Sidebar :
        // Si on est DÉJÀ sur cette conversation, pastille = 0.
        // Sinon, on incrémente (ou on met 1 si c'était 0).
        if (activeConvId === msgConvId) {
            updatedConv.unreadCount = 0;
        } else {
            updatedConv.unreadCount = (updatedConv.unreadCount || 0) + 1;
        }

        return [updatedConv, ...otherConvs];
      });
    });

    return unsubscribe;
  }, [onChatMessage, activeConversation, user.id]);

  // Listen for typing indicators
  useEffect(() => {
    const unsubscribe = onTyping((data) => {
      if (data.conversationId === activeConversation?.id) {
        if (data.type === 'typing:start') {
          setTypingUsers(prev => ({ ...prev, [data.userId]: true }));
        } else {
          setTypingUsers(prev => {
            const next = { ...prev };
            delete next[data.userId];
            return next;
          });
        }
      }
    });

    return unsubscribe;
  }, [onTyping, activeConversation]);

  const loadConversations = async () => {
    try {
      const response = await chatAPI.getConversations();
      setConversations(response.data.conversations);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId, before = null) => {
    setLoadingMessages(true);
    try {
      const params = before ? { before, limit: 50 } : { limit: 50 };
      const response = await chatAPI.getMessages(conversationId, params);
      
      if (before) {
        setMessages(prev => [...response.data.messages, ...prev]);
      } else {
        setMessages(response.data.messages);
        scrollToBottom();
      }
      setHasMore(response.data.hasMore);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const markAsRead = async (conversationId) => {
    try {
      await chatAPI.markAsRead(conversationId);
      // Mise à jour locale pour retirer la pastille immédiatement
      setConversations(prev => prev.map(c => 
        c.id === conversationId ? { ...c, unreadCount: 0 } : c
      ));
      clearUnreadMessages();
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !activeConversation) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const response = await chatAPI.sendMessage(activeConversation.id, content);
      
      // Ajout message local immédiat
      setMessages(prev => [...prev, response.data.message]);
      scrollToBottom();
      
      // Mise à jour Sidebar (WhatsApp effect) pour l'envoi aussi
      setConversations(prev => {
        const activeId = Number(activeConversation.id);
        const convIndex = prev.findIndex(c => Number(c.id) === activeId);
        
        if (convIndex === -1) return prev;

        const updatedConv = { ...prev[convIndex] };
        
        updatedConv.lastMessage = content;
        updatedConv.lastMessageAt = new Date().toISOString();
        // Pas de changement de unreadCount car c'est nous qui écrivons

        const otherConvs = prev.filter(c => Number(c.id) !== activeId);
        return [updatedConv, ...otherConvs];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setNewMessage(content); 
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (activeConversation) {
      startTyping(activeConversation.id);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      typingTimeoutRef.current = setTimeout(() => {
        stopTyping(activeConversation.id);
      }, 2000);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleLoadMore = () => {
    if (messages.length > 0 && hasMore && !loadingMessages) {
      loadMessages(activeConversation.id, messages[0].createdAt);
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date) => {
    const d = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  const getPhotoUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
  };

  const selectConversation = (conv) => {
    setActiveConversation(conv);
    setSearchParams({ id: conv.id });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] bg-white rounded-lg border overflow-hidden">
      {/* Conversations list */}
      <div className={`w-full md:w-80 border-r flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'}`}>
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">Messages</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No conversations yet</p>
              <p className="text-sm">Match with someone to start chatting</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                  activeConversation?.id === conv.id ? 'bg-primary-50' : ''
                }`}
              >
                <div className="relative">
                  {conv.otherUser.profilePicture ? (
                    <img
                      src={getPhotoUrl(conv.otherUser.profilePicture)}
                      alt={conv.otherUser.firstName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <User className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  {conv.otherUser.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate">{conv.otherUser.firstName}</span>
                    {conv.lastMessageAt && (
                      <span className="text-xs text-gray-400">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>
                    {conv.lastMessage || 'Start a conversation'}
                  </p>
                </div>
                
                {conv.unreadCount > 0 && (
                  <span className="bg-primary-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-[1.25rem] text-center">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className={`flex-1 flex flex-col ${activeConversation ? 'flex' : 'hidden md:flex'}`}>
        {activeConversation ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveConversation(null);
                  setSearchParams({});
                }}
                className="md:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <Link to={`/profile/${activeConversation.otherUser.id}`} className="flex items-center gap-3 flex-1">
                {activeConversation.otherUser.profilePicture ? (
                  <img
                    src={getPhotoUrl(activeConversation.otherUser.profilePicture)}
                    alt={activeConversation.otherUser.firstName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div>
                  <h3 className="font-medium">{activeConversation.otherUser.firstName}</h3>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    {activeConversation.otherUser.isOnline ? (
                      <>
                        <Circle className="w-2 h-2 fill-green-500 text-green-500" />
                        Online
                      </>
                    ) : (
                      'Offline'
                    )}
                  </p>
                </div>
              </Link>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMessages}
                  className="w-full py-2 text-sm text-primary-500 hover:underline"
                >
                  {loadingMessages ? 'Loading...' : 'Load earlier messages'}
                </button>
              )}
              
              {messages.map((msg, index) => {
                const showDate = index === 0 || 
                  formatDate(msg.createdAt) !== formatDate(messages[index - 1].createdAt);
                
                return (
                  <div key={msg.id}>
                    {showDate && (
                      <div className="text-center text-xs text-gray-400 my-4">
                        {formatDate(msg.createdAt)}
                      </div>
                    )}
                    <div className={`flex ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${msg.isOwn ? 'order-2' : ''}`}>
                        <div className={`px-4 py-2 rounded-2xl ${
                          msg.isOwn 
                            ? 'bg-primary-500 text-white rounded-br-md' 
                            : 'bg-gray-100 text-gray-900 rounded-bl-md'
                        }`}>
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                        <div className={`flex items-center gap-1 mt-1 text-xs text-gray-400 ${
                          msg.isOwn ? 'justify-end' : ''
                        }`}>
                          <span>{formatTime(msg.createdAt)}</span>
                          {msg.isOwn && (
                            msg.isRead 
                              ? <CheckCheck className="w-3 h-3 text-blue-500" />
                              : <Check className="w-3 h-3" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Typing indicator */}
              {Object.keys(typingUsers).length > 0 && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-bl-md">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="flex-1 input py-3"
                maxLength={1000}
              />
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="btn-primary px-4"
              >
                {sending ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat;