import type { AppState } from './types'
import { DEFAULT_SETTINGS } from './types'

const TODAY = '2026-09-17'

export const STORAGE_KEY = 'daily-report-mvp-v3'
export const SETTINGS_KEY = 'daily-report-mvp-settings-v1'
export const SESSION_KEY = 'daily-report-mvp-session-v1'

/** UX stub only — not real security */
export const MANAGER_PIN = '0000'

export function createSeed(): AppState {
  return {
    currentDate: TODAY,
    weekRange: { start: '2026-09-14', end: '2026-09-17' },
    monthRange: { start: '2026-09-01', end: '2026-09-17' },
    settings: { ...DEFAULT_SETTINGS },
    employees: [
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
        // 시드: 당일 부재 예시가 필요하면 주석 해제 — 기본은 정상 출근
        ooo: null,
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
    ],
    reports: [
      {
        id: 'r1',
        employeeId: 'e1',
        date: TODAY,
        status: 'submitted',
        memo: '출장 정산은 전사원 핸드폰 녹음본 확보 후 재개 예정.',
        draftSavedAt: '2026-09-17 14:35',
        planSubmittedAt: '2026-09-17 09:20',
        execSubmittedAt: '2026-09-17 17:10',
        submittedAt: '2026-09-17 17:10',
        plan: [
          {
            id: 'p1',
            text: '콘젯 크래들 랜스 유압실린더 점검',
            hours: 2,
            attachments: [],
            checked: false,
          },
          {
            id: 'p2',
            text: '사내 Wi‑Fi mesh 벽 고정 마무리',
            hours: 1,
            attachments: [
              {
                id: 'a1',
                kind: 'image',
                label: 'mesh-설치.jpg',
                url: 'https://example.com/mesh.jpg',
              },
            ],
            checked: false,
          },
          {
            id: 'p3',
            text: '이동식 작업테이블 결재 진행',
            hours: 0.5,
            attachments: [
              {
                id: 'a2',
                kind: 'url',
                label: '견적서 링크',
                url: 'https://example.com/quote-table',
              },
            ],
            checked: false,
          },
        ],
        execution: [
          {
            id: 'x1',
            text: '콘젯 크래들 랜스 동 부싱베어링 이상 없음 확인',
            status: 'done',
            hours: 1.5,
            attachments: [
              {
                id: 'a3',
                kind: 'image',
                label: 'bearing-check.jpg',
                url: 'https://example.com/bearing.jpg',
              },
            ],
            fromPlanId: 'p1',
          },
          {
            id: 'x2',
            text: '콘젯 유압실린더 분리·점검 (장시간 테스트 잔여)',
            status: 'in_progress',
            hours: 2,
            attachments: [],
          },
          {
            id: 'x3',
            text: '사내 Wi‑Fi mesh 벽 고정',
            status: 'blocker',
            hours: 0.5,
            blockerReason: '벽면 브라켓·앵커 재고 부족, 구매 대기',
            supportRequest: '관리부 자재 긴급 발주 또는 임시 고정 방안 지시 요청',
            attachments: [],
            fromPlanId: 'p2',
          },
          {
            id: 'x4',
            text: '현대차 울산 펌프 스키드 커플링 얼라인먼트 1/2 완료',
            status: 'done',
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
          },
        ],
        carryover: [
          {
            id: 'c1',
            text: '독일(Hammelmann) 출장 정산·보고서',
            status: 'blocker',
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
          },
          {
            id: 'c2',
            text: '콘젯·다솜이앤지 작업 보고서 및 전화',
            status: 'in_progress',
            consecutiveDays: 1,
            attachments: [],
          },
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
            date: '2026-09-17',
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
      },
      {
        id: 'r2',
        employeeId: 'e2',
        date: TODAY,
        status: 'reviewing',
        memo: '',
        planSubmittedAt: '2026-09-17 09:05',
        execSubmittedAt: '2026-09-17 16:40',
        submittedAt: '2026-09-17 16:40',
        plan: [
          {
            id: 'p21',
            text: '기아차 펌프 소모품 교체',
            hours: 3,
            attachments: [],
            checked: false,
          },
          {
            id: 'p22',
            text: 'KTR 커플링 납기 확인 (현대차 조지아)',
            hours: 0.5,
            attachments: [],
            checked: false,
          },
        ],
        execution: [
          {
            id: 'x21',
            text: '기아차 펌프 소모품 교체 완료·시운전 OK',
            status: 'done',
            hours: 3,
            fromPlanId: 'p21',
            attachments: [
              {
                id: 'a21',
                kind: 'image',
                label: 'kia-pump.jpg',
                url: 'https://example.com/kia.jpg',
              },
            ],
          },
          {
            id: 'x22',
            text: 'KTR 커플링 납기 확인',
            status: 'blocker',
            hours: 0.5,
            blockerReason: '공급사 회신 지연 (발주 9/7)',
            supportRequest: '사장 명의 독촉 메일 검토 요청',
            attachments: [],
            fromPlanId: 'p22',
          },
        ],
        carryover: [
          {
            id: 'c21',
            text: '바이패스 호스 롤 추가 발주 여부 확인',
            status: 'in_progress',
            consecutiveDays: 2,
            attachments: [],
          },
        ],
        instructions: [
          {
            id: 'i21',
            date: '2026-09-17',
            text: '기아차 현장 사진 공유 후 완료 보고할 것',
            reflect: 'reflected',
          },
        ],
      },
      {
        id: 'r3',
        employeeId: 'e3',
        date: TODAY,
        status: 'draft',
        memo: '',
        planSubmittedAt: '2026-09-17 09:40',
        plan: [
          {
            id: 'p31',
            text: 'PC 본체 세팅 잔여 1대 완료',
            hours: 2,
            attachments: [],
            checked: false,
          },
          {
            id: 'p32',
            text: '기술부·회의실 PC 배치·설치',
            hours: 2,
            attachments: [],
            checked: false,
          },
          {
            id: 'p33',
            text: '10ft 컨테이너 견적 전화 통화',
            hours: 0.5,
            attachments: [
              {
                id: 'a31',
                kind: 'url',
                label: '깡통박사 견적',
                url: 'https://example.com/container',
              },
            ],
            checked: false,
          },
        ],
        execution: [],
        carryover: [
          {
            id: 'c31',
            text: 'PC 본체 세팅 2/3 → 잔여 1대',
            status: 'in_progress',
            consecutiveDays: 3,
            attachments: [],
          },
        ],
        instructions: [],
      },
      // Prior-day stubs — keyword-rich for weekly auto-cluster (2+)
      ...(['2026-09-14', '2026-09-15', '2026-09-16'] as const).flatMap((date, di) =>
        (['e1', 'e2', 'e3'] as const).map((employeeId, ei) => {
          const execByDay: Record<string, string[]> = {
            '2026-09-14': [
              '독일 출장 정산 초안 작성',
              '콘젯 Nalta 메일 초안',
              '사내 Wi‑Fi mesh 점검',
            ],
            '2026-09-15': [
              '콘젯 증상 메일·동영상 발송',
              '기술부 PC 발주 완료',
              '출장 정산 60% 진행',
            ],
            '2026-09-16': [
              '바이패스 호스 수령·에어팬쿨러 배송 확인',
              'PC 본체·모니터 세팅',
              '작업테이블 견적 네고',
            ],
          }
          const texts = execByDay[date]
          const text = texts[ei] ?? texts[0]
          return {
            id: `hist-${di}-${ei}`,
            employeeId,
            date,
            status: 'done' as const,
            memo: '',
            planSubmittedAt: `${date} 09:00`,
            execSubmittedAt: `${date} 17:00`,
            submittedAt: `${date} 17:00`,
            plan: [],
            execution: [
              {
                id: `hx-${di}-${ei}`,
                text,
                status: 'done' as const,
                hours: 2,
                attachments: [],
              },
            ],
            carryover:
              employeeId === 'e1'
                ? [
                    {
                      id: `hc-${di}`,
                      text: '독일(Hammelmann) 출장 정산·보고서',
                      status: 'blocker' as const,
                      consecutiveDays: 2 + di,
                      attachments: [],
                    },
                  ]
                : employeeId === 'e3' && di >= 1
                  ? [
                      {
                        id: `hc3-${di}`,
                        text: 'PC 본체 세팅 잔여',
                        status: 'in_progress' as const,
                        consecutiveDays: 1 + di,
                        attachments: [],
                      },
                    ]
                  : [],
            instructions: [],
          }
        }),
      ),
    ],
    topics: [
      {
        id: 't1',
        date: '2026-09-14',
        weekday: '월',
        title: '출장 정산',
        status: 'in_progress',
        people: ['e1', 'e3'],
        extraCount: 0,
      },
      {
        id: 't2',
        date: '2026-09-15',
        weekday: '화',
        title: '콘젯 / Nalta',
        status: 'in_progress',
        people: ['e1', 'e2'],
        extraCount: 1,
      },
      {
        id: 't3',
        date: '2026-09-16',
        weekday: '수',
        title: 'PC 세팅 · 에어팬쿨러',
        status: 'blocker',
        people: ['e1', 'e3'],
        extraCount: 0,
      },
      {
        id: 't4',
        date: '2026-09-17',
        weekday: '목',
        title: '콘젯 유압 · Wi‑Fi',
        status: 'in_progress',
        people: ['e1', 'e2', 'e3'],
        extraCount: 0,
      },
    ],
    weeklyTodos: [
      {
        id: 'wt1',
        priority: '높음',
        text: '독일 출장 정산·보고서 (녹음본 대기)',
        assigneeId: 'e1',
        topic: '출장 정산',
        startDate: '2026-09-07',
        dueDate: '2026-09-19',
        consecutiveDays: 5,
        status: 'blocker',
      },
      {
        id: 'wt2',
        priority: '높음',
        text: '콘젯·다솜이앤지 작업 보고서 및 전화',
        assigneeId: 'e1',
        topic: '콘젯',
        startDate: '2026-09-14',
        dueDate: '2026-09-18',
        consecutiveDays: 1,
        status: 'in_progress',
      },
      {
        id: 'wt3',
        priority: '중간',
        text: 'Wi‑Fi mesh 벽 고정 (브라켓 재고)',
        assigneeId: 'e1',
        topic: '사무 IT',
        startDate: '2026-09-14',
        dueDate: '2026-09-17',
        consecutiveDays: 3,
        status: 'blocker',
      },
      {
        id: 'wt4',
        priority: '중간',
        text: 'PC 본체 세팅 잔여 1대·배치',
        assigneeId: 'e3',
        topic: 'PC 세팅',
        startDate: '2026-09-15',
        dueDate: '2026-09-18',
        consecutiveDays: 3,
        status: 'delayed',
      },
      {
        id: 'wt5',
        priority: '중간',
        text: '현대차 울산 커플링 얼라인먼트 1대 잔여',
        assigneeId: 'e1',
        topic: '현장',
        startDate: '2026-09-17',
        dueDate: '2026-09-18',
        consecutiveDays: 1,
        status: 'in_progress',
      },
      {
        id: 'wt6',
        priority: '낮음',
        text: 'KTR 커플링 납기 확인',
        assigneeId: 'e2',
        topic: '구매',
        startDate: '2026-09-07',
        dueDate: '2026-09-20',
        consecutiveDays: 4,
        status: 'blocker',
      },
    ],
  }
}
