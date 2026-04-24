import React, { useState } from "react";

type TouchableProps = React.HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
};

export function Touchable({ children, style, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, ...rest }: TouchableProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <div
      {...rest}
      onPointerDown={(e) => {
        setPressed(true);
        onPointerDown?.(e);
      }}
      onPointerUp={(e) => {
        setPressed(false);
        onPointerUp?.(e);
      }}
      onPointerCancel={(e) => {
        setPressed(false);
        onPointerCancel?.(e);
      }}
      onPointerLeave={(e) => {
        setPressed(false);
        onPointerLeave?.(e);
      }}
      style={{
        transition: "transform 100ms ease, opacity 100ms ease",
        transform: pressed ? "scale(0.97)" : "scale(1)",
        opacity: pressed ? 0.85 : 1,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
