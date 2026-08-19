import { useState } from 'react'
import type { Settings } from '@/app/settings'
import type { StashStore } from '@/app/useStash'
import type { StashEntry } from '@/domain/stash'
import type { Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  formatSpan,
  formatStashState,
  formatVolume,
  stashLocationName,
} from '@/i18n/format'
import { RuleLabel } from './RuleLabel'
import { StashSheet } from './StashSheet'
import { BackIcon, CheckIcon } from './icons'

interface StashScreenProps {
  stash: StashStore
  settings: Settings
  now: Timestamp
  onBack: () => void
}

/**
 * The milk stash, in the order to use it.
 *
 * Sorted by how much time each container has left against its own storage
 * guideline, so a fridge bottle with hours left outranks a frozen bag with months
 * left. That ordering is the feature; a plain list sorted by date would put the
 * oldest frozen bag first and quietly waste the fridge.
 */
export function StashScreen({ stash, settings, now, onBack }: StashScreenProps) {
  const t = useTranslator()
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const unit = settings.volumeUnit

  function announce(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 2200)
  }

  // Both of these await the write before saying it happened. Announcing first
  // would tell a parent their milk was logged as used even when the write failed.
  async function takeAll(entry: StashEntry) {
    await stash.use(entry.id, entry.amountMl)
    announce(t.t('toast.stashUsed', { amount: formatVolume(t, entry.amountMl, unit) }))
  }

  async function discard(entry: StashEntry) {
    await stash.discard(entry.id)
    announce(t.t('toast.stashDiscarded'))
  }

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('stash.title')}</span>
          {stash.totals.totalMl > 0 && (
            <span className="appbar-age num">
              {formatVolume(t, stash.totals.totalMl, unit)}
            </span>
          )}
        </div>
      </header>

      <main className="page">
        {stash.error !== null && (
          <p className="banner" data-tone="error" role="alert">
            {stash.error}
          </p>
        )}

        <section className="section">
          <RuleLabel>{t.t('stash.oldestFirst')}</RuleLabel>

          {stash.order.length === 0 ? (
            <>
              <p className="empty">{t.t('stash.empty')}</p>
              <p className="field-note">{t.t('stash.emptyHint')}</p>
            </>
          ) : (
            <>
              <p className="field-note num">
                {t.t('stash.totals', {
                  fridge: formatVolume(t, stash.totals.fridgeMl, unit),
                  freezer: formatVolume(t, stash.totals.freezerMl, unit),
                })}
              </p>
              <div className="stash-list">
                {stash.order.map((status) => (
                  <div
                    className="stash-row"
                    key={status.entry.id}
                    data-state={status.state}
                  >
                    <div className="stash-identity">
                      <span className="stash-amount num">
                        {formatVolume(t, status.entry.amountMl, unit)}
                      </span>
                      <span className="stash-meta">
                        {stashLocationName(t, status.entry.location)}
                        {' · '}
                        {/* The age comes from the computed duration, not from
                            trimming the word "ago" off a localized string — that
                            trick works in English and nowhere else. */}
                        {t.t('stash.age', { duration: formatSpan(t, status.ageMs) })}
                      </span>
                      <span className="stash-state">{formatStashState(t, status)}</span>
                    </div>
                    <div className="stash-actions">
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void takeAll(status.entry)}
                      >
                        {t.t('stash.useAll')}
                      </button>
                      <button
                        type="button"
                        className="chip"
                        onClick={() => void discard(status.entry)}
                      >
                        {t.t('stash.discard')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setAdding(true)}
          >
            {t.t('stash.add')}
          </button>

          {/* The figures are the CDC's, and this says so. The app shows dates; it
              does not tell anyone what to do with their milk. */}
          <p className="field-note">{t.t('stash.guidelineNote')}</p>
        </section>
      </main>

      {adding && (
        <StashSheet
          unit={unit}
          now={now}
          onSave={async (entry) => {
            await stash.add(entry)
            setAdding(false)
            announce(
              t.t('toast.stashAdded', { amount: formatVolume(t, entry.amountMl, unit) }),
            )
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {toast !== null && (
        <div className="toast" role="status" aria-live="polite">
          <CheckIcon size={16} />
          <span>{toast}</span>
        </div>
      )}
    </>
  )
}
