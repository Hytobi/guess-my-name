/** Compte joueur (local puis Firebase). */
export type UserProfile = {
  /** Identifiant utilisateur (Firebase Auth uid quand Firebase est actif). */
  userid: string
  /** Nom affiché dans l'app. */
  name: string
}

/** Énigme publiée (image via Storage Firebase plus tard). */
export type Enigme = {
  enigmeid: string
  /** Titre affiché */
  libelle: string
  /** Jour calendaire (YYYY-MM-DD), fuseau local */
  date: string
  /** Nom du fichier image côté stockage */
  nomFichier: string
  message: string
  /** Aperçu local (data URL) en attendant Firebase Storage */
  /** `data:…` (local), ou `gs://<bucket>/enigmes/…` (Firestore + Firebase Storage). */
  imageDataUrl?: string | null
}

export type GuessListEntry = {
  guesslistid: string
  userid: string
  /** Clé semaine ISO : année × 100 + numéro de semaine (ex. 202615) */
  weeknumber: number
  guess: string
  enigmeid: string
  /** Timestamp (ms) utile pour tri admin (Firebase: updateTime). */
  updatedAtMs?: number
  /**
   * Nom affiché du joueur au moment de l’enregistrement (dénormalisé pour l’admin
   * hors Firebase ; à terme jointure user.name).
   */
  userName?: string
}

/** Partie de la roue de la fortune (libellé + couleur). */
export type RoueSegment = {
  id: string
  label: string
  /** Couleur de fond (hex). */
  backgroundColor: string
}

/** Activation d’une route (`page/{name}`). */
export type PageConfig = {
  name: string
  enabled: boolean
}

/** Explication affichée après la roue (`explications/{enigmeid}`). */
export type Explication = {
  enigmeid: string
  explication: string
  updatedAtMs?: number
}

/** Phase 1 du mode triche : durée de rotation puis arrêt sur un libellé. */
export type RoueCheatPhase1 = {
  /** Durée de la rotation (ms). */
  durationMs: number
  /** Index dans `segments` (ordre de la liste admin). */
  stopSegmentIndex: number
}

/** Phase 2 du mode triche : pause puis nouvelle rotation. */
export type RoueCheatPhase2 = {
  /** Délai avant que la roue recommence à tourner (ms). */
  pauseBeforeSpinMs: number
  /** Durée de la deuxième rotation (ms). */
  spinDurationMs: number
  stopSegmentIndex: number
}

/** Configuration Firestore `parametrage_roue/{id}`. */
export type ParametrageRoue = {
  id: string
  segments: RoueSegment[]
  cheatModeEnabled: boolean
  phase1: RoueCheatPhase1
  phase2: RoueCheatPhase2
  updatedAtMs?: number
}
