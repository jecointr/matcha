import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          const response = await authAPI.getMe();
          setUser(response.data.user);
        } catch (err) {
          // Token invalid, clear storage
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      
      setLoading(false);
    };
    
    initAuth();
  }, []);

  // Register
  const register = async (data) => {
    setError(null);
    try {
      const response = await authAPI.register(data);
      return { success: true, data: response.data };
    } catch (err) {
      const errorData = err.response?.data;
      setError(errorData?.error || 'Registration failed');
      return { success: false, errors: errorData?.errors, error: errorData?.error };
    }
  };

  // Login
  const login = async (username, password) => {
    setError(null);
    try {
      const response = await authAPI.login({ username, password });
      const { token, user: userData } = response.data;
      
      // Store token and user
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return { success: true };
    } catch (err) {
      const errorData = err.response?.data;
      setError(errorData?.error || 'Login failed');
      return { 
        success: false, 
        error: errorData?.error,
        code: errorData?.code 
      };
    }
  };

  // Logout
  const logout = useCallback(async () => {
    try {
      await authAPI.logout();
    } catch (err) {
      // Continue logout even if API call fails
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
    }
  }, []);

  // Update user data
  const updateUser = useCallback((userData) => {
    setUser(prev => ({ ...prev, ...userData }));
    localStorage.setItem('user', JSON.stringify({ ...user, ...userData }));
  }, [user]);

  // Refresh user data from server
  const refreshUser = useCallback(async () => {
    try {
      const response = await authAPI.getMe();
      setUser(response.data.user);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      return response.data.user;
    } catch (err) {
      return null;
    }
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isProfileComplete: user?.isProfileComplete || false,
    register,
    login,
    logout,
    updateUser,
    refreshUser,
    clearError: () => setError(null)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
