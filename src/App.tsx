import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import DuoDriveScore from "./pages/DuoDriveScore";
import DealRoom from "./pages/DealRoom";
import WhyDuoDrive from "./pages/WhyDuoDrive";
import Coaching from "./pages/Coaching";
import Auth from "./pages/Auth";
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
          <Route path="/score" element={<DuoDriveScore />} />
          <Route path="/deal-room" element={<DealRoom />} />
          <Route path="/why-duodrive" element={<WhyDuoDrive />} />
          <Route path="/coaching" element={<Coaching />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
