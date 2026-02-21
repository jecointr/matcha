import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import { Check, X, Loader } from 'lucide-react';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState('loading'); 
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setStatus('error');
        setMessage('Verification token is missing');
        return;
      }

      try {
        const response = await authAPI.verifyEmail(token);
        setStatus('success');
        setMessage(response.data.message);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.error || 'Verification failed');
      }
    };

    verifyEmail();
  }, [token]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="card max-w-md w-full text-center transition-colors duration-200">
        {status === 'loading' && (
          <>
            <Loader className="w-16 h-16 text-primary-500 mx-auto mb-4 animate-spin" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Verifying...</h2>
            <p className="text-gray-600 dark:text-gray-400 transition-colors">Please wait while we verify your email.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
              <Check className="w-8 h-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Email Verified!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 transition-colors">{message}</p>
            <Link to="/login" className="btn-primary inline-block">
              Sign In
            </Link>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors">
              <X className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-colors">Verification Failed</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 transition-colors">{message}</p>
            <div className="space-y-3">
              <Link to="/resend-verification" className="btn-primary block">
                Resend Verification Email
              </Link>
              <Link to="/login" className="btn-secondary block">
                Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;