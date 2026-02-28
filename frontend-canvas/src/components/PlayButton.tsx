import { useState, useRef } from "react";
import { Volume2, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { textToSpeech } from "@/lib/readoutApi";

interface Props {
  text: string;
  size?: "sm" | "default";
  variant?: "ghost" | "outline";
  label?: boolean;
}

export function PlayButton({ text, size = "sm", variant = "ghost", label = false }: Props) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  async function handleClick() {
    if (state === "playing") {
      audioRef.current?.pause();
      setState("idle");
      return;
    }

    setState("loading");
    try {
      const url = await textToSpeech(text);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("idle");
      await audio.play();
      setState("playing");
    } catch {
      setState("idle");
    }
  }

  const icon =
    state === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> :
    state === "playing" ? <Square className="h-3.5 w-3.5" /> :
    <Volume2 className="h-3.5 w-3.5" />;

  const text_ =
    state === "loading" ? "Loading…" :
    state === "playing" ? "Stop" :
    "Listen";

  return (
    <Button variant={variant} size={size} className="gap-1.5 h-8" onClick={handleClick} disabled={state === "loading"}>
      {icon}
      {label && text_}
    </Button>
  );
}
