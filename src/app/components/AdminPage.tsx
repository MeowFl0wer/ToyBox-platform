import { useEffect, useState } from "react";
import {
  LayoutDashboard, Boxes, Rocket, FileText, Users, Activity, BarChart3,
  EyeOff, Eye, Trash2, Plus, ArrowLeft,
} from "lucide-react";
import type { ThemePalette } from "../theme";
import { api, ApiError, type ApiModule, type ApiUser } from "../api/client";
import { moduleEmoji } from "../api/moduleIcon";

type Tab = "dashboard" | "modules" | "deploy" | "content" | "users" | "system" | "analytics";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { id: "dashboard", label: "概览", icon: LayoutDashboard },
  { id: "modules", label: "模块管理", icon: Boxes },
  { id: "deploy", label: "模块部署", icon: Rocket },
  { id: "content", label: "内容编辑", icon: FileText },
  { id: "users", label: "用户管理", icon: Users },
  { id: "system", label: "系统状态", icon: Activity },
  { id: "analytics", label: "访问统计", icon: BarChart3 },
];

export function AdminPage({ palette, onExit }: { palette: ThemePalette; onExit: () => void }) {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-full bg-flow" style={{ fontFamily: "'Nunito', sans-serif", background: palette.pageBg }}>
      <div className="px-6 md:px-10 py-6 max-w-6xl mx-auto">
        <button
          onClick={onExit}
          className="mb-4 inline-flex items-center gap-1.5"
          style={{ color: palette.primaryDark, fontWeight: 700, fontSize: "14px", background: "none", border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
        >
          <ArrowLeft size={16} /> 返回主站
        </button>
        <h1 style={{ fontSize: "24px", fontWeight: 900, color: palette.ink, marginBottom: "4px" }}>后台管理平台</h1>
        <p style={{ fontSize: "13px", color: palette.muted, marginBottom: "20px" }}>管理模块、内容、用户与运行状态（仅管理员可见）</p>

        <div className="flex flex-col md:flex-row gap-5">
          {/* 左侧分页导航 */}
          <div className="flex md:flex-col gap-1.5 flex-wrap md:w-44 flex-shrink-0">
            {TABS.map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className="flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left transition-all"
                  style={{
                    background: active ? palette.activeGradient : "rgba(255,255,255,0.7)",
                    color: active ? "#fff" : palette.ink,
                    border: `1px solid ${active ? "transparent" : palette.border}`,
                    fontSize: "14px", fontWeight: active ? 800 : 600, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                  }}
                >
                  <Icon size={16} />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* 内容区 */}
          <div className="flex-1 min-w-0">
            {tab === "dashboard" && <Dashboard palette={palette} />}
            {tab === "modules" && <ModulesPanel palette={palette} />}
            {tab === "deploy" && <DeployPanel palette={palette} />}
            {tab === "content" && <ContentPanel palette={palette} />}
            {tab === "users" && <UsersPanel palette={palette} />}
            {tab === "system" && <PlaceholderPanel palette={palette} title="系统状态" desc="主站后端 / 数据库 / Nginx / 部署器 / 模块容器运行状态。按架构文档 13.4 规划，待接入监控数据。" />}
            {tab === "analytics" && <PlaceholderPanel palette={palette} title="访问统计" desc="PV / UV、模块访问排行、来源与设备分布。按架构文档 13.5 规划，待接入埋点数据。" />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ children, palette }: { children: React.ReactNode; palette: ThemePalette }) {
  return (
    <div className="rounded-2xl border p-5 sm:p-6" style={{ background: "rgba(255,255,255,0.92)", borderColor: palette.border, boxShadow: `0 12px 30px ${palette.glow}` }}>
      {children}
    </div>
  );
}

function H2({ children, palette }: { children: React.ReactNode; palette: ThemePalette }) {
  return <h2 style={{ fontSize: "18px", fontWeight: 900, color: palette.ink, marginBottom: "14px" }}>{children}</h2>;
}

function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = () => {
    setLoading(true);
    fn().then((d) => { setData(d); setErr(""); }).catch((e) => setErr(e instanceof ApiError ? e.message : "加载失败")).finally(() => setLoading(false));
  };
  useEffect(reload, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, err, loading, reload };
}

function Dashboard({ palette }: { palette: ThemePalette }) {
  const { data, err } = useAsync<any>(() => api.adminDashboard());
  const cards = [
    ["用户总数", data?.users_total], ["活跃用户", data?.users_active],
    ["模块总数", data?.modules_total], ["可用模块", data?.modules_active],
    ["即将上线", data?.modules_coming_soon], ["已隐藏", data?.modules_hidden],
  ];
  return (
    <Panel palette={palette}>
      <H2 palette={palette}>概览</H2>
      {err && <ErrText text={err} />}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {cards.map(([label, val]) => (
          <div key={label as string} className="rounded-xl px-4 py-4" style={{ background: palette.soft, border: `1px solid ${palette.border}` }}>
            <div style={{ fontSize: "26px", fontWeight: 900, color: palette.ink }}>{val ?? "—"}</div>
            <div style={{ fontSize: "12px", fontWeight: 700, color: palette.muted, marginTop: "2px" }}>{label}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function ModulesPanel({ palette }: { palette: ThemePalette }) {
  const { data, err, reload } = useAsync<ApiModule[]>(() => api.adminModules());
  const [busy, setBusy] = useState("");

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusy(id);
    try { await fn(); reload(); } catch (e) { alert(e instanceof ApiError ? e.message : "操作失败"); } finally { setBusy(""); }
  };

  return (
    <Panel palette={palette}>
      <H2 palette={palette}>模块管理</H2>
      {err && <ErrText text={err} />}
      <div className="flex flex-col gap-2.5">
        {(data ?? []).map((m) => (
          <div key={m.module_id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: palette.cardAlt, border: `1px solid ${palette.border}` }}>
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg text-lg" style={{ background: palette.soft }}>{moduleEmoji(m)}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span style={{ fontSize: "14px", fontWeight: 800, color: palette.ink }}>{m.name}</span>
                  <Tag palette={palette}>{m.status === "active" ? "可用" : "即将上线"}</Tag>
                  {m.hidden && <Tag palette={palette} tone="warn">已隐藏</Tag>}
                  {m.builtin && <Tag palette={palette}>内置</Tag>}
                </div>
                <div className="truncate" style={{ fontSize: "12px", color: palette.muted, fontWeight: 600 }}>{m.module_id} · {m.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {m.hidden ? (
                <IconBtn palette={palette} onClick={() => act(() => api.adminUnhide(m.module_id), m.module_id)} disabled={busy === m.module_id} title="取消隐藏"><Eye size={15} /></IconBtn>
              ) : (
                <IconBtn palette={palette} onClick={() => act(() => api.adminHide(m.module_id), m.module_id)} disabled={busy === m.module_id} title="隐藏"><EyeOff size={15} /></IconBtn>
              )}
              <IconBtn
                palette={palette}
                tone="danger"
                onClick={() => { if (confirm(`确定卸载「${m.name}」？`)) act(() => api.adminUninstall(m.module_id), m.module_id); }}
                disabled={busy === m.module_id || m.builtin}
                title={m.builtin ? "内置模块不可卸载" : "卸载"}
              >
                <Trash2 size={15} />
              </IconBtn>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

const JOB_STAGES: Record<string, string> = {
  pending: "排队中", cloning: "克隆仓库", validating: "校验 module.yaml",
  building_frontend: "构建前端", building_backend: "构建后端", migrating: "执行数据库迁移",
  starting_container: "启动模块后端", health_checking: "健康检查", success: "已上线", failed: "失败",
};

function DeployPanel({ palette }: { palette: ThemePalette }) {
  const [repo, setRepo] = useState("https://github.com/MeowFl0wer/personal-tool-module-welcome");
  const [ref, setRef] = useState("");
  const [job, setJob] = useState<{ id: string; status: string; logs: string; error_message?: string; module_id?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!job || job.status === "success" || job.status === "failed") return;
    const t = setInterval(async () => {
      try {
        setJob(await api.adminInstallJob(job.id));
      } catch {
        /* ignore */
      }
    }, 1500);
    return () => clearInterval(t);
  }, [job?.id, job?.status]);

  const install = async () => {
    setErr("");
    setBusy(true);
    try {
      const { job_id } = await api.adminInstall(repo.trim(), ref.trim());
      setJob({ id: job_id, status: "pending", logs: "" });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "安装失败");
    } finally {
      setBusy(false);
    }
  };

  const done = job?.status === "success" || job?.status === "failed";
  return (
    <Panel palette={palette}>
      <H2 palette={palette}>模块部署（GitHub 一键安装）</H2>
      <div style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.7, marginBottom: "12px" }}>
        填写模块 GitHub 仓库地址 → 主站 clone、读 <code>module.yaml</code> 校验、构建前端、起后端、健康检查后自动上线。
      </div>
      <div className="flex flex-col gap-2.5">
        <Input palette={palette} value={repo} onChange={setRepo} placeholder="https://github.com/you/personal-tool-module-xxx" />
        <Input palette={palette} value={ref} onChange={setRef} placeholder="分支 / Tag / Commit（可空，默认默认分支）" />
      </div>
      {err && <ErrText text={err} />}
      <PrimaryBtn palette={palette} onClick={install}>{busy ? "提交中…" : "安装并部署"}</PrimaryBtn>

      {job && (
        <div className="mt-4 rounded-xl p-4" style={{ background: palette.cardAlt, border: `1px solid ${palette.border}` }}>
          <div className="flex items-center gap-2 mb-2">
            {!done && <span className="inline-block h-3 w-3 rounded-full animate-pulse" style={{ background: palette.primary }} />}
            <span style={{ fontSize: "14px", fontWeight: 900, color: job.status === "failed" ? "#D14343" : palette.ink }}>
              {job.status === "success" ? "✓ " : ""}{JOB_STAGES[job.status] ?? job.status}
              {job.module_id ? ` · ${job.module_id}` : ""}
            </span>
          </div>
          {job.error_message && <ErrText text={job.error_message} />}
          {job.logs && (
            <pre style={{ fontSize: "11px", color: palette.muted, background: "#fff", borderRadius: "8px", padding: "8px 10px", maxHeight: "180px", overflow: "auto", whiteSpace: "pre-wrap", margin: 0 }}>
              {job.logs.split("\n").slice(-14).join("\n")}
            </pre>
          )}
          {job.status === "success" && (
            <div style={{ fontSize: "12px", fontWeight: 700, color: palette.primaryDark, marginTop: "8px" }}>
              已上线，去「模块管理」或工具大厅即可看到。
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}

function ContentPanel({ palette }: { palette: ThemePalette }) {
  const { data, err, reload } = useAsync<any[]>(() => api.adminContents());
  // 编辑选中内容
  const [editKey, setEditKey] = useState("");
  const [editText, setEditText] = useState("");
  // 发布即将上线入口
  const [cs, setCs] = useState({ module_id: "", name: "", description: "", category: "工具" });
  const [msg, setMsg] = useState("");

  const saveContent = async () => {
    try {
      await api.adminUpsertContent(editKey, { content_type: "plain_text", content_value: { text: editText }, status: "published" });
      setMsg("内容已保存"); reload();
    } catch (e) { setMsg(e instanceof ApiError ? e.message : "保存失败"); }
  };
  const publish = async () => {
    try {
      await api.adminPublishComingSoon(cs);
      setMsg(`已发布即将上线入口：${cs.name}`);
      setCs({ module_id: "", name: "", description: "", category: "工具" });
    } catch (e) { setMsg(e instanceof ApiError ? e.message : "发布失败"); }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 发布即将上线入口 */}
      <Panel palette={palette}>
        <H2 palette={palette}>发布「即将上线」入口</H2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <Input palette={palette} value={cs.module_id} onChange={(v) => setCs({ ...cs, module_id: v })} placeholder="模块 ID（小写，如 painter）" />
          <Input palette={palette} value={cs.name} onChange={(v) => setCs({ ...cs, name: v })} placeholder="名称（如 调色板）" />
          <Input palette={palette} value={cs.category} onChange={(v) => setCs({ ...cs, category: v })} placeholder="分类" />
          <Input palette={palette} value={cs.description} onChange={(v) => setCs({ ...cs, description: v })} placeholder="一句话简介" />
        </div>
        <PrimaryBtn palette={palette} onClick={publish}><Plus size={15} /> 发布即将上线入口</PrimaryBtn>
      </Panel>

      {/* 站点内容编辑 */}
      <Panel palette={palette}>
        <H2 palette={palette}>站点内容编辑</H2>
        {err && <ErrText text={err} />}
        <div className="flex flex-col gap-2">
          {(data ?? []).map((c) => (
            <button
              key={c.content_key}
              onClick={() => { setEditKey(c.content_key); setEditText(c.content_value?.text ?? ""); }}
              className="flex items-center justify-between rounded-xl px-4 py-2.5 text-left transition-all"
              style={{ background: editKey === c.content_key ? palette.soft : palette.cardAlt, border: `1px solid ${editKey === c.content_key ? palette.strongBorder : palette.border}`, cursor: "pointer" }}
            >
              <span style={{ fontSize: "13px", fontWeight: 800, color: palette.ink }}>{c.title || c.content_key}</span>
              <span style={{ fontSize: "11px", color: palette.muted }}>{c.content_key} · v{c.version}</span>
            </button>
          ))}
        </div>
        {editKey && (
          <div className="mt-3">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full rounded-xl px-3.5 py-2.5"
              style={{ background: palette.cardAlt, border: `1px solid ${palette.border}`, fontSize: "14px", color: palette.ink, outline: "none", fontFamily: "'Nunito', sans-serif", resize: "vertical" }}
            />
            <PrimaryBtn palette={palette} onClick={saveContent}>保存「{editKey}」</PrimaryBtn>
          </div>
        )}
      </Panel>

      {msg && <div style={{ fontSize: "13px", color: palette.primaryDark, fontWeight: 700 }}>{msg}</div>}
    </div>
  );
}

function UsersPanel({ palette }: { palette: ThemePalette }) {
  const { data, err, reload } = useAsync<ApiUser[]>(() => api.adminUsers());
  const toggle = async (u: ApiUser) => {
    try { u.status === "active" ? await api.adminDisableUser(u.id) : await api.adminEnableUser(u.id); reload(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "操作失败"); }
  };
  return (
    <Panel palette={palette}>
      <H2 palette={palette}>用户管理</H2>
      {err && <ErrText text={err} />}
      <div className="flex flex-col gap-2">
        {(data ?? []).map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: palette.cardAlt, border: `1px solid ${palette.border}` }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span style={{ fontSize: "14px", fontWeight: 800, color: palette.ink }}>{u.nickname || u.username}</span>
                <Tag palette={palette}>ID {u.uid_display}</Tag>
                {u.role === "admin" && <Tag palette={palette} tone="warn">管理员</Tag>}
                <Tag palette={palette} tone={u.status === "active" ? undefined : "danger"}>{u.status === "active" ? "正常" : u.status === "disabled" ? "已禁用" : "已注销"}</Tag>
              </div>
              <div className="truncate" style={{ fontSize: "12px", color: palette.muted, fontWeight: 600 }}>@{u.username} · {u.email}</div>
            </div>
            {u.role !== "admin" && (
              <button
                onClick={() => toggle(u)}
                className="rounded-lg px-3 py-1.5 flex-shrink-0"
                style={{ background: u.status === "active" ? "#FDECEC" : palette.soft, color: u.status === "active" ? "#D14343" : palette.primaryDark, border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 800, fontFamily: "'Nunito', sans-serif" }}
              >
                {u.status === "active" ? "禁用" : "启用"}
              </button>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PlaceholderPanel({ palette, title, desc }: { palette: ThemePalette; title: string; desc: string }) {
  return (
    <Panel palette={palette}>
      <H2 palette={palette}>{title}</H2>
      <div style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.8 }}>{desc}</div>
      <div className="mt-3 inline-block rounded-full px-3 py-1" style={{ background: palette.soft, color: palette.primaryDark, fontSize: "12px", fontWeight: 800 }}>🚧 规划中 · 占位</div>
    </Panel>
  );
}

/* ---- 小组件 ---- */
function Tag({ children, palette, tone }: { children: React.ReactNode; palette: ThemePalette; tone?: "warn" | "danger" }) {
  const bg = tone === "danger" ? "#FDECEC" : tone === "warn" ? palette.softAlt : palette.soft;
  const color = tone === "danger" ? "#D14343" : palette.primaryDark;
  return <span className="rounded-full px-2 py-0.5" style={{ background: bg, color, fontSize: "11px", fontWeight: 800 }}>{children}</span>;
}

function IconBtn({ children, palette, onClick, disabled, title, tone }: { children: React.ReactNode; palette: ThemePalette; onClick: () => void; disabled?: boolean; title?: string; tone?: "danger" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg transition-all"
      style={{ background: tone === "danger" ? "#FDECEC" : palette.soft, color: tone === "danger" ? "#D14343" : palette.primaryDark, border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1 }}
    >
      {children}
    </button>
  );
}

function Input({ palette, value, onChange, placeholder }: { palette: ThemePalette; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rounded-xl px-3.5 py-2.5"
      style={{ background: palette.cardAlt, border: `1px solid ${palette.border}`, fontSize: "14px", color: palette.ink, outline: "none", fontFamily: "'Nunito', sans-serif" }}
    />
  );
}

function PrimaryBtn({ children, palette, onClick }: { children: React.ReactNode; palette: ThemePalette; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mt-3 inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 transition-all hover:opacity-90 active:scale-95"
      style={{ background: palette.activeGradient, color: "#fff", fontSize: "14px", fontWeight: 800, border: "none", cursor: "pointer", fontFamily: "'Nunito', sans-serif" }}
    >
      {children}
    </button>
  );
}

function ErrText({ text }: { text: string }) {
  return <div style={{ fontSize: "13px", color: "#D14343", fontWeight: 700, marginBottom: "10px" }}>{text}</div>;
}
