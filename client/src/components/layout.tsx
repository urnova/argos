import { Link, useLocation } from "wouter";
import { Globe, History, BookOpen, Activity, AlertTriangle, Loader2, Radio, Tv } from "lucide-react";
import { clsx } from "clsx";
import { useLanguage } from "@/contexts/language-context";
import { useServerStatus } from "@/hooks/use-server-status";
import { useAlerts } from "@/hooks/use-alerts";
import { BreakingTicker } from "@/components/breaking-ticker";

export function AppLayout({ children }: { children: React.ReactNode; }) {
  const [location] = useLocation();
  const { t } = useLanguage();
  const serverStatus = useServerStatus();
  const { data: alerts } = useAlerts();

  const navItems = [
    { href: "/", icon: Globe, label: t.nav.live },
    { href: "/history", icon: History, label: t.nav.history },
    { href: "/live", icon: Tv, label: t.nav.liveview },
    { href: "/radio", icon: Radio, label: t.nav.radio },
    { href: "/guide", icon: BookOpen, label: t.nav.guide },
  ];

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      {/* ── Top Navigation Bar ── */}
      <header className="shrink-0 h-10 bg-black/95 border-b border-white/10 backdrop-blur-xl z-50 relative flex items-center px-4">
        {/* Logo + branding — left */}
        <div className="flex items-center gap-2 shrink-0">
          <img src="/argos.svg" alt="ARGOS" className="h-6 w-auto" />
          <div className="hidden md:flex flex-col leading-none">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-black font-mono text-white/80 uppercase tracking-widest">Argos Intelligence</span>
              <span className="text-[7px] font-black font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(0,240,255,0.15)', color: '#00F0FF', border: '1px solid rgba(0,240,255,0.3)' }}>V6</span>
            </div>
            <span className="text-[7px] font-mono text-muted-foreground/40 uppercase tracking-widest">by Astral Security</span>
          </div>
        </div>

        {/* Nav items — absolutely centered in header */}
        <nav className="absolute inset-0 flex items-center justify-center gap-1 pointer-events-none">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/30 shadow-[0_0_10px_rgba(0,240,255,0.1)]"
                    : "text-muted-foreground/60 hover:text-foreground hover:bg-white/5 border border-transparent"
                )}
              >
                <Icon className={clsx("w-3.5 h-3.5 shrink-0 transition-opacity", isActive ? "text-primary" : "opacity-50 group-hover:opacity-100")} />
                <span className={clsx("text-[11px] font-medium tracking-wide transition-opacity", isActive ? "" : "opacity-60 group-hover:opacity-100")}>
                  {item.label}
                </span>
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-primary rounded-full shadow-[0_0_6px_rgba(0,240,255,0.8)]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right — system status */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {/* System status */}
          <div className="flex items-center gap-1.5">
            {serverStatus === 'ok' && (
              <>
                <Activity className="w-3 h-3 text-emerald-500 animate-pulse" />
                <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest hidden lg:block">{t.nav.systemActive}</span>
              </>
            )}
            {serverStatus === 'connecting' && (
              <>
                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                <span className="text-[9px] font-mono text-amber-400 uppercase tracking-widest hidden lg:block">{t.nav.systemConnecting}</span>
              </>
            )}
            {serverStatus === 'error' && (
              <>
                <AlertTriangle className="w-3 h-3 text-destructive" />
                <span className="text-[9px] font-mono text-destructive uppercase tracking-widest hidden lg:block">{t.nav.systemError}</span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Breaking news ticker — visible sur toutes les pages */}
      <BreakingTicker alerts={alerts ?? []} />

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
