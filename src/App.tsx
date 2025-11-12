import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletContextProvider } from "@/components/WalletProvider";
import Index from "./pages/Index";
import WhyPegasusSwap from "./pages/WhyPegasusSwap";
import NotFound from "./pages/NotFound";
import AnimatedStars from './components/AnimatedStars';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletContextProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <AnimatedStars />
          <div className="flex flex-col min-h-screen">
            <BrowserRouter>
              <div className="flex-grow">
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/why-pegasus-swap" element={<WhyPegasusSwap />} />
                  <Route path="/why-choose-pegasus" element={<WhyPegasusSwap />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </div>
            </BrowserRouter>
          </div>
        </TooltipProvider>
      </WalletContextProvider>
    </QueryClientProvider>
  );
}

export default App;
