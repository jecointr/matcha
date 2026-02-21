import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  verifyEmail: (token) => api.get(`/auth/verify-email?token=${token}`),
  resendVerification: (email) => api.post('/auth/resend-verification', { email }),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  getMe: () => api.get('/auth/me')
};

export const userAPI = {
  updateProfile: (data) => api.put('/users/profile', data),
  uploadPhoto: (formData) => api.post('/users/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deletePhoto: (photoId) => api.delete(`/users/photos/${photoId}`),
  setProfilePicture: (photoId) => api.put(`/users/photos/${photoId}/profile`),
  updateLocation: (data) => api.put('/users/location', data),
  getTags: () => api.get('/users/tags'),
  updateTags: (tagIds) => api.put('/users/tags', { tagIds }),
  createTag: (name) => api.post('/users/tags', { name }),
  deleteAccount: () => api.delete('/users/me')
};

export const profileAPI = {
  getBrowse: (params) => api.get('/profiles/browse', { params }),
  search: (params) => api.get('/profiles/search', { params }),
  getMapUsers: () => api.get('/profiles/map'),
  getProfile: (userId) => api.get(`/profiles/${userId}`),
  like: (userId) => api.post(`/profiles/${userId}/like`),
  unlike: (userId) => api.delete(`/profiles/${userId}/like`),
  block: (userId) => api.post(`/users/${userId}/block`),
  unblock: (userId) => api.delete(`/users/${userId}/block`),
  report: (userId, reason) => api.post(`/profiles/${userId}/report`, { reason })
};

export const matchAPI = {
  getMatches: () => api.get('/matches'),
  getLikes: () => api.get('/matches/likes'),
  getMyLikes: () => api.get('/matches/my-likes'),
  getVisits: () => api.get('/matches/visits')
};

export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  getConversation: (otherUserId) => api.get(`/chat/conversations/${otherUserId}`),
  getMessages: (conversationId, params) => api.get(`/chat/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, content, replyToId = null) => api.post(`/chat/${conversationId}/messages`, { content, replyToId }),
  markAsRead: (conversationId) => api.put(`/chat/${conversationId}/read`),
  getUnreadCount: () => api.get('/chat/unread-count'),
  reactToMessage: (messageId, emoji) => api.post(`/chat/messages/${messageId}/react`, { emoji }),
};

export const notificationAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count'),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (notificationId) => api.delete(`/notifications/${notificationId}`)
};

export const tagsAPI = {
  getAll: () => api.get('/tags'),
  search: (query) => api.get('/tags/search', { params: { q: query } })
};

export const eventAPI = {
  create: (data) => api.post('/events', data),
  getByUser: (targetId) => api.get(`/events/${targetId}`),
  updateStatus: (eventId, status) => api.put(`/events/${eventId}/status`, { status })
};

export default api;