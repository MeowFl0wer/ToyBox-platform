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
}

/**
 * 纯装饰用的插画层：绝对定位铺满父容器（父容器需 position: relative）。
 * 整层 pointer-events: none、z-0 居于内容之下，不会拦截任何点击，不影响交互。
 */
export function DoodleLayer({ palette, doodles, extra, className = "hidden md:block" }: DoodleLayerProps) {
  return (
    <div className={`pointer-events-none absolute inset-0 z-0 overflow-hidden ${className}`} aria-hidden>
      {extra}
      {doodles.map((spec) => {
        const Comp = REGISTRY[spec.type];
        return (
          <div
            key={spec.id}
            style={{
              position: "absolute",
              left: `${spec.xPct}%`,
              top: `${spec.yPct}%`,
              width: `${spec.w}px`,
              opacity: spec.opacity,
              transform: `translate(-50%, -50%) rotate(${spec.rotate ?? 0}deg)`,
            }}
          >
            <Comp palette={palette} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
        );
      })}
    </div>
  );
}
