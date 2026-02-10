# 하마 통합플랫폼 분석·설계·1단계 계획

---

## 1. 현재 코드베이스 요약

### 1.1 라우팅/페이지 구조 (app/ 기준)

| 경로 | 역할 |
|------|------|
| `/` | 홈 (추천 카드 스와이프, 탭별 추천/근처) |
| `/search` | 검색 결과 (텍스트 검색, 시나리오별 필터) |
| `/map` | 지도/길안내 |
| `/recommend` | 추천 페이지 |
| `/mypage/points` | 포인트 내역 |
| `/reserve` | 예약 |
| `/pay` | 결제 |
| `/calendar` | 캘린더 |
| `/settings` | 설정 |
| `/feedback` | 피드백 |
| `/beta-info` | 베타 정보 |
| `/auth/kakao/success` | 카카오 로그인 성공 |
| `/hama` | 하마 메인 |

- **Next.js App Router** 사용
- 홈·검색·지도가 핵심 페이지

---

### 1.2 주요 컴포넌트 구조

| 컴포넌트 | 위치 | 역할 |
|----------|------|------|
| **HomeSwipeDeck** | `app/_components/` | 홈 추천 카드 스와이프 덱 |
| **CardDetailOverlay** | `app/_components/` | 카드 상세 모달 (네이버/카카오 링크, 길안내) |
| **홈 인라인 오버레이** | `app/page.tsx` | selectedCard 시 카드 상세 모달 (이미지+버튼) |
| **SearchCards** | `app/search/_components/` | 검색 결과 카드 |
| **SearchOverlay** | `app/search/_components/` | 검색 결과 상세 모달 |
| **HomeTopBar** | `app/_components/` | 홈 탭바 |
| **HomeSearchBar** | `app/_components/` | 홈 검색바 |
| **SideMenu** | `app/components/` | 사이드 메뉴 (로그인/포인트/추천) |
| **FloatingMic** | `app/components/` | 음성 검색 플로팅 버튼 |
| **UIOverlayProvider** | `app/_providers/` | overlayOpen 상태 컨텍스트 |

- 홈 상세: `page.tsx` 내부 인라인 모달 (CardDetailOverlay 미사용)
- 검색 상세: `SearchOverlay` (독립 모달)

---

### 1.3 데이터 흐름

| 구분 | 기술 | 파일/위치 |
|------|------|-----------|
| DB | Supabase | `app/lib/supabaseClient.ts` |
| 매장 조회 | Supabase `stores` | `app/lib/storeRepository.ts` |
| 홈 추천 | `fetchHomeRecommend` / `fetchNearbyRecommend` | `storeRepository.ts` |
| 검색 | `useSearchStores` → Supabase 전체 조회 | `app/search/_hooks/useSearchStores.ts` |
| 필터/정렬 | `useCardPaging` 클라이언트 필터 | `app/search/_hooks/useCardPaging.ts` |
| API Route | `app/api/stores/`, `app/api/log/` 등 | Next.js Route Handlers |

- 서버 액션: 미사용
- DB: Supabase `stores` 테이블 (~855개 매장)

---

### 1.4 인증 (카카오 로그인) 연결 위치

| 파일 | 역할 |
|------|------|
| `app/api/auth/kakao/login/route.ts` | 카카오 OAuth 리다이렉트 |
| `app/api/auth/kakao/callback/route.ts` | code → token → 홈 리다이렉트 |
| `app/api/auth/kakao/logout/route.ts` | 로그아웃 처리 |
| `app/page.tsx` | `handleKakaoButtonClick` → 로그인/로그아웃 토글 |
| `app/_hooks/useLocalUser.ts` | `loginLocal` / `logoutLocal`, localStorage |

- **현재 인증**:  
  - 카카오 OAuth는 붙어 있으나 callback에서 **서버 세션/DB 저장 없음**  
  - `localStorage`의 `hamaLoggedIn`, `hamaUser`로만 로그인 상태 관리  
  - `user_id`는 없고 `nickname`, `points`만 로컬 저장

---

### 1.5 이벤트 로그/분석

| 구분 | 내용 |
|------|------|
| `logEvent` | `app/lib/logEvent.ts` — `window.__HAMA_LOGS__` 배열에 메모리 push |
| `/api/log` | `app/api/log/route.ts` — POST 시 `console.log`만 수행 |
| 전송 | 클라이언트에서 `/api/log`로 batch 전송하는 코드 **없음** |

- 이벤트 예: `session_start`, `page_view`, `search`, `home_card_open`, `place_open_naver`, `place_open_kakao` 등
- DB/외부 저장: 없음 (추후 Supabase/GA 확장 예정)

---

## 2. 통합플랫폼 설계안

### 2.1 라우트맵

| 경로 | 모듈 | 설명 |
|------|------|------|
| `/` | A | 홈 추천 카드 |
| `/search` | B | 검색 (텍스트/음성) |
| `/map` | C | 지도/길안내 |
| `/reserve` | C | 예약 |
| `/my` | Core | 마이페이지 (저장/최근본/설정 통합) |
| `/admin` | D | 관리자 (품질/등록/통계) |
| `/partner` | E | 파트너 대시보드 (B2B) |

※ 현재 `/mypage/points`는 `/my/points`로 통합 가능

---

### 2.2 공통 데이터 모델 (DB 테이블 제안)

```sql
-- 사용자 (카카오 연동 후 확장)
users (
  id UUID PRIMARY KEY,
  kakao_id TEXT UNIQUE,
  nickname TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

-- 저장 (북마크)
saved (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  store_id TEXT NOT NULL,
  created_at TIMESTAMPTZ,
  UNIQUE(user_id, store_id)
)

-- 최근 본
recent_views (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_id TEXT,           -- 비로그인 시 세션 구분
  store_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ,
  UNIQUE(user_id, store_id)  -- 또는 session_id+store_id
)

-- 이벤트 로그
events (
  id UUID PRIMARY KEY,
  user_id UUID,
  session_id TEXT,
  type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ
)

-- 예약/아웃바운드 (모듈 C)
reservations (
  id UUID PRIMARY KEY,
  user_id UUID,
  store_id TEXT,
  outbound_url TEXT,
  status TEXT,
  created_at TIMESTAMPTZ
)
```

---

### 2.3 이벤트 로그 스키마 (최소 필드)

```ts
// events 테이블 / API payload
{
  user_id: string | null,      // 로그인 시
  session_id: string,           // uuid v4, 항상 존재
  type: string,                 // "home_card_open", "saved_toggle", "recent_view" 등
  created_at: string,           // ISO
  data: {                       // JSON
    store_id?: string,
    page?: string,
    [key: string]: unknown
  }
}
```

---

### 2.4 모듈 경계 (폴더 구조 제안)

```
app/
├── (core)/
│   ├── _lib/          # auth, user, saved, recent_views, events
│   ├── _providers/     # UserProvider, SavedProvider
│   └── my/             # /my, /my/saved, /my/recent
├── page.tsx            # 모듈 A: 홈
├── search/             # 모듈 B: 검색
├── map/                # 모듈 C: 지도
├── reserve/            # 모듈 C: 예약
├── admin/              # 모듈 D
└── partner/            # 모듈 E
```

---

### 2.5 우선순위 (가장 적은 변경으로 통합플랫폼 느낌)

| 순위 | 작업 | 이유 |
|------|------|------|
| 1 | **저장/최근본 + 유저 연결** | 홈·검색 카드에 바로 붙일 수 있어 즉시 체감 |
| 2 | `events` 테이블 + `/api/log` Supabase 저장 | 기존 `logEvent` 호출만 유지, 백엔드만 확장 |
| 3 | `users` 테이블 + 카카오 callback에서 user upsert | 실제 `user_id` 확보 |
| 4 | `/my` 마이페이지 UI (저장/최근본 목록) | 데이터 활용 |
| 5 | 관리자/파트너 라우트 | 신규 페이지 |

---

## 3. 1단계 구현 계획 (저장/최근본 + 유저 연결)

### 3.1 요구사항 요약

1. **저장(Saved)**: 카드 상세 모달에서 저장/해제 토글  
2. **최근본(Recent)**: 카드 상세 모달 열면 `recent_views`에 기록 (중복은 최신만 유지 or 최근 N개만)  
3. **user_id**: 카카오 로그인 기반, 비로그인 시 `anonymous` / `session_id`로 기록  
4. **홈 "최근 본 카드" 섹션**: 데이터 제공

---

### 3.2 파일별 수정 목록

#### A. Supabase 테이블 생성 (마이그레이션/SQL)

| 파일 | 작업 |
|------|------|
| `supabase/migrations/xxx_create_saved_recent_views.sql` (신규) | `saved`, `recent_views` 테이블 생성 |

```sql
-- saved
CREATE TABLE saved (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,        -- 카카오 id 또는 session_id
  store_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, store_id)
);

-- recent_views
CREATE TABLE recent_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  store_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, store_id)
);

CREATE INDEX idx_recent_views_user_viewed ON recent_views(user_id, viewed_at DESC);
```

※ `user_id`를 `TEXT`로 두어 `kakao_123` 또는 `session_xxx` 형태로 유연하게 사용

---

#### B. API 라우트

| 파일 | 작업 |
|------|------|
| `app/api/saved/route.ts` (신규) | GET: 저장 목록, POST: 저장/해제 토글 |
| `app/api/recent/route.ts` (신규) | GET: 최근 본 목록, POST: 조회 기록 |
| `app/api/recent/record/route.ts` (신규) | POST: 단일 조회 기록 (모달 열 때 호출) |

---

#### C. 훅/유틸

| 파일 | 작업 |
|------|------|
| `app/_hooks/useSaved.ts` (신규) | `savedIds`, `toggleSaved(storeId)`, `isSaved(storeId)` |
| `app/_hooks/useRecent.ts` (신규) | `recentCards`, `recordView(storeId)` |
| `app/_lib/userIdentity.ts` (신규) | `getUserId()` — 로그인 시 `kakao_xxx`, 비로그인 시 `session_xxx` |
| `app/_lib/sessionId.ts` (신규) | `getOrCreateSessionId()` — localStorage에 session_id 유지 |

---

#### D. 컴포넌트 수정

| 파일 | 작업 |
|------|------|
| `app/page.tsx` | ① `onOpenCard` 시 `recordView(card.id)` 호출 ② 카드 상세 모달에 저장 버튼 + `useSaved` ③ "최근 본 카드" 섹션 추가 + `useRecent` |
| `app/search/_components/SearchOverlay.tsx` | 저장 버튼 추가, `recordView` 호출 |
| `app/search/SearchPageClient.tsx` | `openExpanded` 시 `recordView(selected.id)` 호출 |

---

#### E. 연결할 함수/컴포넌트

| 위치 | 함수/이벤트 | 붙일 동작 |
|------|-------------|-----------|
| `app/page.tsx` | `onOpenCard` 콜백 | `recordView(card.id)` |
| `app/page.tsx` | 카드 상세 모달 | 저장 버튼, `toggleSaved`, `isSaved` 표시 |
| `app/page.tsx` | 홈 레이아웃 | "최근 본 카드" 섹션, `useRecent().recentCards` 렌더 |
| `app/search/SearchPageClient.tsx` | `openExpanded` | `recordView(selected.id)` |
| `app/search/_components/SearchOverlay.tsx` | 모달 열림 시 | `recordView(selected.id)` (이미 열림 상태이므로), 저장 버튼 |

---

### 3.3 데이터 흐름

1. **저장 토글**:  
   - 모달에서 저장 버튼 클릭 → `toggleSaved(storeId)` → `POST /api/saved` → Supabase `saved` upsert/delete

2. **최근 본 기록**:  
   - 모달 열림 시 → `recordView(storeId)` → `POST /api/recent/record` → Supabase `recent_views` upsert (최신 시간만 갱신)

3. **최근 본 목록**:  
   - 홈 마운트 시 → `useRecent()` → `GET /api/recent` → `recentCards` 반환 → 섹션 렌더

---

### 3.4 비로그인 처리

- `getUserId()`:  
  - `localStorage.getItem(LOGIN_FLAG_KEY) === "1"` → `kakao_${kakaoId}` (현재 kakaoId 없으면 `guest_${sessionId}`)  
  - 비로그인 → `session_${sessionId}` (uuid v4, localStorage에 저장)

---

## 4. 구현 완료 (1단계)

**DB → events → recent → saved → /my** 순서로 적용 완료.

### 적용된 파일
- `supabase/migrations/20250208000000_create_saved_recent_views_events.sql`
- `app/_lib/sessionId.ts`, `app/_lib/userIdentity.ts`
- `app/api/log/route.ts` (Supabase events 저장)
- `app/lib/logEvent.ts` (서버 전송 연동)
- `app/api/recent/route.ts`, `app/api/recent/record/route.ts`
- `app/api/saved/route.ts`
- `app/_hooks/useRecent.ts`, `app/_hooks/useSaved.ts`
- `app/page.tsx` (저장 버튼, 최근 본 섹션, recordView, ?open= 연동)
- `app/search/SearchPageClient.tsx`, `app/search/_components/SearchOverlay.tsx`
- `app/my/page.tsx` (마이페이지)
- `app/_components/HomeTopBar.tsx` (저장·최근본 메뉴)

### 실행 전
1. Supabase SQL Editor에서 마이그레이션 실행
2. `.env.local`에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 확인  
