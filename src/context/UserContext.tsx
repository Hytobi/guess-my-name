import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { clearUserId } from '../lib/store'

const STORAGE_USER_NAME = 'guess-my-name:userName'

function readStoredName(): string | null {
  try {
    const v = localStorage.getItem(STORAGE_USER_NAME)
    return v?.trim() ? v.trim() : null
  } catch {
    return null
  }
}

type UserContextValue = {
  name: string | null
  setName: (name: string) => void
  clearName: () => void
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [name, setNameState] = useState<string | null>(() => readStoredName())

  useEffect(() => {
    setNameState(readStoredName())
  }, [])

  const setName = useCallback((next: string) => {
    const t = next.trim()
    if (!t) return
    try {
      localStorage.setItem(STORAGE_USER_NAME, t)
    } catch {
      throw new Error('Impossible d’écrire le stockage local')
    }
    setNameState(t)
  }, [])

  const clearName = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_USER_NAME)
    } catch {
      /* ignore */
    }
    clearUserId()
    setNameState(null)
  }, [])

  const value = useMemo(
    () => ({ name, setName, clearName }),
    [name, setName, clearName],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser doit être utilisé dans UserProvider')
  return ctx
}
