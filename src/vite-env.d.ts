/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_FIREBASE?: string
  readonly VITE_FIREBASE_ADMIN_EMAIL?: string
  readonly VITE_FIREBASE_ADMIN_PASSWORD?: string
  readonly VITE_ADMIN_PASSWORD?: string
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  /** Chemin objet Storage pour /morgan (ex. morgan/mdr.png) */
  readonly VITE_MORGAN_STORAGE_PATH?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
