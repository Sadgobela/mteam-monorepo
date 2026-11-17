import { MARK_PATH, WORDMARK_PATH } from "@mteam/shared";

/** The official logo, traced exactly from the designer's vector file. Its colour comes from the --logo token. */
export function Logo() {
  return (
    <svg className="logo" viewBox="0 0 988.47 319.89" width={111} height={36} preserveAspectRatio="xMinYMid slice" fill="currentColor" aria-hidden="true">
      <path d={MARK_PATH} />
      <path d={WORDMARK_PATH} />
    </svg>
  );
}
