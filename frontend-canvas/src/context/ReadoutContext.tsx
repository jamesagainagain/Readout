import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "readout_onboard";

interface ReadoutState {
  knowledge_id: string | null;
  brief_id: string | null;
  repoLabel: string | null;
}

interface ReadoutContextValue extends ReadoutState {
  setKnowledgeId: (id: string) => void;
  setBriefId: (id: string) => void;
  setRepoLabel: (label: string) => void;
}

const ReadoutContext = createContext<ReadoutContextValue | null>(null);

function loadFromStorage(): ReadoutState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { knowledge_id: null, brief_id: null, repoLabel: null };
}

export function ReadoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReadoutState>(loadFromStorage);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const setKnowledgeId = (id: string) => setState(s => ({ ...s, knowledge_id: id }));
  const setBriefId = (id: string) => setState(s => ({ ...s, brief_id: id }));
  const setRepoLabel = (label: string) => setState(s => ({ ...s, repoLabel: label }));

  return (
    <ReadoutContext.Provider value={{ ...state, setKnowledgeId, setBriefId, setRepoLabel }}>
      {children}
    </ReadoutContext.Provider>
  );
}

export function useReadout(): ReadoutContextValue {
  const ctx = useContext(ReadoutContext);
  if (!ctx) throw new Error("useReadout must be used within ReadoutProvider");
  return ctx;
}
