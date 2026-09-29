# Podsnew

Application d'écoute de podcasts inspirée de Spotify et Deezer, réservée aux contenus parlés : **pas de musique** (les podcasts musicaux sont exclus du catalogue, des recherches, des recommandations et du studio).

Disponible sur le web (installable), sur Android et sur iOS.

## Fonctionnalités

### Écoute
- Catalogue Apple Podcasts : classements par pays et par catégorie, recherche de podcasts et d'épisodes.
- Lecteur : reculer de 15 s / avancer de 30 s, vitesse de 0,75× à 2×, minuteur de sommeil, reprise automatique, file d'attente, contrôles de l'écran verrouillé, raccourcis clavier.
- **Chapitres** et **transcriptions** publiés par les éditeurs (norme Podcasting 2.0) : la transcription suit la lecture et chaque phrase permet de sauter au passage.
- **Téléchargements hors-ligne** : épisodes stockés sur l'appareil, lisibles sans connexion.

### Découverte
- **Mix du jour** : les nouveautés de vos abonnements et quelques découvertes, renouvelés chaque jour.
- **« Parce que vous écoutez… »** : podcasts populaires dans les catégories que vous écoutez le plus.
- **Recherche dans ce qui est dit** : retrouve l'épisode et le moment où un sujet est abordé.
- **Résumés automatiques** : points clés, thèmes et découpage d'un épisode, rédigés à partir de la transcription ou de la description.

### Bibliothèque
- Abonnements, favoris, historique, extraits, téléchargements.
- **Extraits partageables** : choisissez un passage (5 s à 2 min) et partagez un lien qui lit uniquement ce passage.
- **Statistiques d'écoute** : temps d'écoute par mois, podcasts et catégories préférés, série de jours, bilan de l'année.
- **Import / export OPML** de vos abonnements depuis ou vers Apple Podcasts, Pocket Casts, Overcast, AntennaPod…
- **Notifications** de nouveaux épisodes.

### Compte et social (backend facultatif)
- **Comptes et synchronisation** entre appareils : abonnements, progression, extraits, statistiques.
- **Amis** : suivre des personnes, voir leurs écoutes (si elles le partagent), leurs extraits et leurs avis.
- **Avis** : notes de 1 à 5 et commentaires laissés par les utilisateurs (aucun avis importé ni inventé).
- **Studio créateur** : publier son podcast (pochette, épisodes, programmation), obtenir un flux RSS à soumettre aux autres plateformes, suivre ses écoutes.

## Démarrer

Prérequis : Node.js 22.22 ou plus récent.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (Vitest)
npm run typecheck  # vérification TypeScript
npm run build      # build de production dans dist/
```

Sans configuration, l'application fonctionne entièrement sur l'appareil : écoute, téléchargements, statistiques, mix du jour, extraits et import OPML sont disponibles. Les comptes, le social, les résumés et le studio nécessitent le backend ci-dessous.

Le build est un site statique (routage par `#`) : il peut être hébergé tel quel sur GitHub Pages, Netlify, Vercel, etc.

## Activer les comptes (Supabase)

Le backend utilise [Supabase](https://supabase.com) : base Postgres avec sécurité par ligne, authentification, stockage de fichiers et fonctions serveur.

1. Créez un projet Supabase, puis liez-le :
   ```bash
   npx supabase login
   npx supabase link --project-ref <identifiant-du-projet>
   ```
2. Créez les tables, règles d'accès et espaces de stockage :
   ```bash
   npx supabase db push
   ```
3. Déployez les fonctions serveur :
   ```bash
   npx supabase functions deploy proxy transcript summarize rss
   ```
4. Pour les résumés automatiques, ajoutez une clé de l'API Claude (console.anthropic.com) :
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   Sans cette clé, tout fonctionne sauf les résumés.
5. Copiez `.env.example` en `.env.local` et renseignez l'URL du projet et sa clé publique (tableau de bord Supabase → *Project Settings* → *API Keys*).
6. Dans *Authentication* → *URL Configuration*, ajoutez l'adresse de votre site aux URL de redirection (confirmation d'e-mail et mot de passe oublié).

Pour développer avec un Supabase local (Docker requis) : `npx supabase start`, puis utilisez l'URL et la clé affichées.

### Fonctions serveur

| Fonction | Rôle |
|---|---|
| `proxy` | Récupère flux RSS, chapitres et transcriptions quand l'hébergeur du podcast bloque le navigateur (utilisateurs connectés, adresses internes refusées, 8 Mo max). |
| `transcript` | Récupère la transcription d'un épisode et l'ajoute à l'index de recherche. |
| `summarize` | Rédige le résumé d'un épisode avec Claude (modèle `claude-opus-5-5`). Chaque épisode n'est résumé qu'une fois ; 20 nouveaux résumés par utilisateur et par jour. |
| `rss` | Flux RSS public des podcasts publiés dans le studio. |

## Application mobile (Capacitor)

Les projets natifs sont dans `android/` et `ios/`.

```bash
npm run cap:android   # ouvre le projet dans Android Studio
npm run cap:ios       # ouvre le projet dans Xcode (macOS)
```

Pour la version mobile, définissez les variables Supabase **avant** le build, puis lancez `npm run cap:sync`. L'identifiant d'application est `app.podsnew` (modifiable dans `capacitor.config.ts`).

## Limites connues

- **Transcriptions et chapitres** : uniquement quand l'éditeur les publie dans son flux RSS ; beaucoup de podcasts n'en ont pas encore. La recherche « dans les épisodes » ne porte que sur les transcriptions déjà consultées sur Podsnew.
- **Téléchargements** : certains hébergeurs refusent les téléchargements depuis un navigateur. Dans ce cas, l'épisode est conservé dans le cache de l'application installée, et l'avance rapide hors-ligne peut y être limitée.
- **Notifications** : dans le navigateur, la vérification en arrière-plan ne fonctionne qu'avec l'application installée sous Chrome/Android ; ailleurs, elle a lieu quand l'application est ouverte. Pour recevoir des notifications application fermée sur iOS, il faudra ajouter des notifications push côté serveur.
- **Écoute en arrière-plan sur Android** : le système peut interrompre la lecture après un long moment en arrière-plan ; un service de lecture natif sera nécessaire pour la garantir.
- **Résumés** : générés automatiquement, ils peuvent contenir des erreurs ; la page l'indique.

## Structure

```
src/
  api/          catalogue Apple, podcasts des créateurs, social, résumés, studio
  store/        état global : bibliothèque, compte et synchronisation, téléchargements, lecteur
  lib/          statistiques, synchronisation, recommandations, OPML, flux RSS, notifications
  components/   mise en page, lecteur, épisodes, graphiques, avis, activité
  pages/        Accueil, Recherche, Podcast, Épisode, Extrait, Bibliothèque, Statistiques,
                Amis, Profil, Compte, Studio, Import, File d'attente
public/sw.js    service worker (hors-ligne, téléchargements, notifications)
supabase/       schéma SQL (migrations) et fonctions serveur
android/, ios/  projets natifs Capacitor
```
