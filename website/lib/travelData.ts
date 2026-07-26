// Yagona manba: yo'nalish (region/davlat) → shaharlar.
// Katalog filtri (Region → Shahar bog'liq dropdown), tur qo'shish formasi va
// hamkor/ariza formasi SHU manbadan foydalanadi — shuning uchun agent tanlagan
// yo'nalish filtrga kafolatli tushadi (imlo farqi muammo bo'lmaydi).
//
// `popular` — katalog filtrida darhol ko'rinadigan mashhur yo'nalishlar.
// Qolganlari «Barcha yo'nalishlar» ochilganda chiqadi (filtr uzun bo'lib
// ketmasligi uchun). Tur qo'shish formasida esa HAMMASI ko'rinadi (qit'a
// bo'yicha guruhlangan).
//
// Ro'yxatda yo'q davlat uchun formada «Boshqa davlat…» varianti bor —
// hech qanday yo'nalish bloklanmaydi.

export type RegionGroup = "gulf" | "asia" | "europe" | "africa" | "cis" | "america" | "uz";

export type Region = {
  key: string;
  label: string;
  /** Mobil/agentlik/katalog filtrlari bilan mos keyword'lar (kichik harflarda) */
  match: string[];
  cities: string[];
  group: RegionGroup;
  popular?: boolean;
};

export const REGION_GROUP_LABEL: Record<RegionGroup, string> = {
  gulf: "Yaqin Sharq va Ko‘rfaz",
  asia: "Osiyo",
  europe: "Yevropa",
  africa: "Afrika",
  cis: "MDH va qo‘shni davlatlar",
  america: "Amerika",
  uz: "O‘zbekiston (ichki)",
};

export const REGIONS: Region[] = [
  /* ─── Yaqin Sharq va Ko'rfaz ─── */
  {
    key: "uae",
    label: "BAA (Dubay)",
    match: ["baa", "dubai", "dubay", "uae", "emirat", "abu dhabi", "abu-dhabi", "sharja"],
    cities: ["Dubay", "Abu-Dabi", "Sharja", "Ras al-Xayma", "Ajman", "Fujayra"],
    group: "gulf",
    popular: true,
  },
  {
    key: "saudi",
    label: "Saudiya Arabistoni (Umra/Haj)",
    match: ["saudiya", "saudi", "makka", "madina", "umra", "umrah", "hajj", "haj", "jidda"],
    cities: ["Makka", "Madina", "Jidda", "Toif"],
    group: "gulf",
    popular: true,
  },
  {
    key: "turkey",
    label: "Turkiya",
    match: ["turkiya", "turkey", "turk", "antalya", "istanbul", "stambul", "bodrum", "alanya"],
    cities: ["Istanbul", "Antalya", "Bodrum", "Alanya", "Kappadokiya", "Trabzon", "Marmaris", "Izmir"],
    group: "gulf",
    popular: true,
  },
  {
    key: "qatar",
    label: "Qatar",
    match: ["qatar", "doha"],
    cities: ["Doha", "Al-Vakra"],
    group: "gulf",
  },
  {
    key: "oman",
    label: "Oman",
    match: ["oman", "muskat", "muscat", "salala"],
    cities: ["Muskat", "Salala", "Nizva"],
    group: "gulf",
  },
  {
    key: "bahrain",
    label: "Bahrayn",
    match: ["bahrayn", "bahrain", "manama"],
    cities: ["Manama"],
    group: "gulf",
  },
  {
    key: "kuwait",
    label: "Kuvayt",
    match: ["kuvayt", "kuwait"],
    cities: ["Kuvayt"],
    group: "gulf",
  },
  {
    key: "jordan",
    label: "Iordaniya",
    match: ["iordaniya", "jordan", "amman", "petra", "aqaba"],
    cities: ["Amman", "Petra", "Aqaba", "O‘lik dengiz"],
    group: "gulf",
  },

  /* ─── Osiyo ─── */
  {
    key: "thailand",
    label: "Tailand",
    match: ["tailand", "thailand", "phuket", "bangkok", "pattaya", "samui"],
    cities: ["Bangkok", "Phuket", "Pattaya", "Samui", "Chiangmay", "Krabi"],
    group: "asia",
    popular: true,
  },
  {
    key: "maldives",
    label: "Maldiv orollari",
    match: ["maldiv", "maldive", "male"],
    cities: ["Male", "Maafushi", "Addu"],
    group: "asia",
    popular: true,
  },
  {
    key: "malaysia",
    label: "Malayziya",
    match: ["malayziya", "malaysia", "kuala", "langkavi", "penang"],
    cities: ["Kuala-Lumpur", "Langkavi", "Penang", "Malakka"],
    group: "asia",
  },
  {
    key: "indonesia",
    label: "Indoneziya (Bali)",
    match: ["indoneziya", "indonesia", "bali", "jakarta"],
    cities: ["Bali", "Jakarta", "Yogyakarta", "Lombok"],
    group: "asia",
    popular: true,
  },
  {
    key: "vietnam",
    label: "Vyetnam",
    match: ["vyetnam", "vietnam", "hanoy", "hanoi", "nyachang", "nha trang", "fukuok", "phu quoc"],
    cities: ["Hanoy", "Nyachang", "Fukuok", "Xoshimin", "Dananг"],
    group: "asia",
  },
  {
    key: "china",
    label: "Xitoy",
    match: ["xitoy", "china", "pekin", "beijing", "shanxay", "shanghai", "guanchjou", "urumchi"],
    cities: ["Pekin", "Shanxay", "Guanchjou", "Urumchi", "Sanya"],
    group: "asia",
  },
  {
    key: "korea",
    label: "Janubiy Koreya",
    match: ["koreya", "korea", "seul", "seoul", "busan"],
    cities: ["Seul", "Busan", "Jeju"],
    group: "asia",
  },
  {
    key: "japan",
    label: "Yaponiya",
    match: ["yaponiya", "japan", "tokio", "tokyo", "osaka", "kioto", "kyoto"],
    cities: ["Tokio", "Osaka", "Kioto"],
    group: "asia",
  },
  {
    key: "india",
    label: "Hindiston",
    match: ["hindiston", "india", "deli", "delhi", "goa", "mumbay", "mumbai", "agra"],
    cities: ["Deli", "Goa", "Mumbay", "Agra", "Jaypur", "Kerala"],
    group: "asia",
  },
  {
    key: "srilanka",
    label: "Shri-Lanka",
    match: ["shri-lanka", "shri lanka", "sri lanka", "kolombo", "colombo"],
    cities: ["Kolombo", "Kandi", "Galle", "Bentota"],
    group: "asia",
  },
  {
    key: "singapore",
    label: "Singapur",
    match: ["singapur", "singapore"],
    cities: ["Singapur"],
    group: "asia",
  },
  {
    key: "nepal",
    label: "Nepal",
    match: ["nepal", "katmandu", "kathmandu", "pokhara"],
    cities: ["Katmandu", "Pokxara"],
    group: "asia",
  },
  {
    key: "philippines",
    label: "Filippin",
    match: ["filippin", "philippines", "manila", "boracay", "sebu", "cebu"],
    cities: ["Manila", "Borakay", "Sebu", "Palavan"],
    group: "asia",
  },

  /* ─── Yevropa ─── */
  {
    key: "europe",
    label: "Yevropa (umumiy / bir necha davlat)",
    match: ["yevropa", "europe", "shengen", "schengen"],
    cities: ["Parij", "Rim", "London", "Barselona", "Praga", "Vena", "Amsterdam", "Budapesht"],
    group: "europe",
    popular: true,
  },
  {
    key: "italy",
    label: "Italiya",
    match: ["italiya", "italy", "rim", "rome", "milan", "venetsiya", "venice", "florensiya"],
    cities: ["Rim", "Milan", "Venetsiya", "Florensiya", "Neapol"],
    group: "europe",
  },
  {
    key: "france",
    label: "Fransiya",
    match: ["fransiya", "france", "parij", "paris", "nitsa", "nice"],
    cities: ["Parij", "Nitsa", "Lion", "Marsel"],
    group: "europe",
  },
  {
    key: "spain",
    label: "Ispaniya",
    match: ["ispaniya", "spain", "barcelona", "barselona", "madrid", "malaga"],
    cities: ["Barselona", "Madrid", "Malaga", "Valensiya", "Palma"],
    group: "europe",
  },
  {
    key: "germany",
    label: "Germaniya",
    match: ["germaniya", "germany", "berlin", "myunxen", "munich", "frankfurt"],
    cities: ["Berlin", "Myunxen", "Frankfurt", "Gamburg"],
    group: "europe",
  },
  {
    key: "czech",
    label: "Chexiya",
    match: ["chexiya", "czech", "praga", "prague"],
    cities: ["Praga", "Karlovi-Vari", "Brno"],
    group: "europe",
  },
  {
    key: "austria",
    label: "Avstriya",
    match: ["avstriya", "austria", "vena", "vienna", "salzburg"],
    cities: ["Vena", "Salzburg", "Innsbruk"],
    group: "europe",
  },
  {
    key: "greece",
    label: "Gretsiya",
    match: ["gretsiya", "greece", "afina", "athens", "krit", "crete", "rodos", "santorini"],
    cities: ["Afina", "Krit", "Rodos", "Santorini", "Korfu"],
    group: "europe",
  },
  {
    key: "hungary",
    label: "Vengriya",
    match: ["vengriya", "hungary", "budapesht", "budapest"],
    cities: ["Budapesht", "Xeviz"],
    group: "europe",
  },
  {
    key: "poland",
    label: "Polsha",
    match: ["polsha", "poland", "varshava", "warsaw", "krakov"],
    cities: ["Varshava", "Krakov", "Gdansk"],
    group: "europe",
  },
  {
    key: "uk",
    label: "Buyuk Britaniya",
    match: ["britaniya", "britain", "angliya", "england", "london", "uk"],
    cities: ["London", "Manchester", "Edinburg"],
    group: "europe",
  },
  {
    key: "switzerland",
    label: "Shveytsariya",
    match: ["shveytsariya", "switzerland", "syurix", "zurich", "jeneva", "geneva"],
    cities: ["Syurix", "Jeneva", "Lyutsern", "Interlaken"],
    group: "europe",
  },
  {
    key: "netherlands",
    label: "Niderlandiya",
    match: ["niderlandiya", "netherlands", "amsterdam", "gollandiya"],
    cities: ["Amsterdam", "Rotterdam", "Gaaga"],
    group: "europe",
  },
  {
    key: "montenegro",
    label: "Chernogoriya",
    match: ["chernogoriya", "montenegro", "budva", "kotor", "tivat"],
    cities: ["Budva", "Kotor", "Tivat", "Podgorica"],
    group: "europe",
  },
  {
    key: "serbia",
    label: "Serbiya",
    match: ["serbiya", "serbia", "belgrad", "belgrade"],
    cities: ["Belgrad", "Novi-Sad"],
    group: "europe",
  },
  {
    key: "bosnia",
    label: "Bosniya va Gertsegovina",
    match: ["bosniya", "bosnia", "sarayevo", "sarajevo", "mostar"],
    cities: ["Sarayevo", "Mostar", "Trebinje"],
    group: "europe",
  },
  {
    key: "croatia",
    label: "Xorvatiya",
    match: ["xorvatiya", "croatia", "dubrovnik", "split", "zagreb"],
    cities: ["Dubrovnik", "Split", "Zagreb"],
    group: "europe",
  },
  {
    key: "albania",
    label: "Albaniya",
    match: ["albaniya", "albania", "tirana", "sarande"],
    cities: ["Tirana", "Sarande", "Durres"],
    group: "europe",
  },
  {
    key: "cyprus",
    label: "Kipr",
    match: ["kipr", "cyprus", "larnaka", "limassol", "ayia napa"],
    cities: ["Larnaka", "Limassol", "Ayia-Napa", "Pafos"],
    group: "europe",
  },

  /* ─── Afrika ─── */
  {
    key: "egypt",
    label: "Misr",
    match: ["misr", "egypt", "sharm", "hurghada", "hurg'ada", "qohira", "cairo"],
    cities: ["Sharm-ash-Shayx", "Hurg‘ada", "Qohira", "Marsa-Alam", "Iskandariya"],
    group: "africa",
    popular: true,
  },
  {
    key: "morocco",
    label: "Marokash",
    match: ["marokash", "morocco", "marrakesh", "kasablanka", "casablanca"],
    cities: ["Marrakesh", "Kasablanka", "Fes", "Agadir"],
    group: "africa",
  },
  {
    key: "tunisia",
    label: "Tunis",
    match: ["tunis", "tunisia", "hammamet", "susa", "sousse"],
    cities: ["Tunis", "Hammamet", "Susa", "Jerba"],
    group: "africa",
  },
  {
    key: "tanzania",
    label: "Tanzaniya (Zanzibar)",
    match: ["tanzaniya", "tanzania", "zanzibar", "kilimanjaro"],
    cities: ["Zanzibar", "Dar-es-Salom", "Arusha"],
    group: "africa",
  },

  /* ─── MDH va qo'shni davlatlar ─── */
  {
    key: "georgia",
    label: "Gruziya",
    match: ["gruziya", "georgia", "batumi", "botumi", "tbilisi"],
    cities: ["Botumi", "Tbilisi", "Bakuriani", "Kutaisi", "Gudauri"],
    group: "cis",
    popular: true,
  },
  {
    key: "azerbaijan",
    label: "Ozarbayjon",
    match: ["ozarbayjon", "azerbaijan", "baku", "boku", "gabala"],
    cities: ["Boku", "Gabala", "Sheki", "Naftalan"],
    group: "cis",
    popular: true,
  },
  {
    key: "armenia",
    label: "Armaniston",
    match: ["armaniston", "armenia", "yerevan", "sevan"],
    cities: ["Yerevan", "Sevan", "Tsaxkadzor"],
    group: "cis",
  },
  {
    key: "kazakhstan",
    label: "Qozog‘iston",
    match: ["qozog", "kazakhstan", "almati", "almaty", "astana", "shimkent"],
    cities: ["Almati", "Astana", "Shimkent", "Turkiston"],
    group: "cis",
  },
  {
    key: "kyrgyzstan",
    label: "Qirg‘iziston",
    match: ["qirg", "kyrgyz", "bishkek", "issiqko", "issyk"],
    cities: ["Bishkek", "Cholpon-Ota", "Osh", "Karakol"],
    group: "cis",
  },
  {
    key: "russia",
    label: "Rossiya",
    match: ["rossiya", "russia", "moskva", "moscow", "peterburg", "sochi", "kazan"],
    cities: ["Moskva", "Sankt-Peterburg", "Sochi", "Qozon"],
    group: "cis",
  },
  {
    key: "belarus",
    label: "Belarus",
    match: ["belarus", "minsk"],
    cities: ["Minsk", "Brest"],
    group: "cis",
  },
  {
    key: "tajikistan",
    label: "Tojikiston",
    match: ["tojikiston", "tajikistan", "dushanbe", "xujand"],
    cities: ["Dushanbe", "Xujand", "Iskandarko‘l"],
    group: "cis",
  },

  /* ─── Amerika ─── */
  {
    key: "usa",
    label: "AQSh",
    match: ["aqsh", "usa", "amerika", "nyu-york", "new york", "los anjeles", "miami"],
    cities: ["Nyu-York", "Los-Anjeles", "Mayami", "Las-Vegas", "Vashington"],
    group: "america",
  },
  {
    key: "canada",
    label: "Kanada",
    match: ["kanada", "canada", "toronto", "vankuver", "vancouver", "monreal"],
    cities: ["Toronto", "Vankuver", "Monreal"],
    group: "america",
  },
  {
    key: "mexico",
    label: "Meksika",
    match: ["meksika", "mexico", "kankun", "cancun"],
    cities: ["Kankun", "Mexiko", "Playa-del-Karmen"],
    group: "america",
  },
  {
    key: "brazil",
    label: "Braziliya",
    match: ["braziliya", "brazil", "rio", "san-paulu", "sao paulo"],
    cities: ["Rio-de-Janeyro", "San-Paulu"],
    group: "america",
  },

  /* ─── O'zbekiston (ichki turizm) ─── */
  {
    key: "uzbekistan",
    label: "O‘zbekiston (ichki)",
    match: ["uzbekistan", "o'zbekiston", "ozbekiston", "samarqand", "buxoro", "xiva", "toshkent", "shahrisabz"],
    cities: ["Samarqand", "Buxoro", "Xiva", "Toshkent", "Farg‘ona", "Shahrisabz", "Nurota", "Muynoq", "Chorvoq"],
    group: "uz",
    popular: true,
  },
];

/** Katalog filtrida darhol ko'rinadigan mashhur yo'nalishlar. */
export const POPULAR_REGIONS = REGIONS.filter((r) => r.popular);

/** Tur formasidagi dropdown uchun: qit'a → yo'nalishlar. */
export const REGION_GROUPS: { group: RegionGroup; label: string; regions: Region[] }[] = (
  ["gulf", "asia", "europe", "africa", "cis", "america", "uz"] as RegionGroup[]
).map((g) => ({ group: g, label: REGION_GROUP_LABEL[g], regions: REGIONS.filter((r) => r.group === g) }));

export const SORT_OPTIONS = [
  { key: "rating", label: "Reyting bo‘yicha" },
  { key: "price_asc", label: "Narx: arzondan" },
  { key: "price_desc", label: "Narx: qimmatdan" },
] as const;

export type SortKey = (typeof SORT_OPTIONS)[number]["key"];

export function regionByKey(key: string) {
  return REGIONS.find((r) => r.key === key);
}

/** Tur matni qaysi regionga tegishli ekanini keyword bo'yicha aniqlaydi */
export function matchRegion(haystack: string, regionKey: string): boolean {
  if (!regionKey || regionKey === "all") return true;
  const region = regionByKey(regionKey);
  if (!region || region.match.length === 0) return true;
  const hay = haystack.toLowerCase();
  return region.match.some((m) => hay.includes(m));
}
