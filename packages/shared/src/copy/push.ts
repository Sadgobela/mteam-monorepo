// Copy for one part of the site, kept in its own file so parallel work does not collide in i18n.ts.
const ka = {
  heading: "შეტყობინებები ამ მოწყობილობაზე",
  intro: "მიიღე შეტყობინება ამ ტელეფონზე ან კომპიუტერზე ახალ წერილებსა და შენს განცხადებებზე, მაშინაც კი, როცა საიტი დახურულია.",
  turnOn: "ჩართვა",
  turnOff: "ამ მოწყობილობაზე გამორთვა",
  on: "ამ მოწყობილობაზე ჩართულია.",
  blocked: "ამ ბრაუზერის პარამეტრებში შეტყობინებები დაბლოკილია. იქ დაუშვი ისინი ამ საიტისთვის და დაბრუნდი აქ.",
  unsupported: "ეს ბრაუზერი საიტების შეტყობინებებს ვერ აჩვენებს.",
  install: "iPhone-სა და iPad-ზე შეტყობინებები მუშაობს, როცა MTeam მთავარ ეკრანზეა დამატებული:",
  installSteps: [
    "Safari-ში, ქვემოთ, დააჭირე „გაზიარებას“ (Share).",
    "აირჩიე „მთავარ ეკრანზე დამატება“ (Add to Home Screen).",
    "გახსენი MTeam მთავარი ეკრანიდან და აქ ჩართე შეტყობინებები.",
  ],
  failed: "ვერ მოხერხდა. სცადე თავიდან.",
  allDevices: "შეტყობინებების გაგზავნა ჩემს მოწყობილობებზე",
  allDevicesHint: "გამორთე, რომ ყველა მოწყობილობაზე ერთად შეაჩერო.",
};

const en: typeof ka = {
  heading: "Notifications on this device",
  intro: "Get a notification on this phone or computer about new messages and your listings, even when the site is closed.",
  turnOn: "Turn on",
  turnOff: "Turn off on this device",
  on: "On for this device.",
  blocked: "Notifications are blocked in this browser's settings. Allow them for this site there, then come back here.",
  unsupported: "This browser cannot show notifications from websites.",
  install: "On iPhone and iPad, notifications work once MTeam is on your home screen:",
  installSteps: ["In Safari, tap Share at the bottom.", "Choose “Add to Home Screen”.", "Open MTeam from the home screen and turn notifications on here."],
  failed: "That did not work. Please try again.",
  allDevices: "Send notifications to my devices",
  allDevicesHint: "Turn this off to pause them on every device at once.",
};

const ru: typeof ka = {
  heading: "Уведомления на этом устройстве",
  intro: "Получайте уведомления на этот телефон или компьютер о новых сообщениях и ваших объявлениях, даже когда сайт закрыт.",
  turnOn: "Включить",
  turnOff: "Выключить на этом устройстве",
  on: "Включены на этом устройстве.",
  blocked: "Уведомления заблокированы в настройках браузера. Разрешите их для этого сайта и вернитесь сюда.",
  unsupported: "Этот браузер не умеет показывать уведомления от сайтов.",
  install: "На iPhone и iPad уведомления работают, когда MTeam добавлен на экран «Домой»:",
  installSteps: ["В Safari нажмите «Поделиться» внизу экрана.", "Выберите «На экран „Домой“».", "Откройте MTeam с экрана «Домой» и включите уведомления здесь."],
  failed: "Не получилось. Попробуйте ещё раз.",
  allDevices: "Отправлять уведомления на мои устройства",
  allDevicesHint: "Выключите, чтобы приостановить их сразу на всех устройствах.",
};

export const pushCopy = { ka, en, ru };
