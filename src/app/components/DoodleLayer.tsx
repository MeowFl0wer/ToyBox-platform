import { motion, useReducedMotion } from "motion/react";
import type { ThemePalette } from "../theme";
import {
  SleepingCat,
  SmilingCloud,
  StarBuddy,
  TeaCup,
  Mushroom,
  Wisp,
  Crystal,
  Slime,
  type DoodleProps,
} from "./chibi";

export type DoodleType =
  | "SleepingCat"
  | "SmilingCloud"
  | "StarBuddy"
  | "TeaCup"
  | "Mushroom"
  | "Wisp"
  | "Crystal"
  | "Slime";

/** 单个插画的摆放配置：坐标用容器百分比，响应式缩放下相对位置不变 */
export interface DoodleSpec {
  id: string;
  type: DoodleType;
  /** 中心点横坐标（占容器宽度 %） */
  xPct: number;
  /** 中心点纵坐标（占容器高度 %） */
  yPct: number;
  /** 宽度（px），高度按插画比例自适应 */
  w: number;
  opacity: number;
  /** 旋转角度（deg） */
  rotate?: number;
  /** 是否持续上下浮动 */
  float?: boolean;
}

const REGISTRY: Record<DoodleType, React.FC<DoodleProps>> = {
  SleepingCat,
  SmilingCloud,
  StarBuddy,
  TeaCup,
  Mushroom,
  Wisp,
  Crystal,
  Slime,
};

interface DoodleLayerProps {
  palette: ThemePalette;
  /** 插画摆放配置 */
  doodles: DoodleSpec[];
  /** 非插画的静态装饰（柔光色斑、徽章等） */
  extra?: React.ReactNode;
  /** 装饰层的响应式显隐，默认在 md 以下隐藏 */
  className?: string;
  /** 页面加载时让插画随内容一起淡入上浮 */
  animateIn?: boolean;
}

/**
 * 纯装饰用的插画层：绝对定位铺满父容器（父容器需 position: relative）。
 * 整层 pointer-events: none、z-0 居于内容之下，不会拦截任何点击，不影响交互。
 */
export function DoodleLayer({
  palette,
  doodles,
  extra,
  className = "hidden md:block",
  animateIn = false,
}: DoodleLayerProps) {
  const reduce = useReducedMotion();
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`} aria-hidden>
      {extra}
      {doodles.map((spec, i) => {
        const Comp = REGISTRY[spec.type];
        const svg = <Comp palette={palette} style={{ width: "100%", height: "auto", display: "block" }} />;

        // 持续上下浮动（各自错开节奏）；开启入场时，等淡入上浮结束后再开始
        const inner =
          spec.float && !reduce ? (
            <motion.div
              style={{ width: "100%" }}
              animate={{ y: [0, -9, 0] }}
              transition={{
                duration: 3.6 + (i % 3) * 0.7,
                delay: (animateIn ? 1.2 : 0) + (i % 4) * 0.4,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              {svg}
            </motion.div>
          ) : (
            svg
          );

        return (
          <div
            key={spec.id}
            style={{
              position: "absolute",
              left: `${spec.xPct}%`,
              top: `${spec.yPct}%`,
              width: `${spec.w}px`,
              transform: `translate(-50%, -50%) rotate(${spec.rotate ?? 0}deg)`,
            }}
          >
            {animateIn && !reduce ? (
              // 页面加载时随文字一起淡入上浮
              <motion.div
                style={{ width: "100%" }}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: spec.opacity, y: 0 }}
                transition={{ duration: 1.05, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
              >
                {inner}
              </motion.div>
            ) : (
              <div style={{ width: "100%", opacity: spec.opacity }}>{inner}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
