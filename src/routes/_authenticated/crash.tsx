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
const HISTORY_KEY = "crash:history";
const MAX_DISPLAY_MS = 30_000; // x-axis window

type Active = {
  bet: number;
  startedAt: number;
  autoCashout: number | null;
  crashPoint: number;
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

function loadHistory(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const v = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(v) ? v.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function pushHistory(mult: number): number[] {
  const next = [Number(mult.toFixed(2)), ...loadHistory()].slice(0, 12);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
}

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
  const [history, setHistory] = useState<number[]>([]);
  const rafRef = useRef<number | null>(null);
  const cashedRef = useRef(false);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

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
      setHistory(pushHistory(r.crashPoint));
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
      // crash hit — resolve as loss automatically
      if (!cashedRef.current && m >= active.crashPoint) {
        cashedRef.current = true;
        setMult(active.crashPoint);
        cashoutMutation.mutate();
        return;
      }
      setMult(m);
      // auto-cashout target reached before crash
      if (
        !cashedRef.current &&
        active.autoCashout &&
        m >= active.autoCashout
      ) {
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
  const crashed = lastResult?.result === "crashed";
  const displayMult = running ? mult : crashed ? lastResult!.crashPoint : lastResult?.multiplier ?? 1.0;

  // Build SVG curve from elapsed → multiplier (exponential)
  const elapsedMs = running ? Math.min(Date.now() - active!.startedAt, MAX_DISPLAY_MS) : 0;
  // dynamic Y scale so curve fits as multiplier grows
  const yMax = Math.max(2, displayMult * 1.1);
  const W = 100;
  const H = 100;
  const steps = 60;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * elapsedMs;
    const m = Math.pow(Math.E, GROWTH * t);
    const x = (t / MAX_DISPLAY_MS) * W;
    const y = H - ((m - 1) / (yMax - 1)) * H;
    points.push(`${x.toFixed(2)},${Math.max(0, y).toFixed(2)}`);
  }
  const polyline = points.join(" ");
  const areaPath =
    points.length > 1
      ? `M0,${H} L${polyline.split(" ").join(" L")} L${(elapsedMs / MAX_DISPLAY_MS * W).toFixed(2)},${H} Z`
      : "";
  const lastPt = points[points.length - 1]?.split(",") ?? ["0", String(H)];

  const curveColor = crashed ? "rgb(248,113,113)" : "rgb(74,222,128)";

  // Side bar fill (multiplier progress towards yMax cap visual)
  const barPct = Math.min(100, ((displayMult - 1) / Math.max(0.01, yMax - 1)) * 100);

  return (
    <main className="container mx-auto px-4 py-6 max-w-6xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl md:text-3xl font-black flex items-center gap-2">
          <Rocket className="h-6 w-6 text-accent" /> Crash
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 border border-primary/30 ml-2">
            <Crown className="h-3 w-3 text-[color:var(--gold)]" />
            <span className="text-[10px] font-bold uppercase tracking-wider">VIP</span>
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
        {/* Sidebar controls */}
        <aside className="rounded-2xl bg-card/60 border border-border p-4 space-y-4 h-fit">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground">
              Valor da aposta
            </label>
            <Input
              type="number"
              min={50}
              max={10000}
              value={bet}
              disabled={running}
              onChange={(e) => setBet(Math.max(50, Number(e.target.value) || 50))}
              className="mt-1 h-11 text-base font-bold"
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
              Sacar em
              <button
                onClick={() => setAutoEnabled((v) => !v)}
                disabled={running}
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  autoEnabled
                    ? "bg-accent/20 border-accent text-accent"
                    : "border-border text-muted-foreground"
                }`}
              >
                {autoEnabled ? "AUTO ON" : "AUTO OFF"}
              </button>
            </label>
            <Input
              type="number"
              step="0.01"
              min={1.01}
              value={autoCashout}
              disabled={running || !autoEnabled}
              onChange={(e) => setAutoCashout(e.target.value)}
              className="mt-1 h-11 text-base font-bold"
            />
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {["1.50", "2.00", "5.00", "10.00"].map((m) => (
                <button
                  key={m}
                  disabled={running || !autoEnabled}
                  onClick={() => setAutoCashout(m)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                    autoCashout === m
                      ? "bg-accent border-accent text-accent-foreground"
                      : "border-border hover:border-accent/50"
                  } disabled:opacity-50`}
                >
                  {m}x
                </button>
              ))}
            </div>
          </div>

          {!running ? (
            <Button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              size="lg"
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-accent border-0"
            >
              Aposte na próxima rodada
            </Button>
          ) : (
            <Button
              onClick={() => {
                cashedRef.current = true;
                cashoutMutation.mutate();
              }}
              disabled={cashoutMutation.isPending}
              size="lg"
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-accent to-[color:var(--gold)] text-black border-0"
            >
              SACAR {mult.toFixed(2)}x · +
              {Math.floor((active?.bet ?? 0) * mult).toLocaleString("pt-BR")}
            </Button>
          )}

          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Lucro na vitória
            </div>
            <div className="mt-1 h-11 px-3 flex items-center rounded-md border border-border bg-background/40 text-base font-bold tabular-nums">
              +{Math.floor(bet * (Number.parseFloat(autoCashout) || 2) - bet).toLocaleString("pt-BR")}
            </div>
          </div>
        </aside>

        {/* Graph area */}
        <section className="rounded-2xl bg-gradient-to-br from-card/80 via-card/40 to-background border border-border overflow-hidden">
          {/* Top: last rounds history */}
          <div className="flex items-center gap-2 p-3 border-b border-border overflow-x-auto">
            {history.length === 0 && (
              <span className="text-xs text-muted-foreground px-2">Sem histórico ainda</span>
            )}
            {history.map((m, i) => {
              const green = m >= 2;
              return (
                <span
                  key={i}
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-bold tabular-nums border ${
                    green
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : "bg-muted/30 border-border text-muted-foreground"
                  }`}
                >
                  {m.toFixed(2)}x
                </span>
              );
            })}
          </div>

          {/* Graph + bar */}
          <div className="relative flex h-[360px] md:h-[440px]">
            {/* Vertical multiplier bar */}
            <div className="relative w-10 border-r border-border bg-background/30">
              <div
                className={`absolute bottom-0 left-0 right-0 transition-[height] duration-75 ${
                  crashed
                    ? "bg-gradient-to-t from-red-500/70 to-red-400/30"
                    : "bg-gradient-to-t from-emerald-500/80 to-emerald-300/30"
                }`}
                style={{ height: `${barPct}%` }}
              />
              <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-muted-foreground/70 px-1 py-2 tabular-nums">
                <span>{yMax.toFixed(1)}x</span>
                <span>1.0x</span>
              </div>
            </div>

            {/* SVG curve */}
            <div className="relative flex-1">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
                className="absolute inset-0 w-full h-full"
              >
                <defs>
                  <linearGradient id="crashFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={curveColor} stopOpacity="0.45" />
                    <stop offset="100%" stopColor={curveColor} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* grid */}
                {[0.25, 0.5, 0.75].map((p) => (
                  <line
                    key={p}
                    x1="0"
                    x2={W}
                    y1={H * p}
                    y2={H * p}
                    stroke="currentColor"
                    strokeOpacity="0.08"
                    strokeWidth="0.3"
                  />
                ))}
                {areaPath && <path d={areaPath} fill="url(#crashFill)" />}
                {polyline && (
                  <polyline
                    points={polyline}
                    fill="none"
                    stroke={curveColor}
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {running && (
                  <circle
                    cx={lastPt[0]}
                    cy={lastPt[1]}
                    r="1.2"
                    fill="white"
                    stroke={curveColor}
                    strokeWidth="0.5"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>

              {/* Big multiplier label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <div
                  className={`text-6xl md:text-8xl font-black tabular-nums drop-shadow-[0_4px_24px_rgba(0,0,0,0.6)] ${
                    crashed ? "text-red-400" : "text-emerald-300"
                  }`}
                  style={{ WebkitTextStroke: "1px rgba(0,0,0,0.6)" }}
                >
                  {displayMult.toFixed(2)}x
                </div>
                {crashed && (
                  <div className="mt-2 text-red-400 font-bold uppercase tracking-widest text-sm">
                    💥 Crashou
                  </div>
                )}
                {!running && !crashed && lastResult?.result === "win" && (
                  <div className="mt-2 text-emerald-400 font-bold uppercase tracking-widest text-sm">
                    ✓ +{lastResult.win.toLocaleString("pt-BR")}
                  </div>
                )}
                {running && active?.autoCashout && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    Auto em{" "}
                    <span className="text-accent font-bold">
                      {active.autoCashout.toFixed(2)}x
                    </span>
                  </div>
                )}
              </div>

              <div className="absolute bottom-2 right-3 text-[10px] text-muted-foreground">
                Status da rede{" "}
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 ml-1 align-middle" />
              </div>
            </div>
          </div>

          {lastResult && (
            <div className="p-3 border-t border-border text-[11px] space-y-0.5 text-muted-foreground">
              <span className="font-bold text-foreground mr-2">Provably fair:</span>
              <span className="font-mono break-all">seed {lastResult.serverSeed.slice(0, 16)}…</span>
              <span className="mx-2">·</span>
              <span>
                crash em{" "}
                <span className="text-accent font-bold">
                  {lastResult.crashPoint.toFixed(2)}x
                </span>
              </span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}