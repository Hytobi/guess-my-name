import { ref, uploadBytes } from 'firebase/storage'
import { getFirebaseStorage } from './firebase'

function safeFileBaseName(name: string): string {
  const base = name.replace(/^.*[/\\]/, '').trim()
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
  return cleaned || 'image'
}

/**
 * Envoie l’image sous `enigmes/{enigmeId}/…` (aligné sur `storage.rules`)
 * et renvoie l’URI `gs://<bucket>/…` à persister dans `imageDataUrl` (Firestore).
 */
export async function uploadEnigmeImageToStorage(
  enigmeId: string,
  file: File,
): Promise<string> {
  const id = enigmeId.trim()
  if (!id) throw new Error('enigmeId vide')

  const storage = getFirebaseStorage()
  const leaf = `${Date.now()}-${safeFileBaseName(file.name)}`
  const path = `enigmes/${id}/${leaf}`
  const storageRef = ref(storage, path)

  await uploadBytes(storageRef, file, {
    contentType: file.type || 'application/octet-stream',
  })

  const bucket =
    storage.app.options.storageBucket ??
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
  if (!bucket) throw new Error('storageBucket Firebase non configuré')

  return `gs://${bucket}/${path}`
}
