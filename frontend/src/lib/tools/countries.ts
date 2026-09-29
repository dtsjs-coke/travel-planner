/**
 * 국가별 정적 정보(긴급번호/전압/플러그/팁 문화 + 프리필용 통화·시간대·회화 언어).
 * 확신 없는 항목은 넣지 않는다 — 작성 시점(2026-09) 기준이며, 화면에 "출발 전 0404.go.kr 확인"을
 * 항상 함께 안내한다. `code`는 ISO 3166-1 alpha-2(Open-Meteo 지오코딩의 `country_code`와 동일).
 */

export interface CountryInfo {
  code: string
  name: string
  flag: string
  currency: string
  /** 대표 시간대(IANA). 세계시계 프리필/폴백 목록용. */
  timezone: string
  /** `phrases.ts`의 회화 언어 코드. */
  phraseLang: string
  /** 번역 도구 기본 목표 언어(`translateLanguages.ts` 코드). */
  translateLang: string
  emergency: {
    police: string
    ambulance: string
    fire: string
    /** 추가 안내(통합번호, 관광경찰 등). */
    note?: string
  }
  /** 전압(V) / 주파수(Hz) / 플러그 타입 */
  power: { voltage: string; frequency: string; plugs: string; note?: string }
  tipping: string
  tip: string
}

export const COUNTRIES: CountryInfo[] = [
  {
    code: 'JP',
    name: '일본',
    flag: '🇯🇵',
    currency: 'JPY',
    timezone: 'Asia/Tokyo',
    phraseLang: 'ja',
    translateLang: 'ja',
    emergency: { police: '110', ambulance: '119', fire: '119', note: '구급과 소방은 같은 119입니다.' },
    power: {
      voltage: '100V',
      frequency: '50Hz(동일본) / 60Hz(서일본)',
      plugs: 'A (B)',
      note: '한국 220V 가전은 변압기 없이 쓰면 위험합니다. 110V 지원 여부를 확인하세요.',
    },
    tipping: '팁 문화 없음. 주는 것이 오히려 어색할 수 있습니다.',
    tip: '현금 결제가 필요한 가게가 아직 많고, 대중교통 IC카드(스이카 등)를 쓰면 편합니다.',
  },
  {
    code: 'CN',
    name: '중국',
    flag: '🇨🇳',
    currency: 'CNY',
    timezone: 'Asia/Shanghai',
    phraseLang: 'zh-CN',
    translateLang: 'zh-CN',
    emergency: { police: '110', ambulance: '120', fire: '119' },
    power: { voltage: '220V', frequency: '50Hz', plugs: 'A, C, I' },
    tipping: '팁 문화 없음.',
    tip: '알리페이·위챗페이 중심 결제 환경입니다. 외국 카드/현금 사용 가능 여부를 미리 확인하세요.',
  },
  {
    code: 'TW',
    name: '대만',
    flag: '🇹🇼',
    currency: 'TWD',
    timezone: 'Asia/Taipei',
    phraseLang: 'zh-CN',
    translateLang: 'zh-TW',
    emergency: { police: '110', ambulance: '119', fire: '119', note: '구급과 소방은 같은 119입니다.' },
    power: { voltage: '110V', frequency: '60Hz', plugs: 'A, B', note: '한국 220V 가전은 변압기가 필요합니다.' },
    tipping: '팁 문화 없음. 고급 식당은 서비스료 10%가 붙기도 합니다.',
    tip: '대만은 번체 한자를 씁니다. 회화 카드의 중국어는 간체 기준이라 글자 모양이 다를 수 있습니다.',
  },
  {
    code: 'HK',
    name: '홍콩',
    flag: '🇭🇰',
    currency: 'HKD',
    timezone: 'Asia/Hong_Kong',
    phraseLang: 'en',
    translateLang: 'en',
    emergency: { police: '999', ambulance: '999', fire: '999', note: '경찰·구급·소방 모두 999입니다.' },
    power: { voltage: '220V', frequency: '50Hz', plugs: 'G', note: '영국식 3핀(G) 어댑터가 필요합니다.' },
    tipping: '식당은 서비스료 10%가 포함된 경우가 많고, 아니면 소액 잔돈을 남기는 정도입니다.',
    tip: '현지어는 광둥어라 회화 카드는 영어로 제공합니다.',
  },
  {
    code: 'TH',
    name: '태국',
    flag: '🇹🇭',
    currency: 'THB',
    timezone: 'Asia/Bangkok',
    phraseLang: 'th',
    translateLang: 'th',
    emergency: { police: '191', ambulance: '1669', fire: '199', note: '관광경찰 1155(외국인 대응).' },
    power: { voltage: '220V', frequency: '50Hz', plugs: 'A, B, C, O', note: '한국 플러그(C)를 대부분 그대로 쓸 수 있습니다.' },
    tipping: '의무는 아니지만 마사지·식당에서 20~50바트 정도 남기면 고마워합니다.',
    tip: '왕실과 불교를 존중하세요. 사원 입장 시 어깨·무릎을 가리는 복장이 필요합니다.',
  },
  {
    code: 'VN',
    name: '베트남',
    flag: '🇻🇳',
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    phraseLang: 'vi',
    translateLang: 'vi',
    emergency: { police: '113', ambulance: '115', fire: '114' },
    power: { voltage: '220V', frequency: '50Hz', plugs: 'A, C', note: '한국 플러그(C)를 대부분 그대로 쓸 수 있습니다.' },
    tipping: '의무는 아니지만 소액 팁은 환영받습니다.',
    tip: '택시·오토바이 호출은 그랩(Grab) 앱이 바가지 방지에 유용합니다.',
  },
  {
    code: 'PH',
    name: '필리핀',
    flag: '🇵🇭',
    currency: 'PHP',
    timezone: 'Asia/Manila',
    phraseLang: 'en',
    translateLang: 'en',
    emergency: { police: '911', ambulance: '911', fire: '911', note: '전국 통합 긴급번호 911.' },
    power: { voltage: '220V', frequency: '60Hz', plugs: 'A, B, C' },
    tipping: '서비스료 10%가 포함되지 않은 경우 10% 안팎을 남기는 것이 일반적입니다.',
    tip: '영어가 널리 통용되어 회화 카드는 영어로 제공합니다.',
  },
  {
    code: 'SG',
    name: '싱가포르',
    flag: '🇸🇬',
    currency: 'SGD',
    timezone: 'Asia/Singapore',
    phraseLang: 'en',
    translateLang: 'en',
    emergency: { police: '999', ambulance: '995', fire: '995', note: '구급과 소방은 같은 995입니다.' },
    power: { voltage: '230V', frequency: '50Hz', plugs: 'G', note: '영국식 3핀(G) 어댑터가 필요합니다.' },
    tipping: '팁 문화 없음. 식당에는 보통 서비스료 10% + GST가 이미 붙습니다.',
    tip: '길거리 껌 반입/투기, 공공장소 흡연 등 규정이 엄격합니다.',
  },
  {
    code: 'US',
    name: '미국',
    flag: '🇺🇸',
    currency: 'USD',
    timezone: 'America/New_York',
    phraseLang: 'en',
    translateLang: 'en',
    emergency: { police: '911', ambulance: '911', fire: '911' },
    power: { voltage: '120V', frequency: '60Hz', plugs: 'A, B', note: '한국 220V 가전은 변압기가 필요합니다.' },
    tipping: '식당 15~20%, 택시·배달·호텔 서비스도 팁이 사실상 필수입니다.',
    tip: '넓은 나라라 시간대가 여러 개입니다. 세계시계 탭에서 도시 시간대를 추가하세요.',
  },
  {
    code: 'GB',
    name: '영국',
    flag: '🇬🇧',
    currency: 'GBP',
    timezone: 'Europe/London',
    phraseLang: 'en',
    translateLang: 'en',
    emergency: { police: '999', ambulance: '999', fire: '999', note: '112도 연결됩니다.' },
    power: { voltage: '230V', frequency: '50Hz', plugs: 'G', note: '영국식 3핀(G) 어댑터가 필요합니다.' },
    tipping: '서비스료(10~12.5%)가 계산서에 포함된 경우가 많고, 없으면 10~12.5% 정도를 남깁니다.',
    tip: '펍은 자리에서 주문하지 않고 바에서 주문·결제하는 것이 일반적입니다.',
  },
  {
    code: 'FR',
    name: '프랑스',
    flag: '🇫🇷',
    currency: 'EUR',
    timezone: 'Europe/Paris',
    phraseLang: 'fr',
    translateLang: 'fr',
    emergency: { police: '17', ambulance: '15', fire: '18', note: '유럽 통합 긴급번호 112도 사용 가능.' },
    power: { voltage: '230V', frequency: '50Hz', plugs: 'C, E', note: '한국 플러그(C)를 대부분 그대로 쓸 수 있습니다.' },
    tipping: '서비스료가 포함되어 있어 팁은 필수가 아닙니다. 만족했다면 잔돈 정도를 남깁니다.',
    tip: '가게·식당에 들어갈 때 "봉주르"로 먼저 인사하는 것이 기본 예의입니다.',
  },
  {
    code: 'IT',
    name: '이탈리아',
    flag: '🇮🇹',
    currency: 'EUR',
    timezone: 'Europe/Rome',
    phraseLang: 'en',
    translateLang: 'it',
    emergency: { police: '113', ambulance: '118', fire: '115', note: '통합 긴급번호 112도 사용 가능.' },
    power: { voltage: '230V', frequency: '50Hz', plugs: 'C, F, L', note: '한국 플러그(C)를 대부분 그대로 쓸 수 있습니다.' },
    tipping: '팁은 필수가 아닙니다. 식당에 자릿세(coperto)가 별도로 붙는 경우가 있습니다.',
    tip: '회화 카드에 이탈리아어가 없어 영어로 제공합니다. 번역 탭에서 이탈리아어를 선택할 수 있습니다.',
  },
  {
    code: 'ES',
    name: '스페인',
    flag: '🇪🇸',
    currency: 'EUR',
    timezone: 'Europe/Madrid',
    phraseLang: 'es',
    translateLang: 'es',
    emergency: { police: '112', ambulance: '112', fire: '112', note: '통합 긴급번호 112 하나로 모두 연결됩니다.' },
    power: { voltage: '230V', frequency: '50Hz', plugs: 'C, F', note: '한국 플러그(C)를 대부분 그대로 쓸 수 있습니다.' },
    tipping: '팁은 필수가 아닙니다. 잔돈을 남기거나 5~10% 정도면 충분합니다.',
    tip: '식당의 점심·저녁 시간이 늦습니다(저녁은 보통 20시 이후).',
  },
  {
    code: 'DE',
    name: '독일',
    flag: '🇩🇪',
    currency: 'EUR',
    timezone: 'Europe/Berlin',
    phraseLang: 'en',
    translateLang: 'de',
    emergency: { police: '110', ambulance: '112', fire: '112', note: '구급과 소방은 112입니다.' },
    power: { voltage: '230V', frequency: '50Hz', plugs: 'C, F', note: '한국 플러그(C)를 대부분 그대로 쓸 수 있습니다.' },
    tipping: '계산할 때 금액을 올림해 말하는 방식(5~10%)이 일반적입니다.',
    tip: '일요일에는 대부분의 상점이 문을 닫습니다. 회화 카드는 영어로 제공합니다.',
  },
  {
    code: 'AU',
    name: '호주',
    flag: '🇦🇺',
    currency: 'AUD',
    timezone: 'Australia/Sydney',
    phraseLang: 'en',
    translateLang: 'en',
    emergency: { police: '000', ambulance: '000', fire: '000', note: '휴대폰에서는 112로도 연결됩니다.' },
    power: { voltage: '230V', frequency: '50Hz', plugs: 'I', note: '호주식(I) 어댑터가 필요합니다.' },
    tipping: '팁 문화가 강하지 않습니다. 고급 식당에서 10% 정도면 충분합니다.',
    tip: '자외선이 매우 강하니 선크림이 필수입니다. 반대 계절(남반구)에 유의하세요.',
  },
]

export function findCountry(code: string | null | undefined): CountryInfo | undefined {
  if (!code) return undefined
  return COUNTRIES.find((c) => c.code === code.toUpperCase())
}

/** 세계시계 시간대 목록 폴백(`Intl.supportedValuesOf` 미지원 브라우저용). */
export const FALLBACK_TIMEZONES: string[] = [
  'Asia/Seoul',
  ...COUNTRIES.map((c) => c.timezone),
  'America/Los_Angeles',
  'America/Chicago',
  'Europe/Istanbul',
  'Asia/Dubai',
  'Pacific/Auckland',
  'Pacific/Honolulu',
]
