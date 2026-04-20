import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type Firestore,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import type { Enigme, GuessListEntry, UserProfile } from '../types'
import { firebaseApp } from './firebase'
import { getOrCreateUserId, readUserId, setUserId } from './storeLocal'
import { notifyDataChanged } from './storeEvents'

let db: Firestore | null = null
function getDb(): Firestore {
  if (!db) db = getFirestore(firebaseApp)
  return db
}

let enigmesCache: Enigme[] = []
let guessesCache: GuessListEntry[] = []
let started = false

export function startFirestoreSync(): void {
  if (started) return
  started = true
  const d = getDb()
  onSnapshot(collection(d, 'enigmes'), (snap) => {
    enigmesCache = snap.docs.map(enigmeFromDoc)
    notifyDataChanged()
  })
  onSnapshot(collection(d, 'guesses'), (snap) => {
    guessesCache = snap.docs.map(guessFromDoc)
    notifyDataChanged()
  })
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
  return {
    guesslistid: d.id,
    userid: String(raw.userid ?? ''),
    weeknumber: Number(raw.weeknumber ?? 0),
    guess: String(raw.guess ?? ''),
    enigmeid: String(raw.enigmeid ?? ''),
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

async function allUserCodes(): Promise<Set<string>> {
  const snap = await getDocs(collection(getDb(), 'users'))
  const used = new Set<string>()
  snap.forEach((d) => {
    const c = d.data().codeconnexion
    if (typeof c === 'string' && /^\d{8}$/.test(c)) used.add(c)
  })
  return used
}

function randomEightDigitCode(): string {
  let s = ''
  for (let i = 0; i < 8; i += 1) s += String(Math.floor(Math.random() * 10))
  return s
}

async function pickUniqueConnectionCode(
  excludeForReuse: string | null,
): Promise<string> {
  const used = await allUserCodes()
  if (excludeForReuse) used.delete(excludeForReuse)
  for (let n = 0; n < 200; n += 1) {
    const c = randomEightDigitCode()
    if (!used.has(c)) return c
  }
  return `${Date.now()}`.slice(-8).padStart(8, '0')
}

export async function registerUserNameRemote(name: string): Promise<UserProfile> {
  const t = name.trim()
  const userid = getOrCreateUserId()
  const d = getDb()
  const ref = doc(d, 'users', userid)
  const prevSnap = await getDoc(ref)
  const previousCode =
    prevSnap.exists() && typeof prevSnap.data().codeconnexion === 'string'
      ? (prevSnap.data().codeconnexion as string)
      : null
  const code = await pickUniqueConnectionCode(previousCode)
  const row: UserProfile = { userid, name: t, codeconnexion: code }
  await setDoc(ref, { name: t, codeconnexion: code }, { merge: true })
  return row
}

export async function loginWithConnectionCodeRemote(
  raw: string,
): Promise<UserProfile | null> {
  const normalized = raw.replace(/\s+/g, '')
  if (!/^\d{8}$/.test(normalized)) return null
  const d = getDb()
  const q = query(
    collection(d, 'users'),
    where('codeconnexion', '==', normalized),
    limit(1),
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  const ddoc = snap.docs[0]
  const userid = ddoc.id
  const data = ddoc.data()
  setUserId(userid)
  return {
    userid,
    name: String(data.name ?? ''),
    codeconnexion: String(data.codeconnexion ?? normalized),
  }
}

export async function getMyConnectionCodeRemote(): Promise<string | null> {
  const uid = readUserId()
  if (!uid) return null
  const snap = await getDoc(doc(getDb(), 'users', uid))
  if (!snap.exists()) return null
  const c = snap.data().codeconnexion
  return typeof c === 'string' && /^\d{8}$/.test(c) ? c : null
}

export async function ensureUserProfileForNameRemote(
  name: string,
): Promise<void> {
  const t = name.trim()
  if (!t) return
  const uid = readUserId() ?? getOrCreateUserId()
  const ref = doc(getDb(), 'users', uid)
  const snap = await getDoc(ref)
  if (snap.exists()) return
  const code = await pickUniqueConnectionCode(null)
  await setDoc(ref, { name: t, codeconnexion: code }, { merge: true })
}

/** Met à jour uniquement le nom ; ne modifie pas `codeconnexion`. */
export async function updateUserDisplayNameRemote(
  name: string,
): Promise<UserProfile | null> {
  const t = name.trim()
  if (!t) return null
  const uid = readUserId()
  if (!uid) return null
  const ref = doc(getDb(), 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data = snap.data()
  const codeRaw = data.codeconnexion
  if (typeof codeRaw !== 'string' || !/^\d{8}$/.test(codeRaw)) return null
  await setDoc(ref, { name: t }, { merge: true })
  notifyDataChanged()
  return { userid: uid, name: t, codeconnexion: codeRaw }
}

/**
 * Autorisation admin côté client (contrôle supplémentaire).
 * On considère admin uniquement si `users/{userid}.isAdmin === true`.
 * Champ absent => false (comportement demandé pour les comptes existants).
 */
export async function isCurrentUserAdminRemote(): Promise<boolean> {
  const uid = readUserId()
  if (!uid) return false
  const snap = await getDoc(doc(getDb(), 'users', uid))
  if (!snap.exists()) return false
  return snap.data()?.isAdmin === true
}

/** Mise à jour optimiste du cache + persistance Firestore (API synchrone côté store). */
export function upsertGuessFirestore(params: {
  userid: string
  weeknumber: number
  enigmeid: string
  guess: string
  userName?: string
}): GuessListEntry {
  const d = getDb()
  const trimmed = params.guess.trim()
  const existing = guessesCache.find(
    (g) =>
      g.userid === params.userid &&
      g.weeknumber === params.weeknumber &&
      g.enigmeid === params.enigmeid,
  )
  const guesslistid = existing?.guesslistid ?? crypto.randomUUID()
  const entry: GuessListEntry = {
    guesslistid,
    userid: params.userid,
    weeknumber: params.weeknumber,
    enigmeid: params.enigmeid,
    guess: trimmed,
  }
  if (params.userName !== undefined) {
    const t = params.userName.trim()
    if (t) entry.userName = t
  } else if (existing?.userName) {
    entry.userName = existing.userName
  }
  const idx = guessesCache.findIndex(
    (g) =>
      g.userid === params.userid &&
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
