import { useState } from 'react'
import { ALLERGENS } from '@/domain/food'
import type { Allergen, FoodAcceptance } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { allergenName, foodAcceptanceName } from '@/i18n/format'
import { Sheet } from './Sheet'

interface FoodSheetProps {
  /** Foods already offered, so a second helping of yesterday's needs no typing. */
  knownNames: readonly string[]
  onSave: (input: {
    name: string
    acceptance: FoodAcceptance
    allergens: Allergen[]
    reaction: boolean
    note: string
  }) => Promise<void>
  onClose: () => void
}

const ACCEPTANCES: readonly FoodAcceptance[] = [
  'refused',
  'tasted',
  'some',
  'most',
  'all',
]

/**
 * Logging a food.
 *
 * The allergen tags are the reason this screen exists, and they are chosen by the
 * parent rather than inferred from the name. There is no food-composition database
 * here: guessing that hummus contains sesame happens to be right, and guessing that
 * a supermarket biscuit contains no egg is how an app tells a parent something
 * dangerous and untrue. The note under the field says so, because a parent who
 * assumes the app knows would under-tag.
 */
export function FoodSheet({ knownNames, onSave, onClose }: FoodSheetProps) {
  const t = useTranslator()
  const [name, setName] = useState('')
  const [acceptance, setAcceptance] = useState<FoodAcceptance>('tasted')
  const [allergens, setAllergens] = useState<Allergen[]>([])
  const [reaction, setReaction] = useState(false)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(allergen: Allergen) {
    setAllergens((current) =>
      current.includes(allergen)
        ? current.filter((entry) => entry !== allergen)
        : [...current, allergen],
    )
  }

  async function save() {
    if (saving) return
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      setError(t.t('error.enterFood'))
      return
    }
    setSaving(true)
    try {
      await onSave({ name: trimmed, acceptance, allergens, reaction, note: note.trim() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('food.title')} onClose={onClose}>
      {knownNames.length > 0 && (
        <div className="field">
          <span className="field-label" id="food-known-label">
            {t.t('food.recent')}
          </span>
          <div className="chip-row" role="group" aria-labelledby="food-known-label">
            {knownNames.slice(0, 3).map((known) => (
              <button
                key={known}
                type="button"
                className="chip"
                aria-pressed={name === known}
                onClick={() => setName(known)}
              >
                {known}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <label className="field-label" htmlFor="food-name">
          {t.t('food.name')}
        </label>
        <input
          id="food-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.t('food.namePlaceholder')}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <span className="field-label" id="food-acceptance-label">
          {t.t('food.acceptance')}
        </span>
        <div className="stack-choices" role="group" aria-labelledby="food-acceptance-label">
          {ACCEPTANCES.map((option) => (
            <button
              key={option}
              type="button"
              className="choice"
              aria-pressed={acceptance === option}
              onClick={() => setAcceptance(option)}
            >
              {foodAcceptanceName(t, option)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label" id="food-allergens-label">
          {t.t('food.allergens')}
        </span>
        <div className="tag-row" role="group" aria-labelledby="food-allergens-label">
          {ALLERGENS.map((allergen) => (
            <button
              key={allergen}
              type="button"
              className="tag"
              aria-pressed={allergens.includes(allergen)}
              onClick={() => toggle(allergen)}
            >
              {allergenName(t, allergen)}
            </button>
          ))}
        </div>
        <p className="field-note">{t.t('food.allergensNote')}</p>
      </div>

      <div className="field">
        <div className="switch-row">
          <span className="switch-row-label">{t.t('food.reaction')}</span>
          <input
            type="checkbox"
            checked={reaction}
            onChange={(event) => setReaction(event.target.checked)}
            aria-label={t.t('food.reaction')}
          />
        </div>
        {/* Shown only once the box is ticked: an emergency instruction printed
            under every ordinary banana would teach a parent to stop reading it. */}
        {reaction && (
          <p className="banner" data-tone="error" role="status">
            {t.t('food.reactionNote')}
          </p>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="food-note">
          {t.t('food.note')}
        </label>
        <textarea
          id="food-note"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.t('food.notePlaceholder')}
        />
      </div>

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
        disabled={saving}
      >
        {t.t('food.save')}
      </button>
    </Sheet>
  )
}
