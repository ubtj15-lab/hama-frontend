/** ✅ 공통 액션바: 길찾기 · 예약 · 리뷰 · 업종별 버튼(메뉴/시술/객실/서비스)  */
type Industry =
  | "cafe"     // 메뉴
  | "restaurant"
  | "salon"    // 시술
  | "nail"
  | "hotel"    // 객실
  | "gym"      // 프로그램
  | "hospital" // 진료과목
  | "spa"      // 코스
  | "show"     // 티켓
  | "shop"     // 상품
  | "car"      // 서비스
  | "pet"      // 반려서비스
  | "default";

function getIndustryLabel(industry: Industry) {
  switch (industry) {
    case "cafe":
    case "restaurant":
      return "메뉴";
    case "salon":
    case "nail":
      return "시술";
    case "hotel":
      return "객실";
    case "gym":
      return "프로그램";
    case "hospital":
      return "진료과목";
    case "spa":
      return "코스";
    case "show":
      return "티켓";
    case "shop":
      return "상품";
    case "car":
      return "서비스";
    case "pet":
      return "반려서비스";
    default:
      return "서비스";
  }
}

export function ActionBar({
  industry = "cafe",
  onNavigate,
  onReserve,
  onReview,
  onIndustry,
}: {
  industry?: Industry;
  onNavigate?: () => void;
  onReserve?: () => void;
  onReview?: () => void;
  onIndustry?: () => void;
}) {
  const fourth = getIndustryLabel(industry);

  const buttons = [
    { label: "길찾기", onClick: onNavigate },
    { label: "예약",   onClick: onReserve },
    { label: "리뷰",   onClick: onReview },
    { label: fourth,  onClick: onIndustry },
  ];

  return (
    <div className="absolute left-0 right-0 -bottom-3 flex justify-center gap-2">
      <div className="flex gap-2 rounded-full bg-white/75 backdrop-blur-md px-3 py-2 shadow">
        {buttons.map((b) => (
          <button
            key={b.label}
            onClick={b.onClick}
            className="min-w-[56px] px-3 h-10 rounded-full text-sm font-medium text-gray-800 bg-white hover:bg-gray-50 shadow-sm"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
