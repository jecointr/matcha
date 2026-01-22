import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export const Input = ({
  label,
  type = 'text',
  error,
  className = '',
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === 'password';
  
  return (
    <div className={`mb-4 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={isPassword && showPassword ? 'text' : type}
          className={`input ${error ? 'border-red-500 focus:ring-red-500' : ''} ${isPassword ? 'pr-10' : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
};

export const Button = ({
  children,
  variant = 'primary',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const variants = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline'
  };
  
  return (
    <button
      className={`${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4\" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading...
        </span>
      ) : children}
    </button>
  );
};

export const Alert = ({ type = 'error', children, onClose }) => {
  const styles = {
    error: 'bg-red-50 text-red-800 border-red-200',
    success: 'bg-green-50 text-green-800 border-green-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    info: 'bg-blue-50 text-blue-800 border-blue-200'
  };
  
  return (
    <div className={`p-4 rounded-lg border ${styles[type]} mb-4`}>
      <div className="flex justify-between items-start">
        <p>{children}</p>
        {onClose && (
          <button onClick={onClose} className="ml-4 hover:opacity-70">×</button>
        )}
      </div>
    </div>
  );
};
