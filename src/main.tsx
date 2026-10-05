import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AccountPage } from './pages/Account';
import { ClipPage } from './pages/ClipPage';
import { EpisodePage } from './pages/EpisodePage';
import { FriendsPage, ProfilePage } from './pages/Friends';
import { Home } from './pages/Home';
import { LibraryPage } from './pages/Library';
import { PodcastPage } from './pages/PodcastPage';
import { QueuePage } from './pages/Queue';
import { SearchPage } from './pages/Search';
import { StatsPage } from './pages/Stats';
import { StudioPage, StudioPodcastPage } from './pages/Studio';
import { QuranHome, ReciterPage, SurahPage } from './pages/Quran';
import { PrayerPage } from './pages/Prayer';
import { IslamPage, ModerationPage } from './pages/Islam';
import { PlaylistPage } from './components/Playlists';
import { PremiumPage } from './pages/Premium';
import { AdminPage } from './pages/Admin';
import { WallpapersPage } from './pages/Wallpapers';
import { InstallPage } from './pages/Install';
import { QuranReadHome, QuranReadSurah } from './pages/QuranRead';
import { RamadanPage } from './pages/Ramadan';
import { QiblaPage } from './pages/Qibla';
import { QuranSearchPage } from './pages/QuranSearch';
import { ModerationProvider } from './store/moderation';
import { PremiumProvider } from './store/premium';
import { CustomImagesProvider } from './store/customImages';
import { LocalFilesProvider } from './store/localFiles';
import { LocalFilesPage } from './pages/LocalFiles';
import { AuthProvider } from './store/auth';
import { DownloadsProvider } from './store/downloads';
import { LibraryProvider } from './store/library';
import { PlayerProvider } from './store/player';
import './styles.css';
// Capte la proposition d'installation (PWA) dès le chargement.
import './lib/install';

// Service worker : fonctionnement hors-ligne et épisodes téléchargés (build de production uniquement).
// Lien à partager podsal.com/telecharger : on ouvre la page d'installation de l'appli.
if (/^\/telecharger\/?$/.test(location.pathname)) history.replaceState(null, '', '/#/telecharger');

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LibraryProvider>
      <AuthProvider>
        <ModerationProvider>
          <PremiumProvider>
            <CustomImagesProvider>
              <LocalFilesProvider>
                <DownloadsProvider>
                  <PlayerProvider>
                    {/* HashRouter : fonctionne sur n'importe quel hébergement statique et dans l'application native. */}
                    <HashRouter>
                      <Routes>
                        <Route element={<Layout />}>
                          <Route index element={<Home />} />
                          <Route path="search" element={<SearchPage />} />
                          <Route path="library" element={<LibraryPage />} />
                          <Route path="queue" element={<QueuePage />} />
                          <Route path="genre/:id" element={<Navigate to="/islam" replace />} />
                          <Route path="podcast/:id" element={<PodcastPage />} />
                          <Route path="podcast/:podcastId/episode/:episodeId" element={<EpisodePage />} />
                          <Route path="clip" element={<ClipPage />} />
                          <Route path="stats" element={<StatsPage />} />
                          <Route path="import" element={<Navigate to="/islam" replace />} />
                          <Route path="friends" element={<FriendsPage />} />
                          <Route path="u/:username" element={<ProfilePage />} />
                          <Route path="u/:username/playlist/:playlistId" element={<ProfilePage />} />
                          <Route path="playlist/:id" element={<PlaylistPage />} />
                          <Route path="coran" element={<QuranHome />} />
                          <Route path="coran/:reciterId" element={<ReciterPage />} />
                          <Route path="coran/:reciterId/:surah" element={<SurahPage />} />
                          <Route path="lire" element={<QuranReadHome />} />
                          <Route path="lire/recherche" element={<QuranSearchPage />} />
                          <Route path="lire/:surah" element={<QuranReadSurah />} />
                          <Route path="priere" element={<PrayerPage />} />
                          <Route path="ramadan" element={<RamadanPage />} />
                          <Route path="qibla" element={<QiblaPage />} />
                          <Route path="islam" element={<IslamPage />} />
                          <Route path="moderation" element={<ModerationPage />} />
                      <Route path="admin" element={<AdminPage />} />
                          <Route path="account" element={<AccountPage />} />
                          <Route path="premium" element={<PremiumPage />} />
                          <Route path="fonds-ecran" element={<WallpapersPage />} />
                          <Route path="telecharger" element={<InstallPage />} />
                        <Route path="fichiers" element={<LocalFilesPage />} />
                          <Route path="studio" element={<StudioPage />} />
                          <Route path="studio/:id" element={<StudioPodcastPage />} />
                          <Route path="*" element={<Home />} />
                        </Route>
                      </Routes>
                    </HashRouter>
                  </PlayerProvider>
                </DownloadsProvider>
              </LocalFilesProvider>
            </CustomImagesProvider>
          </PremiumProvider>
        </ModerationProvider>
      </AuthProvider>
    </LibraryProvider>
  </StrictMode>,
);
