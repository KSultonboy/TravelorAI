// Yagona manba: yo'nalish (region/davlat) → shaharlar.
// Katalog filtri (Region → Shahar bog'liq dropdown) va hamkor/ariza formasi shu manbadan foydalanadi.

export type Region = {
  key: string;
  label: string;
  /** Mobil/agentlik filtrlari bilan mos keyword'lar */
  match: string[];
  cities: string[];
};

export const REGIONS: Region[] = [
  {
    key: "uae",
    label: "BAA (Dubay)",
    match: ["baa", "dubai", "dubay", "uae", "emirat", "abu dhabi", "abu-dhabi"],
    cities: ["Dubay", "Abu-Dabi", "Sharja", "Ras al-Xayma"],
  },
  {
    key: "turkey",
    label: "Turkiya",
    match: ["turkiya", "turkey", "turk", "antalya", "istanbul", "stambul", "bodrum"],
    cities: ["Istanbul", "Antalya", "Bodrum", "Kappadokiya", "Trabzon"],
  },
  {
    key: "egypt",
    label: "Misr",
    match: ["misr", "egypt", "sharm", "hurghada"],
    cities: ["Sharm-ash-Shayx", "Hurg'ada", "Qohira"],
  },
  {
    key: "saudi",
    label: "Saudiya Arabistoni",
    match: ["saudiya", "saudi", "makka", "madina", "umra", "umrah", "hajj", "haj"],
    cities: ["Makka", "Madina", "Jidda"],
  },
  {
    key: "thailand",
    label: "Tailand",
    match: ["tailand", "thailand", "phuket", "bangkok", "pattaya"],
    cities: ["Bangkok", "Phuket", "Pattaya", "Chiangmay"],
  },
  {
    key: "maldives",
    label: "Maldiv orollari",
    match: ["maldiv", "maldive"],
    cities: ["Male", "Maafushi"],
  },
  {
    key: "georgia",
    label: "Gruziya",
    match: ["gruziya", "georgia", "batumi", "tbilisi"],
    cities: ["Botumi", "Tbilisi", "Bakuriani"],
  },
  {
    key: "malaysia",
    label: "Malayziya",
    match: ["malayziya", "malaysia", "kuala"],
    cities: ["Kuala-Lumpur", "Langkavi", "Penang"],
  },
  {
    key: "indonesia",
    label: "Indoneziya (Bali)",
    match: ["indoneziya", "indonesia", "bali", "jakarta"],
    cities: ["Bali", "Jakarta", "Yogyakarta"],
  },
  {
    key: "qatar",
    label: "Qatar",
    match: ["qatar", "doha"],
    cities: ["Doha"],
  },
  {
    key: "azerbaijan",
    label: "Ozarbayjon",
    match: ["ozarbayjon", "azerbaijan", "baku", "boku"],
    cities: ["Boku", "Gabala", "Sheki"],
  },
  {
    key: "europe",
    label: "Yevropa",
    match: ["yevropa", "europe", "parij", "paris", "rim", "rome", "london", "barcelona", "praga"],
    cities: ["Parij", "Rim", "London", "Barselona", "Praga"],
  },
  {
    key: "uzbekistan",
    label: "O‘zbekiston (ichki)",
    match: ["uzbekistan", "o'zbekiston", "ozbekiston", "samarqand", "buxoro", "xiva", "toshkent"],
    cities: ["Samarqand", "Buxoro", "Xiva", "Toshkent", "Farg‘ona"],
  },
];

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
