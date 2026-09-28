import type { RequestClass } from "@/lib/conversation/capability";

/**
 * Held-out dialogues. Written after the capability rules, and not used to change them.
 * Wording is not copied from the original 40 scenarios.
 */
export type HeldExpect = {
  utterance: string;
  requestClass: RequestClass;
  topic?: string | null;
  hold: boolean;
  region?: string | null;
  category?: string | null;
  /** Previous category must remain. */
  keepCategory?: boolean;
  clarification?: boolean;
  /** Ids that must still be excluded. */
  excludeIds?: string[];
  /** Ids that must not be newly excluded. */
  excludeAbsent?: string[];
  withKids?: boolean;
  /** Recorded, not mixed into the pass/fail of the turn. */
  scenarioNote?: string;
  promptIncludes?: string[];
  promptExcludes?: string[];
  shownIds?: string[];
};

export type HeldScenario = {
  id: string;
  title: string;
  turns: HeldExpect[];
};

export const heldoutScenarios: HeldScenario[] = [
  {
    id: "H01",
    title: "예약 시각을 말한 뒤 다시 장소만 요청",
    turns: [
      {
        utterance: "수원에서 저녁 식당 추천",
        requestClass: "search",
        hold: false,
        region: null,
        category: "FOOD",
        shownIds: ["r1", "r2"],
      },
      {
        utterance: "내일 여섯 시에 예약해 줘",
        requestClass: "external_action",
        topic: "reservation_execute",
        hold: true,
        keepCategory: true,
        clarification: true,
        promptIncludes: ["예약"],
        promptExcludes: ["예약했습니다", "완료되었"],
      },
      {
        utterance: "그럼 그냥 다른 식당",
        requestClass: "search",
        hold: false,
        keepCategory: true,
        clarification: false,
        excludeIds: ["r1", "r2"],
      },
    ],
  },
  {
    id: "H02",
    title: "인원과 좌석은 예약 실행으로 남김",
    turns: [
      {
        utterance: "병점에서 고기 먹을 곳",
        requestClass: "search",
        hold: false,
        region: "병점",
        category: "FOOD",
      },
      {
        utterance: "네 명으로 예약해 줘",
        requestClass: "external_action",
        topic: "reservation_execute",
        hold: true,
        region: "병점",
        keepCategory: true,
        promptExcludes: ["예약했습니다"],
      },
      {
        utterance: "창가 좌석으로 지정해 줘",
        requestClass: "external_action",
        topic: "seat",
        hold: true,
        region: "병점",
        keepCategory: true,
        promptIncludes: ["매장"],
      },
    ],
  },
  {
    id: "H03",
    title: "예약 가능 검색은 예약 실행과 다름",
    turns: [
      {
        utterance: "평택에서 점심",
        requestClass: "search",
        hold: false,
        region: "평택",
        category: "FOOD",
      },
      {
        utterance: "예약 가능한 곳만 보여 줘",
        requestClass: "missing_data",
        topic: "reservation_search",
        hold: true,
        region: "평택",
        keepCategory: true,
        promptIncludes: ["비었는지"],
        promptExcludes: ["예약했습니다"],
      },
      {
        utterance: "예약 없이 바로 갈 수 있는 식당",
        requestClass: "search",
        hold: false,
        region: "평택",
        category: "FOOD",
        clarification: false,
      },
    ],
  },
  {
    id: "H04",
    title: "대기와 혼잡을 식당 재검색으로 바꾸지 않음",
    turns: [
      {
        utterance: "동탄 키즈카페 갈까",
        requestClass: "search",
        hold: false,
        region: "동탄",
        withKids: true,
        scenarioNote: "label-separate",
        shownIds: ["k1", "k2", "k3"],
      },
      {
        utterance: "웨이팅 없는 데로",
        requestClass: "missing_data",
        topic: "live_wait",
        hold: true,
        region: "동탄",
        withKids: true,
        promptIncludes: ["대기"],
      },
      {
        utterance: "지금 사람 많아?",
        requestClass: "missing_data",
        topic: "congestion",
        hold: true,
        region: "동탄",
        promptExcludes: ["혼잡하지 않"],
      },
    ],
  },
  {
    id: "H05",
    title: "영업 확인 뒤에 바꿔 줘는 새 검색이라 업종을 강제하지 않음",
    turns: [
      {
        utterance: "오산 카페 추천해 줘",
        requestClass: "search",
        hold: false,
        region: "오산",
        category: "CAFE",
      },
      {
        utterance: "지금 영업하니",
        requestClass: "missing_data",
        topic: "open_now",
        hold: true,
        region: "오산",
        category: "CAFE",
        promptIncludes: ["영업"],
        promptExcludes: ["영업 중이에요"],
      },
      {
        utterance: "병점으로 바꿔 줘",
        requestClass: "search",
        hold: false,
        region: "병점",
        category: null,
        clarification: false,
      },
    ],
  },
  {
    id: "H06",
    title: "심야 영업은 거르지 않고 다음 조건은 유지",
    turns: [
      {
        utterance: "동탄에서 공부할 카페",
        requestClass: "search",
        hold: false,
        region: "동탄",
        category: "CAFE",
      },
      {
        utterance: "밤늦게까지 여는 곳",
        requestClass: "missing_data",
        topic: "hours_after",
        hold: true,
        region: "동탄",
        category: "CAFE",
        promptIncludes: ["영업시간"],
      },
      {
        utterance: "조용한 쪽으로",
        requestClass: "search",
        hold: false,
        region: "동탄",
        category: "CAFE",
        clarification: false,
      },
    ],
  },
  {
    id: "H07",
    title: "콘센트 요청이 카드를 갈아 끼우지 않음",
    turns: [
      {
        utterance: "평택에서 노트북 카페",
        requestClass: "search",
        hold: false,
        region: "평택",
        category: "CAFE",
        shownIds: ["c1", "c2"],
      },
      {
        utterance: "충전 가능한 자리 있어?",
        requestClass: "missing_data",
        topic: "outlet",
        hold: true,
        region: "평택",
        category: "CAFE",
        excludeAbsent: ["c1", "c2"],
        promptIncludes: ["콘센트"],
      },
    ],
  },
  {
    id: "H08",
    title: "반려견 동반을 가능하다고 말하지 않음",
    turns: [
      {
        utterance: "동탄 공원 근처 카페",
        requestClass: "search",
        hold: false,
        region: "동탄",
        category: "CAFE",
      },
      {
        utterance: "애견 동반돼요?",
        requestClass: "missing_data",
        topic: "pet",
        hold: true,
        region: "동탄",
        category: "CAFE",
        promptIncludes: ["단정하지"],
        promptExcludes: ["가능해요", "환영"],
      },
    ],
  },
  {
    id: "H09",
    title: "가격 상한을 추측해서 걸러내지 않음",
    turns: [
      {
        utterance: "오산에서 혼밥",
        requestClass: "search",
        hold: false,
        region: "오산",
        category: "FOOD",
      },
      {
        utterance: "예산은 2만 원",
        requestClass: "missing_data",
        topic: "price_cap",
        hold: true,
        region: "오산",
        keepCategory: true,
        promptIncludes: ["가격"],
        promptExcludes: ["2만 원 이하로 골랐"],
      },
    ],
  },
  {
    id: "H10",
    title: "알레르기 안전을 보장하지 않음",
    turns: [
      {
        utterance: "병점 식당",
        requestClass: "search",
        hold: false,
        region: "병점",
        category: "FOOD",
      },
      {
        utterance: "땅콩 알러지 있어요",
        requestClass: "missing_data",
        topic: "allergy",
        hold: true,
        region: "병점",
        category: "FOOD",
        promptIncludes: ["보장하지"],
        promptExcludes: ["안전합니다", "빼 드릴게요"],
      },
      {
        utterance: "일식으로",
        requestClass: "search",
        hold: false,
        region: "병점",
        category: "FOOD",
        clarification: false,
      },
    ],
  },
  {
    id: "H11",
    title: "영어 메뉴 유무를 단정하지 않음",
    turns: [
      {
        utterance: "동탄 브런치 카페",
        requestClass: "search",
        hold: false,
        region: "동탄",
        category: "CAFE",
      },
      {
        utterance: "메뉴가 영어로 돼 있어?",
        requestClass: "missing_data",
        topic: "english_menu",
        hold: true,
        region: "동탄",
        category: "CAFE",
        promptIncludes: ["영어"],
      },
    ],
  },
  {
    id: "H12",
    title: "막연한 외출은 업종을 비워 두고 질문",
    turns: [
      {
        utterance: "심심해서 어디 가지",
        requestClass: "needs_detail",
        topic: "vague_outing",
        hold: true,
        category: null,
        clarification: true,
        promptIncludes: ["어디쯤"],
      },
      {
        utterance: "동탄으로",
        requestClass: "search",
        hold: false,
        region: "동탄",
        clarification: false,
      },
      {
        utterance: "아이랑 실내 놀이",
        requestClass: "search",
        hold: false,
        region: "동탄",
        withKids: true,
        category: "ACTIVITY",
        clarification: false,
      },
    ],
  },
  {
    id: "H13",
    title: "업종을 말하지 않은 외출은 비워 둠",
    turns: [
      {
        utterance: "주말에 평택에서 갈 만한 곳",
        requestClass: "search",
        hold: false,
        region: "평택",
        category: null,
        clarification: false,
      },
      {
        utterance: "비 오면 실내",
        requestClass: "search",
        hold: false,
        region: "평택",
        category: null,
        clarification: false,
      },
    ],
  },
  {
    id: "H14",
    title: "외식은 음식 업종으로 읽고 가족 조건은 유지",
    turns: [
      {
        utterance: "오산에서 부부랑 외식할 곳",
        requestClass: "search",
        hold: false,
        region: "오산",
        category: "FOOD",
      },
      {
        utterance: "주차되는 데로",
        requestClass: "search",
        hold: false,
        region: "오산",
        category: "FOOD",
        clarification: false,
      },
    ],
  },
  {
    id: "H15",
    title: "어느 식당인지 모르면 전부 빼지 않고 질문",
    turns: [
      {
        utterance: "동탄에서 아이랑 놀 곳",
        requestClass: "search",
        hold: false,
        region: "동탄",
        withKids: true,
        shownIds: ["p1", "p2", "p3"],
      },
      {
        utterance: "그 식당은 말고",
        requestClass: "search",
        hold: false,
        clarification: true,
        region: "동탄",
        withKids: true,
        excludeAbsent: ["p1", "p2", "p3"],
        promptIncludes: ["어느 곳"],
      },
    ],
  },
  {
    id: "H16",
    title: "키즈카페는 동반 조건과 시나리오 이름을 따로 봄",
    turns: [
      {
        utterance: "평택 키즈카페",
        requestClass: "search",
        hold: false,
        region: "평택",
        withKids: true,
        scenarioNote: "label-separate",
      },
      {
        utterance: "실내만",
        requestClass: "search",
        hold: false,
        region: "평택",
        withKids: true,
        clarification: false,
      },
    ],
  },
  {
    id: "H17",
    title: "미지원 뒤에 명시적 새 검색은 이전 지역을 강제하지 않음",
    turns: [
      {
        utterance: "동탄 카페",
        requestClass: "search",
        hold: false,
        region: "동탄",
        category: "CAFE",
        shownIds: ["d1"],
      },
      {
        utterance: "콘센트 있어?",
        requestClass: "missing_data",
        topic: "outlet",
        hold: true,
        region: "동탄",
        category: "CAFE",
      },
      {
        utterance: "처음부터 오산 맛집 찾아 줘",
        requestClass: "search",
        hold: false,
        region: "오산",
        category: "FOOD",
        clarification: false,
        excludeAbsent: ["d1"],
      },
    ],
  },
  {
    id: "H18",
    title: "테이블 요청은 완료로 안내하지 않음",
    turns: [
      {
        utterance: "동탄 파스타 맛집",
        requestClass: "search",
        hold: false,
        region: "동탄",
        category: "FOOD",
      },
      {
        utterance: "테이블 좀 잡아 줄래",
        requestClass: "external_action",
        topic: "reservation_execute",
        hold: true,
        region: "동탄",
        keepCategory: true,
        promptExcludes: ["잡아 드렸어요", "예약했습니다"],
      },
    ],
  },
  {
    id: "H19",
    title: "문 닫기 전에는 영업 데이터 없이 거르지 않음",
    turns: [
      {
        utterance: "오산 식당",
        requestClass: "search",
        hold: false,
        region: "오산",
        category: "FOOD",
      },
      {
        utterance: "문 닫기 전에 갈 수 있는 곳",
        requestClass: "missing_data",
        topic: "hours_after",
        hold: true,
        region: "오산",
        keepCategory: true,
      },
    ],
  },
  {
    id: "H20",
    title: "보여 준 곳을 뺀 뒤에도 미지원은 목록을 유지",
    turns: [
      {
        utterance: "동탄 카페",
        requestClass: "search",
        hold: false,
        region: "동탄",
        category: "CAFE",
        shownIds: ["a1", "a2", "a3"],
      },
      {
        utterance: "아까 본 데는 빼 줘",
        requestClass: "search",
        hold: false,
        region: "동탄",
        category: "CAFE",
        excludeIds: ["a1", "a2", "a3"],
      },
      {
        utterance: "강아지랑 들어갈 수 있어?",
        requestClass: "missing_data",
        topic: "pet",
        hold: true,
        region: "동탄",
        category: "CAFE",
        excludeIds: ["a1", "a2", "a3"],
      },
    ],
  },
  {
    id: "H21",
    title: "가격을 말한 뒤 가까운 곳 요청은 음식 조건을 유지",
    turns: [
      {
        utterance: "병점에서 국밥",
        requestClass: "search",
        hold: false,
        region: "병점",
        category: "FOOD",
      },
      {
        utterance: "1만 원 넘지 않게",
        requestClass: "missing_data",
        topic: "price_cap",
        hold: true,
        region: "병점",
        category: "FOOD",
      },
      {
        utterance: "가까운 데로",
        requestClass: "search",
        hold: false,
        region: "병점",
        category: "FOOD",
        clarification: false,
      },
    ],
  },
  {
    id: "H22",
    title: "확인 질문 뒤에 지역을 주면 검색으로 돌아옴",
    turns: [
      {
        utterance: "뭐 하지",
        requestClass: "needs_detail",
        topic: "vague_outing",
        hold: true,
        category: null,
        clarification: true,
      },
      {
        utterance: "오산 카페",
        requestClass: "search",
        hold: false,
        region: "오산",
        category: "CAFE",
        clarification: false,
      },
    ],
  },
];
