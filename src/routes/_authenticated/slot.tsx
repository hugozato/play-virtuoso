import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { spinSlot } from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/slot")({
  head: () => ({ meta: [{ title: "Slot — Luxe Casino" }] }),
  component: SlotPage,
});

function SlotPage() {
  const qc = useQueryClient();
  const spin = useServerFn(spinSlot);
  const [bet, setBet] = useState(50);
  const [reels, setReels] = useState<string[]>(["?", "?", "?"]);
  const [spinning, setSpinning] = useState(false);
  const [lastWin, setLastWin] = useState<number | null>(null);

  const mutation = useMutation({
    mutationFn: (b: number) => spin({ data: { bet: b } }),
    onSuccess: (r) => {
      setSpinning(true);
      let ticks = 0;
      const interval = setInterval(() => {
        setReels(["🍒🍋🔔⭐💎7️⃣".split("")[Math.floor(Math.random() * 6)], "?", "?"]);
        ticks++;
        if (ticks > 8) {
          clearInterval(interval);
          setReels(r.reels);
          setLastWin(r.win);
          setSpinning(false);
          qc.invalidateQueries({ queryKey: ["me"] });
          if (r.win > 0) toast.success(`Ganhou ${r.win.toLocaleString("pt-BR")} moedas! 🎉`);
        }
      }, 80);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      <h1 className="text-4xl font-black text-center">Slot Machine</h1>
      <p className="text-center text-muted-foreground mt-1">3 iguais = jackpot · 2 iguais = 1.5×</p>

      <div className="mt-8 p-8 rounded-3xl bg-gradient-to-br from-primary/20 via-card to-accent/20 border-2 border-primary/40 shadow-[var(--shadow-glow)]">
        <div className="grid grid-cols-3 gap-3">
          {reels.map((symbol, i) => (
            <div
              key={i}
              className={`aspect-square rounded-2xl bg-background/60 border border-border flex items-center justify-center text-7xl ${
                spinning ? "animate-pulse" : ""
              }`}
            >
              {symbol}
            </div>
          ))}
        </div>

        {lastWin !== null && !spinning && (
          <div className="mt-6 text-center">
            {lastWin > 0 ? (
              <p className="text-2xl font-bold text-accent">+{lastWin.toLocaleString("pt-BR")} moedas!</p>
            ) : (
              <p className="text-muted-foreground">Tente novamente.</p>
            )}
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
          {[10, 50, 100, 500, 1000].map((b) => (
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
          disabled={spinning || mutation.isPending}
          size="lg"
          className="w-full mt-6 h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent border-0"
        >
          {spinning ? "Girando..." : `GIRAR (${bet} moedas)`}
        </Button>
      </div>
    </main>
  );
}