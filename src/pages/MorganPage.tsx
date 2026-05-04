import { useMemo } from 'react'
import { useFirebaseBackend } from '../lib/dataMode'
import { EnigmeImage } from '../components/EnigmeImage'

/** Chemin de l’objet dans le bucket Storage (règles : `morgan/**` ou surcharge via env). */
const DEFAULT_STORAGE_OBJECT_PATH = 'morgan/mdr.png'

function buildGsUrl(bucket: string, objectPath: string): string {
  const clean = objectPath.replace(/^\/+/, '').replace(/^gs:\/\/[^/]+\//, '')
  return `gs://${bucket}/${clean}`
}

export function MorganPage() {
  const usingFirebase = useFirebaseBackend()

  const imageRef = useMemo(() => {
    if (!usingFirebase) return null
    const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.toString().trim()
    if (!bucket) return null
    const path =
      import.meta.env.VITE_MORGAN_STORAGE_PATH?.toString().trim() ||
      DEFAULT_STORAGE_OBJECT_PATH
    if (!path) return null
    return buildGsUrl(bucket, path)
  }, [usingFirebase])

  if (!usingFirebase) {
    return (
      <main className="shell">
        <p className="empty-state">Firebase n’est pas configuré.</p>
      </main>
    )
  }

  if (!imageRef) {
    return (
      <main className="shell">
        <p className="field-error" role="alert">
          Bucket Storage manquant (<code>VITE_FIREBASE_STORAGE_BUCKET</code>) ou chemin
          invalide.
        </p>
      </main>
    )
  }

  return (
    <main className="shell morgan-page">
      <EnigmeImage imageRef={imageRef} alt="" className="decoy-mdr-img" />
    </main>
  )
}
