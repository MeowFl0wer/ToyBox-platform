import { useEffect, useMemo, useState } from "react";
import { Search, ArrowRight, Sparkles, Star, Lock } from "lucide-react";
import type { ThemePalette } from "../theme";
import { api, ApiError, type ApiModule } from "../api/client";
import { moduleEmoji } from "../api/moduleIcon";
import { Reveal } from "./anim";

interface FeatureHallProps {
  palette: ThemePalette;
  isLoggedIn: boolean;
  onOpenAuth: () => void;
  onOpenModule: (m: ApiModule) => void;
}

const FAVORITE_TAG = "收藏";

export function FeatureHall({ palette, isLoggedIn, onOpenAuth, onOpenModule }: FeatureHallProps) {
  const [modules, setModules] = useState<ApiModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState("全部");

  useEffect(() => {
    api
      .getModules()
      .then(setModules)
      .catch((e) => setErr(e instanceof ApiError ? e.message : "加载失败"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(modules.map((m) => m.category)));
    return ["全部", FAVORITE_TAG, ...cats];
  }, [modules]);

  const filtered = modules.filter((m) => {
    const matchTag = activeTag === "全部" || (activeTag === FAVORITE_TAG ? m.favorite : m.category === activeTag);
    const q = search.trim();
    const matchSearch = !q || m.name.includes(q) || m.description.includes(q) || m.category.includes(q);
    return matchTag && matchSearch;
  });

  const toggleFav = async (m: ApiModule) => {
    if (!isLoggedIn) {
      onOpenAuth();
      return;
    }
    try {
      const updated = m.favorite ? await api.unfavorite(m.module_id) : await api.favorite(m.module_id);
      setModules((prev) => prev.map((x) => (x.module_id === m.module_id ? { ...x, favorite: updated.favorite } : x)));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="min-h-full bg-flow" style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}>
      {/* Header */}
      <Reveal immediate className="px-6 md:px-10 pt-8 pb-6" style={{ borderBottom: `1px solid ${palette.border}` }}>
        <div className="flex items-center gap-3 mb-1">
          <h1 style={{ fontSize: "26px", fontWeight: 900, color: palette.ink }}>功能大厅</h1>
          <span className="px-2.5 py-1 rounded-full" style={{ fontSize: "12px", fontWeight: 800, background: palette.soft, color: palette.primaryDark }}>
            {modules.length} 个功能
          </span>
        </div>
        <p style={{ fontSize: "14px", color: palette.muted }}>所有有趣功能的集中入口，持续接入新功能中 ✨</p>

        {/* Search */}
        <div className="relative mt-4 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "#86A7B9" }} />
          <input
            type="text"
            placeholder="搜索功能名称或分类…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl"
            style={{ background: palette.surface, border: `1.5px solid ${palette.border}`, fontSize: "14px", color: palette.ink, outline: "none", fontFamily: "'Nunito', sans-serif" }}
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
              className="px-4 py-1.5 rounded-full transition-all inline-flex items-center gap-1"
              style={{
                background: activeTag === cat ? palette.activeGradient : palette.surface,
                color: activeTag === cat ? "#fff" : palette.muted,
                fontSize: "13px",
                fontWeight: 700,
                border: activeTag === cat ? "none" : `1.5px solid ${palette.border}`,
                cursor: "pointer",
                fontFamily: "'Nunito', sans-serif",
              }}
            >
              {cat === FAVORITE_TAG && <Star size={12} fill={activeTag === cat ? "#fff" : "none"} />}
              {cat}
            </button>
          ))}
        </div>
      </Reveal>

      {/* Feature grid */}
      <div className="px-6 md:px-10 py-7">
        {err ? (
          <EmptyState palette={palette} emoji="⚠️" title="加载失败" desc={err} />
        ) : loading ? (
          <EmptyState palette={palette} emoji="⏳" title="加载中…" desc="正在获取功能列表" />
        ) : filtered.length === 0 ? (
          <EmptyState palette={palette} emoji={activeTag === FAVORITE_TAG ? "⭐" : "🔍"} title={activeTag === FAVORITE_TAG ? "还没有收藏" : "没有找到相关功能"} desc={activeTag === FAVORITE_TAG ? "点功能卡右上角的星星即可收藏" : "换个关键词试试吧"} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((m, i) => (
              <Reveal key={m.module_id} delay={Math.min(i, 8) * 0.05}>
                <FeatureCard module={m} palette={palette} onOpen={() => onOpenModule(m)} onToggleFav={() => toggleFav(m)} />
              </Reveal>
            ))}
          </div>
        )}

        {/* Bottom note */}
        <Reveal className="mt-10 rounded-2xl px-6 py-5 flex items-center gap-4" style={{ background: `linear-gradient(135deg, ${palette.soft}, ${palette.surface})`, border: `1.5px dashed ${palette.strongBorder}` }}>
          <Sparkles size={22} style={{ color: palette.secondary, flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: palette.ink, marginBottom: "2px" }}>更多功能陆续上线中</div>
            <div style={{ fontSize: "13px", color: palette.muted }}>新功能做好后会出现在这里；管理员可在后台发布「即将上线」入口。</div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function FeatureCard({ module: m, palette, onOpen, onToggleFav }: { module: ApiModule; palette: ThemePalette; onOpen: () => void; onToggleFav: () => void }) {
  const isAvailable = m.status === "active";
  return (
    <div
      onClick={onOpen}
      className="relative rounded-2xl p-5 flex flex-col gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer h-full"
      style={{ background: palette.glass, border: `1.5px solid ${palette.border}`, boxShadow: `0 10px 24px ${palette.glow}` }}
    >
      {/* 收藏按钮（右上角） */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
        title={m.favorite ? "取消收藏" : "收藏"}
        className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full transition-all hover:scale-110"
        style={{ background: m.favorite ? palette.soft : "transparent", border: "none", cursor: "pointer" }}
      >
        <Star size={17} style={{ color: m.favorite ? palette.primary : palette.muted }} fill={m.favorite ? palette.primary : "none"} />
      </button>

      <div className="flex items-start justify-between pr-8">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl" style={{ background: isAvailable ? palette.soft : palette.cardAlt }}>
          {moduleEmoji(m)}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="px-2.5 py-0.5 rounded-full" style={{ fontSize: "11px", fontWeight: 700, background: palette.soft, color: palette.primaryDark }}>
            {m.category}
          </span>
          {isAvailable ? (
            <span className="px-2.5 py-0.5 rounded-full" style={{ fontSize: "11px", fontWeight: 700, background: palette.softAlt, color: palette.primaryDark }}>✓ 可用</span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full" style={{ fontSize: "11px", fontWeight: 700, background: palette.soft, color: palette.secondary }}>即将上线</span>
          )}
        </div>
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-1.5" style={{ marginBottom: "4px" }}>
          <span style={{ fontSize: "15px", fontWeight: 800, color: palette.ink }}>{m.name}</span>
          {m.auth_required && <Lock size={12} style={{ color: palette.muted }} />}
        </div>
        <div style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.6 }}>{m.description}</div>
      </div>

      <button
        className="w-full py-2 rounded-xl flex items-center justify-center gap-2 transition-all"
        style={{
          background: isAvailable ? palette.activeGradient : palette.soft,
          color: isAvailable ? "#fff" : palette.muted,
          fontSize: "14px", fontWeight: 700, border: "none",
          cursor: "pointer", fontFamily: "'Nunito', sans-serif",
        }}
      >
        {isAvailable ? (<>进入 <ArrowRight size={14} /></>) : (<>敬请期待</>)}
      </button>
    </div>
  );
}

function EmptyState({ palette, emoji, title, desc }: { palette: ThemePalette; emoji: string; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <span style={{ fontSize: "40px" }}>{emoji}</span>
      <div style={{ fontSize: "16px", fontWeight: 700, color: palette.muted }}>{title}</div>
      <div style={{ fontSize: "13px", color: palette.muted }}>{desc}</div>
    </div>
  );
}
