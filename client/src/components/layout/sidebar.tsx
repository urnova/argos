import { Link, useLocation } from "wouter";
import { Globe, History, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Live Radar", icon: Globe },
    { href: "/history", label: "Alert History", icon: History },
    { href: "/guide", label: "Guide & Légende", icon: BookOpen },
  ];

  return (
    <div className="w-64 h-full glass-panel border-r border-y-0 border-l-0 flex flex-col z-50">
      {/* Logo uniquement — le nom est déjà dans l'image SVG */}
      <div className="p-5 flex flex-col items-center gap-1 border-b border-white/5">
        <img
          src="/argos.svg"
          alt="ARGOS"
          className="h-16 w-auto"
          style={{ filter: 'brightness(0) saturate(100%) invert(78%) sepia(60%) saturate(400%) hue-rotate(155deg) brightness(110%)' }}
        />
        <span className="text-[8px] text-muted-foreground/40 font-mono mt-1 tracking-widest uppercase">by Astral Security</span>
      </div>

      <div className="flex-1 py-6 px-4 space-y-2">
        {links.map((link) => {
          const isActive = location === link.href;
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href} className="block">
              <div className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-300 font-medium tracking-wide",
                isActive
                  ? "bg-primary/10 text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,240,255,0.15)]"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
              )}>
                <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "opacity-70")} />
                {link.label}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/5">
        <div className="rounded-lg bg-background/50 border border-white/5 p-4 flex flex-col items-center justify-center text-center">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse mb-2 shadow-[0_0_8px_#22c55e]" />
          <span className="text-xs font-mono text-muted-foreground">SYSTEM ONLINE</span>
          <span className="text-[10px] text-muted-foreground/50 mt-1">ARGOS NODE-G9X</span>
        </div>
      </div>
    </div>
  );
}
