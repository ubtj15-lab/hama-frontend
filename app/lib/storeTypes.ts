export type HomeTabKey = "all" | "restaurant" | "cafe" | "salon" | "activity";

export type HomeCard = {
  id: string;
  name: string;

  category?: string | null;
  area?: string | null;
  address?: string | null;

  lat?: number | null;
  lng?: number | null;

  phone?: string | null;

  image_url?: string | null;

  kakao_place_url?: string | null;

  // ✅ 추가: 네이버 플레이스 상세로 바로 보내기 위한 id
  naver_place_id?: string | null;

  mood?: string[] | null;
  tags?: string[] | null;

  with_kids?: boolean | null;
  for_work?: boolean | null;
  price_level?: string | null;
  reservation_required?: boolean | null;

  // UI에서 쓰는 값들이 섞여 있을 수도 있어서 optional로 열어둠
  categoryLabel?: string | null;
  moodText?: string | null;
};
