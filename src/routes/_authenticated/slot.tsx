import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { getMyProfile, spinSlot } from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, Coins } from "lucide-react";

export const Route = createFileRoute("/_authenticated/slot")({
  head: () => ({ meta: [{ title: "Fortune Tiger — Luxe Casino" }] }),
  component: SlotPage,
});

const SYMBOLS = ["🍊", "🪙", "🏮", "🧧", "💰", "🐯"];
const EMPTY_GRID: string[][] = [
  ["🍊", "🪙", "🏮"],
  ["🧧", "🐯", "💰"],
  ["🪙", "🏮", "🧧"],
];

type SpinResult = Awaited<ReturnType<typeof spinSlot>>;

function SlotPage() {
  const qc = useQueryClient();
  const spin = useServerFn(spinSlot);
  const profileFn = useServerFn(getMyProfile);
  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => profileFn() });

  const [bet, setBet] = useState(50);
  const [turbo, setTurbo] = useState(false);
  const [grid, setGrid] = useState<string[][]>(EMPTY_GRID);
  const [reelSpinning, setReelSpinning] = useState<boolean[]>([false, false, false]);
  const [winningCells, setWinningCells] = useState<Set<string>>(new Set());
  const [lastResult, setLastResult] = useState<SpinResult | null>(null);
  const [bonusFlash, setBonusFlash] = useState(false);
  const tickRef = useRef<number | null>(null);

  const mutation = useMutation({
    mutationFn: (b: number) => spin({ data: { bet: b } }),
    onSuccess: (r) => animateSpin(r),
    onError: (e: Error) => toast.error(e.message),
  });

  function animateSpin(r: SpinResult) {
    setWinningCells(new Set());
    setLastResult(null);
    setReelSpinning([true, true, true]);
    // animate each column with a random symbol cycle
    const tickMs = turbo ? 40 : 80;
    const stopTimes = turbo ? [300, 500, 700] : [700, 1100, 1500];
    const start = Date.now();

    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = window.setInterval(() => {
      setGrid((g) =>
        g.map((row, ri) =>
          row.map((cell, ci) => {
            // only spinning columns get scrambled
            return reelSpinningRef.current[ci]
              ? SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
              : cell;
          }),
        ),
      );
    }, tickMs);

    stopTimes.forEach((t, colIdx) => {
      setTimeout(() => {
        setReelSpinning((s) => {
          const next = [...s];
          next[colIdx] = false;
          return next;
        });
        // lock in the final column
        setGrid((g) =>
          g.map((row, ri) => row.map((cell, ci) => (ci === colIdx ? r.grid[ri][ci] : cell))),
        );
      }, t);
    });

    const totalTime = stopTimes[stopTimes.length - 1] + 200;
    setTimeout(() => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      setGrid(r.grid);
      // collect winning cells
      const cells = new Set<string>();
      r.wins.forEach((w) => w.cells.forEach(([rr, cc]) => cells.add(`${rr}-${cc}`)));
      setWinningCells(cells);
      setLastResult(r);
      qc.invalidateQueries({ queryKey: ["me"] });
      if (r.bonusTriggered) {
        setBonusFlash(true);
        setTimeout(() => setBonusFlash(false), 2200);
        toast.success(`🎉 BÔNUS DO TIGRE x${r.bonusMultiplier}!`, { duration: 3000 });
      }
      if (r.win > 0) {
        toast.success(`Ganhou ${r.win.toLocaleString("pt-BR")} moedas! 🐯`);
      }
    }, totalTime);
  }

  // mirror ref so the interval reads the latest array
  const reelSpinningRef = useRef(reelSpinning);
  useEffect(() => {
    reelSpinningRef.current = reelSpinning;
  }, [reelSpinning]);

  useEffect(() => () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
  }, []);

  const spinning = reelSpinning.some((s) => s) || mutation.isPending;
  const balance = profile?.coins ?? 0;

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

          {/* Grade 3x3 */}
          <div
            className={`relative rounded-2xl p-3 bg-gradient-to-b from-amber-100 via-yellow-50 to-amber-100 border-4 border-yellow-600 overflow-hidden transition-all ${
              bonusFlash ? "animate-pulse ring-4 ring-yellow-400" : ""
            }`}
          >
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].flatMap((r) =>
                [0, 1, 2].map((c) => {
                  const isWin = winningCells.has(`${r}-${c}`);
                  const isSpinning = reelSpinning[c];
                  return (
                    <div
                      key={`${r}-${c}`}
                      className={`aspect-square rounded-xl flex items-center justify-center text-5xl bg-gradient-to-br from-red-700 to-red-900 border-2 transition-all duration-200 ${
                        isWin
                          ? "border-yellow-300 shadow-[0_0_20px_rgba(250,204,21,0.9)] animate-pulse scale-105"
                          : "border-yellow-700/60"
                      } ${isSpinning ? "blur-[1px]" : ""}`}
                    >
                      <span className={isSpinning ? "animate-bounce" : ""}>
                        {grid[r][c]}
                      </span>
                    </div>
                  );
                }),
              )}
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
            disabled={spinning}
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
          disabled={spinning}
          className="px-3 py-1.5 rounded-full text-xs font-bold border-2 border-yellow-700/60 text-yellow-200 hover:border-yellow-400"
        >
          MAX
        </button>
      </div>

      <Button
        onClick={() => mutation.mutate(bet)}
        disabled={spinning || bet > balance}
        size="lg"
        className="w-full mt-4 h-14 text-lg font-black bg-gradient-to-b from-yellow-300 via-yellow-500 to-amber-700 text-red-950 border-2 border-yellow-300 shadow-lg hover:scale-[1.02] transition"
      >
        <Coins className="w-5 h-5 mr-2" />
        {spinning ? "GIRANDO..." : `GIRAR (${bet})`}
      </Button>

      {/* Pay table */}
      <div className="mt-6 p-4 rounded-2xl bg-card border border-border">
        <p className="text-xs font-bold text-center text-muted-foreground mb-2">
          TABELA DE PAGAMENTOS (por linha)
        </p>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div><span className="text-2xl">🐯</span> <span className="font-bold text-yellow-400">50×</span></div>
          <div><span className="text-2xl">💰</span> <span className="font-bold">25×</span></div>
          <div><span className="text-2xl">🧧</span> <span className="font-bold">10×</span></div>
          <div><span className="text-2xl">🏮</span> <span className="font-bold">5×</span></div>
          <div><span className="text-2xl">🪙</span> <span className="font-bold">3×</span></div>
          <div><span className="text-2xl">🍊</span> <span className="font-bold">2×</span></div>
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-3">
          🐯 substitui qualquer símbolo · 2 🐯 = bônus x2 · 3 = x3 · 4 = x5 · 5+ = x10
        </p>
      </div>
    </main>
  );
}