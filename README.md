# 일일업무보고

직원 일일업무보고 · 매니저 보드 · 주간/월간 요약 웹앱.

## Auth

### Cursor 호스팅 (기본)

- `AUTH_MODE` 미설정 또는 `cursor`
- Cursor private/team 앱 로그인(SSO)
- 첫 로그인 사용자가 관리자

### NAS / 시놀로지 (로컬)

Cursor 신원은 NAS에서 동작하지 않습니다. Docker 배포는 `AUTH_MODE=local` 을 사용합니다.

- 이메일 + 비밀번호 (서버에 scrypt 해시 저장)
- `BOOTSTRAP_MANAGER_EMAIL` / `BOOTSTRAP_MANAGER_PASSWORD` 로 첫 관리자 자동 생성
- 직원은 초대 코드(`INVITE_CODE` 또는 관리자 발급 1회용 코드)로 계정 생성 → 가입 신청 → 관리자 승인
- 관리자는 「구성원」 화면에서 이메일·비밀번호로 직원을 바로 등록하거나, 구성원 삭제(계정·역할·보고 정리) 후 같은 이메일로 재등록할 수 있습니다

자세한 설치: 프로젝트 문서 `docs/synology-nas-setup.md` (Agent Store)

## Develop

```bash
npm install
npm run dev
```

## Docker (시놀로지 Container Manager)

```bash
cp .env.example .env   # 비밀번호·이메일 수정
docker compose up -d --build
```

브라우저: `http://NAS주소:3080`  
첫 관리자: `.env` 의 `BOOTSTRAP_MANAGER_EMAIL` / `BOOTSTRAP_MANAGER_PASSWORD`

## Optional: OpenAI brief

관리자 주간/월간 브리프는 기본적으로 규칙 기반(휴리스틱)입니다.  
서버에 `OPENAI_API_KEY` 가 있으면 Chat Completions로 다듬고, 실패 시 휴리스틱으로 돌아갑니다.

| 변수 | 필수 | 설명 |
|------|------|------|
| `OPENAI_API_KEY` | 아니오 | 서버 전용. 클라이언트/`NEXT_PUBLIC_` 로 넣지 마세요 |
| `OPENAI_MODEL` | 아니오 | 기본 `gpt-4o-mini` |

- Cursor 호스팅: Dashboard Secrets에 `OPENAI_API_KEY` 값 설정 후 앱에 바인딩
- NAS: `.env`에 넣고 `docker compose` 가 `environment`로 전달

## Build

```bash
npm run build
# DATABASE_URL 이 있으면
npm run migrate
```
