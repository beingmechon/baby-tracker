import { useState } from 'react'
import { MEASURE_KINDS } from '@/domain/growth'
import type { MeasureKind, MeasureSystem } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { formatMeasure, measureShortName } from '@/i18n/format'
import { MeasureValueInput } from './MeasureValueInput'
import { Sheet } from './Sheet'

interface GrowthSheetProps {
  system: MeasureSystem
  /** Which measurement the sheet opens on. */
  initialMeasure: MeasureKind
  /** The last reading of each kind, shown so a typo is obvious before saving. */
  lastValues: Partial<Record<MeasureKind, number>>
  onSave: (input: { measure: MeasureKind; value: number }) => Promise<void>
  onClose: () => void
}


/** Logging a measurement — a weigh-in at a check-up, or a tape at home. */
export function GrowthSheet({
  system,
  initialMeasure,
  lastValues,
  onSave,
  onClose,
}: GrowthSheetProps) {
  const t = useTranslator()
  const [measure, setMeasure] = useState<MeasureKind>(initialMeasure)
  const [value, setValue] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lastValue = lastValues[measure]

  async function save() {
    if (saving) return
    if (value === null) {
      setError(t.t('error.enterValue'))
      return
    }
    setSaving(true)
    try {
      await onSave({ measure, value })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('growth.title')} onClose={onClose}>
      <div className="field">
        <span className="field-label" id="growth-measure-label">
          {t.t('growth.measure')}
        </span>
        <div className="segmented" role="group" aria-labelledby="growth-measure-label">
          {MEASURE_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={measure === option}
              onClick={() => {
                setMeasure(option)
                setValue(null)
                setError(null)
              }}
            >
              {measureShortName(t, option)}
            </button>
          ))}
        </div>
      </div>

      <MeasureValueInput
        key={measure}
        measure={measure}
        system={system}
        idPrefix="growth"
        initialValue={null}
        onChange={setValue}
      />

      {lastValue !== undefined && (
        <p className="field-note">
          {t.t('growth.latest')} · {formatMeasure(t, lastValue, measure, system)}
        </p>
      )}

      {error !== null && (
        <p className="banner" data-tone="error" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        className="button"
        data-variant="primary"
        onClick={() => void save()}
        disabled={value === null || saving}
      >
        {t.t('growth.save')}
      </button>
    </Sheet>
  )
}
