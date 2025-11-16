"use client";

type Item = { id: string; imageUrl: string };
type Props = {
  items: Item[];
  onAction: (item: Item, type: "call" | "route" | "reserve" | "rate") => void;
};

export default function HamaPhotoGrid({ items, onAction }: Props) {
  return (
    <div className="px-4 pb-8 pt-20 max-w-[1080px] mx-auto">
      {/* 사진 격자: 정보 없음 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((it) => (
          <button
            key={it.id}
            className="relative group aspect-square overflow-hidden rounded-xl bg-gray-100"
            onClick={() => onAction(it, "route")} // 탭하면 우선 길찾기 진입으로 연결(데모)
          >
            <img
              src={it.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              draggable={false}
            />
          </button>
        ))}
      </div>

      {/* 각 사진 선택 시에만 보여줄 4가지 액션은 실제 상세 화면에서 노출 예정 */}
      {/* 전화/길찾기/예약/평점은 그때 카드 확대에 붙임 */}
    </div>
  );
}
