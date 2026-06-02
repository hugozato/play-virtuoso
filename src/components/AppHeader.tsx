import { Link, useNavigate } from "@tanstack/react-router";
import { Coins, LogOut, Sparkles, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyProfile } from "@/lib/casino.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const planLabels: Record<string, string> = {
  free: "Gratuito",
  bronze: "Bronze",
  silver: "Prata",
  gold: "Ouro",
};

export function AppHeader() {
  const navigate = useNavigate();
  const fetchProfile = useServerFn(getMyProfile);
  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: () => fetchProfile(),
    refetchInterval: 5000,
  });

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link to="/lobby" className="flex items-center gap-2 group">
          <div className="relative">
            <Sparkles className="h-7 w-7 text-primary transition-transform group-hover:rotate-12" />
            <div className="absolute inset-0 blur-xl bg-primary/40 -z-10" />
          </div>
          <span className="text-xl font-black tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            LUXE CASINO
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link to="/lobby" className="text-muted-foreground hover:text-foreground transition">Lobby</Link>
          <Link to="/leaderboard" className="text-muted-foreground hover:text-foreground transition">Ranking</Link>
          <Link to="/plans" className="text-muted-foreground hover:text-foreground transition">Planos</Link>
          <Link to="/store" className="text-muted-foreground hover:text-foreground transition">Loja</Link>
        </nav>

        <div className="flex items-center gap-3">
          {data && (
            <>
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border">
                <span className="text-xs font-medium uppercase tracking-wide text-accent">
                  {planLabels[data.plan]}
                </span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30">
                <Coins className="h-4 w-4 text-[color:var(--gold)]" />
                <span className="font-bold tabular-nums">{Number(data.coins).toLocaleString("pt-BR")}</span>
              </div>
              <Link to="/profile" title="Meu perfil">
                <Avatar className="h-9 w-9 ring-2 ring-border hover:ring-primary transition">
                  <AvatarImage src={data.avatar_url || undefined} />
                  <AvatarFallback className="bg-secondary text-xs">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </Link>
            </>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}