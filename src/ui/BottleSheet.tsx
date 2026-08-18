import { useState } from 'react'
import type { BottleContents, VolumeUnit } from '@/domain/types'
import { quickAmounts, toMl } from '@/domain/units'
import { useTranslator } from '@/i18n/context'
import { formatVolume } from '@/i18n/format'
import { Sheet } from './Sheet'

interface BottleSheetProps {
  unit: VolumeUnit
  lastContents: BottleContents | null
  lastAmountMl: number | null
  onSave: (input: { contents: BottleContents; amountMl: number }) => Promise<void>
  onClose: () => void
}

/**
 * Bottle logging, built around one-tap amounts.
 *
 * The keyboard is a last resort: typing a number one-handed while holding a
 * baby is exactly the friction that stops people logging at all. The quick
 * amounts cover the common cases and the field is there for the rest.
 */
export function BottleSheet({
  unit,
  lastContents,
  lastAmountMl,
  onSave,
  onClose,
}: BottleSheetProps) {
  const t = useTranslator()
  const [contents, setContents] = useState<BottleContents>(lastContents ?? 'formula')
  const [amount, setAmount] = useState<string>('')
  const [saving, setSaving] = useState(false)

  const amounts = quickAmounts(unit)
  const parsed = Number.parseFloat(amount)
  const valid = Number.isFinite(parsed) && parsed > 0

  async function save() {
    if (!valid || saving) return
    setSaving(true)
    try {
      await onSave({ contents, amountMl: toMl(parsed, unit) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('bottle.title')} onClose={onClose}>
      <div className="field">
        <span className="field-label" id="bottle-contents-label">
          {t.t('bottle.contents')}
        </span>
        <div className="segmented" role="group" aria-labelledby="bottle-contents-label">
          <button
            type="button"
            aria-pressed={contents === 'breast_milk'}
            onClick={() => setContents('breast_milk')}
          >
            {t.t('bottle.contents.breastMilk')}
          </button>
          <button
            type="button"
            aria-pressed={contents === 'formula'}
            onClick={() => setContents('formula')}
          >
            {t.t('bottle.contents.formula')}
          </button>
        </div>
      </div>

      <div className="field">
        <span className="field-label" id="bottle-amount-label">
          {t.t('bottle.amount', { unit })}
        </span>
        <div className="chip-row" role="group" aria-labelledby="bottle-amount-label">
          {amounts.map((value) => (
            <button
              key={value}
              type="button"
              className="chip"
              aria-pressed={amount === String(value)}
              onClick={() => setAmount(String(value))}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="bottle-amount">
          {t.t('bottle.exactAmount')}
        </label>
        <input
          id="bottle-amount"
          type="number"
          inputMode="decimal"
          min="0"
          step={unit === 'oz' ? '0.5' : '5'}
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder={unit === 'oz' ? '4' : '120'}
        />
      </div>

      {lastAmountMl !== null && (
        <p className="field-note">
          {t.t('bottle.lastBottle', { amount: formatVolume(t, lastAmountMl, unit) })}
        </p>
      )}

      <button
        type="button"
        className="button"
        data-variant="primary"
        onClick={save}
        disabled={!valid || saving}
      >
        {t.t(saving ? 'bottle.saving' : 'bottle.save')}
      </button>
    </Sheet>
  )
}
