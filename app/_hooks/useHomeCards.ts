"use client";

import { useEffect, useState } from "react";
import type { HomeCard } from "../../lib/storeTypes";
import { fetchStores } from "../../lib/storeRepository";

const FALLBACK_HOME_CARDS: HomeCard[] = [
  {
    id: "cafe-1",
    name: "스타벅스 오산점",
    categoryLabel: "카페",
    distanceKm: 0.5,
    moodText: "조용한 분위기",
    imageUrl: "/images/sample-cafe-1.jpg",
    tags: ["조용", "커피", "작업"],
    withKids: false,
    forWork: true,
    priceLevel: 2,
  } as HomeCard,
  {
    id: "food-1",
    name: "소담소담 한식당",
    categoryLabel: "식당",
    distanceKm: 0.7,
    moodText: "가족 외식하기 좋은 밥집",
    imageUrl: "/images/sample-dining-1.jpg",
    tags: ["한식", "가족", "든든"],
    withKids: true,
    forWork: false,
    priceLevel: 2,
  } as HomeCard,
  {
    id: "beauty-1",
    name: "해온 헤어",
    categoryLabel: "미용실",
    distanceKm: 1.2,
    moodText: "예약하면 빨라요",
    imageUrl: "/images/sample-beauty-1.jpg",
    tags: ["컷", "펌", "염색"],
    withKids: false,
    forWork: false,
    priceLevel: 3,
  } as HomeCard,
  {
    id: "act-1",
    name: "국립농업박물관",
    categoryLabel: "액티비티",
    distanceKm: 2.3,
    moodText: "아이랑 가기 좋아요",
    imageUrl: "/images/sample-activity-1.jpg",
    tags: ["박물관", "체험", "키즈"],
    withKids: true,
    forWork: false,
    priceLevel: 1,
  } as HomeCard,
  {
    id: "cafe-2",
    name: "라운지 83",
    categoryLabel: "카페",
    distanceKm: 0.8,
    moodText: "햇살 잘 들어오는 브런치",
    imageUrl: "/images/sample-cafe-2.jpg",
    tags: ["브런치", "감성", "사진"],
    withKids: false,
    forWork: false,
    priceLevel: 3,
  } as HomeCard,
];

export function useHomeCards() {
  const [cards, setCards] = useState<HomeCard[]>(FALLBACK_HOME_CARDS);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const data = await fetchStores(); // 너 storeRepository.ts 그대로 사용
        if (!mounted) return;

        if (data && data.length > 0) {
          setCards(data);
          setActiveIndex(0);
        } else {
          setCards(FALLBACK_HOME_CARDS);
          setActiveIndex(0);
        }
      } catch {
        if (!mounted) return;
        setCards(FALLBACK_HOME_CARDS);
        setActiveIndex(0);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  return { cards, activeIndex, setActiveIndex };
}
