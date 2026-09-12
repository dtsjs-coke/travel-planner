/**
 * 백엔드 에러 문구(영어, ADR-0002) → 한국어 안내 매핑.
 *
 * 백엔드는 API 계약 언어 일관성을 위해 `detail`을 전부 영어로 유지하기로 했고, 사용자에게
 * 보여줄 한국어 문구는 프론트가 매핑하기로 정해져 있었다
 * (`docs/adr/0002-day-unique-constraint-and-conflict-handling.md`의
 * "왜 에러 문구를 영어로 두는가" 참고). 이 파일이 그 매핑 테이블이다.
 *
 * 매칭 규칙:
 * - pydantic validation 에러(422)는 `detail`이 `[{"msg": "Value error, <메시지>", ...}]`
 *   형태로 오므로, 매칭 전에 "Value error, " 접두사를 벗겨낸다(`stripValueErrorPrefix`).
 *   `HTTPException`의 `detail`(단순 문자열)에는 이 접두사가 없으므로 그대로 통과한다.
 * - 동적 값이 섞이지 않은 정적 문구는 `EXACT_MESSAGES`에서 문자 그대로 일치하는 것만 매칭한다.
 * - 상한값(개수/일수/글자수)처럼 동적 값이 메시지 안에 섞인 경우는 `DYNAMIC_MESSAGE_RULES`의
 *   정규식으로 매칭해 그 값만 그대로 살려 한국어 문장에 끼워 넣는다. 값 자체는 백엔드 상수라
 *   나중에 바뀌어도(예: MAX_TRIP_DAYS 조정) 이 파일을 고칠 필요가 없다.
 * - 응답 안에 임의의 원문(예: 구글 API 응답 본문)이 그대로 섞여 오는 문구는 정확히 매칭할 수
 *   없으므로 접두사만으로 판별한다.
 * - 매핑에 없는 문구는 `null`을 반환한다 — 호출자(`extractErrorMessage`)가 영어 원문 또는
 *   자신의 fallback 문구로 폴백한다. 매핑 누락이 "에러가 아예 안 보임"이 되지 않게 하기 위함.
 */

const VALUE_ERROR_PREFIX = 'Value error, '

function stripValueErrorPrefix(message: string): string {
  return message.startsWith(VALUE_ERROR_PREFIX) ? message.slice(VALUE_ERROR_PREFIX.length) : message
}

/** 동적 값이 섞이지 않은, 문자 그대로 일치하는 문구. */
const EXACT_MESSAGES: Record<string, string> = {
  // --- 인증 (app/auth.py, app/deps.py) ---
  'Invalid passcode': '비밀번호가 올바르지 않습니다.',
  'Not authenticated': '로그인이 필요합니다.',

  // --- 존재하지 않는 리소스 (여러 라우터 공통) ---
  'Trip not found': '여행을 찾을 수 없습니다.',
  'Day not found': '날짜(Day)를 찾을 수 없습니다.',
  'Item not found': '일정을 찾을 수 없습니다.',
  'Checklist item not found': '체크리스트 항목을 찾을 수 없습니다.',

  // --- 여행 기간 검증 (app/services/trip_days.py: validate_date_range) ---
  'end_date must be on or after start_date': '종료일은 시작일과 같거나 이후여야 합니다.',

  // --- Day 중복/동시 수정 충돌 (ADR-0002, app/routers/days.py, app/routers/trips.py) ---
  'this trip already has a day with that date': '이미 같은 날짜가 등록되어 있습니다.',
  "another request just changed this trip's days; refresh and try again":
    '다른 사람이 방금 이 여행의 날짜를 수정했습니다. 새로고침 후 다시 시도해주세요.',

  // --- 일정 이동/정렬 (app/routers/items.py) ---
  'target day must belong to the same trip as the item': '같은 여행 안의 날짜로만 옮길 수 있습니다.',
  'ordered_item_ids must match exactly the items in this day':
    '일정 순서 정보가 최신 상태와 달라 반영하지 못했습니다. 새로고침 후 다시 시도해주세요.',

  // --- 여행/일정 이름·제목 (app/schemas.py) ---
  'name must not be null': '여행 이름은 비워둘 수 없습니다.',
  'title must not be empty': '일정 제목을 입력해주세요.',

  // --- 체크리스트 (app/schemas.py) ---
  'text must not be empty': '내용을 입력해주세요.',
  'is_checked must not be null': '체크 상태 값이 올바르지 않습니다.',

  // --- 비용 (app/schemas.py: _normalize_cost_amount) ---
  'cost_amount must be a finite number': '금액에 유효한 숫자를 입력해주세요.',
  'cost_amount must not be negative': '금액은 0 이상이어야 합니다.',

  // --- 마스터 환경설정 (app/services/app_settings.py) ---
  'participant names must be different from each other': '두 참가자의 이름은 서로 달라야 합니다.',

  // --- 구글 장소 검색 서버 설정 (app/services/google_places.py) ---
  'GOOGLE_PLACES_SERVER_KEY is not configured':
    '장소 검색 기능을 지금 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
}

/** 상한값 등 동적 값이 메시지 안에 섞여 있어 정규식으로 값만 뽑아 문장에 끼워 넣는 경우. */
const DYNAMIC_MESSAGE_RULES: Array<{
  pattern: RegExp
  translate: (match: RegExpMatchArray) => string
}> = [
  // app/services/trip_days.py: validate_date_range()
  // f"trip cannot span more than {MAX_TRIP_DAYS} days"
  {
    pattern: /^trip cannot span more than (\d+) days$/,
    translate: (m) => `여행 기간은 최대 ${m[1]}일까지 설정할 수 있습니다.`,
  },
  // app/routers/trips.py: update_trip() — 여행이 보유할 수 있는 총 Day 개수 상한
  // f"trip cannot hold more than {MAX_TRIP_TOTAL_DAYS} days (delete out-of-range days first)"
  {
    pattern: /^trip cannot hold more than (\d+) days \(delete out-of-range days first\)$/,
    translate: (m) =>
      `이 여행은 날짜를 최대 ${m[1]}개까지 보유할 수 있습니다. 기간을 벗어난 날짜를 먼저 정리해주세요.`,
  },
  // app/routers/checklist.py: create_checklist_item()
  // f"trip cannot hold more than {MAX_TRIP_CHECKLIST_ITEMS} checklist items"
  {
    pattern: /^trip cannot hold more than (\d+) checklist items$/,
    translate: (m) => `체크리스트는 최대 ${m[1]}개까지 추가할 수 있습니다.`,
  },
  // app/schemas.py: _validate_name_length() / _normalize_checklist_text()
  // f"{field_label} must be at most {max_length} characters" (field_label: name/title/text)
  {
    pattern: /^(name|title|text) must be at most (\d+) characters$/,
    translate: (m) => {
      const fieldLabel: Record<string, string> = {
        name: '여행 이름',
        title: '일정 제목',
        text: '내용',
      }
      return `${fieldLabel[m[1]] ?? m[1]}은(는) 최대 ${m[2]}자까지 입력할 수 있습니다.`
    },
  },
  // app/schemas.py: AppSettingsUpdate._validate_participants()
  // f"participant name for '{key}' must not be empty"
  {
    pattern: /^participant name for '.+' must not be empty$/,
    translate: () => '참가자 이름을 입력해주세요.',
  },
  // f"participant name for '{key}' must be at most {MAX_PARTICIPANT_NAME_LENGTH} characters"
  {
    pattern: /^participant name for '.+' must be at most (\d+) characters$/,
    translate: (m) => `참가자 이름은 최대 ${m[1]}자까지 입력할 수 있습니다.`,
  },
  // f"unknown participant key '{key}' (allowed: {allowed})" — 정상 사용에서는 도달하지
  // 않지만(프론트가 항상 알려진 키만 보냄), 방어적으로 매핑해둔다.
  {
    pattern: /^unknown participant key '.+' \(allowed: .+\)$/,
    translate: () => '알 수 없는 참가자입니다. 새로고침 후 다시 시도해주세요.',
  },
  // app/schemas.py: _normalize_paid_by() — f"paid_by must be one of: {allowed} (or null)"
  {
    pattern: /^paid_by must be one of: .+ \(or null\)$/,
    translate: () => '결제자 값이 올바르지 않습니다. 새로고침 후 다시 시도해주세요.',
  },
  // app/services/google_places.py: 구글 API 응답 원문(response.text)이 뒤에 그대로 붙으므로
  // 정확히 매칭할 수 없다 — 접두사만으로 판별한다.
  // f"Google Places search failed: {response.text}" / f"Google Place details failed: {response.text}"
  {
    pattern: /^Google Places? (search|details) failed:/,
    translate: () => '구글 장소 검색에 실패했습니다. 잠시 후 다시 시도해주세요.',
  },
]

/**
 * 백엔드 에러 문구를 한국어로 번역한다. 매핑이 없으면 `null`을 반환한다(호출자가 영어 원문
 * 또는 자체 fallback으로 폴백해야 함).
 *
 * @param rawMessage `HTTPException`의 `detail` 문자열, 또는 pydantic validation 배열
 *                    (`detail: [{msg, ...}]`)에서 뽑은 `msg` 값
 */
export function translateErrorDetail(rawMessage: string): string | null {
  const message = stripValueErrorPrefix(rawMessage)
  if (message in EXACT_MESSAGES) {
    return EXACT_MESSAGES[message]
  }
  for (const rule of DYNAMIC_MESSAGE_RULES) {
    if (rule.pattern.test(message)) {
      return rule.translate(message.match(rule.pattern)!)
    }
  }
  return null
}
