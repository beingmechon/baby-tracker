import { useMemo, useState } from 'react'
import type { BabyStore } from '@/app/useBabyStore'
import {
  allergenStatuses,
  allergensOffered,
  foodNames,
  foodSummaries,
  recentFoods,
} from '@/domain/food'
import type { Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  allergenName,
  foodAcceptanceName,
  formatAgo,
  formatShortDate,
} from '@/i18n/format'
import { FoodSheet } from './FoodSheet'
import { RuleLabel } from './RuleLabel'
import { BackIcon, CheckIcon } from './icons'

interface FoodScreenProps {
  store: BabyStore
  now: Timestamp
  onBack: () => void
}

/**
 * Solids, and where the nine major allergens stand.
 *
 * The allergen grid is the reason the screen exists. "Has she had egg yet?" is asked
 * at every appointment from six months and no parent can answer it from memory, and
 * twelve scattered food entries do not answer it either — nine rows do.
 *
 * Every figure comes from what the parent tagged. Nothing here infers what a food
 * contains, and "no reaction noted" is worded as the absence of a record rather than
 * as tolerance, which is a clinical conclusion this app is in no position to draw.
 */
export function FoodScreen({ store, now, onBack }: FoodScreenProps) {
  const t = useTranslator()
  const { events } = store
  const [logging, setLogging] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const summaries = useMemo(() => foodSummaries(events), [events])
  const knownNames = useMemo(() => foodNames(events), [events])
  const statuses = useMemo(() => allergenStatuses(events), [events])
  const offered = useMemo(() => allergensOffered(events), [events])
  const recent = useMemo(() => recentFoods(events, now), [events, now])

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('food.title')}</span>
        </div>
      </header>

      <main className="page">
        <section className="section">
          <RuleLabel>{t.t('food.allergenTitle')}</RuleLabel>
          <p className="allergen-count num">
            {t.t('food.allergenProgress', {
              offered: t.number(offered),
              total: t.number(statuses.length),
            })}
          </p>

          <dl className="allergens">
            {statuses.map((status) => (
              <div className="allergen" key={status.allergen} data-state={status.state}>
                <dt className="allergen-name">{allergenName(t, status.allergen)}</dt>
                <dd className="allergen-state">
                  {status.state === 'notTried' ? (
                    t.t('food.allergenNotTried')
                  ) : (
                    <>
                      <span className="allergen-verdict">
                        {status.state === 'reacted'
                          ? t.t('food.allergenReacted')
                          : t.t('food.allergenNoReaction')}
                      </span>
                      <span className="allergen-detail num">
                        {t.plural('food.tried', status.times)}
                        {status.foods.length > 0 && ` · ${status.foods[0]}`}
                      </span>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {statuses.some((status) => status.state === 'reacted') && (
            <p className="field-note">{t.t('food.allergenReactedNote')}</p>
          )}
          {/* Where the list comes from, and what it is not. */}
          <p className="field-note">{t.t('food.allergenNote')}</p>
        </section>

        <section className="section">
          <RuleLabel>{t.t('food.foodsTried')}</RuleLabel>

          {summaries.length === 0 ? (
            <>
              <p className="empty">{t.t('food.empty')}</p>
              <p className="field-note">{t.t('food.emptyHint')}</p>
            </>
          ) : (
            <div className="food-list">
              {summaries.slice(0, 20).map((summary) => (
                <div className="food-row" key={summary.name} data-reacted={summary.reacted}>
                  <div className="food-identity">
                    <span className="food-name">{summary.name}</span>
                    <span className="food-meta num">
                      {t.plural('food.tried', summary.times)}
                      {' · '}
                      {t.t('food.lastOffered', {
                        ago: formatAgo(t, summary.lastOfferedAt, now),
                      })}
                    </span>
                  </div>
                  {summary.reacted && (
                    <span className="food-flag">{t.t('food.reactionShort')}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setLogging(true)}
          >
            {t.t('food.log')}
          </button>
        </section>

        {recent.length > 0 && (
          <section className="section">
            <RuleLabel>{t.t('food.thisWeek')}</RuleLabel>
            <div className="timeline">
              {recent.map((event) => (
                <div className="timeline-row" key={event.id}>
                  <span className="timeline-time">
                    {formatShortDate(t.locale, event.startedAt)}
                  </span>
                  <span className="timeline-mark" data-category="food" aria-hidden="true" />
                  <span className="timeline-body">
                    <span className="timeline-title">{event.name}</span>
                    <span className="timeline-detail">
                      {' · '}
                      {foodAcceptanceName(t, event.acceptance)}
                      {event.allergens.length > 0 &&
                        ` · ${event.allergens
                          .map((allergen) => allergenName(t, allergen))
                          .join(', ')}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {logging && (
        <FoodSheet
          knownNames={knownNames}
          onSave={async (input) => {
            await store.logFood({ ...input, startedAt: Date.now() })
            setLogging(false)
            setToast(t.t('toast.foodSaved'))
            globalThis.setTimeout(() => setToast(null), 2200)
          }}
          onClose={() => setLogging(false)}
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
