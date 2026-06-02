import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

/**
 * Feedback global de l'app :
 *  - useToast()   → { success, error, info }  : notifications non bloquantes
 *  - useConfirm() → confirm({ ... }): Promise<boolean>, styled modal (replaces window.confirm)
 *
 * A single provider mounted high in the tree (App.jsx).
 */
const FeedbackContext = createContext(null);

export const useToast = () => useContext(FeedbackContext).toast;
export const useConfirm = () => useContext(FeedbackContext).confirm;

let idCounter = 0;

const TYPE_STYLES = {
  success: { Icon: CheckCircle, border: 'border-green-500', text: 'text-green-600 dark:text-green-400' },
  error: { Icon: XCircle, border: 'border-red-500', text: 'text-red-600 dark:text-red-400' },
  info: { Icon: Info, border: 'border-primary-500', text: 'text-primary-600 dark:text-primary-400' },
};

export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null); // { title, message, confirmText, cancelText, danger, resolve }

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const push = useCallback((message, type, duration) => {
    const id = ++idCounter;
    setToasts(prev => [...prev, { id, message, type }]);
    if (duration !== 0) {
      setTimeout(() => remove(id), duration || 3500);
    }
    return id;
  }, [remove]);

  const toast = useMemo(() => ({
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d ?? 5000),
    info: (m, d) => push(m, 'info', d),
  }), [push]);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      setDialog({
        title: opts.title || 'Are you sure?',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        danger: !!opts.danger,
        resolve,
      });
    });
  }, []);

  const closeDialog = (result) => {
    setDialog((d) => {
      if (d) d.resolve(result);
      return null;
    });
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-96 max-w-[calc(100vw-2rem)] pointer-events-none">
        {toasts.map((t) => {
          const { Icon, border, text } = TYPE_STYLES[t.type] || TYPE_STYLES.info;
          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto flex items-start gap-3 bg-white dark:bg-gray-800 border-l-4 ${border} shadow-xl rounded-lg p-4 animate-in slide-in-from-right-4 fade-in duration-200`}
            >
              <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${text}`} />
              <p className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-100 break-words">{t.message}</p>
              <button
                onClick={() => remove(t.id)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm dialog */}
      {dialog && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => closeDialog(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm border dark:border-gray-800 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{dialog.title}</h3>
              {dialog.message && (
                <p className="text-sm text-gray-600 dark:text-gray-300">{dialog.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t dark:border-gray-800">
              <button
                onClick={() => closeDialog(false)}
                className="px-4 py-2 text-sm rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
              >
                {dialog.cancelText}
              </button>
              <button
                onClick={() => closeDialog(true)}
                className={`px-4 py-2 text-sm rounded-lg text-white transition-colors cursor-pointer ${
                  dialog.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-500 hover:bg-primary-600'
                }`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
};
