import { Info, ShieldAlert, MessageCircle, Mail, Github, Heart, Tag, CheckCircle2, ArrowUpRight } from "lucide-react";
import type { ThemePalette } from "../theme";
import { DoodleLayer, type DoodleSpec } from "./DoodleLayer";

// q 版插画在关于页的默认布局（可在「微调插画」模式里拖动后复制覆盖此处）
const ABOUT_DOODLES: DoodleSpec[] = [
  { id: "cat", type: "SleepingCat", xPct: 89.1, yPct: 22.2, w: 112, opacity: 0.55 },
  { id: "cloud", type: "SmilingCloud", xPct: 10, yPct: 30, w: 96, opacity: 0.5 },
  { id: "mushroom", type: "Mushroom", xPct: 9.6, yPct: 51.9, w: 48, opacity: 0.45 },
  { id: "wisp", type: "Wisp", xPct: 89.7, yPct: 43.5, w: 64, opacity: 0.5 },
  { id: "star", type: "StarBuddy", xPct: 85.7, yPct: 68.9, w: 66, opacity: 0.55 },
  { id: "crystal", type: "Crystal", xPct: 88, yPct: 85.3, w: 64, opacity: 0.5 },
  { id: "teacup", type: "TeaCup", xPct: 10.9, yPct: 80.6, w: 80, opacity: 0.5 },
];

interface AboutPageProps {
  palette: ThemePalette;
}

const APP_VERSION = "v1.0.0";
const RELEASE_DATE = "2026-06-12";
// 模板占位：换成你自己的反馈邮箱与仓库地址
const FEEDBACK_EMAIL = "your-email@example.com";
const GITHUB_URL = "https://github.com/your-name/your-repo";

const changelog = [
  { version: "v1.0.0", date: "2026-06-12", note: "主站框架完成，首页 / 功能大厅 / 设置上线" },
  { version: "v0.9.0", date: "2026-06-01", note: "内测版本，搭建配色主题与导航结构" },
];

export function AboutPage({ palette }: AboutPageProps) {
  return (
    <div
      className="min-h-full"
      style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}
    >
      <div className="relative min-h-full" style={{ background: palette.heroBackdrop }}>
        <DoodleLayer palette={palette} doodles={ABOUT_DOODLES} className="hidden sm:block" extra={<AboutBlobs palette={palette} />} />

        <div className="relative z-10 mx-auto px-6 md:px-10 py-8 max-w-2xl">
          {/* Header */}
          <div className="mb-8 flex flex-col items-center text-center">
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 mb-4"
              style={{
                background: "#FFFFFF",
                color: palette.primaryDark,
                border: `1px solid ${palette.border}`,
                fontSize: "13px",
                fontWeight: 900,
                boxShadow: `0 8px 20px ${palette.glow}`,
              }}
            >
              <Info size={14} />
              关于 ToyBox
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: 900, color: palette.ink, marginBottom: "8px", lineHeight: 1.2 }}>
              一个慢慢长大的小盒子
            </h1>
            <p style={{ fontSize: "14px", color: palette.muted, fontWeight: 600, lineHeight: 1.75, maxWidth: "440px" }}>
              ToyBox 是一个收纳工具、游戏、灵感实验和生活记录的个人空间。这里记录它的版本、约定与联系方式。
            </p>
          </div>

          {/* Version card */}
          <Card palette={palette}>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: palette.activeGradient, boxShadow: `0 8px 18px ${palette.glow}` }}
                >
                  <Tag size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 900, color: palette.ink }}>当前版本</div>
                  <div style={{ fontSize: "12px", color: palette.muted, fontWeight: 700 }}>更新于 {RELEASE_DATE}</div>
                </div>
              </div>
              <div
                className="rounded-full px-3.5 py-1.5"
                style={{
                  background: palette.soft,
                  color: palette.primaryDark,
                  fontSize: "15px",
                  fontWeight: 900,
                  border: `1px solid ${palette.strongBorder}`,
                }}
              >
                {APP_VERSION}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {changelog.map((c, i) => (
                <div
                  key={c.version}
                  className="flex items-start gap-3 rounded-xl px-3.5 py-2.5"
                  style={{
                    background: i === 0 ? palette.soft : palette.cardAlt,
                    border: `1px solid ${i === 0 ? palette.strongBorder : palette.border}`,
                  }}
                >
                  <CheckCircle2 size={16} style={{ color: palette.secondary, marginTop: "2px", flexShrink: 0 }} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: "13px", fontWeight: 900, color: palette.ink }}>{c.version}</span>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: palette.muted }}>{c.date}</span>
                    </div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: palette.muted, lineHeight: 1.5, marginTop: "2px" }}>
                      {c.note}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Disclaimer card */}
          <Card palette={palette}>
            <SectionHeader
              icon={<ShieldAlert size={18} color="#fff" />}
              title="免责声明"
              subtitle="使用前请知悉"
              palette={palette}
              iconBg={palette.coral}
            />
            <ul className="flex flex-col gap-2.5 mt-1">
              {[
                "ToyBox 为个人非商业项目，全部功能仅供学习、娱乐与日常自用，不提供任何形式的商业服务保证。",
                "站内工具的计算与生成结果仅供参考，请勿作为专业、医疗、财务或法律决策的唯一依据。",
                "本站不会主动收集敏感个人信息，你在本地填写的内容默认只保存在你的设备上。",
                "因使用本站功能产生的任何直接或间接后果，需由使用者自行承担。",
              ].map((text, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full"
                    style={{ background: palette.coral }}
                  />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: palette.muted, lineHeight: 1.7 }}>{text}</span>
                </li>
              ))}
            </ul>
          </Card>

          {/* Feedback card */}
          <Card palette={palette}>
            <SectionHeader
              icon={<MessageCircle size={18} color="#fff" />}
              title="技术问题反馈"
              subtitle="发现 Bug 或有建议都欢迎"
              palette={palette}
              iconBg={palette.primary}
            />
            <div className="flex flex-col gap-2.5 mt-1">
              <FeedbackRow
                palette={palette}
                icon={<Mail size={16} style={{ color: palette.primaryDark }} />}
                label="邮件反馈"
                value={FEEDBACK_EMAIL}
                href={`mailto:${FEEDBACK_EMAIL}?subject=ToyBox 反馈`}
              />
              <FeedbackRow
                palette={palette}
                icon={<Github size={16} style={{ color: palette.ink }} />}
                label="提交 Issue"
                value="在 GitHub 上反馈问题"
                href={GITHUB_URL}
              />
            </div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: palette.muted, lineHeight: 1.7, marginTop: "12px" }}>
              反馈时如果能附上你的设备、浏览器和复现步骤，会帮助问题更快被定位 🛠️
            </p>
          </Card>

          {/* Footer */}
          <div className="flex items-center justify-center gap-1.5 pt-2 pb-4">
            <span style={{ fontSize: "12px", fontWeight: 700, color: palette.muted }}>用</span>
            <Heart size={13} style={{ color: palette.coral }} fill={palette.coral} />
            <span style={{ fontSize: "12px", fontWeight: 700, color: palette.muted }}>慢慢搭建 · ToyBox {APP_VERSION}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ children, palette }: { children: React.ReactNode; palette: ThemePalette }) {
  return (
    <div
      className="rounded-2xl border p-5 sm:p-6 mb-5"
      style={{
        background: "rgba(255,255,255,0.92)",
        borderColor: palette.border,
        boxShadow: `0 12px 30px ${palette.glow}`,
        backdropFilter: "blur(4px)",
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  palette,
  iconBg,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  palette: ThemePalette;
  iconBg: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
        style={{ background: iconBg, boxShadow: `0 8px 18px ${palette.glow}` }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: "16px", fontWeight: 900, color: palette.ink }}>{title}</div>
        <div style={{ fontSize: "12px", color: palette.muted, fontWeight: 700 }}>{subtitle}</div>
      </div>
    </div>
  );
}

function FeedbackRow({
  icon,
  label,
  value,
  href,
  palette,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  palette: ThemePalette;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("mailto:") ? undefined : "_blank"}
      rel="noreferrer"
      className="group flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-all hover:-translate-y-0.5"
      style={{ background: palette.cardAlt, border: `1px solid ${palette.border}`, textDecoration: "none" }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: "#FFFFFF", border: `1px solid ${palette.border}` }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div style={{ fontSize: "13px", fontWeight: 800, color: palette.ink }}>{label}</div>
          <div className="truncate" style={{ fontSize: "12px", fontWeight: 700, color: palette.muted }}>{value}</div>
        </div>
      </div>
      <ArrowUpRight size={16} style={{ color: palette.primary, flexShrink: 0 }} />
    </a>
  );
}

/* ---- 低饱和日系 q 版插画背景装饰：柔光色斑 ---- */
function AboutBlobs({ palette }: { palette: ThemePalette }) {
  return (
    <>
      <div
        className="absolute -left-16 top-24 h-56 w-56 rounded-full"
        style={{ background: palette.softAlt, opacity: 0.5, filter: "blur(8px)" }}
      />
      <div
        className="absolute -right-20 bottom-24 h-64 w-64 rounded-full"
        style={{ background: palette.soft, opacity: 0.5, filter: "blur(10px)" }}
      />
    </>
  );
}
