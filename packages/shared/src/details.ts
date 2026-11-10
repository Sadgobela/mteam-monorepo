/** Listing details: fixed choices in all three languages, as the Georgian market names them. A listing stores the keys. */
type Labels = { ka: string; en: string; ru: string };

/** Single choices. */
export const specs = {
  "condition": {
    "new_renovated": {
      "ka": "ახალი გარემონტებული",
      "en": "Newly renovated",
      "ru": "Свежий ремонт"
    },
    "old_renovated": {
      "ka": "ძველი გარემონტებული",
      "en": "Old renovation",
      "ru": "Старый ремонт"
    },
    "renovating": {
      "ka": "მიმდინარე რემონტი",
      "en": "Under renovation",
      "ru": "Текущий ремонт"
    },
    "needs_renovation": {
      "ka": "სარემონტო",
      "en": "Needs renovation",
      "ru": "Требует ремонта"
    },
    "white_frame": {
      "ka": "თეთრი კარკასი",
      "en": "White frame",
      "ru": "Белый каркас"
    },
    "black_frame": {
      "ka": "შავი კარკასი",
      "en": "Black frame",
      "ru": "Чёрный каркас"
    },
    "green_frame": {
      "ka": "მწვანე კარკასი",
      "en": "Green frame",
      "ru": "Зелёный каркас"
    },
    "white_plus": {
      "ka": "თეთრი პლიუსი",
      "en": "White plus",
      "ru": "Белый плюс"
    }
  },
  "bathroom": {
    "1": {
      "ka": "1",
      "en": "1",
      "ru": "1"
    },
    "2": {
      "ka": "2",
      "en": "2",
      "ru": "2"
    },
    "3": {
      "ka": "3+",
      "en": "3+",
      "ru": "3+"
    },
    "shared": {
      "ka": "საერთო",
      "en": "Shared",
      "ru": "Общий"
    }
  },
  "storage": {
    "basement": {
      "ka": "სარდაფი",
      "en": "Basement",
      "ru": "Подвал"
    },
    "attic": {
      "ka": "სხვენი",
      "en": "Attic",
      "ru": "Чердак"
    },
    "pantry": {
      "ka": "საკუჭნაო",
      "en": "Pantry",
      "ru": "Кладовая"
    },
    "outdoor": {
      "ka": "გარე სათავსო",
      "en": "Outdoor storage",
      "ru": "Наружная кладовая"
    },
    "shared": {
      "ka": "საერთო სათავსო",
      "en": "Common storage",
      "ru": "Общая кладовая"
    },
    "basement_attic": {
      "ka": "სარდაფი + სხვენი",
      "en": "Basement + Attic",
      "ru": "Подвал + Чердак"
    }
  },
  "parking": {
    "garage": {
      "ka": "ავტოფარეხი",
      "en": "Garage",
      "ru": "Гараж"
    },
    "space": {
      "ka": "პარკინგის ადგილი",
      "en": "Parking space",
      "ru": "Парковочное место"
    },
    "yard": {
      "ka": "ეზოს პარკინგი",
      "en": "Yard parking",
      "ru": "Парковка во дворе"
    },
    "underground": {
      "ka": "მიწისქვეშა პარკინგი",
      "en": "Underground parking",
      "ru": "Подземный паркинг"
    },
    "paid": {
      "ka": "ფასიანი ავტოსადგომი",
      "en": "Paid parking",
      "ru": "Платная парковка"
    },
    "none": {
      "ka": "პარკინგის გარეშე",
      "en": "Without parking",
      "ru": "Без паркинга"
    }
  },
  "heating": {
    "central": {
      "ka": "ცენტრალური გათბობა",
      "en": "Central heating",
      "ru": "Центральное отопление"
    },
    "gas": {
      "ka": "გაზის გამათბობელი",
      "en": "Gas heater",
      "ru": "Газовый нагреватель"
    },
    "electric": {
      "ka": "დენის გამათბობელი",
      "en": "Electric heaters",
      "ru": "Электрообогреватель"
    },
    "central_floor": {
      "ka": "ცენტრალური+იატაკის გათბობა",
      "en": "Central+floor heating",
      "ru": "Центральное и тёплый пол"
    },
    "none": {
      "ka": "გათბობის გარეშე",
      "en": "Without heating",
      "ru": "Без отопления"
    },
    "individual": {
      "ka": "ინდივიდუალური",
      "en": "Individual",
      "ru": "Индивидуальное"
    },
    "floor": {
      "ka": "იატაკის გათბობა",
      "en": "Floor heating",
      "ru": "Тёплый пол"
    }
  },
  "hotWater": {
    "gas": {
      "ka": "გაზის გამაცხელებელი",
      "en": "Gas heater",
      "ru": "Газовый нагреватель"
    },
    "tank": {
      "ka": "ავზი",
      "en": "Tank",
      "ru": "Бак"
    },
    "electric": {
      "ka": "დენის გამაცხელებელი",
      "en": "Electric heater",
      "ru": "Электрический обогреватель"
    },
    "solar": {
      "ka": "მზის გამათბობელი",
      "en": "Solar heater",
      "ru": "Солнечный водонагреватель"
    },
    "none": {
      "ka": "ცხელი წყლის გარეშე",
      "en": "Without hot water",
      "ru": "Без горячей воды"
    },
    "central": {
      "ka": "ცენტრალური ცხელი წყალი",
      "en": "Central hot water",
      "ru": "Центральная горячая вода"
    },
    "natural": {
      "ka": "ბუნებრივი ცხელი წყალი",
      "en": "Natural hot water",
      "ru": "Природная горячая вода"
    },
    "individual": {
      "ka": "ინდივიდუალური",
      "en": "Individual",
      "ru": "Индивидуальное"
    }
  },
  "material": {
    "block": {
      "ka": "ბლოკი",
      "en": "Block",
      "ru": "Блок"
    },
    "brick": {
      "ka": "აგური",
      "en": "Brick",
      "ru": "Кирпич"
    },
    "wood": {
      "ka": "ხის მასალა",
      "en": "Wood",
      "ru": "Дерево"
    },
    "concrete": {
      "ka": "რკინა-ბეტონი",
      "en": "Reinforced concrete",
      "ru": "Железобетон"
    },
    "combined": {
      "ka": "კომბინირებული",
      "en": "Combined",
      "ru": "Комбинированный"
    }
  },
  "windows": {
    "wood": {
      "ka": "ხე",
      "en": "Wood",
      "ru": "дерево"
    },
    "plastic": {
      "ka": "პლასტმასა",
      "en": "Plastic",
      "ru": "пластик"
    },
    "aluminum": {
      "ka": "ალუმინი",
      "en": "Aluminium",
      "ru": "алюминий"
    }
  },
  "livingRoom": {
    "separate": {
      "ka": "გამოყოფილი",
      "en": "Separate",
      "ru": "Отдельная"
    },
    "studio": {
      "ka": "სტუდიო",
      "en": "Studio",
      "ru": "Студия"
    }
  },
  "projectType": {
    "non_standard": {
      "ka": "არასტანდარტული",
      "en": "Non-standard",
      "ru": "Нестандартный"
    },
    "tukhareli": {
      "ka": "თუხარელის",
      "en": "Tukhareli",
      "ru": "Тухарели"
    },
    "italian_yard": {
      "ka": "იტალიური ეზო",
      "en": "Italian yard",
      "ru": "Итальянский дворик"
    },
    "leningrad": {
      "ka": "ლენინგრადის",
      "en": "Leningrad",
      "ru": "Ленинградский"
    },
    "lvov": {
      "ka": "ლვოვის",
      "en": "Lvov",
      "ru": "Львовский"
    },
    "moscow": {
      "ka": "მოსკოვის",
      "en": "Moscow",
      "ru": "Московский"
    },
    "other": {
      "ka": "სხვა",
      "en": "Other",
      "ru": "Другой"
    }
  }
} as const satisfies Record<string, Record<string, Labels>>;

export const specTitles = {
  "condition": {
    "ka": "მდგომარეობა",
    "en": "Condition",
    "ru": "Состояние"
  },
  "bathroom": {
    "ka": "სველი წერტილი",
    "en": "Bathrooms",
    "ru": "Санузел"
  },
  "storage": {
    "ka": "სათავსოს ტიპი",
    "en": "Storage type",
    "ru": "Кладовая"
  },
  "parking": {
    "ka": "პარკინგი",
    "en": "Parking",
    "ru": "Парковка"
  },
  "heating": {
    "ka": "გათბობა",
    "en": "Heating",
    "ru": "Отопление"
  },
  "hotWater": {
    "ka": "ცხელი წყალი",
    "en": "Hot water",
    "ru": "Горячая вода"
  },
  "material": {
    "ka": "სამშენებლო მასალა",
    "en": "Building material",
    "ru": "Строительный материал"
  },
  "windows": {
    "ka": "კარ-ფანჯარა",
    "en": "Windows and doors",
    "ru": "Двери и окна"
  },
  "livingRoom": {
    "ka": "მისაღები",
    "en": "Living room",
    "ru": "Гостиная"
  },
  "projectType": {
    "ka": "პროექტის ტიპი",
    "en": "Project type",
    "ru": "Тип проекта"
  }
} as const satisfies Record<keyof typeof specs, Labels>;

/** Things a listing can have several of. */
export const featureGroups = {
  "building": {
    "spa": {
      "ka": "სპა",
      "en": "Spa",
      "ru": "Спа"
    },
    "lift": {
      "ka": "ლიფტი",
      "en": "Lift",
      "ru": "Лифт"
    },
    "freight_lift": {
      "ka": "სატვირთო ლიფტი",
      "en": "Freight lift",
      "ru": "Грузовой лифт"
    },
    "bar": {
      "ka": "ბარი",
      "en": "Bar",
      "ru": "Бар"
    },
    "gym": {
      "ka": "სპორტ დარბაზი",
      "en": "Gym",
      "ru": "Спортзал"
    },
    "grill": {
      "ka": "მაყალი/გრილი",
      "en": "Grill",
      "ru": "Гриль"
    },
    "jacuzzi": {
      "ka": "ჯაკუზი",
      "en": "Jacuzzi",
      "ru": "Джакузи"
    },
    "fire_system": {
      "ka": "სახანძრო სისტემა",
      "en": "Fire system",
      "ru": "Пожарная система"
    },
    "barrier": {
      "ka": "შლაგბაუმი",
      "en": "Barrier gate",
      "ru": "Шлагбаум"
    },
    "concierge": {
      "ka": "კონსიერჟი",
      "en": "Concierge",
      "ru": "Консьерж"
    },
    "indoor_pool": {
      "ka": "დახურული აუზი",
      "en": "Indoor pool",
      "ru": "Крытый бассейн"
    },
    "outdoor_pool": {
      "ka": "ღია აუზი",
      "en": "Outdoor pool",
      "ru": "Открытый бассейн"
    },
    "sauna": {
      "ka": "საუნა",
      "en": "Sauna",
      "ru": "Сауна"
    },
    "alarm": {
      "ka": "სიგნალიზაცია",
      "en": "Alarm",
      "ru": "Сигнализация"
    },
    "ventilation": {
      "ka": "ვინტილაცია",
      "en": "Ventilation",
      "ru": "Вентиляция"
    },
    "security": {
      "ka": "დაცვა",
      "en": "Security",
      "ru": "Охрана"
    }
  },
  "furniture": {
    "furniture": {
      "ka": "ავეჯი",
      "en": "Furniture",
      "ru": "Мебель"
    },
    "bed": {
      "ka": "საწოლი",
      "en": "Bed",
      "ru": "Кровать"
    },
    "sofa": {
      "ka": "დივანი",
      "en": "Sofa",
      "ru": "Диван"
    },
    "table": {
      "ka": "მაგიდა",
      "en": "Table",
      "ru": "Стол"
    },
    "chairs": {
      "ka": "სკამები",
      "en": "Chairs",
      "ru": "Стулья"
    },
    "stove": {
      "ka": "ქურა (გაზის/ელექტრო)",
      "en": "Stove (gas / electric)",
      "ru": "Плита (газовая/электрическая)"
    },
    "oven": {
      "ka": "ღუმელი",
      "en": "Oven",
      "ru": "Духовка"
    },
    "air_conditioner": {
      "ka": "კონდინციონერი",
      "en": "Air conditioner",
      "ru": "Кондиционер"
    },
    "fridge": {
      "ka": "მაცივარი",
      "en": "Refrigerator",
      "ru": "Холодильник"
    },
    "washer": {
      "ka": "სარეცხი მანქანა",
      "en": "Washing machine",
      "ru": "Стиральная машина"
    },
    "dishwasher": {
      "ka": "ჭურჭლის სარეცხი მანქანა",
      "en": "Dishwasher",
      "ru": "Посудомойка"
    }
  },
  "utilities": {
    "internet": {
      "ka": "ინტერნეტი",
      "en": "Internet",
      "ru": "Интернет"
    },
    "tv": {
      "ka": "ტელევიზია",
      "en": "TV",
      "ru": "Телевидение"
    },
    "gas": {
      "ka": "ბუნებრივი აირი",
      "en": "Natural gas",
      "ru": "Природный газ"
    },
    "fireplace": {
      "ka": "ბუხარი",
      "en": "Fireplace",
      "ru": "Камин"
    },
    "water": {
      "ka": "წყალი",
      "en": "Water",
      "ru": "Вода"
    },
    "sewage": {
      "ka": "კანალიზაცია",
      "en": "Sewerage",
      "ru": "Канализация"
    },
    "electricity": {
      "ka": "ელექტროენერგია",
      "en": "Electricity",
      "ru": "Электричество"
    },
    "phone": {
      "ka": "ტელეფონი",
      "en": "Telephone",
      "ru": "Телефон"
    },
    "kitchen": {
      "ka": "სამზარეულო + ტექნიკა",
      "en": "Kitchen + Appliances",
      "ru": "Кухня + Техника"
    }
  },
  "tags": {
    "door_code": {
      "ka": "კარი კოდით",
      "en": "Door code",
      "ru": "Кодовый замок"
    },
    "short_rental": {
      "ka": "Airbnb/Booking ექაუნთი",
      "en": "Airbnb/Booking account",
      "ru": "Аккаунт Airbnb/Booking"
    },
    "investment": {
      "ka": "საინვესტიციო",
      "en": "Investment",
      "ru": "Инвестиционный"
    },
    "accessible": {
      "ka": "სსმპ",
      "en": "Accessible",
      "ru": "Доступная среда"
    },
    "exchange": {
      "ka": "შესაძლებელია გაცვლა",
      "en": "Exchange possible",
      "ru": "Возможен обмен"
    }
  },
  "outdoor": {
    "balcony": {
      "ka": "აივანი",
      "en": "Balcony",
      "ru": "Балкон"
    },
    "veranda": {
      "ka": "ვერანდა",
      "en": "Veranda",
      "ru": "Веранда"
    },
    "loggia": {
      "ka": "ლოჯია",
      "en": "Loggia",
      "ru": "Лоджия"
    }
  }
} as const satisfies Record<string, Record<string, Labels>>;

export const groupTitles = {
  "building": {
    "ka": "შენობის მახასიათებლები",
    "en": "Building features",
    "ru": "Особенности здания"
  },
  "furniture": {
    "ka": "ავეჯი და ტექნიკა",
    "en": "Furniture and equipment",
    "ru": "Мебель и оборудование"
  },
  "utilities": {
    "ka": "ქონების მახასიათებლები",
    "en": "Utilities",
    "ru": "Коммуникации"
  },
  "tags": {
    "ka": "დამატებით",
    "en": "Also",
    "ru": "Дополнительно"
  },
  "outdoor": {
    "ka": "აივანი და ვერანდა",
    "en": "Balcony and veranda",
    "ru": "Балкон и веранда"
  }
} as const satisfies Record<keyof typeof featureGroups, Labels>;

export type SpecName = keyof typeof specs;
export type FeatureGroup = keyof typeof featureGroups;
type Locale = keyof Labels;

export const specNames = Object.keys(specs) as SpecName[];
export const groupNames = Object.keys(featureGroups) as FeatureGroup[];

const featureLabels = new Map<string, Labels>(groupNames.flatMap((group) => Object.entries(featureGroups[group])));
const specLabels = (name: SpecName) => specs[name] as Record<string, Labels>;

export function specKeys(name: SpecName): string[] {
  return Object.keys(specs[name]);
}

export function groupKeys(group: FeatureGroup): string[] {
  return Object.keys(featureGroups[group]);
}

export function isFeature(key: string): boolean {
  return featureLabels.has(key);
}

export function specLabel(name: SpecName, key: string, locale: Locale): string {
  return specLabels(name)[key][locale];
}

export function featureLabel(key: string, locale: Locale): string {
  return (featureLabels.get(key) as Labels)[locale];
}
