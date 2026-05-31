import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const s = searchParams.get('status');

    if (s === 'success') {
      setStatus('success');

      setTimeout(() => {
        navigate('/login');
      }, 2000);

    } else {
      setStatus('error');
    }
  }, [searchParams, navigate]);

  if (status === 'loading') {
    return <div>Verifying...</div>;
  }

  if (status === 'success') {
    return (
      <div>
        <h1>Email verified ✅</h1>
        <p>You can now log in. Redirecting...</p>
      </div>
    );
  }

  return (
    <div>
      <h1>Verification Failed ❌</h1>
      <p>Please resend verification email.</p>
    </div>
  );
}