import { useEffect, useState } from "react";
import {
  LayoutDashboard, Boxes, Rocket, FileText, Users, Activity, BarChart3,
  EyeOff, Eye, Trash2, Plus, ArrowLeft, RotateCw,
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
                    background: active ? palette.activeGradient : palette.glass,
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
            {tab === "system" && <SystemPanel palette={palette} />}
            {tab === "analytics" && <AnalyticsPanel palette={palette} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Panel({ children, palette }: { children: React.ReactNode; palette: ThemePalette }) {
  return (
    <div className="rounded-2xl border p-5 sm:p-6" style={{ background: palette.glass, borderColor: palette.border, boxShadow: `0 12px 30px ${palette.glow}` }}>
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
    ["已验证邮箱", data?.users_verified], ["当前在线", data?.online_now],
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
              {m.status === "active" && !m.builtin && (
                <IconBtn palette={palette} onClick={() => act(() => api.adminRestart(m.module_id), m.module_id)} disabled={busy === m.module_id} title="重启"><RotateCw size={15} /></IconBtn>
              )}
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
            <pre style={{ fontSize: "11px", color: palette.muted, background: palette.cardAlt, borderRadius: "8px", padding: "8px 10px", maxHeight: "180px", overflow: "auto", whiteSpace: "pre-wrap", margin: 0 }}>
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

// ---- 站点内容编辑：schema 驱动，前端定义每个内容块的字段，后台据此渲染表单 ----
type FieldSpec =
  | { kind: "text"; key: string; label: string; multiline?: boolean }
  | { kind: "stringList"; key: string; label: string }
  | { kind: "objectList"; key: string; label: string; fields: { key: string; label: string; multiline?: boolean }[] };

const CONTENT_SCHEMA: Record<string, { title: string; content_type: string; fields: FieldSpec[] }> = {
  "home.hero_subtitle": { title: "首页 · 主标题下副文案", content_type: "plain_text", fields: [{ kind: "text", key: "text", label: "正文", multiline: true }] },
  "home.banner": { title: "首页 · 底部横幅", content_type: "json", fields: [{ kind: "text", key: "title", label: "标题" }, { kind: "text", key: "text", label: "正文", multiline: true }] },
  "home.updates": { title: "首页 · 最近动态", content_type: "json", fields: [{ kind: "objectList", key: "items", label: "动态条目", fields: [{ key: "date", label: "日期" }, { key: "title", label: "标题" }, { key: "desc", label: "描述", multiline: true }] }] },
  "home.notice": { title: "首页公告", content_type: "plain_text", fields: [{ kind: "text", key: "text", label: "公告", multiline: true }] },
  "about.version": { title: "关于 · 当前版本", content_type: "json", fields: [{ kind: "text", key: "current", label: "版本号" }, { kind: "text", key: "release_date", label: "更新日期" }, { kind: "objectList", key: "changelog", label: "更新记录", fields: [{ key: "version", label: "版本" }, { key: "date", label: "日期" }, { key: "note", label: "说明", multiline: true }] }] },
  "about.disclaimer": { title: "关于 · 免责声明", content_type: "json", fields: [{ kind: "stringList", key: "items", label: "条目" }] },
  "about.feedback": { title: "关于 · 技术问题反馈", content_type: "json", fields: [{ kind: "text", key: "email", label: "反馈邮箱" }, { kind: "text", key: "github_url", label: "GitHub 链接" }] },
};
// 编辑器里展示的顺序
const CONTENT_ORDER = ["home.hero_subtitle", "home.banner", "home.updates", "home.notice", "about.version", "about.disclaimer", "about.feedback"];

function FieldLabel({ palette, children }: { palette: ThemePalette; children: React.ReactNode }) {
  return <div style={{ fontSize: "12px", fontWeight: 800, color: palette.muted, margin: "6px 0 4px" }}>{children}</div>;
}

function TextArea({ palette, value, onChange, rows = 2 }: { palette: ThemePalette; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className="w-full rounded-xl px-3.5 py-2.5"
      style={{ background: palette.cardAlt, border: `1px solid ${palette.border}`, fontSize: "14px", color: palette.ink, outline: "none", fontFamily: "'Nunito', sans-serif", resize: "vertical" }}
    />
  );
}

function ContentEditor({ schema, draft, setDraft, palette }: { schema: { fields: FieldSpec[] }; draft: any; setDraft: (d: any) => void; palette: ThemePalette }) {
  const setAt = (key: string, val: any) => setDraft({ ...draft, [key]: val });
  return (
    <div className="flex flex-col">
      {schema.fields.map((f) => {
        if (f.kind === "text") {
          return (
            <div key={f.key}>
              <FieldLabel palette={palette}>{f.label}</FieldLabel>
              {f.multiline
                ? <TextArea palette={palette} value={draft[f.key] ?? ""} onChange={(v) => setAt(f.key, v)} rows={3} />
                : <Input palette={palette} value={draft[f.key] ?? ""} onChange={(v) => setAt(f.key, v)} placeholder={f.label} />}
            </div>
          );
        }
        if (f.kind === "stringList") {
          const list: string[] = Array.isArray(draft[f.key]) ? draft[f.key] : [];
          const upd = (i: number, v: string) => setAt(f.key, list.map((x, j) => (j === i ? v : x)));
          return (
            <div key={f.key}>
              <FieldLabel palette={palette}>{f.label}</FieldLabel>
              <div className="flex flex-col gap-2">
                {list.map((s, i) => (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1"><TextArea palette={palette} value={s} onChange={(v) => upd(i, v)} rows={2} /></div>
                    <IconBtn palette={palette} tone="danger" onClick={() => setAt(f.key, list.filter((_, j) => j !== i))} title="删除该条"><Trash2 size={14} /></IconBtn>
                  </div>
                ))}
                <button onClick={() => setAt(f.key, [...list, ""])} className="inline-flex items-center gap-1 self-start" style={{ fontSize: "13px", fontWeight: 700, color: palette.primaryDark, background: "none", border: "none", cursor: "pointer" }}>
                  <Plus size={14} /> 新增一条
                </button>
              </div>
            </div>
          );
        }
        // objectList
        const list: any[] = Array.isArray(draft[f.key]) ? draft[f.key] : [];
        const updRow = (i: number, k: string, v: string) => setAt(f.key, list.map((row, j) => (j === i ? { ...row, [k]: v } : row)));
        const blank = Object.fromEntries(f.fields.map((c) => [c.key, ""]));
        return (
          <div key={f.key}>
            <FieldLabel palette={palette}>{f.label}</FieldLabel>
            <div className="flex flex-col gap-2.5">
              {list.map((row, i) => (
                <div key={i} className="rounded-xl p-3" style={{ background: palette.cardAlt, border: `1px solid ${palette.border}` }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span style={{ fontSize: "11px", fontWeight: 800, color: palette.muted }}>第 {i + 1} 条</span>
                    <IconBtn palette={palette} tone="danger" onClick={() => setAt(f.key, list.filter((_, j) => j !== i))} title="删除该条"><Trash2 size={14} /></IconBtn>
                  </div>
                  {f.fields.map((c) => (
                    <div key={c.key}>
                      <FieldLabel palette={palette}>{c.label}</FieldLabel>
                      {c.multiline
                        ? <TextArea palette={palette} value={row[c.key] ?? ""} onChange={(v) => updRow(i, c.key, v)} rows={2} />
                        : <Input palette={palette} value={row[c.key] ?? ""} onChange={(v) => updRow(i, c.key, v)} placeholder={c.label} />}
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={() => setAt(f.key, [...list, { ...blank }])} className="inline-flex items-center gap-1 self-start" style={{ fontSize: "13px", fontWeight: 700, color: palette.primaryDark, background: "none", border: "none", cursor: "pointer" }}>
                <Plus size={14} /> 新增一条
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContentPanel({ palette }: { palette: ThemePalette }) {
  const { data, err, reload } = useAsync<any[]>(() => api.adminContents());
  const [editKey, setEditKey] = useState("");
  const [draft, setDraft] = useState<any>({});
  const [saving, setSaving] = useState(false);
  // 发布即将上线入口
  const [cs, setCs] = useState({ module_id: "", name: "", description: "", category: "工具" });
  const [msg, setMsg] = useState("");

  const byKey: Record<string, any> = {};
  for (const c of data ?? []) byKey[c.content_key] = c;
  // 已知内容块按既定顺序展示；其余未知的追加在后面（用纯文本编辑）
  const knownKeys = CONTENT_ORDER.filter((k) => byKey[k]);
  const otherKeys = (data ?? []).map((c) => c.content_key).filter((k: string) => !CONTENT_SCHEMA[k]);

  const startEdit = (key: string) => {
    setMsg("");
    setEditKey(key);
    const cur = byKey[key]?.content_value ?? {};
    setDraft(JSON.parse(JSON.stringify(cur)));  // 深拷贝，避免直接改到列表数据
  };

  const save = async () => {
    const schema = CONTENT_SCHEMA[editKey];
    setSaving(true);
    try {
      await api.adminUpsertContent(editKey, {
        title: schema?.title ?? byKey[editKey]?.title ?? editKey,
        content_type: schema?.content_type ?? byKey[editKey]?.content_type ?? "plain_text",
        content_value: draft,
        status: "published",
      });
      setMsg("内容已保存，前端刷新即可看到");
      setEditKey("");
      reload();
    } catch (e) { setMsg(e instanceof ApiError ? e.message : "保存失败"); }
    finally { setSaving(false); }
  };

  const publish = async () => {
    try {
      await api.adminPublishComingSoon(cs);
      setMsg(`已发布即将上线入口：${cs.name}`);
      setCs({ module_id: "", name: "", description: "", category: "工具" });
    } catch (e) { setMsg(e instanceof ApiError ? e.message : "发布失败"); }
  };

  const schema = CONTENT_SCHEMA[editKey];

  return (
    <div className="flex flex-col gap-5">
      {/* 站点文字内容编辑 */}
      <Panel palette={palette}>
        <H2 palette={palette}>站点内容编辑</H2>
        <div style={{ fontSize: "13px", color: palette.muted, lineHeight: 1.7, marginBottom: "12px" }}>
          直接在这里维护首页、关于页等处的文字，保存后用户刷新即可看到，无需改代码。
        </div>
        {err && <ErrText text={err} />}
        <div className="flex flex-col gap-2">
          {[...knownKeys, ...otherKeys].map((key) => {
            const c = byKey[key];
            const title = CONTENT_SCHEMA[key]?.title || c?.title || key;
            return (
              <button
                key={key}
                onClick={() => startEdit(key)}
                className="flex items-center justify-between rounded-xl px-4 py-2.5 text-left transition-all"
                style={{ background: editKey === key ? palette.soft : palette.cardAlt, border: `1px solid ${editKey === key ? palette.strongBorder : palette.border}`, cursor: "pointer" }}
              >
                <span style={{ fontSize: "13px", fontWeight: 800, color: palette.ink }}>{title}</span>
                <span style={{ fontSize: "11px", color: palette.muted }}>{key} · v{c?.version ?? 1}</span>
              </button>
            );
          })}
        </div>

        {editKey && (
          <div className="mt-4 rounded-xl p-4" style={{ background: palette.soft, border: `1px solid ${palette.strongBorder}` }}>
            <div className="flex items-center justify-between mb-1">
              <span style={{ fontSize: "14px", fontWeight: 900, color: palette.ink }}>{CONTENT_SCHEMA[editKey]?.title || editKey}</span>
              <button onClick={() => setEditKey("")} style={{ fontSize: "12px", color: palette.muted, background: "none", border: "none", cursor: "pointer" }}>收起</button>
            </div>
            {schema ? (
              <ContentEditor schema={schema} draft={draft} setDraft={setDraft} palette={palette} />
            ) : (
              <>
                <FieldLabel palette={palette}>正文</FieldLabel>
                <TextArea palette={palette} value={draft.text ?? ""} onChange={(v) => setDraft({ ...draft, text: v })} rows={3} />
              </>
            )}
            <PrimaryBtn palette={palette} onClick={save}>{saving ? "保存中…" : "保存"}</PrimaryBtn>
          </div>
        )}
      </Panel>

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

      {msg && <div style={{ fontSize: "13px", color: palette.primaryDark, fontWeight: 700 }}>{msg}</div>}
    </div>
  );
}

function UsersPanel({ palette }: { palette: ThemePalette }) {
  const { data, err, reload } = useAsync<ApiUser[]>(() => api.adminUsers());
  const [busy, setBusy] = useState("");
  const toggle = async (u: ApiUser) => {
    if (u.status === "active") {
      // 禁用属敏感操作：要求二次输入管理员密码
      const pw = prompt(`禁用用户「${u.nickname || u.username}」需要验证你的管理员密码：`);
      if (!pw) return;
      try { await api.adminDisableUser(u.id, pw); reload(); }
      catch (e) { alert(e instanceof ApiError ? e.message : "操作失败"); }
    } else {
      try { await api.adminEnableUser(u.id); reload(); }
      catch (e) { alert(e instanceof ApiError ? e.message : "操作失败"); }
    }
  };
  const remove = async (u: ApiUser) => {
    if (!confirm(`确定删除用户「${u.nickname || u.username}」(@${u.username})？\n\n该操作不可恢复：将彻底删除账号并释放其用户名与邮箱以便重新注册（uid 不会被复用）。`)) return;
    const pw = prompt(`删除用户「${u.nickname || u.username}」需要验证你的管理员密码：`);
    if (!pw) return;
    setBusy(u.id);
    try { await api.adminDeleteUser(u.id, pw); reload(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "删除失败"); }
    finally { setBusy(""); }
  };
  const resetTotp = async (u: ApiUser) => {
    if (!confirm(`重置「${u.nickname || u.username}」的二次验证？\n对方下次登录会重新引导绑定 Authenticator（用于其丢失验证器时由你恢复）。`)) return;
    const pw = prompt(`重置二次验证需要验证你的管理员密码：`);
    if (!pw) return;
    setBusy(u.id);
    try { await api.adminResetTotp(u.id, pw); alert("已重置该用户的二次验证"); reload(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "操作失败"); }
    finally { setBusy(""); }
  };
  return (
    <Panel palette={palette}>
      <H2 palette={palette}>用户管理</H2>
      {err && <ErrText text={err} />}
      <div className="flex flex-col gap-2">
        {(data ?? []).map((u) => (
          <div key={u.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: palette.cardAlt, border: `1px solid ${palette.border}` }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span style={{ fontSize: "14px", fontWeight: 800, color: palette.ink }}>{u.nickname || u.username}</span>
                <Tag palette={palette}>ID {u.uid_display}</Tag>
                {u.role === "admin" && <Tag palette={palette} tone="warn">管理员</Tag>}
                <Tag palette={palette} tone={u.status === "active" ? undefined : "danger"}>{u.status === "active" ? "正常" : u.status === "disabled" ? "已禁用" : "已注销"}</Tag>
                {u.email_verified ? <Tag palette={palette} tone="ok">已验证邮箱</Tag> : <Tag palette={palette} tone="warn">未验证邮箱</Tag>}
              </div>
              <div className="truncate" style={{ fontSize: "12px", color: palette.muted, fontWeight: 600 }}>@{u.username} · {u.email}</div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {u.role === "admin" ? (
                <button
                  onClick={() => resetTotp(u)}
                  disabled={busy === u.id}
                  className="rounded-lg px-3 py-1.5"
                  style={{ background: palette.soft, color: palette.primaryDark, border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 800, fontFamily: "'Nunito', sans-serif" }}
                  title="重置该管理员的动态验证器（丢失验证器时恢复）"
                >
                  重置 2FA
                </button>
              ) : (
                <>
                  <button
                    onClick={() => toggle(u)}
                    className="rounded-lg px-3 py-1.5"
                    style={{ background: u.status === "active" ? "#FDECEC" : palette.soft, color: u.status === "active" ? "#D14343" : palette.primaryDark, border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 800, fontFamily: "'Nunito', sans-serif" }}
                  >
                    {u.status === "active" ? "禁用" : "启用"}
                  </button>
                  <IconBtn palette={palette} tone="danger" onClick={() => remove(u)} disabled={busy === u.id} title="删除用户（释放用户名/邮箱）">
                    <Trash2 size={15} />
                  </IconBtn>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function StatCard({ label, value, palette }: { label: string; value: React.ReactNode; palette: ThemePalette }) {
  return (
    <div className="rounded-xl px-4 py-4" style={{ background: palette.soft, border: `1px solid ${palette.border}` }}>
      <div style={{ fontSize: "22px", fontWeight: 900, color: palette.ink }}>{value}</div>
      <div style={{ fontSize: "12px", fontWeight: 700, color: palette.muted, marginTop: "2px" }}>{label}</div>
    </div>
  );
}

function SystemPanel({ palette }: { palette: ThemePalette }) {
  const { data, err } = useAsync<any>(() => api.adminSystemStatus());
  const s = data || {};
  const pct = (v: number | null | undefined) => (v == null ? "—" : `${v}%`);
  return (
    <Panel palette={palette}>
      <H2 palette={palette}>系统状态</H2>
      {err && <ErrText text={err} />}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard palette={palette} label="主站后端" value={s.backend === "up" ? "正常" : "—"} />
        <StatCard palette={palette} label="数据库" value={s.database === "up" ? "正常" : (s.database ? "异常" : "—")} />
        <StatCard palette={palette} label="部署方式" value={s.deploy_mode ?? "—"} />
        <StatCard palette={palette} label="CPU" value={pct(s.cpu_percent)} />
        <StatCard palette={palette} label="内存" value={pct(s.mem_percent)} />
        <StatCard palette={palette} label="磁盘" value={pct(s.disk_percent)} />
        <StatCard palette={palette} label="运行中模块" value={`${s.modules_running ?? 0} / ${s.modules_total ?? 0}`} />
      </div>
      {(s.modules || []).length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {s.modules.map((m: any) => (
            <div key={m.module_id} className="flex items-center justify-between rounded-xl px-4 py-2.5" style={{ background: palette.cardAlt, border: `1px solid ${palette.border}` }}>
              <span style={{ fontSize: "13px", fontWeight: 800, color: palette.ink }}>{m.name}</span>
              <span className="inline-flex items-center gap-1.5" style={{ fontSize: "12px", fontWeight: 700, color: m.healthy ? "#0E8A6A" : palette.muted }}>
                <span className="h-2 w-2 rounded-full" style={{ background: m.healthy ? "#22c55e" : m.status === "active" ? "#f59e0b" : "#cbd5e1" }} />
                {m.healthy ? "健康" : m.status === "active" ? "未响应" : "未运行"}
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function RankList({ rows, keyName, palette }: { rows: any[] | null; keyName: string; palette: ThemePalette }) {
  if (!rows || rows.length === 0) return <div style={{ fontSize: "13px", color: palette.muted }}>暂无数据</div>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex items-center justify-between" style={{ fontSize: "12px", color: palette.ink, fontWeight: 700 }}>
            <span className="truncate">{r[keyName] || "（首页）"}</span>
            <span style={{ color: palette.muted }}>{r.count}</span>
          </div>
          <div style={{ height: "6px", borderRadius: "3px", background: palette.soft, marginTop: "3px" }}>
            <div style={{ width: `${Math.round((r.count / max) * 100)}%`, height: "100%", borderRadius: "3px", background: palette.activeGradient }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  // 后端时间为 naive UTC，补 Z 后按本地时区显示
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : iso + "Z");
  if (isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function VisitorName({ v, palette }: { v: { kind: string; name: string; uid_display: string; username: string; ip: string }; palette: ThemePalette }) {
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: v.kind === "user" ? "#22c55e" : "#cbd5e1" }} />
      <span className="truncate" style={{ fontSize: "13px", fontWeight: 800, color: palette.ink }}>{v.name}</span>
      {v.kind === "user" && v.uid_display && <Tag palette={palette}>ID {v.uid_display}</Tag>}
      {v.kind === "guest" && <span style={{ fontSize: "11px", color: palette.muted }}>{v.ip}</span>}
    </span>
  );
}

function VisitorsPanel({ palette }: { palette: ThemePalette }) {
  const { data, err, reload } = useAsync<any>(() => api.adminAnalyticsVisitors());
  const d = data || {};
  const online: any[] = d.online || [];
  const recent: any[] = d.recent || [];
  return (
    <Panel palette={palette}>
      <div className="flex items-center justify-between mb-3">
        <H2 palette={palette}>在线与最近访问</H2>
        <button onClick={reload} className="inline-flex items-center gap-1" style={{ fontSize: "12px", fontWeight: 700, color: palette.primaryDark, background: "none", border: "none", cursor: "pointer" }}>
          <RotateCw size={13} /> 刷新
        </button>
      </div>
      {err && <ErrText text={err} />}
      <div style={{ fontSize: "13px", fontWeight: 800, color: palette.ink, marginBottom: "8px" }}>
        当前在线（最近 {d.window_minutes ?? 5} 分钟）· {d.online_count ?? 0} 人
      </div>
      {online.length === 0 ? (
        <div style={{ fontSize: "13px", color: palette.muted, marginBottom: "8px" }}>暂时没有人在线</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-4">
          {online.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2" style={{ background: palette.soft, border: `1px solid ${palette.border}` }}>
              <VisitorName v={v} palette={palette} />
              <span className="flex items-center gap-3 flex-shrink-0">
                <span className="truncate" style={{ fontSize: "12px", fontWeight: 700, color: palette.ink, maxWidth: "150px" }} title={v.last_path}>{v.feature || "主页"}</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: palette.primaryDark }}>{fmtTime(v.last_seen)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ fontSize: "13px", fontWeight: 800, color: palette.ink, margin: "4px 0 8px" }}>最近访问明细</div>
      {recent.length === 0 ? (
        <div style={{ fontSize: "13px", color: palette.muted }}>暂无访问记录</div>
      ) : (
        <div className="flex flex-col gap-1">
          {recent.map((v, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg px-3 py-1.5" style={{ borderBottom: `1px solid ${palette.border}` }}>
              <VisitorName v={v} palette={palette} />
              <span className="flex items-center gap-3 flex-shrink-0">
                <span className="truncate" style={{ fontSize: "12px", fontWeight: 700, color: palette.ink, maxWidth: "150px" }} title={v.path}>{v.feature || "主页"}</span>
                <span style={{ fontSize: "11px", color: palette.muted }}>{fmtTime(v.created_at)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AnalyticsPanel({ palette }: { palette: ThemePalette }) {
  const ov = useAsync<any>(() => api.adminAnalyticsOverview());
  const paths = useAsync<any[]>(() => api.adminAnalyticsPaths());
  const mods = useAsync<any[]>(() => api.adminAnalyticsModules());
  const o = ov.data || {};
  const last7: any[] = o.last_7_days || [];
  const maxpv = Math.max(1, ...last7.map((d) => d.pv));
  return (
    <div className="flex flex-col gap-5">
      <Panel palette={palette}>
        <H2 palette={palette}>访问概览</H2>
        {ov.err && <ErrText text={ov.err} />}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard palette={palette} label="今日 PV" value={o.today_pv ?? 0} />
          <StatCard palette={palette} label="今日 UV" value={o.today_uv ?? 0} />
          <StatCard palette={palette} label="总 PV" value={o.total_pv ?? 0} />
          <StatCard palette={palette} label="总 UV" value={o.total_uv ?? 0} />
        </div>
        <div className="mt-4 flex items-end gap-2" style={{ height: "86px" }}>
          {last7.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center justify-end gap-1" style={{ height: "100%" }}>
              <div title={`${d.date}: ${d.pv}`} style={{ width: "100%", height: `${Math.round((d.pv / maxpv) * 60) + 2}px`, background: palette.activeGradient, borderRadius: "4px" }} />
              <span style={{ fontSize: "10px", color: palette.muted }}>{String(d.date).slice(5)}</span>
            </div>
          ))}
        </div>
      </Panel>
      <VisitorsPanel palette={palette} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Panel palette={palette}><H2 palette={palette}>访问路径 Top</H2><RankList rows={paths.data} keyName="path" palette={palette} /></Panel>
        <Panel palette={palette}><H2 palette={palette}>模块访问 Top</H2><RankList rows={mods.data} keyName="module_id" palette={palette} /></Panel>
      </div>
    </div>
  );
}

/* ---- 小组件 ---- */
function Tag({ children, palette, tone }: { children: React.ReactNode; palette: ThemePalette; tone?: "warn" | "danger" | "ok" }) {
  const bg = tone === "danger" ? "#FDECEC" : tone === "ok" ? "#E7F8F1" : tone === "warn" ? palette.softAlt : palette.soft;
  const color = tone === "danger" ? "#D14343" : tone === "ok" ? "#0E8A6A" : palette.primaryDark;
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
