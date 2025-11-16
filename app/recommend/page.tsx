'use client';

import React, { useMemo, useRef, useState } from 'react';

type Place = {
  id: number;
  name: string;
  category: string;
  image: string;
  description: string;
  actions: string[];
};

const PLACES: Place[] = [
  {
    id: 1,
    name: '블루문 카페',
    category: '카페 · 브런치',
    image: '/images/bluemoon-cafe.png',
    description:
      '로컬 윈도로 내린 브루잉 커피와 브런치를 즐길 수 있는 분위기 좋은 카페.',
    actions: ['예약', '길안내', '평점', '메뉴'],
  },
  {
    id: 2,
    name: '솔향 미용실',
    category: '헤어 · 미용실',
    image: '/images/solhyang-hair.png',
    description:
      '잔잔한 음악과 함께 편안하게 헤어 관리를 받을 수 있는 동네 단골 미용실.',
    actions: ['예약', '길안내', '시술보기', '리뷰'],
  },
  {
    id: 3,
    name: '도란도란 식당',
    category: '한식 · 가족 모임',
    image: '/images/dorandoran-food.png',
    description:
      '가족, 친척, 친구들과 도란도란 이야기 나누기 좋은 한식 전문 식당.',
    actions: ['예약', '길안내', '대표메뉴', '리뷰'],
  },
  {
    id: 4,
    name: '초코베이커리',
    category: '디저트 · 베이커리',
    image: '/images/choco-bakery.png',
    description:
      '갓 구운 빵과 디저트가 가득한 동네 빵집. 아이들과 함께 오기 좋은 곳.',
    actions: ['예약', '길안내', '인기메뉴', '리뷰'],
  },
  {
    id: 5,
    name: '그린파크 놀이터',
    category: '공원 · 산책',
    image: '/images/greenpark-play.png',
    description:
      '아이들과 산책하고 뛰어놀기 좋은 넓은 잔디와 놀이 시설이 있는 공원.',
    actions: ['길안내', '산책코스', '리뷰', '즐겨찾기'],
  },
];

const CARD_RADIUS = 22;
const CARD_SHADOW = '0 10px 22px rgba(15, 23, 42, 0.16)';

const baseCardStyle: React.CSSProperties = {
  width: '100%',
  background: '#ffffff',
  borderRadius: CARD_RADIUS,
  boxShadow: CARD_SHADOW,
  padding: 16,
  boxSizing: 'border-box',
};

export default function RecommendPage() {
  const [selectedId, setSelectedId] = useState<number | null>(PLACES[0].id);
  const [favorites, setFavorites] = useState<number[]>([]); // 즐겨찾기
  const detailRef = useRef<HTMLDivElement | null>(null);   // 상세 설명 위치

  const selectedPlace: Place | null = useMemo(() => {
    if (selectedId == null) return null;
    return PLACES.find((p) => p.id === selectedId) ?? null;
  }, [selectedId]);

  const handleCollapse = () => {
    setSelectedId(null);
  };

  // 🔹 버튼 공통 핸들러
  const handleActionClick = (place: Place, action: string) => {
    // 1) 예약 계열
    if (action.includes('예약')) {
      alert(
        `"${place.name}" 예약 버튼 눌렀어!\n\n지금은 데모 화면이라 안내만 보여주고 있고,\n나중에 여기서 실제 예약 화면이나 제휴 매장 예약 API를 연결하면 돼 🙂`
      );
      return;
    }

    // 2) 길안내
    if (action === '길안내') {
      const url = `https://map.kakao.com/?q=${encodeURIComponent(place.name)}`;
      window.open(url, '_blank');
      return;
    }

    // 3) 평점 / 리뷰
    if (action === '평점' || action === '리뷰') {
      alert(
        `"${place.name}" 리뷰/평점 영역이야.\n\n실제 서비스에선 여기에서 별점 남기기나\n리뷰 목록을 띄우면 딱 좋아!`
      );
      return;
    }

    // 4) 메뉴 / 시술 / 코스 → 상세 설명 카드로 스크롤
    if (
      action.includes('메뉴') ||
      action === '시술보기' ||
      action === '산책코스'
    ) {
      if (detailRef.current) {
        detailRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      return;
    }

    // 5) 즐겨찾기
    if (action === '즐겨찾기') {
      setFavorites((prev) =>
        prev.includes(place.id)
          ? prev.filter((id) => id !== place.id)
          : [...prev, place.id]
      );
      const nowFav = favorites.includes(place.id);
      alert(
        nowFav
          ? `"${place.name}"을(를) 즐겨찾기에서 해제했어.`
          : `"${place.name}"을(를) 즐겨찾기에 추가했어!`
      );
      return;
    }
  };

  const isFavorite = (placeId: number) => favorites.includes(placeId);

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#eef5fb',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 430,
          padding: '16px 16px 32px',
          boxSizing: 'border-box',
        }}
      >
        {/* 상단 광고 카드 */}
        <section
          style={{
            ...baseCardStyle,
            marginBottom: 18,
            background: '#00b894',
            color: '#ffffff',
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              marginBottom: 4,
            }}
          >
            하마 추천 스팟
          </div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            지금 인기 많은 로컬 매장을 만나보세요!
          </div>
        </section>

        {/* 리스트 + 확장 카드 */}
        <section>
          {PLACES.map((place) => {
            const isSelected = selectedId === place.id;
            const isCollapsed = selectedId === null;

            // ✅ 선택된 카드 (큰 사진 카드 + 버튼)
            if (isSelected) {
              return (
                <div
                  key={place.id}
                  style={{
                    ...baseCardStyle,
                    padding: 0,
                    marginBottom: 16,
                    overflow: 'hidden',
                    position: 'relative',
                    transform: 'scale(1.02)',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
                  }}
                >
                  {/* 뒤로가기 */}
                  <button
                    type="button"
                    onClick={handleCollapse}
                    style={{
                      position: 'absolute',
                      top: 10,
                      left: 10,
                      zIndex: 3,
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      border: 'none',
                      background: 'rgba(0,0,0,0.55)',
                      color: '#fff',
                      fontSize: 18,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                    }}
                    aria-label="카드 축소"
                  >
                    ←
                  </button>

                  {/* 이미지 + 오버레이 */}
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      height: 240,
                      overflow: 'hidden',
                    }}
                  >
                    <img
                      src={place.image}
                      alt={place.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                    />

                    {/* 아래쪽 그라데이션 */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: 110,
                        background:
                          'linear-gradient(to top, rgba(0,0,0,0.7), rgba(0,0,0,0))',
                      }}
                    />

                    {/* 라벨 (매장명 · 카테고리) */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 18,
                        bottom: 62,
                        padding: '6px 14px',
                        borderRadius: 999,
                        background: 'rgba(0,0,0,0.75)',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {place.name} · {place.category}
                      {isFavorite(place.id) && ' ★'}
                    </div>

                    {/* 🔥 4개 액션 버튼 */}
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        bottom: 10,
                        padding: '0 16px',
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'space-between',
                      }}
                    >
                      {place.actions.map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleActionClick(place, label)}
                          style={{
                            flex: 1,
                            padding: '7px 0',
                            background: '#ffffff',
                            borderRadius: 999,
                            border: 'none',
                            fontSize: 12,
                            fontWeight: 600,
                            color: '#333',
                            boxShadow: '0 3px 8px rgba(0,0,0,0.18)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            // ✅ 나머지 카드들 (작게)
            return (
              <div
                key={place.id}
                onClick={() => setSelectedId(place.id)}
                style={{
                  ...baseCardStyle,
                  padding: isCollapsed ? 14 : 10,
                  marginBottom: isCollapsed ? 14 : 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                  opacity: isCollapsed ? 1 : 0.3,
                  transform: isCollapsed ? 'scaleY(1)' : 'scaleY(0.6)',
                  transformOrigin: 'center',
                  transition:
                    'opacity 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease',
                }}
              >
                <div
                  style={{
                    width: isCollapsed ? 60 : 50,
                    height: isCollapsed ? 60 : 50,
                    borderRadius: 16,
                    overflow: 'hidden',
                    flexShrink: 0,
                    transition: 'width 0.25s ease, height 0.25s ease',
                  }}
                >
                  <img
                    src={place.image}
                    alt={place.name}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                </div>

                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: isCollapsed ? 14 : 13,
                      fontWeight: 700,
                      marginBottom: 3,
                    }}
                  >
                    {place.name}
                    {isFavorite(place.id) && ' ★'}
                  </div>
                  <div
                    style={{
                      fontSize: isCollapsed ? 12 : 11,
                      color: '#888',
                    }}
                  >
                    {place.category}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* 선택된 카드 상세 설명 */}
        {selectedPlace && (
          <section
            ref={detailRef}
            style={{
              ...baseCardStyle,
              marginTop: 18,
            }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              {selectedPlace.name} · 상세 설명
            </div>
            <div
              style={{
                fontSize: 13,
                color: '#555',
                lineHeight: 1.5,
              }}
            >
              {selectedPlace.description}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
