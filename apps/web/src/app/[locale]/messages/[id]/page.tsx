import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getConversation } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { ChatForm, LiveRefresh } from "@/components/ChatForm";
import { Header } from "@/components/Header";
import { sendChatAction } from "@/lib/chat-actions";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";
import type { Query } from "@/lib/url";
import { loginPath } from "@/lib/login-path";

export const dynamic = "force-dynamic";

export default async function ConversationPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<Query> }) {
  const { locale: raw, id } = await params;
  const locale = resolveLocale(raw);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/messages/${id}`));
  const chat = await getConversation(user.id, id);
  if (!chat) notFound();
  const t = getDictionary(locale);
  const failed = (await searchParams).failed === "1";
  // Georgia only, so times read the same for everyone.
  const time = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Tbilisi" });
  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="page chat">
        <div>
          <h1 className="heading">{chat.otherName ?? t.chat.someone}</h1>
          <Link href={`/${locale}/listings/${chat.listingId}`} className="meta">
            {chat.listingTitle}
          </Link>
        </div>
        <ol className="chat-thread">
          {chat.messages.map((message) => (
            <li key={message.id} data-mine={message.mine ? "" : undefined}>
              <p>{message.body}</p>
              <time className="meta" dateTime={message.at.toISOString()}>
                {time.format(message.at)}
              </time>
            </li>
          ))}
        </ol>
        {failed && (
          <p className="note" role="alert">
            {t.chat.failed}
          </p>
        )}
        <ChatForm key={chat.messages.filter((message) => message.mine).at(-1)?.id} action={sendChatAction} t={t} placeholder={t.chat.message}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="conversationId" value={chat.id} />
        </ChatForm>
        <LiveRefresh />
      </main>
    </>
  );
}
