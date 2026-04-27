export type SgPostalDistrictRange = {
  district: string
  sectorMin: number
  sectorMax: number
  label: string
}

export const SG_POSTAL_DISTRICT_RANGES: ReadonlyArray<SgPostalDistrictRange> = [
  { district: '01', sectorMin: 1, sectorMax: 1, label: 'Raffles Place / Cecil, Marina Square' },
  { district: '02', sectorMin: 2, sectorMax: 2, label: 'Chinatown, Tanjong Pagar' },
  { district: '03', sectorMin: 3, sectorMax: 8, label: 'Hill St, Victoria St, Mt Sophia' },
  { district: '04', sectorMin: 9, sectorMax: 10, label: 'Boat Quay / Robertson, Havelock Rd' },
  { district: '05', sectorMin: 11, sectorMax: 12, label: 'Museum / Waterloo St, Niven Rd' },
  { district: '06', sectorMin: 13, sectorMax: 14, label: 'Little India / Jalan Besar' },
  { district: '07', sectorMin: 15, sectorMax: 16, label: 'Balestier / Toa Payoh / Serangoon' },
  { district: '08', sectorMin: 17, sectorMax: 18, label: 'Upper Serangoon / Thomson' },
  { district: '09', sectorMin: 19, sectorMax: 20, label: 'Upper Bukit Timah / Clementi Park' },
  { district: '10', sectorMin: 21, sectorMax: 22, label: 'Bukit Timah / Holland / Newton' },
  { district: '11', sectorMin: 23, sectorMax: 24, label: 'Novena / Thompson Rd' },
  { district: '12', sectorMin: 25, sectorMax: 26, label: 'Balestier / Toa Payoh / Serangoon North' },
  { district: '13', sectorMin: 27, sectorMax: 28, label: 'MacPherson / Braddell Rd' },
  { district: '14', sectorMin: 29, sectorMax: 30, label: 'Eunos / Geylang / Paya Lebar' },
  { district: '15', sectorMin: 31, sectorMax: 32, label: 'Marine Parade / Katong / Joo Chiat' },
  { district: '16', sectorMin: 33, sectorMax: 34, label: 'Bedok / Upper East Coast' },
  { district: '17', sectorMin: 35, sectorMax: 36, label: 'Tampines / Pasir Ris / Simei' },
  { district: '18', sectorMin: 37, sectorMax: 38, label: 'Simei / Upper Changi Rd' },
  { district: '19', sectorMin: 39, sectorMax: 40, label: 'Tampines West / Hougang / Punggol' },
  { district: '20', sectorMin: 41, sectorMax: 42, label: 'Ang Mo Kio / Bishan / Yio Chu Kang' },
  { district: '21', sectorMin: 43, sectorMax: 45, label: 'Upper Thomson / Yishun / Khatib' },
  { district: '22', sectorMin: 46, sectorMax: 48, label: 'Yishun / Sembawang' },
  { district: '23', sectorMin: 49, sectorMax: 50, label: 'Upper Thomson / Mandai' },
  { district: '24', sectorMin: 51, sectorMax: 52, label: 'Woodlands / Kranji' },
  { district: '25', sectorMin: 53, sectorMax: 54, label: 'Woodlands / Kranji Extension' },
  { district: '26', sectorMin: 55, sectorMax: 56, label: 'Upper Bukit Timah / Dairy Farm' },
  { district: '27', sectorMin: 57, sectorMax: 58, label: 'Bukit Panjang / Choa Chu Kang' },
  { district: '28', sectorMin: 59, sectorMax: 70, label: 'Western / Tuas / Jurong / Boon Lay' },
]

export type SgSpecialPostcodeZone = {
  prefix3: string
  label: string
}

export const SG_SPECIAL_POSTCODE_ZONES: ReadonlyArray<SgSpecialPostcodeZone> = [
  { prefix3: '018', label: 'Marina Bay / Downtown Core 2' },
  { prefix3: '019', label: 'Marina Bay / Gardens by the Bay' },
  { prefix3: '097', label: 'Sentosa Island (Southern)' },
  { prefix3: '098', label: 'Sentosa Island (Western)' },
  { prefix3: '117', label: 'West Coast / Labrador Park' },
  { prefix3: '118', label: 'West Coast / Normanton Park' },
  { prefix3: '119', label: 'West Coast / Labrador' },
  { prefix3: '367', label: 'Bidadari / Woodleigh' },
  { prefix3: '797', label: 'Seletar' },
  { prefix3: '819', label: 'Changi Airport' },
  { prefix3: '829', label: 'Expo / Simei East' },
]

export type SgDerivedAdministrativeAreas = {
  countryCode: 'SGP'
  city: string
  postalCode: string
  postalSector: string
  postalDistrict: string
  postalDistrictLabel: string
  specialZonePrefix3: string | null
  specialZoneLabel: string | null
  planningArea: string | null
}

type PlanningAreaRule = {
  label: string
  match: RegExp
}

const SG_PLANNING_AREA_RULES: ReadonlyArray<PlanningAreaRule> = [
  { label: 'Orchard', match: /\b(orchard|scotts|paterson|tanglin|balmoral)\b/i },
  { label: 'Raffles Place / Downtown', match: /\b(raffles|market st|raffles quay|raffles blvd|raffles place|cross st|robinson)\b/i },
  { label: 'Marina Bay', match: /\b(marina|bayfront|gardens by the bay|shenton way)\b/i },
  { label: 'Outram / Chinatown', match: /\b(chinatown|maxwell|south bridge|keong saik|neil rd|smith st|sago st)\b/i },
  { label: 'Bugis / Rochor', match: /\b(bugis|roch(o)?r|ophir|north bridge|beach rd|victoria st|queen st)\b/i },
  { label: 'Kallang / Geylang', match: /\b(kallang|geylang|aljunied|lorong|old airport)\b/i },
  { label: 'Paya Lebar', match: /\b(paya lebar)\b/i },
  { label: 'Bedok', match: /\b(bedok|new upper changi)\b/i },
  { label: 'Tampines', match: /\b(tampines)\b/i },
  { label: 'Simei', match: /\b(simei)\b/i },
  { label: 'Pasir Ris', match: /\b(pasir ris|white sands)\b/i },
  { label: 'Hougang', match: /\b(hougang|upper serangoon)\b/i },
  { label: 'Ang Mo Kio', match: /\b(ang mo kio|amk)\b/i },
  { label: 'Bishan', match: /\b(bishan)\b/i },
  { label: 'Yishun / Sembawang', match: /\b(yishun|sembawang|canberra|khatib)\b/i },
  { label: 'Woodlands', match: /\b(woodlands|kranji|admiralty)\b/i },
  { label: 'Choa Chu Kang', match: /\b(choa chu kang|teck whye|lot one)\b/i },
  { label: 'Bukit Panjang', match: /\b(bukit panjang)\b/i },
  { label: 'Jurong / Tuas', match: /\b(jurong|tuas|boon lay)\b/i },
]

const coerceSgPostcode = (raw: unknown): string => {
  const digits = String(raw || '').replace(/[^0-9]/g, '')
  if (digits.length !== 6) return ''
  return digits
}

const readPostalSector = (postcode: string): string => {
  if (!postcode || postcode.length < 2) return ''
  return postcode.slice(0, 2)
}

const resolvePostalDistrict = (sectorRaw: string): { district: string; label: string } | null => {
  const sectorNum = Number(sectorRaw)
  if (!Number.isFinite(sectorNum)) return null
  const sector = Math.floor(sectorNum)
  if (sector <= 0) return null
  for (const r of SG_POSTAL_DISTRICT_RANGES) {
    if (sector >= r.sectorMin && sector <= r.sectorMax) {
      return { district: r.district, label: r.label }
    }
  }
  return null
}

const resolveSpecialZone = (postcode: string): { prefix3: string; label: string } | null => {
  const prefix3 = postcode.slice(0, 3)
  for (const z of SG_SPECIAL_POSTCODE_ZONES) {
    if (z.prefix3 === prefix3) return { prefix3: z.prefix3, label: z.label }
  }
  return null
}

const resolvePlanningArea = (streetRaw: unknown): string | null => {
  const street = String(streetRaw || '').trim()
  if (!street) return null
  for (const rule of SG_PLANNING_AREA_RULES) {
    if (rule.match.test(street)) return rule.label
  }
  return null
}

export const deriveSgAdministrativeAreasFromAddress = (args: {
  postcode?: unknown
  street?: unknown
  city?: unknown
  countryCode?: unknown
}): SgDerivedAdministrativeAreas | null => {
  const countryCode = String(args.countryCode || '').trim().toUpperCase()
  if (countryCode && countryCode !== 'SGP') return null
  const postalCode = coerceSgPostcode(args.postcode)
  if (!postalCode) return null

  const postalSector = readPostalSector(postalCode)
  const district = resolvePostalDistrict(postalSector)
  if (!district) return null

  const special = resolveSpecialZone(postalCode)
  const cityRaw = String(args.city || '').trim()
  const city = cityRaw || 'Singapore City'
  const planningArea = resolvePlanningArea(args.street)

  return {
    countryCode: 'SGP',
    city,
    postalCode,
    postalSector,
    postalDistrict: district.district,
    postalDistrictLabel: district.label,
    specialZonePrefix3: special ? special.prefix3 : null,
    specialZoneLabel: special ? special.label : null,
    planningArea,
  }
}

