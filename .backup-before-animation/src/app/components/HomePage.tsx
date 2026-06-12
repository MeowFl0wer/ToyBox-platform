import { ArrowRight, Bell, ChevronRight, Clock, Sparkles, Star, Zap } from "lucide-react";
import { themePalettes, type ThemePalette } from "../theme";
import { DoodleLayer, type DoodleSpec } from "./DoodleLayer";

// q 版插画在首页 Hero 的布局
const HOME_DOODLES: DoodleSpec[] = [
  { id: "cloud", type: "SmilingCloud", xPct: 15, yPct: 20.8, w: 96, opacity: 0.7 },
  { id: "teacup", type: "TeaCup", xPct: 91.2, yPct: 52.1, w: 64, opacity: 0.6 },
  { id: "star", type: "StarBuddy", xPct: 57, yPct: 18.6, w: 38, opacity: 0.52, rotate: 36 },
  { id: "crystal", type: "Crystal", xPct: 95.5, yPct: 96.1, w: 80, opacity: 0.7 },
  { id: "slime", type: "Slime", xPct: 76.8, yPct: 68.7, w: 80, opacity: 0.7 },
  { id: "cat", type: "SleepingCat", xPct: 6, yPct: 70.8, w: 44, opacity: 0.52 },
  { id: "mushroom", type: "Mushroom", xPct: 92.7, yPct: 97.1, w: 30, opacity: 0.28, rotate: -17 },
];

interface HomePageProps {
  onNavigate: (page: string) => void;
  palette: ThemePalette;
  activePaletteId: string;
  onPaletteChange: (paletteId: string) => void;
}

const getQuickFeatures = (palette: ThemePalette) => [
  { emoji: "🎲", name: "随机选择器", desc: "纠结时轻轻一摇", bg: palette.cardTint, color: palette.primaryDark },
  { emoji: "💡", name: "灵感生成器", desc: "把脑洞先收起来", bg: palette.softAlt, color: palette.primaryDark },
  { emoji: "⏱️", name: "番茄计时器", desc: "留一段安静专注", bg: palette.soft, color: palette.accent },
  { emoji: "🗺️", name: "地图足迹", desc: "慢慢点亮去过的地方", bg: `${palette.coral}22`, color: palette.coral },
];

const getComingSoonFeatures = (palette: ThemePalette) => [
  { emoji: "🎮", name: "像素小游戏", desc: "轻松放松一下", tag: "娱乐", color: palette.purple, bg: `${palette.purple}18` },
  { emoji: "📝", name: "随手记录", desc: "把灵感先记住", tag: "工具", color: palette.secondary, bg: palette.softAlt },
  { emoji: "🎨", name: "调色板生成", desc: "做一组好看配色", tag: "创意", color: palette.coral, bg: `${palette.coral}18` },
  { emoji: "🌤️", name: "天气诗歌", desc: "给天气加点想象", tag: "实验", color: palette.primaryDark, bg: palette.soft },
];

const updates = [
  { date: "2026-06-12", title: "ToyBox v1.0 上线", desc: "主站框架完成，开始慢慢装入新功能" },
  { date: "2026-06-20", title: "随机选择器准备中", desc: "帮你在纠结时更快做决定" },
  { date: "2026-07-01", title: "灵感生成器开发中", desc: "给想法一个随手落脚的地方" },
];

export function HomePage({ onNavigate, palette, activePaletteId, onPaletteChange }: HomePageProps) {
  const quickFeatures = getQuickFeatures(palette);
  const comingSoonFeatures = getComingSoonFeatures(palette);

  return (
    <div
      className="min-h-full"
      style={{
        fontFamily: "'Nunito', sans-serif",
        background: palette.pageBg,
      }}
    >
      <main className="min-h-full">
        <section
          className="flex min-h-screen items-stretch px-4 py-5 sm:px-6 lg:px-8"
          style={{
            background: palette.heroBackdrop,
          }}
        >
          <div
            className="relative mx-auto flex w-full max-w-7xl flex-col justify-between overflow-hidden rounded-lg border p-6 sm:p-8 lg:p-10"
            style={{
              background: palette.heroBg,
              borderColor: palette.border,
              boxShadow: palette.shadow,
            }}
          >
            <DoodleLayer palette={palette} doodles={HOME_DOODLES} extra={<HeroDoodleExtras palette={palette} />} />

            <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div
                className="inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5"
                style={{
                  background: "#FFFFFF",
                  color: palette.primaryDark,
                  border: `1px solid ${palette.border}`,
                  fontSize: "13px",
                  fontWeight: 900,
                  boxShadow: `0 8px 20px ${palette.glow}`,
                }}
              >
                <Sparkles size={14} />
                持续更新中
              </div>

              <div className="flex flex-col gap-3 sm:items-end lg:flex-row lg:items-start">
                <PaletteSwitcher
                  activePaletteId={activePaletteId}
                  onPaletteChange={onPaletteChange}
                  palette={palette}
                />
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["12", "规划功能"],
                    ["3", "可用工具"],
                    ["1", "成长盒子"],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="rounded-lg px-3 py-2"
                      style={{
                        background: "rgba(255,255,255,0.82)",
                        border: `1px solid ${palette.border}`,
                        boxShadow: `0 8px 18px ${palette.glow}`,
                      }}
                    >
                      <div style={{ color: palette.ink, fontSize: "18px", fontWeight: 900, lineHeight: 1 }}>
                        {value}
                      </div>
                      <div style={{ color: palette.muted, fontSize: "11px", fontWeight: 800, marginTop: "5px" }}>
                        {label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="relative z-10 max-w-4xl py-10 sm:py-14 lg:py-16" style={{ transform: "translateY(-1cm)" }}>
              <div
                className="mb-5 flex h-16 w-16 items-center justify-center rounded-lg"
                style={{
                  background: palette.activeGradient,
                  boxShadow: `0 16px 34px ${palette.glow}`,
                }}
              >
                <Zap size={29} color="#fff" fill="#fff" />
              </div>

              <h1
                className="mb-5 text-[72px] font-black leading-[0.98] sm:text-[96px] lg:text-[116px]"
                style={{ color: palette.ink }}
              >
                ToyBox
              </h1>
              <p
                className="max-w-3xl"
                style={{ color: palette.muted, fontSize: "19px", fontWeight: 700, lineHeight: 1.72 }}
              >
                一个可以慢慢加功能的小盒子。工具、游戏、灵感实验和生活记录都会被放在这里，首页保持完整清爽，每次打开都能看到它又长大一点。
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => onNavigate("features")}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  style={{
                    background: palette.activeGradient,
                    color: "#fff",
                    fontSize: "15px",
                    fontWeight: 900,
                    border: "none",
                    cursor: "pointer",
                    boxShadow: `0 14px 30px ${palette.glow}`,
                  }}
                >
                  进入功能大厅
                  <ArrowRight size={18} />
                </button>
                <button
                  onClick={() => onNavigate("settings")}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  style={{
                    background: "#FFFFFF",
                    color: palette.primaryDark,
                    fontSize: "15px",
                    fontWeight: 900,
                    border: `1px solid ${palette.border}`,
                    cursor: "pointer",
                  }}
                >
                  个人设置
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            <div className="relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" style={{ transform: "translateY(-1cm)" }}>
              {quickFeatures.map((f) => (
                <button
                  key={f.name}
                  onClick={() => onNavigate("features")}
                  className="rounded-lg p-4 text-left transition-all hover:-translate-y-0.5 active:translate-y-0"
                  style={{
                    background: "#FFFFFF",
                    border: `1px solid ${palette.border}`,
                    cursor: "pointer",
                    boxShadow: "0 10px 24px rgba(20,117,150,0.08)",
                  }}
                >
                  <div
                    className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg text-xl"
                    style={{ background: f.bg }}
                  >
                    {f.emoji}
                  </div>
                  <div style={{ color: palette.ink, fontSize: "14px", fontWeight: 900, marginBottom: "4px" }}>
                    {f.name}
                  </div>
                  <div style={{ color: f.color, fontSize: "12px", fontWeight: 800, lineHeight: 1.45 }}>
                    {f.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-12 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div
              className="rounded-lg border p-5 sm:p-6"
              style={{ background: "#FFFFFF", borderColor: palette.border }}
            >
              <div className="mb-5 flex items-center gap-2">
                <Star size={19} style={{ color: palette.purple }} />
                <h2 style={{ color: palette.ink, fontSize: "20px", fontWeight: 900 }}>马上加入</h2>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {comingSoonFeatures.map((f) => (
                  <div
                    key={f.name}
                    className="rounded-lg p-4"
                    style={{ background: f.bg, border: `1px solid ${palette.border}` }}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="text-3xl">{f.emoji}</div>
                      <span
                        className="rounded-full px-2.5 py-1"
                        style={{ background: "#FFFFFF", color: f.color, fontSize: "11px", fontWeight: 900 }}
                      >
                        {f.tag}
                      </span>
                    </div>
                    <div style={{ color: palette.ink, fontSize: "15px", fontWeight: 900, marginBottom: "4px" }}>
                      {f.name}
                    </div>
                    <div style={{ color: f.color, fontSize: "13px", fontWeight: 800 }}>{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-lg border p-5 sm:p-6"
              style={{ background: "#FFFFFF", borderColor: palette.border }}
            >
              <div className="mb-5 flex items-center gap-2">
                <Bell size={19} style={{ color: palette.primary }} />
                <h2 style={{ color: palette.ink, fontSize: "20px", fontWeight: 900 }}>最近动态</h2>
              </div>
              <div className="flex flex-col gap-3">
                {updates.map((u, i) => (
                  <div
                    key={u.date}
                    className="rounded-lg px-4 py-3"
                    style={{
                      background: i === 0 ? palette.soft : "#F8FEFF",
                      border: `1px solid ${i === 0 ? palette.strongBorder : palette.border}`,
                    }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span style={{ color: palette.ink, fontSize: "13px", fontWeight: 900 }}>{u.title}</span>
                      {i === 0 && (
                        <span
                          className="rounded-full px-2 py-0.5"
                          style={{ background: palette.purple, color: "#fff", fontSize: "10px", fontWeight: 900 }}
                        >
                          最新
                        </span>
                      )}
                    </div>
                    <div style={{ color: palette.muted, fontSize: "12px", fontWeight: 700, lineHeight: 1.55 }}>
                      {u.desc}
                    </div>
                    <div style={{ color: palette.primaryDark, fontSize: "11px", fontWeight: 800, marginTop: "8px" }}>
                      {u.date}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-lg border p-5 sm:p-6 lg:col-span-2"
              style={{
                background: palette.activeGradient,
                borderColor: "rgba(255,255,255,0.44)",
                color: "#fff",
              }}
            >
              <div
                className="absolute right-8 top-5 hidden h-14 w-14 rotate-12 rounded-lg sm:block"
                style={{ background: "rgba(255,255,255,0.26)" }}
              />
              <div className="relative z-10 mb-3 flex items-center gap-2">
                <Clock size={18} />
                <h2 style={{ fontSize: "18px", fontWeight: 900 }}>慢慢装满这个盒子</h2>
              </div>
              <p className="relative z-10" style={{ color: "rgba(255,255,255,0.92)", fontSize: "14px", fontWeight: 700, lineHeight: 1.7 }}>
                后续内容现在回到主页下方，页面会更自然地向下展开；每次加一个真的会用到的小功能，ToyBox 就多一格可以玩的空间。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function PaletteSwitcher({
  activePaletteId,
  onPaletteChange,
  palette,
}: {
  activePaletteId: string;
  onPaletteChange: (paletteId: string) => void;
  palette: ThemePalette;
}) {
  return (
    <div
      className="flex w-fit items-center gap-1.5 rounded-full px-2 py-1.5"
      style={{
        background: "rgba(255,255,255,0.78)",
        border: `1px solid ${palette.border}`,
        boxShadow: `0 10px 24px ${palette.glow}`,
      }}
      aria-label="切换配色"
    >
      {themePalettes.map((item) => {
        const active = activePaletteId === item.id;
        return (
          <button
            key={item.id}
            type="button"
            title={`${item.label}配色`}
            aria-label={`切换为${item.label}配色`}
            aria-pressed={active}
            onClick={() => onPaletteChange(item.id)}
            className="h-5 w-5 rounded-full transition-all hover:scale-110 active:scale-95"
            style={{
              background: item.dot,
              border: active ? `2px solid ${palette.ink}` : "2px solid rgba(255,255,255,0.95)",
              boxShadow: active ? `0 0 0 3px ${item.dot}33` : "0 2px 8px rgba(0,0,0,0.08)",
              cursor: "pointer",
            }}
          />
        );
      })}
    </div>
  );
}

function HeroDoodleExtras({ palette }: { palette: ThemePalette }) {
  return (
    <>
      {/* 方块表情 */}
      <div
        className="absolute right-24 top-44 hidden h-24 w-24 rotate-6 rounded-lg border-4 lg:block"
        style={{
          background: `linear-gradient(135deg, #FFFFFF, ${palette.softAlt})`,
          borderColor: palette.primary,
          boxShadow: `0 18px 40px ${palette.glow}`,
        }}
      >
        <div className="absolute left-6 top-8 h-3 w-3 rounded-full" style={{ background: palette.ink }} />
        <div className="absolute right-6 top-8 h-3 w-3 rounded-full" style={{ background: palette.ink }} />
        <div className="absolute bottom-7 left-1/2 h-2 w-8 -translate-x-1/2 rounded-full" style={{ background: palette.secondary }} />
      </div>
      {/* LEVEL UP 徽章 */}
      <div
        className="absolute right-36 top-36 hidden -rotate-6 rounded-lg px-3 py-1.5 text-xs font-black lg:block"
        style={{
          background: palette.ink,
          color: palette.lime,
          border: `2px solid ${palette.lime}99`,
          boxShadow: `0 10px 22px ${palette.glow}`,
        }}
      >
        LEVEL UP
      </div>
    </>
  );
}
