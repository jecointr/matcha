import { Routes, Route, Link, useNavigate, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Heart, Bell, MessageCircle, User, LogOut, Menu, X, Compass, MapPin } from 'lucide-react';
// Context
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider, useSocket } from './context/SocketContext';
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
import Browse from './pages/Browse';
import SearchPage from './pages/SearchPage';
import UserProfile from './pages/UserProfile';
import Likes from './pages/Likes';
import Visitors from './pages/Visitors';
import Chat from './pages/Chat';
import Notifications from './pages/Notifications';
import MapPage from './pages/MapPage';

// Home page
const Home = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/browse" replace />;
  }
  return (
  <div className="text-center py-20">
    <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Matcha</h1>
    <p className="text-xl text-gray-600 mb-8">Find your perfect match</p>
    <div className="space-x-4">
      <Link to="/login" className="btn-primary">Login</Link>
      <Link to="/register" className="btn-outline">Register</Link>
    </div>
  </div>
);
};

const NotFound = () => (
  <div className="text-center py-20">
    <h1 className="text-6xl font-bold text-gray-300">404</h1>
    <p className="text-xl text-gray-500 mt-4">Page not found</p>
    <Link to="/" className="btn-primary mt-6 inline-block">Go Home</Link>
  </div>
);

// Header component with auth and notifications
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadMessages, unreadNotifications } = useSocket();

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
            <img
              src="/logo.png"
              alt="Logo Matcha"
              className="h-8 w-8"
            />
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
                <Link to="/map" className="flex items-center text-gray-600 hover:text-gray-900 px-3 py-2 rounded-lg hover:bg-gray-100">
                  <MapPin className="h-5 w-5 mr-1" />
                  Map
                </Link>
                <Link to="/chat" className="relative text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100">
                  <MessageCircle className="h-6 w-6" />
                  {/* CORRECTION : Pastille simple (Dot) au lieu du chiffre */}
                  {unreadMessages > 0 && (
                    <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                  )}
                </Link>
                <Link to="/notifications" className="relative text-gray-600 hover:text-gray-900 p-2 rounded-lg hover:bg-gray-100">
                  <Bell className="h-6 w-6" />
                  {/* CORRECTION : Pastille simple (Dot) au lieu du chiffre */}
                  {unreadNotifications > 0 && (
                    <span className="absolute top-1 right-2 h-2.5 w-2.5 bg-red-500 rounded-full ring-2 ring-white"></span>
                  )}
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
                  <Link to="/browse" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center" onClick={() => setIsMenuOpen(false)}>
                    <Compass className="h-5 w-5 mr-2" /> Browse
                  </Link>
                  <Link to="/map" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center" onClick={() => setIsMenuOpen(false)}>
                    <MapPin className="h-5 w-5 mr-2" /> Map
                  </Link>
                  <Link to="/chat" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center justify-between" onClick={() => setIsMenuOpen(false)}>
                    <span className="flex items-center"><MessageCircle className="h-5 w-5 mr-2" /> Messages</span>
                    {/* CORRECTION Mobile : Pastille simple */}
                    {unreadMessages > 0 && <span className="h-2.5 w-2.5 bg-red-500 rounded-full"></span>}
                  </Link>
                  <Link to="/notifications" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center justify-between" onClick={() => setIsMenuOpen(false)}>
                    <span className="flex items-center"><Bell className="h-5 w-5 mr-2" /> Notifications</span>
                    {/* CORRECTION Mobile : Pastille simple */}
                    {unreadNotifications > 0 && <span className="h-2.5 w-2.5 bg-red-500 rounded-full"></span>}
                  </Link>
                  <Link to="/profile" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg flex items-center" onClick={() => setIsMenuOpen(false)}>
                    <User className="h-5 w-5 mr-2" /> Profile
                  </Link>
                  <hr className="my-2" />
                  <button
                    onClick={() => { handleLogout(); setIsMenuOpen(false); }}
                    className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center w-full text-left"
                  >
                    <LogOut className="h-5 w-5 mr-2" /> Logout
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg" onClick={() => setIsMenuOpen(false)}>
                    Login
                  </Link>
                  <Link to="/register" className="px-3 py-2 text-primary-500 hover:bg-primary-50 rounded-lg font-medium" onClick={() => setIsMenuOpen(false)}>
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
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Email verification (accessible to all) */}
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/resend-verification" element={<ResendVerification />} />

        {/* Protected routes (requires login) */}
        <Route path="/complete-profile" element={<PrivateRoute><CompleteProfile /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />

        {/* Protected routes (requires complete profile) */}
        <Route path="/browse" element={<CompleteProfileRoute><Browse /></CompleteProfileRoute>} />
        <Route path="/search" element={<CompleteProfileRoute><SearchPage /></CompleteProfileRoute>} />
        <Route path="/profile/:userId" element={<CompleteProfileRoute><UserProfile /></CompleteProfileRoute>} />
        <Route path="/likes" element={<CompleteProfileRoute><Likes /></CompleteProfileRoute>} />
        <Route path="/visitors" element={<CompleteProfileRoute><Visitors /></CompleteProfileRoute>} />
        <Route path="/chat" element={<CompleteProfileRoute><Chat /></CompleteProfileRoute>} />
        <Route path="/notifications" element={<CompleteProfileRoute><Notifications /></CompleteProfileRoute>} />
        <Route path="/map" element={<CompleteProfileRoute><MapPage /></CompleteProfileRoute>} />

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
      <SocketProvider>
        <AppRoutes />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;