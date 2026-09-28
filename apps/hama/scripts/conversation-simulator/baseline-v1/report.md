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
| 턴별 전체 정답률 | 95/159 (59.7%) |
| 모든 턴을 맞힌 대화 | 13/40 (32.5%) |
| 확정 정답 턴 정답률 | 82/116 (70.7%) |
| 검토 대상 턴 정답률 | 13/30 (43.3%) |
| 확정 정답만 있는 대화의 완전 일치 | 9/23 (39.1%) |
| 의도 분류 (지원 턴) | 124/146 (84.9%) |
| 의도 분류 (확정 정답) | 101/116 (87.1%) |
| 문맥 유지 | 77/104 (74%) |
| 문맥 유지 (확정 정답) | 64/83 (77.1%) |
| 조건 변경 | 40/45 (88.9%) |
| 조건 변경 (확정 정답) | 34/38 (89.5%) |
| 거절 처리 | 16/22 (72.7%) |
| 확인 질문 전체 | 144/158 (91.1%) |
| 확인이 필요할 때 | 3/17 (17.6%) |
| 확인이 필요 없을 때 | 141/141 (100%) |
| 검색어 결정 (지원 턴) | 146/146 (100%) |
| 미지원 요청 처리 | 0/13 (0%) |
| 미지원 요청에서 확인 질문 | 0/13 (0%) |
| 매장 추천 정확도 | 측정하지 않음 |

매장 추천 정확도는 대화 이해와 따로 둡니다. 이번 실행은 모의 장소 ID만 다음 턴에 넘겼고, 랭킹 엔진은 호출하지 않았습니다.

## 실패 원인

- refinement_state: 29
- category_state: 15
- refinement_screen: 6
- scenario_state: 5
- exclude_ids: 4
- calm: 2
- food_sub_screen: 1
- food_sub_state: 1
- weather: 1

실패한 턴 64개의 전체 비교는 report.json에 있습니다.

## 대표 실패

### S01 턴 4. 밥 먹을 곳도 찾아 줘

- 원인: refinement_state
- 지원: supported, 정답 확신: firm, 수정 경로: rules
- 실패 항목: refinement_state, refinement_classifier, refinement_screen, category_state, category_screen, calm
- 정답 메모: 식사는 추가 목적이고 카페 추천을 대체하지 않음
- 예상:

```
{
  "support": "supported",
  "refinement": "refine",
  "category": "CAFE",
  "region": "오산",
  "withKids": "any",
  "scenario": "any",
  "indoor": "any",
  "distance": "any",
  "calm": true,
  "parking": "any",
  "notSpicy": "any",
  "weather": "any",
  "foodSub": "any",
  "linkedFood": true,
  "playListKept": true,
  "clarification": false,
  "excludePlaceIds": [],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "밥 먹을 곳도 찾아 줘",
  "retain": [
    "region",
    "category",
    "calm"
  ],
  "add": [
    "linkedFood"
  ],
  "remove": []
}
```
- 실제:

```
pipeline=new_request
classifier=new_request
screenRefinement=new_request
category=FOOD/FOOD
region=오산/오산
scenario=generic/generic
kids=false/false
indoor=false/false
distance=없음/없음
calm=false
parking=false
notSpicy=false
weather=없음
foodSub=없음/없음
linkedFood=true
frozen=cafe-next-1,cafe-next-2,cafe-next-3
clarification=false
exclude=없음
screenExclude=없음
rejectedCategories=없음
menus=없음
mode=single
search=밥 먹을 곳도 찾아 줘
```

### S02 턴 1. 동탄에서 아이랑 갈 만한 곳

- 원인: refinement_screen
- 지원: supported, 정답 확신: firm, 수정 경로: rules
- 실패 항목: refinement_screen, state_screen_refinement_divergence, category_state, category_screen
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
screenRefinement=refine
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

### S02 턴 2. 비 오면 실내만

- 원인: category_state
- 지원: supported, 정답 확신: firm, 수정 경로: rules
- 실패 항목: category_state, category_screen
- 예상:

```
{
  "support": "supported",
  "refinement": "narrow",
  "category": "ACTIVITY",
  "region": "동탄",
  "withKids": true,
  "scenario": "family_kids",
  "indoor": true,
  "distance": "any",
  "calm": "any",
  "parking": "any",
  "notSpicy": "any",
  "weather": "rain",
  "foodSub": "any",
  "linkedFood": false,
  "playListKept": false,
  "clarification": false,
  "excludePlaceIds": [],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "비 오면 실내만",
  "retain": [
    "region",
    "category",
    "withKids",
    "scenario"
  ],
  "add": [
    "indoor",
    "rain"
  ],
  "remove": []
}
```
- 실제:

```
pipeline=narrow
classifier=narrow
screenRefinement=narrow
category=없음/없음
region=동탄/동탄
scenario=family_kids/family_kids
kids=true/true
indoor=true/true
distance=없음/없음
calm=false
parking=false
notSpicy=false
weather=rain
foodSub=없음/없음
linkedFood=false
frozen=없음
clarification=false
exclude=없음
screenExclude=없음
rejectedCategories=없음
menus=없음
mode=single
search=비 오면 실내만
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

### S09 턴 3. 그래도 창가 쪽이면 좋겠어

- 원인: exclude_ids
- 지원: supported, 정답 확신: review, 수정 경로: rules
- 실패 항목: exclude_ids, exclude_ids_screen
- 정답 메모: 창가는 별도 저장 필드가 없어도 카페 조건은 유지. 제외 목록은 남아야 한다
- 예상:

```
{
  "support": "supported",
  "refinement": "refine",
  "category": "CAFE",
  "region": "동탄",
  "withKids": "any",
  "scenario": "any",
  "indoor": "any",
  "distance": "any",
  "calm": true,
  "parking": "any",
  "notSpicy": "any",
  "weather": "any",
  "foodSub": "any",
  "linkedFood": false,
  "playListKept": false,
  "clarification": false,
  "excludePlaceIds": [
    "cafe-1",
    "cafe-2",
    "cafe-3"
  ],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "그래도 창가 쪽이면 좋겠어",
  "retain": [
    "region",
    "category",
    "calm"
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
category=CAFE/CAFE
region=동탄/동탄
scenario=generic/generic
kids=false/false
indoor=false/false
distance=없음/없음
calm=true
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
search=그래도 창가 쪽이면 좋겠어
```

### S17 턴 3. 조용한 데는 아니어도 돼

- 원인: calm
- 지원: supported, 정답 확신: firm, 수정 경로: rules
- 실패 항목: calm, remove_calm
- 예상:

```
{
  "support": "supported",
  "refinement": "broaden",
  "category": "FOOD",
  "region": "동탄",
  "withKids": "any",
  "scenario": "friends",
  "indoor": "any",
  "distance": "any",
  "calm": false,
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
  "searchQuery": "조용한 데는 아니어도 돼",
  "retain": [
    "region",
    "category",
    "scenario"
  ],
  "add": [],
  "remove": [
    "calm"
  ]
}
```
- 실제:

```
pipeline=broaden
classifier=broaden
screenRefinement=broaden
category=FOOD/FOOD
region=동탄/동탄
scenario=friends/friends
kids=false/false
indoor=false/false
distance=없음/없음
calm=true
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
search=조용한 데는 아니어도 돼
```

### S20 턴 2. 중식 말고

- 원인: food_sub_state
- 지원: supported, 정답 확신: firm, 수정 경로: rules
- 실패 항목: food_sub_state, food_sub_screen, remove_foodSub
- 정답 메모: 매장 거절이 아니라 중식 조건을 뺀다
- 예상:

```
{
  "support": "supported",
  "refinement": "refine",
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
  "foodSub": null,
  "linkedFood": false,
  "playListKept": false,
  "clarification": false,
  "excludePlaceIds": [],
  "rejectedCategories": [
    "CHINESE"
  ],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "중식 말고",
  "retain": [
    "region",
    "category"
  ],
  "add": [],
  "remove": [
    "foodSub"
  ]
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
foodSub=CHINESE/CHINESE
linkedFood=false
frozen=없음
clarification=false
exclude=없음
screenExclude=없음
rejectedCategories=CHINESE
menus=없음
mode=single
search=중식 말고
```

### S21 턴 3. 중식 아니어도 돼

- 원인: food_sub_screen
- 지원: supported, 정답 확신: firm, 수정 경로: rules
- 실패 항목: food_sub_screen, remove_foodSub
- 예상:

```
{
  "support": "supported",
  "refinement": "broaden",
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
  "foodSub": null,
  "linkedFood": false,
  "playListKept": false,
  "clarification": false,
  "excludePlaceIds": [],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "중식 아니어도 돼",
  "retain": [
    "region",
    "category"
  ],
  "add": [],
  "remove": [
    "foodSub"
  ]
}
```
- 실제:

```
pipeline=broaden
classifier=broaden
screenRefinement=broaden
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
foodSub=없음/CHINESE
linkedFood=false
frozen=없음
clarification=false
exclude=없음
screenExclude=없음
rejectedCategories=없음
menus=없음
mode=single
search=중식 아니어도 돼
```

### S31 턴 2. 비 와서 실내

- 원인: weather
- 지원: supported, 정답 확신: review, 수정 경로: rules
- 실패 항목: weather, add_rain
- 예상:

```
{
  "support": "supported",
  "refinement": "refine",
  "category": [
    "CAFE",
    "ACTIVITY",
    null
  ],
  "region": "동탄",
  "withKids": "any",
  "scenario": "date",
  "indoor": true,
  "distance": "any",
  "calm": "any",
  "parking": "any",
  "notSpicy": "any",
  "weather": "rain",
  "foodSub": "any",
  "linkedFood": false,
  "playListKept": false,
  "clarification": false,
  "excludePlaceIds": [],
  "rejectedCategories": [],
  "excludeMenus": [],
  "recommendationMode": "any",
  "searchQuery": "비 와서 실내",
  "retain": [
    "region",
    "scenario"
  ],
  "add": [
    "indoor",
    "rain"
  ],
  "remove": []
}
```
- 실제:

```
pipeline=refine
classifier=refine
screenRefinement=refine
category=없음/없음
region=동탄/동탄
scenario=date/date
kids=false/false
indoor=true/true
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
search=비 와서 실내
```

## 현재 규칙으로 우선 볼 문제

1. category_state 15건
2. refinement_state 15건
3. refinement_screen 6건
4. scenario_state 5건
5. exclude_ids 4건
6. calm 2건
7. food_sub_screen 1건
8. food_sub_state 1건
9. weather 1건

지역 유지, 거절 문구, 식사 추가, 확인 질문처럼 이미 규칙의 대상인 실패를 먼저 수정하는 편이 맞습니다.

## AI 모델 도입을 검토할 문제

1. refinement_state 14건

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
