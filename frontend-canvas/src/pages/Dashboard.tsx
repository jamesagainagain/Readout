import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Copy, Pencil, Check, RotateCcw, MessageSquare, Mail, Linkedin, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useReadout } from "@/context/ReadoutContext";
import { getDrafts, generate, ingest, type Draft } from "@/lib/readoutApi";

export default function Dashboard() {
  const { brief_id, repoLabel, setKnowledgeId } = useReadout();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(true);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");

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

  const redditDrafts = drafts.filter(d => d.channel === "reddit");
  const emailCount = drafts.filter(d => d.channel === "email").length;
  const linkedinCount = drafts.filter(d => d.channel === "linkedin").length;

  const channels = [
    { name: "Reddit", icon: MessageSquare, count: redditDrafts.length, status: "ready" },
    { name: "Email", icon: Mail, count: emailCount, status: emailCount ? "ready" : "Not generated" },
    { name: "LinkedIn", icon: Linkedin, count: linkedinCount, status: linkedinCount ? "ready" : "Not set up" },
  ];

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
        <div className="grid grid-cols-3 gap-4">
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
                        className="text-sm leading-relaxed"
                      >
                        "{draft.body}"
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
      </div>
    </DashboardLayout>
  );
}
