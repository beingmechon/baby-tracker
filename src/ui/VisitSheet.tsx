import { useState } from 'react'
import type { Timestamp, VisitQuestion } from '@/domain/types'
import { useTranslator } from '@/i18n/context'
import { Sheet } from './Sheet'
import { fromDateTimeInputs, toDateInputValue, toTimeInputValue } from './datetimeInput'
import { CloseIcon } from './icons'

interface VisitSheetProps {
  now: Timestamp
  onSave: (input: {
    reason: string
    who: string
    note: string
    questions: VisitQuestion[]
    startedAt: Timestamp
  }) => Promise<void>
  onClose: () => void
}

/**
 * An appointment, and the questions to take to it.
 *
 * The date defaults to now but is fully editable forwards, which makes this the one
 * sheet in the app that routinely records something that has not happened yet. That
 * is the point: a question is written down at 3am and asked next Tuesday, and an app
 * that only accepted the past would lose it.
 */
export function VisitSheet({ now, onSave, onClose }: VisitSheetProps) {
  const t = useTranslator()
  const [reason, setReason] = useState('')
  const [who, setWho] = useState('')
  const [note, setNote] = useState('')
  const [date, setDate] = useState(() => toDateInputValue(now))
  const [time, setTime] = useState(() => toTimeInputValue(now))
  const [questions, setQuestions] = useState<string[]>([''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setQuestion(index: number, text: string) {
    setQuestions((current) => current.map((q, i) => (i === index ? text : q)))
  }

  async function save() {
    if (saving) return
    const trimmedReason = reason.trim()
    if (trimmedReason.length === 0) {
      setError(t.t('error.enterVisitReason'))
      return
    }
    const startedAt = fromDateTimeInputs(date, time)
    if (startedAt === null) {
      setError(t.t('error.invalidStart'))
      return
    }
    setSaving(true)
    try {
      await onSave({
        reason: trimmedReason,
        who: who.trim(),
        note: note.trim(),
        // Blank rows are how an empty last field looks; they are not questions.
        questions: questions
          .map((text) => text.trim())
          .filter((text) => text.length > 0)
          .map((text) => ({ text, asked: false })),
        startedAt,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.t('error.couldNotSave'))
      setSaving(false)
    }
  }

  return (
    <Sheet title={t.t('visit.title')} onClose={onClose}>
      <div className="field">
        <label className="field-label" htmlFor="visit-reason">
          {t.t('visit.reason')}
        </label>
        <input
          id="visit-reason"
          type="text"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t.t('visit.reasonPlaceholder')}
          autoComplete="off"
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="visit-who">
          {t.t('visit.who')}
          <span style={{ fontWeight: 400 }}> {t.t('visit.whoOptional')}</span>
        </label>
        <input
          id="visit-who"
          type="text"
          value={who}
          onChange={(event) => setWho(event.target.value)}
          placeholder={t.t('visit.whoPlaceholder')}
          autoComplete="off"
        />
      </div>

      <div className="button-row">
        <div className="field">
          <label className="field-label" htmlFor="visit-date">
            {t.t('edit.date')}
          </label>
          <input
            id="visit-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="visit-time">
            {t.t('edit.time')}
          </label>
          <input
            id="visit-time"
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <span className="field-label" id="visit-questions-label">
          {t.t('visit.questions')}
        </span>
        <div className="question-rows" role="group" aria-labelledby="visit-questions-label">
          {questions.map((question, index) => (
            <div className="question-row" key={index}>
              <input
                type="text"
                value={question}
                onChange={(event) => setQuestion(index, event.target.value)}
                placeholder={t.t('visit.questionPlaceholder')}
                aria-label={t.t('visit.questionPlaceholder')}
                autoComplete="off"
              />
              {questions.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  onClick={() =>
                    setQuestions((current) => current.filter((_, i) => i !== index))
                  }
                >
                  <CloseIcon size={18} />
                  <span className="sr-only">{t.t('visit.removeQuestion')}</span>
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          className="button"
          onClick={() => setQuestions((current) => [...current, ''])}
        >
          {t.t('visit.addQuestion')}
        </button>
        <p className="field-note">{t.t('visit.questionsHint')}</p>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="visit-notes">
          {t.t('visit.notes')}
        </label>
        <textarea
          id="visit-notes"
          rows={3}
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t.t('visit.notesPlaceholder')}
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
        {t.t('visit.save')}
      </button>
    </Sheet>
  )
}
