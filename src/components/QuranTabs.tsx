import { NavLink } from 'react-router';
import { BookOpenText, Headphones } from 'lucide-react';

/** Rubrique Coran : écouter (récitateurs) ou lire (texte et traduction), au même endroit. */
export function QuranTabs() {
  return (
    <nav className="quran-tabs" aria-label="Coran">
      <NavLink to="/coran" className="quran-tabs__tab">
        <Headphones size={17} /> Écouter
      </NavLink>
      <NavLink to="/lire" className="quran-tabs__tab">
        <BookOpenText size={17} /> Lire
      </NavLink>
    </nav>
  );
}
