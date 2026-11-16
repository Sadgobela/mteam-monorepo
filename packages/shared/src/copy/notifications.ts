// Copy for one part of the site, kept in its own file so parallel work does not collide in i18n.ts.
const ka = {
  heading: "შეტყობინებები",
  bell: "შეტყობინებები",
  bellUnread: "შეტყობინებები, წაუკითხავი: {count}",
  empty: "ჯერ არაფერია. აქ გამოჩნდება ახალი წერილები, შენი განცხადებების ამბები, რჩეულების გაიაფება და შენახული ძიებების ახალი განცხადებები.",
  markAllRead: "ყველას წაკითხულად მონიშვნა",
  unread: "ახალი",
  message: "ახალი წერილი: {count}",
  approved: "შენი განცხადება გამოქვეყნდა",
  rejected: "შენი განცხადება არ დამტკიცდა",
  expiring: "შენი განცხადების ვადა იწურება {date}. განაახლე, რომ საიტზე დარჩეს.",
  priceDrop: "რჩეული გაიაფდა: {old} → {new}",
  searchMatches: "ახალი განცხადებები შენახულ ძიებაში: {count}",
};

const en: typeof ka = {
  heading: "Notifications",
  bell: "Notifications",
  bellUnread: "Notifications, {count} unread",
  empty: "Nothing yet. This is where you will hear about new messages, your listings, price drops on favourites and new listings for your saved searches.",
  markAllRead: "Mark all as read",
  unread: "New",
  message: "New messages: {count}",
  approved: "Your listing is published",
  rejected: "Your listing was not approved",
  expiring: "Your listing ends on {date}. Renew it to keep it on the site.",
  priceDrop: "A favourite got cheaper: {old} → {new}",
  searchMatches: "New listings for your saved search: {count}",
};

const ru: typeof ka = {
  heading: "Уведомления",
  bell: "Уведомления",
  bellUnread: "Уведомления, непрочитанных: {count}",
  empty: "Пока ничего нет. Здесь появятся новые сообщения, новости о ваших объявлениях, снижение цен в избранном и новые объявления по сохранённым поискам.",
  markAllRead: "Отметить все как прочитанные",
  unread: "Новое",
  message: "Новые сообщения: {count}",
  approved: "Ваше объявление опубликовано",
  rejected: "Ваше объявление не одобрено",
  expiring: "Срок объявления заканчивается {date}. Продлите его, чтобы оно осталось на сайте.",
  priceDrop: "Объявление из избранного подешевело: {old} → {new}",
  searchMatches: "Новые объявления по сохранённому поиску: {count}",
};

export const notificationsCopy = { ka, en, ru };
