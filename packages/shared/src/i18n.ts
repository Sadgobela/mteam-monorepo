export const locales = ["ka", "en", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ka";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

const ka = {
  nav: { menu: "მენიუ", sale: "იყიდება", rent: "ქირავდება", daily: "დღიურად", dubai: "დუბაი", brokers: "ბროკერები", favorites: "რჩეულები", my: "ჩემი განცხადებები", login: "შესვლა", logout: "გასვლა", post: "+ განცხადება" },
  search: { floorMin: "სართულიდან", floorMax: "სართულამდე", areaMin: "ფართი, მ² დან", areaMax: "ფართი, მ² მდე", location: "მდებარეობა", locationHint: "მაგ. ვაკე, საბურთალო", verifiedOnly: "მხოლოდ Verified", more: "სხვა ფილტრები", clear: "გასუფთავება", deal: "გარიგება", city: "ქალაქი", type: "ტიპი", priceMin: "ფასი, $ დან", priceMax: "ფასი, $ მდე", rooms: "ოთახები", any: "ყველა", submit: "ძებნა", results: "ძებნის შედეგები", empty: "ამ ფილტრებით განცხადება ვერ მოიძებნა." },
  results: { map: "რუკა", removeFilter: "ფილტრის მოხსნა", found: "მოიძებნა {count} განცხადება", sort: "დალაგება", sortNew: "ახალი", sortAsc: "ფასი ↑", sortDesc: "ფასი ↓", view: "ხედი", grid: "ბადე", list: "სია", currency: "ვალუტა", pages: "გვერდები", previous: "← წინა", next: "შემდეგი →" },
  home: { leadInvalid: "შეამოწმე სახელი და ნომერი, მაგალითად 555 12 34 56.", leadFailed: "ვერ შევინახეთ. სცადე თავიდან.", leadGoal: "რა გსურს?", leadName: "სახელი", leadSell: "მინდა გაყიდვა", leadRent: "მინდა გაქირავება", leadSubmit: "დაგვიტოვე ნომერი", leadSent: "მადლობა! ბროკერი მალე დაგიკავშირდება.", heading: "MTeam-ის მიერ გადამოწმებული", verifiedTitle: "გადამოწმებული განცხადებები", verifiedLead: "ადგილზე ნანახი ბროკერის მიერ", giveTitle: "მიეცი MTeam-ს", giveLead: "გაყიდვას ან გაქირავებას ჩვენ მივხედავთ", postTitle: "დაამატე განცხადება", postLead: "ფოტოებით, რამდენიმე წუთში", bandTitle: "გაქვს ბინა? მიეცი MTeam-ს", bandText: "საკომისიოს მხოლოდ მესაკუთრე იხდის. გაქირავებისას: დამქირავებელი ერთ წელიწადში, ან საკომისიოს ნახევარი უკან." },
  city: { tbilisi: "თბილისი", batumi: "ბათუმი", dubai: "დუბაი" },
  propertyType: { apartment: "ბინა", house: "სახლი", commercial: "კომერციული", land: "მიწა" },
  deal: { sale: "იყიდება", rent: "ქირავდება", daily: "დღიურად" },
  perMonth: "/ თვე",
  units: { rooms: "ოთახი", floor: "სართ.", sqm: "მ²" },
  listing: { listedPrice: "ფასი განცხადებაში", checkedBy: "შეამოწმა {name}, {date}", area: "ფართი", rooms: "ოთახები", floor: "სართული", condition: "მდგომარეობა", call: "დარეკვა", whatsapp: "WhatsApp", owner: "მესაკუთრე", broker: "MTeam ბროკერი", verifiedNote: "ფოტოები, ფართი და ფასი ბროკერმა ადგილზე გადაამოწმა." },
  card: { title: "{deal} {rooms} ოთახიანი {type}", titleNoRooms: "{deal} {type}", photos: "ფოტო" },
  login: {
    title: "შესვლა",
    lead: "შეიყვანე მობილურის ნომერი და SMS-ით მიიღებ კოდს.",
    phone: "მობილურის ნომერი",
    send: "კოდის გაგზავნა",
    code: "SMS კოდი",
    codeSent: "კოდი გაიგზავნა ნომერზე",
    verify: "შესვლა",
    change: "ნომრის შეცვლა",
    errors: {
      invalidPhone: "შეიყვანე საქართველოს მობილურის ნომერი, მაგალითად 555 12 34 56.",
      tooSoon: "კოდი ახლა ვერ გაიგზავნება. შეამოწმე ბოლო SMS ან სცადე მოგვიანებით.",
      wrongCode: "კოდი არასწორია ან ვადა გაუვიდა.",
    },
  },
  post: {
    heading: "განცხადების დამატება",
    steps: { place: "მდებარეობა", details: "დეტალები", photos: "ფოტოები" },
    next: "შემდეგი",
    back: "უკან",
    fields: { pinClear: "ნიშნულის მოხსნა", pin: "მონიშნე რუკაზე, არასავალდებულო", title: "სათაური", description: "აღწერა", district: "უბანი", address: "მისამართი", price: "ფასი", currency: "ვალუტა", area: "ფართი, მ²", rooms: "ოთახები", floor: "სართული", floors: "სართულები სულ", photos: "ფოტოები: 1-დან 10-მდე, JPG, PNG ან WebP, თითო 5 მბ-მდე" },
    phoneNotice: "შენი ნომერი განცხადებაზე გამოჩნდება, რომ დაგიკავშირდნენ.",
    submit: "გაგზავნა",
    sent: "განცხადება მიღებულია. მოდერაციის შემდეგ გამოქვეყნდება.",
    another: "კიდევ ერთის დამატება",
    errors: {
      invalid: "შეამოწმე ველები. ბინასა და სახლს ოთახების რაოდენობა სჭირდება, სართულს კი სართულების საერთო რაოდენობა.",
      photos: "დაამატე 1-დან 10-მდე ფოტო: JPG, PNG ან WebP, თითო 5 მბ-მდე.",
      save: "განცხადების შენახვა ვერ მოხერხდა. სცადე თავიდან.",
    },
  },
  favorites: { heading: "რჩეულები", empty: "ჯერ არაფერი შეგინახავს. დააჭირე გულს განცხადებაზე.", add: "რჩეულებში დამატება", remove: "რჩეულებიდან ამოღება" },
  my: { heading: "ჩემი განცხადებები", empty: "ჯერ განცხადება არ დაგიმატებია.", archive: "მოხსნა", status: { DRAFT: "დრაფტი", PENDING: "მოდერაციაზე", ACTIVE: "გამოქვეყნებული", ARCHIVED: "მოხსნილი", REJECTED: "უარყოფილი" } },
  admin: { heading: "მართვის პანელი", pending: "მოდერაციას ელოდება", unverified: "გადასამოწმებელი", leads: "მიეცი MTeam-ს: მოთხოვნები", nothing: "ცარიელია.", approve: "გამოქვეყნება", reject: "უარყოფა", verify: "ადგილზე შევამოწმე", contacted: "დავუკავშირდი", contactedDone: "დაკავშირებული" },
  brokers: { heading: "MTeam-ის ბროკერები", empty: "ბროკერები ჯერ არ არის დამატებული.", listings: "განცხადებები: {count}" },
  gallery: { close: "დახურვა", previous: "წინა ფოტო", next: "შემდეგი ფოტო" },
  theme: { dark: "მუქი რეჟიმი", light: "ნათელი რეჟიმი" },
};

type Dict = typeof ka;

const en: Dict = {
  nav: { menu: "Menu", sale: "For sale", rent: "For rent", daily: "Daily", dubai: "Dubai", brokers: "Brokers", favorites: "Favourites", my: "My listings", login: "Sign in", logout: "Sign out", post: "+ Post a listing" },
  search: { floorMin: "Floor from", floorMax: "Floor to", areaMin: "Area from, m²", areaMax: "Area to, m²", location: "Location", locationHint: "For example ვაკე, საბურთალო", verifiedOnly: "Verified only", more: "More filters", clear: "Clear", deal: "Deal", city: "City", type: "Type", priceMin: "Price from, $", priceMax: "Price to, $", rooms: "Rooms", any: "Any", submit: "Search", results: "Search results", empty: "No listings match these filters." },
  results: { map: "Map", removeFilter: "Remove filter", found: "Listings found: {count}", sort: "Sort", sortNew: "Newest", sortAsc: "Price ↑", sortDesc: "Price ↓", view: "View", grid: "Grid", list: "List", currency: "Currency", pages: "Pages", previous: "← Previous", next: "Next →" },
  home: { leadInvalid: "Check your name and number, for example 555 12 34 56.", leadFailed: "We could not save that. Please try again.", leadGoal: "What would you like?", leadName: "Your name", leadSell: "I want to sell", leadRent: "I want to rent out", leadSubmit: "Leave your number", leadSent: "Thank you! A broker will contact you soon.", heading: "Verified by MTeam", verifiedTitle: "Verified listings", verifiedLead: "Seen on site by a broker", giveTitle: "Give it to MTeam", giveLead: "We handle the sale or rental", postTitle: "Post a listing", postLead: "With photos, in a few minutes", bandTitle: "Own a property? Give it to MTeam", bandText: "Only the owner pays commission. For rentals: a tenant within one year, or half the fee back." },
  city: { tbilisi: "Tbilisi", batumi: "Batumi", dubai: "Dubai" },
  propertyType: { apartment: "Apartment", house: "House", commercial: "Commercial", land: "Land" },
  deal: { sale: "For sale", rent: "For rent", daily: "Daily" },
  perMonth: "/ month",
  units: { rooms: "rooms", floor: "floor", sqm: "m²" },
  listing: { listedPrice: "Listed at", checkedBy: "Checked by {name}, {date}", area: "Area", rooms: "Rooms", floor: "Floor", condition: "Condition", call: "Call", whatsapp: "WhatsApp", owner: "Owner", broker: "MTeam broker", verifiedNote: "Photos, area and price were checked on site by the broker." },
  card: { title: "{deal}: {rooms}-room {type}", titleNoRooms: "{deal}: {type}", photos: "photos" },
  login: {
    title: "Sign in",
    lead: "Enter your mobile number and we will text you a code.",
    phone: "Mobile number",
    send: "Send code",
    code: "SMS code",
    codeSent: "Code sent to",
    verify: "Sign in",
    change: "Change number",
    errors: {
      invalidPhone: "Enter a Georgian mobile number, for example 555 12 34 56.",
      tooSoon: "We cannot send another code right now. Check your last SMS or try again later.",
      wrongCode: "That code is wrong or has expired.",
    },
  },
  post: {
    heading: "Post a listing",
    steps: { place: "Location", details: "Details", photos: "Photos" },
    next: "Next",
    back: "Back",
    fields: { pinClear: "Remove the pin", pin: "Mark it on the map (optional)", title: "Title", description: "Description", district: "District", address: "Address", price: "Price", currency: "Currency", area: "Area, m²", rooms: "Rooms", floor: "Floor", floors: "Total floors", photos: "Photos: 1 to 10, JPG, PNG or WebP, up to 5 MB each" },
    phoneNotice: "Your number will be shown on the listing so people can contact you.",
    submit: "Submit",
    sent: "Your listing was received and will be published after moderation.",
    another: "Add another",
    errors: {
      invalid: "Check the fields. Apartments and houses need a room count, and a floor needs the total number of floors.",
      photos: "Add 1 to 10 photos: JPG, PNG or WebP, up to 5 MB each.",
      save: "The listing could not be saved. Please try again.",
    },
  },
  favorites: { heading: "Favourites", empty: "Nothing saved yet. Tap the heart on a listing.", add: "Add to favourites", remove: "Remove from favourites" },
  my: { heading: "My listings", empty: "You have not posted anything yet.", archive: "Take down", status: { DRAFT: "Draft", PENDING: "In review", ACTIVE: "Published", ARCHIVED: "Taken down", REJECTED: "Rejected" } },
  admin: { heading: "Admin panel", pending: "Waiting for moderation", unverified: "To verify on site", leads: "Give it to MTeam requests", nothing: "Nothing here.", approve: "Publish", reject: "Reject", verify: "I checked it on site", contacted: "Mark contacted", contactedDone: "Contacted" },
  brokers: { heading: "MTeam brokers", empty: "No brokers have been added yet.", listings: "Listings: {count}" },
  gallery: { close: "Close", previous: "Previous photo", next: "Next photo" },
  theme: { dark: "Dark mode", light: "Light mode" },
};

const ru: Dict = {
  nav: { menu: "Меню", sale: "Продажа", rent: "Аренда", daily: "Посуточно", dubai: "Дубай", brokers: "Брокеры", favorites: "Избранное", my: "Мои объявления", login: "Войти", logout: "Выйти", post: "+ Объявление" },
  search: { floorMin: "Этаж от", floorMax: "Этаж до", areaMin: "Площадь от, м²", areaMax: "Площадь до, м²", location: "Местоположение", locationHint: "Например, ვაკე, საბურთალო", verifiedOnly: "Только Verified", more: "Другие фильтры", clear: "Очистить", deal: "Сделка", city: "Город", type: "Тип", priceMin: "Цена от, $", priceMax: "Цена до, $", rooms: "Комнаты", any: "Все", submit: "Найти", results: "Результаты поиска", empty: "По этим фильтрам объявлений нет." },
  results: { map: "Карта", removeFilter: "Убрать фильтр", found: "Найдено объявлений: {count}", sort: "Сортировка", sortNew: "Новые", sortAsc: "Цена ↑", sortDesc: "Цена ↓", view: "Вид", grid: "Сетка", list: "Список", currency: "Валюта", pages: "Страницы", previous: "← Назад", next: "Дальше →" },
  home: { leadInvalid: "Проверьте имя и номер, например 555 12 34 56.", leadFailed: "Не удалось сохранить. Попробуйте ещё раз.", leadGoal: "Что вы хотите?", leadName: "Имя", leadSell: "Хочу продать", leadRent: "Хочу сдать", leadSubmit: "Оставить номер", leadSent: "Спасибо! Брокер скоро свяжется с вами.", heading: "Проверено MTeam", verifiedTitle: "Проверенные объявления", verifiedLead: "Брокер видел объект на месте", giveTitle: "Доверьте MTeam", giveLead: "Продажу или аренду мы возьмём на себя", postTitle: "Добавить объявление", postLead: "С фото, за несколько минут", bandTitle: "Есть недвижимость? Доверьте её MTeam", bandText: "Комиссию платит только собственник. При аренде: арендатор в течение года или половина комиссии обратно." },
  city: { tbilisi: "Тбилиси", batumi: "Батуми", dubai: "Дубай" },
  propertyType: { apartment: "Квартира", house: "Дом", commercial: "Коммерческая", land: "Участок" },
  deal: { sale: "Продажа", rent: "Аренда", daily: "Посуточно" },
  perMonth: "/ мес.",
  units: { rooms: "комн.", floor: "этаж", sqm: "м²" },
  listing: { listedPrice: "Цена в объявлении", checkedBy: "Проверил(а) {name}, {date}", area: "Площадь", rooms: "Комнаты", floor: "Этаж", condition: "Состояние", call: "Позвонить", whatsapp: "WhatsApp", owner: "Собственник", broker: "Брокер MTeam", verifiedNote: "Фото, площадь и цену брокер проверил на месте." },
  card: { title: "{deal}: {rooms}-комн. {type}", titleNoRooms: "{deal}: {type}", photos: "фото" },
  login: {
    title: "Вход",
    lead: "Введите номер мобильного, и мы пришлём код по SMS.",
    phone: "Номер мобильного",
    send: "Отправить код",
    code: "Код из SMS",
    codeSent: "Код отправлен на номер",
    verify: "Войти",
    change: "Изменить номер",
    errors: {
      invalidPhone: "Введите грузинский номер мобильного, например 555 12 34 56.",
      tooSoon: "Сейчас нельзя отправить новый код. Проверьте последнее SMS или повторите позже.",
      wrongCode: "Код неверный или устарел.",
    },
  },
  post: {
    heading: "Новое объявление",
    steps: { place: "Местоположение", details: "Детали", photos: "Фото" },
    next: "Далее",
    back: "Назад",
    fields: { pinClear: "Убрать отметку", pin: "Отметьте на карте (необязательно)", title: "Заголовок", description: "Описание", district: "Район", address: "Адрес", price: "Цена", currency: "Валюта", area: "Площадь, м²", rooms: "Комнаты", floor: "Этаж", floors: "Всего этажей", photos: "Фото: от 1 до 10, JPG, PNG или WebP, до 5 МБ каждое" },
    phoneNotice: "Ваш номер будет показан в объявлении, чтобы с вами могли связаться.",
    submit: "Отправить",
    sent: "Объявление получено и будет опубликовано после модерации.",
    another: "Добавить ещё",
    errors: {
      invalid: "Проверьте поля. Для квартиры и дома нужно число комнат, а для этажа — общее число этажей.",
      photos: "Добавьте от 1 до 10 фото: JPG, PNG или WebP, до 5 МБ каждое.",
      save: "Не удалось сохранить объявление. Попробуйте ещё раз.",
    },
  },
  favorites: { heading: "Избранное", empty: "Пока ничего не сохранено. Нажмите на сердечко в объявлении.", add: "Добавить в избранное", remove: "Убрать из избранного" },
  my: { heading: "Мои объявления", empty: "Вы ещё ничего не публиковали.", archive: "Снять", status: { DRAFT: "Черновик", PENDING: "На модерации", ACTIVE: "Опубликовано", ARCHIVED: "Снято", REJECTED: "Отклонено" } },
  admin: { heading: "Панель управления", pending: "Ждут модерации", unverified: "Проверить на месте", leads: "Заявки «Доверьте MTeam»", nothing: "Пусто.", approve: "Опубликовать", reject: "Отклонить", verify: "Проверено на месте", contacted: "Связались", contactedDone: "Связались" },
  brokers: { heading: "Брокеры MTeam", empty: "Брокеры пока не добавлены.", listings: "Объявления: {count}" },
  gallery: { close: "Закрыть", previous: "Предыдущее фото", next: "Следующее фото" },
  theme: { dark: "Тёмная тема", light: "Светлая тема" },
};

const dictionaries: Record<Locale, Dict> = { ka, en, ru };

export function getDictionary(locale: Locale): Dict {
  return dictionaries[locale];
}
export type { Dict };
