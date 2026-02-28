import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Github, Link, Check, FileText, FolderOpen, FileArchive, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useReadout } from "@/context/ReadoutContext";
import { ingest } from "@/lib/readoutApi";

const mockRepos = [
  "james/readout",
  "james/cli-tool",
  "james/docs-site",
  "james/api-gateway",
];

export default function Onboard() {
  const navigate = useNavigate();
  const { setKnowledgeId, setRepoLabel } = useReadout();
  const [repoUrl, setRepoUrl] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [includes, setIncludes] = useState({ readme: true, docs: true, changelog: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredRepos = mockRepos.filter(r =>
    r.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // When dropdown is open, show search filter; when closed, show selected repo so user can re-open and pick a different one
  const inputValue = searchOpen ? searchQuery : (selectedRepo || "");
  const showClear = !!selectedRepo && !searchOpen;

  function openDropdown() {
    if (searchCloseTimerRef.current) {
      clearTimeout(searchCloseTimerRef.current);
      searchCloseTimerRef.current = null;
    }
    setSearchOpen(true);
    setSearchQuery(""); // show all repos so user can pick a different one
  }

  function closeDropdown() {
    searchCloseTimerRef.current = setTimeout(() => setSearchOpen(false), 150);
  }

  function clearSelection() {
    setSelectedRepo("");
    setSearchQuery("");
    setSearchOpen(true);
  }

  const canConnect = (selectedRepo || repoUrl) && !loading;

  function parseOwnerRepo(input: string): { owner: string; repo: string } | null {
    const clean = input.trim().replace(/\/$/, "");
    // https://github.com/owner/repo
    const urlMatch = clean.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
    // owner/repo
    const parts = clean.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) return { owner: parts[0], repo: parts[1] };
    return null;
  }

  async function handleConnect() {
    const raw = selectedRepo || repoUrl;
    const parsed = parseOwnerRepo(raw);
    if (!parsed) {
      setError("Enter a valid GitHub repo (e.g. owner/repo or https://github.com/owner/repo)");
      return;
    }

    const paths: string[] = [];
    if (includes.readme) paths.push("README.md");
    if (includes.docs) paths.push("docs");
    if (includes.changelog) paths.push("CHANGELOG.md");

    setLoading(true);
    setError(null);
    try {
      const res = await ingest({
        owner: parsed.owner,
        repo: parsed.repo,
        paths: paths.length ? paths : undefined,
      });
      setKnowledgeId(res.knowledge_id);
      setRepoLabel(`${parsed.owner}/${parsed.repo}`);
      navigate("/onboard/brief");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to connect repo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="font-mono text-lg font-bold tracking-tight">Readout</span>
        <Button variant="outline" className="gap-2">
          <Github className="h-4 w-4" />
          Sign in with GitHub
        </Button>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-lg"
        >
          {/* Headline */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-semibold tracking-tight mb-2">
              Turn your repo into outreach.
            </h1>
            <p className="text-muted-foreground text-base">
              Reddit. Email. LinkedIn. One brain.
            </p>
          </div>

          {/* Card */}
          <div className="readout-card p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">Step 1 of 3</span>
            </div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Link className="h-5 w-5 text-[hsl(var(--primary))]" />
              Connect your GitHub repo
            </h2>

            {/* Repo search */}
            <div className="space-y-2">
              <div className="relative">
                <Input
                  placeholder="Search your repositories..."
                  value={inputValue}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={openDropdown}
                  onBlur={closeDropdown}
                  className="bg-background pr-9"
                />
                {showClear && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); clearSelection(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label="Clear selection"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {searchOpen && (
                  <div className="absolute z-10 w-full mt-1 readout-card border max-h-48 overflow-auto">
                    {filteredRepos.map(repo => (
                      <button
                        key={repo}
                        type="button"
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                          selectedRepo === repo ? "bg-[hsl(var(--accent-light))] text-[hsl(var(--primary))]" : ""
                        }`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedRepo(repo);
                          setSearchOpen(false);
                        }}
                      >
                        <Github className="h-3.5 w-3.5" />
                        {repo}
                        {selectedRepo === repo && <Check className="h-3.5 w-3.5 ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Or paste URL */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>or paste a public repo URL</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Input
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              className="bg-background"
            />

            {/* Includes */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Include from repo</p>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: "readme" as const, label: "README.md", icon: FileText },
                  { key: "docs" as const, label: "/docs", icon: FolderOpen },
                  { key: "changelog" as const, label: "CHANGELOG", icon: FileArchive },
                ].map(item => (
                  <label key={item.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={includes[item.key]}
                      onCheckedChange={(v) => setIncludes(prev => ({ ...prev, [item.key]: !!v }))}
                    />
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {item.label}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* CTA */}
            <Button
              className="w-full bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-primary-foreground"
              disabled={!canConnect}
              onClick={handleConnect}
            >
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Connecting...</> : "Connect repo"}
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              We only read markdown — never your code.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-6 mt-8">
            {["Connect", "Brief", "Done"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  i === 0 ? "bg-[hsl(var(--primary))]" : "border-2 border-border"
                }`} />
                <span className={`text-xs ${i === 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
