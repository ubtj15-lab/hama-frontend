# Supabase tags 복구 가이드 (Google Sheet → Supabase)

Google Sheet에 작성한 원본 tags를 Supabase에 다시 적용하는 방법입니다.

## 1. Google Sheet에서 CSV 내보내기

1. Google Sheet 열기
2. **파일 > 다운로드 > CSV(.csv)** 선택
3. 파일을 `scripts/tags-import.csv` 로 저장

## 2. CSV 형식

다음 중 하나의 형식이어야 합니다.

### 형식 A: id + tags (권장)

| id | tags |
|----|------|
| uuid-1 | 중국집 짬뽕 탕수육 볶음밥 중화요리 |
| uuid-2 | 한식 국밥 백반 점심식사 |

- `id`: Supabase stores 테이블의 `id` (UUID)
- `tags`: 공백 또는 쉼표로 구분된 태그

### 형식 B: name + tags

| name | tags |
|------|------|
| 홍콩반점 | 중국집 짬뽕 탕수육 볶음밥 |
| 골목식당 | 한식 국밥 백반 |

- `name`: 매장명 (Supabase stores.name과 정확히 일치해야 함)
- `tags`: 공백 또는 쉼표로 구분된 태그

## 3. 실행

```bash
# 먼저 테스트 (실제 반영 안 함)
node scripts/sync-tags-from-sheet.mjs --dry-run

# 실제 적용
node scripts/sync-tags-from-sheet.mjs
```

다른 파일 경로 지정:

```bash
node scripts/sync-tags-from-sheet.mjs -i=./내파일.csv
```

## 4. 환경 변수

`.env.local` 에 다음이 필요합니다:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

Service Role Key는 Supabase 대시보드 > Project Settings > API 에서 확인할 수 있습니다. (업데이트 권한이 더 넓음)
