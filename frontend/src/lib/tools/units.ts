/** 단위 변환(순수 함수) + 신발/옷 사이즈 표. 사이즈 표는 브랜드마다 달라 "참고용"이다. */

export interface LinearPair {
  id: string
  label: string
  a: { unit: string; label: string }
  b: { unit: string; label: string }
  /** a → b */
  aToB: (v: number) => number
  /** b → a */
  bToA: (v: number) => number
}

export const UNIT_PAIRS: LinearPair[] = [
  {
    id: 'temp',
    label: '온도',
    a: { unit: '°C', label: '섭씨' },
    b: { unit: '°F', label: '화씨' },
    aToB: (c) => (c * 9) / 5 + 32,
    bToA: (f) => ((f - 32) * 5) / 9,
  },
  {
    id: 'distance',
    label: '거리',
    a: { unit: 'km', label: '킬로미터' },
    b: { unit: 'mi', label: '마일' },
    aToB: (v) => v / 1.609344,
    bToA: (v) => v * 1.609344,
  },
  {
    id: 'length',
    label: '길이',
    a: { unit: 'cm', label: '센티미터' },
    b: { unit: 'in', label: '인치' },
    aToB: (v) => v / 2.54,
    bToA: (v) => v * 2.54,
  },
  {
    id: 'weight',
    label: '무게',
    a: { unit: 'kg', label: '킬로그램' },
    b: { unit: 'lb', label: '파운드' },
    aToB: (v) => v / 0.45359237,
    bToA: (v) => v * 0.45359237,
  },
  {
    id: 'volume',
    label: '부피',
    a: { unit: 'L', label: '리터' },
    b: { unit: 'gal', label: '갤런(US)' },
    aToB: (v) => v / 3.785411784,
    bToA: (v) => v * 3.785411784,
  },
]

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return ''
  const rounded = Math.round(n * 100) / 100
  return String(rounded)
}

/** 신발: 한국 mm ↔ US/UK/EU (Nike 성인 사이즈 표 기준 근사값). */
export interface ShoeRow {
  kr: number
  us: string
  uk: string
  eu: string
}

export const SHOES_MEN: ShoeRow[] = [
  { kr: 250, us: '7', uk: '6', eu: '40' },
  { kr: 255, us: '7.5', uk: '6.5', eu: '40.5' },
  { kr: 260, us: '8', uk: '7', eu: '41' },
  { kr: 265, us: '8.5', uk: '7.5', eu: '42' },
  { kr: 270, us: '9', uk: '8', eu: '42.5' },
  { kr: 275, us: '9.5', uk: '8.5', eu: '43' },
  { kr: 280, us: '10', uk: '9', eu: '44' },
  { kr: 285, us: '10.5', uk: '9.5', eu: '44.5' },
  { kr: 290, us: '11', uk: '10', eu: '45' },
]

export const SHOES_WOMEN: ShoeRow[] = [
  { kr: 230, us: '6', uk: '3.5', eu: '36.5' },
  { kr: 235, us: '6.5', uk: '4', eu: '37.5' },
  { kr: 240, us: '7', uk: '4.5', eu: '38' },
  { kr: 245, us: '7.5', uk: '5', eu: '38.5' },
  { kr: 250, us: '8', uk: '5.5', eu: '39' },
  { kr: 255, us: '8.5', uk: '6', eu: '40' },
  { kr: 260, us: '9', uk: '6.5', eu: '40.5' },
  { kr: 265, us: '9.5', uk: '7', eu: '41' },
  { kr: 270, us: '10', uk: '7.5', eu: '42' },
]

/** 옷: 한국 호칭 ↔ 알파벳 사이즈(US/EU 공통 표기). 브랜드·핏에 따라 한 치수 차이가 흔하다. */
export const CLOTHES_MEN: Array<{ kr: string; alpha: string }> = [
  { kr: '90', alpha: 'S' },
  { kr: '95', alpha: 'M' },
  { kr: '100', alpha: 'L' },
  { kr: '105', alpha: 'XL' },
  { kr: '110', alpha: 'XXL' },
]

export const CLOTHES_WOMEN: Array<{ kr: string; alpha: string }> = [
  { kr: '44', alpha: 'XS' },
  { kr: '55', alpha: 'S' },
  { kr: '66', alpha: 'M' },
  { kr: '77', alpha: 'L' },
  { kr: '88', alpha: 'XL' },
]
