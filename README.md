# 일일업무보고

직원 일일업무보고 · 매니저 보드 · 주간/월간 요약 웹앱.

## Auth

- Cursor private/team 앱 로그인(SSO)으로 사용자를 확인합니다.
- 첫 번째 로그인 사용자가 관리자가 됩니다.
- 이후 사용자는 가입 신청 → 관리자 승인 후 직원 역할이 부여됩니다.
- PIN 기반 데모 로그인은 제거되었습니다. 역할은 서버(`user_roles`)에서만 결정됩니다.

## Develop

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```
