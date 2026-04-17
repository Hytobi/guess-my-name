/** Compte joueur (local puis Firebase). */
export type UserProfile = {
  userid: string
  name: string
  /** Code à 8 chiffres pour retrouver le compte sur un autre appareil */
  codeconnexion: string
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
  imageDataUrl?: string | null
}

export type GuessListEntry = {
  guesslistid: string
  userid: string
  /** Clé semaine ISO : année × 100 + numéro de semaine (ex. 202615) */
  weeknumber: number
  guess: string
  enigmeid: string
  /**
   * Nom affiché du joueur au moment de l’enregistrement (dénormalisé pour l’admin
   * hors Firebase ; à terme jointure user.name).
   */
  userName?: string
}
