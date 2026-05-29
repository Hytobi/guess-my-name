import type { ParametrageRoue, RoueSegment } from '../../types'

export type FortuneWheelSpinResult = {
  phase: 1 | 2
  segmentIndex: number
  segment: RoueSegment
}

export type FortuneWheelRunOutcome = {
  results: FortuneWheelSpinResult[]
}

const DEFAULT_SPIN_MS = 4500
const MIN_SEGMENTS = 2

function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0
  return ((index % count) + count) % count
}

function rotationForSegmentIndex(index: number, segmentCount: number): number {
  const segAngle = 360 / segmentCount
  const center = (index + 0.5) * segAngle
  return 360 - center
}

/** Plus court chemin vers la cible (|delta| ≤ 180°, toujours < 1 tour). */
function shortestRotationDelta(currentMod: number, targetMod: number): number {
  let delta = targetMod - currentMod
  delta = ((delta % 360) + 360) % 360
  if (delta > 180) delta -= 360
  return delta
}

type AnimateToIndexOptions = {
  /** Tours complets avant l’arrêt (phase 1 triche / tirage normal). */
  extraSpins?: number
  /** Phase 2 triche : rotation minimale, sans tour complet. */
  minimalTurn?: boolean
}

/** Angle médian de la part i (degrés, 0° = droite, sens trigonométrique). */
function segmentMidAngleDeg(segmentIndex: number, segmentCount: number): number {
  const segAngle = 360 / segmentCount
  return (segmentIndex + 0.5) * segAngle - 90
}

/** Position % (left, top) et rotation du libellé, centrés dans la part. */
function segmentLabelLayout(
  segmentIndex: number,
  segmentCount: number,
): { left: number; top: number; textRotate: number; maxWidthPct: number } {
  const segAngle = 360 / segmentCount
  const midDeg = segmentMidAngleDeg(segmentIndex, segmentCount)
  const midRad = (midDeg * Math.PI) / 180
  /** Milieu de la part sur le rayon (0 = centre, 1 = bord du disque). */
  const radial = 0.5
  const left = 50 + 50 * radial * Math.cos(midRad)
  const top = 50 + 50 * radial * Math.sin(midRad)
  // Le long du rayon, lisible depuis le centre vers l’extérieur
  let textRotate = midDeg
  if (textRotate > 90 || textRotate < -90) textRotate += 180
  const chordPct =
    2 * Math.sin((segAngle * Math.PI) / 360) * radial * 100 * 0.92
  const maxWidthPct = Math.max(16, Math.min(chordPct, 44))
  return { left, top, textRotate, maxWidthPct }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

/** Part i : du haut, sens horaire (aligné sur les libellés et l’admin). */
function segmentArcDegrees(
  segmentIndex: number,
  segmentCount: number,
): { start: number; end: number } {
  const segAngle = 360 / segmentCount
  const start = -90 + segmentIndex * segAngle
  const end = -90 + (segmentIndex + 1) * segAngle
  return { start, end }
}

function sectorPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const startRad = (startDeg * Math.PI) / 180
  const endRad = (endDeg * Math.PI) / 180
  const x1 = cx + r * Math.cos(startRad)
  const y1 = cy + r * Math.sin(startRad)
  const x2 = cx + r * Math.cos(endRad)
  const y2 = cy + r * Math.sin(endRad)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`
}

function buildWheelSvg(segments: RoueSegment[]): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 100 100')
  svg.setAttribute('class', 'fortune-wheel-svg')
  svg.setAttribute('aria-hidden', 'true')

  const cx = 50
  const cy = 50
  const r = 50
  const n = segments.length
  const stroke = 'rgba(0,0,0,0.2)'

  segments.forEach((seg, i) => {
    const { start, end } = segmentArcDegrees(i, n)
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', sectorPath(cx, cy, r, start, end))
    path.setAttribute('fill', seg.backgroundColor)
    path.setAttribute('stroke', stroke)
    path.setAttribute('stroke-width', '0.35')
    path.setAttribute('data-segment-index', String(i))
    svg.appendChild(path)
  })

  return svg
}

/**
 * Roue de la fortune animée (DOM). Réutilisable hors React :
 * instancier avec un conteneur HTML, appeler `run()` pour lancer un tirage.
 */
export class FortuneWheel {
  private readonly root: HTMLElement
  private wheelEl: HTMLDivElement
  private labelsEl: HTMLDivElement
  private pointerEl: HTMLDivElement
  private config: ParametrageRoue
  private currentRotation = 0
  private spinning = false
  private animToken = 0

  constructor(container: HTMLElement, config: ParametrageRoue) {
    this.root = container
    this.config = config
    this.root.classList.add('fortune-wheel-host')
    this.root.innerHTML = ''

    const wrap = document.createElement('div')
    wrap.className = 'fortune-wheel-wrap'

    this.pointerEl = document.createElement('div')
    this.pointerEl.className = 'fortune-wheel-pointer'
    this.pointerEl.setAttribute('aria-hidden', 'true')

    this.wheelEl = document.createElement('div')
    this.wheelEl.className = 'fortune-wheel-disc'

    this.labelsEl = document.createElement('div')
    this.labelsEl.className = 'fortune-wheel-labels'

    wrap.appendChild(this.wheelEl)
    wrap.appendChild(this.labelsEl)
    wrap.appendChild(this.pointerEl)
    this.root.appendChild(wrap)

    this.renderSegments()
  }

  setConfig(config: ParametrageRoue): void {
    this.config = config
    this.renderSegments()
  }

  getConfig(): ParametrageRoue {
    return this.config
  }

  isSpinning(): boolean {
    return this.spinning
  }

  destroy(): void {
    this.animToken += 1
    this.root.innerHTML = ''
    this.root.classList.remove('fortune-wheel-host')
  }

  private renderSegments(): void {
    const { segments } = this.config
    this.wheelEl.replaceChildren()
    if (segments.length < MIN_SEGMENTS) {
      this.wheelEl.style.background = '#444'
      this.labelsEl.innerHTML = ''
      return
    }
    this.wheelEl.style.background = 'transparent'
    this.wheelEl.appendChild(buildWheelSvg(segments))
    this.labelsEl.innerHTML = ''
    segments.forEach((seg, i) => {
      const layout = segmentLabelLayout(i, segments.length)

      const label = document.createElement('span')
      label.className = 'fortune-wheel-label'
      label.textContent = seg.label
      label.style.left = `${layout.left}%`
      label.style.top = `${layout.top}%`
      label.style.maxWidth = `${layout.maxWidthPct}%`
      label.style.transform = `translate(-50%, -50%) rotate(${layout.textRotate}deg)`
      this.labelsEl.appendChild(label)
    })
    this.applyRotation(this.currentRotation, false)
  }

  private applyRotation(deg: number, animate: boolean, durationMs?: number): void {
    const rot = `rotate(${deg}deg)`
    if (!animate) {
      this.wheelEl.style.transition = 'none'
      this.labelsEl.style.transition = 'none'
      this.wheelEl.style.transform = rot
      this.labelsEl.style.transform = rot
      void this.wheelEl.offsetHeight
      return
    }
    const dur = durationMs ?? DEFAULT_SPIN_MS
    const easing = 'cubic-bezier(0.15, 0.85, 0.2, 1)'
    const tr = `transform ${dur}ms ${easing}`
    this.wheelEl.style.transition = tr
    this.labelsEl.style.transition = tr
    this.wheelEl.style.transform = rot
    this.labelsEl.style.transform = rot
  }

  private delay(ms: number, token: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const t = window.setTimeout(() => {
        if (token !== this.animToken) {
          reject(new Error('cancelled'))
          return
        }
        resolve()
      }, ms)
      const check = () => {
        if (token !== this.animToken) {
          window.clearTimeout(t)
          reject(new Error('cancelled'))
        }
      }
      check()
    })
  }

  private animateToIndex(
    segmentIndex: number,
    durationMs: number,
    token: number,
    options: AnimateToIndexOptions = {},
  ): Promise<FortuneWheelSpinResult> {
    const { extraSpins = 5, minimalTurn = false } = options
    const count = this.config.segments.length
    const idx = clampIndex(segmentIndex, count)
    const targetMod = rotationForSegmentIndex(idx, count)
    const currentMod = ((this.currentRotation % 360) + 360) % 360
    const delta = minimalTurn
      ? shortestRotationDelta(currentMod, targetMod)
      : (() => {
          let d = targetMod - currentMod
          if (d <= 0) d += 360
          return d
        })()
    const finalRotation =
      this.currentRotation + (minimalTurn ? 0 : extraSpins * 360) + delta

    return new Promise((resolve, reject) => {
      if (token !== this.animToken) {
        reject(new Error('cancelled'))
        return
      }
      const onEnd = (ev: TransitionEvent) => {
        if (ev.propertyName !== 'transform') return
        this.wheelEl.removeEventListener('transitionend', onEnd)
        this.labelsEl.removeEventListener('transitionend', onEnd)
        if (token !== this.animToken) {
          reject(new Error('cancelled'))
          return
        }
        this.currentRotation = finalRotation
        resolve({
          phase: 1,
          segmentIndex: idx,
          segment: this.config.segments[idx],
        })
      }
      this.wheelEl.addEventListener('transitionend', onEnd)
      this.labelsEl.addEventListener('transitionend', onEnd)
      this.applyRotation(finalRotation, true, durationMs)
    })
  }

  /**
   * Lance un tirage. En mode triche : phase 1 puis pause puis phase 2.
   * Hors triche : un seul tirage aléatoire.
   */
  async run(): Promise<FortuneWheelRunOutcome> {
    const count = this.config.segments.length
    if (count < MIN_SEGMENTS) {
      throw new Error('Au moins 2 éléments sont requis sur la roue.')
    }
    if (this.spinning) {
      throw new Error('La roue est déjà en cours de rotation.')
    }

    this.spinning = true
    const token = ++this.animToken
    const results: FortuneWheelSpinResult[] = []

    try {
      if (this.config.cheatModeEnabled) {
        const p1 = clampIndex(this.config.phase1.stopSegmentIndex, count)
        const p2 = clampIndex(this.config.phase2.stopSegmentIndex, count)
        const r1 = await this.animateToIndex(
          p1,
          this.config.phase1.durationMs,
          token,
        )
        results.push({ ...r1, phase: 1 })

        await this.delay(this.config.phase2.pauseBeforeSpinMs, token)

        const r2 = await this.animateToIndex(
          p2,
          this.config.phase2.spinDurationMs,
          token,
          { minimalTurn: true },
        )
        results.push({ ...r2, phase: 2 })
      } else {
        const randomIdx = Math.floor(Math.random() * count)
        const r = await this.animateToIndex(randomIdx, DEFAULT_SPIN_MS, token)
        results.push({ ...r, phase: 1 })
      }
      return { results }
    } finally {
      if (token === this.animToken) {
        this.spinning = false
      }
    }
  }

  cancel(): void {
    this.animToken += 1
    this.spinning = false
    this.applyRotation(this.currentRotation, false)
  }
}
