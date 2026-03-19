import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Shield, Activity, Globe } from "lucide-react";

export function LoadingScreen({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initialisation des capteurs orbitaux...");

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(onComplete, 500);
          return 100;
        }
        return prev + Math.random() * 15;
      });
    }, 200);

    const statusTimer = setInterval(() => {
      const statuses = [
        "Connexion au flux de données global...",
        "Synchronisation de la constellation satellite...",
        "Déchiffrement du flux de renseignement...",
        "Cartographie des zones de conflit...",
        "Système prêt."
      ];
      setStatus(prev => {
        const index = statuses.indexOf(prev);
        return statuses[Math.min(index + 1, statuses.length - 1)];
      });
    }, 800);

    return () => {
      clearInterval(timer);
      clearInterval(statusTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 font-mono text-primary">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center mb-8">
          <div className="relative flex items-center justify-center">
            <img
              src="/argos.svg"
              alt="ARGOS"
              className="h-24 w-auto animate-pulse"
            />
            <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-primary/70 uppercase tracking-widest">
            <span>{status}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-1 bg-white/5" />
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="glass-panel p-3 border-white/5 flex flex-col items-center gap-2">
            <Shield className="w-4 h-4 text-primary/50" />
            <span className="text-[10px] text-white/30 uppercase tracking-tighter">Sécurisé</span>
          </div>
          <div className="glass-panel p-3 border-white/5 flex flex-col items-center gap-2">
            <Activity className="w-4 h-4 text-primary/50" />
            <span className="text-[10px] text-white/30 uppercase tracking-tighter">Direct</span>
          </div>
          <div className="glass-panel p-3 border-white/5 flex flex-col items-center gap-2">
            <Globe className="w-4 h-4 text-primary/50" />
            <span className="text-[10px] text-white/30 uppercase tracking-tighter">Global</span>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-8 text-[10px] text-white/20 uppercase tracking-[0.3em]">
        Astral Defense Systems v6.2.0
      </div>
    </div>
  );
}
