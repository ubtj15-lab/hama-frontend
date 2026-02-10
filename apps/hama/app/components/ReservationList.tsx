'use client';

import React, { useMemo, useState } from 'react';

type Reservation = {
  id: string;
  name: string;      // 고객명
  phone: string;     // 전화번호
  date: string;      // 예약 날짜 (예: 2025-11-20)
  time: string;      // 예약 시간 (예: 14:30)
  memo?: string;     // 메모
  status?: 'pending' | 'confirmed' | 'cancelled'; // 선택값 (안 써도 됨)
};

type Props = {
  items: Reservation[];
};

const CARD_SHADOW = '0 8px 18px rgba(15, 23, 42, 0.12)';
const RADIUS = 16;

const ReservationList: React.FC<Props> = ({ items }) => {
  const [query, setQuery] = useState('');

  // 검색어로 필터링
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const text =
        `${item.name}${item.phone}${item.date}${item.time}${item.memo ?? ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [items, query]);

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 430,
        margin: '0 auto',
        padding: '16px 16px 32px',
        boxSizing: 'border-box',
      }}
    >
      {/* 상단 타이틀 + 검색창 */}
      <header
        style={{
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            margin: 0,
            marginBottom: 10,
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          예약 목록
        </h2>

        <div
          style={{
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름, 전화번호 등으로 검색"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 999,
              border: '1px solid #d0d7e2',
              fontSize: 13,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </header>

      {/* 리스트 영역 */}
      {filtered.length === 0 ? (
        <div
          style={{
            marginTop: 12,
            padding: 18,
            borderRadius: RADIUS,
            background: '#f4f6fb',
            textAlign: 'center',
            fontSize: 13,
            color: '#6b7280',
          }}
        >
          예약 내역이 없어요.
        </div>
      ) : (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {filtered.map((r) => (
            <li
              key={r.id}
              style={{
                borderRadius: RADIUS,
                background: '#ffffff',
                boxShadow: CARD_SHADOW,
                padding: '12px 14px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                  }}
                >
                  {r.name}
                </div>

                {r.status && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: '3px 8px',
                      borderRadius: 999,
                      background:
                        r.status === 'confirmed'
                          ? 'rgba(34,197,94,0.1)'
                          : r.status === 'cancelled'
                          ? 'rgba(239,68,68,0.08)'
                          : 'rgba(59,130,246,0.08)',
                      color:
                        r.status === 'confirmed'
                          ? '#16a34a'
                          : r.status === 'cancelled'
                          ? '#ef4444'
                          : '#2563eb',
                    }}
                  >
                    {r.status === 'confirmed'
                      ? '확정'
                      : r.status === 'cancelled'
                      ? '취소'
                      : '대기'}
                  </span>
                )}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: '#4b5563',
                  marginBottom: 2,
                }}
              >
                {r.phone}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#6b7280',
                  marginBottom: r.memo ? 6 : 0,
                }}
              >
                {r.date} · {r.time}
              </div>

              {r.memo && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#374151',
                    background: '#f9fafb',
                    borderRadius: 10,
                    padding: '6px 8px',
                    marginTop: 2,
                  }}
                >
                  {r.memo}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ReservationList;
