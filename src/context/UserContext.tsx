import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { doc, onSnapshot, setDoc, getFirestore } from 'firebase/firestore'
import { firebaseApp, getFirebaseAuth } from '../lib/firebase'
import { useFirebaseBackend } from '../lib/dataMode'

type UserContextValue = {
  name: string | null
  user: FirebaseUser | null
  /** Connexion email/mot de passe */
  signIn: (email: string, password: string) => Promise<void>
  /** Création de compte email/mot de passe */
  signUp: (email: string, password: string) => Promise<void>
  /** Met à jour le nom affiché (stocké dans Firestore sur `users/{uid}`) */
  setName: (name: string) => Promise<void>
  /** Déconnexion Firebase */
  signOut: () => Promise<void>
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [name, setNameState] = useState<string | null>(null)

  useEffect(() => {
    if (!useFirebaseBackend()) {
      setUser(null)
      setNameState(null)
      return
    }
    const auth = getFirebaseAuth()
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u)
    })
    return () => {
      unsubAuth()
    }
  }, [])

  useEffect(() => {
    if (!useFirebaseBackend()) return
    if (!user) {
      setNameState(null)
      return
    }
    const db = getFirestore(firebaseApp)
    const ref = doc(db, 'users', user.uid)
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setNameState(null)
          return
        }
        const raw = snap.data()
        const n = typeof raw?.name === 'string' ? raw.name.trim() : ''
        setNameState(n ? n : null)
      },
      () => {
        // si l'écoute échoue (permissions), ne pas bloquer l'UI
        setNameState(null)
      },
    )
    return () => {
      unsub()
    }
  }, [user])

  const signInFn = useCallback(async (email: string, password: string) => {
    if (!useFirebaseBackend()) throw new Error('Firebase non configuré')
    const e = email.trim()
    if (!e) throw new Error('Email requis')
    await signInWithEmailAndPassword(getFirebaseAuth(), e, password)
  }, [])

  const signUpFn = useCallback(async (email: string, password: string) => {
    if (!useFirebaseBackend()) throw new Error('Firebase non configuré')
    const e = email.trim()
    if (!e) throw new Error('Email requis')
    await createUserWithEmailAndPassword(getFirebaseAuth(), e, password)
  }, [])

  const setNameFn = useCallback(
    async (next: string) => {
      if (!useFirebaseBackend()) throw new Error('Firebase non configuré')
      const t = next.trim()
      if (!t) throw new Error('Nom requis')
      if (t.length > 120) throw new Error('Nom trop long')
      const u = getFirebaseAuth().currentUser
      if (!u) throw new Error('Non connecté')
      const db = getFirestore(firebaseApp)
      await setDoc(doc(db, 'users', u.uid), { name: t }, { merge: true })
    },
    [],
  )

  const signOutFn = useCallback(async () => {
    if (!useFirebaseBackend()) return
    await signOut(getFirebaseAuth())
  }, [])

  const value = useMemo(
    () => ({
      name,
      user,
      signIn: signInFn,
      signUp: signUpFn,
      setName: setNameFn,
      signOut: signOutFn,
    }),
    [name, user, signInFn, signUpFn, setNameFn, signOutFn],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser doit être utilisé dans UserProvider')
  return ctx
}
