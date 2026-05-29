import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
} from 'react'
import type { ParametrageRoue } from '../types'
import {
  FortuneWheel,
  type FortuneWheelRunOutcome,
} from '../lib/fortuneWheel/FortuneWheel'

export type FortuneWheelViewHandle = {
  run: () => Promise<FortuneWheelRunOutcome>
  isSpinning: () => boolean
  cancel: () => void
}

type Props = {
  config: ParametrageRoue
  className?: string
  'aria-label'?: string
}

export const FortuneWheelView = forwardRef<FortuneWheelViewHandle, Props>(
  function FortuneWheelView({ config, className, 'aria-label': ariaLabel }, ref) {
    const hostRef = useRef<HTMLDivElement>(null)
    const wheelRef = useRef<FortuneWheel | null>(null)

    useEffect(() => {
      const el = hostRef.current
      if (!el) return
      wheelRef.current = new FortuneWheel(el, config)
      return () => {
        wheelRef.current?.destroy()
        wheelRef.current = null
      }
      // Recréer uniquement au montage ; les mises à jour passent par setConfig.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const segmentSig = useMemo(
      () =>
        config.segments
          .map((s) => `${s.id}:${s.backgroundColor}:${s.label}`)
          .join('|'),
      [config.segments],
    )

    useEffect(() => {
      wheelRef.current?.setConfig(config)
    }, [config, segmentSig])

    useImperativeHandle(ref, () => ({
      run: () => {
        if (!wheelRef.current) {
          return Promise.reject(new Error('Roue non initialisée'))
        }
        return wheelRef.current.run()
      },
      isSpinning: () => wheelRef.current?.isSpinning() ?? false,
      cancel: () => wheelRef.current?.cancel(),
    }))

    return (
      <div
        ref={hostRef}
        className={className ?? 'fortune-wheel-view'}
        role="img"
        aria-label={ariaLabel ?? 'Roue de la fortune'}
      />
    )
  },
)
