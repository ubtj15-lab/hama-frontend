"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

/** 추천 아이템 타입 */
export type RecItem = {
  id: number | string;
  img: string;
  tel?: string;
  navUrl?: string;     // 카카오내비/지도 deep link
  reserveUrl?: string; // FreeReserve 링크
  ratingUrl?: string;  // 평점 페이지 링크
};

type Props = {
  items: RecItem[]; // 5장(<=5장도 OK)
};

export default function RecommendStrip({ items }: Props) {
  const [selected, setSelected] = useState<null | RecItem["id"]>(null);

  // 5장 미만이면 있는 만큼만 사용
  const cards = useMemo(() => items.slice(0, 5), [items]);

  useEffect(() => {
    // 초진입 시 오른쪽 -> 왼쪽 슬라이드 인 애니메이션 트리거
    const t = setTimeout(() => {
      document.documentElement.style.setProperty("--reco-mounted", "1");
    }, 40);
    return () => clearTimeout(t);
  }, []);

  return (
    <section className="reco-wrap">
      <div className="strip no-scrollbar" aria-label="하마 추천 리스트">
        {cards.map((it, idx) => {
          const isActive = selected === it.id;
          return (
            <div
              key={it.id}
              className={`card ${isActive ? "active" : ""}`}
              style={{
                // 오른쪽 -> 왼쪽 순차 등장 (0.1s 스태거)
                animationDelay: `${0.10 * idx}s`,
              }}
              onClick={() => setSelected(isActive ? null : it.id)}
            >
              <div className="imgbox">
                <Image
                  src={it.img}
                  alt="추천"
                  fill
                  className="img"
                  sizes="(max-width: 768px) 90vw, 480px"
                  priority={idx === 0}
                  unoptimized
                />
              </div>

              {/* 선택 상태: 어두운 디밍 + 4버튼 */}
              {isActive && (
                <>
                  <div className="dim" />
                  <div className="action-bar" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn"
                      aria-label="전화"
                      onClick={() => (it.tel ? (location.href = `tel:${it.tel}`) : null)}
                    >
                      📞
                    </button>
                    <button
                      className="btn"
                      aria-label="길찾기"
                      onClick={() => (it.navUrl ? (location.href = it.navUrl) : null)}
                    >
                      🗺
                    </button>
                    <button
                      className="btn"
                      aria-label="예약"
                      onClick={() => (it.reserveUrl ? (location.href = it.reserveUrl) : null)}
                    >
                      🗓
                    </button>
                    <button
                      className="btn"
                      aria-label="평점"
                      onClick={() => (it.ratingUrl ? (location.href = it.ratingUrl) : null)}
                    >
                      ⭐
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* 토큰 + 프리셋 B 스타일 */}
      <style jsx>{`
        :root{
          /* 디자인 토큰 (필요하면 이것만 수정) */
          --gap: 10px;
          --radius: 18px;
          --shadow: 0 8px 24px rgba(0,0,0,.10);
          --strip-max: 980px;
          --card-w: clamp(260px, 86vw, 460px);
          --card-ratio: 16 / 9;
          --active-scale: 1.06;
          --dim-opacity: .50;
          --blur: 1px;
          --btn-size: clamp(42px, 12vw, 52px);
          --btn-gap: 10px;
        }

        .reco-wrap{
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 12px 8px 22px;
          background: linear-gradient(180deg, #fff, #f6f9fc);
        }

        .strip{
          width: 100%;
          max-width: var(--strip-max);
          display: flex;
          gap: var(--gap);
          overflow-x: auto;
          padding: 6px 4px 12px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }

        .card{
          position: relative;
          flex: 0 0 auto;
          width: var(--card-w);
          aspect-ratio: var(--card-ratio);
          border-radius: var(--radius);
          overflow: hidden;
          box-shadow: var(--shadow);
          background: #eef3f8;
          cursor: pointer;
          scroll-snap-align: center;
          transform: translateX(32px);
          opacity: 0;

          /* mount 후 오른쪽→왼쪽 슬라이드 인 */
          animation: var(--appear, none) .52s ease forwards;
        }
        :root[style*="--reco-mounted: 1"] .card { --appear: slideIn; }

        @keyframes slideIn {
          to { transform: translateX(0); opacity: 1; }
        }

        .card.active{
          transform: translateX(0) scale(var(--active-scale));
          z-index: 10;
        }

        .imgbox{ position: absolute; inset: 0; }
        .img{ object-fit: cover; object-position: center; }

        .dim{
          position: absolute; inset: 0;
          background: rgba(0,0,0,var(--dim-opacity));
          backdrop-filter: blur(var(--blur));
        }

        .action-bar{
          position: absolute; left: 0; right: 0; bottom: 10px;
          display: flex; justify-content: center; gap: var(--btn-gap);
          padding: 0 10px;
        }
        .btn{
          width: var(--btn-size); height: var(--btn-size);
          border: none; outline: none; border-radius: 9999px;
          background: rgba(255,255,255,.28);
          backdrop-filter: blur(6px);
          color: #fff; font-size: 20px;
          display: grid; place-items: center;
          opacity: 0; transform: translateY(8px);
          animation: fadeUp .45s ease forwards;
        }
        .btn:nth-child(1){ animation-delay: .20s; }
        .btn:nth-child(2){ animation-delay: .32s; }
        .btn:nth-child(3){ animation-delay: .44s; }
        .btn:nth-child(4){ animation-delay: .56s; }

        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }

        /* 모바일에서 스크롤 바 감추기 */
        .no-scrollbar::-webkit-scrollbar{ display:none; }
        .no-scrollbar{ scrollbar-width:none; }
      `}</style>
    </section>
  );
}
