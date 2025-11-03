// /app/lib/tts.ts
let voicesCache: SpeechSynthesisVoice[] | null = null;

function getVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (voicesCache && voicesCache.length) return resolve(voicesCache);
    const synth = window.speechSynthesis;

    const done = () => {
      voicesCache = synth.getVoices();
      resolve(voicesCache);
    };

    // 이미 로드됨
    const current = synth.getVoices();
    if (current && current.length) {
      voicesCache = current;
      return resolve(current);
    }

    // 로드 이벤트 대기
    window.speechSynthesis.onvoiceschanged = () => {
      done();
      // 한번 받아오면 이벤트 제거
      window.speechSynthesis.onvoiceschanged = null;
    };
    // 혹시 몰라서 살짝 트리거
    synth.getVoices();
    // 1초 타임아웃 (일부 브라우저에서 이벤트가 늦는 경우)
    setTimeout(done, 1000);
  });
}

/** 텍스트를 한국어로 읽어줌 */
export async function speak(
  text: string,
  opts?: { lang?: string; rate?: number; pitch?: number; volume?: number }
) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!("speechSynthesis" in window)) return;

  // 이전 발화 중지
  if (synth.speaking) synth.cancel();

  const voices = await getVoices();
  const lang = opts?.lang ?? "ko-KR";
  const voice =
    voices.find((v) => v.lang?.toLowerCase().includes("ko")) ||
    voices.find((v) => v.lang?.toLowerCase().includes(lang.toLowerCase())) ||
    null;

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  if (voice) utter.voice = voice;
  if (opts?.rate) utter.rate = opts.rate;
  if (opts?.pitch) utter.pitch = opts.pitch;
  if (opts?.volume !== undefined) utter.volume = opts.volume;

  synth.speak(utter);
}

/** 안전하게 말하기 중단 */
export function stopSpeak() {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (synth.speaking) synth.cancel();
}
