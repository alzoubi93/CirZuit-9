import { HashRouter, Routes, Route } from "react-router-dom";
import { I18nProvider } from "@/i18n";
import { ThemeProvider } from "@/theme";
import Splash from "@/pages/Splash";
import Dashboard from "@/pages/Dashboard";
import Editor from "@/pages/Editor";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
    <I18nProvider>
      <ThemeProvider>
        <TooltipProvider>
          <HashRouter>
            <Routes>
              <Route path="/" element={<Splash />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/editor/:id" element={<Editor />} />
              <Route path="/editor" element={<Editor />} />
            </Routes>
          </HashRouter>
          <Toaster />
          <SonnerToaster />
        </TooltipProvider>
      </ThemeProvider>
    </I18nProvider>
    </ErrorBoundary>
  );
}
