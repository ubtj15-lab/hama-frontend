import type { ConversationContext } from "./types";
import { namedAreaFromUtterance } from "./namedRegion";

/** A. search, B. needs_detail, C. missing_data, D. external_action */
export type RequestClass = "search" | "needs_detail" | "missing_data" | "external_action";

export type ResponseKind = "question" | "limit" | "alternative";

export type CapabilityDecision = {
  requestClass: RequestClass;
  topic: string | null;
  responseKind: ResponseKind | null;
  /** Do not fetch or replace recommendation cards. */
  holdRecommendations: boolean;
  /** Unsupported follow-ups stay on the previous trip instead of becoming a new search. */
  forceClarify: boolean;
  prompt: string | null;
};

const SEARCH: CapabilityDecision = {
  requestClass: "search",
  topic: null,
  responseKind: null,
  holdRecommendations: false,
  forceClarify: false,
  prompt: null,
};

const RESERVATION_TOPICS = new Set(["reservation_execute", "party_size", "seat"]);

function compact(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function topicOf(previous: ConversationContext | null): string | null {
  return previous?.capabilityTopic ?? null;
}

function decide(
  requestClass: RequestClass,
  topic: string,
  responseKind: ResponseKind,
  prompt: string,
  forceClarify = true
): CapabilityDecision {
  return {
    requestClass,
    topic,
    responseKind,
    holdRecommendations: true,
    forceClarify,
    prompt,
  };
}

function hasPlaceSearchFrame(text: string): boolean {
  return /카페|식당|밥|맛집|놀이|미용|네일|코스|키즈|외식|곳|추천|찾아|근처|실내|야외|아이|메뉴|예약|주차|조용|가까운|동탄|오산|평택|병점|먹/.test(text);
}

/** A question with no place request. A place word in the same sentence stays a search. */
function isOutsidePlaceSearch(text: string): boolean {
  if (hasPlaceSearchFrame(text)) return false;
  return /비트코인|암호화폐|코인|주식|환율|시세|날씨|기온|미세먼지|뉴스|번역|계산|숙제|로또|운세|유튜브|넷플릭스|드라마/.test(text);
}

function asksForKnownPlace(text: string): boolean {
  return /있는\s*(곳|데|카페|식당)|추천|찾아|많은/.test(text);
}

/** Grab a table. A window or corner seat stays a seat request, and a venue search stays a search. */
function grabsTable(text: string): boolean {
  if (asksForKnownPlace(text)) return false;
  if (/(창가|코너|룸)/.test(text)) return false;
  return /(테이블|자리).{0,12}(잡아|맡아|부탁)/.test(text);
}

function reservationExecute(text: string): boolean {
  if (/예약\s*없이|예약\s*안/.test(text)) return false;
  if (/예약\s*(가능|되는)|예약되는|예약\s*필수/.test(text) && !/예약\s*해|예약해/.test(text)) return false;
  if (/예약\s*(해\s*줘|해줘|좀|부탁)|예약해|예약\s*잡아|예약\s*넣어|테이블\s*예약|자리\s*예약/.test(text)) {
    return true;
  }
  return grabsTable(text);
}

function liveCongestion(text: string, previous: ConversationContext | null): boolean {
  if (/복잡하지|복잡한\s*데|복잡.{0,8}싫/.test(text)) return false;
  if (/피하|싫/.test(text) && !/[?？]/.test(text)) return false;
  if (!/사람\s*많|북적|한가|한산|붐벼|붐비|혼잡도|혼잡해|혼잡하/.test(text)) return false;
  if (/추천|찾아|싶은|원해|곳으로|데로|곳만/.test(text) && !(/[?？]|알려|지금|현재|실시간/.test(text))) return false;
  if (/[?？]|알려|지금|현재|실시간/.test(text)) return true;
  return Boolean(previous) && text.replace(/\s+/g, "").length <= 16;
}

function englishMenu(text: string): boolean {
  if (/영어\s*(학원|회화|공부|수업|동호회)/.test(text)) return false;
  return /영어\s*메뉴|영문\s*메뉴|영어판\s*메뉴|메뉴.{0,16}(영어|영문)|영어(로|판).{0,10}메뉴/.test(text);
}

function arrivalBeforeClose(text: string): boolean {
  return /문\s*닫|닫(?:기|히기)\s*전|마감\s*전/.test(text);
}

function reservationSearch(text: string): boolean {
  if (reservationExecute(text)) return false;
  return /예약\s*(가능|되는|할\s*수)|예약되는|예약\s*필수/.test(text);
}

/**
 * Place search stays on the existing path.
 * Missing data and external actions do not become a new restaurant search.
 */
export function classifyRequestCapability(
  text: string,
  previous: ConversationContext | null
): CapabilityDecision {
  const q = compact(text);
  if (!q) return SEARCH;
  const prior = topicOf(previous);

  if (reservationExecute(q)) {
    return decide(
      "external_action",
      "reservation_execute",
      "limit",
      "예약은 여기서 잡아 드리지 않아요. 예약이 완료된 것도 아니에요. 보여 드린 장소는 그대로 두고, 시간은 매장에 직접 확인해 주세요."
    );
  }

  if (/(창가|코너|룸|좌석|자리).{0,12}(잡아|지정|부탁)/.test(q) && !grabsTable(q)) {
    return decide(
      "external_action",
      "seat",
      "limit",
      "창가나 특정 자리는 지정해 드리지 못해요. 좌석은 매장에 요청해 주세요. 앞에서 고른 장소는 유지합니다."
    );
  }

  if (
    prior &&
    RESERVATION_TOPICS.has(prior) &&
    /(\d+|[한두세네다섯])\s*명/.test(q) &&
    !/추천|찾아|식당|카페|갈\s*곳/.test(q)
  ) {
    return decide(
      "external_action",
      "party_size",
      "limit",
      "인원은 알아들었지만 예약을 진행하지는 않아요. 인원과 예약은 매장에 확인해 주세요."
    );
  }

  if (reservationSearch(q)) {
    return decide(
      "missing_data",
      "reservation_search",
      "alternative",
      "지금 예약이 비었는지는 확인할 수 없어요. 예약이 필요하다는 표시만 있는 곳이 있을 뿐, 빈자리를 대신 잡아 드리지는 않아요. 지역이나 업종을 말하면 장소는 이어서 찾아 볼게요."
    );
  }

  if (/대기\s*(없|없는|안)|웨이팅/.test(q)) {
    return decide(
      "missing_data",
      "live_wait",
      "limit",
      "지금 대기가 없는지는 확인하지 못해요. 실시간 대기 정보가 없어서, 보여 드린 장소를 대기 없는 곳으로 다시 고르지는 않을게요. 매장에 문의해 주세요."
    );
  }

  if (liveCongestion(q, previous)) {
    return decide(
      "missing_data",
      "congestion",
      "limit",
      "실시간 혼잡도는 알 수 없어요. 붐비는 정도를 추측해서 말하지 않고, 보여 드린 곳도 바꾸지 않을게요."
    );
  }

  if (/지금\s*문\s*열|아직\s*문\s*열|문\s*열었|지금\s*문\s*연|문\s*연\s*(곳|카페|데)|영업\s*중|지금\s*영업|열려\s*있는/.test(q)) {
    return decide(
      "missing_data",
      "open_now",
      "limit",
      "지금 영업 중인지는 확인된 영업시간이 없어 가려 드리지 못해요. 영업 중이라고 단정하지 않으니 방문 전에 매장 안내를 봐 주세요."
    );
  }

  if (arrivalBeforeClose(q)) {
    return decide(
      "missing_data",
      "hours_after",
      "limit",
      "영업시간과 가는 데 걸리는 시간을 확인할 수 없어요. 도착할 수 있다고 보장하지 않고, 갈 수 있는 곳으로 다시 고르지도 않을게요. 마감은 매장에 확인해 주세요."
    );
  }

  if (/\d+\s*시\s*이후|이후에도|늦게\s*까지|심야/.test(q)) {
    return decide(
      "missing_data",
      "hours_after",
      "limit",
      "몇 시까지 하는지는 저장된 영업시간이 없어 걸러 드리지 못해요. 마감 시간은 매장에서 확인해 주세요."
    );
  }

  if (/콘센트|충전\s*가능/.test(q)) {
    return decide(
      "missing_data",
      "outlet",
      "limit",
      "콘센트가 있는지는 장소 정보에 없어요. 있는 곳으로 다시 고르지는 않을게요. 매장에 있는지 물어봐 주세요."
    );
  }

  if (/강아지|반려견|애견|반려동물|펫\s*프렌들리|애완견/.test(q)) {
    return decide(
      "missing_data",
      "pet",
      "limit",
      "반려견 동반이 되는지는 확인된 정보가 없어요. 가능하다고 단정하지 않을게요. 매장에 직접 확인해 주세요."
    );
  }

  if (/만\s*원|원\s*이하|가격\s*상한|예산/.test(q)) {
    return decide(
      "missing_data",
      "price_cap",
      "limit",
      "1인 가격 상한에 맞는 확인된 금액이 없어요. 가격을 추측해 걸러 드리지 않고, 비용은 매장에서 확인해 주세요."
    );
  }

  if (/알레르기|알러지/.test(q)) {
    return decide(
      "missing_data",
      "allergy",
      "limit",
      "알레르기에 안전한지는 판단하지 않아요. 안전하다고 보장하지 않으니 재료는 반드시 매장에 확인하세요. 식당 목록은 바꾸지 않을게요."
    );
  }

  if (englishMenu(q)) {
    return decide(
      "missing_data",
      "english_menu",
      "limit",
      "영어 메뉴가 있는지는 알지 못해요. 있다고 골라 드리지는 않을게요. 매장에 있는지 물어봐 주세요."
    );
  }

  if (
    !namedAreaFromUtterance(q) &&
    !/카페|식당|밥|맛집|놀이|미용|네일|코스|키즈|외식/.test(q) &&
    /심심|어디\s*가지|뭐\s*하지|갈\s*곳\s*없|갈\s*데\s*없/.test(q)
  ) {
    return decide(
      "needs_detail",
      "vague_outing",
      "question",
      "어디쯤인지, 식사·카페·놀 곳 중 무엇인지를 알려 주세요. 그전까지는 장소를 고르지 않을게요.",
      Boolean(previous)
    );
  }

  if (isOutsidePlaceSearch(q)) {
    return decide(
      "missing_data",
      "outside_place_search",
      "limit",
      "하마는 갈 장소와 조건을 찾아요. 시세나 실시간 정보는 확인하지 않고, 없는 내용은 만들지 않아요. 보여 드린 장소도 바꾸지 않을게요."
    );
  }

  return SEARCH;
}

/** Skip a new card fetch for this utterance without waiting for the saved context. */
export function shouldHoldRecommendations(
  text: string,
  previous: ConversationContext | null
): boolean {
  return classifyRequestCapability(text, previous).holdRecommendations;
}

/**
 * "외식" names a meal. Family or date context stays on its own scenario label.
 * This does not change ranking weights or intentType.
 */
export function diningOutCategory(text: string): "FOOD" | null {
  if (!/외식/.test(text)) return null;
  if (classifyRequestCapability(text, null).holdRecommendations) return null;
  return "FOOD";
}
