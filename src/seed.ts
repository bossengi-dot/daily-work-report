import type { AppState, DailyReport, Employee, ItemStatus, WorkItem } from './types'
import { DEFAULT_SETTINGS } from './types'

const TODAY = '2026-09-17'

/** 영업일 5일: 09-11(금), 09-14~17(월~목) */
export const BUSINESS_DAYS = [
  '2026-09-11',
  '2026-09-14',
  '2026-09-15',
  '2026-09-16',
  '2026-09-17',
] as const

export const STORAGE_KEY = 'daily-report-mvp-v4'
export const SETTINGS_KEY = 'daily-report-mvp-settings-v1'
export const SESSION_KEY = 'daily-report-mvp-session-v1'

/** UX stub only — not real security */
export const MANAGER_PIN = '0000'

const TOPIC_LINES = [
  '콘젯 Nalta 점검·수리',
  '독일 출장 정산·보고서',
  '사내 Wi‑Fi mesh 설정',
  'PC 본체·모니터 세팅',
  '기아차 펌프 소모품 교체',
  '작업테이블 견적·발주',
  'KTR 커플링 납기 확인',
  '에어팬쿨러 배송 확인',
  '필터백 견적 송부',
  '현장 스키드 얼라인먼트',
]

function item(
  id: string,
  text: string,
  status?: ItemStatus,
  extra: Partial<WorkItem> = {},
): WorkItem {
  return {
    id,
    text,
    status,
    hours: extra.hours ?? 1,
    attachments: extra.attachments ?? [],
    ...extra,
  }
}

function makeEmployees(): Employee[] {
  return [
    {
      id: 'e1',
      name: '박도형',
      role: '시니어 기술·구매',
      dept: '기술부',
      initials: '박',
      pin: '1111',
    },
    {
      id: 'e2',
      name: '김민수',
      role: '현장지원',
      dept: '기술부',
      initials: '김',
      pin: '2222',
    },
    {
      id: 'e3',
      name: '이서연',
      role: '사무 IT',
      dept: '관리부',
      initials: '이',
      pin: '3333',
      ooo: { start: '2026-09-17', end: '2026-09-18', reason: '개인 휴가' },
    },
    {
      id: 'e4',
      name: '최유진',
      role: '구매담당',
      dept: '구매부',
      initials: '최',
      pin: '4444',
    },
    {
      id: 'e5',
      name: '정하늘',
      role: '기술지원',
      dept: '기술부',
      initials: '정',
      pin: '5555',
    },
    {
      id: 'e6',
      name: '한지호',
      role: '품질관리',
      dept: '품질부',
      initials: '한',
      pin: '6666',
    },
    {
      id: 'e7',
      name: '오세린',
      role: '영업지원',
      dept: '영업부',
      initials: '오',
      pin: '7777',
      ooo: { start: '2026-09-16', end: '2026-09-17', reason: '출장' },
    },
    {
      id: 'e8',
      name: '윤태준',
      role: '설비보전',
      dept: '기술부',
      initials: '윤',
      pin: '8888',
    },
    {
      id: 'e9',
      name: '강미래',
      role: '기획',
      dept: '경영지원',
      initials: '강',
      pin: '9999',
    },
    {
      id: 'e10',
      name: '배수아',
      role: '물류',
      dept: '관리부',
      initials: '배',
      pin: '1010',
    },
  ]
}

/** 당일(TODAY) 상태 프로파일 — 검증 시나리오용 */
type TodayProfile =
  | 'full_blocker' // 박도형: 2스텝+블로커+연속이월+미반영지시
  | 'reviewing_blocker' // 김민수
  | 'ooo' // 이서연·오세린
  | 'morning_only' // 최유진
  | 'missing' // 정하늘 미제출
  | 'done_clean' // 한지호
  | 'submitted_carry' // 윤태준
  | 'reviewing_unreflected' // 강미래
  | 'submitted_ok' // 배수아

const TODAY_PROFILE: Record<string, TodayProfile> = {
  e1: 'full_blocker',
  e2: 'reviewing_blocker',
  e3: 'ooo',
  e4: 'morning_only',
  e5: 'missing',
  e6: 'done_clean',
  e7: 'ooo',
  e8: 'submitted_carry',
  e9: 'reviewing_unreflected',
  e10: 'submitted_ok',
}

function histReport(
  employeeId: string,
  date: string,
  dayIndex: number,
  empIndex: number,
): DailyReport {
  const topic = TOPIC_LINES[(empIndex + dayIndex) % TOPIC_LINES.length]
  const topic2 = TOPIC_LINES[(empIndex + dayIndex + 3) % TOPIC_LINES.length]
  const isPark = employeeId === 'e1'
  const carryDays = isPark ? 2 + dayIndex : empIndex % 3 === 0 ? 1 + (dayIndex % 3) : 0

  return {
    id: `hist-${date}-${employeeId}`,
    employeeId,
    date,
    status: 'done',
    memo: '',
    planSubmittedAt: `${date} 09:10`,
    execSubmittedAt: `${date} 17:05`,
    submittedAt: `${date} 17:05`,
    plan: [],
    execution: [
      item(`hx-${date}-${employeeId}-1`, topic, 'done', { hours: 2 }),
      item(`hx-${date}-${employeeId}-2`, topic2, dayIndex === 2 && empIndex < 3 ? 'blocker' : 'done', {
        hours: 1.5,
        ...(dayIndex === 2 && empIndex < 3
          ? {
              blockerReason: '협력사 회신 지연',
              supportRequest: '독촉 메일 검토',
            }
          : {}),
        attachments:
          empIndex === 0
            ? [
                {
                  id: `ha-${date}-${employeeId}`,
                  kind: 'url' as const,
                  label: '관련 링크',
                  url: 'https://example.com/hist',
                },
              ]
            : [],
      }),
    ],
    carryover:
      carryDays > 0
        ? [
            item(
              `hc-${date}-${employeeId}`,
              isPark ? '독일(Hammelmann) 출장 정산·보고서' : `${topic} 잔여 작업`,
              isPark || carryDays >= 3 ? 'blocker' : 'in_progress',
              {
                consecutiveDays: carryDays,
                ...(isPark
                  ? {
                      blockerReason: '전사원 핸드폰 녹음본 미확보',
                      supportRequest: '녹음본 취합 담당 지정',
                    }
                  : {}),
              },
            ),
          ]
        : [],
    instructions: [],
  }
}

function todayReport(emp: Employee, empIndex: number): DailyReport {
  const profile = TODAY_PROFILE[emp.id]
  const basePlan = [
    item(`p-${emp.id}-1`, TOPIC_LINES[empIndex % TOPIC_LINES.length], undefined, {
      hours: 2,
      checked: false,
      attachments:
        emp.id === 'e1'
          ? [
              {
                id: 'a-plan-1',
                kind: 'image',
                label: '현장사진.jpg',
                url: 'https://example.com/site.jpg',
              },
            ]
          : [],
    }),
    item(`p-${emp.id}-2`, TOPIC_LINES[(empIndex + 2) % TOPIC_LINES.length], undefined, {
      hours: 1,
      checked: false,
    }),
  ]

  const empty: DailyReport = {
    id: `r-today-${emp.id}`,
    employeeId: emp.id,
    date: TODAY,
    status: 'draft',
    memo: '',
    plan: basePlan,
    execution: [],
    carryover: [],
    instructions: [],
  }

  switch (profile) {
    case 'ooo':
      return {
        ...empty,
        status: 'draft',
        memo: '부재 — 제출 면제',
        plan: basePlan,
      }
    case 'morning_only':
      return {
        ...empty,
        status: 'draft',
        planSubmittedAt: `${TODAY} 09:25`,
        memo: '오전 계획만 제출, 저녁 마감 전',
        plan: basePlan,
      }
    case 'missing':
      return {
        ...empty,
        status: 'draft',
        memo: '',
        plan: basePlan,
      }
    case 'done_clean':
      return {
        ...empty,
        status: 'done',
        planSubmittedAt: `${TODAY} 09:00`,
        execSubmittedAt: `${TODAY} 16:50`,
        submittedAt: `${TODAY} 16:50`,
        managerAck: 'confirmed',
        plan: [basePlan[1]],
        execution: [
          item(`x-${emp.id}-1`, `${TOPIC_LINES[empIndex]} 완료`, 'done', {
            hours: 3,
            fromPlanId: basePlan[0].id,
          }),
        ],
        carryover: [],
        instructions: [
          {
            id: `i-${emp.id}-1`,
            date: TODAY,
            text: '품질 이슈 주간 공유할 것',
            reflect: 'reflected',
          },
        ],
      }
    case 'submitted_ok':
      return {
        ...empty,
        status: 'submitted',
        planSubmittedAt: `${TODAY} 09:15`,
        execSubmittedAt: `${TODAY} 17:00`,
        submittedAt: `${TODAY} 17:00`,
        plan: [],
        execution: [
          item(`x-${emp.id}-1`, '입출고 현황 정리', 'done', { hours: 2 }),
          item(`x-${emp.id}-2`, '컨테이너 견적 전화', 'in_progress', { hours: 1 }),
        ],
        carryover: [],
        instructions: [],
      }
    case 'submitted_carry':
      return {
        ...empty,
        status: 'submitted',
        planSubmittedAt: `${TODAY} 09:05`,
        execSubmittedAt: `${TODAY} 17:20`,
        submittedAt: `${TODAY} 17:20`,
        plan: [basePlan[1]],
        execution: [
          item(`x-${emp.id}-1`, '설비 일상점검', 'done', { hours: 2 }),
        ],
        carryover: [
          item(`c-${emp.id}-1`, '예비품 재고 실사', 'in_progress', {
            consecutiveDays: 3,
          }),
        ],
        instructions: [],
      }
    case 'reviewing_blocker':
      return {
        ...empty,
        status: 'reviewing',
        planSubmittedAt: `${TODAY} 09:05`,
        execSubmittedAt: `${TODAY} 16:40`,
        submittedAt: `${TODAY} 16:40`,
        plan: [],
        execution: [
          item(`x-${emp.id}-1`, '기아차 펌프 소모품 교체 완료', 'done', {
            hours: 3,
            attachments: [
              {
                id: 'a-kia',
                kind: 'image',
                label: 'kia-pump.jpg',
                url: 'https://example.com/kia.jpg',
              },
            ],
          }),
          item(`x-${emp.id}-2`, 'KTR 커플링 납기 확인', 'blocker', {
            hours: 0.5,
            blockerReason: '공급사 회신 지연 (발주 9/7)',
            supportRequest: '사장 명의 독촉 메일 검토',
          }),
        ],
        carryover: [
          item(`c-${emp.id}-1`, '바이패스 호스 추가 발주 여부', 'in_progress', {
            consecutiveDays: 2,
          }),
        ],
        instructions: [
          {
            id: `i-${emp.id}-1`,
            date: TODAY,
            text: '기아차 현장 사진 공유 후 완료 보고할 것',
            reflect: 'reflected',
          },
        ],
      }
    case 'reviewing_unreflected':
      return {
        ...empty,
        status: 'reviewing',
        planSubmittedAt: `${TODAY} 09:30`,
        execSubmittedAt: `${TODAY} 17:05`,
        submittedAt: `${TODAY} 17:05`,
        plan: [],
        execution: [
          item(`x-${emp.id}-1`, '주간 기획 회의록 정리', 'done', { hours: 2 }),
          item(`x-${emp.id}-2`, 'KPI 대시보드 초안', 'in_progress', { hours: 2 }),
        ],
        carryover: [],
        instructions: [
          {
            id: `i-${emp.id}-1`,
            date: TODAY,
            text: '월간 목표 대비 진척을 내일 브리핑에 포함할 것',
            reflect: 'unreflected',
          },
          {
            id: `i-${emp.id}-2`,
            date: '2026-09-16',
            text: '경쟁사 동향 1페이지 요약',
            reflect: 'unreflected',
          },
        ],
      }
    case 'full_blocker':
    default:
      return {
        ...empty,
        status: 'submitted',
        memo: '출장 정산은 녹음본 확보 후 재개 예정.',
        draftSavedAt: `${TODAY} 14:35`,
        planSubmittedAt: `${TODAY} 09:20`,
        execSubmittedAt: `${TODAY} 17:10`,
        submittedAt: `${TODAY} 17:10`,
        plan: [
          item('p1', '콘젯 크래들 랜스 유압실린더 점검', undefined, {
            hours: 2,
            checked: false,
          }),
          item('p2', '사내 Wi‑Fi mesh 벽 고정 마무리', undefined, {
            hours: 1,
            checked: false,
            attachments: [
              {
                id: 'a1',
                kind: 'image',
                label: 'mesh-설치.jpg',
                url: 'https://example.com/mesh.jpg',
              },
            ],
          }),
          item('p3', '이동식 작업테이블 결재 진행', undefined, {
            hours: 0.5,
            checked: false,
            attachments: [
              {
                id: 'a2',
                kind: 'url',
                label: '견적서 링크',
                url: 'https://example.com/quote-table',
              },
            ],
          }),
        ],
        execution: [
          item('x1', '콘젯 크래들 랜스 동 부싱베어링 이상 없음 확인', 'done', {
            hours: 1.5,
            attachments: [
              {
                id: 'a3',
                kind: 'image',
                label: 'bearing-check.jpg',
                url: 'https://example.com/bearing.jpg',
              },
            ],
          }),
          item('x2', '콘젯 유압실린더 분리·점검 (장시간 테스트 잔여)', 'in_progress', {
            hours: 2,
          }),
          item('x3', '사내 Wi‑Fi mesh 벽 고정', 'blocker', {
            hours: 0.5,
            blockerReason: '벽면 브라켓·앵커 재고 부족, 구매 대기',
            supportRequest: '관리부 자재 긴급 발주 또는 임시 고정 방안 지시 요청',
          }),
          item('x4', '현대차 울산 펌프 스키드 커플링 얼라인먼트 1/2 완료', 'done', {
            hours: 2,
            isAdHoc: true,
            attachments: [
              {
                id: 'a4',
                kind: 'url',
                label: '현장 메모',
                url: 'https://example.com/ulsan-align',
              },
            ],
          }),
        ],
        carryover: [
          item('c1', '독일(Hammelmann) 출장 정산·보고서', 'blocker', {
            consecutiveDays: 5,
            blockerReason: '전사원 핸드폰 녹음본 미확보 (정산 ~60%, 보고서 ~10%)',
            supportRequest: '녹음본 취합 일정·담당 지정 요청',
            attachments: [
              {
                id: 'a5',
                kind: 'url',
                label: '정산 초안 폴더',
                url: 'https://example.com/trip-settle',
              },
            ],
          }),
          item('c2', '콘젯·다솜이앤지 작업 보고서 및 전화', 'in_progress', {
            consecutiveDays: 1,
          }),
        ],
        instructions: [
          {
            id: 'i1',
            date: '2026-09-16',
            text: 'Flow Force 에어팬쿨러 배송 상태(유나텍 도착일) 파악할 것',
            reflect: 'reflected',
          },
          {
            id: 'i2',
            date: TODAY,
            text: 'Plaud 미팅 요약 참고하여 후속 액션 정리할 것',
            reflect: 'unreflected',
          },
          {
            id: 'i3',
            date: '2026-09-08',
            text: 'Nalta 원인 파악·사용법 교육 진행할 것',
            reflect: 'reflected',
          },
        ],
      }
  }
}

export function createSeed(): AppState {
  const employees = makeEmployees()
  const histDays = BUSINESS_DAYS.filter((d) => d !== TODAY)
  const reports: DailyReport[] = []

  employees.forEach((emp, ei) => {
    histDays.forEach((date, di) => {
      // OOO employees: skip days inside ooo for hist optional — still create light done for aggregation except pure ooo days
      if (emp.ooo && date >= emp.ooo.start && date <= emp.ooo.end) {
        return
      }
      reports.push(histReport(emp.id, date, di, ei))
    })
    reports.push(todayReport(emp, ei))
  })

  return {
    currentDate: TODAY,
    weekRange: { start: '2026-09-14', end: '2026-09-17' },
    monthRange: { start: '2026-09-01', end: '2026-09-17' },
    settings: { ...DEFAULT_SETTINGS },
    employees,
    reports,
    topics: [],
    weeklyTodos: [],
  }
}

/** 검증용 요약 메타 (문서·테스트에서 참조) */
export const SEED_META = {
  employeeCount: 10,
  businessDays: [...BUSINESS_DAYS],
  today: TODAY,
  pins: {
    manager: MANAGER_PIN,
    employees: Object.fromEntries(makeEmployees().map((e) => [e.name, e.pin])),
  },
  todayProfiles: TODAY_PROFILE,
}
