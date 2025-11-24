// 간단한 로컬 데이터 (이미지는 /public/images 에 있는 파일명 사용)
export type Place = {
  id: string;
  name: string;
  category: string;
  image: string;      // /images/... 경로
  address?: string;
};

export const PLACES: Place[] = [
  { id: "p1", name: "하마 카페", category: "카페", image: "/images/cafe1.jpg", address: "오산시 …" },
  { id: "p2", name: "딥브루 카페", category: "카페", image: "/images/cafe2.jpg" },
  { id: "p3", name: "골목식당", category: "식당", image: "/images/restaurant1.jpg" },
  { id: "p4", name: "메종 헤어", category: "미용실", image: "/images/hair1.jpg" },
  // 필요하면 더 추가
];
