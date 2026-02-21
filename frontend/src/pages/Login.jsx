import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input, Button, Alert } from '../components/ui/Input';
import { Heart } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const urlError = params.get('error');

    if (token) {
      localStorage.setItem('token', token);
      window.location.href = '/browse'; 
    }

    if (urlError) {
      setError('Authentication failed via provider.');
    }
  }, [location]);

  const successMessage = location.state?.message;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setShowResend(false);
    
    const result = await login(formData.username, formData.password);
    
    setLoading(false);
    
    if (result.success) {
      const from = location.state?.from?.pathname || '/browse';
      navigate(from, { replace: true });
    } else {
      setError(result.error);
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        setShowResend(true);
      }
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card max-w-md w-full transition-colors duration-200">
        <div className="text-center mb-8">
          <Heart className="w-12 h-12 text-primary-500 mx-auto mb-2" fill="currentColor" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors">Welcome Back</h1>
          <p className="text-gray-600 dark:text-gray-400 transition-colors">Sign in to continue to Matcha</p>
        </div>

        {successMessage && <Alert type="success">{successMessage}</Alert>}
        
        {error && (
          <Alert type="error">
            {error}
            {showResend && (
              <Link 
                to="/resend-verification" 
                className="block mt-2 text-sm underline hover:no-underline"
              >
                Resend verification email
              </Link>
            )}
          </Alert>
        )}

        {/* Section OAuth - Adaptation Dark Mode */}
        <div className="space-y-3 mb-6">
          <a
            href={`${API_URL}/auth/google`}
            className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="h-5 w-5 mr-2" />
            Continue with Google
          </a>
          
          <a
            href={`${API_URL}/auth/github`}
            className="flex items-center justify-center w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
             <img src="https://www.svgrepo.com/show/512317/github-142.svg" alt="GitHub" className="h-5 w-5 mr-2 dark:invert" />
            Continue with GitHub
          </a>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300 dark:border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white dark:bg-gray-900 text-gray-500 dark:text-gray-400 transition-colors">Or continue with email</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <Input
            label="Username or Email"
            name="username"
            value={formData.username}
            onChange={handleChange}
            placeholder="johndoe"
            autoComplete="username"
            required
          />

          <Input
            label="Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />

          <div className="flex justify-end mb-4">
            <Link 
              to="/forgot-password" 
              className="text-sm text-primary-500 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} className="w-full cursor-pointer">
            Sign In
          </Button>
        </form>

        <p className="text-center text-gray-600 dark:text-gray-400 mt-6 transition-colors">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-500 hover:underline font-medium">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;