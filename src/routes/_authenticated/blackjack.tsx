import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { playBlackjack } from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/blackjack")({
  head: () => ({ meta: [{ title: "Blackjack — Luxe Casino" }] }),
  component: BlackjackPage,
});

type Card = { rank: string; suit: string };

function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (hidden || !card) {
    return <div className="w-20 h-28 rounded-xl bg-gradient-to-br from-primary to-accent border-2 border-border" />;
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div className={`w-20 h-28 rounded-xl bg-card border-2 border-border flex flex-col items-center justify-center ${red ? "text-red-400" : "text-foreground"}`}>
      <span className="text-2xl font-bold">{card.rank}</span>
      <span className="text-3xl">{card.suit}</span>
    </div>
  );
}

export default function BlackjackPage() {
  const qc = useQueryClient();
  const play = useServerFn(playBlackjack);
  const [bet, setBet] = useState(100);
  const [hand, setHand] = useState<null | Awaited<ReturnType<typeof play>>>(null);

  const mutation = useMutation({
    mutationFn: (b: number) => play({ data: { bet: b } }),
    onSuccess: (r) => {
      setHand(r);
      qc.invalidateQueries({ queryKey: ["me"] });
      const messages = {
        win: `Você venceu! +${r.win.toLocaleString("pt-BR")}`,
        blackjack: `BLACKJACK! +${r.win.toLocaleString("pt-BR")}`,
        push: "Empate. Aposta devolvida.",
        lose: "Dealer venceu.",
      };
      if (r.result === "lose") toast.error(messages.lose);
      else if (r.result === "push") toast(messages.push);
      else toast.success(messages[r.result]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-4xl font-black text-center">Blackjack 21</h1>
      <p className="text-center text-muted-foreground mt-1">Pague para o dealer jogar com você (auto-play simples).</p>

      <div className="mt-8 p-8 rounded-3xl bg-gradient-to-br from-purple-900/40 via-card to-pink-900/30 border-2 border-primary/40 shadow-[var(--shadow-glow)]">
        <div className="mb-8">
          <div className="text-sm text-muted-foreground mb-2">Dealer {hand && `(${hand.dv})`}</div>
          <div className="flex gap-2">
            {hand ? hand.dealer.map((c, i) => <CardView key={i} card={c} />) : <>
              <CardView hidden /><CardView hidden />
            </>}
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">Você {hand && `(${hand.pv})`}</div>
          <div className="flex gap-2">
            {hand ? hand.player.map((c, i) => <CardView key={i} card={c} />) : <>
              <CardView hidden /><CardView hidden />
            </>}
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          {[50, 100, 500, 1000, 2500].map((b) => (
            <button
              key={b}
              onClick={() => setBet(b)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                bet === b ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary/50"
              }`}
            >
              {b}
            </button>
          ))}
        </div>

        <Button
          onClick={() => mutation.mutate(bet)}
          disabled={mutation.isPending}
          size="lg"
          className="w-full mt-6 h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent border-0"
        >
          {mutation.isPending ? "Distribuindo..." : `DISTRIBUIR (${bet} moedas)`}
        </Button>
      </div>
    </main>
  );
}

export { BlackjackPage as component };