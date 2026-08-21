import { useMemo, useState } from "react";
import type { Settings } from "@/app/settings";
import type { BabyStore } from "@/app/useBabyStore";
import {
  dailyTotals,
  dayWheel,
  detectDeviation,
  detectFeedCluster,
  nightSleepTrend,
  predictNextNap,
  type PredictionConfidence,
} from "@/domain/patterns";
import {
  HOUR_MS,
  MINUTE_MS,
  addDays,
  formatClock,
  startOfLocalDay,
} from "@/domain/time";
import type { Timestamp } from "@/domain/types";
import { useTranslator } from "@/i18n/context";
import { formatDuration, formatShortDate } from "@/i18n/format";
import type { MessageKey } from "@/i18n/locales";
import { DayWheel } from "./DayWheel";
import { RuleLabel } from "./RuleLabel";
import { BackIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

interface PatternsScreenProps {
  store: BabyStore;
  settings: Settings;
  now: Timestamp;
  onBack: () => void;
}

const CONFIDENCE_NOTES: Record<PredictionConfidence, MessageKey> = {
  low: "patterns.confidence.low",
  fair: "patterns.confidence.fair",
  good: "patterns.confidence.good",
};

/**
 * Patterns: the next nap, the shape of a day, and the week.
 *
 * Every figure here comes from this baby's own log and is computed on the device.
 * The screen says so, because "sleep predictions" is exactly the feature people
 * expect to be a cloud service reading their data.
 */
export function PatternsScreen({
  store,
  settings,
  now,
  onBack,
}: PatternsScreenProps) {
  const t = useTranslator();
  const { events } = store;
  const [dayAnchor, setDayAnchor] = useState<Timestamp>(() =>
    startOfLocalDay(now),
  );

  const prediction = useMemo(
    () => predictNextNap(events, now, settings.nightWindow),
    [events, now, settings.nightWindow],
  );
  const wheel = useMemo(
    () => dayWheel(events, dayAnchor, now),
    [events, dayAnchor, now],
  );
  const week = useMemo(() => dailyTotals(events, now), [events, now]);
  const trend = useMemo(() => nightSleepTrend(events, now), [events, now]);
  const cluster = useMemo(() => detectFeedCluster(events, now), [events, now]);
  const deviation = useMemo(() => detectDeviation(events, now), [events, now]);

  // Two different numbers. `observedPeak` is what the log actually holds and is
  // what the screen reports; `scale` is what the bars are drawn against, floored at
  // twelve hours. Normalising to the observed peak alone made the tallest column
  // full-height whatever it contained, so a week with one short nap in it drew an
  // identical chart to a week of solid nights.
  const observedPeak = Math.max(...week.map((day) => day.sleepMs), 0);
  const scale = Math.max(observedPeak, 12 * HOUR_MS);
  const anyLogged = week.some((day) => day.sleepMs > 0 || day.feeds > 0);
  const viewingToday = startOfLocalDay(now) === wheel.dayStart;

  return (
    <>
      <header className="appbar">
        <button type="button" className="icon-button" onClick={onBack}>
          <BackIcon />
          <span className="sr-only">{t.t("action.back")}</span>
        </button>
        <div className="appbar-identity">
          <span className="appbar-name">{t.t("patterns.title")}</span>
        </div>
      </header>

      <main className="page">
        {!anyLogged ? (
          <section className="section">
            <RuleLabel>{t.t("patterns.title")}</RuleLabel>
            <p className="empty">{t.t("patterns.noData")}</p>
            <p className="field-note">{t.t("patterns.noDataHint")}</p>
          </section>
        ) : (
          <>
            {prediction !== null && (
              <section className="section">
                <RuleLabel>{t.t("patterns.nextNapLabel")}</RuleLabel>
                <p className="patterns-headline num">
                  {formatClock(prediction.expectedAt, t.locale)}
                </p>
                <p className="patterns-detail">
                  {t.t("patterns.nextNapRange", {
                    from: formatClock(
                      prediction.expectedAt - prediction.spreadMs,
                      t.locale,
                    ),
                    to: formatClock(
                      prediction.expectedAt + prediction.spreadMs,
                      t.locale,
                    ),
                  })}
                </p>
                <p className="field-note">
                  {t.t("patterns.nextNapBasis", {
                    duration: formatDuration(t, prediction.typicalWakeWindowMs),
                    count: t.number(prediction.samples),
                  })}
                  {" · "}
                  {t.t(CONFIDENCE_NOTES[prediction.confidence])}
                </p>
                {prediction.expectedAt < now - MINUTE_MS && (
                  <p className="field-note">
                    {t.t("patterns.nextNapOverdue", {
                      duration: formatDuration(t, now - prediction.expectedAt),
                    })}
                  </p>
                )}
              </section>
            )}

            <section className="section">
              <RuleLabel
                actions={
                  <>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setDayAnchor((day) => addDays(day, -1))}
                    >
                      <ChevronLeftIcon size={18} />
                      <span className="sr-only">
                        {t.t("action.previousDay")}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setDayAnchor((day) => addDays(day, 1))}
                      disabled={viewingToday}
                    >
                      <ChevronRightIcon size={18} />
                      <span className="sr-only">{t.t("action.nextDay")}</span>
                    </button>
                  </>
                }
              >
                {viewingToday
                  ? t.t("patterns.dayWheel")
                  : formatShortDate(t.locale, wheel.dayStart)}
              </RuleLabel>

              <DayWheel wheel={wheel} />

              <ul className="wheel-legend">
                <li data-key="sleep">{t.t("patterns.legend.sleep")}</li>
                <li data-key="night">{t.t("patterns.legend.night")}</li>
                <li data-key="feed">{t.t("patterns.legend.feed")}</li>
                <li data-key="diaper">{t.t("patterns.legend.diaper")}</li>
              </ul>
            </section>

            <section className="section">
              <RuleLabel>{t.t("patterns.week")}</RuleLabel>
              {observedPeak === 0 ? (
                // Seven empty columns is a chart of nothing. One sentence says the
                // same thing and does not look like a rendering failure.
                <p className="empty">{t.t("patterns.weekNoSleep")}</p>
              ) : (
                <div
                  className="week-bars"
                  role="img"
                  aria-label={t.t("patterns.weekLabel", {
                    low: formatDuration(
                      t,
                      Math.min(...week.map((day) => day.sleepMs)),
                    ),
                    high: formatDuration(t, observedPeak),
                  })}
                >
                  {week.map((day) => (
                    <div className="week-bar" key={day.dayStart}>
                      {/* Night below, naps above: the stack shows at a glance whether
                        a short day was a lost nap or a broken night. */}
                      <div className="week-bar-track">
                        <div
                          className="week-bar-fill"
                          data-part="nap"
                          style={{ height: `${(day.napMs / scale) * 100}%` }}
                        />
                        <div
                          className="week-bar-fill"
                          data-part="night"
                          style={{ height: `${(day.nightMs / scale) * 100}%` }}
                        />
                      </div>
                      <span className="week-bar-label">
                        {new Intl.DateTimeFormat(t.locale, {
                          weekday: "narrow",
                        }).format(new Date(day.dayStart))}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {trend !== null && (
                <p className="patterns-detail">
                  {Math.abs(trend.deltaMs) < 15 * MINUTE_MS
                    ? t.t("patterns.trendSame")
                    : t.t(
                        trend.deltaMs > 0
                          ? "patterns.trendMore"
                          : "patterns.trendLess",
                        {
                          duration: formatDuration(t, Math.abs(trend.deltaMs)),
                        },
                      )}
                </p>
              )}
            </section>

            {(cluster !== null || deviation !== null) && (
              <section className="section">
                <RuleLabel>{t.t("patterns.notes")}</RuleLabel>
                {cluster !== null && (
                  <>
                    <p className="patterns-detail num">
                      {t.t("patterns.cluster", {
                        count: t.number(cluster.count),
                        duration: formatDuration(t, cluster.spanMs),
                      })}
                    </p>
                    <p className="field-note">{t.t("patterns.clusterNote")}</p>
                  </>
                )}
                {deviation !== null && (
                  <>
                    <p className="patterns-detail">
                      {t.t(
                        deviation.kind === "lessSleep"
                          ? "patterns.deviation.lessSleep"
                          : "patterns.deviation.moreSleep",
                        {
                          duration: formatDuration(
                            t,
                            Math.abs(deviation.deltaMs),
                          ),
                        },
                      )}
                    </p>
                    {/* Said every time the note appears: this is a remark about a
                        log, not a judgement about a child. */}
                    <p className="field-note">
                      {t.t("patterns.deviationNote")}
                    </p>
                  </>
                )}
              </section>
            )}
          </>
        )}

        <p className="field-note">{t.t("patterns.note")}</p>
      </main>
    </>
  );
}
