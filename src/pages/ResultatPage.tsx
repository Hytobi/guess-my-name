import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { LoggedTopBar } from '../components/LoggedTopBar'
import {
  FortuneWheelView,
  type FortuneWheelViewHandle,
} from '../components/FortuneWheelView'
import { loadExplications, startExplicationConfigSync } from '../lib/explicationStore'
import { loadEnigmes } from '../lib/store'
import { loadRoueConfig, startRoueConfigSync } from '../lib/roueStore'
import { sortEnigmesOldestFirst } from '../lib/dates'
import { isPageEnabled, PAGE_RESULTAT } from '../lib/pageStore'
import type { RootState } from '../state/store'
const DATA_EVENT = 'guess-my-name:data'

type ExplicationReveal = {
  enigmeid: string
  libelle: string
  date: string
  text: string
}

function buildExplicationReveals(): ExplicationReveal[] {
  const enigmes = sortEnigmesOldestFirst(loadEnigmes())
  const expByEnigme = new Map(
    loadExplications().map((e) => [e.enigmeid, e.explication.trim()]),
  )
  const blocks: ExplicationReveal[] = []

  for (const en of enigmes) {
    const text = expByEnigme.get(en.enigmeid) ?? ''
    if (!text) continue
    blocks.push({
      enigmeid: en.enigmeid,
      libelle: en.libelle,
      date: en.date,
      text,
    })
    expByEnigme.delete(en.enigmeid)
  }

  for (const [enigmeid, text] of expByEnigme) {
    if (!text) continue
    blocks.push({ enigmeid, libelle: enigmeid, date: '', text })
  }

  return blocks
}

export function ResultatPage() {
  const isAdminVerified = useSelector((s: RootState) => s.admin.isAdminVerified)
  const viewAsPlayer = useSelector((s: RootState) => s.admin.viewAsPlayer)
  const wheelRef = useRef<FortuneWheelViewHandle>(null)

  const [roueConfig, setRoueConfig] = useState(loadRoueConfig)
  const [spinning, setSpinning] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const [explicationsReveal, setExplicationsReveal] = useState<
    ExplicationReveal[]
  >([])
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setRoueConfig(loadRoueConfig())
  }, [])

  useEffect(() => {
    startRoueConfigSync()
    startExplicationConfigSync()
    refresh()
  }, [refresh])

  useEffect(() => {
    const onData = () => refresh()
    window.addEventListener(DATA_EVENT, onData)
    return () => window.removeEventListener(DATA_EVENT, onData)
  }, [refresh])

  const handleSpin = async () => {
    if (spinning || roueConfig.segments.length < 2) return
    setError(null)
    setRevealed(false)
    setExplicationsReveal([])
    setSpinning(true)
    try {
      const outcome = await wheelRef.current?.run()
      if (!outcome?.results.length) return
      setExplicationsReveal(buildExplicationReveals())
      setRevealed(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de lancer la roue.')
    } finally {
      setSpinning(false)
    }
  }

  return (
    <div className="layout">
      <LoggedTopBar />
      <main className="main-content">
        <section className="panel">
          <h2>Découvrir le prénom</h2>
          {isAdminVerified && !viewAsPlayer && !isPageEnabled(PAGE_RESULTAT) ? (
            <p className="panel-intro ok-hint" role="note">
              Aperçu admin : cette page n’est pas encore activée pour les joueurs
              dans la table <code>page</code>.
            </p>
          ) : (
            <p className="panel-intro">
              Lancez la roue pour afficher les explications configurées dans
              l’administration.
            </p>
          )}

          <div className="roue-test-layout">
            <FortuneWheelView ref={wheelRef} config={roueConfig} />
          </div>

          <div className="admin-actions-row">
            <button
              type="button"
              className="primary narrow"
              disabled={spinning || roueConfig.segments.length < 2}
              onClick={() => void handleSpin()}
            >
              {spinning ? 'La roue tourne…' : 'Lancer la roue'}
            </button>
            <Link to="/" className="secondary narrow">
              Retour
            </Link>
          </div>

          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}

          {revealed ? (
            <section
              className="panel resultat-reveal"
              aria-live="polite"
              aria-label="Résultat"
            >
              {explicationsReveal.length === 0 ? (
                <p className="empty-state">
                  Aucune explication n’a encore été rédigée dans
                  l’administration.
                </p>
              ) : (
                <ul className="resultat-explication-list">
                  {explicationsReveal.map((item) => (
                    <li key={item.enigmeid}>
                      <h3 className="resultat-explication-title">
                        {item.libelle}
                        {item.date ? (
                          <span className="meta"> · {item.date}</span>
                        ) : null}
                      </h3>
                      <div className="resultat-explication">{item.text}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
        </section>
      </main>
    </div>
  )
}
