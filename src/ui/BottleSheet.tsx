import { useState } from 'react'
import type { BottleContents, VolumeUnit } from '@/domain/types'
import { formatVolume, quickAmounts, toMl } from '@/domain/units'
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
    <Sheet title="Bottle" onClose={onClose}>
      <div className="field">
        <span className="field-label" id="bottle-contents-label">
          Contents
        </span>
        <div className="segmented" role="group" aria-labelledby="bottle-contents-label">
          <button
            type="button"
            aria-pressed={contents === 'breast_milk'}
            onClick={() => setContents('breast_milk')}
          >
            Breast milk
          </button>
          <button
            type="button"
            aria-pressed={contents === 'formula'}
            onClick={() => setContents('formula')}
          >
            Formula
          </button>
        </div>
      </div>

      <div className="field">
        <span className="field-label" id="bottle-amount-label">
          Amount ({unit})
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
          Or enter an exact amount
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
          Last bottle was {formatVolume(lastAmountMl, unit)}.
        </p>
      )}

      <button
        type="button"
        className="button"
        data-variant="primary"
        onClick={save}
        disabled={!valid || saving}
      >
        {saving ? 'Saving…' : 'Save bottle'}
      </button>
    </Sheet>
  )
}
