// [ROLE] Shared toast notification system for the GridMath platform.
// Provides addToast / removeToast to any component in the tree via useToast().
//
// [WHY] Both CombineGrid and SpeedGrid need lightweight error/info messages
// (e.g. "Failed to start round") without coupling to a global state store.
// Context is the correct scope — toast lifetime is session-level.
//
// [INVARIANT] ToastProvider must wrap GameSelector in main.tsx. Any component
// calling useToast() without a Provider ancestor will throw immediately.
//
// [FUTURE] Could add toast types with icons, or a queue cap to prevent flood.
// Both are safe to add as optional features without touching existing callers.

import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast: Toast = { id, message, type, duration };

    setToasts((prev) => [...prev, newToast]);
    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* [ARCHITECTURE] Toast overlay renders above everything. z-[10000] places it
          above game modals (z-2000) and phase overlays (z-50000 uses absolute, not fixed).
          pointer-events-none on container prevents blocking the game behind it. */}
      <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`
              pointer-events-auto
              px-4 py-3 rounded-lg shadow-lg text-white font-medium text-sm
              transform transition-all duration-300 ease-in-out
              ${toast.type === 'success' ? 'bg-green-600' : ''}
              ${toast.type === 'error' ? 'bg-red-600' : ''}
              ${toast.type === 'info' ? 'bg-blue-600' : ''}
              ${toast.type === 'warning' ? 'bg-yellow-600' : ''}
            `}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// [INVARIANT] Must be called inside a ToastProvider. Throws if not.
export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
