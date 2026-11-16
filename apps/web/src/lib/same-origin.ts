/**
 * Whether a request was sent from another site's page. Browsers name the sending page's origin on every POST, so a form or script
 * elsewhere cannot use a signed-in visitor's cookie here. A request without the header, such as from a script, is not a browser's.
 */
export function isCrossSite(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin === null) return false;
  return URL.parse(origin)?.host !== new URL(request.url).host;
}
