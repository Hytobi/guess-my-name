import type { Enigme, GuessListEntry, UserProfile } from '../types'
import { notifyDataChanged } from './storeEvents'

const KEY_USER_ID = 'guess-my-name:userid'
const KEY_USERS = 'guess-my-name:users'
const KEY_ENIGMES = 'guess-my-name:enigmes'
const KEY_GUESS_LIST = 'guess-my-name:guessList'

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (raw == null || raw === '') return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function readUserId(): string | null {
  try {
    const id = localStorage.getItem(KEY_USER_ID)?.trim()
    return id || null
  } catch {
    return null
  }
}

export function setUserId(userid: string): void {
  try {
    localStorage.setItem(KEY_USER_ID, userid.trim())
  } catch {
    /* ignore */
  }
}

export function clearUserId(): void {
  try {
    localStorage.removeItem(KEY_USER_ID)
  } catch {
    /* ignore */
  }
}

export function getOrCreateUserId(): string {
  const existing = readUserId()
  if (existing) return existing
  const id = crypto.randomUUID()
  try {
    localStorage.setItem(KEY_USER_ID, id)
  } catch {
    return `local-${Math.random().toString(36).slice(2)}`
  }
  return id
}

function loadUsers(): UserProfile[] {
  try {
    const list = safeParseJson<unknown>(localStorage.getItem(KEY_USERS), [])
    if (!Array.isArray(list)) return []
    // Migration soft: anciens profils pouvaient contenir `codeconnexion` (ignoré).
    return list
      .map((x) => {
        if (!x || typeof x !== 'object') return null
        const o = x as Record<string, unknown>
        const userid = typeof o.userid === 'string' ? o.userid : ''
        const name = typeof o.name === 'string' ? o.name : ''
        if (!userid || !name) return null
        return { userid, name } satisfies UserProfile
      })
      .filter((x): x is UserProfile => x != null)
  } catch {
    return []
  }
}

function saveUsers(users: UserProfile[]): void {
  localStorage.setItem(KEY_USERS, JSON.stringify(users))
}

export function registerUserName(name: string): UserProfile {
  const t = name.trim()
  const userid = getOrCreateUserId()
  const users = loadUsers()
  const idx = users.findIndex((u) => u.userid === userid)
  const row: UserProfile = { userid, name: t }
  if (idx >= 0) {
    const next = [...users]
    next[idx] = row
    saveUsers(next)
  } else {
    saveUsers([...users, row])
  }
  return row
}

/** Met à jour uniquement le nom affiché. */
export function updateUserDisplayName(name: string): UserProfile | null {
  const t = name.trim()
  if (!t) return null
  const uid = readUserId()
  if (!uid) return null
  const users = loadUsers()
  const idx = users.findIndex((u) => u.userid === uid)
  if (idx < 0) return null
  const prev = users[idx]
  const row: UserProfile = { ...prev, name: t }
  const next = [...users]
  next[idx] = row
  saveUsers(next)
  notifyDataChanged()
  return row
}

export function ensureUserProfileForName(name: string): void {
  const t = name.trim()
  if (!t) return
  const uid = readUserId() ?? getOrCreateUserId()
  const users = loadUsers()
  if (users.some((u) => u.userid === uid)) return
  saveUsers([...users, { userid: uid, name: t }])
}

export function loadEnigmes(): Enigme[] {
  try {
    const list = safeParseJson<unknown>(localStorage.getItem(KEY_ENIGMES), [])
    if (!Array.isArray(list)) return []
    return list.filter(isEnigmeShape)
  } catch {
    return []
  }
}

function isEnigmeShape(x: unknown): x is Enigme {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.enigmeid === 'string' &&
    typeof o.libelle === 'string' &&
    typeof o.date === 'string' &&
    typeof o.nomFichier === 'string' &&
    typeof o.message === 'string'
  )
}

export function saveEnigmes(enigmes: Enigme[]): void {
  localStorage.setItem(KEY_ENIGMES, JSON.stringify(enigmes))
  notifyDataChanged()
}

export function loadGuessList(): GuessListEntry[] {
  try {
    const list = safeParseJson<unknown>(localStorage.getItem(KEY_GUESS_LIST), [])
    if (!Array.isArray(list)) return []
    return list.filter(isGuessShape)
  } catch {
    return []
  }
}

function isGuessShape(x: unknown): x is GuessListEntry {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  if (
    typeof o.guesslistid !== 'string' ||
    typeof o.userid !== 'string' ||
    typeof o.weeknumber !== 'number' ||
    typeof o.guess !== 'string' ||
    typeof o.enigmeid !== 'string'
  ) {
    return false
  }
  if (o.updatedAtMs !== undefined && typeof o.updatedAtMs !== 'number')
    return false
  if (o.userName !== undefined && typeof o.userName !== 'string') return false
  return true
}

function saveGuessList(entries: GuessListEntry[]): void {
  localStorage.setItem(KEY_GUESS_LIST, JSON.stringify(entries))
  notifyDataChanged()
}

export function findGuess(
  userid: string,
  weeknumber: number,
  enigmeid: string,
): GuessListEntry | undefined {
  return loadGuessList().find(
    (g) =>
      g.userid === userid &&
      g.weeknumber === weeknumber &&
      g.enigmeid === enigmeid,
  )
}

export function findUserGuessForEnigme(
  userid: string,
  enigmeid: string,
): GuessListEntry | undefined {
  const uid = userid.trim()
  const eid = enigmeid.trim()
  if (!uid || !eid) return undefined
  const matches = loadGuessList().filter(
    (g) => g.userid === uid && g.enigmeid === eid,
  )
  if (matches.length === 0) return undefined
  return matches.reduce((best, g) => {
    const bestTs = best.updatedAtMs ?? 0
    const gTs = g.updatedAtMs ?? 0
    if (gTs !== bestTs) return gTs > bestTs ? g : best
    return g.weeknumber >= best.weeknumber ? g : best
  })
}

export function upsertGuess(params: {
  userid: string
  weeknumber: number
  enigmeid: string
  guess: string
  userName?: string
}): GuessListEntry {
  const all = loadGuessList()
  const existing = findUserGuessForEnigme(params.userid, params.enigmeid)
  const idx = existing
    ? all.findIndex((g) => g.guesslistid === existing.guesslistid)
    : -1
  const trimmed = params.guess.trim()
  const now = Date.now()

  if (idx >= 0) {
    const prev = all[idx]
    const updated: GuessListEntry = {
      ...prev,
      guess: trimmed,
      weeknumber: params.weeknumber,
      updatedAtMs: now,
    }
    if (params.userName !== undefined) {
      const t = params.userName.trim()
      updated.userName = t || undefined
    }
    const next = [...all]
    next[idx] = updated
    saveGuessList(next)
    return updated
  }
  const created: GuessListEntry = {
    guesslistid: crypto.randomUUID(),
    userid: params.userid,
    weeknumber: params.weeknumber,
    enigmeid: params.enigmeid,
    guess: trimmed,
    updatedAtMs: now,
  }
  if (params.userName !== undefined) {
    const t = params.userName.trim()
    if (t) created.userName = t
  }
  saveGuessList([...all, created])
  return created
}

export function checkAdminPassword(password: string): boolean {
  const expected =
    import.meta.env.VITE_ADMIN_PASSWORD?.toString() ?? 'dev-admin'
  return password === expected
}
