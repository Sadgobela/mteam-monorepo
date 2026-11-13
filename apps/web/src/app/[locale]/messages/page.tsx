import Link from "next/link";
import { redirect } from "next/navigation";
import { listConversations } from "@mteam/db";
import { getDictionary } from "@mteam/shared";
import { EmptyState } from "@/components/EmptyState";
import { Header } from "@/components/Header";
import { resolveLocale } from "@/lib/locale";
import { currentUser } from "@/lib/session";
import { loginPath } from "@/lib/login-path";

export const dynamic = "force-dynamic";

export default async function MessagesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await currentUser();
  if (!user) redirect(loginPath(locale, `/${locale}/messages`));
  const t = getDictionary(locale);
  const conversations = await listConversations(user.id);
  return (
    <>
      <Header locale={locale} t={t} signedIn />
      <main className="page">
        <h1 className="heading">{t.chat.heading}</h1>
        {conversations.length === 0 && <EmptyState text={t.chat.empty} />}
        <div className="chat-list">
          {conversations.map((chat) => (
            <Link key={chat.id} href={`/${locale}/messages/${chat.id}`} className="tile">
              <b>
                {chat.otherName ?? t.chat.someone} · {chat.listingTitle}
              </b>
              <span className="meta chat-preview">{chat.lastBody}</span>
              {chat.unread && <span className="saved-new">{t.chat.unread}</span>}
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
