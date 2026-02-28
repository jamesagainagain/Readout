import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ReadoutProvider } from "./context/ReadoutContext";
import Onboard from "./pages/Onboard";
import OnboardBrief from "./pages/OnboardBrief";
import OnboardProcessing from "./pages/OnboardProcessing";
import Dashboard from "./pages/Dashboard";
import RedditDiscover from "./pages/RedditDiscover";
import EmailCampaign from "./pages/EmailCampaign";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ReadoutProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/onboard" replace />} />
          <Route path="/onboard" element={<Onboard />} />
          <Route path="/onboard/brief" element={<OnboardBrief />} />
          <Route path="/onboard/processing" element={<OnboardProcessing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/reddit/discover" element={<RedditDiscover />} />
          <Route path="/email" element={<EmailCampaign />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ReadoutProvider>
);

export default App;
