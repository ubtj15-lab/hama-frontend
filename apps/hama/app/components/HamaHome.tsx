"use client";

type Props = {
  onSearch: (q: string) => void;
  onMicPress?: () => void;
  onMicRelease?: () => void;
  listening?: boolean;
};

export default function HamaHome({
  onSearch,
  onMicPress,
  onMicRelease,
  listening = false,
}: Props) {
  return (
    <div className="hama-home">
      {/* 검색창 */}
      <div className="w-full max-w-[560px] mx-auto pt-4 px-4">
        <input
          className="w-full h-12 px-4 rounded-full border outline-none"
          placeholder="말하거나, 검색어를 입력해요"
          onKeyDown={(e) => {
            if (e.key === "Enter") onSearch((e.target as HTMLInputElement).value);
          }}
        />
      </div>

      {/* 하마(이미지) + 마이크 버튼 */}
      <div className="relative w-full h-[60vh]">
        <div className="hama-character">
          <img
            src="/hama/hama_idle.jpg"
            alt="HAMA idle"
            className="hama-hippo"
            draggable={false}
          />
        </div>

        <button
          className={`hama-mic ${listening ? "listening" : ""}`}
          onMouseDown={onMicPress}
          onMouseUp={onMicRelease}
          onTouchStart={onMicPress}
          onTouchEnd={onMicRelease}
          aria-label="마이크"
        >
          🎤
        </button>
      </div>
    </div>
  );
}
