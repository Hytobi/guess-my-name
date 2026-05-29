import { useCallback, useEffect, useRef, useState } from 'react'
import type { ParametrageRoue, RoueSegment } from '../types'
import {
  FortuneWheelView,
  type FortuneWheelViewHandle,
} from '../components/FortuneWheelView'
import { createEmptySegment, normalizeSegmentColor } from '../lib/roueDefaults'
import { loadRoueConfig, saveRoueConfig, startRoueConfigSync } from '../lib/roueStore'
import { useFirebaseBackend } from '../lib/dataMode'

const DATA_EVENT = 'guess-my-name:data'

function clampStopIndex(index: number, segmentCount: number): number {
  if (segmentCount <= 0) return 0
  return Math.min(Math.max(0, Math.floor(index)), segmentCount - 1)
}

function normalizeConfig(draft: ParametrageRoue): ParametrageRoue {
  const n = draft.segments.length
  return {
    ...draft,
    phase1: {
      ...draft.phase1,
      stopSegmentIndex: clampStopIndex(draft.phase1.stopSegmentIndex, n),
      durationMs: Math.max(500, draft.phase1.durationMs),
    },
    phase2: {
      ...draft.phase2,
      stopSegmentIndex: clampStopIndex(draft.phase2.stopSegmentIndex, n),
      pauseBeforeSpinMs: Math.max(0, draft.phase2.pauseBeforeSpinMs),
      spinDurationMs: Math.max(500, draft.phase2.spinDurationMs),
    },
  }
}

export function AdminWheelPanel() {
  const usingFirebase = useFirebaseBackend()
  const wheelRef = useRef<FortuneWheelViewHandle>(null)
  const [draft, setDraft] = useState<ParametrageRoue>(() => loadRoueConfig())
  const [savedDraft, setSavedDraft] = useState<ParametrageRoue>(() => loadRoueConfig())
  const [formOk, setFormOk] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [testHint, setTestHint] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const refresh = useCallback(() => {
    const c = loadRoueConfig()
    setDraft(c)
    setSavedDraft(c)
  }, [])

  useEffect(() => {
    if (usingFirebase) {
      startRoueConfigSync()
    }
    refresh()
  }, [usingFirebase, refresh])

  useEffect(() => {
    const onData = () => refresh()
    window.addEventListener(DATA_EVENT, onData)
    return () => window.removeEventListener(DATA_EVENT, onData)
  }, [refresh])

  const dirty =
    JSON.stringify(normalizeConfig(draft)) !==
    JSON.stringify(normalizeConfig(savedDraft))

  const updateSegment = (id: string, patch: Partial<RoueSegment>) => {
    const nextPatch =
      patch.backgroundColor !== undefined
        ? {
            ...patch,
            backgroundColor: normalizeSegmentColor(patch.backgroundColor),
          }
        : patch
    setDraft((d) => ({
      ...d,
      segments: d.segments.map((s) =>
        s.id === id ? { ...s, ...nextPatch } : s,
      ),
    }))
    setFormOk(null)
    setTestHint(null)
  }

  const addSegment = () => {
    setDraft((d) => {
      const colors = d.segments.map((s) => s.backgroundColor)
      const seg = createEmptySegment(colors)
      return normalizeConfig({
        ...d,
        segments: [...d.segments, seg],
      })
    })
    setFormOk(null)
  }

  const removeSegment = (id: string) => {
    setDraft((d) => {
      if (d.segments.length <= 2) return d
      const segments = d.segments.filter((s) => s.id !== id)
      return normalizeConfig({ ...d, segments })
    })
    setFormOk(null)
  }

  const handleSave = async () => {
    if (draft.segments.length < 2) {
      setFormError('Il faut au moins 2 éléments sur la roue.')
      return
    }
    setBusy(true)
    setFormError(null)
    setFormOk(null)
    try {
      const next = normalizeConfig(draft)
      await saveRoueConfig(next)
      setDraft(next)
      setSavedDraft(next)
      setFormOk('Paramétrage enregistré.')
    } catch {
      setFormError('Enregistrement impossible. Réessayez.')
    } finally {
      setBusy(false)
    }
  }

  const handleTest = async () => {
    if (spinning || draft.segments.length < 2) return
    setTestHint(null)
    setFormError(null)
    setSpinning(true)
    try {
      const outcome = await wheelRef.current?.run()
      if (!outcome) return
      const lines = outcome.results.map(
        (r) => `Phase ${r.phase} : « ${r.segment.label} »`,
      )
      setTestHint(lines.join(' — '))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Tirage impossible.'
      setFormError(msg)
    } finally {
      setSpinning(false)
    }
  }

  const segmentOptions = draft.segments.map((s, i) => (
    <option key={s.id} value={i}>
      {s.label || '(sans libellé)'}
    </option>
  ))

  return (
    <>
      <section className="panel">
        <h2>Roue de la fortune</h2>
        <p className="panel-intro">
          Ajoutez ou retirez des libellés. Chaque part de la roue a un{' '}
          <strong>fond distinct</strong> (couleur).
        </p>

        <ul className="roue-segment-list">
          {draft.segments.map((seg) => (
            <li key={seg.id} className="roue-segment-row">
              <label className="roue-segment-label-field">
                <span className="sr-only">Libellé</span>
                <input
                  value={seg.label}
                  onChange={(e) =>
                    updateSegment(seg.id, { label: e.target.value })
                  }
                  maxLength={80}
                  placeholder="Libellé"
                />
              </label>
              <label className="roue-segment-color-field">
                <span className="sr-only">Couleur</span>
                <input
                  type="color"
                  value={normalizeSegmentColor(seg.backgroundColor)}
                  onChange={(e) =>
                    updateSegment(seg.id, {
                      backgroundColor: normalizeSegmentColor(e.target.value),
                    })
                  }
                />
              </label>
              <span
                className="roue-segment-swatch"
                style={{ backgroundColor: seg.backgroundColor }}
                aria-hidden="true"
              />
              <button
                type="button"
                className="secondary narrow danger"
                disabled={draft.segments.length <= 2}
                onClick={() => removeSegment(seg.id)}
              >
                Retirer
              </button>
            </li>
          ))}
        </ul>

        <div className="admin-actions-row">
          <button type="button" className="secondary narrow" onClick={addSegment}>
            Ajouter un élément
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Mode triche</h2>
        <p className="panel-intro">
          Si activé, un tirage comporte <strong>deux phases</strong> : rotation
          puis pause, puis nouvelle rotation vers le second résultat.
        </p>

        <label className="roue-cheat-toggle">
          <input
            type="checkbox"
            checked={draft.cheatModeEnabled}
            onChange={(e) =>
              setDraft((d) => ({ ...d, cheatModeEnabled: e.target.checked }))
            }
          />
          Activer le mode triche
        </label>

        {draft.cheatModeEnabled ? (
          <div className="roue-cheat-phases">
            <fieldset className="roue-phase-fieldset">
              <legend>Phase 1</legend>
              <label>
                Durée de rotation (ms)
                <input
                  type="number"
                  min={500}
                  step={100}
                  value={draft.phase1.durationMs}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      phase1: {
                        ...d.phase1,
                        durationMs: Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label>
                S’arrêter sur
                <select
                  value={draft.phase1.stopSegmentIndex}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      phase1: {
                        ...d.phase1,
                        stopSegmentIndex: Number(e.target.value),
                      },
                    }))
                  }
                >
                  {segmentOptions}
                </select>
              </label>
            </fieldset>

            <fieldset className="roue-phase-fieldset">
              <legend>Phase 2</legend>
              <p className="roue-phase-hint">
                La roue effectue un <strong>demi-tour au maximum</strong> (chemin
                le plus court) pour atteindre la 2ᵉ valeur.
              </p>
              <label>
                Pause avant la 2ᵉ rotation (ms)
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={draft.phase2.pauseBeforeSpinMs}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      phase2: {
                        ...d.phase2,
                        pauseBeforeSpinMs: Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label>
                Durée de la 2ᵉ rotation (ms)
                <input
                  type="number"
                  min={500}
                  step={100}
                  value={draft.phase2.spinDurationMs}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      phase2: {
                        ...d.phase2,
                        spinDurationMs: Number(e.target.value),
                      },
                    }))
                  }
                />
              </label>
              <label>
                S’arrêter sur
                <select
                  value={draft.phase2.stopSegmentIndex}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      phase2: {
                        ...d.phase2,
                        stopSegmentIndex: Number(e.target.value),
                      },
                    }))
                  }
                >
                  {segmentOptions}
                </select>
              </label>
            </fieldset>
          </div>
        ) : null}

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

        <div className="admin-actions-row">
          <button
            type="button"
            className="primary narrow"
            disabled={busy || !dirty}
            onClick={() => void handleSave()}
          >
            {busy ? 'Enregistrement…' : 'Enregistrer le paramétrage'}
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Test de la roue</h2>
        <p className="panel-intro">
          Utilise le paramétrage ci-dessus (y compris le mode triche). Pensez à
          enregistrer avant un test si vous venez de modifier la roue.
        </p>

        <div className="roue-test-layout">
          <FortuneWheelView ref={wheelRef} config={draft} />
        </div>

        <div className="admin-actions-row">
          <button
            type="button"
            className="primary narrow"
            disabled={spinning || draft.segments.length < 2}
            onClick={() => void handleTest()}
          >
            {spinning ? 'Tirage en cours…' : 'Lancer un tirage test'}
          </button>
        </div>
        {testHint ? (
          <p className="ok-hint" role="status">
            {testHint}
          </p>
        ) : null}
      </section>
    </>
  )
}
