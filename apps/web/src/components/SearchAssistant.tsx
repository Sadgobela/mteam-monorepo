"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import {
  assistantChoices,
  nextAssistantStep,
  parseListingFilters,
  type AssistantChoice,
  type AssistantStep,
  type Dict,
  type Locale,
} from "@mteam/shared";
import { askAssistantAction, countSearchAction, type AskResult } from "@/lib/search-actions";
import { filterLabels } from "./FilterChips";
import { LeadForm } from "./LeadForm";
import { SubmitButton } from "./SubmitButton";

/** A button pressed for a question, or text typed by the visitor, which carries the whole search the AI understood. */
interface Answer extends AssistantChoice {
  step: AssistantStep | "text";
}

/** Typed text replaces the search so far, since it can also remove filters; a button adds to it. */
const paramsOf = (answers: Answer[]) =>
  answers.reduce<Record<string, string>>((params, answer) => (answer.step === "text" ? { ...answer.params } : { ...params, ...answer.params }), {});

const asked = (answers: Answer[]) => answers.flatMap((answer) => (answer.step === "text" ? [] : [answer.step]));

/** A chat that asks what the visitor is looking for, one question at a time, and leads to the matching results. With `ai`, it also reads typed text. */
export function SearchAssistant({ locale, t, gelPerUsd, ai = false }: { locale: Locale; t: Dict; gelPerUsd: number; ai?: boolean }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [count, setCount] = useState<{ search: string; total: number }>();
  const [text, setText] = useState("");
  const [error, setError] = useState<Exclude<AskResult, { search: string }>["error"]>();
  const [reading, startReading] = useTransition();
  const params = paramsOf(answers);
  const search = new URLSearchParams(params).toString();
  const step = nextAssistantStep(asked(answers), params);

  const answer = (next: Answer[]) => {
    setAnswers(next);
    setError(undefined);
    const nextSearch = new URLSearchParams(paramsOf(next)).toString();
    if (nextSearch) void countSearchAction(nextSearch).then((total) => setCount({ search: nextSearch, total }));
  };

  const ask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    startReading(async () => {
      const result = await askAssistantAction(message, search);
      if ("error" in result) return setError(result.error);
      setText("");
      answer([...answers, { step: "text", label: message, params: Object.fromEntries(new URLSearchParams(result.search)) }]);
    });
  };

  const understood = (given: Answer) =>
    filterLabels(locale, t, given.params, parseListingFilters(given.params), gelPerUsd)
      .map(([, label]) => label)
      .join(" · ");

  return (
    <section className="assistant" aria-labelledby="assistant-heading">
      <h1 id="assistant-heading">{t.assistant.heading}</h1>
      <ol className="assistant-log" aria-live="polite">
        <li className="bot">{ai ? t.assistant.greetingAi : t.assistant.greeting}</li>
        {answers.map((given, index) => {
          const back = (
            <button type="button" className="me" aria-label={t.assistant.change.replace("{answer}", given.label)} onClick={() => answer(answers.slice(0, index))}>
              {given.label}
            </button>
          );
          return (
            <li key={index} className="pair">
              {given.step === "text" ? (
                <>
                  {back}
                  <span className="bot">
                    {t.assistant.understood} {understood(given)}
                  </span>
                </>
              ) : (
                <>
                  <span className="bot">{t.assistant.questions[given.step]}</span>
                  {back}
                </>
              )}
            </li>
          );
        })}
        <li className="bot">
          {step ? t.assistant.questions[step] : t.assistant.done}
          {step && (
            <span className="assistant-choices">
              {assistantChoices(step, params, t, locale).map((choice) => (
                <button key={choice.label} type="button" onClick={() => answer([...answers, { ...choice, step }])}>
                  {choice.label}
                </button>
              ))}
            </span>
          )}
        </li>
        {reading && <li className="bot">{t.assistant.thinking}</li>}
      </ol>
      {ai && (
        <form className="assistant-input" onSubmit={ask}>
          <input aria-label={t.assistant.message} placeholder={t.assistant.placeholder} value={text} maxLength={300} onChange={(event) => setText(event.target.value)} />
          <SubmitButton pending={reading}>{t.assistant.send}</SubmitButton>
        </form>
      )}
      {error && (
        <p className="note" role="alert">
          {t.assistant[error]}
        </p>
      )}
      {search && (
        <div className="assistant-actions">
          {/* Spins while the matches are counted; the link works all along. */}
          <Link href={`/${locale}?${search}`} className="btn" aria-busy={count?.search !== search || undefined}>
            {count?.search === search ? t.assistant.show.replace("{count}", String(count.total)) : t.assistant.showResults}
          </Link>
          <button type="button" className="btn ghost" onClick={() => answer([])}>
            {t.assistant.restart}
          </button>
        </div>
      )}
      {!step && (
        <details className="assistant-broker">
          <summary>{t.assistant.broker}</summary>
          <LeadForm t={t} seek={{ search, deal: params.deal }} />
        </details>
      )}
    </section>
  );
}
