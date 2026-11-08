export const locales = ["ka", "en", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ka";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

const ka = {
  nav: { sale: "იყიდება", rent: "ქირავდება", daily: "დღიურად", projects: "ახალი პროექტები", dubai: "დუბაი", login: "შესვლა", post: "+ განცხადება" },
  hero: {
    title: "იპოვე ბინა, რომლის ფოტოებიც სიმართლეს ამბობს",
    lead: "mTeam-ის ბროკერის მიერ გადამოწმებული განცხადებები და მესაკუთრეების პირდაპირი შეთავაზებები ერთ ადგილას.",
  },
  search: { location: "მდებარეობა", type: "ტიპი", price: "ფასი", rooms: "ოთახები", submit: "ძებნა" },
  stats: { listings: "აქტიური განცხადება", agents: "ბროკერი", cities: "თბილისი · ბათუმი · დუბაი" },
  featured: "mTeam-ის რჩეული",
  seeAll: "ყველა →",
  deal: { sale: "იყიდება", rent: "ქირავდება", daily: "დღიურად" },
  perMonth: "/ თვე",
  units: { rooms: "ოთახი", floor: "სართ.", sqm: "მ²" },
  listing: { area: "ფართი", rooms: "ოთახები", floor: "სართული", condition: "მდგომარეობა", call: "დარეკვა", whatsapp: "WhatsApp", book: "ნახვის დაჯავშნა", broker: "mTeam ბროკერი", verifiedNote: "ფოტოები, ფართი და ფასი ბროკერმა ადგილზე გადაამოწმა." },
  theme: { dark: "მუქი რეჟიმი", light: "ნათელი რეჟიმი" },
};

type Dict = typeof ka;

const en: Dict = {
  nav: { sale: "For sale", rent: "For rent", daily: "Daily", projects: "New projects", dubai: "Dubai", login: "Sign in", post: "+ Post a listing" },
  hero: {
    title: "Find a home whose photos tell the truth",
    lead: "Listings checked by mTeam brokers and direct offers from owners, in one place.",
  },
  search: { location: "Location", type: "Type", price: "Price", rooms: "Rooms", submit: "Search" },
  stats: { listings: "active listings", agents: "brokers", cities: "Tbilisi · Batumi · Dubai" },
  featured: "mTeam picks",
  seeAll: "See all →",
  deal: { sale: "For sale", rent: "For rent", daily: "Daily" },
  perMonth: "/ month",
  units: { rooms: "rooms", floor: "floor", sqm: "m²" },
  listing: { area: "Area", rooms: "Rooms", floor: "Floor", condition: "Condition", call: "Call", whatsapp: "WhatsApp", book: "Book a viewing", broker: "mTeam broker", verifiedNote: "Photos, area and price were checked on site by the broker." },
  theme: { dark: "Dark mode", light: "Light mode" },
};

const ru: Dict = {
  nav: { sale: "Продажа", rent: "Аренда", daily: "Посуточно", projects: "Новостройки", dubai: "Дубай", login: "Войти", post: "+ Объявление" },
  hero: {
    title: "Найдите квартиру, фото которой не обманывают",
    lead: "Объявления, проверенные брокерами mTeam, и прямые предложения собственников в одном месте.",
  },
  search: { location: "Район", type: "Тип", price: "Цена", rooms: "Комнаты", submit: "Найти" },
  stats: { listings: "активных объявлений", agents: "брокеров", cities: "Тбилиси · Батуми · Дубай" },
  featured: "Выбор mTeam",
  seeAll: "Все →",
  deal: { sale: "Продажа", rent: "Аренда", daily: "Посуточно" },
  perMonth: "/ мес.",
  units: { rooms: "комн.", floor: "этаж", sqm: "м²" },
  listing: { area: "Площадь", rooms: "Комнаты", floor: "Этаж", condition: "Состояние", call: "Позвонить", whatsapp: "WhatsApp", book: "Записаться на просмотр", broker: "Брокер mTeam", verifiedNote: "Фото, площадь и цену брокер проверил на месте." },
  theme: { dark: "Тёмная тема", light: "Светлая тема" },
};

const dictionaries: Record<Locale, Dict> = { ka, en, ru };

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale];
}
export type { Dict };
