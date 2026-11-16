// Copy for one part of the site, kept in its own file so parallel work does not collide in i18n.ts.
// Short notes that pop up after an action, so a press never passes in silence.
const ka = {
  favoriteAdded: "დაემატა რჩეულებში",
  favoriteRemoved: "წაიშალა რჩეულებიდან",
  bumped: "განცხადება სიაში აიწია",
  renewed: "განცხადება განახლდა 60 დღით",
  archived: "განცხადება მოიხსნა",
  saved: "შენახულია",
  failed: "ვერ მოხერხდა. სცადე თავიდან.",
};

const en: typeof ka = {
  favoriteAdded: "Added to favourites",
  favoriteRemoved: "Removed from favourites",
  bumped: "Your listing moved up the list",
  renewed: "Your listing is renewed for 60 days",
  archived: "Your listing is taken down",
  saved: "Saved",
  failed: "That did not work. Please try again.",
};

const ru: typeof ka = {
  favoriteAdded: "Добавлено в избранное",
  favoriteRemoved: "Удалено из избранного",
  bumped: "Объявление поднято в списке",
  renewed: "Объявление продлено на 60 дней",
  archived: "Объявление снято",
  saved: "Сохранено",
  failed: "Не получилось. Попробуйте ещё раз.",
};

export const feedbackCopy = { ka, en, ru };
