import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { useReadout } from "@/context/ReadoutContext";
import { discoverSubreddits, generate } from "@/lib/readoutApi";

interface Step {
  label: string;
  detail?: string;
}

const STEPS: Step[] = [
  { label: "Discovering subreddits…" },
  { label: "Generating Reddit drafts…" },
];

export default function OnboardProcessing() {
  const navigate = useNavigate();
  const { brief_id } = useReadout();
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [details, setDetails] = useState<Record<number, string>>({});
  const [showQuote, setShowQuote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (!brief_id) {
      navigate("/onboard/brief");
      return;
    }
    if (ran.current) return;
    ran.current = true;

    async function run() {
      try {
        // Step 0: discover subreddits
        setCurrentStep(0);
        const disc = await discoverSubreddits({ brief_id: brief_id! });
        setDetails(d => ({ ...d, 0: `Found ${disc.subreddits.length} subreddits` }));
        setCompletedSteps(c => [...c, 0]);

        // Step 1: generate reddit drafts
        setCurrentStep(1);
        const gen = await generate({ brief_id: brief_id!, channel: "reddit", count: 3 });
        setDetails(d => ({ ...d, 1: `Generated ${gen.drafts.length} drafts` }));
        setCompletedSteps(c => [...c, 1]);

        setShowQuote(true);
        setTimeout(() => navigate("/dashboard"), 2000);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    }

    run();
  }, [brief_id, navigate]);

  const progress = completedSteps.length / STEPS.length * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center px-6 py-4 border-b border-border">
        <span className="font-mono text-lg font-bold tracking-tight">Readout</span>
      </header>

      <div className="flex-1 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md"
        >
          <div className="readout-card p-8 space-y-6">
            <h2 className="text-xl font-semibold text-center">Building your outreach brain</h2>

            {error ? (
              <p className="text-sm text-destructive text-center">{error}</p>
            ) : (
              <>
                {/* Steps */}
                <div className="space-y-3">
                  {STEPS.map((step, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.15 }}
                      className="flex items-center gap-3"
                    >
                      {completedSteps.includes(i) ? (
                        <Check className="h-4 w-4 text-[hsl(var(--primary))] shrink-0" />
                      ) : i === currentStep ? (
                        <Loader2 className="h-4 w-4 text-[hsl(var(--primary))] shrink-0 animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-border shrink-0" />
                      )}
                      <span className={`text-sm ${i <= currentStep ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </span>
                      {details[i] && (
                        <span className="text-xs text-muted-foreground font-mono ml-auto">
                          {details[i]}
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-[hsl(var(--primary))]"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground text-right font-mono">
                    {Math.round(progress)}%
                  </p>
                </div>

                {/* Quote */}
                <AnimatePresence>
                  {showQuote && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="border-l-2 border-[hsl(var(--primary))] pl-4 py-2"
                    >
                      <p className="text-sm text-muted-foreground italic">
                        "{details[0]} · {details[1]}. Ready to post."
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">— Readout Intelligence</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
