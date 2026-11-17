// Copy for one part of the site, kept in its own file so parallel work does not collide in i18n.ts.
// Controls of the phone layout and the my-listings drafts.
const ka = {
  filters: "ფილტრები",
  moreActions: "მეტი მოქმედება",
  write: "მიწერა",
  draftTitle: "დაუსრულებელი განცხადება",
  deleteDraft: "წაშლა",
  confirmDeleteDraft: "წავშალოთ ეს დრაფტი ფოტოებიანად?",
  draftDeleted: "დრაფტი წაიშალა",
  streetHint: "ჯერ აირჩიე უბანი",
};

const en: typeof ka = {
  filters: "Filters",
  moreActions: "More actions",
  write: "Write",
  draftTitle: "Unfinished listing",
  deleteDraft: "Delete",
  confirmDeleteDraft: "Delete this draft and its photos?",
  draftDeleted: "Draft deleted",
  streetHint: "Choose a district first",
};

const ru: typeof ka = {
  filters: "Фильтры",
  moreActions: "Другие действия",
  write: "Написать",
  draftTitle: "Незавершённое объявление",
  deleteDraft: "Удалить",
  confirmDeleteDraft: "Удалить этот черновик вместе с фото?",
  draftDeleted: "Черновик удалён",
  streetHint: "Сначала выберите район",
};

export const uiCopy = { ka, en, ru };
