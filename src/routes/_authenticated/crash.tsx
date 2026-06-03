import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Rocket, Lock, Crown } from "lucide-react";
import {
  cashoutCrash,
  getActiveCrash,
  getMyProfile,
  startCrash,
} from "@/lib/casino.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/crash")({
  head: () => ({ meta: [{ title: "Crash VIP — Luxe Casino" }] }),
  component: CrashPage,
});

const GROWTH = 0.00006;
const VIP_PLANS = new Set(["bronze", "silver", "gold"]);

type Active = {
  bet: number;
  startedAt: number;
  autoCashout: number | null;
  serverSeedHash: string;
  clientSeed: string;
  growth: number;
};

type Settlement = {
  result: "win" | "crashed";
  multiplier: number;
  crashPoint: number;
  serverSeed: string;
  clientSeed: string;
  win: number;
  bet: number;
};

function CrashPage() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const fetchActive = useServerFn(getActiveCrash);
  const start = useServerFn(startCrash);
  const cashout = useServerFn(cashoutCrash);

  const { data: profile } = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });
  const { data: activeFromServer } = useQuery({
    queryKey: ["crash-active"],
    queryFn: () => fetchActive(),
  });

  const [active, setActive] = useState<Active | null>(null);
  const [mult, setMult] = useState(1.0);
  const [bet, setBet] = useState(100);
  const [autoCashout, setAutoCashout] = useState<string>("2.00");
  const [autoEnabled, setAutoEnabled] = useState(true);
  const [lastResult, setLastResult] = useState<Settlement | null>(null);
  const rafRef = useRef<number | null>(null);
  const cashedRef = useRef(false);

  // hydrate active round from server (resume in-progress)
  useEffect(() => {
    if (activeFromServer && !active) setActive(activeFromServer as Active);
  }, [activeFromServer, active]);

  const startMutation = useMutation({
    mutationFn: () =>
      start({
        data: {
          bet,
          autoCashout: autoEnabled ? Number.parseFloat(autoCashout) || null : null,
        },
      }),
    onSuccess: (r) => {
      cashedRef.current = false;
      setLastResult(null);
      setActive(r);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cashoutMutation = useMutation({
    mutationFn: () => cashout(),
    onSuccess: (r) => {
      setActive(null);
      setLastResult(r);
      setMult(1.0);
      if (r.result === "win") {
        toast.success(`Sacou em ${r.multiplier.toFixed(2)}x · +${r.win.toLocaleString("pt-BR")} moedas`);
      } else {
        toast.error(`💥 Crashou em ${r.crashPoint.toFixed(2)}x`);
      }
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["crash-active"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // animate multiplier + handle auto-cashout / safety bust
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const elapsed = Date.now() - active.startedAt;
      const m = Math.max(1, Math.pow(Math.E, GROWTH * elapsed));
      setMult(m);
      // auto-cashout
      if (
        !cashedRef.current &&
        active.autoCashout &&
        m >= active.autoCashout
      ) {
        cashedRef.current = true;
        cashoutMutation.mutate();
        return;
      }
      // safety: after 60s force resolve (server reveals bust if past crashPoint)
      if (!cashedRef.current && elapsed > 60_000) {
        cashedRef.current = true;
        cashoutMutation.mutate();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const isVip = profile && VIP_PLANS.has(profile.plan);

  if (profile && !isVip) {
    return (
      <main className="container mx-auto px-4 py-16 max-w-xl text-center">
        <Lock className="h-14 w-14 mx-auto text-[color:var(--gold)] mb-4" />
        <h1 className="text-4xl font-black">Crash é exclusivo VIP</h1>
        <p className="text-muted-foreground mt-3">
          Assine o plano Bronze, Prata ou Ouro para liberar o Crash — multiplicadores explosivos e
          saques rápidos.
        </p>
        <Button asChild size="lg" className="mt-6 bg-gradient-to-r from-primary to-accent border-0">
          <Link to="/plans">
            <Crown className="h-4 w-4 mr-2" /> Virar VIP
          </Link>
        </Button>
      </main>
    );
  }

  const running = !!active;
  const displayMult = running ? mult : lastResult?.multiplier ?? 1.0;
  const crashed = lastResult?.result === "crashed";

  return (
    <main className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 mb-3">
          <Crown className="h-3.5 w-3.5 text-[color:var(--gold)]" />
          <span className="text-xs font-bold uppercase tracking-wider">VIP Exclusivo</span>
        </div>
        <h1 className="text-4xl md:text-5xl font-black flex items-center justify-center gap-2">
          <Rocket className="h-9 w-9 text-accent" />
          Crash
        </h1>
        <p className="text-muted-foreground mt-1">
          Saque antes do foguete explodir. Provavelmente justo (HMAC-SHA256).
        </p>
      </div>

      <div
        className={`relative p-10 rounded-3xl border-2 overflow-hidden text-center transition-colors ${
          crashed
            ? "bg-gradient-to-br from-red-950/60 to-red-900/30 border-red-500/60"
            : running
            ? "bg-gradient-to-br from-emerald-950/40 via-card to-accent/20 border-accent/60 shadow-[var(--shadow-glow)]"
            : "bg-gradient-to-br from-primary/20 via-card to-accent/10 border-border"
        }`}
      >
        <div className="text-7xl md:text-8xl font-black tabular-nums bg-gradient-to-r from-primary via-accent to-[color:var(--gold)] bg-clip-text text-transparent">
          {displayMult.toFixed(2)}x
        </div>
        {crashed && (
          <div className="mt-3 text-red-400 font-bold uppercase tracking-widest text-sm">
            💥 Crashou em {lastResult!.crashPoint.toFixed(2)}x
          </div>
        )}
        {!running && !crashed && lastResult?.result === "win" && (
          <div className="mt-3 text-accent font-bold uppercase tracking-widest text-sm">
            ✓ Sacou +{lastResult.win.toLocaleString("pt-BR")}
          </div>
        )}
        {running && active?.autoCashout && (
          <div className="mt-3 text-xs text-muted-foreground">
            Auto-sacar em <span className="text-accent font-bold">{active.autoCashout.toFixed(2)}x</span>
          </div>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground">Aposta</label>
          <Input
            type="number"
            min={50}
            max={10000}
            value={bet}
            disabled={running}
            onChange={(e) => setBet(Math.max(50, Number(e.target.value) || 50))}
            className="mt-1 h-12 text-lg font-bold"
          />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {[100, 500, 1000, 5000].map((b) => (
              <button
                key={b}
                disabled={running}
                onClick={() => setBet(b)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                  bet === b ? "bg-primary border-primary" : "border-border hover:border-primary/50"
                } disabled:opacity-50`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            Auto-sacar
            <button
              onClick={() => setAutoEnabled((v) => !v)}
              disabled={running}
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                autoEnabled ? "bg-accent/20 border-accent text-accent" : "border-border text-muted-foreground"
              }`}
            >
              {autoEnabled ? "ON" : "OFF"}
            </button>
          </label>
          <Input
            type="number"
            step="0.01"
            min={1.01}
            value={autoCashout}
            disabled={running || !autoEnabled}
            onChange={(e) => setAutoCashout(e.target.value)}
            className="mt-1 h-12 text-lg font-bold"
          />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {["1.50", "2.00", "5.00", "10.00"].map((m) => (
              <button
                key={m}
                disabled={running || !autoEnabled}
                onClick={() => setAutoCashout(m)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                  autoCashout === m ? "bg-accent border-accent text-accent-foreground" : "border-border hover:border-accent/50"
                } disabled:opacity-50`}
              >
                {m}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {!running ? (
        <Button
          onClick={() => startMutation.mutate()}
          disabled={startMutation.isPending}
          size="lg"
          className="w-full mt-6 h-14 text-lg font-bold bg-gradient-to-r from-primary to-accent border-0"
        >
          🚀 Lançar foguete ({bet} moedas)
        </Button>
      ) : (
        <Button
          onClick={() => {
            cashedRef.current = true;
            cashoutMutation.mutate();
          }}
          disabled={cashoutMutation.isPending}
          size="lg"
          className="w-full mt-6 h-14 text-lg font-bold bg-gradient-to-r from-accent to-[color:var(--gold)] text-black border-0"
        >
          SACAR {mult.toFixed(2)}x · +{Math.floor((active?.bet ?? 0) * mult).toLocaleString("pt-BR")}
        </Button>
      )}

      {lastResult && (
        <div className="mt-6 p-4 rounded-2xl bg-card/60 border border-border text-xs space-y-1 text-muted-foreground">
          <div className="font-bold text-foreground">Provably fair</div>
          <div>Server seed: <span className="font-mono break-all">{lastResult.serverSeed}</span></div>
          <div>Client seed: <span className="font-mono">{lastResult.clientSeed}</span></div>
          <div>Crash point: <span className="text-accent font-bold">{lastResult.crashPoint.toFixed(2)}x</span></div>
        </div>
      )}
    </main>
  );
}