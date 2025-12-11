import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import DealComparison from "./pages/DealComparison";
import DuoDriveScore from "./pages/DuoDriveScore";
import DealRoom from "./pages/DealRoom";
import WhyDuoDrive from "./pages/WhyDuoDrive";
import Coaching from "./pages/Coaching";
import Auth from "./pages/Auth";
import Account from "./pages/Account";
import CoachAuth from "./pages/CoachAuth";
import CoachDashboard from "./pages/CoachDashboard";
import AdminAuth from "./pages/AdminAuth";
import AdminDashboard from "./pages/AdminDashboard";
import Contact from "./pages/Contact";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
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
          <Route path="/why-duodrive" element={<WhyDuoDrive />} />
          <Route path="/coaching" element={<Coaching />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/account" element={<Account />} />
          <Route path="/coach" element={<CoachAuth />} />
          <Route path="/coach/dashboard" element={<CoachDashboard />} />
          <Route path="/admin" element={<AdminAuth />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
