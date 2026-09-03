/**
 * i18n 설정. 대상은 외국인 여행객이라 **한국어 UI 는 만들지 않는다.**
 *
 * 4개 로케일 각각이 관광공사 외국어 서비스 하나에 1:1 매핑된다. 로케일 코드는 URL 세그먼트
 * (`/en` `/ja` `/zh-CN` `/zh-TW`)이자 `<html lang>`·hreflang 값이다.
 *
 * ★ 사전의 문구는 기계번역이 아니라 각 언어로 직접 쓴 것이다. 특히 택스리펀 고지(taxRefundNote)는
 *   돈이 걸린 정직성의 핵심이라 각 언어로 정확히 옮긴다 — "여기서 택스리펀 됩니다"까지가 한계고
 *   환급률·금액은 절대 계산하지 않는다는 이 앱의 천장을 사용자에게 명시한다.
 */

export const LOCALES = ['en', 'ja', 'zh-CN', 'zh-TW'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** 로케일 → 관광공사 외국어 서비스명(서버 전용). */
export const SERVICE_BY_LOCALE: Record<Locale, string> = {
  en: 'EngService2',
  ja: 'JpnService2',
  'zh-CN': 'ChsService2',
  'zh-TW': 'ChtService2',
};

/** `<html lang>` 에 넣을 BCP-47 값. */
export const HTML_LANG: Record<Locale, string> = {
  en: 'en',
  ja: 'ja',
  'zh-CN': 'zh-Hans',
  'zh-TW': 'zh-Hant',
};

/** 언어 선택 UI에 보일 자기 언어 이름(모국어 표기). */
export const LOCALE_LABEL: Record<Locale, string> = {
  en: 'English',
  ja: '日本語',
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
};

export interface Dict {
  appName: string;
  tagline: string;
  heroTitle: string;
  heroSubtitle: string;
  openMap: string;
  /** 필터 */
  filterTaxRefundOnly: string;
  filterAllBrands: string;
  brandLabel: string;
  /** 리스트/지도 */
  nearbyShops: string;
  shopsCount: (n: number) => string;
  sortByDistance: string;
  moreInArea: (n: number) => string;
  /** 택스리펀 배지·고지(정직성 핵심) */
  taxRefundYes: string;
  taxRefundUnknown: string;
  taxRefundNoteTitle: string;
  taxRefundNote: string;
  taxRefundGeneralInfo: string;
  /** 거리 */
  distanceAway: (km: number) => string;
  distanceFromMyeongdong: (km: number) => string;
  /** 상세 */
  detailAbout: string;
  detailAddress: string;
  detailTel: string;
  detailHomepage: string;
  directions: string;
  close: string;
  /** 결측·오류·빈 상태 — 서로 다르게 보여야 한다(F-6) */
  noInfo: string;
  overviewMissing: string;
  emptyNearby: string;
  emptyNearbyHint: string;
  loadFailed: string;
  retry: string;
  loading: string;
  /** 위치 */
  locating: string;
  locationDenied: string;
  locationUnavailable: string;
  locationFallback: string;
  useMyLocation: string;
  /** 데이터 출처 */
  dataSource: string;
  langLabel: string;
}

const en: Dict = {
  appName: 'TaxFree Now',
  tagline: 'Tax-refund shops near you',
  heroTitle: 'Tax-free shopping near you, in your language',
  heroSubtitle:
    'Find shops that offer tax refunds around you — on a map, sorted by distance, in English. Filter by brand like Olive Young. The official brand apps only show their own stores; map apps can’t filter for tax refunds. This does.',
  openMap: 'Open the map',
  filterTaxRefundOnly: 'Tax-refund only',
  filterAllBrands: 'All brands',
  brandLabel: 'Brand',
  nearbyShops: 'Nearby shops',
  shopsCount: (n) => (n === 1 ? '1 shop' : `${n} shops`),
  sortByDistance: 'Nearest first',
  moreInArea: (n) => `Showing the ${n} nearest`,
  taxRefundYes: 'Tax refund',
  taxRefundUnknown: 'Refund status unknown',
  taxRefundNoteTitle: 'About tax refunds',
  taxRefundNote:
    'These shops are tagged as tax-refund eligible by the Korea Tourism Organization. We can’t tell you the refund rate or how much you’ll get back — that depends on the shop and the operator. Always check in-store.',
  taxRefundGeneralInfo:
    'Bring your passport. A minimum purchase and other conditions usually apply, and rules vary by shop.',
  distanceAway: (km) => (km < 1 ? `${Math.round(km * 1000)} m away` : `${km.toFixed(1)} km away`),
  distanceFromMyeongdong: (km) =>
    km < 1 ? `${Math.round(km * 1000)} m from Myeongdong` : `${km.toFixed(1)} km from Myeongdong`,
  detailAbout: 'About',
  detailAddress: 'Address',
  detailTel: 'Contact',
  detailHomepage: 'Website',
  directions: 'Directions',
  close: 'Close',
  noInfo: 'No information',
  overviewMissing: 'No description available in English yet.',
  emptyNearby: 'No shops found near you',
  emptyNearbyHint: 'Try turning off a filter, or move the map to another area.',
  loadFailed: 'Could not load shops',
  retry: 'Retry',
  loading: 'Loading shops…',
  locating: 'Finding your location…',
  locationDenied:
    'Location permission denied — showing Myeongdong. You can enable it in your browser settings.',
  locationUnavailable: 'Could not get your location — showing Myeongdong.',
  locationFallback: 'Showing Myeongdong',
  useMyLocation: 'Use my location',
  dataSource: 'Data: Korea Tourism Organization (TourAPI)',
  langLabel: 'Language',
};

const ja: Dict = {
  appName: 'タックスフリーナウ',
  tagline: 'あなたの近くの免税店',
  heroTitle: 'あなたの近くの免税ショッピングを、あなたの言語で',
  heroSubtitle:
    'タックスリファンド(税金還付)ができるお店を、地図上で近い順に日本語で表示します。オリーブヤングなどブランドで絞り込めます。公式アプリは自社店舗だけ、地図アプリは免税で絞れません。これができます。',
  openMap: '地図を開く',
  filterTaxRefundOnly: '免税店のみ',
  filterAllBrands: 'すべてのブランド',
  brandLabel: 'ブランド',
  nearbyShops: '近くのお店',
  shopsCount: (n) => `${n}件`,
  sortByDistance: '近い順',
  moreInArea: (n) => `近い順に${n}件を表示`,
  taxRefundYes: '免税',
  taxRefundUnknown: '免税可否は不明',
  taxRefundNoteTitle: 'タックスリファンドについて',
  taxRefundNote:
    'これらの店舗は韓国観光公社が「事後免税店」として登録したお店です。還付率や実際に戻る金額はお伝えできません — 店舗や事業者によって異なります。必ず店頭でご確認ください。',
  taxRefundGeneralInfo:
    'パスポートをお持ちください。通常は最低購入金額などの条件があり、内容は店舗によって異なります。',
  distanceAway: (km) => (km < 1 ? `${Math.round(km * 1000)} m先` : `${km.toFixed(1)} km先`),
  distanceFromMyeongdong: (km) =>
    km < 1 ? `明洞から${Math.round(km * 1000)} m` : `明洞から${km.toFixed(1)} km`,
  detailAbout: '概要',
  detailAddress: '住所',
  detailTel: '連絡先',
  detailHomepage: 'ウェブサイト',
  directions: '経路案内',
  close: '閉じる',
  noInfo: '情報なし',
  overviewMissing: '日本語の説明はまだありません。',
  emptyNearby: '近くにお店が見つかりませんでした',
  emptyNearbyHint: 'フィルターを外すか、地図を別の地域へ動かしてください。',
  loadFailed: 'お店を読み込めませんでした',
  retry: '再試行',
  loading: 'お店を読み込み中…',
  locating: '現在地を取得中…',
  locationDenied: '位置情報が拒否されました — 明洞を表示します。ブラウザ設定で許可できます。',
  locationUnavailable: '現在地を取得できませんでした — 明洞を表示します。',
  locationFallback: '明洞を表示中',
  useMyLocation: '現在地を使う',
  dataSource: 'データ:韓国観光公社(TourAPI)',
  langLabel: '言語',
};

const zhCN: Dict = {
  appName: '免税Now',
  tagline: '你附近的退税商店',
  heroTitle: '用你的语言,发现你附近的退税购物',
  heroSubtitle:
    '在地图上按距离显示可以退税的商店,用简体中文。可按品牌筛选,比如 Olive Young(欧利芙洋)。官方品牌应用只显示自家门店,地图应用无法按退税筛选,而这里可以。',
  openMap: '打开地图',
  filterTaxRefundOnly: '仅退税商店',
  filterAllBrands: '全部品牌',
  brandLabel: '品牌',
  nearbyShops: '附近的商店',
  shopsCount: (n) => `${n} 家`,
  sortByDistance: '由近到远',
  moreInArea: (n) => `显示最近的 ${n} 家`,
  taxRefundYes: '退税',
  taxRefundUnknown: '退税情况未知',
  taxRefundNoteTitle: '关于退税',
  taxRefundNote:
    '这些商店是韩国观光公社标记的「事后免税店」。我们无法告诉你退税比例或能退回多少 — 这取决于商店和退税运营商。请务必在店内确认。',
  taxRefundGeneralInfo: '请携带护照。通常有最低消费金额等条件,具体规定因店而异。',
  distanceAway: (km) => (km < 1 ? `${Math.round(km * 1000)} 米` : `${km.toFixed(1)} 公里`),
  distanceFromMyeongdong: (km) =>
    km < 1 ? `距明洞 ${Math.round(km * 1000)} 米` : `距明洞 ${km.toFixed(1)} 公里`,
  detailAbout: '简介',
  detailAddress: '地址',
  detailTel: '联系方式',
  detailHomepage: '官网',
  directions: '路线',
  close: '关闭',
  noInfo: '暂无信息',
  overviewMissing: '暂无简体中文简介。',
  emptyNearby: '附近没有找到商店',
  emptyNearbyHint: '试试关闭一个筛选条件,或将地图移到其他区域。',
  loadFailed: '无法加载商店',
  retry: '重试',
  loading: '正在加载商店…',
  locating: '正在获取你的位置…',
  locationDenied: '定位权限被拒绝 — 改为显示明洞。你可以在浏览器设置中允许。',
  locationUnavailable: '无法获取你的位置 — 改为显示明洞。',
  locationFallback: '正在显示明洞',
  useMyLocation: '使用我的位置',
  dataSource: '数据:韩国观光公社(TourAPI)',
  langLabel: '语言',
};

const zhTW: Dict = {
  appName: '免稅Now',
  tagline: '你附近的退稅商店',
  heroTitle: '用你的語言,發現你附近的退稅購物',
  heroSubtitle:
    '在地圖上依距離顯示可以退稅的商店,用繁體中文。可依品牌篩選,例如 Olive Young。官方品牌 App 只顯示自家門市,地圖 App 無法用退稅篩選,而這裡可以。',
  openMap: '開啟地圖',
  filterTaxRefundOnly: '僅退稅商店',
  filterAllBrands: '全部品牌',
  brandLabel: '品牌',
  nearbyShops: '附近的商店',
  shopsCount: (n) => `${n} 家`,
  sortByDistance: '由近到遠',
  moreInArea: (n) => `顯示最近的 ${n} 家`,
  taxRefundYes: '退稅',
  taxRefundUnknown: '退稅狀況不明',
  taxRefundNoteTitle: '關於退稅',
  taxRefundNote:
    '這些商店是韓國觀光公社標記的「事後免稅店」。我們無法告訴你退稅比例或能退回多少 — 這取決於商店與退稅業者。請務必在店內確認。',
  taxRefundGeneralInfo: '請攜帶護照。通常有最低消費金額等條件,實際規定因店而異。',
  distanceAway: (km) => (km < 1 ? `${Math.round(km * 1000)} 公尺` : `${km.toFixed(1)} 公里`),
  distanceFromMyeongdong: (km) =>
    km < 1 ? `距明洞 ${Math.round(km * 1000)} 公尺` : `距明洞 ${km.toFixed(1)} 公里`,
  detailAbout: '簡介',
  detailAddress: '地址',
  detailTel: '聯絡方式',
  detailHomepage: '官網',
  directions: '路線',
  close: '關閉',
  noInfo: '暫無資訊',
  overviewMissing: '暫無繁體中文簡介。',
  emptyNearby: '附近沒有找到商店',
  emptyNearbyHint: '試試關閉一個篩選條件,或將地圖移到其他區域。',
  loadFailed: '無法載入商店',
  retry: '重試',
  loading: '正在載入商店…',
  locating: '正在取得你的位置…',
  locationDenied: '定位權限被拒絕 — 改為顯示明洞。你可以在瀏覽器設定中允許。',
  locationUnavailable: '無法取得你的位置 — 改為顯示明洞。',
  locationFallback: '正在顯示明洞',
  useMyLocation: '使用我的位置',
  dataSource: '資料:韓國觀光公社(TourAPI)',
  langLabel: '語言',
};

export const DICT: Record<Locale, Dict> = { en, ja, 'zh-CN': zhCN, 'zh-TW': zhTW };

export function dict(locale: Locale): Dict {
  return DICT[locale];
}
