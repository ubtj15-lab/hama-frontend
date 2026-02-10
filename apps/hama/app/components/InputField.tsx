import React from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
};

const styles: Record<string, React.CSSProperties> = {
  input: {
    width: "100%",
    height: 57,
    padding: "0 16px",
    border: "1px solid #ececec",
    borderRadius: 9999,
    boxSizing: "border-box",
    backgroundColor: "#ffffff",
    color: "#0f172a",
    fontSize: 15,
    fontFamily: "Noto Sans KR, Inter, system-ui, sans-serif",
    textAlign: "center",
    outline: "none",
    boxShadow: "0 6px 14px rgba(0,0,0,0.06)",
  },
};

const InputField: React.FC<Props> = ({ value, onChange, placeholder }) => {
  return (
    <input
      style={styles.input}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};

export default InputField;
