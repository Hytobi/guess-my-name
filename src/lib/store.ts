import type { Enigme, GuessListEntry, UserProfile } from '../types'
import { useFirebaseBackend } from './dataMode'
import {
  ensureUserProfileForNameRemote,
  findGuessInCache,
  getEnigmesSnapshot,
  getGuessesSnapshot,
  getMyConnectionCodeRemote,
  isCurrentUserAdminRemote,
  loginWithConnectionCodeRemote,
  registerUserNameRemote,
  saveEnigmesRemote,
  startFirestoreSync,
  updateUserDisplayNameRemote,
  upsertGuessFirestore,
} from './storeFirebase'
import * as L from './storeLocal'

function ensureRemote(): void {
  if (useFirebaseBackend()) startFirestoreSync()
}

export {
  readUserId,
  setUserId,
  clearUserId,
  getOrCreateUserId,
} from './storeLocal'

export function loadEnigmes(): Enigme[] {
  ensureRemote()
  return useFirebaseBackend() ? getEnigmesSnapshot() : L.loadEnigmes()
}

export async function saveEnigmes(enigmes: Enigme[]): Promise<void> {
  if (useFirebaseBackend()) {
    ensureRemote()
    await saveEnigmesRemote(enigmes)
    return
  }
  L.saveEnigmes(enigmes)
}

export function loadGuessList(): GuessListEntry[] {
  ensureRemote()
  return useFirebaseBackend() ? getGuessesSnapshot() : L.loadGuessList()
}

/** Utilisateurs distincts ayant une proposition non vide pour cette énigme (toutes semaines confondues). */
export function countUsersWhoPlayedEnigme(enigmeid: string): number {
  const seen = new Set<string>()
  for (const g of loadGuessList()) {
    if (g.enigmeid === enigmeid && g.guess.trim() !== '') {
      seen.add(g.userid)
    }
  }
  return seen.size
}

export function findGuess(
  userid: string,
  weeknumber: number,
  enigmeid: string,
): GuessListEntry | undefined {
  ensureRemote()
  return useFirebaseBackend()
    ? findGuessInCache(userid, weeknumber, enigmeid)
    : L.findGuess(userid, weeknumber, enigmeid)
}

export function upsertGuess(params: {
  userid: string
  weeknumber: number
  enigmeid: string
  guess: string
  userName?: string
}): GuessListEntry {
  ensureRemote()
  return useFirebaseBackend()
    ? upsertGuessFirestore(params)
    : L.upsertGuess(params)
}

export async function registerUserName(name: string): Promise<UserProfile> {
  if (useFirebaseBackend()) {
    ensureRemote()
    return registerUserNameRemote(name)
  }
  return Promise.resolve(L.registerUserName(name))
}

export async function loginWithConnectionCode(
  raw: string,
): Promise<UserProfile | null> {
  if (useFirebaseBackend()) {
    ensureRemote()
    return loginWithConnectionCodeRemote(raw)
  }
  return Promise.resolve(L.loginWithConnectionCode(raw))
}

export async function getMyConnectionCode(): Promise<string | null> {
  if (useFirebaseBackend()) {
    ensureRemote()
    return getMyConnectionCodeRemote()
  }
  return Promise.resolve(L.getMyConnectionCode())
}

export async function ensureUserProfileForName(name: string): Promise<void> {
  if (useFirebaseBackend()) {
    ensureRemote()
    await ensureUserProfileForNameRemote(name)
    return
  }
  L.ensureUserProfileForName(name)
}

/** Met à jour le pseudo affiché sans changer le code à 8 chiffres. */
export async function updateUserDisplayName(
  name: string,
): Promise<UserProfile | null> {
  if (useFirebaseBackend()) {
    ensureRemote()
    return updateUserDisplayNameRemote(name)
  }
  return Promise.resolve(L.updateUserDisplayName(name))
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  if (!useFirebaseBackend()) return false
  ensureRemote()
  return isCurrentUserAdminRemote()
}

export function isAdminSessionActive(): boolean {
  return L.isAdminSessionActive()
}

export function setAdminSessionActive(active: boolean): void {
  L.setAdminSessionActive(active)
}

export function checkAdminPassword(password: string): boolean {
  return L.checkAdminPassword(password)
}
