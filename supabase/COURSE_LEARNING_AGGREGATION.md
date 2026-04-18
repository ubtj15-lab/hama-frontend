# 코스 학습 Supabase 집계·크론 제안

## 1. 이벤트 이름 표준 (DB CHECK와 동일)

### `course_events.event_name`

| 값 | 의미 |
|----|------|
| `course_impression` | 코스 카드 노출 |
| `course_card_click` | 코스 카드 클릭 |
| `course_detail_view` | 코스 상세 조회 |
| `course_start_click` | 이 코스로 출발 |
| `course_save` | 코스 저장 |
| `course_restore_success` | 저장 코스 복원 성공 |
| `course_restore_fail` | 저장 코스 복원 실패 |
| `course_immediate_exit` | 노출 직후 이탈 |

### `place_events.event_name`

| 값 | 의미 |
|----|------|
| `place_detail_click` | 코스 내 장소 상세 |
| `place_route_click` | 첫 장소 길찾기 등 경로 클릭 |
| `place_call_click` | 전화 클릭 |
| `place_save_click` | 장소 저장 |

앱 TS (`courseLearningTypes`)와 이름이 다르면 **API 적재 시 매핑**한다. 예: `course_place_detail_click` → `place_detail_click`, `first_place_route_click` → `place_route_click`.

---

## 2. learned_boost 설계 원칙

- **rule 기반 점수를 덮지 않는다.** DB의 `learned_boost`는 앱의 `ruleBasedCourseScore`에 **가산**되는 보정값으로만 사용한다.
- 권장 상한: 앱과 동일하게 **총 가산 ~12** (패턴별·장소별 분배는 앱 로직과 맞출 것).
- `impressions < 20` 인 `course_pattern_stats` 행은 배치에서 **`learned_boost = 0`** (또는 `impressions / 20 * boost` 선형 완화).

---

## 3. 집계 방식 (batch)

### 3.1 Raw → `course_pattern_stats`

1. 기간 윈도우(예: 전일 또는 최근 7일)의 `course_events`를 읽는다.
2. `pattern_key` 생성 규칙은 앱 `buildPatternKey`와 동일하게 유지한다.  
   예: `scenario|child_age|weather|time_of_day|date_time_band|template_id|step_pattern`
3. 집계:
   - `impressions`: `event_name = 'course_impression'` 카운트
   - `clicks`: `course_card_click` 등 (정의에 따라 합산)
   - `detail_views`: `course_detail_view`
   - `starts`: `course_start_click`
   - `saves`: `course_save`
   - `route_clicks`: `place_events`에서 `place_route_click`을 코스 단위로 롤업하거나, 코스 이벤트로 별도 기록 시 합산
   - `exits`: `course_immediate_exit` + (선택) `no_action` 추론
4. 비율:
   - `ctr = clicks / NULLIF(impressions, 0)`
   - `start_rate = starts / NULLIF(impressions, 0)`
   - `save_rate = saves / NULLIF(impressions, 0)`
5. `learned_boost`:
   - `impressions >= 20`: 품질 점수(CTR, start_rate, 부정 비율 등)를 0~1로 정규화 후 스케일.
   - `impressions < 20`: **0** (또는 약하게).

구현: **Supabase Edge Function (일 배치)** 또는 **외부 워커 (Node cron)** 가 `course_pattern_stats`에 `UPSERT`.

### 3.2 Raw → `place_stats`

1. `place_events`를 `place_id` 기준 `GROUP BY`.
2. `impressions`는 동일 장소가 코스에 노출될 때마다 기록하려면, 노출 시 `place_events` 또는 별도 노출 이벤트가 필요하다. 현재 스키마는 **클릭 중심**이므로, 노출이 없으면 `impressions`는 `course_events.place_ids` 전개 배치로 추정하거나, 앱에서 `place_impression` 이벤트를 추가한다.
3. `route_rate`, `save_rate` 등은 정의에 맞게 분자·분모 설정.

---

## 4. 크론 (pg_cron)

Supabase에서 `pg_cron` + `pg_net` 또는 **Edge Function + Scheduler** 권장.

예시 (개념):

- 매일 03:00 KST: `refresh_course_pattern_stats()` 호출
- 매시간: 최근 1시간 raw만 증분 집계 (선택)

DB 내 함수만으로 복잡한 롤업은 유지보수가 어려우므로, **Edge Function에서 SQL 실행** 또는 **외부 배치**가 현실적이다.

---

## 5. RLS

- `course_events` / `place_events`: anon INSERT (기존 `events`와 동일 가정). 운영에서는 IP/레이트 리밋 권장.
- `course_pattern_stats` / `place_stats`: **읽기만 anon**, 쓰기는 **service_role** 또는 Edge (서비스 키)만.

---

## 6. 파일

| 파일 | 설명 |
|------|------|
| `migrations/20260328130000_course_learning_events_and_stats.sql` | 테이블·인덱스·RLS |
| `sql/course_learning_refresh_stats.sql` | 참고용 집계 쿼리 스케치 (수동 실행) |
