import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Gift, Dices, Spade, Store, Crown, Rocket } from "lucide-react";
import { claimDailyBonus, getMyProfile } from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/lobby")({
  head: () => ({ meta: [{ title: "Lobby — Luxe Casino" }] }),
  component: Lobby,
});

function Lobby() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const claim = useServerFn(claimDailyBonus);
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });

  const claimMutation = useMutation({
    mutationFn: () => claim(),
    onSuccess: (r) => {
      toast.success(`+${r.amount} moedas! 🎉`);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canClaim =
    !profile?.last_daily_bonus_at ||
    Date.now() - new Date(profile.last_daily_bonus_at).getTime() >= 20 * 3600 * 1000;

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="mb-10">
        <h1 className="text-4xl md:text-5xl font-black">
          Olá, <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">{profile?.username}</span>
        </h1>
        <p className="text-muted-foreground mt-1">Bem-vindo de volta ao tapete vermelho.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-10">
        <div className="md:col-span-2 p-6 rounded-3xl bg-gradient-to-br from-primary/20 via-card to-accent/10 border border-primary/30">
          <div className="flex items-center gap-3 mb-2">
            <Gift className="h-6 w-6 text-accent" />
            <h2 className="text-xl font-bold">Bônus diário</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            {canClaim ? "Seu bônus está disponível!" : "Volte em algumas horas para o próximo bônus."}
          </p>
          <Button
            disabled={!canClaim || claimMutation.isPending}
            onClick={() => claimMutation.mutate()}
            className="bg-gradient-to-r from-primary to-accent border-0"
          >
            {canClaim ? "Resgatar bônus" : "Já resgatado hoje"}
          </Button>
        </div>

        <Link to="/plans" className="p-6 rounded-3xl bg-card border border-border hover:border-accent/50 transition group">
          <Crown className="h-6 w-6 text-[color:var(--gold)] mb-2" />
          <h2 className="text-xl font-bold">Upgrade VIP</h2>
          <p className="text-sm text-muted-foreground">Bônus 40× maiores e jogos exclusivos.</p>
        </Link>
      </div>

      <h2 className="text-2xl font-bold mb-4">Jogos</h2>
      <div className="grid md:grid-cols-2 gap-4">
        <GameCard to="/slot" icon={Dices} title="Slot Machine" tag="Clássico" gradient="from-fuchsia-500/30 to-purple-700/30">
          Rolos com pagamentos até 50× a aposta. Sorte alta, recompensa alta.
        </GameCard>
        <GameCard to="/blackjack" icon={Spade} title="Blackjack 21" tag="Cartas" gradient="from-purple-600/30 to-pink-500/30">
          Bata o dealer sem estourar. Blackjack natural paga 2.5×.
        </GameCard>
        <GameCard to="/crash" icon={Rocket} title="Crash 🚀" tag="VIP Bronze+" gradient="from-emerald-500/30 to-accent/30">
          Saque antes do foguete explodir. Multiplicadores até 1000×. Exclusivo VIP.
        </GameCard>
      </div>

      <div className="mt-10 p-6 rounded-3xl bg-card/60 border border-border flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Store className="h-6 w-6 text-accent" />
          <div>
            <h3 className="font-bold">Acabou as moedas?</h3>
            <p className="text-sm text-muted-foreground">Compre pacotes na loja.</p>
          </div>
        </div>
        <Button asChild variant="outline"><Link to="/store">Abrir loja</Link></Button>
      </div>
    </main>
  );
}

function GameCard({
  to, icon: Icon, title, tag, gradient, children,
}: { to: string; icon: typeof Dices; title: string; tag: string; gradient: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className={`relative overflow-hidden p-6 rounded-3xl bg-gradient-to-br ${gradient} border border-border hover:border-primary transition group`}
    >
      <div className="absolute -right-8 -top-8 opacity-10 group-hover:opacity-20 transition">
        <Icon className="h-40 w-40" />
      </div>
      <div className="relative">
        <span className="text-xs uppercase tracking-wider text-accent font-semibold">{tag}</span>
        <h3 className="text-2xl font-bold mt-1">{title}</h3>
        <p className="text-sm text-muted-foreground mt-2 max-w-xs">{children}</p>
        <div className="mt-4 inline-flex items-center text-sm font-semibold text-primary">
          Jogar →
        </div>
      </div>
    </Link>
  );
}