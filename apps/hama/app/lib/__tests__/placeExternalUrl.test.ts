import { afterEach, describe, expect, it, vi } from "vitest";
import type { HomeCard } from "@/lib/storeTypes";
import {
  directExternalPlaceUrl,
  kakaoPlaceButtonLabel,
  naverPlaceButtonLabel,
  resolveKakaoPlaceLink,
  resolveNaverPlaceLink,
} from "@/lib/placeExternalUrl";
import { openKakaoPlace } from "@/lib/openKakaoPlace";
import { openNaverPlace } from "@/lib/openNaverPlace";
import { openPlace } from "@/lib/openPlace";
import { openDirections } from "@/lib/openDirections";
import { buildKakaoDirectionsUrl, buildKakaoPlaceUrl, buildNaverPlaceUrl } from "@/lib/placeLinks";

const store = {
  name: "두부마을",
  address: "경기도 오산시 동부대로568번길 21",
};

const kakaoSearch = `https://map.kakao.com/?q=${encodeURIComponent(`${store.name} ${store.address}`)}`;
const naverSearch = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(`${store.name} ${store.address}`)}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("place external links", () => {
  it("does not open a naver url stored in the kakao field", () => {
    const link = resolveKakaoPlaceLink({
      ...store,
      kakao_place_url: "https://m.place.naver.com/restaurant/123/home",
      naver_place_url: "https://m.place.naver.com/restaurant/123/home",
    });
    expect(link).toEqual({ url: kakaoSearch, mode: "search" });
    expect(link?.url).not.toContain("naver");
    expect(kakaoPlaceButtonLabel(link)).toBe("카카오맵에서 검색");
    expect(buildKakaoPlaceUrl({ ...store, kakao_place_url: "https://naver.me/abc" } as HomeCard)).toBeNull();
  });

  it("keeps an official kakao short url", () => {
    const url = "https://kko.to/KGbHH6cvOu";
    const link = resolveKakaoPlaceLink({ ...store, kakao_place_url: url });
    expect(link).toEqual({ url, mode: "direct" });
    expect(kakaoPlaceButtonLabel(link)).toBe("카카오맵에서 보기");
    expect(buildKakaoPlaceUrl({ kakao_place_url: url } as HomeCard)).toBe(url);
  });

  it("upgrades an official http kakao place url to https", () => {
    const link = resolveKakaoPlaceLink({
      ...store,
      kakao_place_url: "http://place.map.kakao.com/26338954",
    });
    expect(link).toEqual({ url: "https://place.map.kakao.com/26338954", mode: "direct" });
  });

  it("searches kakao map when the kakao url is empty", () => {
    expect(resolveKakaoPlaceLink({ ...store, kakao_place_url: "  " })).toEqual({
      url: kakaoSearch,
      mode: "search",
    });
  });

  it("searches naver by name and address when the place id is empty", () => {
    const link = resolveNaverPlaceLink({ ...store, naver_place_id: "", naver_place_url: null });
    expect(link).toEqual({ url: naverSearch, mode: "search" });
    expect(naverPlaceButtonLabel(link)).toBe("네이버에서 검색");
    expect(buildNaverPlaceUrl(store as HomeCard)).toBeNull();
  });

  it("uses a valid naver url before a place id", () => {
    const url = "https://m.place.naver.com/restaurant/123/home";
    const link = resolveNaverPlaceLink({
      ...store,
      naver_place_url: url,
      naver_place_id: "999",
    });
    expect(link).toEqual({ url, mode: "direct" });
    expect(naverPlaceButtonLabel(link)).toBe("네이버에서 보기");
  });

  it("uses a safe naver place id when the stored url is not naver", () => {
    const link = resolveNaverPlaceLink({
      ...store,
      naver_place_url: "https://evil.example/place",
      naver_place_id: "12345678",
    });
    expect(link).toEqual({ url: "https://m.place.naver.com/place/12345678", mode: "direct" });
  });

  it("rejects lookalike hosts, userinfo, and protocol tricks without matching the url text", () => {
    const tricks = [
      "https://evil.example/map.kakao.com",
      "https://evil.example/?next=https://naver.me/abc",
      "https://evilnaver.me/place",
      "https://naver.me.evil.example/x",
      "https://kko.to.evil.example/abc",
      "https://notkko.to/abc",
      "https://map.kakao.com.evil.example/x",
      "https://place.map.kakao.com.evil.example/1",
      "https://map.kakao.com@evil.example/phish",
      "https://evil.example@map.kakao.com/1",
      "https://user:pass@kko.to/abc",
      "https://map.kakao.com:4443/phish",
      "javascript:https://map.kakao.com/?q=1",
      "data:text/html,https://map.kakao.com",
      "vbscript:msgbox(1)",
      "ftp://map.kakao.com/place",
      "http://evil.example/place",
      "http://map.kakao.com.evil.example/1",
      "kakaomap://route?ep=1,2",
      "https://map.kakao.com%00.evil.example/x",
      "https://map.kakao.com%2e.evil.example/x",
    ];
    for (const kakao_place_url of tricks) {
      const kakao = resolveKakaoPlaceLink({ ...store, kakao_place_url });
      expect(kakao).toEqual({ url: kakaoSearch, mode: "search" });
      expect(new URL(kakao!.url).hostname).toBe("map.kakao.com");
      const naver = resolveNaverPlaceLink({
        ...store,
        naver_place_url: kakao_place_url,
        naver_place_id: "javascript",
      });
      expect(naver).toEqual({ url: naverSearch, mode: "search" });
      expect(new URL(naver!.url).hostname).toBe("m.search.naver.com");
    }
  });

  it("rejects malicious or wrong-domain urls", () => {
    const bad = [
      "javascript:alert(1)",
      "javascript:https://map.kakao.com/?q=1",
      "data:text/html,hi",
      "https://evil.example/kakao",
      "https://map.kakao.com.evil.example/x",
      "https://naver.me.evil.example/x",
      "https://user:pass@kko.to/abc",
      "http://evil.example/place",
      "https://m.place.naver.com/place/1",
    ];
    for (const kakao_place_url of bad) {
      const link = resolveKakaoPlaceLink({ ...store, kakao_place_url });
      expect(link?.mode).toBe("search");
      expect(link?.url).toBe(kakaoSearch);
    }
    expect(
      resolveNaverPlaceLink({
        ...store,
        naver_place_url: "javascript:alert(1)",
        naver_place_id: "../admin",
      })
    ).toEqual({ url: naverSearch, mode: "search" });
  });

  it("searches with whichever of name or address is present", () => {
    expect(resolveKakaoPlaceLink({ name: "두부마을", kakao_place_url: "" })?.url).toBe(
      `https://map.kakao.com/?q=${encodeURIComponent("두부마을")}`
    );
    expect(resolveNaverPlaceLink({ address: "경기도 오산시", naver_place_id: null })?.url).toBe(
      `https://m.search.naver.com/search.naver?query=${encodeURIComponent("경기도 오산시")}`
    );
    expect(resolveKakaoPlaceLink({ kakao_place_url: "https://naver.me/abc" })).toBeNull();
    expect(resolveNaverPlaceLink({ naver_place_url: "https://evil.example", naver_place_id: " " })).toBeNull();
  });

  it("does not treat a search result as a confirmed place on card click", () => {
    expect(
      directExternalPlaceUrl({
        ...store,
        kakao_place_url: "https://naver.me/abc",
      })
    ).toBeNull();
    expect(
      directExternalPlaceUrl({
        ...store,
        kakao_place_url: "https://naver.me/abc",
        naver_place_url: "https://naver.me/abc",
      })
    ).toBe("https://naver.me/abc");
  });

  it("opens the kakao search instead of the naver url stored on the kakao field", () => {
    const opened: string[] = [];
    vi.stubGlobal("window", {
      open: (url: string) => {
        opened.push(url);
        return null;
      },
    });
    openKakaoPlace({
      ...store,
      kakaoPlaceUrl: "https://naver.me/abc",
    });
    openPlace(
      {
        ...store,
        kakao_place_url: "https://naver.me/abc",
        naver_place_url: "https://m.place.naver.com/restaurant/123/home",
      },
      "naver"
    );
    openNaverPlace({ name: store.name, address: store.address, naverPlaceId: null });
    expect(opened).toEqual([
      kakaoSearch,
      "https://m.place.naver.com/restaurant/123/home",
      naverSearch,
    ]);
  });

  it("keeps place detail, search, recommendation, conversation, and map directions on their own urls", () => {
    const opened: string[] = [];
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (Windows NT 10.0)" });
    vi.stubGlobal("window", {
      open: (url: string) => {
        opened.push(url);
        return null;
      },
    });
    const card = {
      id: "1",
      name: "두부마을",
      category: "restaurant",
      address: store.address,
      lat: 37.15836,
      lng: 127.08309,
      kakao_place_url: "https://naver.me/abc",
      naver_place_url: "https://m.place.naver.com/restaurant/123/home",
    } as HomeCard;

    openPlace(card, "kakao");
    openPlace(card, "naver");
    expect(directExternalPlaceUrl(card)).toBe("https://m.place.naver.com/restaurant/123/home");
    expect(directExternalPlaceUrl({ ...card, naver_place_url: null, kakao_place_url: "https://naver.me/abc" })).toBeNull();

    openDirections({ name: card.name, lat: card.lat, lng: card.lng });
    const directions = opened[2]!;
    expect(new URL(directions).hostname).toBe("map.kakao.com");
    expect(new URL(directions).pathname).toBe(`/link/to/${encodeURIComponent(card.name)},37.15836,127.08309`);
    expect(directions).not.toContain("naver");

    expect(opened.map((url) => new URL(url).hostname)).toEqual([
      "map.kakao.com",
      "m.place.naver.com",
      "map.kakao.com",
    ]);
    expect(kakaoPlaceButtonLabel(resolveKakaoPlaceLink(card))).toBe("카카오맵에서 검색");
    expect(naverPlaceButtonLabel(resolveNaverPlaceLink(card))).toBe("네이버에서 보기");
  });

  it("keeps coordinate directions independent of stored place urls", () => {
    const card = {
      id: "1",
      name: "두부마을",
      category: "restaurant",
      lat: 37.15836,
      lng: 127.08309,
      kakao_place_url: "https://naver.me/abc",
    } as HomeCard;
    expect(buildKakaoDirectionsUrl(card)).toBe(
      `https://map.kakao.com/link/to/${encodeURIComponent("두부마을")},37.15836,127.08309`
    );
  });
});
