# 카카오 장소 URL 복구 계획

이 문서는 계획만 담는다. 운영 데이터베이스는 수정하지 않았고, 아래 쿼리도 실행하지 않았다.

앱은 이미 카카오 칸에 들어 있는 네이버 주소를 열지 않는다. 유효한 카카오 주소가 없으면 매장명과 주소로 카카오맵 검색을 연다. 네이버 버튼은 `naver_place_url`, 그다음 `naver_place_id`, 둘 다 없으면 매장명과 주소 검색 순서로 연다. 데이터베이스 정리는 화면이 잘못된 주소를 직접 열지 않게 한 뒤의 후속 작업이다.

확인된 현황은 전체 894곳, `kakao_place_url`의 네이버 주소 830곳, 정상 카카오 단축 주소 24곳, 카카오 주소 없음 40곳이다. `naver_place_id`는 비어 있고 네이버 주소는 `naver_place_url`에 있다. 이 건수는 복구 당시에 다시 세어야 하며, 숫자가 다르면 업데이트를 멈춘다.

## 순서

1. 수정 대상 830개의 ID를 미리 확인한다.
2. 운영 데이터베이스를 백업한다.
3. 네이버 URL과 정확히 같은 잘못된 카카오 URL만 NULL로 바꾼다.
4. 정상 카카오 링크 24개를 그대로 둔다.
5. 수정 후 대상 건수와 링크 동작을 확인한다.
6. 문제가 있으면 백업으로 되돌린다.

`naver_place_url`은 변경하지 않는다. 카카오 장소 ID를 추측해서 만들지 않는다.

## 1. 대상 ID 확인

기대 결과는 830행이다. 행 수가 다르면 중단한다.

```sql
SELECT id, kakao_place_url, naver_place_url
FROM stores
WHERE kakao_place_url IS NOT NULL
  AND naver_place_url IS NOT NULL
  AND btrim(kakao_place_url) = btrim(naver_place_url)
  AND kakao_place_url ~* '^https?://([^/?#]+\.)?(naver\.me|place\.naver\.com|map\.naver\.com|search\.naver\.com)([/?#]|$)';
```

유지해야 하는 카카오 주소다. 기대 결과는 24행이다.

```sql
SELECT id, kakao_place_url
FROM stores
WHERE kakao_place_url ~* '^https?://([^/?#]+\.)?(kko\.to|map\.kakao\.com)([/?#]|$)';
```

두 조회에 같은 ID가 있으면 중단한다. 카카오 공식 주소를 NULL로 바꾸지 않는다.

## 2. 백업

운영 데이터베이스 전체 백업을 먼저 만든다. 이어서 대상 행만 별도 테이블에 남긴다. 날짜는 실행일에 맞춘다.

```sql
CREATE TABLE stores_kakao_place_url_backup_YYYYMMDD AS
SELECT id, kakao_place_url, naver_place_url, now() AS backed_up_at
FROM stores
WHERE kakao_place_url IS NOT NULL
  AND naver_place_url IS NOT NULL
  AND btrim(kakao_place_url) = btrim(naver_place_url)
  AND kakao_place_url ~* '^https?://([^/?#]+\.)?(naver\.me|place\.naver\.com|map\.naver\.com|search\.naver\.com)([/?#]|$)';
```

백업 테이블 행 수가 1단계 대상 수와 같아야 다음으로 진행한다.

## 3. 잘못된 카카오 URL만 비우기

조건은 백업과 같다. `naver_place_url` 컬럼은 SET에 넣지 않는다.

```sql
UPDATE stores
SET kakao_place_url = NULL
WHERE kakao_place_url IS NOT NULL
  AND naver_place_url IS NOT NULL
  AND btrim(kakao_place_url) = btrim(naver_place_url)
  AND kakao_place_url ~* '^https?://([^/?#]+\.)?(naver\.me|place\.naver\.com|map\.naver\.com|search\.naver\.com)([/?#]|$)';
```

카카오 주소와 네이버 주소가 글자 단위로 같지 않으면 건드리지 않는다. 값이 비어 있는 40곳은 대상이 아니다.

## 4. 정상 링크 보존

3단계를 실행한 뒤 1단계의 카카오 유지 조회를 다시 실행한다. 24행이 그대로이고, 그 주소가 실행 전과 같아야 한다.

## 5. 수정 후 확인

- 1단계 조회가 0행이다.
- `kakao_place_url`이 네이버 도메인인 행이 0이다.
- `naver_place_url`이 바뀌지 않았다. 백업 테이블과 값을 비교한다.
- 정상 카카오 단축 주소 24곳은 카카오맵으로 열린다.
- 비운 행의 카카오 버튼은 매장명과 주소로 카카오맵 검색을 연다. 검색 결과를 확인된 매장으로 표시하지 않는다.
- 네이버 버튼은 기존 `naver_place_url`을 연다.

## 6. 복구

문제 발생 시 전체 백업으로 되돌리는 것이 우선이다. 대상 컬럼만 되돌릴 때는 아래를 사용한다.

```sql
UPDATE stores AS s
SET kakao_place_url = b.kakao_place_url
FROM stores_kakao_place_url_backup_YYYYMMDD AS b
WHERE s.id = b.id;
```

복구 후에는 1단계 대상 수가 백업 행 수와 같은지, `naver_place_url`이 그대로인지 확인한다.
