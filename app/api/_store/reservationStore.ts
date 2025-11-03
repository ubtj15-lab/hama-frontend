type Reservation = Record<string, any>;

// ✅ 전역 스토어 유지 (프로세스 새로 떠도 복원 시도)
const g = globalThis as any;
if (!g.__reservationStore) {
  g.__reservationStore = { reservations: [] as Reservation[] };
}
export const store = g.__reservationStore as {
  reservations: Reservation[];
};

const getId = (x: Reservation): string => {
  const raw = String(
    x?.id ?? x?.reservationId ?? x?.uuid ?? x?._id ?? x?.recordId ?? ""
  ).trim();
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const ensureId = (x: Reservation): Reservation => {
  const current = getId(x);
  if (current && current !== "undefined" && current !== "") return { ...x, id: current };
  const newId =
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `${Date.now()}-${Math.random()}`;
  return { ...x, id: newId };
};

const norm = (v: any) => {
  const s = String(v ?? "").trim();
  try { return decodeURIComponent(s); } catch { return s; }
};

export function addReservation(r: Reservation) {
  const normalized = ensureId(r);
  store.reservations.push(normalized);
}

export function getReservations() {
  for (let i = 0; i < store.reservations.length; i++) {
    store.reservations[i] = ensureId(store.reservations[i]);
  }
  return store.reservations;
}

// 👇 이 함수만 통째로 교체
export function deleteReservation(id: string | number): boolean {
  const target = norm(id); // 들어온 id 정규화
  const idx = store.reservations.findIndex((r) => {
    // 저장된 쪽 id도 안전하게 꺼내서 정규화
    return norm(getId(r)) === target;
  });
  if (idx === -1) return false;
  store.reservations.splice(idx, 1);
  return true;
}

// ⬇️ HMR 유지 및 프로세스 구분용 메타 함수
export function __getStoreMeta() {
  const g = globalThis as any;
  const s = g.__reservationStore;
  // 현재 Node 프로세스/런타임 정보
  const pid = (typeof process !== "undefined" && process?.pid) || "no-process";
  const node = (typeof process !== "undefined" && process?.versions?.node) || "no-node";
  // 싱글턴에 uid가 없으면 새로 부여
  if (s && !s.__uid) s.__uid = `${pid}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    pid,
    node,
    uid: s?.__uid ?? "no-store",
    length: s?.reservations?.length ?? -1,
    keys: s ? Object.keys(s) : [],
  };
}
