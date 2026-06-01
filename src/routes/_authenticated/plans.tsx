import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Crown, Check } from "lucide-react";
import { buyPlan } from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/plans")({
  head: () => ({ meta: [{ title: "Planos — Luxe Casino" }] }),
  component: PlansPage,
});

const plans = [
  { id: "bronze" as const, name: "Bronze", price: "R$ 19,90", coins: "3.000", daily: "200", perks: ["Sem anúncios", "1 jogo exclusivo"], gradient: "from-amber-700/30 to-amber-900/30" },
  { id: "silver" as const, name: "Prata", price: "R$ 49,90", coins: "10.000", daily: "500", perks: ["Todos os jogos", "Sem anúncios", "Suporte prioritário"], gradient: "from-slate-400/30 to-slate-600/30", featured: true },
  { id: "gold" as const, name: "Ouro", price: "R$ 99,90", coins: "30.000", daily: "2.000", perks: ["Tudo do Prata", "Badge VIP exclusivo", "Torneios especiais", "Suporte 24/7"], gradient: "from-yellow-500/30 to-amber-700/30" },
];

function PlansPage() {
  const qc = useQueryClient();
  const buy = useServerFn(buyPlan);
  const mutation = useMutation({
    mutationFn: (plan: "bronze" | "silver" | "gold") => buy({ data: { plan } }),
    onSuccess: (r) => {
      toast.success(`Plano ${r.plan} ativado! 🎉`);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <Crown className="h-12 w-12 mx-auto text-[color:var(--gold)] mb-3" />
        <h1 className="text-4xl md:text-5xl font-black">Vire VIP</h1>
        <p className="text-muted-foreground mt-2">Ganhe moedas mensais e bônus diários gigantes.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {plans.map((p) => (
          <div
            key={p.id}
            className={`relative p-6 rounded-3xl bg-gradient-to-br ${p.gradient} border ${
              p.featured ? "border-primary shadow-[var(--shadow-glow)]" : "border-border"
            }`}
          >
            {p.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-xs font-bold uppercase">
                Mais popular
              </div>
            )}
            <h3 className="font-bold text-2xl">{p.name}</h3>
            <div className="mt-2 text-4xl font-black">{p.price}<span className="text-sm text-muted-foreground font-normal">/mês</span></div>
            <div className="mt-4 space-y-1">
              <div className="text-accent font-bold text-lg">{p.coins} moedas/mês</div>
              <div className="text-sm text-muted-foreground">+{p.daily} moedas no bônus diário</div>
            </div>
            <ul className="mt-4 space-y-1.5 text-sm">
              {p.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" /> {perk}
                </li>
              ))}
            </ul>
            <Button
              onClick={() => mutation.mutate(p.id)}
              disabled={mutation.isPending}
              className="w-full mt-6 bg-gradient-to-r from-primary to-accent border-0"
            >
              Assinar {p.name}
            </Button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Demonstração — não cobra cartão. Integre Stripe quando estiver pronto para faturar.
      </p>
    </main>
  );
}