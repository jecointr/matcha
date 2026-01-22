import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Input, Button, Alert } from '../components/ui/Input';
import { Heart } from 'lucide-react';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showResend, setShowResend] = useState(false);

  // Check for success message from email verification
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
      // Redirect to intended page or home
      const from = location.state?.from?.pathname || '/browse';
      navigate(from, { replace: true });
    } else {
      setError(result.error);
      // Show resend option if email not verified
      if (result.code === 'EMAIL_NOT_VERIFIED') {
        setShowResend(true);
      }
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <Heart className="w-12 h-12 text-primary-500 mx-auto mb-2" fill="currentColor" />
          <h1 className="text-2xl font-bold text-gray-900">Welcome Back</h1>
          <p className="text-gray-600">Sign in to continue to Matcha</p>
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

          <Button type="submit" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>

        <p className="text-center text-gray-600 mt-6">
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
