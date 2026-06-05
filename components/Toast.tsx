import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const config = {
    success: {
      icon: <CheckCircle className="w-5 h-5 text-emerald-500 animate-pulse" />,
      className: "border-emerald-950/40 bg-zinc-900/90 text-zinc-200 shadow-2xl shadow-emerald-950/15",
      accent: "bg-emerald-500"
    },
    error: {
      icon: <AlertCircle className="w-5 h-5 text-rose-500 animate-bounce" />,
      className: "border-rose-950/40 bg-zinc-900/90 text-zinc-200 shadow-2xl shadow-rose-950/15",
      accent: "bg-rose-500"
    },
    info: {
      icon: <Info className="w-5 h-5 text-indigo-500" />,
      className: "border-indigo-950/40 bg-zinc-900/90 text-zinc-200 shadow-2xl shadow-indigo-950/15",
      accent: "bg-indigo-500"
    }
  };

  const { icon, className, accent } = config[toast.type];

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className={`relative flex items-center w-80 p-4.5 mb-3 border rounded-2xl shadow-2xl overflow-hidden ${className}`}
    >
      {/* Tiny colorful line progress simulation */}
      <div className={`absolute top-0 left-0 w-1.5 h-full ${accent}`} />
      
      <div className="flex-shrink-0 ml-1.5">
        {icon}
      </div>
      <div className="ml-3.5 text-xs font-semibold flex-1 leading-relaxed">
        {toast.message}
      </div>
      <button 
        onClick={() => onClose(toast.id)}
        className="ml-2.5 bg-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg p-1.5 inline-flex h-7 w-7 items-center justify-center transition-all duration-200 active:scale-90"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};

export const ToastContainer: React.FC<{ toasts: ToastMessage[]; removeToast: (id: string) => void }> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      <div className="pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {toasts.map(toast => (
            <Toast key={toast.id} toast={toast} onClose={removeToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};