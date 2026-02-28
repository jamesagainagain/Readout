import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Upload, Link, Copy, RotateCcw, Download, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useReadout } from "@/context/ReadoutContext";
import { getDrafts, generate, getApolloStatus, searchLeads, type Lead } from "@/lib/readoutApi";

export default function EmailCampaign() {
  const { brief_id } = useReadout();
  const [copied, setCopied] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apolloAvailable, setApolloAvailable] = useState<boolean | null>(null);
  const [leadTitle, setLeadTitle] = useState("");
  const [leadIndustry, setLeadIndustry] = useState("");
  const [leadCompanySize, setLeadCompanySize] = useState("");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);

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

  useEffect(() => {
    getApolloStatus()
      .then(() => setApolloAvailable(true))
      .catch(() => setApolloAvailable(false));
  }, []);

  const handleFindLeads = async () => {
    setLeadsError(null);
    setLeadsLoading(true);
    try {
      const res = await searchLeads({
        title: leadTitle || undefined,
        industry: leadIndustry || undefined,
        company_size: leadCompanySize || undefined,
        per_page: 25,
      });
      setLeads(res.leads);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Lead search failed";
      setLeadsError(msg);
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  };

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
              <Button variant="outline" className="w-full gap-2 justify-start" disabled>
                <Link className="h-4 w-4" />
                {apolloAvailable === null ? "Checking Apollo…" : apolloAvailable ? "Apollo connected" : "Apollo not configured"}
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
                <Select value={leadTitle || "none"} onValueChange={(v) => setLeadTitle(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Title: e.g. CTO" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    <SelectItem value="CTO">CTO</SelectItem>
                    <SelectItem value="VP Engineering">VP Engineering</SelectItem>
                    <SelectItem value="Founder">Founder</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={leadIndustry || "none"} onValueChange={(v) => setLeadIndustry(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Industry: e.g. SaaS" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    <SelectItem value="SaaS">SaaS</SelectItem>
                    <SelectItem value="Fintech">Fintech</SelectItem>
                    <SelectItem value="DevTools">DevTools</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={leadCompanySize || "none"} onValueChange={(v) => setLeadCompanySize(v === "none" ? "" : v)}>
                  <SelectTrigger className="bg-background"><SelectValue placeholder="Size: e.g. 50-500" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Any</SelectItem>
                    <SelectItem value="1,10">1-10 employees</SelectItem>
                    <SelectItem value="11,50">11-50 employees</SelectItem>
                    <SelectItem value="51,200">51-200 employees</SelectItem>
                    <SelectItem value="201,500">201-500 employees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!apolloAvailable && apolloAvailable !== null && (
                <p className="text-xs text-muted-foreground">Add APOLLO_API_KEY to the backend .env to search leads.</p>
              )}
              <Button
                className="w-full bg-[hsl(var(--primary))] text-primary-foreground"
                onClick={handleFindLeads}
                disabled={leadsLoading || !apolloAvailable}
              >
                {leadsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find leads"}
              </Button>
              {leadsError && <p className="text-sm text-destructive">{leadsError}</p>}
            </div>

            {leads.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                <p className="text-sm font-medium">Results ({leads.length})</p>
                <div className="max-h-[220px] overflow-auto rounded border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left p-2 font-medium">Name</th>
                        <th className="text-left p-2 font-medium">Title</th>
                        <th className="text-left p-2 font-medium">Company</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.map((l) => (
                        <tr key={l.id ?? `${l.first_name}-${l.organization_name}`} className="border-t border-border">
                          <td className="p-2">{[l.first_name, l.last_name].filter(Boolean).join(" ")}</td>
                          <td className="p-2">{l.title ?? "—"}</td>
                          <td className="p-2">{l.organization_name ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground">Apollo search does not return emails; use Apollo Enrichment or paste emails above.</p>
              </div>
            )}
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
