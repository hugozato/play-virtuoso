import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Coins } from "lucide-react";
import { buyPack } from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/store")({
  head: () => ({ meta: [{ title: "Loja — Luxe Casino" }] }),
  component: StorePage,
});

const packs = [
  { id: "starter" as const, name: "Starter", coins: 1000, price: "R$ 5,00" },
  { id: "popular" as const, name: "Popular", coins: 6000, price: "R$ 25,00", bonus: "+20%" },
  { id: "big" as const, name: "Big", coins: 15000, price: "R$ 50,00", bonus: "+50%", featured: true },
  { id: "whale" as const, name: "Whale", coins: 50000, price: "R$ 150,00", bonus: "+66%" },
  { id: "mega" as const, name: "Mega", coins: 200000, price: "R$ 500,00", bonus: "+100%" },
];

function StorePage() {
  const qc = useQueryClient();
  const buy = useServerFn(buyPack);
  const mutation = useMutation({
    mutationFn: (pack: typeof packs[number]["id"]) => buy({ data: { pack } }),
    onSuccess: (r) => {
      toast.success(`+${r.coins.toLocaleString("pt-BR")} moedas creditadas! 🎉`);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="container mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-black">Loja de moedas</h1>
        <p className="text-muted-foreground mt-2">Recarregue sua sorte. Quanto maior o pacote, melhor o bônus.</p>
      </div>

      <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-6xl mx-auto">
        {packs.map((p) => (
          <div
            key={p.id}
            className={`relative p-5 rounded-3xl bg-card border ${
              p.featured ? "border-primary shadow-[var(--shadow-glow)]" : "border-border"
            } flex flex-col`}
          >
            {p.featured && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-gradient-to-r from-primary to-accent text-xs font-bold uppercase whitespace-nowrap">
                Melhor valor
              </div>
            )}
            <Coins className="h-10 w-10 text-[color:var(--gold)] mb-2" />
            <h3 className="font-bold">{p.name}</h3>
            <div className="text-2xl font-black mt-1">{p.coins.toLocaleString("pt-BR")}</div>
            <div className="text-xs text-muted-foreground">moedas</div>
            {p.bonus && (
              <span className="mt-2 inline-block text-xs font-bold text-accent">{p.bonus} bônus</span>
            )}
            <div className="mt-auto pt-4">
              <div className="text-lg font-bold">{p.price}</div>
              <Button
                onClick={() => mutation.mutate(p.id)}
                disabled={mutation.isPending}
                className="w-full mt-2 bg-gradient-to-r from-primary to-accent border-0"
                size="sm"
              >
                Comprar
              </Button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Demonstração — pagamento simulado. Conecte um provedor real para faturar.
      </p>
    </main>
  );
}