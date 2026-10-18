import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, type = 'info', action) => {
    const id = crypto.randomUUID();
    setItems((s) => [...s, { id, message, type, action }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 6000);
  }, []);
  const tone = { info: 'border-line', success: 'border-accent', error: 'border-red-500' };
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto card flex items-start gap-3 border-l-4 px-4 py-3 text-sm shadow-lg ${tone[t.type]}`}>
            <span className="flex-1">{t.message}</span>
            {t.action && <a className="font-semibold text-accent underline" href={t.action.href} target={t.action.external ? '_blank' : undefined} rel="noreferrer">{t.action.label}</a>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
