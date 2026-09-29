import { useState, type ReactNode } from 'react';
import { LoaderCircle, Mic } from 'lucide-react';

export function Artwork({ src, alt, size, className = '' }: { src?: string; alt: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const style = size ? { width: size, height: size } : undefined;
  if (!src || failed) {
    return (
      <div className={`artwork artwork--placeholder ${className}`} style={style} aria-label={alt}>
        <Mic size={size ? Math.max(16, size / 3) : 32} />
      </div>
    );
  }
  return (
    <img className={`artwork ${className}`} style={style} src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  );
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <LoaderCircle className="spin" size={28} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p>Oups, le chargement a échoué.</p>
      <p className="muted small">{error.message === 'Failed to fetch' ? 'Vérifiez votre connexion internet.' : error.message}</p>
      {onRetry && (
        <button className="btn btn--outline" onClick={onRetry}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <h3>{title}</h3>
      {children && <div className="muted">{children}</div>}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section__header">
        <h2>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
