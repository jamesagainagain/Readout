import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Copy, Pencil, Check, RotateCcw, MessageSquare, Mail, Linkedin, Loader2, X, TrendingUp, Users, MousePointerClick, Sparkles, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useReadout } from "@/context/ReadoutContext";
import { getDrafts, generate, ingest, analyzeEngagement, type Draft } from "@/lib/readoutApi";
import { PlayButton } from "@/components/PlayButton";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

// ── mock data generators ──────────────────────────────────────────────────────
function seededNoise(seed: number, i: number) {
  const x = Math.sin(seed + i * 9.301) * 43758.5453;
  return x - Math.floor(x);
}

function generateReachData() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day, i) => ({
    day,
    Reddit: Math.round(40 + seededNoise(1, i) * 160 + i * 12),
    Email:  Math.round(20 + seededNoise(2, i) * 80  + i * 6),
    LinkedIn: Math.round(10 + seededNoise(3, i) * 50 + i * 4),
  }));
}

function generateEngagementData() {
  return [
    { channel: "Reddit",   upvotes: 142, comments: 38, shares: 12 },
    { channel: "Email",    upvotes: 0,   comments: 0,  shares: 24 },
    { channel: "LinkedIn", upvotes: 67,  comments: 14, shares: 9  },
  ];
}

function generatePostPerformance() {
  return Array.from({ length: 7 }, (_, i) => ({
    post: `Post ${i + 1}`,
    score: Math.round(30 + seededNoise(7, i) * 120),
    clicks: Math.round(10 + seededNoise(11, i) * 60),
  }));
}

// ── tiny custom tooltip ───────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="readout-card p-2.5 text-xs shadow-lg min-w-[120px]">
      <p className="font-mono font-medium mb-1.5 text-muted-foreground">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-mono font-semibold">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { brief_id, repoLabel, setKnowledgeId } = useReadout();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [showEngagementAnalytics, setShowEngagementAnalytics] = useState(true);
  const [engagementAnalysis, setEngagementAnalysis] = useState<string | null>(null);
  const [analyzingEngagement, setAnalyzingEngagement] = useState(false);

  const fetchDrafts = useCallback(async () => {
    if (!brief_id) return;
    setLoadingDrafts(true);
    try {
      const res = await getDrafts(brief_id);
      setDrafts(res.drafts);
    } finally {
      setLoadingDrafts(false);
    }
  }, [brief_id]);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const handleCopy = (idx: number, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleSync = async () => {
    if (!repoLabel) return;
    const parts = repoLabel.split("/");
    if (parts.length !== 2) return;
    setSyncing(true);
    try {
      const res = await ingest({ owner: parts[0], repo: parts[1] });
      setKnowledgeId(res.knowledge_id);
      await fetchDrafts();
    } finally {
      setSyncing(false);
    }
  };

  const handleRegenerate = async () => {
    if (!brief_id) return;
    setRegenerating(true);
    try {
      await generate({ brief_id, channel: "reddit", count: 3 });
      await fetchDrafts();
    } finally {
      setRegenerating(false);
    }
  };

  const openEdit = (idx: number) => {
    setEditingIdx(idx);
    setEditValue(drafts[idx].body);
  };

  const saveEdit = () => {
    if (editingIdx === null) return;
    setDrafts(prev => prev.map((d, i) => i === editingIdx ? { ...d, body: editValue } : d));
    setEditingIdx(null);
  };

  const cancelEdit = () => setEditingIdx(null);

  const engagementStats = [
    { label: "Total Reach", value: "1,284", delta: "+18%" },
    { label: "Avg. Clicks", value: "34", delta: "+7%" },
    { label: "Engagement Rate", value: "4.2%", delta: "+1.1%" },
  ];

  const handleAnalyzeEngagement = async () => {
    setAnalyzingEngagement(true);
    setEngagementAnalysis(null);
    try {
      const res = await analyzeEngagement({
        stats: engagementStats,
        reach_by_day: reachData,
        channel_breakdown: engagementData,
        post_performance: postPerf,
      });
      setEngagementAnalysis(res.analysis);
    } catch {
      setEngagementAnalysis("Analysis failed. Please try again.");
    } finally {
      setAnalyzingEngagement(false);
    }
  };

  const redditDrafts = drafts.filter(d => d.channel === "reddit");
  const hnDrafts = drafts.filter(d => d.channel === "hackernews");
  const emailCount = drafts.filter(d => d.channel === "email").length;
  const linkedinCount = drafts.filter(d => d.channel === "linkedin").length;

  const reachData = useMemo(generateReachData, []);
  const engagementData = useMemo(generateEngagementData, []);
  const postPerf = useMemo(generatePostPerformance, []);

  const channels = [
    { name: "Reddit", icon: MessageSquare, count: redditDrafts.length, status: "ready" },
    { name: "Hacker News", icon: Flame, count: hnDrafts.length, status: hnDrafts.length ? "ready" : "Not generated" },
    { name: "Email", icon: Mail, count: emailCount, status: emailCount ? "ready" : "Not generated" },
    { name: "LinkedIn", icon: Linkedin, count: linkedinCount, status: linkedinCount ? "ready" : "Not set up" },
  ];

  const [regeneratingHN, setRegeneratingHN] = useState(false);

  const handleRegenerateHN = async () => {
    if (!brief_id) return;
    setRegeneratingHN(true);
    try {
      await generate({ brief_id, channel: "hackernews", count: 3 });
      await fetchDrafts();
    } finally {
      setRegeneratingHN(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1100px] mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="readout-card p-4 flex items-center justify-between">
          <div>
            <h2 className="font-mono text-sm font-medium">{repoLabel ?? "—"}</h2>
            <p className="text-sm text-muted-foreground">
              {brief_id ? `Brief ready · ${drafts.length} draft${drafts.length !== 1 ? "s" : ""} generated` : "No brief yet"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing || !repoLabel}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin-slow" : ""}`} />
            {syncing ? "Syncing..." : "Re-sync"}
          </Button>
        </div>

        {/* Channel cards */}
        <div className="grid grid-cols-4 gap-4">
          {channels.map((ch, i) => (
            <motion.div
              key={ch.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="readout-card-hover p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <ch.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{ch.name}</span>
              </div>
              {ch.count > 0 ? (
                <p className="text-sm text-muted-foreground">
                  <span className="font-mono text-[hsl(var(--primary))]">{ch.count}</span> draft{ch.count !== 1 ? "s" : ""} ready
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{ch.status}</p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Engagement Analytics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold">Engagement Analytics</h3>
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded-full">mock data</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="engagement-analytics"
                checked={showEngagementAnalytics}
                onCheckedChange={setShowEngagementAnalytics}
              />
              <Label htmlFor="engagement-analytics" className="text-sm text-muted-foreground cursor-pointer">
                Show analytics
              </Label>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleAnalyzeEngagement}
                disabled={analyzingEngagement || !showEngagementAnalytics}
              >
                {analyzingEngagement ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {analyzingEngagement ? "Analyzing…" : "Analyze"}
              </Button>
            </div>
          </div>

          {showEngagementAnalytics && (
          <>
          <div className="grid grid-cols-3 gap-3 mb-1">
            {engagementStats.map((stat, i) => {
              const iconMap = [Users, MousePointerClick, TrendingUp];
              const Icon = iconMap[i] ?? TrendingUp;
              return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="readout-card p-4"
              >
                <div className="flex items-center gap-2 mb-1 text-muted-foreground">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs">{stat.label}</span>
                </div>
                <p className="text-2xl font-mono font-semibold">{stat.value}</p>
                <p className="text-xs text-[hsl(var(--sage))] mt-0.5">{stat.delta} this week</p>
              </motion.div>
            );
            })}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Reach over time */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="readout-card p-4 space-y-3"
            >
              <p className="text-sm font-medium">Reach by Channel (7 days)</p>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={reachData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gReddit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gEmail" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--sage))" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="hsl(var(--sage))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gLinkedIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Reddit"   stroke="hsl(var(--primary))" fill="url(#gReddit)"   strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="Email"    stroke="hsl(var(--sage))"    fill="url(#gEmail)"    strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="LinkedIn" stroke="#60a5fa"             fill="url(#gLinkedIn)" strokeWidth={2} dot={false} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Post performance */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="readout-card p-4 space-y-3"
            >
              <p className="text-sm font-medium">Post Performance (score vs clicks)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={postPerf} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="post" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="score"  fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Bar dataKey="clicks" fill="hsl(var(--sage))"    radius={[3, 3, 0, 0]} maxBarSize={18} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Channel engagement breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="readout-card p-4 space-y-3"
          >
            <p className="text-sm font-medium">Channel Engagement Breakdown</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={engagementData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }} barGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="channel" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={64} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="upvotes"  fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} maxBarSize={14} />
                <Bar dataKey="comments" fill="hsl(var(--sage))"    radius={[0, 3, 3, 0]} maxBarSize={14} />
                <Bar dataKey="shares"   fill="#60a5fa"             radius={[0, 3, 3, 0]} maxBarSize={14} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {engagementAnalysis !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="readout-card p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--sage))]" />
                  AI analysis
                </p>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEngagementAnalysis(null)} aria-label="Dismiss">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{engagementAnalysis}</p>
            </motion.div>
          )}
          </>
          )}
        </div>

        {/* Reddit Drafts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Reddit Drafts</h3>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleRegenerate} disabled={regenerating || !brief_id}>
              {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {regenerating ? "Regenerating..." : "Regenerate"}
            </Button>
          </div>

          {loadingDrafts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading drafts…
            </div>
          ) : redditDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No Reddit drafts yet. Click Regenerate to create some.</p>
          ) : (
            redditDrafts.map((draft, i) => {
              const subreddit = (draft.metadata as Record<string, string> | undefined)?.subreddit
                ? `r/${(draft.metadata as Record<string, string>).subreddit}`
                : draft.title ?? `Draft ${i + 1}`;
              const words = draft.body.split(/\s+/).length;
              const isEditing = editingIdx === i;

              return (
                <motion.div
                  key={draft.id ?? i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                  className="readout-card-hover p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm text-muted-foreground">{subreddit}</span>
                    <div className="flex items-center gap-2">
                      {!isEditing && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8"
                            onClick={() => handleCopy(i, draft.body)}
                          >
                            {copiedIdx === i ? (
                              <><Check className="h-3.5 w-3.5 text-[hsl(var(--sage))]" /> Copied</>
                            ) : (
                              <><Copy className="h-3.5 w-3.5" /> Copy</>
                            )}
                          </Button>
                          <PlayButton text={draft.body} />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 h-8"
                            onClick={() => openEdit(i)}
                          >
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <AnimatePresence mode="wait">
                    {isEditing ? (
                      <motion.div
                        key="editor"
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="space-y-3"
                      >
                        <Textarea
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="bg-background min-h-[120px] text-sm leading-relaxed"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button size="sm" className="gap-1.5 bg-[hsl(var(--primary))] text-primary-foreground" onClick={saveEdit}>
                            <Check className="h-3.5 w-3.5" /> Save
                          </Button>
                          <Button size="sm" variant="ghost" className="gap-1.5" onClick={cancelEdit}>
                            <X className="h-3.5 w-3.5" /> Cancel
                          </Button>
                        </div>
                      </motion.div>
                    ) : (
                      <motion.p
                        key="body"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-sm leading-relaxed bg-muted/40 rounded-lg p-4 border border-border/50 whitespace-pre-wrap"
                      >
                        {draft.body}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {!isEditing && (
                    <div className="flex items-center gap-3">
                      <span className="sage-badge">{words} words</span>
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>
        {/* Hacker News Drafts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-500" />
              Hacker News Drafts
            </h3>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleRegenerateHN} disabled={regeneratingHN || !brief_id}>
              {regeneratingHN ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {regeneratingHN ? "Generating..." : "Generate"}
            </Button>
          </div>

          {loadingDrafts ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading drafts…
            </div>
          ) : hnDrafts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No Hacker News drafts yet. Click Generate to create some.</p>
          ) : (
            hnDrafts.map((draft, i) => (
              <motion.div
                key={draft.id ?? `hn-${i}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                className="rounded border border-orange-200 dark:border-orange-900/40 bg-[#f6f6ef] dark:bg-[#1a1a17] p-5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm font-bold"
                    style={{ fontFamily: "Verdana, Geneva, sans-serif", color: "#000" }}
                  >
                    {draft.title ?? `Show HN: Draft ${i + 1}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 h-8"
                      onClick={() => handleCopy(i + 1000, `${draft.title ?? ""}\n\n${draft.body}`)}
                    >
                      {copiedIdx === i + 1000 ? (
                        <><Check className="h-3.5 w-3.5 text-[hsl(var(--sage))]" /> Copied</>
                      ) : (
                        <><Copy className="h-3.5 w-3.5" /> Copy</>
                      )}
                    </Button>
                    <PlayButton text={draft.body} />
                  </div>
                </div>
                <p
                  className="text-[13px] leading-relaxed whitespace-pre-wrap"
                  style={{ fontFamily: "Verdana, Geneva, sans-serif", color: "#828282" }}
                >
                  {draft.body}
                </p>
                <div className="flex items-center gap-3 text-xs" style={{ fontFamily: "Verdana, Geneva, sans-serif", color: "#828282" }}>
                  <span>{draft.body.split(/\s+/).length} words</span>
                  <span>·</span>
                  <span className="text-orange-600">news.ycombinator.com</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
