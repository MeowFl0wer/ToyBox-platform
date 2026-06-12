import { useState } from "react";
import { Search, ArrowRight, Sparkles } from "lucide-react";
import type { ThemePalette } from "../theme";
import { Reveal } from "./anim";

interface Feature {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  tag: string;
  status: "available" | "coming";
}

const allFeatures: Feature[] = [
  { id: "1", emoji: "🎲", name: "随机选择器", desc: "选择困难症救星，帮你在纠结时做出决定", tag: "工具", status: "available" },
  { id: "2", emoji: "💡", name: "灵感生成器", desc: "随机生成各种创意点子，激发你的灵感", tag: "工具", status: "available" },
  { id: "3", emoji: "⏱️", name: "番茄计时器", desc: "专注工作的好帮手，提升效率不分心", tag: "工具", status: "available" },
  { id: "4", emoji: "🗺️", name: "地图足迹", desc: "记录你走过的城市和地方，可视化你的旅行", tag: "生活", status: "coming" },
  { id: "5", emoji: "🎮", name: "像素小游戏", desc: "随时随地放松一下，轻量级休闲小游戏", tag: "娱乐", status: "coming" },
  { id: "6", emoji: "📝", name: "随手记录", desc: "灵感瞬间快速捕捉，不怕忘记好想法", tag: "工具", status: "coming" },
  { id: "7", emoji: "🎨", name: "调色板生成", desc: "设计师必备，一键生成和谐配色方案", tag: "工具", status: "coming" },
  { id: "8", emoji: "🌤️", name: "天气诗歌", desc: "把今天的天气写成一首诗，浪漫又有趣", tag: "实验", status: "coming" },
  { id: "9", emoji: "🔤", name: "文字转艺术", desc: "生成个性化文字海报，一键分享朋友圈", tag: "娱乐", status: "coming" },
  { id: "10", emoji: "🎵", name: "心情音乐匹配", desc: "根据你的心情和天气推荐合适的歌单", tag: "生活", status: "coming" },
  { id: "11", emoji: "🧩", name: "脑筋急转弯", desc: "各种趣味谜题，挑战你的思维极限", tag: "娱乐", status: "coming" },
  { id: "12", emoji: "📊", name: "生活数据看板", desc: "记录和分析你的日常数据，发现生活规律", tag: "生活", status: "coming" },
];

const categories = ["全部", "工具", "娱乐", "生活", "实验"];

const getTagColors = (palette: ThemePalette): Record<string, { bg: string; color: string }> => ({
  工具: { bg: palette.soft, color: palette.primaryDark },
  娱乐: { bg: `${palette.purple}18`, color: palette.purple },
  生活: { bg: palette.softAlt, color: palette.primaryDark },
  实验: { bg: `${palette.lime}33`, color: palette.primaryDark },
});

interface FeatureHallProps {
  palette: ThemePalette;
}

export function FeatureHall({ palette }: FeatureHallProps) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("全部");

  const filtered = allFeatures.filter((f) => {
    const matchTag = activeTag === "全部" || f.tag === activeTag;
    const matchSearch =
      f.name.includes(search) || f.desc.includes(search) || f.tag.includes(search);
    return matchTag && matchSearch;
  });

  return (
    <div
      className="min-h-full bg-flow"
      style={{
        fontFamily: "'Nunito', sans-serif",
        background: palette.pageBg,
      }}
    >
      {/* Header */}
      <Reveal
        immediate
        className="px-6 md:px-10 pt-8 pb-6"
        style={{ borderBottom: `1px solid ${palette.border}` }}
      >
        <div className="flex items-center gap-3 mb-1">
          <h1 style={{ fontSize: "26px", fontWeight: 900, color: palette.ink }}>功能大厅</h1>
          <span
            className="px-2.5 py-1 rounded-full"
            style={{ fontSize: "12px", fontWeight: 800, background: palette.soft, color: palette.primaryDark }}
          >
            {allFeatures.length} 个功能
          </span>
        </div>
        <p style={{ fontSize: "14px", color: palette.muted }}>
          所有有趣功能的集中入口，持续接入新功能中 ✨
        </p>

        {/* Search */}
        <div className="relative mt-4 max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: "#86A7B9" }}
          />
          <input
            type="text"
            placeholder="搜索功能名称或分类…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl"
            style={{
              background: "#fff",
              border: `1.5px solid ${palette.border}`,
              fontSize: "14px",
              color: palette.ink,
              outline: "none",
              fontFamily: "'Nunito', sans-serif",
            }}
            onFocus={(e) => (e.target.style.borderColor = palette.primary)}
            onBlur={(e) => (e.target.style.borderColor = palette.border)}
          />
        </div>

        {/* Category filters */}
        <div className="flex items-center gap-2 mt-4 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveTag(cat)}
              className="px-4 py-1.5 rounded-full transition-all"
              style={{
                background: activeTag === cat ? palette.activeGradient : "#fff",
                color: activeTag === cat ? "#fff" : palette.muted,
                fontSize: "13px",
                fontWeight: 700,
                border: activeTag === cat ? "none" : `1.5px solid ${palette.border}`,
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Feature grid */}
      <div className="px-6 md:px-10 py-7">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span style={{ fontSize: "40px" }}>🔍</span>
            <div style={{ fontSize: "16px", fontWeight: 700, color: palette.muted }}>
              没有找到相关功能
            </div>
            <div style={{ fontSize: "13px", color: palette.muted }}>换个关键词试试吧</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((f, i) => (
              <Reveal key={f.id} delay={Math.min(i, 8) * 0.05}>
                <FeatureCard feature={f} palette={palette} />
              </Reveal>
            ))}
          </div>
        )}

        {/* Bottom note */}
        <Reveal
          className="mt-10 rounded-2xl px-6 py-5 flex items-center gap-4"
          style={{
            background: `linear-gradient(135deg, ${palette.soft}, #FFFFFF)`,
            border: `1.5px dashed ${palette.strongBorder}`,
          }}
        >
          <Sparkles size={22} style={{ color: palette.secondary, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: palette.ink, marginBottom: "2px" }}>
              更多功能陆续上线中
            </div>
            <div style={{ fontSize: "13px", color: palette.muted }}>
              有好玩的功能想法？后续将开放意见反馈通道，欢迎一起共建有趣的地方。
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function FeatureCard({ feature, palette }: { feature: Feature; palette: ThemePalette }) {
  const tagColors = getTagColors(palette);
  const tc = tagColors[feature.tag] ?? { bg: "#F3F4F6", color: "#6B7280" };
  const isAvailable = feature.status === "available";

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{
        background: "rgba(255,255,255,0.92)",
        border: `1.5px solid ${palette.border}`,
        boxShadow: `0 10px 24px ${palette.glow}`,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
          style={{ background: isAvailable ? palette.soft : palette.cardAlt }}
        >
          {feature.emoji}
        </div>
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-0.5 rounded-full"
            style={{ fontSize: "11px", fontWeight: 700, background: tc.bg, color: tc.color }}
          >
            {feature.tag}
          </span>
          {isAvailable ? (
            <span
              className="px-2.5 py-0.5 rounded-full"
              style={{ fontSize: "11px", fontWeight: 700, background: palette.softAlt, color: palette.primaryDark }}
            >
              ✓ 可用
            </span>
          ) : (
            <span
              className="px-2.5 py-0.5 rounded-full"
              style={{ fontSize: "11px", fontWeight: 700, background: palette.soft, color: palette.secondary }}
            >
              即将上线
            </span>
          )}
        </div>
      </div>

      <div>
        <div style={{ fontSize: "15px", fontWeight: 800, color: palette.ink, marginBottom: "4px" }}>
          {feature.name}
        </div>
        <div style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.6 }}>{feature.desc}</div>
      </div>

      <button
        disabled={!isAvailable}
        className="w-full py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
        style={{
          background: isAvailable ? palette.activeGradient : palette.soft,
          color: isAvailable ? "#fff" : palette.muted,
          fontSize: "14px",
          fontWeight: 700,
          border: "none",
          cursor: isAvailable ? "pointer" : "not-allowed",
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        {isAvailable ? (
          <>进入 <ArrowRight size={14} /></>
        ) : (
          <>敬请期待</>
        )}
      </button>
    </div>
  );
}
