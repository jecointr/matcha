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
        /* MODIF : dark:text-gray-300 */
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 transition-colors">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={isPassword && showPassword ? 'text' : type}
          /* MODIF : Ajout d'une transition et gestion de l'erreur en dark mode */
          className={`input transition-all duration-200 ${
            error 
              ? 'border-red-500 focus:ring-red-500 dark:border-red-500' 
              : 'dark:border-gray-700'
          } ${isPassword ? 'pr-10' : ''}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            /* MODIF : cursor-pointer et couleurs adaptatives */
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 cursor-pointer transition-colors"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        )}
      </div>
      {error && (
        /* MODIF : dark:text-red-400 */
        <p className="mt-1 text-sm text-red-500 dark:text-red-400 transition-colors animate-fade-in">
          {error}
        </p>
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
    /* MODIF : Ajout de cursor-pointer et effet de scale au clic */
    <button
      className={`${variants[variant]} ${className} cursor-pointer transition-all active:scale-[0.98] disabled:active:scale-100 disabled:cursor-not-allowed`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
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
    /* MODIF : Couleurs adoucies pour le Dark Mode avec bg opaque à 20% */
    error: 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/50',
    success: 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-900/50',
    warning: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border-yellow-200 dark:border-yellow-900/50',
    info: 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-900/50'
  };
  
  return (
    <div className={`p-4 rounded-lg border ${styles[type]} mb-4 transition-colors duration-200 animate-in fade-in slide-in-from-top-1`}>
      <div className="flex justify-between items-start">
        <div className="text-sm">{children}</div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="ml-4 hover:opacity-70 cursor-pointer transition-opacity text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};