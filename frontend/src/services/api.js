import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - add auth token
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

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
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

// User endpoints (for later phases)
export const userAPI = {
  updateProfile: (data) => api.put('/users/profile', data),
  uploadPhoto: (formData) => api.post('/users/photos', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  deletePhoto: (photoId) => api.delete(`/users/photos/${photoId}`),
  setProfilePicture: (photoId) => api.put(`/users/photos/${photoId}/profile`),
  updateLocation: (data) => api.put('/users/location', data)
};

// Profile endpoints (for later phases)
export const profileAPI = {
  getBrowse: (params) => api.get('/profiles/browse', { params }),
  search: (params) => api.get('/profiles/search', { params }),
  getProfile: (userId) => api.get(`/profiles/${userId}`),
  like: (userId) => api.post(`/profiles/${userId}/like`),
  unlike: (userId) => api.delete(`/profiles/${userId}/like`),
  block: (userId) => api.post(`/profiles/${userId}/block`),
  unblock: (userId) => api.delete(`/profiles/${userId}/block`),
  report: (userId, reason) => api.post(`/profiles/${userId}/report`, { reason })
};

// Match endpoints (for later phases)
export const matchAPI = {
  getMatches: () => api.get('/matches'),
  getLikes: () => api.get('/matches/likes'),
  getVisits: () => api.get('/matches/visits')
};

// Chat endpoints (for later phases)
export const chatAPI = {
  getConversations: () => api.get('/chat/conversations'),
  getMessages: (conversationId, params) => api.get(`/chat/${conversationId}/messages`, { params }),
  sendMessage: (conversationId, content) => api.post(`/chat/${conversationId}/messages`, { content })
};

// Notification endpoints (for later phases)
export const notificationAPI = {
  getNotifications: (params) => api.get('/notifications', { params }),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/read-all')
};

// Tags endpoint
export const tagsAPI = {
  getAll: () => api.get('/tags'),
  search: (query) => api.get('/tags/search', { params: { q: query } })
};

export default api;
