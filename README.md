# Podsnew

Une application d'écoute de podcasts inspirée de Spotify et Deezer, uniquement dédiée aux podcasts.

## Fonctionnalités

- **Découverte** : accueil avec classements (top général et par catégorie), 18 catégories à parcourir.
- **Recherche** de podcasts et d'épisodes.
- **Page podcast** : abonnement, partage, liste des épisodes avec recherche, filtres (non écoutés / en cours) et tri.
- **Lecteur audio** complet :
  - reculer de 15 s / avancer de 30 s, barre de progression ;
  - vitesse de lecture (0,75× à 2×) ;
  - minuteur de sommeil (5 à 60 min, ou fin de l'épisode) ;
  - reprise automatique là où vous vous étiez arrêté ;
  - lecteur plein écran sur mobile ;
  - contrôles système (écran verrouillé, casque Bluetooth) via la Media Session API ;
  - raccourcis clavier : `Espace` lecture/pause, `←` / `→` reculer / avancer.
- **File d'attente** : lire ensuite, ajouter à la suite, réordonner, enchaînement automatique.
- **Bibliothèque** : abonnements, épisodes favoris, historique, « Reprendre l'écoute » et nouveaux épisodes des abonnements sur l'accueil.
- **Réglages** : pays du catalogue (France, Belgique, Suisse, Canada…).
- Interface **responsive** (ordinateur et mobile) et installable (manifeste PWA).

Les données (abonnements, progression, file d'attente…) sont enregistrées localement dans le navigateur.

## Données

Le catalogue provient de l'[API iTunes Search d'Apple](https://performance-partners.apple.com/search-api) : gratuite, sans clé et utilisable directement depuis le navigateur. L'audio est lu directement depuis les serveurs des éditeurs de podcasts.

## Développement

Prérequis : Node.js 22+.

```bash
npm install
npm run dev        # serveur de développement sur http://localhost:5173
npm test           # tests unitaires (Vitest)
npm run typecheck  # vérification TypeScript
npm run build      # build de production dans dist/
```

Le build est un site statique (routage par `#`) : il peut être hébergé tel quel sur GitHub Pages, Netlify, Vercel, etc.

## Structure

```
src/
  api/          # accès au catalogue (iTunes) et liste des catégories
  store/        # état global : bibliothèque (localStorage) et lecteur audio
  components/   # mise en page, lecteur, cartes, lignes d'épisode
  pages/        # Accueil, Recherche, Catégorie, Podcast, Bibliothèque, File d'attente
  utils/        # formatage, file d'attente, progression, hooks
```
