"use client";

import MicButton from "./MicButton";

export default function FloatingMic() {
  return (
    <div
      style={{
        position: "fixed",
        right: 18,
        bottom: 18,
        zIndex: 9999,
      }}
    >
      <MicButton />
    </div>
  );
}
