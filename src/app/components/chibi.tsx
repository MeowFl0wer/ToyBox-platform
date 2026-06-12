import type { ThemePalette } from "../theme";

export interface DoodleProps {
  palette: ThemePalette;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * 一组原创的低饱和日系 q 版小插画（SVG）。
 * 造型借鉴了奇幻冒险游戏的轻盈质感（精灵 / 水晶 / 史莱姆等），
 * 全部为通用原创设计，不含任何具体 IP 角色。
 * 颜色取自当前主题色板，会随配色切换。
 */

export function SleepingCat({ palette, className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 80" className={className} style={style} fill="none">
      {/* tail */}
      <path d="M22 56 q-14 -2 -10 -18 q2 -8 9 -7" stroke={palette.secondary} strokeWidth="6" strokeLinecap="round" />
      {/* body */}
      <ellipse cx="62" cy="56" rx="44" ry="18" fill={palette.softAlt} stroke={palette.secondary} strokeWidth="3" />
      {/* head */}
      <circle cx="92" cy="46" r="16" fill={palette.soft} stroke={palette.secondary} strokeWidth="3" />
      {/* ears */}
      <path d="M80 36 l-2 -12 l11 6 z" fill={palette.soft} stroke={palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      <path d="M98 34 l8 -9 l3 12 z" fill={palette.soft} stroke={palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      {/* sleepy eyes */}
      <path d="M84 46 q3 3 6 0" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M94 46 q3 3 6 0" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      {/* blush */}
      <circle cx="86" cy="51" r="2.5" fill={palette.coral} opacity="0.5" />
      <circle cx="99" cy="51" r="2.5" fill={palette.coral} opacity="0.5" />
      {/* zZ */}
      <text x="104" y="26" fontSize="11" fontWeight="900" fill={palette.muted}>z</text>
      <text x="111" y="18" fontSize="8" fontWeight="900" fill={palette.muted}>z</text>
    </svg>
  );
}

export function SmilingCloud({ palette, className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 120 80" className={className} style={style} fill="none">
      <path
        d="M30 58 q-18 0 -18 -16 q0 -14 16 -13 q4 -16 22 -14 q14 1 17 14 q16 -2 17 13 q0 16 -18 16 z"
        fill="#FFFFFF"
        stroke={palette.primary}
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <circle cx="42" cy="40" r="2.5" fill={palette.muted} />
      <circle cx="62" cy="40" r="2.5" fill={palette.muted} />
      <path d="M46 47 q6 6 12 0" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="38" cy="46" r="2.5" fill={palette.coral} opacity="0.45" />
      <circle cx="66" cy="46" r="2.5" fill={palette.coral} opacity="0.45" />
    </svg>
  );
}

export function StarBuddy({ palette, className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 60 60" className={className} style={style} fill="none">
      <path
        d="M30 6 l6.5 14 15.5 1.5 -11.8 10.2 3.7 15.3 -13.9 -8 -13.9 8 3.7 -15.3 -11.8 -10.2 15.5 -1.5 z"
        fill={palette.lime}
        stroke={palette.primaryDark}
        strokeWidth="2.5"
        strokeLinejoin="round"
        opacity="0.9"
      />
      <circle cx="25" cy="28" r="2" fill={palette.ink} />
      <circle cx="35" cy="28" r="2" fill={palette.ink} />
      <path d="M26 33 q4 4 8 0" stroke={palette.ink} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function TeaCup({ palette, className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 80 80" className={className} style={style} fill="none">
      {/* steam */}
      <path d="M34 20 q-5 -6 0 -12" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 20 q5 -6 0 -12" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      {/* cup */}
      <path d="M18 30 h44 v14 q0 16 -22 16 q-22 0 -22 -16 z" fill={palette.soft} stroke={palette.primaryDark} strokeWidth="3" strokeLinejoin="round" />
      {/* handle */}
      <path d="M62 34 q14 1 12 12 q-2 8 -12 7" stroke={palette.primaryDark} strokeWidth="3" strokeLinecap="round" />
      {/* face */}
      <circle cx="32" cy="44" r="2.5" fill={palette.muted} />
      <circle cx="48" cy="44" r="2.5" fill={palette.muted} />
      <path d="M35 50 q5 5 10 0" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="49" r="2.5" fill={palette.coral} opacity="0.45" />
      <circle cx="52" cy="49" r="2.5" fill={palette.coral} opacity="0.45" />
    </svg>
  );
}

export function Mushroom({ palette, className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 60 70" className={className} style={style} fill="none">
      <path d="M8 30 q0 -22 22 -22 q22 0 22 22 z" fill={palette.coral} stroke={palette.primaryDark} strokeWidth="2.5" strokeLinejoin="round" opacity="0.85" />
      <circle cx="20" cy="20" r="3" fill="#FFFFFF" opacity="0.85" />
      <circle cx="38" cy="16" r="2.5" fill="#FFFFFF" opacity="0.85" />
      <circle cx="32" cy="25" r="2" fill="#FFFFFF" opacity="0.85" />
      <path d="M18 30 h24 v18 q0 12 -12 12 q-12 0 -12 -12 z" fill={palette.softAlt} stroke={palette.primaryDark} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="25" cy="44" r="2" fill={palette.muted} />
      <circle cx="35" cy="44" r="2" fill={palette.muted} />
      <path d="M27 49 q3 3 6 0" stroke={palette.muted} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** 漂浮的小精灵 —— 奇幻轻盈感（原创通用造型） */
export function Wisp({ palette, className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 70 80" className={className} style={style} fill="none">
      {/* halo glow */}
      <circle cx="35" cy="44" r="26" fill={palette.lime} opacity="0.22" />
      {/* wings */}
      <path d="M16 42 q-12 -8 -4 -18 q9 4 11 16 z" fill={palette.soft} stroke={palette.primary} strokeWidth="2.5" strokeLinejoin="round" opacity="0.9" />
      <path d="M54 42 q12 -8 4 -18 q-9 4 -11 16 z" fill={palette.soft} stroke={palette.primary} strokeWidth="2.5" strokeLinejoin="round" opacity="0.9" />
      {/* teardrop body */}
      <path d="M35 20 q16 16 16 28 a16 16 0 0 1 -32 0 q0 -12 16 -28 z" fill={palette.softAlt} stroke={palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      {/* face */}
      <path d="M27 46 q3 3 6 0" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M38 46 q3 3 6 0" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="29" cy="52" r="2.5" fill={palette.coral} opacity="0.5" />
      <circle cx="42" cy="52" r="2.5" fill={palette.coral} opacity="0.5" />
      {/* sparkle */}
      <path d="M35 8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" fill={palette.lime} opacity="0.9" />
    </svg>
  );
}

/** 元素小水晶簇 —— 奇幻冒险感（原创通用造型） */
export function Crystal({ palette, className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 70 80" className={className} style={style} fill="none">
      {/* glow */}
      <ellipse cx="35" cy="58" rx="26" ry="8" fill={palette.primary} opacity="0.18" />
      {/* small left crystal */}
      <path d="M16 60 l4 -20 8 4 -2 18 z" fill={palette.soft} stroke={palette.primaryDark} strokeWidth="2.5" strokeLinejoin="round" />
      {/* small right crystal */}
      <path d="M54 60 l-4 -22 -8 6 2 18 z" fill={palette.soft} stroke={palette.primaryDark} strokeWidth="2.5" strokeLinejoin="round" />
      {/* main crystal */}
      <path d="M35 14 l11 16 -4 28 -14 0 -4 -28 z" fill={palette.softAlt} stroke={palette.primaryDark} strokeWidth="3" strokeLinejoin="round" />
      {/* facet lines */}
      <path d="M35 14 l0 44 M24 30 h22" stroke={palette.primaryDark} strokeWidth="2" opacity="0.6" />
      {/* shine */}
      <path d="M38 22 l3 6 -3 2 z" fill="#FFFFFF" opacity="0.7" />
    </svg>
  );
}

/** q 版史莱姆 —— 通用软糖造型（原创设计） */
export function Slime({ palette, className, style }: DoodleProps) {
  return (
    <svg viewBox="0 0 90 70" className={className} style={style} fill="none">
      {/* shadow */}
      <ellipse cx="45" cy="62" rx="30" ry="5" fill={palette.muted} opacity="0.18" />
      {/* body */}
      <path d="M12 58 q-2 -42 33 -42 q35 0 33 42 q-33 6 -66 0 z" fill={palette.softAlt} stroke={palette.secondary} strokeWidth="3" strokeLinejoin="round" />
      {/* drip */}
      <circle cx="68" cy="22" r="4" fill={palette.softAlt} stroke={palette.secondary} strokeWidth="2.5" />
      {/* highlight */}
      <ellipse cx="30" cy="30" rx="6" ry="9" fill="#FFFFFF" opacity="0.55" transform="rotate(-18 30 30)" />
      {/* face */}
      <circle cx="34" cy="40" r="3" fill={palette.muted} />
      <circle cx="54" cy="40" r="3" fill={palette.muted} />
      <path d="M38 48 q6 6 12 0" stroke={palette.muted} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="47" r="3" fill={palette.coral} opacity="0.45" />
      <circle cx="60" cy="47" r="3" fill={palette.coral} opacity="0.45" />
    </svg>
  );
}
