import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Check, Loader2, CornerDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useNavigate } from "react-router-dom";
import { useReadout } from "@/context/ReadoutContext";
import { discoverSubreddits, generate, type SubredditInfo } from "@/lib/readoutApi";

export default function RedditDiscover() {
  const navigate = useNavigate();
  const { brief_id, repoLabel } = useReadout();
  const [subreddits, setSubreddits] = useState<SubredditInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customSubs, setCustomSubs] = useState<SubredditInfo[]>([]);

  useEffect(() => {
    if (!brief_id) return;
    setLoading(true);
    setError(null);
    discoverSubreddits({ brief_id })
      .then(res => setSubreddits(res.subreddits))
      .catch(e => setError(e instanceof Error ? e.message : "Discovery failed"))
      .finally(() => setLoading(false));
  }, [brief_id]);

  const toggle = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const allSubs = [...subreddits, ...customSubs];
  const filtered = allSubs.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  const handleAddCustom = () => {
    const name = search.trim().replace(/^r\//, "");
    if (!name) return;
    if (allSubs.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      // Just select it if already present
      toggle(name);
      setSearch("");
      return;
    }
    const custom: SubredditInfo = { name };
    setCustomSubs(prev => [...prev, custom]);
    setSelected(prev => new Set([...prev, name]));
    setSearch("");
  };

  const handleGenerateDrafts = async () => {
    if (!brief_id) return;
    setGenerating(true);
    try {
      await generate({ brief_id, channel: "reddit", count: selected.size || 3 });
      navigate("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1100px] mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Subreddit Discovery</h1>
          <p className="text-sm text-muted-foreground">Finding communities where your post will land.</p>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleAddCustom(); }}
            placeholder="Search or add a subreddit..."
            className="pl-9 pr-9 bg-background"
          />
          {search && filtered.length === 0 && (
            <button
              onClick={handleAddCustom}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--primary))] hover:opacity-80"
              title={`Add r/${search.replace(/^r\//, "")}`}
            >
              <CornerDownLeft className="h-4 w-4" />
            </button>
          )}
        </div>
        {search && filtered.length === 0 && !loading && (
          <p className="text-sm text-muted-foreground -mt-4">
            Press <kbd className="px-1 rounded border border-border font-mono text-xs">↵</kbd> to add <span className="font-mono">r/{search.replace(/^r\//, "")}</span>
          </p>
        )}

        <p className="text-sm text-muted-foreground font-medium">
          Suggested for <span className="font-mono">{repoLabel ?? "your repo"}</span>
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-12 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" /> Discovering subreddits…
          </div>
        ) : error ? (
          <p className="text-sm text-destructive py-8 text-center">{error}</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((sub, i) => (
              <motion.div
                key={sub.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="readout-card-hover p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">r/{sub.name}</span>
                  {sub.subscribers != null && (
                    <span className="text-sm text-muted-foreground">
                      {sub.subscribers >= 1000
                        ? `${(sub.subscribers / 1000).toFixed(0)}k`
                        : sub.subscribers} subscribers
                    </span>
                  )}
                </div>

                {sub.description && (
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    {sub.description.slice(0, 120)}{sub.description.length > 120 ? "…" : ""}
                  </p>
                )}

                {sub.rationale && (
                  <p className="text-sm text-muted-foreground italic leading-relaxed">
                    {sub.rationale}
                  </p>
                )}

                <Button
                  variant={selected.has(sub.name) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggle(sub.name)}
                  className={`w-full gap-2 ${
                    selected.has(sub.name)
                      ? "bg-[hsl(var(--primary))] text-primary-foreground"
                      : ""
                  }`}
                >
                  {selected.has(sub.name) ? (
                    <><Check className="h-3.5 w-3.5" /> Added</>
                  ) : (
                    <><Plus className="h-3.5 w-3.5" /> Add</>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        )}

        {selected.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="readout-card p-4 flex items-center justify-between"
          >
            <p className="text-sm">
              <span className="text-muted-foreground">Selected:</span>{" "}
              {Array.from(selected).map(n => `r/${n}`).join(" · ")}
            </p>
            <Button
              className="bg-[hsl(var(--primary))] text-primary-foreground gap-2"
              onClick={handleGenerateDrafts}
              disabled={generating}
            >
              {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Generate drafts for {selected.size} subreddit{selected.size > 1 ? "s" : ""}
            </Button>
          </motion.div>
        )}
      </div>
    </DashboardLayout>
  );
}
