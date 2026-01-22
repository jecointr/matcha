import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader } from 'lucide-react';

/**
 * Route that requires authentication
 */
export const PrivateRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login but save the attempted URL
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

/**
 * Route that requires complete profile
 */
export const CompleteProfileRoute = ({ children }) => {
  const { isAuthenticated, isProfileComplete, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isProfileComplete) {
    return <Navigate to="/complete-profile" replace />;
  }

  return children;
};

/**
 * Route only for guests (login, register)
 */
export const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/browse" replace />;
  }

  return children;
};
