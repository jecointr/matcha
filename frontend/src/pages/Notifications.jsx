import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { notificationAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { 
  Bell, Heart, Eye, MessageCircle, UserCheck, UserMinus,
  Loader, Trash2
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const Notifications = () => {
  const { socket, clearUnreadNotifications } = useSocket();
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initNotifications = async () => {
      try {
        const response = await notificationAPI.getNotifications({ limit: 50 });
        
        const filteredNotifs = response.data.notifications.filter(n => n.type !== 'message');
        setNotifications(filteredNotifs);

        clearUnreadNotifications();

        if (response.data.unreadCount > 0) {
          notificationAPI.markAllAsRead()
            .catch(err => console.error('Background auto-read failed:', err));
        }

      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    };

    initNotifications();
  }, []); 

  useEffect(() => {
    if (!socket) return;

    const handleNewNotification = (newNotification) => {
      if (newNotification.type === 'message') return;

      setNotifications(prev => [newNotification, ...prev]);
    };

    socket.on('notification', handleNewNotification);

    return () => {
      socket.off('notification', handleNewNotification);
    };
  }, [socket]);

  const handleDelete = async (notificationId) => {
    try {
      await notificationAPI.delete(notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'like':
        return <Heart className="w-5 h-5 text-red-500" fill="currentColor" />;
      case 'unlike':
        return <UserMinus className="w-5 h-5 text-gray-500" />;
      case 'match':
        return <UserCheck className="w-5 h-5 text-green-500" />;
      case 'profile_view':
        return <Eye className="w-5 h-5 text-blue-500" />;
      case 'message':
        return <MessageCircle className="w-5 h-5 text-primary-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getNotificationLink = (notification) => {
    switch (notification.type) {
      case 'like':
      case 'unlike':
      case 'match':
      case 'profile_view':
        return notification.fromUser ? `/profile/${notification.fromUser.id}` : null;
      case 'message':
        return notification.data?.conversationId ? `/chat?id=${notification.data.conversationId}` : '/chat';
      default:
        return null;
    }
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getPhotoUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_URL.replace('/api', '')}${url}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        </div>
      </div>

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <div className="text-center py-20">
          <Bell className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No notifications</h3>
          <p className="text-gray-500">
            When someone interacts with you, you'll see it here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => {
            const link = getNotificationLink(notification);
            
            const Content = (
              <div className={`p-4 rounded-lg flex items-start gap-4 transition-colors ${
                notification.isRead ? 'bg-white' : 'bg-primary-50'
              } ${link ? 'hover:bg-gray-50 cursor-pointer' : ''}`}>
                
                {/* Icon or user photo */}
                <div className="shrink-0">
                  {notification.fromUser?.profilePicture ? (
                    <div className="relative">
                      <img
                        src={getPhotoUrl(notification.fromUser.profilePicture)}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      {getNotificationIcon(notification.type)}
                    </div>
                  )}
                </div>

                {/* Content Text */}
                <div className="flex-1 min-w-0">
                  <p className={`${notification.isRead ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>
                    {notification.message}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {formatTime(notification.createdAt)}
                  </p>
                </div>

                {/* Actions (Delete only) */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDelete(notification.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded-full transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );

            return link ? (
              <Link key={notification.id} to={link}>
                {Content}
              </Link>
            ) : (
              <div key={notification.id}>{Content}</div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;