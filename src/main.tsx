import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { GenrePage } from './pages/Genre';
import { Home } from './pages/Home';
import { LibraryPage } from './pages/Library';
import { PodcastPage } from './pages/PodcastPage';
import { QueuePage } from './pages/Queue';
import { SearchPage } from './pages/Search';
import { LibraryProvider } from './store/library';
import { PlayerProvider } from './store/player';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LibraryProvider>
      <PlayerProvider>
        {/* HashRouter : fonctionne sur n'importe quel hébergement statique. */}
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="queue" element={<QueuePage />} />
              <Route path="genre/:id" element={<GenrePage />} />
              <Route path="podcast/:id" element={<PodcastPage />} />
              <Route path="*" element={<Home />} />
            </Route>
          </Routes>
        </HashRouter>
      </PlayerProvider>
    </LibraryProvider>
  </StrictMode>,
);
