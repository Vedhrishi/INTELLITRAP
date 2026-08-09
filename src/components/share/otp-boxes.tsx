import { useRef } from "react";
import { motion } from "framer-motion";

export function OtpBoxes({
  values,
  onChange,
  onComplete,
  shake,
  error,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  onComplete: (code: string) => void;
  shake: boolean;
  error: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...values];
    next[index] = digit;
    onChange(next);
    if (digit && index < 5) {
      refs.current[index + 1]?.focus();
    }
    if (next.every((value) => value !== "") && next.join("").length === 6) {
      onComplete(next.join(""));
    }
  };

  const onKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace" && !values[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <motion.div
      animate={shake ? { x: [0, 12, -12, 12, -12, 6, -6, 0] } : {}}
      transition={{ duration: 0.5 }}
      className="flex justify-center gap-2"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={values[index] ?? ""}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => onKeyDown(index, event)}
          inputMode="numeric"
          maxLength={1}
          className={
            error
              ? "h-12 w-10 rounded-lg border-2 border-red-500 bg-[#1e293b] text-center font-mono text-xl text-white outline-none"
              : "h-12 w-10 rounded-lg border-2 border-[#334155] bg-[#1e293b] text-center font-mono text-xl text-white outline-none focus:border-amber-500"
          }
        />
      ))}
    </motion.div>
  );
}
