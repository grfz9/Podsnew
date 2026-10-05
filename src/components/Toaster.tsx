import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';

const TOAST_EVENT = 'podsal:toast';

/** Petite confirmation en bas de l'écran (« Copié », « Marque-page ajouté »…). Utilisable partout. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}

export function Toaster() {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    let next = 0;
    const onToast = (e: Event) => {
      const id = ++next;
      const text = (e as CustomEvent<string>).detail;
      setItems((list) => [...list.filter((t) => t.text !== text), { id, text }].slice(-3));
      setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 2200);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);
  if (!items.length) return null;
  return (
    <div className="toaster" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="toast">
          <Check size={16} /> {t.text}
        </div>
      ))}
    </div>
  );
}
