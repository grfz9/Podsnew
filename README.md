# Podsal

Application d'écoute de podcasts et du Coran, pensée dans le respect du Coran et de la Sunnah : **pas de musique**, pas de contenu explicite, pas d'images d'êtres vivants.

Disponible sur le web (installable), sur Android et sur iOS.

## Règles de contenu

- **Coran** : toujours disponible.
- **Podcasts islamiques** : uniquement ceux validés un par un par l'administrateur (liste de départ dans le code + page « Modération »). Les utilisateurs peuvent en proposer ; rien n'est ajouté automatiquement.
- **Autres podcasts** (actualités, histoire, sciences…) : disponibles, sauf la musique, le contenu marqué explicite par l'éditeur et les podcasts religieux non validés (y compris ceux d'autres religions).
- L'administrateur peut **masquer** n'importe quel podcast du catalogue.
- **Aucune image** de podcast n'est affichée : chaque podcast a une couverture neutre (couleur, motif géométrique et initiale).
- **Pas de résumé automatique** pour le Coran ni pour les podcasts islamiques.

Ces règles s'appliquent partout : accueil, recherche, catégories, recommandations, import OPML, pages podcast et épisode.

## Fonctionnalités

### Coran
- Récitateurs de [mp3quran.net](https://mp3quran.net), filtrables par **riwaya** (Hafs, Warsh, Qalun…), récitateurs favoris.
- **Récitateurs connus** mis en avant, Muhammad al-Luhaidan en tête (liste dans `src/data/reciters.ts`) ; la recherche tolère les différentes transcriptions (« luhaidan », « lohaidan », « اللحيدان »).
- Page de sourate : **texte arabe** (édition Uthmani), **traduction française du sens** au choix — Rachid Maach (revue par le Centre Rowwad at-Tarjama) ou Muhammad Hamidullah, publiées par [QuranEnc.com](https://quranenc.com) — ou sans traduction.
- Le verset en cours est surligné et suivi pendant la récitation ; un clic sur un verset y fait sauter.
- **Répétition pour mémoriser** : 1, 2, 3, 5, 10 fois ou en boucle, sur la sourate entière ou sur un passage (du verset… au verset…) quand le minutage des versets est disponible.
- Téléchargement pour l'écoute hors-ligne, ajout aux playlists.

### Prière
- **Horaires de prière** calculés sur l'appareil (bibliothèque adhan) : position GPS ou ville, méthode de calcul (Ligue islamique mondiale, Umm al-Qura, UOIF, etc.), Asr selon l'avis majoritaire ou hanafite.
- **Pause automatique** de la lecture à l'heure de la prière, et notification si elle est activée.

### Podcasts
- Catalogue Apple Podcasts filtré : classements, catégories, recherche de podcasts et d'épisodes.
- Page « Podcasts islamiques » : podcasts validés et formulaire de proposition.
- Lecteur : reculer de 15 s / avancer de 30 s, vitesse de 0,75× à 2×, minuteur de sommeil, reprise automatique, file d'attente, contrôles de l'écran verrouillé.
- Chapitres et transcriptions publiés par les éditeurs, recherche dans ce qui est dit.
- Téléchargements hors-ligne, extraits partageables, statistiques d'écoute, import / export OPML, notifications de nouveaux épisodes.

### Playlists et amis
- **Playlists** : sourates et épisodes, synchronisées entre appareils.
- **Amis** : ajout mutuel (demande puis acceptation). Des amis peuvent seulement **consulter les playlists l'un de l'autre** : il n'y a ni messagerie, ni commentaires, ni avis, ni fil d'activité.

### Studio créateur
Publier son podcast (sans musique ni contenu explicite) et obtenir un flux RSS. Un podcast religieux doit être proposé puis validé comme les autres.

## Démarrer

Prérequis : Node.js 22.22 ou plus récent.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (Vitest)
npm run typecheck  # vérification TypeScript
npm run build      # build de production dans dist/
```

Sans configuration, l'application fonctionne sur l'appareil : Coran, horaires de prière, écoute, téléchargements, playlists, statistiques. Les comptes, les amis, la modération, les propositions, les résumés et le studio nécessitent le backend ci-dessous.

Le build est un site statique (routage par `#`) : il peut être hébergé tel quel sur GitHub Pages, Netlify, Vercel, etc.

## Ajouter des podcasts islamiques

La liste de départ (`src/data/islamicSeed.ts`) contient :

| Podcast | Source |
|---|---|
| Le minhaj as-Salafiyah | Apple Podcasts (`id1802887942`) |
| Khoutbas – Mihraby (imam Younes, Abu Zakariya) | flux RSS `https://feeds.buzzsprout.com/2392576.rss` |

Pour en ajouter d'autres, deux possibilités cumulables :

1. **Depuis l'application** (comptes activés, compte administrateur) — page « Modération » :
   - **Propositions** : valider ou refuser les podcasts proposés par les utilisateurs ;
   - **Ajouter → Par flux RSS** : coller l'adresse du flux d'un podcast absent d'Apple Podcasts (Spotify for Creators, Buzzsprout, Ausha, SoundCloud…), « Vérifier le flux », puis « Valider » ;
   - **Ajouter → Dans le catalogue Apple Podcasts** : rechercher par nom, puis « Valider » ;
   - **Validés** : retirer une validation (ou « Masquer » un podcast de la liste de départ) ;
   - **Masqués** : rétablir un podcast.

   Sur la page d'un podcast, l'administrateur dispose aussi des boutons « Valider » et « Masquer du catalogue ».
2. **Dans le code** — ajouter une ligne à `src/data/islamicSeed.ts` :
   ```ts
   { id: '1234567890', title: 'Nom du podcast', author: 'Nom du prédicateur' },          // Apple Podcasts : nombre à la fin de l'adresse
   { id: 'rss-…', title: 'Nom', author: 'Auteur', feedUrl: 'https://…/feed.xml' },   // flux RSS
   ```
   Pour un flux RSS, l'identifiant `rss-…` est calculé à partir de l'adresse (`rssPodcastId` dans `src/api/rss.ts`) ; un test vérifie qu'il correspond.

Un site web sans flux podcast (pages de cours, chaîne YouTube, canal Telegram) ne peut pas être ajouté : il faut un flux RSS ou une fiche Apple Podcasts.

### Devenir administrateur

Créez votre compte dans l'application, puis exécutez dans l'éditeur SQL du tableau de bord Supabase :

```sql
insert into admins (user_id) select id from auth.users where email = 'votre@adresse.fr';
```

Rechargez l'application : le lien « Modération » apparaît dans le menu.

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
   npx supabase functions deploy proxy transcript summarize rss billing stripe-webhook
   ```
4. Pour les résumés automatiques (podcasts non religieux uniquement), ajoutez une clé de l'API Claude (console.anthropic.com) :
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   ```
   Sans cette clé, tout fonctionne sauf les résumés.
5. Copiez `.env.example` en `.env.local` et renseignez l'URL du projet et sa clé publique (tableau de bord Supabase → *Project Settings* → *API Keys*).
6. Dans *Authentication* → *URL Configuration*, ajoutez l'adresse de votre site aux URL de redirection (confirmation d'e-mail et mot de passe oublié).

Pour développer avec un Supabase local (Docker requis) : `npx supabase start`, puis utilisez l'URL et la clé affichées. En local, le numéro de test `06 12 34 56 78` reçoit toujours le code SMS `123456` (aucun SMS envoyé).

### Connexion avec Google, Apple ou un téléphone

L'écran de connexion propose : Google, Apple, e-mail + mot de passe, téléphone + mot de passe (confirmé par un code SMS). Chaque méthode s'active dans le tableau de bord Supabase → *Authentication* → *Sign In / Providers* :

- **Google** : dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials), créez un « ID client OAuth » de type *Application Web*, avec comme URI de redirection autorisée `https://<projet>.supabase.co/auth/v1/callback`. Collez l'ID client et le code secret dans le fournisseur *Google* de Supabase.
- **Apple** (compte Apple Developer requis, 99 €/an) : créez un *Services ID* (identifiant de connexion), une clé *Sign in with Apple* et notez votre *Team ID* ; le tableau de bord Supabase génère le secret à partir de ces éléments. URL de retour : la même que pour Google.
- **Téléphone** : créez un compte [Twilio](https://www.twilio.com), un *Messaging Service*, puis collez *Account SID*, *Auth Token* et *Messaging Service SID* dans le fournisseur *Phone* de Supabase (cochez « Enable phone signup » et « Confirm phone »). Chaque SMS est facturé par Twilio (quelques centimes).

Les comptes créés avec Google, Apple ou un téléphone reçoivent un pseudo provisoire ; la page Compte invite à choisir le sien. Dans l'application Android / iOS, les boutons Google et Apple sont masqués (ils demandent une configuration native) : e-mail et téléphone y fonctionnent.

### Abonnement Podsal+ (Stripe)

2,99 € par mois ou 24,99 € par an. Le Coran, les horaires de prière et les podcasts islamiques restent gratuits ; Podsal+ ajoute :

| Avantage | Sans abonnement | Podsal+ |
|---|---|---|
| Fonds d'écran | 3 fonds | les 8 fonds |
| Téléchargements hors-ligne | 10 épisodes ou sourates | illimités |
| Statistiques | mois et année, podcasts préférés | + historique complet, catégories, heures d'écoute, bilan de l'année, export CSV |
| Résumés automatiques (podcasts généraux) | 3 par jour | 20 par jour |

Mise en place :

1. Sur [dashboard.stripe.com](https://dashboard.stripe.com), créez un produit « Podsal+ » avec deux prix récurrents : 2,99 € par mois et 24,99 € par an. Notez leurs identifiants (`price_…`).
2. Activez l'espace client (*Settings* → *Billing* → *Customer portal*) pour que les abonnés puissent résilier ou changer de carte.
3. Créez un webhook (*Developers* → *Webhooks*) vers `https://<projet>.supabase.co/functions/v1/stripe-webhook`, avec les événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed`. Notez son secret de signature (`whsec_…`).
4. Enregistrez les secrets :
   ```bash
   npx supabase secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \
     STRIPE_PRICE_MONTHLY=price_... STRIPE_PRICE_YEARLY=price_... APP_URLS=https://votre-site.fr
   ```
   `APP_URLS` liste les adresses de l'application (séparées par des virgules) vers lesquelles Stripe peut renvoyer après le paiement.

Commencez avec les clés de test (`sk_test_…`) et la carte `4242 4242 4242 4242`. L'abonnement n'est enregistré que par le webhook (signature vérifiée) : l'application ne peut pas s'accorder Podsal+ elle-même.

Dans les applications Android et iOS, Apple et Google imposent leurs propres systèmes d'achat pour un abonnement numérique : le bouton « S'abonner » y est masqué. Il faudra ajouter les achats intégrés (par exemple avec RevenueCat) avant la publication sur les stores ; les abonnés du web retrouvent leurs avantages sur mobile en se connectant.

### Fonctions serveur

| Fonction | Rôle |
|---|---|
| `proxy` | Récupère flux RSS, chapitres et transcriptions quand l'hébergeur du podcast bloque le navigateur (utilisateurs connectés, adresses internes refusées, 8 Mo max). |
| `transcript` | Récupère la transcription d'un épisode et l'ajoute à l'index de recherche. |
| `summarize` | Rédige le résumé d'un épisode avec Claude (modèle `claude-opus-5-5`). Refuse le Coran et les podcasts islamiques. Chaque épisode n'est résumé qu'une fois ; 3 nouveaux résumés par jour (20 avec Podsal+). |
| `rss` | Flux RSS public des podcasts publiés dans le studio. |
| `billing` | Ouvre le paiement Stripe (Podsal+) ou l'espace client pour gérer l'abonnement. |
| `stripe-webhook` | Reçoit les événements Stripe (signature vérifiée) et tient à jour la table `subscriptions`. |

## Application mobile (Capacitor)

Les projets natifs sont dans `android/` et `ios/`.

```bash
npm run cap:android   # ouvre le projet dans Android Studio
npm run cap:ios       # ouvre le projet dans Xcode (macOS)
```

Pour la version mobile, définissez les variables Supabase **avant** le build, puis lancez `npm run cap:sync`. L'identifiant d'application est `app.podsal` (modifiable dans `capacitor.config.ts`).

## Sources et limites

- **Traductions** : une traduction rend le sens du Coran, elle n'est pas le Coran ; l'application l'indique sur chaque sourate. Seules des traductions publiées et revues par QuranEnc sont proposées.
- **Texte arabe** : édition Uthmani selon la lecture de Hafs. Pour une récitation dans une autre riwaya, l'application le signale.
- **Minutage des versets** (surlignage, répétition d'un passage) : fourni par mp3quran.net pour une partie des récitations seulement ; sinon, seule la sourate entière peut être répétée.
- **Horaires de prière** : calculés, ils peuvent différer de quelques minutes de ceux de votre mosquée ; vérifiez-les et choisissez la méthode en conséquence.
- **Mawaqit** : l'API de Mawaqit est privée (réservée à leurs propres applications et partenaires) ; Podsal ne peut donc pas afficher les horaires d'une mosquée Mawaqit sans un accord avec eux (contact : voir mawaqit.net).
- **Podcasts généraux** : le filtrage repose sur la catégorie et le marquage « explicite » déclarés par les éditeurs. Un podcast peut contenir un générique musical : l'administrateur peut alors le masquer.
- **Transcriptions et chapitres** : uniquement quand l'éditeur les publie dans son flux RSS.
- **Téléchargements** : certains hébergeurs refusent les téléchargements depuis un navigateur ; l'épisode est alors conservé dans le cache de l'application installée.
- **Notifications** : dans le navigateur, la vérification en arrière-plan ne fonctionne qu'avec l'application installée sous Chrome/Android ; ailleurs, elle a lieu quand l'application est ouverte.
- **Écoute en arrière-plan sur Android** : le système peut interrompre la lecture après un long moment en arrière-plan ; un service de lecture natif sera nécessaire pour la garantir.

## Structure

```
src/
  api/          catalogue Apple, Coran (récitateurs, texte, traductions), modération, amis, studio
  data/         sourates, récitateurs connus, liste de départ des podcasts islamiques
  store/        état global : bibliothèque, compte et synchronisation, modération, téléchargements, lecteur
  lib/          règles de contenu, horaires de prière, statistiques, synchronisation, recommandations, OPML
  components/   mise en page, lecteur, épisodes, playlists, couvertures, graphiques
  pages/        Accueil, Coran, Prière, Podcasts islamiques, Modération, Recherche, Podcast, Épisode,
                Bibliothèque, Playlists, Amis, Statistiques, Compte, Studio, Import, File d'attente
public/sw.js    service worker (hors-ligne, téléchargements, notifications)
supabase/       schéma SQL (migrations) et fonctions serveur
android/, ios/  projets natifs Capacitor
brand/          logo fourni (branding.pdf) et script qui en tire favicon, icônes et écrans de démarrage
```

## Identité visuelle

Le logo (`brand/branding.pdf`) est un mot-symbole « Podsal » blanc cassé (`#f5f1ec`) sur vert-bleu (`#2f4f4f`). Comme un mot entier est illisible dans une icône carrée, l'application a aussi un **symbole** : une arche de mihrab contenant des ondes sonores. Le symbole sert d'icône (favicon, application web, Android, iOS) ; symbole et mot-symbole apparaissent ensemble dans la barre latérale, sur l'accueil mobile et sur l'écran de démarrage. Les éléments interactifs utilisent une teinte claire du même vert-bleu (`#6cc4b4`).

**Couvertures** : aucune pochette d'origine n'est affichée (beaucoup représentent des personnes). Chaque podcast reçoit une couverture dessinée en géométrie pure (`src/components/Cover.tsx`) : arche de mihrab dorée pour le Coran, rosaces et pavages d'étoiles à huit branches pour les podcasts islamiques (plusieurs palettes), icône de la catégorie pour les autres podcasts.

**Fonds d'écran** (page « Fonds d'écran », depuis Compte) : vert-bleu, nuit étoilée, dunes, puis avec Podsal+ étoiles dorées, arcades, coupole au crépuscule, aube, zellige (`src/data/wallpapers.ts`). Uniquement géométrie, architecture et paysages.

Interface : police Inter, surfaces sombres teintées de vert-bleu, barre de navigation et mini-lecteur en verre dépoli sur mobile, tuiles de catégories avec icône et reflet de leur couleur. Les animations restent courtes et ne dépendent jamais du défilement : apparition des pages et des cartes, retour visuel à l'appui, barres « en cours de lecture », pochette qui se réduit quand la lecture est en pause, progression vers la prochaine prière. Elles sont toutes désactivées si le système demande de réduire les animations.

Pour régénérer les éléments après une modification du logo :

```bash
pip install pymupdf
python3 brand/generate.py
```
