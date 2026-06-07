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
        className="w-20 h-28 rounded-xl border-2 border-amber-300/40 shadow-2xl animate-scale-in relative overflow-hidden"
        style={{
          animationDelay: `${delay}ms`,
          animationFillMode: "both",
          background:
            "repeating-linear-gradient(45deg, hsl(0 70% 35%), hsl(0 70% 35%) 6px, hsl(0 75% 28%) 6px, hsl(0 75% 28%) 12px)",
        }}
      >
        <div className="absolute inset-1 rounded-lg border border-amber-300/30" />
      </div>
    );
  }
  const red = card.suit === "♥" || card.suit === "♦";
  return (
    <div
      className={`w-20 h-28 rounded-xl bg-white border border-zinc-300 flex flex-col items-center justify-center shadow-2xl animate-scale-in ${red ? "text-red-600" : "text-zinc-900"}`}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <span className="text-2xl font-bold leading-none">{card.rank}</span>
      <span className="text-3xl leading-none mt-1">{card.suit}</span>
    </div>
  );
}

const CHIPS: { value: number; color: string; ring: string }[] = [
  { value: 10, color: "bg-white text-zinc-900", ring: "ring-zinc-400" },
  { value: 50, color: "bg-red-600 text-white", ring: "ring-red-300" },
  { value: 100, color: "bg-blue-600 text-white", ring: "ring-blue-300" },
  { value: 500, color: "bg-emerald-600 text-white", ring: "ring-emerald-300" },
  { value: 1000, color: "bg-zinc-900 text-amber-300", ring: "ring-amber-400" },
  { value: 5000, color: "bg-purple-700 text-white", ring: "ring-purple-300" },
];

function Chip({
  value,
  color,
  ring,
  onClick,
  disabled,
  size = "md",
}: {
  value: number;
  color: string;
  ring: string;
  onClick?: () => void;
  disabled?: boolean;
  size?: "md" | "sm";
}) {
  const dim = size === "md" ? "w-14 h-14 text-xs" : "w-10 h-10 text-[10px]";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`relative rounded-full ${dim} ${color} font-black shadow-xl ring-4 ${ring} ring-offset-2 ring-offset-transparent border-2 border-white/30 transition hover:-translate-y-1 disabled:opacity-40 disabled:hover:translate-y-0`}
      style={{
        backgroundImage:
          "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.15) 0deg 15deg, transparent 15deg 30deg)",
      }}
    >
      <span className="absolute inset-0 flex items-center justify-center">
        {value >= 1000 ? `${value / 1000}K` : value}
      </span>
    </button>
  );
}

function ChipStack({ amount }: { amount: number }) {
  // pick largest chip color for visual stack
  const chip = [...CHIPS].reverse().find((c) => amount >= c.value) ?? CHIPS[0];
  return (
    <div className="relative w-16 h-16 flex items-center justify-center">
      <div className={`absolute w-14 h-3 rounded-full ${chip.color} opacity-70 -bottom-1 blur-[1px]`} />
      <div className={`absolute w-14 h-3 rounded-full ${chip.color} top-2`} />
      <div className={`absolute w-14 h-3 rounded-full ${chip.color} top-5`} />
      <Chip value={amount} color={chip.color} ring={chip.ring} />
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
  const balance = hand?.balance ?? 0;

  return (
    <main className="container mx-auto px-4 py-6 max-w-3xl">
      <h1 className="text-3xl font-black text-center tracking-wide">Blackjack 21</h1>

      {/* Poker table */}
      <div className="mt-6 relative rounded-[50%/22%] p-8 pt-12 pb-32 border-[10px] border-amber-900 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]"
        style={{
          background:
            "radial-gradient(ellipse at center, hsl(140 55% 28%) 0%, hsl(140 60% 18%) 70%, hsl(140 65% 12%) 100%)",
        }}
      >
        {/* Table felt arc text */}
        <div className="absolute inset-x-0 top-[38%] text-center text-emerald-100/30 font-serif italic text-xs sm:text-sm tracking-[0.3em] pointer-events-none select-none">
          BLACKJACK PAGA 3 PARA 2
          <div className="mt-1 text-[10px] sm:text-xs">O CRUPIÊ FICA EM TODAS AS 17 E ACIMA</div>
        </div>

        {/* Dealer */}
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-2">
            {hand ? (
              <>
                {hand.dealer.map((c, i) => (
                  <CardView key={`d${i}`} card={c} delay={i * 120} />
                ))}
                {!hand.finished &&
                  Array.from({ length: hand.dealerHidden ?? 0 }).map((_, i) => (
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
          {hand && (
            <div className="px-3 py-0.5 rounded-full bg-white text-zinc-900 text-sm font-bold shadow">
              {hand.finished && hand.dv !== undefined ? hand.dv : "?"}
            </div>
          )}
        </div>

        {/* Player */}
        <div className="mt-20 flex flex-col items-center gap-2">
          {hand && (
            <div className="px-3 py-0.5 rounded-full bg-amber-400 text-zinc-900 text-sm font-bold shadow">
              {hand.pv}
              {hand.pv > 21 && <span className="ml-2 text-red-700">BUST</span>}
            </div>
          )}
          <div className="flex gap-2">
            {hand ? (
              hand.player.map((c, i) => <CardView key={`p${i}`} card={c} delay={i * 120} />)
            ) : (
              <>
                <CardView hidden />
                <CardView hidden />
              </>
            )}
          </div>

          {/* Bet stack on table */}
          {bet > 0 && !inHand && (
            <div className="mt-4 flex flex-col items-center gap-1">
              <ChipStack amount={bet} />
              <div className="text-emerald-100/80 text-xs font-semibold">{bet.toLocaleString("pt-BR")}</div>
            </div>
          )}
          {inHand && hand && (
            <div className="mt-4 flex flex-col items-center gap-1">
              <ChipStack amount={hand.bet} />
              <div className="text-emerald-100/80 text-xs font-semibold">
                {hand.bet.toLocaleString("pt-BR")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="mt-6">
        {!inHand ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-muted-foreground">
                Saldo: <span className="text-foreground font-bold">{balance.toLocaleString("pt-BR")}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                Aposta: <span className="text-amber-400 font-bold">{bet.toLocaleString("pt-BR")}</span>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap p-3 rounded-2xl bg-card/50 border border-border">
              {CHIPS.map((c) => (
                <Chip
                  key={c.value}
                  value={c.value}
                  color={c.color}
                  ring={c.ring}
                  disabled={busy || bet + c.value > balance}
                  onClick={() => setBet((b) => b + c.value)}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => setBet(0)} disabled={busy || bet === 0}>
                LIMPAR
              </Button>
              <Button
                variant="outline"
                onClick={() => setBet(Math.min(balance, bet * 2 || 100))}
                disabled={busy}
              >
                DOBRAR
              </Button>
              <Button
                onClick={() => startM.mutate(bet)}
                disabled={busy || bet <= 0 || bet > balance}
                className="font-bold bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-900 hover:from-amber-400 hover:to-amber-500 border-0"
              >
                {startM.isPending ? "..." : "APOSTAR"}
              </Button>
            </div>
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={() => hitM.mutate()}
              disabled={busy}
              size="lg"
              className="h-14 text-lg font-bold bg-emerald-600 hover:bg-emerald-500 border-0"
            >
              {hitM.isPending ? "..." : "PEDIR (HIT)"}
            </Button>
            <Button
              onClick={() => standM.mutate()}
              disabled={busy}
              size="lg"
              className="h-14 text-lg font-bold bg-red-600 hover:bg-red-500 border-0"
            >
              {standM.isPending ? "..." : "PARAR (STAND)"}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
