import { useEffect, useState } from 'react'
import { getDownloadURL, ref } from 'firebase/storage'
import { getFirebaseStorage } from '../lib/firebase'

function isDirectImageSrc(s: string): boolean {
  return (
    s.startsWith('data:') ||
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('blob:')
  )
}

type Props = {
  imageRef: string
  alt?: string
  className?: string
}

/**
 * Affiche une image d’énigme : `data:` / URL HTTP inchangés ;
 * `gs://…` (Firestore) résolu via Firebase Storage (`getDownloadURL`).
 */
export function EnigmeImage({ imageRef, alt = '', className }: Props) {
  const [resolved, setResolved] = useState<string | null>(() =>
    isDirectImageSrc(imageRef) ? imageRef : null,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (isDirectImageSrc(imageRef)) {
      setResolved(imageRef)
      setFailed(false)
      return
    }
    if (!imageRef.startsWith('gs://')) {
      setResolved(null)
      setFailed(true)
      return
    }
    setFailed(false)
    setResolved(null)
    let cancelled = false
    const storage = getFirebaseStorage()
    void getDownloadURL(ref(storage, imageRef))
      .then((url) => {
        if (!cancelled) setResolved(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [imageRef])

  if (failed) {
    return (
      <p className="file-hint" role="alert">
        Impossible d’afficher l’image (Storage ou règles d’accès).
      </p>
    )
  }
  if (!resolved) {
    return <p className="file-hint">Chargement de l’image…</p>
  }
  return <img src={resolved} alt={alt} className={className} />
}
