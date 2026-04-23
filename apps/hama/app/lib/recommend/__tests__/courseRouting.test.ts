import { describe, expect, it } from "vitest";
import {
  computeRouteMetrics,
  estimateTravelMinutesFromKm,
  haversineKm,
} from "../courseRouting";
import { BASE } from "./fixtures";

describe("courseRouting", () => {
  it("같은 좌표면 거리가 0에 가깝다", () => {
    const a = { lat: BASE.lat, lng: BASE.lng };
    const b = { lat: BASE.lat, lng: BASE.lng };
    const km = haversineKm(a, b);
    expect(km).not.toBeNull();
    expect(km!).toBeLessThan(0.001);
  });

  it("거리가 멀수록 이동 시간 추정이 커진다", () => {
    const t1 = estimateTravelMinutesFromKm(1, "drive");
    const t2 = estimateTravelMinutesFromKm(5, "drive");
    expect(t2).toBeGreaterThan(t1);
    expect(t1).toBeGreaterThanOrEqual(0);
  });

  it("computeRouteMetrics: hop(leg) 개수와 pathKm 합산이 일치한다", () => {
    const p1 = { lat: BASE.lat, lng: BASE.lng };
    const p2 = { lat: BASE.lat + 0.01, lng: BASE.lng };
    const p3 = { lat: BASE.lat + 0.02, lng: BASE.lng };
    const m = computeRouteMetrics([
      { id: "a", name: "a", ...p1 },
      { id: "b", name: "b", ...p2 },
      { id: "c", name: "c", ...p3 },
    ]);
    expect(m.legs).toHaveLength(2);
    const sumLegs = m.legs.reduce((s, l) => s + l.distanceKm, 0);
    expect(m.pathKm).toBeCloseTo(sumLegs, 5);
    expect(m.travelMinutesTotal).toBeGreaterThan(0);
    expect(m.directKm).not.toBeNull();
    expect(m.legs[0]!.fromIndex).toBe(0);
    expect(m.legs[1]!.toIndex).toBe(2);
  });
});
