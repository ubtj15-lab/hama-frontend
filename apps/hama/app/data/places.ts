export type Place = {
  id: string;
  name: string;
  category: string;
  lat: number;
  lng: number;
  image: string;
};

export const PLACES: Place[] = [
  {
    id: "1",
    name: "블루문 카페",
    category: "카페 · 브런치",
    lat: 37.5665,
    lng: 126.978,
    image: "/images/bluemoon-cafe.png",
  },
  {
    id: "2",
    name: "솔향 미용실",
    category: "헤어 · 미용실",
    lat: 37.5655,
    lng: 126.977,
    image: "/images/solhyang-hair.png",
  },
  {
    id: "3",
    name: "도란도란 식당",
    category: "한식 · 가족 모임",
    lat: 37.5672,
    lng: 126.9795,
    image: "/images/dorandoran-food.png",
  },
  {
    id: "4",
    name: "초코베이커리",
    category: "디저트 · 베이커리",
    lat: 37.5658,
    lng: 126.9792,
    image: "/images/choco-bakery.png",
  },
  {
    id: "5",
    name: "그린파크 놀이터",
    category: "공원 · 산책",
    lat: 37.5679,
    lng: 126.9768,
    image: "/images/greenpark-play.png",
  },
  {
    id: "6",
    name: "밤하늘 라운지",
    category: "루프탑 · 라운지",
    lat: 37.565,
    lng: 126.9805,
    image: "/images/night-lounge.png",
  },
  {
    id: "7",
    name: "책숲 서점",
    category: "서점 · 북카페",
    lat: 37.5681,
    lng: 126.9779,
    image: "/images/bookforest-bookstore.png",
  },
  {
    id: "8",
    name: "맘편한 키즈카페",
    category: "키즈 · 놀이터",
    lat: 37.5662,
    lng: 126.9758,
    image: "/images/mom-kids-cafe.png",
  },
  {
    id: "9",
    name: "오션뷰 레스토랑",
    category: "양식 · 뷰맛집",
    lat: 37.5648,
    lng: 126.9776,
    image: "/images/oceanview-restaurant.png",
  },
  {
    id: "10",
    name: "라이트 호텔",
    category: "호텔 · 숙박",
    lat: 37.5674,
    lng: 126.9812,
    image: "/images/light-hotel.png",
  },
];
