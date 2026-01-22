import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Input, Button, Alert } from '../components/ui/Input';
import { Check, Lock } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await authAPI.resetPassword({
        token,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      });
      setSuccess(true);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.errors) {
        setErrors(errorData.errors);
      } else {
        setErrors({ general: errorData?.error || 'Password reset failed' });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Invalid Link</h2>
          <p className="text-gray-600 mb-6">
            This password reset link is invalid or has expired.
          </p>
          <Link to="/forgot-password" className="btn-primary">
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
          <p className="text-gray-600 mb-6">
            Your password has been successfully reset. You can now sign in with your new password.
          </p>
          <Link to="/login" className="btn-primary inline-block">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-primary-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Reset Password</h1>
          <p className="text-gray-600 mt-2">Enter your new password</p>
        </div>

        {errors.general && <Alert type="error">{errors.general}</Alert>}

        <form onSubmit={handleSubmit}>
          <Input
            label="New Password"
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="••••••••"
            required
          />

          <Input
            label="Confirm New Password"
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
            placeholder="••••••••"
            required
          />

          <div className="text-sm text-gray-500 mb-4">
            Password must contain at least 8 characters, including uppercase, lowercase, number, and special character.
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
