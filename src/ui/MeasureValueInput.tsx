import { useState } from 'react'
import {
  fromCanonical,
  gramsToPoundsOunces,
  inputStep,
  poundsOuncesToGrams,
  toCanonical,
  unitFor,
} from '@/domain/measure'
import type { MeasureKind, MeasureSystem } from '@/domain/types'
import { useTranslator } from '@/i18n/context'

interface MeasureValueInputProps {
  measure: MeasureKind
  system: MeasureSystem
  /** Unique prefix for the field ids, so two of these can share a page. */
  idPrefix: string
  /** Canonical starting value, or null for an empty field. */
  initialValue: number | null
  /** Canonical grams or millimetres, or null while the field is empty. */
  onChange: (value: number | null) => void
}

/**
 * The one place a measurement is typed, shared by logging and editing so the two
 * can never disagree about units.
 *
 * Imperial weight is two fields, because a scale reads "9 lb 15 oz" and asking a
 * parent to convert that to 9.94 lb in their head at a check-up is how wrong
 * numbers get stored. Everything else is a single field.
 *
 * The component owns the text, not the number: a half-typed "6." has to survive
 * a render, and a parent holding canonical grams cannot represent it. Because the
 * text is local state, callers must pass `key={measure}` so switching what is
 * being measured remounts the fields — otherwise a length stays behind in the
 * weight field and gets saved as a weight.
 */
export function MeasureValueInput({
  measure,
  system,
  idPrefix,
  initialValue,
  onChange,
}: MeasureValueInputProps) {
  const t = useTranslator()
  const imperialWeight = system === 'imperial' && measure === 'weight'

  const [amount, setAmount] = useState(() =>
    initialValue === null ? '' : String(fromCanonical(initialValue, measure, system)),
  )
  const [pounds, setPounds] = useState(() =>
    initialValue === null ? '' : String(gramsToPoundsOunces(initialValue).pounds),
  )
  const [ounces, setOunces] = useState(() =>
    initialValue === null ? '' : String(gramsToPoundsOunces(initialValue).ounces),
  )

  function report(next: { amount?: string; pounds?: string; ounces?: string }) {
    const a = next.amount ?? amount
    const lb = next.pounds ?? pounds
    const oz = next.ounces ?? ounces

    if (imperialWeight) {
      if (lb === '' && oz === '') return onChange(null)
      const poundsValue = lb === '' ? 0 : Number.parseFloat(lb)
      const ouncesValue = oz === '' ? 0 : Number.parseFloat(oz)
      if (!Number.isFinite(poundsValue) || !Number.isFinite(ouncesValue)) {
        return onChange(null)
      }
      const grams = poundsOuncesToGrams(poundsValue, ouncesValue)
      return onChange(grams > 0 ? grams : null)
    }

    const parsed = Number.parseFloat(a)
    if (!Number.isFinite(parsed) || parsed <= 0) return onChange(null)
    return onChange(toCanonical(parsed, measure, system))
  }

  if (imperialWeight) {
    return (
      <div className="button-row">
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-pounds`}>
            {t.t('growth.pounds')}
          </label>
          <input
            id={`${idPrefix}-pounds`}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            value={pounds}
            onChange={(event) => {
              setPounds(event.target.value)
              report({ pounds: event.target.value })
            }}
            placeholder="9"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${idPrefix}-ounces`}>
            {t.t('growth.ounces')}
          </label>
          <input
            id={`${idPrefix}-ounces`}
            type="number"
            inputMode="decimal"
            min="0"
            max="15"
            step="1"
            value={ounces}
            onChange={(event) => {
              setOunces(event.target.value)
              report({ ounces: event.target.value })
            }}
            placeholder="15"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="field">
      <label className="field-label" htmlFor={`${idPrefix}-value`}>
        {t.t('growth.value', { unit: unitFor(measure, system) })}
      </label>
      <input
        id={`${idPrefix}-value`}
        type="number"
        inputMode="decimal"
        min="0"
        step={inputStep(measure, system)}
        value={amount}
        onChange={(event) => {
          setAmount(event.target.value)
          report({ amount: event.target.value })
        }}
      />
    </div>
  )
}
