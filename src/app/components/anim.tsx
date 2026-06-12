import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import confetti from "canvas-confetti";
import type { ThemePalette } from "../theme";

const EASE = [0.22, 1, 0.36, 1] as const;

interface RevealProps {
  children: React.ReactNode;
  /** 延迟（秒），用于错峰 */
  delay?: number;
  /** 初始下移距离（px） */
  y?: number;
  /** true：进场即播；false：滚动进入视口再播 */
  immediate?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/** 渐显上浮包裹层。系统开启「减少动态」时自动降级为无动画。 */
export function Reveal({ children, delay = 0, y = 18, immediate = false, className, style }: RevealProps) {
  const reduce = useReducedMotion();
  if (reduce) {
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  }
  const shared = {
    className,
    style,
    initial: { opacity: 0, y },
    transition: { duration: 1.05, delay, ease: EASE },
  };
  return immediate ? (
    <motion.div {...shared} animate={{ opacity: 1, y: 0 }}>
      {children}
    </motion.div>
  ) : (
    <motion.div {...shared} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }}>
      {children}
    </motion.div>
  );
}

interface CountUpProps {
  to: number;
  /** 时长（毫秒） */
  duration?: number;
  className?: string;
  style?: React.CSSProperties;
}

/** 数字从 0 滚动到目标值（进入视口时触发，easeOutCubic）。 */
export function CountUp({ to, duration = 1100, className, style }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVal(to);
      return;
    }
    let raf = 0;
    let start = 0;
    let started = false;
    const run = (t: number) => {
      if (!start) start = t;
      const p = Math.min((t - start) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - p, 3)) * to));
      if (p < 1) raf = requestAnimationFrame(run);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !started) {
          started = true;
          raf = requestAnimationFrame(run);
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);

  return (
    <span ref={ref} className={className} style={style}>
      {val}
    </span>
  );
}

/** 撒花庆祝。颜色取自当前主题；「减少动态」时自动跳过。 */
export function fireConfetti(palette?: ThemePalette) {
  if (typeof window === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const colors = palette
    ? [palette.primary, palette.secondary, palette.purple, palette.lime, palette.coral]
    : ["#38BDF8", "#2DD4BF", "#8B5CF6", "#B9F36B", "#EF8A68"];
  const base = {
    spread: 72,
    startVelocity: 38,
    ticks: 200,
    colors,
    disableForReducedMotion: true,
    zIndex: 10000,
  };
  confetti({ ...base, particleCount: 70, origin: { x: 0.5, y: 0.62 } });
  confetti({ ...base, particleCount: 28, angle: 60, origin: { x: 0, y: 0.7 } });
  confetti({ ...base, particleCount: 28, angle: 120, origin: { x: 1, y: 0.7 } });
}
