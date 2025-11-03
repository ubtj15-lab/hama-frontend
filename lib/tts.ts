// src/lib/tts.ts
export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  lang?: string;
  voiceName?: string;
  interrupt?: boolean;
};

let selectedVoice: SpeechSynthesisVoice | null = null;

export function initVoices(params?: {
  lang?: string;
  preferNames?: string[];
}): Promise<void> {
  const lang = params?.lang ?? "ko-KR";
  const preferNames = params?.preferNames ?? [
    "Google 한국의",
    "Korean",
    "ko-KR",
    "Korean (KR)",
  ];

  return new Promise((resolve) => {
    const synth = window.speechSynthesis;

    const choose = () => {
      const voices = synth.getVoices();
      if (!voices || voices.length === 0) return;

      // 한국어 우선
      const ko = voices.filter(
        (v) => (v.lang || "").toLowerCase().startsWith("ko")
      );

      // 선호 이름 우선
      const byName =
        ko.find((v) => preferNames.some((n) => v.name.includes(n))) ||
        ko[0] ||
        voices[0];

      selectedVoice = byName || null;
      resolve();
    };

    if (synth.getVoices().length > 0) {
      // 이미 로드됨
      choose();
    } else {
      // 로드 대기
      const handler = () => {
        choose();
        synth.removeEventListener("voiceschanged", handler);
      };
      synth.addEventListener("voiceschanged", handler);

      // 일부 브라우저 깨움
      synth.getVoices();
    }
  });
}

export function speak(text: string, opts: SpeakOptions = {}) {
  const s = window.speechSynthesis;
  if (opts.interrupt) s.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang ?? (selectedVoice?.lang || "ko-KR");
  if (selectedVoice) u.voice = selectedVoice;
  if (opts.rate) u.rate = opts.rate;
  if (opts.pitch) u.pitch = opts.pitch;

  s.speak(u);
  return u;
}

export function stopSpeak() {
  window.speechSynthesis.cancel();
}
