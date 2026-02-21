import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { chatAPI, eventAPI, profileAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { 
  Send, Loader, MessageCircle, Circle, ArrowLeft, 
  ChevronLeft, User, Check, CheckCheck, Calendar,
  MapPin, Clock, Video, Phone, Ban, Smile, Reply, X
} from 'lucide-react';
import EventModal from '../components/chat/EventModal';
import VideoCallModal from '../components/chat/VideoCallModal';
import { useCall } from '../context/CallContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Chat = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  
  const { 
    joinChat, 
    leaveChat, 
    onChatMessage, 
    onMessagesRead, 
    startTyping, 
    stopTyping, 
    onTyping, 
    clearUnreadMessages, 
    sendReadSignal,
    onReaction
  } = useSocket();  
  
  const { callUser } = useCall();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [events, setEvents] = useState([]);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [activeEmojiMenu, setActiveEmojiMenu] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  
  const isTypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  const typingTimeouts = useRef({}); 

  const handleBlockUser = async () => {
    if (!activeConversation || !window.confirm("Êtes-vous sûr de vouloir bloquer cet utilisateur ? Vous ne pourrez plus échanger.")) return;

    try {
        await profileAPI.block(activeConversation.otherUser.id);
        alert("Utilisateur bloqué.");
        setActiveConversation(null);
        loadConversations();
    } catch (err) {
        console.error("Erreur blocage:", err);
        alert("Erreur lors du blocage.");
    }
  };

  useEffect(() => {
    if (activeConversation) {
      loadEvents(activeConversation.otherUser.id);
    }
  }, [activeConversation]);

  const loadEvents = async (targetId) => {
    try {
      const res = await eventAPI.getByUser(targetId);
      setEvents(res.data.events.filter(e => e.status !== 'cancelled')); 
    } catch (err) {
      console.error('Failed to load events', err);
    }
  };

  const handleCreateEvent = async (eventData) => {
    setCreatingEvent(true);
    try {
      await eventAPI.create({
        targetId: activeConversation.otherUser.id,
        ...eventData
      });
      setShowEventModal(false);
      loadEvents(activeConversation.otherUser.id);
      
      await chatAPI.sendMessage(activeConversation.id, "📅 I just proposed a date! Check the details above.");
    } catch (err) {
      alert(err.response?.data?.errors?.date || 'Failed to create event');
    } finally {
      setCreatingEvent(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onMessagesRead((data) => {
      if (activeConversation && Number(data.conversationId) === Number(activeConversation.id)) {
        setMessages(prev => prev.map(msg => {
            if (msg.isOwn) return { ...msg, isRead: true };
            return msg;
        }));
      }
    });
    return unsubscribe;
  }, [onMessagesRead, activeConversation]);

  useEffect(() => {
  const unsubscribe = onReaction((data) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === data.messageId) {
        let newReactions = msg.reactions ? [...msg.reactions] : [];
        newReactions = newReactions.filter(r => r.userId !== data.userId);
        if (data.action !== 'removed' && data.emoji) {
          newReactions.push({ userId: data.userId, emoji: data.emoji });
        }
        return { ...msg, reactions: newReactions };
      }
      return msg;
    }));
  });
  return unsubscribe;
}, [onReaction]);

  const handleEventStatus = async (eventId, status) => {
    try {
      await eventAPI.updateStatus(eventId, status);
      loadEvents(activeConversation.otherUser.id);
      
      const msg = status === 'accepted' ? "🎉 I accepted the date!" : "❌ I declined the date.";
      await chatAPI.sendMessage(activeConversation.id, msg);
    } catch (err) {
      console.error('Update status failed', err);
    }
  };

  const handleReaction = async (messageId, emoji) => {
  setMessages(prev => prev.map(msg => {
    if (msg.id === messageId) {
      let newReactions = msg.reactions ? [...msg.reactions] : [];
      const existingIdx = newReactions.findIndex(r => r.userId === user.id);
      
      if (existingIdx > -1 && newReactions[existingIdx].emoji === emoji) {
        newReactions.splice(existingIdx, 1);
      } else {
        if (existingIdx > -1) newReactions.splice(existingIdx, 1);
        newReactions.push({ userId: user.id, emoji });
      }
      return { ...msg, reactions: newReactions };
    }
    return msg;
  }));

  try {
    await chatAPI.reactToMessage(messageId, emoji);
  } catch (err) {
    console.error("Failed to react", err);
    loadMessages(activeConversation.id);
  }
};

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    const conversationId = searchParams.get('id');
    if (conversationId && conversations.length > 0) {
      const conv = conversations.find(c => c.id === parseInt(conversationId));
      if (conv) {
        setActiveConversation(conv);
      }
    }
  }, [searchParams, conversations]);

  useEffect(() => {
    if (activeConversation) {
      joinChat(activeConversation.id);
      loadMessages(activeConversation.id);
      markAsRead(activeConversation.id);
      
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      return () => {
        leaveChat(activeConversation.id);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        Object.values(typingTimeouts.current).forEach(clearTimeout); 
      };
    }
  }, [activeConversation?.id]);

  useEffect(() => {
    const unsubscribe = onChatMessage((message) => {
      if (message.senderId === user.id) return;

      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[message.senderId];
        return next;
      });

      const msgConvId = Number(message.conversationId || message.conversation_id);
      const activeConvId = activeConversation ? Number(activeConversation.id) : null;

      if (activeConvId === msgConvId) {
        setMessages(prev => {
          if (prev.some(m => m.id === message.id)) return prev;
          return [...prev, { ...message, isOwn: false }];
        });
        scrollToBottom();
        markAsRead(activeConvId);
      }

      setConversations(prev => {
        const index = prev.findIndex(c => Number(c.id) === msgConvId);
        if (index === -1) {
          loadConversations();
          return prev;
        }

        const updatedConv = { ...prev[index] };
        const otherConvs = prev.filter(c => Number(c.id) !== msgConvId);

        updatedConv.lastMessage = message.content;
        updatedConv.lastMessageAt = message.createdAt || new Date().toISOString();

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

  useEffect(() => {
    const unsubscribe = onTyping((data) => {
      if (Number(data.conversationId) === Number(activeConversation?.id)) {
        if (data.type === 'typing:start') {
          setTypingUsers(prev => ({ ...prev, [data.userId]: true }));
          setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 50);

          if (typingTimeouts.current[data.userId]) clearTimeout(typingTimeouts.current[data.userId]);
          typingTimeouts.current[data.userId] = setTimeout(() => {
            setTypingUsers(prev => {
              const next = { ...prev };
              delete next[data.userId];
              return next;
            });
          }, 3000);

        } else {
          if (typingTimeouts.current[data.userId]) clearTimeout(typingTimeouts.current[data.userId]);
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

  useEffect(() => {
  const handleClickOutside = () => setActiveEmojiMenu(null);
  if (activeEmojiMenu) {
    window.addEventListener('click', handleClickOutside);
  }
  return () => window.removeEventListener('click', handleClickOutside);
}, [activeEmojiMenu]);

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
      
      if (activeConversation && Number(activeConversation.id) === Number(conversationId)) {
         sendReadSignal(conversationId, activeConversation.otherUser.id);
      }
      
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

    if (activeConversation) {
      stopTyping(activeConversation.id);
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }

    setSending(true);
    const content = newMessage.trim();
    const currentReply = replyingTo; 
    setNewMessage('');
    setReplyingTo(null); 
    
    const tempId = Date.now();
    
    const optimisticMessage = {
      id: tempId,
      senderId: user.id,
      content: content,
      isRead: false,
      createdAt: new Date().toISOString(),
      isOwn: true,
      status: 'sending',
      replyToId: currentReply?.id || null, 
      replyContent: currentReply?.content || null, 
      replySenderId: currentReply?.senderId || null, 
      replySenderName: currentReply ? (currentReply.isOwn ? 'Vous' : currentReply.senderName) : null
    };

    setMessages(prev => [...prev, optimisticMessage]);
    scrollToBottom();

    try {
      const response = await chatAPI.sendMessage(activeConversation.id, content, currentReply?.id);
      
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...response.data.message, status: 'sent', isOwn: true } : msg
      ));
      
      setConversations(prev => {
        const activeId = Number(activeConversation.id);
        const convIndex = prev.findIndex(c => Number(c.id) === activeId);
        
        if (convIndex === -1) return prev;

        const updatedConv = { ...prev[convIndex] };
        updatedConv.lastMessage = content;
        updatedConv.lastMessageAt = new Date().toISOString();

        const otherConvs = prev.filter(c => Number(c.id) !== activeId);
        return [updatedConv, ...otherConvs];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => prev.filter(msg => msg.id !== tempId));
      setNewMessage(content); 
      if (currentReply) setReplyingTo(currentReply); 
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    
    if (!activeConversation) return;

    if (value.trim() === '') {
      stopTyping(activeConversation.id);
      isTypingRef.current = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      return;
    }

    startTyping(activeConversation.id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConversation.id);
    }, 2000);
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
    <div className="flex h-[calc(100vh-12rem)] bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden transition-colors duration-200">
      
      {/* Conversations list */}
      <div className={`w-full md:w-80 border-r dark:border-gray-800 flex flex-col ${activeConversation ? 'hidden md:flex' : 'flex'} transition-colors duration-200`}>
        <div className="p-4 border-b dark:border-gray-800 transition-colors duration-200">
          <h2 className="text-lg font-semibold dark:text-white">Messages</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500 dark:text-gray-400">
              <MessageCircle className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600" />
              <p>No conversations yet</p>
              <p className="text-sm">Match with someone to start chatting</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors duration-200 ${
                  activeConversation?.id === conv.id ? 'bg-primary-50 dark:bg-primary-900/20' : ''
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
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center transition-colors duration-200">
                      <User className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                    </div>
                  )}
                  {conv.otherUser.isOnline && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-900 rounded-full transition-colors duration-200" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex justify-between items-center">
                    <span className="font-medium truncate dark:text-gray-100">{conv.otherUser.firstName}</span>
                    {conv.lastMessageAt && (
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate transition-colors duration-200 ${conv.unreadCount > 0 ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>
                    {conv.lastMessage || 'Start a conversation'}
                  </p>
                </div>
                
                {conv.unreadCount > 0 && (
                  <span className="bg-primary-500 text-white text-xs font-bold px-2 py-1 rounded-full min-w-5 text-center">
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
            <div className="p-4 border-b dark:border-gray-800 flex items-center gap-3 transition-colors duration-200">
              <button
                onClick={() => {
                  setActiveConversation(null);
                  setSearchParams({});
                }}
                className="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg text-gray-600 dark:text-gray-300 transition-colors duration-200"
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
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center transition-colors duration-200">
                    <User className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                  </div>
                )}
                <div>
                  <h3 className="font-medium dark:text-gray-100">{activeConversation.otherUser.firstName}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
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
              
              <button 
                onClick={() => callUser(activeConversation.otherUser.id, false)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-full transition-all duration-200"
                title="Start Audio Call"
              >
                <Phone className="w-5 h-5" />
              </button>
              <button 
                onClick={() => callUser(activeConversation.otherUser.id, true)}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-full transition-all duration-200"
                title="Start Video Call"
              >
                <Video className="w-6 h-6" />
              </button>
              
              <button 
                onClick={handleBlockUser}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all duration-200"
                title="Bloquer cet utilisateur"
              >
                <Ban className="w-5 h-5" />
              </button>
            </div>

            {/* Events Banner */}
            {events.length > 0 && (
              <div className="bg-primary-50 dark:bg-primary-900/10 border-b dark:border-gray-800 p-3 transition-colors duration-200">
                {events.map(evt => (
                  <div key={evt.id} className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border border-primary-100 dark:border-gray-700 flex justify-between items-center mb-2 last:mb-0 transition-colors duration-200">
                    <div className="flex gap-3">
                        <div className="bg-primary-100 dark:bg-primary-900/40 p-2 rounded-lg flex flex-col items-center justify-center min-w-14 text-primary-700 dark:text-primary-300">
                          <span className="text-xs font-bold uppercase">{new Date(evt.event_date).toLocaleString('default', { month: 'short' })}</span>
                          <span className="text-lg font-bold">{new Date(evt.event_date).getDate()}</span>
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                            {evt.location}
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              evt.status === 'accepted' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 
                              evt.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                            }`}>
                              {evt.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date(evt.event_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            {evt.description && <span className="text-gray-400 dark:text-gray-500 mx-1">• {evt.description}</span>}
                          </p>
                        </div>
                    </div>

                    <div className="flex gap-2">
                      {evt.status === 'pending' && evt.target_id === user.id && (
                        <>
                          <button 
                            onClick={() => handleEventStatus(evt.id, 'accepted')}
                            className="btn-primary text-xs px-3 py-1"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => handleEventStatus(evt.id, 'declined')}
                            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs px-3 py-1 transition-colors duration-200"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {evt.status === 'pending' && evt.creator_id === user.id && (
                        <button 
                            onClick={() => handleEventStatus(evt.id, 'cancelled')}
                            className="text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 text-xs px-2 transition-colors duration-200"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {hasMore && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMessages}
                  className="w-full py-2 text-sm text-primary-500 dark:text-primary-400 hover:underline"
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
                      <div className="text-center text-xs text-gray-400 dark:text-gray-500 my-4">
                        {formatDate(msg.createdAt)}
                      </div>
                    )}
                    
                    {/* --- STRUCTURE DU MESSAGE TYPE WHATSAPP --- */}
                    <div className={`flex w-full mb-4 group ${msg.isOwn ? 'justify-end' : 'justify-start'}`}>
                      
                      {/* Inner Container : items-center assure le centrage vertical du bouton emoji */}
                      <div className={`flex items-center gap-2 max-w-[85%] md:max-w-[75%] ${msg.isOwn ? 'flex-row' : 'flex-row-reverse'}`}>
                        
                        {/* BOUTON DE REPONSE */}
                        <div className={`relative shrink-0 transition-all duration-200 ${
                            replyingTo?.id === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingTo(msg);
                                }}
                                className={`p-1.5 rounded-full transition-colors ${
                                    replyingTo?.id === msg.id ? 'text-blue-500 bg-gray-100 dark:bg-gray-800' : 'text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                                title="Répondre"
                            >
                                <Reply className="w-4 h-4" />
                            </button>
                        </div>

                        {/* 1. BOUTON DE REACTION */}
                        <div className={`relative shrink-0 transition-all duration-200 ${
                            activeEmojiMenu === msg.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}>
                            <button 
                                onClick={(e) => {
                                    e.stopPropagation(); 
                                    setActiveEmojiMenu(activeEmojiMenu === msg.id ? null : msg.id);
                                }}
                                className={`p-1.5 rounded-full transition-colors ${
                                    activeEmojiMenu === msg.id ? 'text-yellow-500 bg-gray-100 dark:bg-gray-800' : 'text-gray-400 dark:text-gray-500 hover:text-yellow-500 dark:hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                                }`}
                            >
                                <Smile className="w-4 h-4" />
                            </button>
                            
                            {/* Emoji Picker */}
                            {activeEmojiMenu === msg.id && (
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-white dark:bg-gray-800 shadow-xl rounded-full px-2 py-1 flex gap-1 border border-gray-100 dark:border-gray-700 z-50 animate-in fade-in zoom-in duration-150 transition-colors" onClick={(e) => e.stopPropagation()}>
                                    {['👍', '❤️', '😂', '😮', '😢', '🔥'].map(emoji => (
                                        <button key={emoji} onClick={() => { handleReaction(msg.id, emoji); setActiveEmojiMenu(null); }} className="hover:scale-125 transition-transform p-1.5 text-xl leading-none">
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 2. BULLE DE MESSAGE */}
                        <div className="relative min-w-0 flex flex-col"> 
                          <div className={`px-3 py-1.5 rounded-2xl shadow-sm transition-colors duration-200 ${
                            msg.isOwn 
                              ? 'bg-primary-500 text-white rounded-br-none' 
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-none'
                          }`}>
                            <div className="block">
                              {msg.replyToId && (
                                <div className={`mb-1.5 p-2 rounded-lg text-xs border-l-4 transition-colors duration-200 ${
                                  msg.isOwn ? 'bg-primary-600 border-primary-300' : 'bg-gray-200 dark:bg-gray-700 border-gray-400 dark:border-gray-500'
                                }`}>
                                  <span className={`font-bold block mb-0.5 ${msg.isOwn ? 'text-white' : 'text-gray-700 dark:text-gray-300'}`}>
                                    {msg.replySenderId === user.id ? 'Vous' : (msg.replySenderName || 'Utilisateur')}
                                  </span>
                                  <p className={`line-clamp-2 max-h-10 overflow-hidden max-w-50 sm:max-w-62.5 ${msg.isOwn ? 'text-primary-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {msg.replyContent}
                                  </p>
                                </div>
                              )}
                              <span className="text-[15px] leading-relaxed whitespace-pre-wrap break-all md:wrap-break-word">
                                {msg.content}
                              </span>

                              <span className={`inline-flex items-baseline gap-1 text-[11px] select-none ml-2 float-right translate-y-2 ${
                                msg.isOwn ? 'text-primary-100' : 'text-gray-400 dark:text-gray-500'
                              }`}>
                                <span>{formatTime(msg.createdAt)}</span>
                                {msg.isOwn && (
                                  <span className="flex self-center">
                                    <CheckCheck className={`w-4 h-4 ${
                                      msg.isRead 
                                        ? 'text-blue-300 drop-shadow-[0_0_3px_rgba(0,242,255,0.5)]' 
                                        : 'opacity-70'
                                    }`} />
                                  </span>
                                )}
                              </span>
                              <div className="clear-both"></div>
                            </div>
                          </div>

                          {/* Réactions */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className={`absolute -bottom-3.5 ${msg.isOwn ? 'right-2' : 'left-2'} z-20`}>
                              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-md rounded-full px-1.5 py-0.5 flex items-center gap-0.5 text-xs transition-all duration-300 ease-out animate-in zoom-in-50 cursor-default">
                                {msg.reactions.slice(0, 3).map((r, i) => (
                                  <span key={i}>{r.emoji}</span>
                                ))}
                                {msg.reactions.length > 1 && <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 ml-0.5">{msg.reactions.length}</span>}
                              </div>
                            </div>
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
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl rounded-bl-md transition-colors duration-200">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* PREVIEW DE REPONSE */}
            {replyingTo && (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t dark:border-gray-800 flex items-start justify-between animate-in slide-in-from-bottom-2 duration-200 max-h-24 overflow-hidden transition-colors">
                <div className="flex-1 min-w-0 border-l-4 border-primary-500 pl-3">
                  <span className="text-xs font-bold text-primary-600 dark:text-primary-400 flex items-center gap-1 mb-1">
                    <Reply className="w-3 h-3" /> Répondre à {replyingTo.isOwn ? 'vous-même' : replyingTo.senderName || 'l\'utilisateur'}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 overflow-hidden">{replyingTo.content}</p>
                </div>
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="p-1.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full ml-2 transition-colors shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {/* Message input */}
            <form onSubmit={handleSend} className="p-4 border-t dark:border-gray-800 flex gap-2 items-center transition-colors duration-200">
              <button
                type="button"
                onClick={() => setShowEventModal(true)}
                className="p-3 text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-full transition-colors"
                title="Schedule a date"
              >
                <Calendar className="w-5 h-5" />
              </button>
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
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 transition-colors duration-200">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600 transition-colors duration-200" />
              <p>Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>
      <EventModal 
        isOpen={showEventModal} 
        onClose={() => setShowEventModal(false)}
        onSubmit={handleCreateEvent}
        loading={creatingEvent}
      />
      <VideoCallModal />
    </div>
  );
};

export default Chat;