"use client";

import { useState } from "react";
import Link from "next/link";
import { assistantChoices, nextAssistantStep, type AssistantChoice, type AssistantStep, type Dict, type Locale } from "@mteam/shared";
import { countSearchAction } from "@/lib/search-actions";

interface Answer extends AssistantChoice {
  step: AssistantStep;
}

const searchOf = (answers: Answer[]) => new URLSearchParams(Object.assign({}, ...answers.map((answer) => answer.params))).toString();

/** A chat that asks what the visitor is looking for, one question at a time, and leads to the matching results. */
export function SearchAssistant({ locale, t }: { locale: Locale; t: Dict }) {
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [count, setCount] = useState<{ search: string; total: number }>();
  const search = searchOf(answers);
  const params: Record<string, string> = Object.fromEntries(new URLSearchParams(search));
  const step = nextAssistantStep(
    answers.map((answer) => answer.step),
    params,
  );

  const answer = (next: Answer[]) => {
    setAnswers(next);
    const nextSearch = searchOf(next);
    if (nextSearch) void countSearchAction(nextSearch).then((total) => setCount({ search: nextSearch, total }));
  };

  return (
    <section className="assistant" aria-labelledby="assistant-heading">
      <h1 id="assistant-heading">{t.assistant.heading}</h1>
      <ol className="assistant-log" aria-live="polite">
        <li className="bot">{t.assistant.greeting}</li>
        {answers.map((given, index) => (
          <li key={given.step} className="pair">
            <span className="bot">{t.assistant.questions[given.step]}</span>
            <button type="button" className="me" aria-label={t.assistant.change.replace("{answer}", given.label)} onClick={() => answer(answers.slice(0, index))}>
              {given.label}
            </button>
          </li>
        ))}
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
      </ol>
      {search && (
        <div className="assistant-actions">
          <Link href={`/${locale}?${search}`} className="btn">
            {count?.search === search ? t.assistant.show.replace("{count}", String(count.total)) : t.assistant.showResults}
          </Link>
          <button type="button" className="btn ghost" onClick={() => answer([])}>
            {t.assistant.restart}
          </button>
        </div>
      )}
    </section>
  );
}
