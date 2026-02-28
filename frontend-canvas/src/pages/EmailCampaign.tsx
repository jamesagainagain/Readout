import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, Link, Copy, RotateCcw, Download, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useReadout } from "@/context/ReadoutContext";
import { getDrafts, generate } from "@/lib/readoutApi";

export default function EmailCampaign() {
  const { brief_id } = useReadout();
  const [copied, setCopied] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadEmailDraft() {
    if (!brief_id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getDrafts(brief_id);
      const emailDraft = res.drafts.find(d => d.channel === "email");
      if (emailDraft) {
        setSubject(emailDraft.title ?? "");
        setBody(emailDraft.body);
      } else {
        // Generate one if none exists
        const gen = await generate({ brief_id, channel: "email", count: 1 });
        if (gen.drafts.length > 0) {
          setSubject(gen.drafts[0].title ?? "");
          setBody(gen.drafts[0].body);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load email draft");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEmailDraft(); }, [brief_id]);

  const handleRegenerate = async () => {
    if (!brief_id) return;
    setRegenerating(true);
    setError(null);
    try {
      const gen = await generate({ brief_id, channel: "email", count: 1 });
      if (gen.drafts.length > 0) {
        setSubject(gen.drafts[0].title ?? "");
        setBody(gen.drafts[0].body);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Regeneration failed");
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleExportGMass = () => {
    const rows = [
      ["Email", "Subject", "Body"],
      ["{{email}}", subject, body.replace(/\n/g, "\\n")],
    ];
    const csv = rows.map(r => r.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "readout-email-campaign.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Highlight merge tags
  const renderBody = (text: string) => {
    return text.split(/({{[^}]+}})/).map((part, i) =>
      part.startsWith("{{") ? (
        <span key={i} className="bg-[hsl(var(--accent-light))] text-[hsl(var(--primary))] px-1 rounded font-mono text-xs">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
  };

  return (
    <DashboardLayout>
      <div className="max-w-[1100px] mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Email Campaign</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
          {/* Leads panel */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="readout-card p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold">Leads</h3>

            <div className="space-y-2">
              <Button variant="outline" className="w-full gap-2 justify-start">
                <Upload className="h-4 w-4" /> Upload CSV
              </Button>
              <Button variant="outline" className="w-full gap-2 justify-start">
                <Link className="h-4 w-4" /> Connect Apollo
              </Button>
            </div>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>or paste</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Textarea
              placeholder={"email1@company.com\nemail2@company.com\n..."}
              className="bg-background min-h-[100px] font-mono text-xs"
            />

            <div className="space-y-3">
              <p className="text-sm font-medium">Persona filters</p>
              <div className="space-y-2">
                <Select>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Title: e.g. CTO" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cto">CTO</SelectItem>
                    <SelectItem value="vp-eng">VP Engineering</SelectItem>
                    <SelectItem value="founder">Founder</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Industry: e.g. SaaS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="fintech">Fintech</SelectItem>
                    <SelectItem value="devtools">DevTools</SelectItem>
                  </SelectContent>
                </Select>
                <Select>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Size: e.g. 50-500" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1-50">1-50 employees</SelectItem>
                    <SelectItem value="50-500">50-500 employees</SelectItem>
                    <SelectItem value="500+">500+ employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full bg-[hsl(var(--primary))] text-primary-foreground">
                Find leads
              </Button>
            </div>
          </motion.div>

          {/* Draft panel */}
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="readout-card p-5 space-y-4"
          >
            <h3 className="text-sm font-semibold">Generated Draft</h3>

            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading draft…
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subject</label>
                  <div className="readout-card p-3 bg-background">
                    <p className="text-sm">{subject || "—"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Body</label>
                  <div className="readout-card p-4 bg-background min-h-[200px]">
                    <p className="text-sm leading-relaxed whitespace-pre-line">
                      {renderBody(body)}
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCopy} disabled={loading || !body}>
                {copied ? <><Check className="h-3.5 w-3.5 text-[hsl(var(--sage))]" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRegenerate} disabled={regenerating || !brief_id}>
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                {regenerating ? "Regenerating..." : "Regenerate"}
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportGMass} disabled={!body}>
                <Download className="h-3.5 w-3.5" /> Export for GMass
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
