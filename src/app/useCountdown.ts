import { useEffect, useState } from "react";

/** 简易倒计时：用于验证码「重新发送」按钮的 60 秒冷却。
 *  返回剩余秒数 left 与启动函数 start（默认 60 秒）。 */
export function useCountdown(): { left: number; start: (seconds?: number) => void } {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft((n) => Math.max(0, n - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [left]);
  return { left, start: (seconds = 60) => setLeft(seconds) };
}
