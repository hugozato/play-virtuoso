import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  startBlackjack,
  hitBlackjack,
  standBlackjack,
  getMyProfile,
} from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/blackjack")({
  head: () => ({ meta: [{ title: "Blackjack — Luxe Casino" }] }),
  component: BlackjackPage,
});

type Card = { rank: string; suit: string };

function CardView({ card, hidden, delay = 0 }: { card?: Card; hidden?: boolean; delay?: number }) {
  if (hidden || !card) {
    return (
      <div
        className="w-20 h-28 rounded-xl bg-gradient-to-br from-primary to-accent border-2 border-border shadow-lg animate-scale-in"
        style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
      />
    );
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      className={`w-20 h-28 rounded-xl bg-card border-2 border-border flex flex-col items-center justify-center shadow-lg animate-scale-in ${red ? "text-red-400" : "text-foreground"}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <span className="text-2xl font-bold">{card.rank}</span>
      <span className="text-3xl">{card.suit}</span>
    </div>
  );
}

type HandView = {
  player: Card[];
  dealer: Card[];
  dealerHidden?: number;
  pv: number;
  dv?: number;
  bet: number;
  balance: number;
  finished: boolean;
  result?: "win" | "lose" | "push" | "blackjack";
  win?: number;
};

function BlackjackPage() {
  const qc = useQueryClient();
  const start = useServerFn(startBlackjack);
  const hit = useServerFn(hitBlackjack);
  const stand = useServerFn(standBlackjack);
  const profileFn = useServerFn(getMyProfile);
  const [bet, setBet] = useState(100);
  const [hand, setHand] = useState<HandView | null>(null);

  // restore active hand on load
  useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const p = await profileFn();
      if (!hand && p.active_blackjack) {
        const s = p.active_blackjack as unknown as {
          player: Card[]; dealer: Card[]; bet: number;
        };
        const pv = s.player.reduce((t, c) => {
          if (c.rank === "A") return t + 11;
          if (["K", "Q", "J"].includes(c.rank)) return t + 10;
          return t + parseInt(c.rank);
        }, 0);
        setHand({
          player: s.player,
          dealer: [s.dealer[0]],
          dealerHidden: 1,
          pv,
          bet: s.bet,
          balance: p.coins as number,
          finished: false,
        });
      }
      return p;
    },
  });

  const applyResult = (r: HandView) => {
    setHand(r);
    qc.invalidateQueries({ queryKey: ["me"] });
    if (r.finished) {
      const msg = {
        win: `Você venceu! +${(r.win ?? 0).toLocaleString("pt-BR")}`,
        blackjack: `BLACKJACK! +${(r.win ?? 0).toLocaleString("pt-BR")}`,
        push: "Empate. Aposta devolvida.",
        lose: "Dealer venceu.",
      } as const;
      if (r.result === "lose") toast.error(msg.lose);
      else if (r.result === "push") toast(msg.push);
      else if (r.result) toast.success(msg[r.result]);
    }
  };

  const startM = useMutation({
    mutationFn: (b: number) => start({ data: { bet: b } }),
    onSuccess: (r) => applyResult(r as HandView),
    onError: (e: Error) => toast.error(e.message),
  });
  const hitM = useMutation({
    mutationFn: () => hit(),
    onSuccess: (r) => applyResult(r as HandView),
    onError: (e: Error) => toast.error(e.message),
  });
  const standM = useMutation({
    mutationFn: () => stand(),
    onSuccess: (r) => applyResult(r as HandView),
    onError: (e: Error) => toast.error(e.message),
  });

  const inHand = !!hand && !hand.finished;
  const busy = startM.isPending || hitM.isPending || standM.isPending;

  return (
    <main className="container mx-auto px-4 py-10 max-w-3xl">
      <h1 className="text-4xl font-black text-center">Blackjack 21</h1>
      <p className="text-center text-muted-foreground mt-1">
        Peça cartas até parar. Acima de 21 estoura.
      </p>

      <div className="mt-8 p-8 rounded-3xl bg-gradient-to-br from-purple-900/40 via-card to-pink-900/30 border-2 border-primary/40 shadow-[var(--shadow-glow)]">
        <div className="mb-8">
          <div className="text-sm text-muted-foreground mb-2">
            Dealer {hand?.finished && hand.dv !== undefined ? `(${hand.dv})` : hand ? "(?)" : ""}
          </div>
          <div className="flex gap-2">
            {hand ? (
              <>
                {hand.dealer.map((c, i) => (
                  <CardView key={`d${i}`} card={c} delay={i * 120} />
                ))}
                {!hand.finished && Array.from({ length: hand.dealerHidden ?? 0 }).map((_, i) => (
                  <CardView key={`dh${i}`} hidden delay={(hand.dealer.length + i) * 120} />
                ))}
              </>
            ) : (
              <>
                <CardView hidden />
                <CardView hidden />
              </>
            )}
          </div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground mb-2">
            Você {hand && `(${hand.pv})`}
            {hand && hand.pv > 21 && <span className="ml-2 text-red-400 font-bold">ESTOUROU!</span>}
          </div>
          <div className="flex gap-2">
            {hand ? hand.player.map((c, i) => <CardView key={`p${i}`} card={c} delay={i * 120} />) : (
              <>
                <CardView hidden />
                <CardView hidden />
              </>
            )}
          </div>
        </div>

        {!inHand && (
          <>
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
              onClick={() => startM.mutate(bet)}
              disabled={busy}
              size="lg"
              className="w-full mt-6 h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent border-0"
            >
              {startM.isPending ? "Distribuindo..." : `DISTRIBUIR (${bet} moedas)`}
            </Button>
          </>
        )}

        {inHand && (
          <div className="mt-8 grid grid-cols-2 gap-3">
            <Button
              onClick={() => hitM.mutate()}
              disabled={busy}
              size="lg"
              className="h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent border-0"
            >
              {hitM.isPending ? "..." : "PEDIR CARTA"}
            </Button>
            <Button
              onClick={() => standM.mutate()}
              disabled={busy}
              size="lg"
              variant="outline"
              className="h-14 text-lg font-bold"
            >
              {standM.isPending ? "..." : "PARAR"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
