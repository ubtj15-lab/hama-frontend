# 매장주 매장 연결 방법

매장주가 대시보드에서 자신의 매장을 보려면, `stores.owner_id`를 해당 매장주(user)의 `id`로 설정해야 합니다.

## SQL (Supabase SQL Editor에서 실행)

```sql
-- 예: user id가 'abc-123-uuid'이고, store id가 'store-456-uuid'일 때
UPDATE stores SET owner_id = 'user-uuid-here' WHERE id = 'store-id-here';
```

## user id 확인

1. Supabase Table Editor → `users` 테이블
2. 카카오 로그인 후 새로 생성된 행의 `id` (UUID) 확인

## store id 확인

1. Supabase Table Editor → `stores` 테이블
2. 매장의 `id` 확인
