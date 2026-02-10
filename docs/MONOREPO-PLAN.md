# 모노레포 분리 계획 (A단계: 이동 대상 목록)

## 목표

- **apps/hama**: 일반 유저 앱 (/, /search, /map, /reserve, /my) + 관리자(/admin)
- **apps/partner**: 매장주 대시보드 (/)
- **packages/shared**: Supabase client, DB 타입, sessionId, userIdentity, 공통 유틸
- Supabase DB/키 변경 없음. 각 앱 독립 `npm run dev` 및 Vercel 2프로젝트 배포 가능.

---

## 1. API 라우트 분류

### 1.1 partner 앱에 둘 API (partner 전용)

| 현재 경로 | 비고 |
|-----------|------|
| `app/api/partner/stores/route.ts` | 매장 검색(본인) |
| `app/api/partner/stores/[storeId]/route.ts` | 대표 이미지 PATCH |
| `app/api/partner/stores/[storeId]/photos/route.ts` | 사진 목록/추가 |
| `app/api/partner/stores/[storeId]/photos/[photoId]/route.ts` | 사진 삭제 |
| `app/api/partner/stores/[storeId]/menus/route.ts` | 메뉴 목록/추가 |
| `app/api/partner/stores/[storeId]/menus/[menuId]/route.ts` | 메뉴 수정/삭제 |
| `app/api/partner/stats/route.ts` | 매장 통계 |

**partner 앱에서 추가 필요:** 카카오 로그인(쿠키 세팅)을 위해 **auth** 복사  
- `app/api/auth/kakao/login/route.ts`  
- `app/api/auth/kakao/callback/route.ts`  
- `app/api/auth/kakao/logout/route.ts`  
→ partner는 `return_to=/`(partner 루트)로 사용.

### 1.2 hama 앱에 둘 API (일반 유저 + 관리자)

| 현재 경로 | 비고 |
|-----------|------|
| `app/api/auth/kakao/login/route.ts` | |
| `app/api/auth/kakao/callback/route.ts` | |
| `app/api/auth/kakao/logout/route.ts` | |
| `app/api/log/route.ts` | 이벤트 로그 |
| `app/api/recent/route.ts` | 최근 본 목록 |
| `app/api/recent/record/route.ts` | 최근 본 기록 |
| `app/api/saved/route.ts` | 저장 토글/목록 |
| `app/api/home-recommend/route.ts` | 홈 추천 |
| `app/api/stores/route.ts` | |
| `app/api/stores/home/route.ts` | |
| `app/api/search/route.ts` | |
| `app/api/directions/route.ts` | |
| `app/api/places/nearby/route.ts` | |
| `app/api/places/search/route.ts` | |
| `app/api/route/osrm/route.ts` | |
| `app/api/nav/route.ts` | |
| `app/api/local/search/route.ts` | |
| `app/api/local/nearby/route.ts` | |
| `app/api/local/reverse/route.ts` | |
| `app/api/kakao/search/route.ts` | |
| `app/api/mock_reservations/route.ts` | (필요 시) |
| `app/api/admin/stats/route.ts` | 관리자 통계 |
| `app/api/admin/stores/route.ts` | |
| `app/api/admin/stores/[storeId]/route.ts` | |
| `app/api/admin/users/route.ts` | |
| `app/api/_store/reservationStore.ts` | (reserve 관련 시 사용) |

---

## 2. 페이지(라우트) 분류

### 2.1 apps/hama 에 둘 페이지 (이동 후 유지할 경로)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `app/page.tsx` | `apps/hama/app/page.tsx` |
| `app/layout.tsx` | `apps/hama/app/layout.tsx` |
| `app/search/*` | `apps/hama/app/search/*` |
| `app/map/*` | `apps/hama/app/map/*` |
| `app/reserve/*` | `apps/hama/app/reserve/*` |
| `app/my/page.tsx` | `apps/hama/app/my/page.tsx` |
| `app/admin/*` | `apps/hama/app/admin/*` |
| `app/auth/kakao/success/*` | `apps/hama/app/auth/kakao/success/*` |
| `app/mypage/points/page.tsx` | `apps/hama/app/mypage/points/page.tsx` |
| `app/beta-info/page.tsx` | `apps/hama/app/beta-info/page.tsx` |
| `app/feedback/page.tsx` | `apps/hama/app/feedback/page.tsx` |
| `app/hama/page.tsx` | `apps/hama/app/hama/page.tsx` |
| `app/pay/*` | `apps/hama/app/pay/*` |
| `app/settings/page.tsx` | `apps/hama/app/settings/page.tsx` |
| `app/recommend/*` | `apps/hama/app/recommend/*` |
| `app/calendar/page.tsx` | `apps/hama/app/calendar/page.tsx` |
| `app/ui/*` | `apps/hama/app/ui/*` |

**hama에서 제거할 경로 (partner로 감):**  
- `app/partner/page.tsx` → 삭제 (partner 앱으로 이동)

### 2.2 apps/partner 에 둘 페이지

| 현재 경로 | 이동 후 |
|-----------|---------|
| `app/partner/page.tsx` | `apps/partner/app/page.tsx` (루트가 매장주 대시보드) |

- partner 앱은 **단일 진입점** `/` = 매장주 대시보드.
- `apps/partner/app/layout.tsx` 신규 생성(최소 레이아웃).

---

## 3. 컴포넌트 / 훅 / lib 분류

### 3.1 packages/shared 로 옮길 공통 코드 (최소 리팩터)

| 현재 경로 | 이동 후 |
|-----------|---------|
| `app/lib/supabaseClient.ts` | `packages/shared/src/supabaseClient.ts` |
| `app/_lib/sessionId.ts` | `packages/shared/src/sessionId.ts` |
| `app/_lib/userIdentity.ts` | `packages/shared/src/userIdentity.ts` |
| `app/lib/storeTypes.ts` | `packages/shared/src/storeTypes.ts` (또는 hama 전용이면 hama에만 유지) |

- **선택:** `storeTypes`는 hama에서 많이 쓰이므로 먼저 hama에 두고, partner에서 필요 시 shared로 올릴 수 있음.  
  **1차 분리 시:** shared에는 `supabaseClient`, `sessionId`, `userIdentity` 만 옮기고, 나머지는 각 앱에 유지해 diff 최소화.

### 3.2 apps/hama 에만 둘 컴포넌트/훅/lib (그대로 이동)

- `app/_components/*` → `apps/hama/app/_components/*`
- `app/_hooks/*` → `apps/hama/app/_hooks/*`
- `app/_providers/*` → `apps/hama/app/_providers/*`
- `app/components/*` → `apps/hama/app/components/*`
- `app/lib/*` (supabaseClient, sessionId, userIdentity 제외) → `apps/hama/app/lib/*`
- `app/data/*` → `apps/hama/app/data/*`
- `app/api/*` (partner, admin 제외는 위 1.2 기준) → `apps/hama/app/api/*`  
  단, **partner 폴더 전체**는 복사하지 않음.

### 3.3 apps/partner 에 둘 코드

- **페이지:** `app/partner/page.tsx` → `apps/partner/app/page.tsx` (내용 그대로, import만 상대경로 또는 `@shared` 등으로 정리)
- **API:** `app/api/partner/*` 전체 → `apps/partner/app/api/partner/*` (경로 유지: partner 앱에서 `/api/partner/...` 그대로 노출)
- **Auth:** `app/api/auth/kakao/*` 3개 파일 → `apps/partner/app/api/auth/kakao/*` (return_to 기본값만 partner에 맞게 조정 가능)
- partner는 **별도 컴포넌트/훅**이 없음(페이지 하나에서 모두 처리). shared에서 `supabaseClient`, `userIdentity`, `sessionId` 사용하도록 import만 추가.

---

## 4. 기타 자산

| 항목 | 처리 |
|------|------|
| `public/*` | `apps/hama/public/*` 로 이동. partner는 필요 시 최소 이미지만 복사 또는 공유 안 함. |
| `supabase/migrations/*` | **루트 또는 shared에 유지.** 두 앱 동일 DB 사용. 예: `supabase/` 루트 유지. |
| `app/globals.css` | `apps/hama/app/globals.css` 복사. partner는 필요한 스타일만 최소 복사 또는 공통 스타일 없이. |
| `app/favicon.ico` | 각 앱에 복사. |
| `.env.local` | 사용 안 함(각 앱별 `.env.local`은 `apps/hama/.env.local`, `apps/partner/.env.local`로 분리). |
| `next.config.js` | 각 앱별로 두기. (기존 파일명이 `next.config.js.bak`이면 실제 설정 확인 후 적용.) |
| `tsconfig.json` | 각 앱별 + 루트 워크스페이스. |
| `tailwind.config.js`, `postcss.config.js` | 각 앱에 복사. |

---

## 5. 폴더 구조 (목표)

```
hama-frontend/
├── apps/
│   ├── hama/
│   │   ├── app/
│   │   │   ├── api/          # partner 제외, admin 포함
│   │   │   ├── _components/
│   │   │   ├── _hooks/
│   │   │   ├── _lib/         # shared 제거 후 남은 것
│   │   │   ├── _providers/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   ├── map/
│   │   │   ├── my/
│   │   │   ├── reserve/
│   │   │   ├── search/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── ...
│   │   ├── public/
│   │   ├── .env.local
│   │   ├── package.json
│   │   ├── next.config.js
│   │   └── tsconfig.json
│   │
│   └── partner/
│       ├── app/
│       │   ├── api/
│       │   │   ├── auth/kakao/login, callback, logout
│       │   │   └── partner/   # stats, stores, stores/[storeId]/...
│       │   ├── layout.tsx
│       │   └── page.tsx       # 기존 partner/page.tsx
│       ├── .env.local
│       ├── package.json
│       ├── next.config.js
│       └── tsconfig.json
│
├── packages/
│   └── shared/
│       ├── src/
│       │   ├── supabaseClient.ts
│       │   ├── sessionId.ts
│       │   └── userIdentity.ts
│       ├── package.json
│       └── tsconfig.json
│
├── supabase/
│   └── migrations/
├── package.json               # workspaces
├── docs/
│   └── MONOREPO-PLAN.md
└── README.md
```

---

## 6. 작업 순서 요약 (B~F)

- **B.** 모노레포 베이스: 루트 `package.json` (workspaces), 루트 `tsconfig.json`, 브랜치 `chore/monorepo-split` 생성.
- **C.** `apps/hama` 생성: 기존 `app`(partner 제외)·`public`·필요 API·lib·컴포넌트 복사 → hama 빌드 성공.
- **D.** `apps/partner` 생성: `partner/page.tsx` → `app/page.tsx`, `api/partner/*` + `api/auth/kakao/*` 복사 → partner 빌드 성공.
- **E.** `packages/shared` 생성: `supabaseClient`, `sessionId`, `userIdentity` 이동 후 두 앱에서 `@repo/shared`(또는 `shared`) import로 정리.
- **F.** 검증: 각 앱 `pnpm dev`(또는 npm), 홈/카드 확인, partner 로그인·대시보드, API 호출 확인.

---

## 7. 이동 대상 파일 목록 (체크용)

### 7.1 → apps/hama (복사/이동)

- `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `app/favicon.ico`
- `app/_components/*`, `app/_hooks/*`, `app/_providers/*`
- `app/components/*` (전체)
- `app/lib/*` (전체, 단 shared로 옮기는 3개는 E단계에서 제거)
- `app/_lib/searchUtils.ts` (shared 안 가면 hama에 유지)
- `app/search/*`, `app/map/*`, `app/reserve/*`, `app/my/*`, `app/admin/*`
- `app/auth/kakao/success/*`, `app/mypage/*`, `app/beta-info/*`, `app/feedback/*`, `app/hama/*`, `app/pay/*`, `app/settings/*`, `app/recommend/*`, `app/calendar/*`, `app/ui/*`
- `app/data/*`
- `app/api/*` **단, `app/api/partner/*` 제외**
- `public/*`
- `next.config.js`(또는 .bak에서 복원), `tailwind.config.js`, `postcss.config.js`, `tsconfig.json`, `eslint.config.mjs`

### 7.2 → apps/partner (복사)

- `app/partner/page.tsx` → `apps/partner/app/page.tsx`
- `app/api/partner/*` 전체 → `apps/partner/app/api/partner/*`
- `app/api/auth/kakao/login/route.ts`, `callback/route.ts`, `logout/route.ts` → `apps/partner/app/api/auth/kakao/*`
- `apps/partner/app/layout.tsx` (신규, 최소)
- `apps/partner/app/globals.css` (최소 또는 공통 스타일만)

### 7.3 → packages/shared

- `app/lib/supabaseClient.ts` → `packages/shared/src/supabaseClient.ts`
- `app/_lib/sessionId.ts` → `packages/shared/src/sessionId.ts`
- `app/_lib/userIdentity.ts` → `packages/shared/src/userIdentity.ts`

### 7.4 루트 유지

- `supabase/migrations/*`
- `docs/*`
- `.gitignore`

---

## 8. 남은 할 일 (F 이후 기록용)

- [ ] hama: `pnpm dev` → 홈 진입, 카드 노출 확인
- [ ] partner: `pnpm dev` → 로그인, 대시보드, 사진/메뉴/대표이미지 API 확인
- [ ] Vercel 프로젝트 2개 연결 (hama, partner) 및 env 분리
- [ ] README.md 루트에 hama/partner 실행 방법 추가

---

## 9. 검증 체크리스트 (F단계)

| 항목 | hama | partner |
|------|------|---------|
| `pnpm run build` | [ ] | [ ] |
| `pnpm dev` 실행 | [ ] | [ ] |
| 홈(/) 진입·카드 노출 | [ ] | - |
| /search 동작 | [ ] | - |
| /map, /reserve, /my | [ ] | - |
| /admin 통계·매장연결 | [ ] | - |
| 매장주 로그인 | - | [ ] |
| 매장주 대시보드 통계/사진/메뉴 | - | [ ] |
| API 호출 4xx/5xx 없음 | [ ] | [ ] |

---

*문서 갱신: A단계 작성. B~F 진행 시 단계별로 이 문서 업데이트.*
