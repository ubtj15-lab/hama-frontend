"use client";

type Item = { id: string; imageUrl: string };
type Props = {
  items: Item[];
  selectedId: string | null;
  onSelect: (it: Item) => void;
};

export default function HamaRecommendSlide({
  items,
  selectedId,
  onSelect,
}: Props) {
  return (
    <div className="w-full overflow-hidden">
      <div className="flex gap-4 px-4 py-10 overflow-x-auto snap-x">
        {items.map((it) => {
          const selected = selectedId === it.id;
          return (
            <button
              key={it.id}
              onClick={() => onSelect(it)}
              className={`snap-start shrink-0 transition-all duration-300 rounded-xl overflow-hidden ${
                selected ? "w-[82vw] md:w-[720px]" : "w-[64vw] md:w-[520px] opacity-80"
              } aspect-[3/2] bg-gray-100`}
            >
              <img
                src={it.imageUrl}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
