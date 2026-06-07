import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMyProfile, spinSlot } from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, Coins, Play, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/slot")({
  head: () => ({ meta: [{ title: "Fortune Tiger — Luxe Casino" }] }),
  component: SlotPage,
});

const SYMBOLS = ["🍊", "🪙", "🏮", "🧧", "💰", "🐯"];
const CELL = 88; // px per symbol cell
const REEL_PADDING = 18; // extra random symbols above the final 3 (longer = more spin)

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}
function buildReel(finalCol: string[]) {
  // strip layout (top -> bottom): [padding randoms..., final[0], final[1], final[2]]
  const pad = Array.from({ length: REEL_PADDING }, randomSymbol);
  return [...pad, ...finalCol];
}

type SpinResult = Awaited<ReturnType<typeof spinSlot>>;

function SlotPage() {
  const qc = useQueryClient();
  const spin = useServerFn(spinSlot);
  const profileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });

  const [bet, setBet] = useState(50);
  const [turbo, setTurbo] = useState(false);
  // Each column: array of symbols rendered as a vertical strip
  const initialReels = useMemo<string[][]>(
    () => [0, 1, 2].map(() => buildReel([randomSymbol(), randomSymbol(), randomSymbol()])),
    [],
  );
  const [reels, setReels] = useState<string[][]>(initialReels);
  // offset (px) for each column transform
  const [offsets, setOffsets] = useState<number[]>([0, 0, 0]);
  const [durations, setDurations] = useState<number[]>([0, 0, 0]);
  const [columnSpinning, setColumnSpinning] = useState<boolean[]>([false, false, false]);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [bonusFlash, setBonusFlash] = useState(false);

  // Auto-spin
  const [autoOpen, setAutoOpen] = useState(false);
  const [autoRemaining, setAutoRemaining] = useState(0);
  const autoRemainingRef = useRef(0);
  const stopAutoRef = useRef(false);

  const mutation = useMutation({
    mutationFn: (b: number) => spin({ data: { bet: b } }),
    onSuccess: (r) => animateSpin(r),
    onError: (e: Error) => {
      stopAutoRef.current = true;
      autoRemainingRef.current = 0;
      setAutoRemaining(0);
      setColumnSpinning([false, false, false]);
      toast.error(e.message);
    },
  });

  function animateSpin(r: SpinResult) {
    setWinningCells(new Set());
    setLastResult(null);

    // Build the reels for this spin: for each column build a strip ending in the 3 final symbols
    const newReels: string[][] = [0, 1, 2].map((c) =>
      buildReel([r.grid[0][c], r.grid[1][c], r.grid[2][c]]),
    );
    setReels(newReels);
    // Reset strips to the top (no transition), then trigger animation
    setDurations([0, 0, 0]);
    setOffsets([0, 0, 0]);
    setColumnSpinning([true, true, true]);

    // Per-column spin duration (ms)
    const colDurations = turbo ? [600, 800, 1000] : [1400, 1900, 2400];
    // The strip should end with final[0..2] visible in rows 0..2.
    // Strip length = REEL_PADDING + 3; we translate up by REEL_PADDING * CELL.
    const targetOffset = -REEL_PADDING * CELL;

    requestAnimationFrame(() => {
      setDurations(colDurations);
      setOffsets([targetOffset, targetOffset, targetOffset]);
    });

    colDurations.forEach((d, idx) => {
      setTimeout(() => {
        setColumnSpinning((s) => {
          const n = [...s];
          n[idx] = false;
          return n;
        });
      }, d);
    });

    const total = Math.max(...colDurations) + 80;
    setTimeout(() => {
      const cells = new Set<string>();
      r.wins.forEach((w) => w.cells.forEach(([rr, cc]) => cells.add(`${rr}-${cc}`)));
      setWinningCells(cells);
      setLastResult(r);
      qc.invalidateQueries({ queryKey: ["me"] });
      if (r.bonusTriggered) {
        setBonusFlash(true);
        setTimeout(() => setBonusFlash(false), 2200);
        toast.success(`🎉 BÔNUS DO TIGRE x${r.bonusMultiplier}!`, { duration: 2500 });
      }
      if (r.win > 0) {
        toast.success(`Ganhou ${r.win.toLocaleString("pt-BR")} moedas! 🐯`);
      }

      // Continue auto-spin
      if (!stopAutoRef.current && autoRemainingRef.current > 1) {
        autoRemainingRef.current -= 1;
        setAutoRemaining(autoRemainingRef.current);
        // small pause between auto spins
        setTimeout(() => {
          if (stopAutoRef.current) return;
          mutation.mutate(bet);
        }, turbo ? 250 : 500);
      } else {
        autoRemainingRef.current = 0;
        setAutoRemaining(0);
      }
    }, total);
  }

  function startAuto(count: number) {
    if (count <= 0) return;
    if (bet > balance) {
      toast.error("Saldo insuficiente para a aposta");
      return;
    }
    stopAutoRef.current = false;
    autoRemainingRef.current = count;
    setAutoRemaining(count);
    setAutoOpen(false);
    mutation.mutate(bet);
  }
  function stopAuto() {
    stopAutoRef.current = true;
    autoRemainingRef.current = 0;
    setAutoRemaining(0);
  }

  const spinning = columnSpinning.some((s) => s) || mutation.isPending;
  const balance = profile?.coins ?? 0;
  const autoActive = autoRemaining > 0;

  return (
    <main className="container mx-auto px-3 py-6 max-w-md">
      <h1 className="text-3xl font-black text-center bg-gradient-to-b from-yellow-300 via-yellow-500 to-amber-700 bg-clip-text text-transparent drop-shadow">
        🐯 FORTUNE TIGER 🐯
      </h1>
      <p className="text-center text-xs text-muted-foreground mt-1">
        3 iguais em linha · 🐯 é wild · 2+ tigres = bônus
      </p>

      {/* Cabine */}
      <div className="relative mt-4 rounded-[2rem] p-1 bg-gradient-to-b from-yellow-500 via-amber-600 to-yellow-700 shadow-2xl">
        <div className="rounded-[1.7rem] bg-gradient-to-b from-red-900 via-red-950 to-red-900 p-3">
          {/* topo decorativo */}
          <div className="flex justify-between items-center px-2 pb-2 text-2xl">
            <span>🏮</span>
            <span className="text-xs font-bold text-yellow-300 tracking-widest">福 福 福</span>
            <span>🏮</span>
          </div>

          {/* Reels 3x3 com strip vertical */}
          <div
            className={`relative rounded-2xl p-3 bg-gradient-to-b from-amber-100 via-yellow-50 to-amber-100 border-4 border-yellow-600 overflow-hidden transition-all ${
              bonusFlash ? "animate-pulse ring-4 ring-yellow-400" : ""
            }`}
          >
            <div
              className="grid grid-cols-3 gap-2"
              style={{ height: CELL * 3 }}
            >
              {[0, 1, 2].map((c) => {
                const isSpinning = columnSpinning[c];
                const strip = reels[c];
                return (
                  <div
                    key={c}
                    className="relative overflow-hidden rounded-xl bg-gradient-to-b from-amber-50 to-amber-100 border-2 border-yellow-700/60"
                    style={{ height: CELL * 3 }}
                  >
                    <div
                      className="will-change-transform"
                      style={{
                        transform: `translateY(${offsets[c]}px)`,
                        transition: durations[c]
                          ? `transform ${durations[c]}ms cubic-bezier(0.25, 0.9, 0.3, 1.05)`
                          : "none",
                      }}
                    >
                      {strip.map((sym, i) => {
                        // The last 3 entries (i = strip.length-3..strip.length-1) correspond to rows 0..2
                        const finalRow = i - (strip.length - 3);
                        const isWinCell =
                          !isSpinning && finalRow >= 0 && winningCells.has(`${finalRow}-${c}`);
                        return (
                          <div
                            key={i}
                            className={`flex items-center justify-center text-5xl ${
                              isSpinning ? "blur-[2px]" : ""
                            } ${
                              isWinCell
                                ? "bg-yellow-300/60 ring-2 ring-yellow-500 rounded-lg animate-pulse"
                                : ""
                            }`}
                            style={{ height: CELL }}
                          >
                            {sym}
                          </div>
                        );
                      })}
                    </div>
                    {/* Top/bottom shadow gradient for depth */}
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/30 to-transparent" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-black/30 to-transparent" />
                  </div>
                );
              })}
            </div>

            {bonusFlash && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-5xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(0,0,0,0.8)] animate-bounce">
                  BÔNUS x{lastResult?.bonusMultiplier}
                </div>
              </div>
            )}
          </div>

          {/* HUD */}
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-red-950/80 border border-yellow-700 py-2">
              <p className="text-[10px] uppercase text-yellow-400/80">Saldo</p>
              <p className="text-sm font-bold text-yellow-200">
                {balance.toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="rounded-lg bg-red-950/80 border border-yellow-700 py-2">
              <p className="text-[10px] uppercase text-yellow-400/80">Aposta</p>
              <p className="text-sm font-bold text-yellow-200">{bet}</p>
            </div>
            <div className="rounded-lg bg-red-950/80 border border-yellow-700 py-2">
              <p className="text-[10px] uppercase text-yellow-400/80">Ganho</p>
              <p className="text-sm font-bold text-green-300">
                {lastResult?.win ? `+${lastResult.win.toLocaleString("pt-BR")}` : "0"}
              </p>
            </div>
          </div>

          {/* Turbo toggle */}
          <button
            onClick={() => setTurbo((t) => !t)}
            className={`mt-2 w-full rounded-full py-1.5 text-xs font-bold flex items-center justify-center gap-1 transition ${
              turbo
                ? "bg-yellow-400 text-red-900"
                : "bg-red-950/60 text-yellow-300 border border-yellow-700"
            }`}
          >
            <Zap className="w-3 h-3" />
            {turbo ? "Turbo ativado" : "Turbo desligado"}
          </button>
        </div>
      </div>

      {/* Chips */}
      <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
        {[10, 50, 100, 500, 1000, 5000].map((b) => (
          <button
            key={b}
            onClick={() => setBet(b)}
            disabled={spinning || autoActive}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
              bet === b
                ? "bg-yellow-400 border-yellow-300 text-red-900"
                : "border-yellow-700/60 text-yellow-200 hover:border-yellow-400"
            }`}
          >
            {b}
          </button>
        ))}
        <button
          onClick={() => setBet(Math.max(10, Math.min(100000, balance)))}
          disabled={spinning || autoActive}
          className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-yellow-700/60 text-yellow-200 hover:border-yellow-400"
        >
          MAX
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          onClick={() => mutation.mutate(bet)}
          disabled={spinning || bet > balance || autoActive}
          size="lg"
          className="flex-1 h-14 text-lg font-black bg-gradient-to-b from-yellow-300 via-yellow-500 to-amber-700 text-red-950 border-2 border-yellow-300 shadow-lg hover:scale-[1.02] transition"
        >
          <Coins className="w-5 h-5 mr-2" />
          {spinning ? "GIRANDO..." : `GIRAR (${bet})`}
        </Button>
        {autoActive ? (
          <Button
            onClick={stopAuto}
            size="lg"
            variant="destructive"
            className="h-14 px-4 font-bold"
          >
            <X className="w-5 h-5 mr-1" />
            PARAR ({autoRemaining})
          </Button>
        ) : (
          <Button
            onClick={() => setAutoOpen(true)}
            disabled={spinning || bet > balance}
            size="lg"
            variant="outline"
            className="h-14 px-4 font-bold border-2 border-yellow-500 text-yellow-300 hover:bg-yellow-500/10"
          >
            <Play className="w-5 h-5 mr-1" />
            AUTO
          </Button>
        )}
      </div>

      {/* Pay table */}
      <div className="mt-6 p-4 rounded-2xl bg-card border border-border">
        <p className="text-xs font-bold text-center text-muted-foreground mb-2">
          TABELA DE PAGAMENTOS (por linha)
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div><span className="text-2xl">🐯</span> <span className="font-bold text-yellow-400">25×</span></div>
          <div><span className="text-2xl">💰</span> <span className="font-bold">12×</span></div>
          <div><span className="text-2xl">🧧</span> <span className="font-bold">5×</span></div>
          <div><span className="text-2xl">🏮</span> <span className="font-bold">2.5×</span></div>
          <div><span className="text-2xl">🪙</span> <span className="font-bold">1.5×</span></div>
          <div><span className="text-2xl">🍊</span> <span className="font-bold">1×</span></div>
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-3">
          Multiplicador aplicado sobre a aposta total por linha vencedora · 🐯 substitui qualquer símbolo · 2 🐯 = bônus x2 · 3 = x3 · 4 = x5 · 5+ = x10
        </p>
      </div>

      {/* Auto-spin modal */}
      <Dialog open={autoOpen} onOpenChange={setAutoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">Rodada automática</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground text-center">
            Nº de rodadas automáticas
          </p>
          <div className="grid grid-cols-5 gap-2 mt-2">
            {[10, 30, 50, 80, 100].map((n) => (
              <button
                key={n}
                onClick={() => startAuto(n)}
                className="rounded-lg border-2 border-yellow-500/60 py-2 text-sm font-bold text-yellow-400 hover:bg-yellow-500/10 transition"
              >
                {n}
              </button>
            ))}
          </div>
          <Button
            onClick={() => startAuto(1000)}
            className="w-full mt-3 bg-gradient-to-b from-yellow-300 via-yellow-500 to-amber-700 text-red-950 font-black h-12"
          >
            Começar 1000 rodadas
          </Button>
          <p className="text-[10px] text-center text-muted-foreground mt-2">
            Aposta atual: {bet.toLocaleString("pt-BR")} moedas · Para cancelar use o botão PARAR.
          </p>
        </DialogContent>
      </Dialog>
    </main>
  );
}