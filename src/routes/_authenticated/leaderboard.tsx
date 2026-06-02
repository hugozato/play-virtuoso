import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLeaderboard, getMyProfile } from "@/lib/casino.functions";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Trophy, Crown, Medal } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
});

const planColors: Record<string, string> = {
  free: "text-muted-foreground",
  bronze: "text-orange-400",
  silver: "text-slate-300",
  gold: "text-[color:var(--gold)]",
};

function LeaderboardPage() {
  const fetchBoard = useServerFn(getLeaderboard);
  const fetchMe = useServerFn(getMyProfile);
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetchBoard(),
    refetchInterval: 15000,
  });
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => fetchMe() });

  if (isLoading || !data) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/30 mb-3">
          <Trophy className="h-4 w-4 text-[color:var(--gold)]" />
          <span className="text-xs uppercase tracking-widest text-primary font-bold">Ranking Global</span>
        </div>
        <h1 className="text-4xl font-black tracking-tight">Top Jogadores</h1>
        <p className="text-muted-foreground mt-2">Os usuários com mais moedas do cassino</p>
      </div>

      {/* Podium */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[1, 0, 2].map((i) => {
          const u = top3[i];
          if (!u) return <div key={i} />;
          const place = i + 1;
          const heights = ["h-44", "h-36", "h-32"];
          const icons = [
            <Crown key="c" className="h-6 w-6 text-[color:var(--gold)]" />,
            <Medal key="s" className="h-6 w-6 text-slate-300" />,
            <Medal key="b" className="h-6 w-6 text-orange-400" />,
          ];
          return (
            <div key={u.id} className="flex flex-col items-center justify-end">
              <Avatar className={cn("h-16 w-16 mb-2 ring-2", place === 1 ? "ring-[color:var(--gold)]" : "ring-border")}>
                <AvatarImage src={u.avatar_url || undefined} />
                <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <Card
                className={cn(
                  "w-full flex flex-col items-center justify-start pt-3 px-2",
                  heights[place - 1],
                  place === 1 && "bg-gradient-to-b from-[color:var(--gold)]/20 to-card border-[color:var(--gold)]/40",
                )}
              >
                {icons[place - 1]}
                <p className="font-bold text-sm mt-2 truncate w-full text-center">{u.username}</p>
                <p className="text-xs text-[color:var(--gold)] font-bold tabular-nums mt-1">
                  {Number(u.coins).toLocaleString("pt-BR")}
                </p>
                <p className={cn("text-[10px] uppercase tracking-wide mt-auto mb-2", planColors[u.plan])}>
                  {u.plan}
                </p>
              </Card>
            </div>
          );
        })}
      </div>

      {/* Rest */}
      <Card className="divide-y divide-border overflow-hidden">
        {rest.map((u, idx) => {
          const place = idx + 4;
          const isMe = me?.id === u.id;
          return (
            <div
              key={u.id}
              className={cn(
                "flex items-center gap-4 px-4 py-3 transition",
                isMe && "bg-primary/10",
              )}
            >
              <span className="w-8 text-center font-bold text-muted-foreground tabular-nums">{place}</span>
              <Avatar className="h-10 w-10">
                <AvatarImage src={u.avatar_url || undefined} />
                <AvatarFallback>{u.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {u.username} {isMe && <span className="text-xs text-primary">(você)</span>}
                </p>
                <p className={cn("text-xs uppercase tracking-wide", planColors[u.plan])}>{u.plan}</p>
              </div>
              <p className="font-bold tabular-nums text-[color:var(--gold)]">
                {Number(u.coins).toLocaleString("pt-BR")}
              </p>
            </div>
          );
        })}
        {rest.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum outro jogador ainda</p>
        )}
      </Card>
    </div>
  );
}