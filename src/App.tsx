import { useState } from 'react';
import MainPage from './pages/MainPage';
import GenrePage from './pages/GenrePage';
import PlaylistPage from './pages/PlaylistPage';
import VinylPage from './pages/VinylPage';
import { Genre, Pairing } from './lib/types';

type View =
  | { screen: 'main' }
  | { screen: 'genre'; genre: Genre }
  | { screen: 'playlist'; pairing: Pairing; genre: Genre }
  | { screen: 'vinyl'; pairing: Pairing; genre: Genre; resolvedCover: string };

export default function App() {
  const [view, setView] = useState<View>({ screen: 'main' });

  if (view.screen === 'main') {
    return (
      <MainPage
        onSelectGenre={genre => setView({ screen: 'genre', genre })}
      />
    );
  }

  if (view.screen === 'genre') {
    return (
      <GenrePage
        genre={view.genre}
        onBack={() => setView({ screen: 'main' })}
        onSelectPairing={pairing => setView({ screen: 'playlist', pairing, genre: view.genre })}
      />
    );
  }

  if (view.screen === 'playlist') {
    return (
      <PlaylistPage
        pairing={view.pairing}
        genre={view.genre}
        onBack={() => setView({ screen: 'genre', genre: view.genre })}
        onUpdated={pairing => setView({ screen: 'playlist', pairing, genre: view.genre })}
        onOpenVinyl={(pairing, resolvedCover) =>
          setView({ screen: 'vinyl', pairing, genre: view.genre, resolvedCover })
        }
      />
    );
  }

  if (view.screen === 'vinyl') {
    return (
      <VinylPage
        pairing={view.pairing}
        resolvedCover={view.resolvedCover}
        onBack={() =>
          setView({ screen: 'playlist', pairing: view.pairing, genre: view.genre })
        }
      />
    );
  }

  return null;
}
