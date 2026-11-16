import { redirect } from "next/navigation";
import { getPreferences, listDevices, listPushEndpoints } from "@mteam/db";
import { getDictionary, type Dict } from "@mteam/shared";
import { ActionForm } from "@/components/ActionForm";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { PreferenceSwitch } from "@/components/PreferenceSwitch";
import { PushDevice } from "@/components/PushDevice";
import { SubmitButton } from "@/components/SubmitButton";
import { resolveLocale } from "@/lib/locale";
import { loginPath } from "@/lib/login-path";
import { vapidPublicKey } from "@/lib/push";
import { currentUser, sessionToken } from "@/lib/session";
import { deleteAccountAction, signOutDeviceAction, signOutOthersAction } from "@/lib/settings-actions";
import "@/app/settings.css";

export const dynamic = "force-dynamic";

// First match wins, so the browsers built on Chrome come before it, Chrome before Safari, and iPhone before Mac.
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Firefox\/|FxiOS/, "Firefox"],
  [/Chrome\/|CriOS/, "Chrome"],
  [/Safari\//, "Safari"],
];
const SYSTEMS: [RegExp, string][] = [
  [/iPhone/, "iPhone"],
  [/iPad/, "iPad"],
  [/Android/, "Android"],
  [/Windows/, "Windows"],
  [/CrOS/, "ChromeOS"],
  [/Macintosh|Mac OS X/, "Mac"],
  [/Linux/, "Linux"],
];
const pick = (list: [RegExp, string][], text: string) => list.find(([pattern]) => pattern.test(text))?.[1];

/** A device in plain words, such as "Chrome on Mac", from what the browser said about itself at sign-in. */
function deviceName(userAgent: string | null, s: Dict["settings"]): string {
  const browser = pick(BROWSERS, userAgent ?? "");
  const os = pick(SYSTEMS, userAgent ?? "");
  if (browser && os) return s.deviceOn.replace("{browser}", browser).replace("{os}", os);
  return browser ?? os ?? s.unknownDevice;
}

export default async function SettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  const token = await sessionToken();
  if (!user || !token) redirect(loginPath(locale, `/${locale}/account/settings`));
  const t = getDictionary(locale);
  const s = t.settings;
  // Push shows only once the site has its VAPID keys.
  const publicKey = vapidPublicKey();
  const [preferences, devices, pushEndpoints] = await Promise.all([getPreferences(user.id), listDevices(user.id, token), publicKey ? listPushEndpoints(user.id) : []]);
  const time = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Tbilisi" });
  const localeField = <input type="hidden" name="locale" value={locale} />;
  const notify = (["notifyMessages", "notifySavedSearches", "notifyPriceDrops", "notifyListingUpdates"] as const).map((name) => (
    <PreferenceSwitch key={name} name={name} label={s[name]} checked={preferences[name]} failed={s.saveFailed} saved={t.feedback.saved} />
  ));

  return (
    <main className="account-main narrow settings">
      <h1 className="heading">{t.account.settings}</h1>

      <section className="settings-card" aria-labelledby="settings-notifications">
        <h2 id="settings-notifications">{s.notificationsHeading}</h2>
        <p className="settings-hint">{s.notificationsNote}</p>
        {notify}
      </section>

      {publicKey && (
        <section className="settings-card" aria-labelledby="settings-push">
          <h2 id="settings-push">{t.push.heading}</h2>
          <p className="settings-hint">{t.push.intro}</p>
          <PushDevice publicKey={publicKey} locale={locale} endpoints={pushEndpoints} copy={t.push} />
          <PreferenceSwitch name="notifyPush" label={t.push.allDevices} hint={t.push.allDevicesHint} checked={preferences.notifyPush} failed={s.saveFailed} />
        </section>
      )}

      <section className="settings-card" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy">{s.privacyHeading}</h2>
        <PreferenceSwitch name="hidePhoneDefault" label={s.hidePhoneDefault} hint={s.hidePhoneHint} checked={preferences.hidePhoneDefault} failed={s.saveFailed} saved={t.feedback.saved} />
      </section>

      <section className="settings-card" aria-labelledby="settings-devices">
        <h2 id="settings-devices">{s.devicesHeading}</h2>
        <ul className="settings-devices">
          {devices.map((device) => (
            <li key={device.id}>
              <div>
                <b>{deviceName(device.userAgent, s)}</b>
                {device.current && <span className="settings-badge">{s.thisDevice}</span>}
                <div className="settings-hint">{s.lastSeen.replace("{date}", time.format(device.lastSeenAt))}</div>
              </div>
              {!device.current && (
                <form action={signOutDeviceAction}>
                  {localeField}
                  <input type="hidden" name="id" value={device.id} />
                  <SubmitButton className="btn ghost">{s.signOut}</SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
        {devices.some((device) => !device.current) && (
          <form action={signOutOthersAction}>
            {localeField}
            <SubmitButton className="btn ghost">{s.signOutOthers}</SubmitButton>
          </form>
        )}
      </section>

      <section className="settings-card" aria-labelledby="settings-delete">
        <h2 id="settings-delete">{s.deleteHeading}</h2>
        {user.role === "USER" ? (
          <>
            <p className="settings-hint">{s.deleteIntro}</p>
            <ul className="settings-consequences">
              {s.deleteWhat.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <ActionForm action={deleteAccountAction} failed={t.feedback.failed}>
              {localeField}
              <ConfirmSubmit label={s.deleteButton} question={s.deleteQuestion} yes={s.deleteYes} no={s.deleteNo} name="confirm" value="yes" />
            </ActionForm>
          </>
        ) : (
          <p className="settings-hint">{s.deleteStaff}</p>
        )}
      </section>
    </main>
  );
}
