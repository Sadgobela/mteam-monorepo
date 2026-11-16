// Copy for one part of the site, kept in its own file so parallel work does not collide in i18n.ts.
const ka = { heading: "ანგარიში", profile: "პროფილი", settings: "პარამეტრები", notifications: "შეტყობინებები", soon: "ეს გვერდი მალე დაემატება." };

const en: typeof ka = { heading: "Account", profile: "Profile", settings: "Settings", notifications: "Notifications", soon: "This page is coming soon." };

const ru: typeof ka = { heading: "Аккаунт", profile: "Профиль", settings: "Настройки", notifications: "Уведомления", soon: "Эта страница скоро появится." };

export const accountCopy = { ka, en, ru };
