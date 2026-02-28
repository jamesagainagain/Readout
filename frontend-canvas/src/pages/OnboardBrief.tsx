import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mic, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useReadout } from "@/context/ReadoutContext";
import { createBrief } from "@/lib/readoutApi";
import { PlayButton } from "@/components/PlayButton";

const tones = ["Casual & direct", "Professional", "Technical"];

const toneMap: Record<string, string> = {
  "Casual & direct": "casual",
  "Professional": "professional",
  "Technical": "technical",
};

export default function OnboardBrief() {
  const navigate = useNavigate();
  const { knowledge_id, repoLabel, setBriefId } = useReadout();
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("Casual & direct");
  const [goal, setGoal] = useState("");
  const [avoid, setAvoid] = useState("");
  const [channels, setChannels] = useState({ reddit: true, email: true, linkedin: false });
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Redirect if no knowledge_id
  if (!knowledge_id) {
    navigate("/onboard");
    return null;
  }

  function toggleRecording() {
    const SR = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;

    if (!SR) {
      setError("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    recognitionRef.current = rec;

    rec.onresult = (e: SpeechRecognitionEvent) => {
      const transcript = Array.from(e.results)
        .map(r => r[0].transcript)
        .join(" ")
        .trim();
      // Heuristic: first sentence → audience, rest → goal
      const sentences = transcript.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
      if (sentences.length >= 1 && !audience) setAudience(sentences[0]);
      if (sentences.length >= 2 && !goal) setGoal(sentences.slice(1).join(". "));
      else if (sentences.length >= 1 && audience && !goal) setGoal(sentences[0]);
    };

    rec.onerror = () => {
      setIsRecording(false);
      setError("Voice input failed. Please try again.");
    };

    rec.onend = () => setIsRecording(false);

    rec.start();
    setIsRecording(true);
  }

  async function handleSubmit() {
    const selectedChannels = (Object.keys(channels) as (keyof typeof channels)[]).filter(k => channels[k]);
    setLoading(true);
    setError(null);
    try {
      const res = await createBrief({
        knowledge_id,
        audience,
        tone: toneMap[tone] ?? "casual",
        goals: goal || undefined,
        channels: selectedChannels,
        constraints: avoid || undefined,
      });
      setBriefId(res.brief_id);
      navigate("/onboard/processing");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to create brief");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <span className="font-mono text-lg font-bold tracking-tight">Readout</span>
        <span className="text-sm text-muted-foreground font-mono flex items-center gap-2">
          {repoLabel ?? "—"} <span className="text-[hsl(var(--sage))]">✓</span>
        </span>
      </header>

      <div className="flex-1 flex items-start justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-lg space-y-6"
        >
          <div className="readout-card p-6 space-y-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="font-mono">Step 2 of 3</span>
              <span>—</span>
              <span>Tell us about your audience</span>
            </div>

            {/* Voice brief */}
            <button
              onClick={toggleRecording}
              className={`w-full rounded-lg border p-4 flex items-center gap-3 transition-all duration-200 ${
                isRecording
                  ? "border-[hsl(var(--primary))] bg-[hsl(var(--accent-light))]"
                  : "border-border hover:border-[hsl(var(--primary))]/40 hover:bg-muted/30"
              }`}
            >
              <div className={`p-2 rounded-full ${isRecording ? "bg-[hsl(var(--primary))]" : "bg-muted"}`}>
                <Mic className={`h-4 w-4 ${isRecording ? "text-primary-foreground" : "text-muted-foreground"}`} />
              </div>
              {isRecording ? (
                <div className="flex items-center gap-1">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div
                      key={i}
                      className="waveform-bar"
                      style={{ animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                  <span className="ml-3 text-sm font-medium text-[hsl(var(--primary))]">Listening...</span>
                </div>
              ) : (
                <div className="text-left">
                  <p className="text-sm font-medium">Talk to fill this in</p>
                  <p className="text-xs text-muted-foreground">Click to start voice brief</p>
                </div>
              )}
            </button>

            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex-1 h-px bg-border" />
              <span>or type below</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Audience */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Who's your audience?</label>
              <Textarea
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="CTOs and engineering leads at early-stage SaaS startups..."
                className="bg-background min-h-[80px]"
              />
            </div>

            {/* Tone */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tone</label>
              <div className="flex flex-wrap gap-2">
                {tones.map(t => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`amber-pill ${tone === t ? "amber-pill-active" : ""}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Goal */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Campaign goal</label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="Drive GitHub stars and early signups for v1 launch"
                className="bg-background"
              />
            </div>

            {/* Avoid */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Anything to avoid saying?
                <span className="text-muted-foreground font-normal ml-1">(optional)</span>
              </label>
              <Input
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                placeholder="e.g. Don't mention competitor X..."
                className="bg-background"
              />
            </div>

            {/* Channels */}
            <div className="space-y-3">
              <label className="text-sm font-medium">Channels to target</label>
              <div className="flex flex-wrap gap-4">
                {(["reddit", "email", "linkedin"] as const).map(ch => (
                  <label key={ch} className="flex items-center gap-2 text-sm cursor-pointer capitalize">
                    <Checkbox
                      checked={channels[ch]}
                      onCheckedChange={(v) => setChannels(prev => ({ ...prev, [ch]: !!v }))}
                    />
                    {ch}
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Preview aloud */}
            {audience && (
              <div className="flex items-center gap-2">
                <PlayButton
                  text={`Target audience: ${audience}. ${goal ? `Campaign goal: ${goal}.` : ""} ${avoid ? `Avoid: ${avoid}.` : ""} Tone: ${tone}.`}
                  variant="outline"
                  label
                />
                <span className="text-xs text-muted-foreground">Preview your brief aloud</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button variant="outline" onClick={() => navigate("/onboard")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                className="flex-1 bg-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/90 text-primary-foreground"
                disabled={!audience || loading}
                onClick={handleSubmit}
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Building...</> : "Build my brain"}
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Your brief stays in your account, not in our prompts.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-6">
            {["Connect", "Brief", "Done"].map((label, i) => (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  i <= 1 ? "bg-[hsl(var(--primary))]" : "border-2 border-border"
                }`} />
                <span className={`text-xs ${i <= 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
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
