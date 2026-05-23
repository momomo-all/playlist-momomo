import { useState } from 'react';
import MainPage from './pages/MainPage';
import GenrePage from './pages/GenrePage';
import PlaylistPage from './pages/PlaylistPage';
import TrackViewPage from './pages/TrackViewPage';
import VinylPage from './pages/VinylPage';
import { Genre, Pairing, Track } from './lib/types';

type View =
  | { screen: 'main' }
  | { screen: 'genre'; genre: Genre }
  | { screen: 'playlist'; pairing: Pairing; genre: Genre }
  | { screen: 'trackView'; pairing: Pairing; genre: Genre; tracks: Track[]; trackIndex: number; resolvedCover: string }
  | { screen: 'vinyl'; pairing: Pairing; genre: Genre; track?: Track; resolvedCover: string; fromTrackView?: { tracks: Track[]; trackIndex: number } };

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
        onOpenTrack={(pairing, tracks, trackIndex, resolvedCover) =>
          setView({ screen: 'trackView', pairing, genre: view.genre, tracks, trackIndex, resolvedCover })
        }
      />
    );
  }

  if (view.screen === 'trackView') {
    return (
      <TrackViewPage
        pairing={view.pairing}
        tracks={view.tracks}
        initialTrackIndex={view.trackIndex}
        resolvedPairingCover={view.resolvedCover}
        onBack={() => setView({ screen: 'playlist', pairing: view.pairing, genre: view.genre })}
        onOpenVinyl={() =>
          setView({
            screen: 'vinyl',
            pairing: view.pairing,
            genre: view.genre,
            track: view.tracks[view.trackIndex],
            resolvedCover: view.resolvedCover,
            fromTrackView: { tracks: view.tracks, trackIndex: view.trackIndex },
          })
        }
      />
    );
  }

  if (view.screen === 'vinyl') {
    return (
      <VinylPage
        pairing={view.pairing}
        track={view.track}
        resolvedCover={view.resolvedCover}
        onBack={() => {
          if (view.fromTrackView) {
            setView({
              screen: 'trackView',
              pairing: view.pairing,
              genre: view.genre,
              tracks: view.fromTrackView.tracks,
              trackIndex: view.fromTrackView.trackIndex,
              resolvedCover: view.resolvedCover,
            });
          } else {
            setView({ screen: 'playlist', pairing: view.pairing, genre: view.genre });
          }
        }}
      />
    );
  }

  return null;
}
