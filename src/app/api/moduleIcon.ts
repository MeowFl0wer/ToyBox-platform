import type { ApiModule } from "./client";

// 把模块映射为可爱 emoji（保持现有日系 q 版视觉风格）
const BY_ID: Record<string, string> = {
  welcome: "🤗",
  todo: "✅",
  journal: "📓",
  painter: "🎨",
  decision: "🎲",
  timer: "⏱️",
  map: "🗺️",
};

const BY_ICON: Record<string, string> = {
  "hand-heart": "🤗",
  "check-square": "✅",
  "notebook-pen": "📓",
  palette: "🎨",
  sparkles: "✨",
};

export function moduleEmoji(m: Pick<ApiModule, "module_id" | "icon">): string {
  return BY_ID[m.module_id] ?? BY_ICON[m.icon] ?? "✨";
}
