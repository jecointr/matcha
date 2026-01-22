import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Heart, Bell, MessageCircle, User, LogOut, Menu, X, Compass } from 'lucide-react';

// Context
import { AuthProvider, useAuth } from './context/AuthContext';

// Route guards
import { PrivateRoute, GuestRoute, CompleteProfileRoute } from './components/PrivateRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ResendVerification from './pages/ResendVerification';
import CompleteProfile from './pages/CompleteProfile';
import Profile from './pages/Profile';

// Placeholder pages (to be implemented in later phases)
const Home = () => (
  <div className="text-center py-20">
    <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Matcha</h1>
    <p className="text-xl text-gray-600 mb-8">Find your perfect match</p>
    <div className="space-x-4">
      <Link to="/login" className="btn-primary">Login</Link>
      <Link to="/register" className="btn-outline">Register</Link>
    </div>
  </div>
);

const Browse = () => (
  <div className="card">
    <h2 className="text-2xl font-bold mb-4">Browse Profiles</h2>
    <p className="text-gray-500">Coming in Phase 4</p>
  </div>
);

const Chat = () => (
  <div className="card">
    <h2 className="text-2xl font-bold mb-4">Messages</h2>
    <p className="text-gray-500">Coming in Phase 6</p>
  </div>
);

const Notifications = () => (
  <div className="card">
    <h2 className="text-2xl font-bold mb-4">Notifications</h2>
    <p className="text-gray-500">Coming in Phase 6</p>
  </div>
);

const NotFound = () => (
  <div className="text-center py-20">
    <h1 className="text-6xl font-bold text-gray-300">404</h1>
    <p className="text-xl text-gray-500 mt-4">Page not found</p>
    <Link to="/" className="btn-primary mt-6 inline-block">Go Home</Link>
  </div>
);

// Header component with auth
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={isAuthenticated ? '/browse' : '/'} className="flex items-center space-x-2">
            <Heart className="h-8 w-8 text-primary-500" fill="currentColor" />
            <span className="text-xl font-bold text-gray-900">Matcha</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            {isAuthenticated ? (
              <>
                <Link to="/browse" className="flex items-center text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100">
                  <Compass className="h-5 w-5 mr-1" />
                  Browse
                </Link>
                <Link to="/chat" className="relative text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100">
                  <MessageCircle className="h-6 w-6" />
                  {/* Notification badge - will be dynamic later */}
                </Link>
                <Link to="/notifications" className="relative text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100">
                  <Bell className="h-6 w-6" />
                </Link>
                <Link to="/profile" className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100">
                  <User className="h-6 w-6" />
                </Link>
                <div className="w-px h-6 bg-gray-200 mx-2" />
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100"
                  title="Logout"
                >
                  <LogOut className="h-6 w-6" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900 px-4 py-2">
                  Login
                </Link>
                <Link to="/register" className="btn-primary">
                  Register
                </Link>
              </>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-4 border-t">
            <div className="flex flex-col space-y-1">
              {isAuthenticated ? (
                <>
                  <Link to="/browse" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center">
                    <Compass className="h-5 w-5 mr-2" /> Browse
                  </Link>
                  <Link to="/chat" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center">
                    <MessageCircle className="h-5 w-5 mr-2" /> Messages
                  </Link>
                  <Link to="/notifications" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center">
                    <Bell className="h-5 w-5 mr-2" /> Notifications
                  </Link>
                  <Link to="/profile" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center">
                    <User className="h-5 w-5 mr-2" /> Profile
                  </Link>
                  <hr className="my-2" />
                  <button
                    onClick={handleLogout}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center w-full text-left"
                  >
                    <LogOut className="h-5 w-5 mr-2" /> Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                    Login
                  </Link>
                  <Link to="/register" className="px-3 py-2 text-primary-500 hover:bg-primary-50 rounded-lg font-medium">
                    Register
                  </Link>
                </>
              )}
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

// Footer component
const Footer = () => (
  <footer className="bg-white border-t mt-auto">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center space-x-2 mb-4 md:mb-0">
          <Heart className="h-6 w-6 text-primary-500" fill="currentColor" />
          <span className="font-semibold text-gray-900">Matcha</span>
        </div>
        <div className="flex space-x-6 text-sm text-gray-500">
          <a href="#" className="hover:text-gray-900">About</a>
          <a href="#" className="hover:text-gray-900">Privacy</a>
          <a href="#" className="hover:text-gray-900">Terms</a>
          <a href="#" className="hover:text-gray-900">Contact</a>
        </div>
        <p className="text-sm text-gray-500 mt-4 md:mt-0">
          © {new Date().getFullYear()} Matcha. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

// Main layout
const Layout = ({ children }) => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </div>
    </main>
    <Footer />
  </div>
);

// App with routes
const AppRoutes = () => {
  return (
    <Layout>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />

        {/* Guest only routes */}
        <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
        <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
        <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />

        {/* Email verification (accessible to all) */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/resend-verification" element={<ResendVerification />} />

        {/* Protected routes (requires login) */}
        <Route path="/complete-profile" element={<PrivateRoute><CompleteProfile /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />

        {/* Protected routes (requires complete profile) */}
        <Route path="/browse" element={<CompleteProfileRoute><Browse /></CompleteProfileRoute>} />
        <Route path="/chat" element={<CompleteProfileRoute><Chat /></CompleteProfileRoute>} />
        <Route path="/notifications" element={<CompleteProfileRoute><Notifications /></CompleteProfileRoute>} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
};

// Main App with providers
function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;