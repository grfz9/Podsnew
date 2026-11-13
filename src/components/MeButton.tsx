import { Link } from 'react-router';
import { User } from 'lucide-react';
import { useAuth } from '../store/auth';

/**
 * Pastille du compte en haut des pages principales sur téléphone (comme l'avatar de Spotify) :
 * « Moi » n'occupe plus d'onglet dans la barre du bas, qui garde la Bibliothèque.
 */
export function MeButton({ className = '' }: { className?: string }) {
  const auth = useAuth();
  const name = auth.profile?.display_name || auth.profile?.username;
  return (
    <Link to="/account" className={`me-button ${className}`} aria-label={name ? `Mon espace (${name})` : 'Mon espace'} title="Mon espace">
      {name ? <span className="avatar avatar--small">{name.slice(0, 1).toUpperCase()}</span> : <User size={20} />}
    </Link>
  );
}
