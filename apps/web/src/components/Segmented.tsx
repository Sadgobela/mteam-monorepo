"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Segmented as AntSegmented } from "antd";

/** A row of mutually exclusive choices. Each one is a URL, and the highlight moves before the new page arrives. */
export function Segmented({
  label,
  options,
}: {
  label: string;
  options: { text: string; href: string; active: boolean }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [current, showCurrent] = useOptimistic(options.find((option) => option.active)?.href);
  return (
    <AntSegmented
      aria-label={label}
      value={current}
      options={options.map((option) => ({ label: option.text, value: option.href }))}
      onChange={(href) =>
        startTransition(() => {
          showCurrent(href);
          router.push(href, { scroll: false });
        })
      }
    />
  );
}
