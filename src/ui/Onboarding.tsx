import { useState } from 'react'
import { localDateKey } from '@/domain/time'
import { useTranslator } from '@/i18n/context'
import { RuleLabel } from './RuleLabel'
import { ShieldIcon } from './icons'

interface OnboardingProps {
  onCreate: (input: { name: string; birthDate: string | null }) => Promise<void>
}

/**
 * The whole of setup: a name, and optionally a birth date. No account, no email,
 * no "allow notifications" — the first screen is where a tracker either earns
 * trust or spends it.
 */
export function Onboarding({ onCreate }: OnboardingProps) {
  const t = useTranslator()
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
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <form className="onboarding" onSubmit={submit}>
      {/* A rounded icon tile stacked above a heading is the catalogued
          `icon-tile-stack` tell. The signature rule carries the mark instead. */}
      <div className="section">
        <RuleLabel>{t.t('app.name')}</RuleLabel>
        <h1>{t.t('onboarding.tagline')}</h1>
        <p className="onboarding-lede">{t.t('onboarding.lede')}</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="baby-name">
          {t.t('onboarding.name.label')}
        </label>
        <input
          id="baby-name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.t('onboarding.name.placeholder')}
          autoComplete="off"
          autoFocus
          required
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="baby-birthdate">
          {t.t('onboarding.birthDate.label')}{' '}
          <span style={{ fontWeight: 400 }}>{t.t('onboarding.birthDate.optional')}</span>
        </label>
        <input
          id="baby-birthdate"
          type="date"
          value={birthDate}
          max={localDateKey(Date.now())}
          onChange={(event) => setBirthDate(event.target.value)}
        />
        <p className="field-note">{t.t('onboarding.birthDate.note')}</p>
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
        {t.t(saving ? 'onboarding.submitting' : 'onboarding.submit')}
      </button>

      <div className="onboarding-promise">
        <ul>
          <li>
            <ShieldIcon size={18} />
            <span>{t.t('onboarding.promise.noAccount')}</span>
          </li>
          <li>
            <ShieldIcon size={18} />
            <span>{t.t('onboarding.promise.offline')}</span>
          </li>
          <li>
            <ShieldIcon size={18} />
            <span>{t.t('onboarding.promise.export')}</span>
          </li>
        </ul>
      </div>
    </form>
  )
}
