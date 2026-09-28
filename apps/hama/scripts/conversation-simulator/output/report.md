# HAMA V1 대화 이해 시뮬레이터 1차

기존 대화 처리 함수를 호출해 측정했습니다. 추천 랭킹, 운영 DB, 외부 API, AI API는 호출하지 않았습니다.
정답은 측정 전에 사람이 작성했고, 점수를 맞추기 위해 바꾸지 않았습니다.

검토가 필요하다고 표시한 턴과 정답 경고가 있으므로, 그 턴이 섞인 전체 수치는 잠정적입니다. 확정 정답만 모은 수치를 함께 적습니다.

## 규모

- 시나리오 40개
- 총 턴 159개

## 측정

| 항목 | 결과 |
| --- | --- |
| 턴별 전체 정답률 | 127/159 (79.9%) |
| 모든 턴을 맞힌 대화 | 25/40 (62.5%) |
| 확정 정답 턴 정답률 | 103/116 (88.8%) |
| 검토 대상 턴 정답률 | 24/30 (80%) |
| 확정 정답만 있는 대화의 완전 일치 | 16/23 (69.6%) |
| 의도 분류 (지원 턴) | 144/146 (98.6%) |
| 의도 분류 (확정 정답) | 115/116 (99.1%) |
| 문맥 유지 | 92/104 (88.5%) |
| 문맥 유지 (확정 정답) | 73/83 (88%) |
| 조건 변경 | 45/45 (100%) |
| 조건 변경 (확정 정답) | 38/38 (100%) |
| 거절 처리 | 20/22 (90.9%) |
| 확인 질문 전체 | 142/158 (89.9%) |
| 확인이 필요할 때 | 3/17 (17.6%) |
| 확인이 필요 없을 때 | 139/141 (98.6%) |
| 검색어 결정 (지원 턴) | 146/146 (100%) |
| 미지원 요청 처리 | 0/13 (0%) |
| 미지원 요청에서 확인 질문 | 0/13 (0%) |
| 매장 추천 정확도 | 측정하지 않음 |

매장 추천 정확도는 대화 이해와 따로 둡니다. 이번 실행은 모의 장소 ID만 다음 턴에 넘겼고, 랭킹 엔진은 호출하지 않았습니다.

## 실패 원인

- category_state: 15
- refinement_state: 15
- clarification: 1
- scenario_state: 1

실패한 턴 32개의 전체 비교는 report.json에 있습니다.

## 대표 실패

### S02 턴 1. 동탄에서 아이랑 갈 만한 곳

- 원인: category_state
- 지원: supported, 정답 확신: firm, 수정 경로: rules
- 실패 항목: category_state, category_screen
- 예상:

```
{
  "support": "supported",
  "refinement": "new_request",
  "category": "ACTIVITY",
  "region": "동탄",
  "withKids": true,
  "scenario": "family_kids",
  "indoor": false,
  "distance": "any",
  "calm": "any",
  "parking": "any",
  "notSpicy": "any",
  "weather": "any",
  "foodSub": "any",
  "linkedFood": false,
  "playListKept": false,
  "clarification": false,
  "excludePlaceIds": [],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "동탄에서 아이랑 갈 만한 곳",
  "retain": [],
  "add": [],
  "remove": []
}
```
- 실제:

```
pipeline=new_request
classifier=new_request
screenRefinement=new_request
category=없음/없음
region=동탄/동탄
scenario=family_kids/family_kids
kids=true/true
indoor=false/false
distance=없음/없음
calm=false
parking=false
notSpicy=false
weather=없음
foodSub=없음/없음
linkedFood=false
frozen=없음
clarification=false
exclude=없음
screenExclude=없음
rejectedCategories=없음
menus=없음
mode=single
search=동탄에서 아이랑 갈 만한 곳
```

### S08 턴 1. 동탄 키즈카페

- 원인: scenario_state
- 지원: supported, 정답 확신: review, 수정 경로: rules
- 실패 항목: scenario_state, scenario_screen
- 정답 메모: 키즈카페는 놀이 장소일 수도 있고 카페일 수도 있다
- 예상:

```
{
  "support": "supported",
  "refinement": "new_request",
  "category": [
    "ACTIVITY",
    "CAFE"
  ],
  "region": "동탄",
  "withKids": true,
  "scenario": "family_kids",
  "indoor": "any",
  "distance": "any",
  "calm": "any",
  "parking": "any",
  "notSpicy": "any",
  "weather": "any",
  "foodSub": "any",
  "linkedFood": false,
  "playListKept": false,
  "clarification": false,
  "excludePlaceIds": [],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "동탄 키즈카페",
  "retain": [],
  "add": [],
  "remove": []
}
```
- 실제:

```
pipeline=new_request
classifier=new_request
screenRefinement=new_request
category=ACTIVITY/ACTIVITY
region=동탄/동탄
scenario=generic/generic
kids=true/true
indoor=false/false
distance=없음/없음
calm=false
parking=false
notSpicy=false
weather=없음
foodSub=없음/없음
linkedFood=false
frozen=없음
clarification=false
exclude=없음
screenExclude=없음
rejectedCategories=없음
menus=없음
mode=single
search=동탄 키즈카페
```

### S14 턴 2. 오늘 저녁 7시에 예약해 줘

- 원인: refinement_state
- 지원: unsupported, 정답 확신: firm, 수정 경로: model
- 실패 항목: refinement_state, refinement_classifier, refinement_screen, clarification
- 정답 메모: 예약 실행은 지원하지 않으므로 확인하거나 못 한다고 밝혀야 한다
- 예상:

```
{
  "support": "unsupported",
  "refinement": "clarify",
  "category": "FOOD",
  "region": "동탄",
  "withKids": "any",
  "scenario": "any",
  "indoor": "any",
  "distance": "any",
  "calm": "any",
  "parking": "any",
  "notSpicy": "any",
  "weather": "any",
  "foodSub": "any",
  "linkedFood": false,
  "playListKept": false,
  "clarification": true,
  "excludePlaceIds": [],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "오늘 저녁 7시에 예약해 줘",
  "retain": [
    "region",
    "category"
  ],
  "add": [],
  "remove": []
}
```
- 실제:

```
pipeline=refine
classifier=refine
screenRefinement=refine
category=FOOD/FOOD
region=동탄/동탄
scenario=generic/generic
kids=false/false
indoor=false/false
distance=없음/없음
calm=false
parking=false
notSpicy=false
weather=없음
foodSub=없음/없음
linkedFood=false
frozen=없음
clarification=false
exclude=없음
screenExclude=없음
rejectedCategories=없음
menus=없음
mode=single
search=오늘 저녁 7시에 예약해 줘
```

### S35 턴 1. 심심한데 어디 가지

- 원인: clarification
- 지원: supported, 정답 확신: review, 수정 경로: rules
- 실패 항목: clarification
- 정답 메모: 지역과 장소 종류가 없어 확인 질문이 필요하다
- 예상:

```
{
  "support": "supported",
  "refinement": "new_request",
  "category": "any",
  "region": null,
  "withKids": "any",
  "scenario": "any",
  "indoor": "any",
  "distance": "any",
  "calm": "any",
  "parking": "any",
  "notSpicy": "any",
  "weather": "any",
  "foodSub": "any",
  "linkedFood": false,
  "playListKept": false,
  "clarification": true,
  "excludePlaceIds": [],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "심심한데 어디 가지",
  "retain": [],
  "add": [],
  "remove": []
}
```
- 실제:

```
pipeline=new_request
classifier=new_request
screenRefinement=new_request
category=없음/없음
region=없음/없음
scenario=generic/generic
kids=false/false
indoor=false/false
distance=없음/없음
calm=false
parking=false
notSpicy=false
weather=없음
foodSub=없음/없음
linkedFood=false
frozen=없음
clarification=false
exclude=없음
screenExclude=없음
rejectedCategories=없음
menus=없음
mode=single
search=심심한데 어디 가지
```

## 현재 규칙으로 우선 볼 문제

1. category_state 15건
2. refinement_state 2건
3. clarification 1건
4. scenario_state 1건

지역 유지, 거절 문구, 식사 추가, 확인 질문처럼 이미 규칙의 대상인 실패를 먼저 수정하는 편이 맞습니다.

## AI 모델 도입을 검토할 문제

1. refinement_state 13건

예약, 실시간 영업·대기, 가격, 알레르기, 반려동물, 콘센트, 특정 매장 이름 지목은 현재 조건 필드에 없습니다.

## 정답 경고

발화와 정답 지역이 어긋난 항목은 없습니다.

## 정답 기준 검토

아래는 점수를 바꾸지 않은 채, 실패 일부를 정답 기준으로 다시 본 메모입니다. 해당 턴은 실패로 남아 있습니다.

- S02, S06, S30의 '갈 곳'처럼 업종을 말하지 않은 첫 문장은 ACTIVITY만 정답으로 두었습니다. 카테고리를 비우는 해석도 가능하므로 이 실패는 잠정적입니다.
- S08 '키즈카페'는 아이 동반이 기록되면 scenario가 generic이어도 가족 나들이로 볼 수 있습니다. family_kids만 정답으로 둔 항목은 잠정적입니다.
- S09 턴 3·4, S29 턴 3·4, S33 턴 4·5의 제외 목록 실패는 앞 턴이 거절을 기록하지 못한 뒤 따라온 결과입니다. 독립된 새 결함으로 세지 않습니다.
- 미지원 요청의 정답은 '확인 질문을 한다'입니다. 지역과 업종을 유지한 채 일반 수정으로 처리한 결과는 확인 질문 실패로 집계했습니다.

## 다시 실행

```
npx tsx scripts/conversation-simulator/run.ts
```
