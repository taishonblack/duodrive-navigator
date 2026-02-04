import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import DealComparison from "./pages/DealComparison";
import DuoDriveScore from "./pages/DuoDriveScore";
import DealRoom from "./pages/DealRoom";
import QuinnPopout from "./pages/QuinnPopout";
import WhyDuoDrive from "./pages/WhyDuoDrive";
import Glossary from "./pages/Glossary";
import WindowSticker from "./pages/WindowSticker";
import Coaching from "./pages/Coaching";
import CoachingChat from "./pages/CoachingChat";
import ChatHistory from "./pages/ChatHistory";
import Auth from "./pages/Auth";
import Account from "./pages/Account";
import CoachAuth from "./pages/CoachAuth";
import CoachDashboard from "./pages/CoachDashboard";
import AdminAuth from "./pages/AdminAuth";
import AdminDashboard from "./pages/AdminDashboard";
import AdminEscalations from "./pages/AdminEscalations";
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/compare" element={<DealComparison />} />
            <Route path="/score" element={<DuoDriveScore />} />
            <Route path="/deal-room" element={<DealRoom />} />
            <Route path="/quinn/popout" element={<QuinnPopout />} />
            <Route path="/why-duodrive" element={<WhyDuoDrive />} />
            <Route path="/glossary" element={<Glossary />} />
            <Route path="/learn/window-sticker" element={<WindowSticker />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/account" element={<Account />} />
            {/* Legacy coaching routes - hidden from UI but preserved for potential future $49 escalation feature
                These routes are functional but not linked from navigation, footer, or dashboard.
                Related components: Coaching.tsx, CoachingChat.tsx, ChatHistory.tsx, CoachAuth.tsx, CoachDashboard.tsx
                See memory: legacy/coaching-infrastructure for full context */}
            <Route path="/coaching" element={<Coaching />} />
            <Route path="/coaching-chat/:sessionId" element={<CoachingChat />} />
            <Route path="/chat-history" element={<ChatHistory />} />
            <Route path="/coach" element={<CoachAuth />} />
            <Route path="/coach/dashboard" element={<CoachDashboard />} />
            <Route path="/admin" element={<AdminAuth />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/escalations" element={<AdminEscalations />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
