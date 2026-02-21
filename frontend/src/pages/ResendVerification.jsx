import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Input, Button, Alert } from '../components/ui/Input';
import { Mail, ArrowLeft } from 'lucide-react';

const ResendVerification = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authAPI.resendVerification(email);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resend verification email');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="card max-w-md w-full text-center transition-colors">
          <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
            <Mail className="w-8 h-8 text-primary-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Check your email</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 transition-colors">
            If an account exists with <strong>{email}</strong>, we've sent a link.
          </p>
          <Link to="/login" className="btn-secondary inline-flex items-center">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Resend Verification</h1>
          <p className="text-gray-600 mt-2">
            Enter your email to receive a new verification link
          </p>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        <form onSubmit={handleSubmit}>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />

          <Button type="submit" loading={loading} className="w-full">
            Send Verification Link
          </Button>
        </form>

        <p className="text-center mt-6">
          <Link to="/login" className="text-primary-500 hover:underline inline-flex items-center">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to Login
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResendVerification;
