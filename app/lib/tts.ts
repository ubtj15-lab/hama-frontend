// app/lib/tts.ts
export default function tts(text: string) {
  try {
    window.speechSynthesis?.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    window.speechSynthesis?.speak(u);
  } catch (e) {
    console.warn("TTS error:", e);
  }
}
