import { useCallback, useEffect, useState } from 'react'
import type { Enigme } from '../types'
import {
  getExplicationByEnigmeId,
  saveExplication,
  startExplicationConfigSync,
} from '../lib/explicationStore'
import { enableAdminEnigmesSync, loadEnigmes } from '../lib/store'
import {
  getPageConfig,
  PAGE_RESULTAT,
  setPageEnabled,
  startPageConfigSync,
} from '../lib/pageStore'
import { startRoueConfigSync } from '../lib/roueStore'
import { useFirebaseBackend } from '../lib/dataMode'
import { sortEnigmesOldestFirst } from '../lib/dates'

const DATA_EVENT = 'guess-my-name:data'

export function AdminResultatPanel() {
  const usingFirebase = useFirebaseBackend()
  const [enigmes, setEnigmes] = useState<Enigme[]>(loadEnigmes)
  const [resultatPageEnabled, setResultatPageEnabled] = useState(
    () => getPageConfig(PAGE_RESULTAT).enabled,
  )
  const [explicationDrafts, setExplicationDrafts] = useState<Record<string, string>>(
    {},
  )
  const [formOk, setFormOk] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const syncExplicationDrafts = useCallback(() => {
    const next: Record<string, string> = {}
    for (const e of loadEnigmes()) {
      const exp = getExplicationByEnigmeId(e.enigmeid)
      next[e.enigmeid] = exp?.explication ?? ''
    }
    setExplicationDrafts(next)
  }, [])

  const refresh = useCallback(() => {
    setEnigmes(sortEnigmesOldestFirst(loadEnigmes()))
    setResultatPageEnabled(getPageConfig(PAGE_RESULTAT).enabled)
    syncExplicationDrafts()
  }, [syncExplicationDrafts])

  useEffect(() => {
    if (usingFirebase) {
      enableAdminEnigmesSync()
      startRoueConfigSync()
      startExplicationConfigSync()
      startPageConfigSync()
    }
    refresh()
  }, [usingFirebase, refresh])

  useEffect(() => {
    const onData = () => refresh()
    window.addEventListener(DATA_EVENT, onData)
    return () => window.removeEventListener(DATA_EVENT, onData)
  }, [refresh])

  const handleSavePageOption = async () => {
    setBusy(true)
    setFormError(null)
    setFormOk(null)
    try {
      await setPageEnabled(PAGE_RESULTAT, resultatPageEnabled)
      setFormOk('Page /resultat enregistrée dans la table page.')
    } catch {
      setFormError('Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveExplication = async (enigmeid: string) => {
    setBusy(true)
    setFormError(null)
    setFormOk(null)
    try {
      await saveExplication(enigmeid, explicationDrafts[enigmeid] ?? '')
      setFormOk(`Explication enregistrée pour l’énigme sélectionnée.`)
      refresh()
    } catch {
      setFormError('Enregistrement de l’explication impossible.')
    } finally {
      setBusy(false)
    }
  }

  const handleSaveAllExplications = async () => {
    setBusy(true)
    setFormError(null)
    setFormOk(null)
    try {
      for (const e of enigmes) {
        await saveExplication(e.enigmeid, explicationDrafts[e.enigmeid] ?? '')
      }
      setFormOk('Toutes les explications ont été enregistrées.')
      refresh()
    } catch {
      setFormError('Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="panel">
        <h2>Page /resultat</h2>
        <p className="panel-intro">
          Document Firestore <code>page/resultat</code> : champs{' '}
          <code>name</code> = « resultat », <code>enabled</code> = true pour les
          joueurs. Les admins y accèdent toujours (hors mode « voir comme
          non-admin »).
        </p>

        <label className="roue-cheat-toggle">
          <input
            type="checkbox"
            checked={resultatPageEnabled}
            onChange={(e) => setResultatPageEnabled(e.target.checked)}
          />
          Page résultat activée pour les joueurs
        </label>

        <div className="admin-actions-row">
          <button
            type="button"
            className="primary narrow"
            disabled={busy}
            onClick={() => void handleSavePageOption()}
          >
            Enregistrer l’option
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Explications par énigme</h2>
        <p className="panel-intro">
          Texte affiché sur <code>/resultat</code> après la roue (toutes les
          explications renseignées, triées par date d’énigme).
        </p>

        {enigmes.length === 0 ? (
          <p className="empty-state">Aucune énigme. Créez-en dans l’onglet Énigmes.</p>
        ) : (
          <ul className="explication-admin-list">
            {enigmes.map((en) => (
              <li key={en.enigmeid} className="explication-admin-row">
                <div className="explication-admin-head">
                  <strong>{en.libelle}</strong>
                  <span className="meta"> · {en.date}</span>
                </div>
                <label>
                  Explication
                  <textarea
                    rows={4}
                    value={explicationDrafts[en.enigmeid] ?? ''}
                    onChange={(ev) =>
                      setExplicationDrafts((d) => ({
                        ...d,
                        [en.enigmeid]: ev.target.value,
                      }))
                    }
                    placeholder="Texte révélé après la roue…"
                    maxLength={12000}
                  />
                </label>
                <button
                  type="button"
                  className="secondary narrow"
                  disabled={busy}
                  onClick={() => void handleSaveExplication(en.enigmeid)}
                >
                  Enregistrer
                </button>
              </li>
            ))}
          </ul>
        )}

        {formError ? (
          <p className="field-error" role="alert">
            {formError}
          </p>
        ) : null}
        {formOk ? (
          <p className="ok-hint" role="status">
            {formOk}
          </p>
        ) : null}

        {enigmes.length > 0 ? (
          <div className="admin-actions-row">
            <button
              type="button"
              className="primary narrow"
              disabled={busy}
              onClick={() => void handleSaveAllExplications()}
            >
              Tout enregistrer
            </button>
          </div>
        ) : null}
      </section>
    </>
  )
}
