import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { getAuth } from 'firebase/auth'
import type { Enigme, GuessListEntry, UserProfile } from '../types'
import { firebaseApp } from './firebase'
import { notifyDataChanged } from './storeEvents'

let db: Firestore | null = null
function getDb(): Firestore {
  if (!db) db = getFirestore(firebaseApp)
  return db
}

let enigmesCache: Enigme[] = []
let guessesCache: GuessListEntry[] = []
let enigmesMode: 'none' | 'home' | 'all' = 'none'
let enigmesCutoffIsoDay: string | null = null
let guessesMode: 'none' | 'user' | 'all' = 'none'
let guessesUserid: string | null = null
let unsubEnigmes: Unsubscribe | null = null
let unsubGuesses: Unsubscribe | null = null

export function startFirestoreSync(): void {
  // Démarrage standard : énigmes (mode home si configuré ailleurs) + guesses du joueur courant.
  const uid = getAuth(firebaseApp).currentUser?.uid
  if (!uid) return
  startFirestoreSyncUserGuesses(uid)
}

/** Page joueur : ne charge que les énigmes dont `date <= cutoffIsoDay` (YYYY-MM-DD). */
export function startFirestoreSyncHomeEnigmes(cutoffIsoDay: string): void {
  // Si l’admin a demandé toutes les énigmes, ne pas repasser en mode "home"
  // lors d’un refresh UI (sinon on perd les énigmes futures).
  if (enigmesMode === 'all') return
  const cutoff = cutoffIsoDay.trim()
  if (!cutoff) return
  if (enigmesMode === 'home' && enigmesCutoffIsoDay === cutoff) return

  if (unsubEnigmes) {
    unsubEnigmes()
    unsubEnigmes = null
  }

  enigmesMode = 'home'
  enigmesCutoffIsoDay = cutoff
  enigmesCache = []

  const d = getDb()
  unsubEnigmes = onSnapshot(
    query(collection(d, 'enigmes'), where('date', '<=', cutoff)),
    (snap) => {
      enigmesCache = snap.docs.map(enigmeFromDoc)
      notifyDataChanged()
    },
    (err) => {
      console.error('[Guess my name] Firestore énigmes home (onSnapshot):', err)
    },
  )
}

/**
 * Forcer le mode "home" même si une session admin avait activé `all`.
 * Utile pour le switch "voir comme non-admin" sur la home.
 */
export function forceFirestoreSyncHomeEnigmes(cutoffIsoDay: string): void {
  const cutoff = cutoffIsoDay.trim()
  if (!cutoff) return

  if (unsubEnigmes) {
    unsubEnigmes()
    unsubEnigmes = null
  }

  enigmesMode = 'home'
  enigmesCutoffIsoDay = cutoff
  enigmesCache = []

  const d = getDb()
  unsubEnigmes = onSnapshot(
    query(collection(d, 'enigmes'), where('date', '<=', cutoff)),
    (snap) => {
      enigmesCache = snap.docs.map(enigmeFromDoc)
      notifyDataChanged()
    },
    (err) => {
      console.error('[Guess my name] Firestore énigmes home (onSnapshot):', err)
    },
  )
}

/** Page admin : charge toutes les énigmes (y compris futures). */
export function startFirestoreSyncAllEnigmes(): void {
  if (enigmesMode === 'all') return

  if (unsubEnigmes) {
    unsubEnigmes()
    unsubEnigmes = null
  }

  enigmesMode = 'all'
  enigmesCutoffIsoDay = null
  enigmesCache = []

  const d = getDb()
  unsubEnigmes = onSnapshot(
    collection(d, 'enigmes'),
    (snap) => {
      enigmesCache = snap.docs.map(enigmeFromDoc)
      notifyDataChanged()
    },
    (err) => {
      console.error('[Guess my name] Firestore énigmes all (onSnapshot):', err)
    },
  )
}

/** Joueur : ne souscrit qu’aux guesses du `userid` courant. */
export function startFirestoreSyncUserGuesses(userid: string): void {
  // Si l’admin a demandé la synchro globale, ne pas repasser en mode "user"
  // (sinon la page admin perd ses données à chaque refresh UI).
  if (guessesMode === 'all') return
  const uid = userid.trim()
  if (!uid) return
  if (guessesMode === 'user' && guessesUserid === uid) return

  if (unsubGuesses) {
    unsubGuesses()
    unsubGuesses = null
  }

  guessesMode = 'user'
  guessesUserid = uid
  guessesCache = []

  const d = getDb()
  unsubGuesses = onSnapshot(
    query(collection(d, 'guesses'), where('userid', '==', uid)),
    (snap) => {
      guessesCache = snap.docs.map(guessFromDoc)
      notifyDataChanged()
    },
    (err) => {
      console.error('[Guess my name] Firestore guesses user (onSnapshot):', err)
    },
  )
}

/** Admin : souscrit à tous les guesses (à utiliser uniquement sur la page admin). */
export function startFirestoreSyncAllGuesses(): void {
  if (guessesMode === 'all') return

  if (unsubGuesses) {
    unsubGuesses()
    unsubGuesses = null
  }

  guessesMode = 'all'
  guessesUserid = null
  guessesCache = []

  const d = getDb()
  unsubGuesses = onSnapshot(
    collection(d, 'guesses'),
    (snap) => {
      guessesCache = snap.docs.map(guessFromDoc)
      notifyDataChanged()
    },
    (err) => {
      console.error('[Guess my name] Firestore guesses all (onSnapshot):', err)
    },
  )
}

/** Admin : recharge immédiate de tous les guesses (une fois). */
export async function pullAllGuessesOnceRemote(): Promise<void> {
  const d = getDb()
  const snap = await getDocs(collection(d, 'guesses'))
  guessesCache = snap.docs.map(guessFromDoc)
  notifyDataChanged()
}

/** Count agrégé (serveur) des guesses pour une énigme, sans charger la collection. */
export async function countGuessesForEnigmeRemote(
  enigmeid: string,
): Promise<number> {
  const id = enigmeid.trim()
  if (!id) return 0
  const d = getDb()
  const q = query(collection(d, 'guesses'), where('enigmeid', '==', id))
  const snap = await getCountFromServer(q)
  return snap.data().count
}

function enigmeFromDoc(d: QueryDocumentSnapshot<DocumentData>): Enigme {
  const raw = d.data()
  return {
    enigmeid: d.id,
    libelle: String(raw.libelle ?? ''),
    date: String(raw.date ?? ''),
    nomFichier: String(raw.nomFichier ?? ''),
    message: String(raw.message ?? ''),
    imageDataUrl:
      typeof raw.imageDataUrl === 'string' ? raw.imageDataUrl : undefined,
  }
}

function guessFromDoc(d: QueryDocumentSnapshot<DocumentData>): GuessListEntry {
  const raw = d.data()
  const userName =
    typeof raw.userName === 'string' ? raw.userName : undefined
  const updatedAtMs =
    typeof raw.updatedAtMs === 'number' ? raw.updatedAtMs : undefined
  return {
    guesslistid: d.id,
    userid: String(raw.userid ?? ''),
    weeknumber: Number(raw.weeknumber ?? 0),
    guess: String(raw.guess ?? ''),
    enigmeid: String(raw.enigmeid ?? ''),
    ...(updatedAtMs !== undefined ? { updatedAtMs } : {}),
    ...(userName !== undefined ? { userName } : {}),
  }
}

function enigmeToData(e: Enigme): Record<string, unknown> {
  const o: Record<string, unknown> = {
    libelle: e.libelle,
    date: e.date,
    nomFichier: e.nomFichier,
    message: e.message,
  }
  if (e.imageDataUrl) o.imageDataUrl = e.imageDataUrl
  return o
}

function guessToData(g: GuessListEntry): Record<string, unknown> {
  const o: Record<string, unknown> = {
    userid: g.userid,
    weeknumber: g.weeknumber,
    guess: g.guess,
    enigmeid: g.enigmeid,
  }
  if (g.userName) o.userName = g.userName
  if (typeof g.updatedAtMs === 'number') o.updatedAtMs = g.updatedAtMs
  return o
}

export function getEnigmesSnapshot(): Enigme[] {
  return [...enigmesCache]
}

export function getGuessesSnapshot(): GuessListEntry[] {
  return [...guessesCache]
}

export function findGuessInCache(
  userid: string,
  weeknumber: number,
  enigmeid: string,
): GuessListEntry | undefined {
  return guessesCache.find(
    (g) =>
      g.userid === userid &&
      g.weeknumber === weeknumber &&
      g.enigmeid === enigmeid,
  )
}

export async function saveEnigmesRemote(enigmes: Enigme[]): Promise<void> {
  const d = getDb()
  const newIds = new Set(enigmes.map((e) => e.enigmeid))
  const current = await getDocs(collection(d, 'enigmes'))
  const batch = writeBatch(d)
  for (const e of enigmes) {
    batch.set(doc(d, 'enigmes', e.enigmeid), enigmeToData(e), { merge: true })
  }
  current.forEach((docSnap) => {
    if (!newIds.has(docSnap.id)) {
      batch.delete(docSnap.ref)
    }
  })
  await batch.commit()
  notifyDataChanged()
}

export async function registerUserNameRemote(name: string): Promise<UserProfile> {
  const t = name.trim()
  const userid = getAuth(firebaseApp).currentUser?.uid
  if (!userid) throw new Error('Non connecté')
  const d = getDb()
  const ref = doc(d, 'users', userid)
  const row: UserProfile = { userid, name: t }
  await setDoc(ref, { name: t }, { merge: true })
  return row
}

export async function ensureUserProfileForNameRemote(
  name: string,
): Promise<void> {
  const t = name.trim()
  if (!t) return
  const uid = getAuth(firebaseApp).currentUser?.uid
  if (!uid) return
  const ref = doc(getDb(), 'users', uid)
  await setDoc(ref, { name: t }, { merge: true })
}

/** Met à jour uniquement le nom affiché. */
export async function updateUserDisplayNameRemote(
  name: string,
): Promise<UserProfile | null> {
  const t = name.trim()
  if (!t) return null
  const uid = getAuth(firebaseApp).currentUser?.uid
  if (!uid) return null
  const ref = doc(getDb(), 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  await setDoc(ref, { name: t }, { merge: true })
  notifyDataChanged()
  return { userid: uid, name: t }
}

/**
 * Autorisation admin côté client (contrôle supplémentaire).
 * Source : Firebase Auth + doc `admins/{auth.uid}.enabled === true`.
 */
export async function isCurrentUserAdminRemote(): Promise<boolean> {
  const authUid = getAuth(firebaseApp).currentUser?.uid
  if (authUid) {
    const adminSnap = await getDoc(doc(getDb(), 'admins', authUid))
    if (adminSnap.exists() && adminSnap.data()?.enabled === true) return true
  }

  return false
}

/** Mise à jour optimiste du cache + persistance Firestore (API synchrone côté store). */
export function upsertGuessFirestore(params: {
  weeknumber: number
  enigmeid: string
  guess: string
  userName?: string
}): GuessListEntry {
  const userid = getAuth(firebaseApp).currentUser?.uid
  if (!userid) throw new Error('Non connecté')
  const d = getDb()
  const trimmed = params.guess.trim()
  const now = Date.now()
  const existing = guessesCache.find(
    (g) =>
      g.userid === userid &&
      g.weeknumber === params.weeknumber &&
      g.enigmeid === params.enigmeid,
  )
  const guesslistid = existing?.guesslistid ?? crypto.randomUUID()
  const entry: GuessListEntry = {
    guesslistid,
    userid,
    weeknumber: params.weeknumber,
    enigmeid: params.enigmeid,
    guess: trimmed,
    updatedAtMs: now,
  }
  if (params.userName !== undefined) {
    const t = params.userName.trim()
    if (t) entry.userName = t
  } else if (existing?.userName) {
    entry.userName = existing.userName
  }
  const idx = guessesCache.findIndex(
    (g) =>
      g.userid === userid &&
      g.weeknumber === params.weeknumber &&
      g.enigmeid === params.enigmeid,
  )
  if (idx >= 0) {
    guessesCache[idx] = entry
  } else {
    guessesCache.push(entry)
  }
  notifyDataChanged()
  void setDoc(doc(d, 'guesses', guesslistid), guessToData(entry), {
    merge: true,
  }).catch((err) => console.error('[Firestore guesses]', err))
  return entry
}
