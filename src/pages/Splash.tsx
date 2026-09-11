import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import { Zap, Globe, Cpu, CircuitBoard, Activity, Layers } from "lucide-react";
import { useTheme } from "@/theme";
import { Sun, Moon } from "lucide-react";
import Logo from "@/components/Logo";

export default function Splash() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const features = [
    { key: "featSchematic", icon: Cpu },
    { key: "featPcb", icon: CircuitBoard },
    { key: "featSimulation", icon: Activity },
    { key: "featRealistic", icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center pt-4 pb-20 p-4 relative overflow-hidden transition-colors duration-200">
      
      {/* Top right controls */}
      <div className="absolute top-6 right-4 sm:right-6 flex items-center gap-3 z-50">
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setLang(lang === "en" ? "ar" : "en")}
            title={t("language")}
            className="cursor-pointer h-10 w-10 bg-background/80 backdrop-blur border border-border/50 hover:bg-muted"
          >
            <Globe className="h-5 w-5" />
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={t("theme")}
            className="cursor-pointer h-10 w-10 bg-background/80 backdrop-blur border border-border/50 hover:bg-muted"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </motion.div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-2xl flex flex-col items-center text-center space-y-6 mt-0"
      >
        
        {/* Logo Section */}
        <div className="relative">
          {/* Logo Icon */}
          <div className="relative w-32 h-32 mx-auto flex items-center justify-center p-1 bg-slate-950/80 border-2 border-blue-500/30 rounded-2xl shadow-lg shadow-blue-500/10 hover:border-green-400/40 transition-colors duration-300">
            {/* Background glow */}
            <div className="absolute inset-0 bg-blue-500/10 rounded-2xl blur-xl" />
            
            {/* The SVG Logo */}
            <Logo className="w-full h-full relative z-10 drop-shadow-md rounded-xl" />
          </div>

          <motion.h1 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="mt-4 text-5xl font-black tracking-tight text-foreground"
          >
            CirZuit
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-2 text-sm font-mono text-blue-500 font-semibold uppercase tracking-widest"
          >
            Electronic Design Automation
          </motion.p>
        </div>

        {/* Intro Text */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="space-y-4 max-w-xl mx-auto"
        >
          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed px-4">
            {t("appIntro")}
          </p>
          
          {/* Modules Section */}
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 pt-4">
            {features.map((feat, i) => (
              <motion.div
                key={feat.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex flex-col items-center gap-2 group"
              >
                <div className="p-3 rounded-xl bg-muted/50 border border-border/50 group-hover:border-blue-500/30 group-hover:bg-muted transition-all">
                  <feat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground group-hover:text-blue-500 transition-colors" />
                </div>
                <span className="text-[10px] sm:text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {t(feat.key)}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Start Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Button 
            size="lg" 
            onClick={() => navigate("/dashboard")}
            className="h-14 px-8 rounded-full text-lg font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Zap className="mr-2 h-5 w-5" />
            {t("startZ")}
          </Button>
        </motion.div>

      </motion.div>

      {/* Footer */}
      <footer className="absolute bottom-6 w-full px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[10px] sm:text-xs text-muted-foreground/60 max-w-7xl mx-auto pointer-events-none">
        <div className="pointer-events-auto">
          © {new Date().getFullYear()} CirZuit. All rights reserved.
        </div>
        <div className="pointer-events-auto flex items-center gap-4">
          <a 
            href="mailto:m93.alzoubi@outlook.com" 
            className="hover:text-foreground transition-colors underline underline-offset-4"
          >
            {t("contactEmail") || "Contact Support"}
          </a>
        </div>
      </footer>
    </div>
  );
}
