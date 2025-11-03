// 간단 TTS 유틸 (ko-KR 우선)
export type SpeakOptions = {
  rate?: number;
  pitch?: number;
  lang?: string;
  voiceName?: string;
  interrupt?: boolean;
};

let selectedVoice: SpeechSynthesisVoice | null = null;

export function initVoices(params?: { lang?: string; preferNames?: string[] }) {
  const lang = params?.lang ?? "ko-KR";
  const preferNames = params?.preferNames ?? [
    "Google 한국의",
    "Korean",
    "ko-KR",
    "Korean (KR)",
  ];

  return new Promise<void>((resolve) => {
    const synth = window.speechSynthesis;

    const choose = () => {
      const voices = synth.getVoices();
      if (!voices || voices.length === 0) return;

      const ko = voices.filter((v) => (v.lang || "").toLowerCase().startsWith("ko"));
      const byName =
        ko.find((v) => preferNames.some((n) => v.name.includes(n))) ||
        ko[0] ||
        voices[0];

      selectedVoice = byName || null;
      resolve();
    };

    if (synth.getVoices().length > 0) {
      choose();
    } else {
      const handler = () => {
        choose();
        synth.removeEventListener("voiceschanged", handler);
      };
      synth.addEventListener("voiceschanged", handler);
      // 일부 브라우저는 이걸 호출해야 목록이 채워짐
      synth.getVoices();
    }
  });
}

export function speak(text: string, opts: SpeakOptions = {}) {
  const s = window.speechSynthesis;
  if (opts.interrupt !== false) s.cancel();

  const u = new SpeechSynthesisUtterance(text);
  u.lang = opts.lang ?? selectedVoice?.lang ?? "ko-KR";
  if (selectedVoice) u.voice = selectedVoice;
  if (opts.rate) u.rate = opts.rate;
  if (opts.pitch) u.pitch = opts.pitch;

  s.speak(u);
  return u;
}

export function stopSpeak() {
  try {
    window.speechSynthesis.cancel();
  } catch {}
}
