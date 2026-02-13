// app/components/HamaActionBar.tsx
"use client";

type Props = {
  visible: boolean;
  onCall: () => void;
  onNavigate: () => void;
  onReserve: () => void;
  onRate: () => void;
};

export default function HamaActionBar({
  visible,
  onCall,
  onNavigate,
  onReserve,
  onRate,
}: Props) {
  if (!visible) return null;

  return (
    <div className="hama-action-bar">
      <button className="hama-action-btn" onClick={onCall}>
        📞 <span>전화</span>
      </button>
      <button className="hama-action-btn" onClick={onNavigate}>
        🧭 <span>길찾기</span>
      </button>
      <button className="hama-action-btn" onClick={onReserve}>
        📅 <span>예약</span>
      </button>
      <button className="hama-action-btn" onClick={onRate}>
        ⭐ <span>평점</span>
      </button>
    </div>
  );
}
