import { useState } from 'react'
import { localDateKey } from '@/domain/time'
import { NursingIcon, ShieldIcon } from './icons'

interface OnboardingProps {
  onCreate: (input: { name: string; birthDate: string | null }) => Promise<void>
}

/**
 * The whole of setup: a name, and optionally a birth date. No account, no email,
 * no "allow notifications" — the first screen is where a tracker either earns
 * trust or spends it.
 */
export function Onboarding({ onCreate }: OnboardingProps) {
  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = name.trim()

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (trimmed.length === 0 || saving) return
    setSaving(true)
    setError(null)
    try {
      await onCreate({ name: trimmed, birthDate: birthDate === '' ? null : birthDate })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save')
      setSaving(false)
    }
  }

  return (
    <form className="onboarding" onSubmit={submit}>
      <div className="onboarding-mark">
        <NursingIcon size={30} />
      </div>

      <div className="section">
        <h1>Baby Tracker</h1>
        <p className="onboarding-lede">
          Feeds, sleep and diapers in one tap. Everything stays on this device.
        </p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="baby-name">
          Baby’s name
        </label>
        <input
          id="baby-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Mira"
          autoComplete="off"
          autoFocus
          required
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="baby-birthdate">
          Date of birth <span style={{ fontWeight: 400 }}>— optional</span>
        </label>
        <input
          id="baby-birthdate"
          type="date"
          value={birthDate}
          max={localDateKey(Date.now())}
          onChange={(event) => setBirthDate(event.target.value)}
        />
        <p className="settings-note">
          Used to show age and age-appropriate wake windows. You can add it later.
        </p>
      </div>

      {error !== null && (
        <p className="banner" data-tone="error" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="button"
        data-variant="primary"
        disabled={trimmed.length === 0 || saving}
      >
        {saving ? 'Setting up…' : 'Start tracking'}
      </button>

      <div className="onboarding-promise">
        <ul>
          <li>
            <ShieldIcon size={18} />
            <span>No account, no sign-up, no ads, no analytics.</span>
          </li>
          <li>
            <ShieldIcon size={18} />
            <span>Works fully offline. Your data never leaves this device.</span>
          </li>
          <li>
            <ShieldIcon size={18} />
            <span>Export or delete everything at any time.</span>
          </li>
        </ul>
      </div>
    </form>
  )
}
