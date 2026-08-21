import { useMemo, useState } from 'react'
import type { BabyStore } from '@/app/useBabyStore'
import {
  questionProgress,
  splitVisits,
  symptomEpisodes,
  symptomNames,
  symptomsForVisit,
} from '@/domain/illness'
import { formatClock } from '@/domain/time'
import type { DoctorVisitEvent, Timestamp } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import {
  formatShortDate,
  formatSpan,
  symptomImpressionName,
} from '@/i18n/format'
import { RuleLabel } from './RuleLabel'
import { SymptomSheet } from './SymptomSheet'
import { VisitSheet } from './VisitSheet'
import { BackIcon, CheckIcon, PrintIcon } from './icons'

/** `note` is optional on every event, so undefined has to be folded to empty. */
function noteOf(event: { note?: string }): string {
  return event.note ?? ''
}

interface IllnessScreenProps {
  store: BabyStore
  now: Timestamp
  onBack: () => void
}

/**
 * The symptom diary and doctor visits.
 *
 * Built around the two questions a doctor opens with — "when did this start?" and
 * "how has it been since?" — which are the two questions a parent who has not slept
 * in six weeks cannot answer. Entries group into episodes so the answer is "cough,
 * four days, worse yesterday" rather than twelve separate lines.
 *
 * The app records and prints. It does not assess: no entry here is scored, ranked or
 * flagged, and the impression beside a symptom is the parent's own word.
 */
export function IllnessScreen({ store, now, onBack }: IllnessScreenProps) {
  const t = useTranslator()
  const { events } = store
  const [sheet, setSheet] = useState<'symptom' | 'visit' | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const episodes = useMemo(() => symptomEpisodes(events, now), [events, now])
  const knownNames = useMemo(() => symptomNames(events, now), [events, now])
  const { upcoming, past } = useMemo(() => splitVisits(events, now), [events, now])
  const recent = useMemo(() => symptomsForVisit(events, now), [events, now])

  function announce(message: string) {
    setToast(message)
    globalThis.setTimeout(() => setToast(null), 2200)
  }

  /**
   * Ticking a question off in the room. Awaited before the toast: telling a parent
   * it is done while the write is still in flight is how a list lies to them.
   */
  async function tickQuestion(visit: DoctorVisitEvent, index: number) {
    const questions = visit.questions.map((question, i) =>
      i === index ? { ...question, asked: !question.asked } : question,
    )
    await store.updateEvent(visit.id, { questions } as Partial<DoctorVisitEvent>)
    announce(t.t('toast.questionAsked'))
  }

  function renderVisit(visit: DoctorVisitEvent, tense: 'upcoming' | 'past') {
    const progress = questionProgress(visit)
    const delta = Math.abs(visit.startedAt - now)

    return (
      <div className="visit" key={visit.id}>
        <div className="visit-head">
          <span className="visit-reason">{visit.reason}</span>
          <span className="visit-when num">
            {formatShortDate(t.locale, visit.startedAt)}
            {' · '}
            {formatClock(visit.startedAt, t.locale)}
          </span>
        </div>
        <p className="visit-meta">
          {tense === 'upcoming'
            ? t.t('visit.in', { duration: formatSpan(t, delta) })
            : t.t('visit.ago', { duration: formatSpan(t, delta) })}
          {visit.who !== '' && ` · ${visit.who}`}
          {progress.total > 0 &&
            ` · ${t.t('visit.questionsProgress', {
              asked: t.number(progress.asked),
              total: t.number(progress.total),
            })}`}
        </p>

        {visit.questions.length > 0 && (
          <ul className="questions">
            {visit.questions.map((question, index) => (
              <li className="question" key={`${visit.id}-${index}`}>
                {/* A checkbox, not a chip: this is the one list in the app that gets
                    ticked off one-handed while someone is talking to you. */}
                <label className="question-label">
                  <input
                    type="checkbox"
                    checked={question.asked}
                    onChange={() => void tickQuestion(visit, index)}
                  />
                  <span data-asked={question.asked}>{question.text}</span>
                </label>
              </li>
            ))}
          </ul>
        )}

        {noteOf(visit) !== '' && <p className="visit-notes">{noteOf(visit)}</p>}
      </div>
    )
  }

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t('action.back')}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t('health.symptomsAndVisits')}</span>
        </div>
      </header>

      <main className="page">
        <section className="section">
          <RuleLabel>{t.t('symptom.title')}</RuleLabel>

          {episodes.length === 0 ? (
            <>
              <p className="empty">{t.t('symptom.empty')}</p>
              <p className="field-note">{t.t('symptom.emptyHint')}</p>
            </>
          ) : (
            <div className="episodes">
              {episodes.map((episode) => (
                <div
                  className="episode"
                  key={`${episode.name}-${episode.startedAt}`}
                  data-ongoing={episode.ongoing}
                >
                  <div className="episode-head">
                    <span className="episode-name">{episode.name}</span>
                    <span className="episode-worst">
                      {symptomImpressionName(t, episode.worst)}
                    </span>
                  </div>
                  <p className="episode-meta num">
                    {t.t('symptom.since', {
                      duration: formatSpan(t, now - episode.startedAt),
                    })}
                    {' · '}
                    {t.plural('symptom.entries', episode.entries.length)}
                    {episode.ongoing
                      ? ` · ${t.t('symptom.ongoing')}`
                      : ` · ${t.t('symptom.lastNoted', {
                          duration: formatSpan(t, now - episode.lastNotedAt),
                        })}`}
                  </p>

                  <div className="episode-entries">
                    {[...episode.entries]
                      .sort((a, b) => b.startedAt - a.startedAt)
                      .slice(0, 6)
                      .map((entry) => (
                        <div className="episode-entry" key={entry.id}>
                          <span className="episode-entry-when num">
                            {formatShortDate(t.locale, entry.startedAt)}
                          </span>
                          <span className="episode-entry-body">
                            {symptomImpressionName(t, entry.impression)}
                            {noteOf(entry) !== '' && (
                              <span className="episode-entry-note">
                                {noteOf(entry)}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setSheet('symptom')}
          >
            {t.t('symptom.log')}
          </button>
        </section>

        <section className="section">
          <RuleLabel>{t.t('visit.title')}</RuleLabel>

          {upcoming.length === 0 && past.length === 0 ? (
            <>
              <p className="empty">{t.t('visit.empty')}</p>
              <p className="field-note">{t.t('visit.emptyHint')}</p>
            </>
          ) : (
            <>
              {upcoming.length > 0 && (
                <>
                  <p className="visit-group">{t.t('visit.upcoming')}</p>
                  {upcoming.map((visit) => renderVisit(visit, 'upcoming'))}
                </>
              )}
              {past.length > 0 && (
                <>
                  <p className="visit-group">{t.t('visit.past')}</p>
                  {past.slice(0, 5).map((visit) => renderVisit(visit, 'past'))}
                </>
              )}
            </>
          )}

          <button
            type="button"
            className="button"
            data-variant="primary"
            onClick={() => setSheet('visit')}
          >
            {t.t('visit.log')}
          </button>
        </section>

        {/*
          * The printed sheet. Everything below is on screen too, but this section is
          * what survives the print stylesheet: the questions and the recent
          * symptoms, which are the two things you are asked for across a desk.
          */}
        <section className="section print-sheet">
          <RuleLabel>{t.t('visit.recentSymptoms')}</RuleLabel>
          {recent.length === 0 ? (
            <p className="empty">{t.t('visit.noSymptoms')}</p>
          ) : (
            <div className="timeline">
              {recent.map((entry) => (
                <div className="timeline-row" key={entry.id}>
                  <span className="timeline-time">
                    {formatShortDate(t.locale, entry.startedAt)}
                  </span>
                  <span
                    className="timeline-mark"
                    data-category="health"
                    aria-hidden="true"
                  />
                  <span className="timeline-body">
                    <span className="timeline-title">{entry.name}</span>
                    <span className="timeline-detail">
                      {' · '}
                      {symptomImpressionName(t, entry.impression)}
                      {noteOf(entry) !== '' && ` · ${noteOf(entry)}`}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="button" onClick={() => globalThis.print()}>
            <PrintIcon size={18} />
            {t.t('visit.print')}
          </button>
          <p className="field-note">{t.t('visit.printNote')}</p>
        </section>
      </main>

      {sheet === 'symptom' && (
        <SymptomSheet
          knownNames={knownNames}
          onSave={async (input) => {
            await store.logSymptom({ ...input, startedAt: Date.now() })
            setSheet(null)
            announce(t.t('toast.symptomSaved'))
          }}
          onClose={() => setSheet(null)}
        />
      )}

      {sheet === 'visit' && (
        <VisitSheet
          now={now}
          onSave={async (input) => {
            await store.logVisit(input)
            setSheet(null)
            announce(t.t('toast.visitSaved'))
          }}
          onClose={() => setSheet(null)}
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
