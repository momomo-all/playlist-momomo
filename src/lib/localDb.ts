import { Genre, Pairing, Track } from './types';

const DB_NAME = 'dream_pairing_archive';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('genres')) {
        db.createObjectStore('genres', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('pairings')) {
        const store = db.createObjectStore('pairings', { keyPath: 'id' });
        store.createIndex('genre_id', 'genre_id');
      }
      if (!db.objectStoreNames.contains('tracks')) {
        const store = db.createObjectStore('tracks', { keyPath: 'id' });
        store.createIndex('pairing_id', 'pairing_id');
      }
      if (!db.objectStoreNames.contains('covers')) {
        db.createObjectStore('covers', { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid(): string {
  return crypto.randomUUID();
}

function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(db => new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

// ─── Genres ────────────────────────────────────────────

export async function getGenres(): Promise<Genre[]> {
  const all = await tx<Genre[]>('genres', 'readonly', s => s.getAll());
  return all.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function addGenre(name: string): Promise<Genre> {
  const genre: Genre = {
    id: uid(),
    user_id: 'local',
    name: name.trim(),
    cover_url: '',
    created_at: new Date().toISOString(),
  };
  await tx('genres', 'readwrite', s => s.add(genre));
  return genre;
}

export async function updateGenre(genre: Genre): Promise<void> {
  await tx('genres', 'readwrite', s => s.put(genre));
}

export async function deleteGenre(id: string): Promise<void> {
  // also delete related pairings and their tracks
  const pairings = await getPairingsByGenre(id);
  for (const p of pairings) {
    await deletePairing(p.id);
  }
  await tx('genres', 'readwrite', s => s.delete(id));
}

export async function getGenrePairingCount(genreId: string): Promise<number> {
  const pairings = await getPairingsByGenre(genreId);
  return pairings.length;
}

// ─── Pairings ──────────────────────────────────────────

export async function getPairingsByGenre(genreId: string): Promise<Pairing[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pairings', 'readonly');
    const store = transaction.objectStore('pairings');
    const index = store.index('genre_id');
    const req = index.getAll(genreId);
    req.onsuccess = () => {
      const results = (req.result as Pairing[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getPairing(id: string): Promise<Pairing | undefined> {
  return tx<Pairing | undefined>('pairings', 'readonly', s => s.get(id));
}

export async function addPairing(data: Omit<Pairing, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<Pairing> {
  const pairing: Pairing = {
    id: uid(),
    user_id: 'local',
    ...data,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  await tx('pairings', 'readwrite', s => s.add(pairing));
  return pairing;
}

export async function updatePairing(pairing: Pairing): Promise<void> {
  pairing.updated_at = new Date().toISOString();
  await tx('pairings', 'readwrite', s => s.put(pairing));
}

export async function deletePairing(id: string): Promise<void> {
  const tracks = await getTracksByPairing(id);
  for (const t of tracks) {
    await deleteTrack(t.id);
  }
  await tx('pairings', 'readwrite', s => s.delete(id));
}

export async function getFavoriteGenreIds(): Promise<Set<string>> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('pairings', 'readonly');
    const store = transaction.objectStore('pairings');
    const req = store.getAll();
    req.onsuccess = () => {
      const favs = (req.result as Pairing[]).filter(p => p.is_favorite).map(p => p.genre_id);
      resolve(new Set(favs));
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Tracks ────────────────────────────────────────────

export async function getTracksByPairing(pairingId: string): Promise<Track[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('tracks', 'readonly');
    const store = transaction.objectStore('tracks');
    const index = store.index('pairing_id');
    const req = index.getAll(pairingId);
    req.onsuccess = () => {
      resolve((req.result as Track[]).sort((a, b) => a.order_index - b.order_index));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function addTrack(data: Omit<Track, 'id' | 'user_id' | 'created_at'>): Promise<Track> {
  const track: Track = {
    lyrics: '',
    cover_id: '',
    id: uid(),
    user_id: 'local',
    ...data,
    created_at: new Date().toISOString(),
  };
  await tx('tracks', 'readwrite', s => s.add(track));
  return track;
}

export async function updateTrack(track: Track): Promise<void> {
  await tx('tracks', 'readwrite', s => s.put(track));
}

export async function deleteTrack(id: string): Promise<void> {
  await tx('tracks', 'readwrite', s => s.delete(id));
}

// ─── Cover Images (stored as blobs in IDB) ─────────────

export async function saveCover(id: string, blob: Blob): Promise<string> {
  await tx('covers', 'readwrite', s => s.put({ id, blob }));
  return `local-cover://${id}`;
}

export async function getCoverBlob(id: string): Promise<Blob | null> {
  const record = await tx<{ id: string; blob: Blob } | undefined>('covers', 'readonly', s => s.get(id));
  return record?.blob ?? null;
}

export async function deleteCover(id: string): Promise<void> {
  await tx('covers', 'readwrite', s => s.delete(id));
}

// ─── Vinyl Data (localStorage) ─────────────────────────

export interface ElementTransform {
  x: number;        // % offset from default center
  y: number;
  scale: number;    // 1.0 = default
  rotate: number;   // degrees
}

export interface LabelStyle {
  text: string;
  fontSize: number;
  fontFamily: string;
  textAlign: string;
  color: string;
}

export interface XY { x: number; y: number; }

export interface VinylData {
  title: string;
  note: string;
  jacketCoverId: string;
  diskCoverId: string;
  // pattern engine
  patternTheme: string;
  gradientColors: string[];
  // legacy label fields (still used in non-edit display)
  labelText: string;
  labelFontSize: number;
  labelTextAlign: string;
  // free layout
  jacketTransform: ElementTransform;
  diskTransform: ElementTransform;
  labelStyle: LabelStyle;
  // background
  bgCoverId: string;
  bgBlur: number;
  bgOpacity: number;
  // free-floating text positions (vw/vh percentages stored as px at time of save)
  nowPlayingPos: XY | null;
  titlePos: XY | null;
  notePos: XY | null;
}

function vinylKey(pairingId: string) { return `vinyl_data_${pairingId}`; }

const DEFAULT_TRANSFORM: ElementTransform = { x: 0, y: 0, scale: 1, rotate: 0 };
const DEFAULT_LABEL: LabelStyle = {
  text: '', fontSize: 13, fontFamily: 'sans-serif', textAlign: 'center', color: '#ffffff',
};

const DEFAULT_VINYL: VinylData = {
  title: '', note: '', jacketCoverId: '', diskCoverId: '',
  patternTheme: 'radial', gradientColors: ['#1a1a2e', '#0f3460', '#16213e'],
  labelText: '', labelFontSize: 13, labelTextAlign: 'center',
  jacketTransform: { ...DEFAULT_TRANSFORM },
  diskTransform: { ...DEFAULT_TRANSFORM },
  labelStyle: { ...DEFAULT_LABEL },
  bgCoverId: '', bgBlur: 90, bgOpacity: 88,
  nowPlayingPos: null, titlePos: null, notePos: null,
};

export { DEFAULT_TRANSFORM, DEFAULT_LABEL };

export function getVinylData(pairingId: string): VinylData {
  try {
    const raw = localStorage.getItem(vinylKey(pairingId));
    if (raw) return { ...DEFAULT_VINYL, ...JSON.parse(raw) as VinylData };
  } catch { /* ignore */ }
  return { ...DEFAULT_VINYL };
}

export function saveVinylData(pairingId: string, data: VinylData): void {
  localStorage.setItem(vinylKey(pairingId), JSON.stringify(data));
}

// Legacy aliases kept for backward compat
export function getVinylNote(pairingId: string): string {
  return getVinylData(pairingId).note;
}

export function saveVinylNote(pairingId: string, text: string): void {
  const existing = getVinylData(pairingId);
  saveVinylData(pairingId, { ...existing, note: text });
}

// ─── Cover URL cache ────────────────────────────────────

const coverCache = new Map<string, string>();

export async function resolveCoverUrl(url: string): Promise<string> {
  if (!url.startsWith('local-cover://')) return url;
  const id = url.replace('local-cover://', '');
  if (coverCache.has(id)) return coverCache.get(id)!;
  const blob = await getCoverBlob(id);
  if (!blob) return '';
  const objUrl = URL.createObjectURL(blob);
  coverCache.set(id, objUrl);
  return objUrl;
}
