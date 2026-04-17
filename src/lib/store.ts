import type { Enigme, GuessListEntry, UserProfile } from '../types'

const KEY_USER_ID = 'guess-my-name:userid'
const KEY_USERS = 'guess-my-name:users'
const KEY_ENIGMES = 'guess-my-name:enigmes'
const KEY_GUESS_LIST = 'guess-my-name:guessList'
const KEY_ADMIN = 'guess-my-name:adminSession'

const DATA_EVENT = 'guess-my-name:data'

function notifyDataChanged(): void {
  window.dispatchEvent(new CustomEvent(DATA_EVENT))
}

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
    return list.filter(isUserProfileShape)
  } catch {
    return []
  }
}

function isUserProfileShape(x: unknown): x is UserProfile {
  if (!x || typeof x !== 'object') return false
  const o = x as Record<string, unknown>
  return (
    typeof o.userid === 'string' &&
    typeof o.name === 'string' &&
    typeof o.codeconnexion === 'string' &&
    /^\d{8}$/.test(o.codeconnexion)
  )
}

function saveUsers(users: UserProfile[]): void {
  localStorage.setItem(KEY_USERS, JSON.stringify(users))
}

function randomEightDigitCode(): string {
  let s = ''
  for (let i = 0; i < 8; i += 1) s += String(Math.floor(Math.random() * 10))
  return s
}

function pickUniqueConnectionCode(excludeForReuse: string | null): string {
  const users = loadUsers()
  const used = new Set(
    users
      .map((u) => u.codeconnexion)
      .filter((c) => c !== excludeForReuse),
  )
  for (let n = 0; n < 200; n += 1) {
    const c = randomEightDigitCode()
    if (!used.has(c)) return c
  }
  return `${Date.now()}`.slice(-8).padStart(8, '0')
}

/** Enregistre ou met à jour le profil pour cet appareil et régénère le code de connexion. */
export function registerUserName(name: string): UserProfile {
  const t = name.trim()
  const userid = getOrCreateUserId()
  const users = loadUsers()
  const idx = users.findIndex((u) => u.userid === userid)
  const previousCode = idx >= 0 ? users[idx].codeconnexion : null
  const code = pickUniqueConnectionCode(previousCode)
  const row: UserProfile = { userid, name: t, codeconnexion: code }
  if (idx >= 0) {
    const next = [...users]
    next[idx] = row
    saveUsers(next)
  } else {
    saveUsers([...users, row])
  }
  return row
}

/** Connexion par code : aligne le `userid` local sur le compte trouvé. */
export function loginWithConnectionCode(raw: string): UserProfile | null {
  const normalized = raw.replace(/\s+/g, '')
  if (!/^\d{8}$/.test(normalized)) return null
  const users = loadUsers()
  const u = users.find((x) => x.codeconnexion === normalized)
  if (!u) return null
  setUserId(u.userid)
  return u
}

/** Code de connexion du `userid` courant, s’il existe en base locale. */
export function getMyConnectionCode(): string | null {
  const uid = readUserId()
  if (!uid) return null
  return loadUsers().find((x) => x.userid === uid)?.codeconnexion ?? null
}

/** Assure un enregistrement `user` pour la session courante (migration anciennes données). */
export function ensureUserProfileForName(name: string): void {
  const t = name.trim()
  if (!t) return
  const uid = readUserId() ?? getOrCreateUserId()
  const users = loadUsers()
  if (users.some((u) => u.userid === uid)) return
  const code = pickUniqueConnectionCode(null)
  saveUsers([...users, { userid: uid, name: t, codeconnexion: code }])
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

export function upsertGuess(params: {
  userid: string
  weeknumber: number
  enigmeid: string
  guess: string
  /** Nom joueur courant ; mis à jour à chaque enregistrement si fourni */
  userName?: string
}): GuessListEntry {
  const all = loadGuessList()
  const idx = all.findIndex(
    (g) =>
      g.userid === params.userid &&
      g.weeknumber === params.weeknumber &&
      g.enigmeid === params.enigmeid,
  )
  const trimmed = params.guess.trim()

  if (idx >= 0) {
    const prev = all[idx]
    const updated: GuessListEntry = { ...prev, guess: trimmed }
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
  }
  if (params.userName !== undefined) {
    const t = params.userName.trim()
    if (t) created.userName = t
  }
  saveGuessList([...all, created])
  return created
}

export function isAdminSessionActive(): boolean {
  try {
    return sessionStorage.getItem(KEY_ADMIN) === '1'
  } catch {
    return false
  }
}

export function setAdminSessionActive(active: boolean): void {
  try {
    if (active) sessionStorage.setItem(KEY_ADMIN, '1')
    else sessionStorage.removeItem(KEY_ADMIN)
  } catch {
    /* ignore */
  }
}

export function checkAdminPassword(password: string): boolean {
  const expected =
    import.meta.env.VITE_ADMIN_PASSWORD?.toString() ?? 'dev-admin'
  return password === expected
}
