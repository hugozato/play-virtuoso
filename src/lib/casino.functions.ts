import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PLANS,
  adjustCoins,
  getProfile,
  handValue,
  newDeck,
  saveBJ,
  settleBJ,
  supabaseAdmin,
  type BJState,
  type Card,
  type Plan,
} from "./casino.server";
import {
  CRASH_GROWTH,
  generateCrashPoint,
  multiplierAt,
  newCrashSeeds,
  saveCrash,
  type CrashState,
} from "./casino.server";

export const claimDailyBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const profile = await getProfile(userId);
    const last = profile.last_daily_bonus_at ? new Date(profile.last_daily_bonus_at) : null;
    const now = new Date();
    if (last && now.getTime() - last.getTime() < 20 * 60 * 60 * 1000) {
      const nextAt = new Date(last.getTime() + 24 * 60 * 60 * 1000);
      throw new Error(`Volte em ${Math.ceil((nextAt.getTime() - now.getTime()) / 3600000)}h`);
    }
    const amount = PLANS[profile.plan as Plan].dailyBonus;
    const balance = await adjustCoins(userId, amount, "daily_bonus");
    await supabaseAdmin
      .from("profiles")
      .update({ last_daily_bonus_at: now.toISOString() })
      .eq("id", userId);
    return { amount, balance };
  });

// Slot machine: server-authoritative spin
const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "7️⃣"];
const SLOT_PAYOUT: Record<string, number> = {
  "🍒": 3, "🍋": 5, "🔔": 8, "⭐": 15, "💎": 30, "7️⃣": 50,
};

export const spinSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bet: z.number().int().min(10).max(5000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { bet } = data;
    await adjustCoins(userId, -bet, "slot_bet", "slot");
    const reels = [
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
      SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)],
    ];
    let win = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      win = bet * SLOT_PAYOUT[reels[0]];
    } else if (reels[0] === reels[1] || reels[1] === reels[2]) {
      win = Math.floor(bet * 1.5);
    }
    let balance = (await getProfile(userId)).coins as number;
    if (win > 0) {
      balance = await adjustCoins(userId, win, "slot_win", "slot", { reels });
    }
    return { reels, win, balance };
  });

// Blackjack — server-authoritative single hand
export const playBlackjack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ bet: z.number().int().min(50).max(5000) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { bet } = data;
    await adjustCoins(userId, -bet, "blackjack_bet", "blackjack");
    const deck = newDeck();
    const player: Card[] = [deck.pop()!, deck.pop()!];
    const dealer: Card[] = [deck.pop()!, deck.pop()!];
    // Simple auto-play: player stands at >=17, hits otherwise
    while (handValue(player) < 17) player.push(deck.pop()!);
    const pv = handValue(player);
    if (pv <= 21) {
      while (handValue(dealer) < 17) dealer.push(deck.pop()!);
    }
    const dv = handValue(dealer);
    let result: "win" | "lose" | "push" | "blackjack" = "lose";
    let win = 0;
    if (pv > 21) result = "lose";
    else if (pv === 21 && player.length === 2) { result = "blackjack"; win = Math.floor(bet * 2.5); }
    else if (dv > 21 || pv > dv) { result = "win"; win = bet * 2; }
    else if (pv === dv) { result = "push"; win = bet; }
    let balance = (await getProfile(userId)).coins as number;
    if (win > 0) {
      balance = await adjustCoins(userId, win, "blackjack_win", "blackjack", { result, pv, dv });
    }
    return { player, dealer, pv, dv, result, win, balance };
  });

export const startBlackjack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ bet: z.number().int().min(50).max(5000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const profile = await getProfile(userId);
    if (profile.active_blackjack) throw new Error("Você já tem uma mão em andamento");
    await adjustCoins(userId, -data.bet, "blackjack_bet", "blackjack");
    const deck = newDeck();
    const player: Card[] = [deck.pop()!, deck.pop()!];
    const dealer: Card[] = [deck.pop()!, deck.pop()!];
    const state: BJState = { deck, player, dealer, bet: data.bet };
    const pv = handValue(player);
    // natural blackjack -> settle immediately
    if (pv === 21) return await settleBJ(userId, state);
    await saveBJ(userId, state);
    const balance = (await getProfile(userId)).coins as number;
    return {
      player,
      dealer: [dealer[0]] as Card[],
      dealerHidden: 1,
      pv,
      bet: data.bet,
      balance,
      finished: false as const,
    };
  });

export const hitBlackjack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const profile = await getProfile(userId);
    const state = profile.active_blackjack as unknown as BJState | null;
    if (!state) throw new Error("Nenhuma mão ativa");
    state.player.push(state.deck.pop()!);
    const pv = handValue(state.player);
    if (pv >= 21) return await settleBJ(userId, state);
    await saveBJ(userId, state);
    const balance = (await getProfile(userId)).coins as number;
    return {
      player: state.player,
      dealer: [state.dealer[0]] as Card[],
      dealerHidden: 1,
      pv,
      bet: state.bet,
      balance,
      finished: false as const,
    };
  });

export const standBlackjack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const profile = await getProfile(userId);
    const state = profile.active_blackjack as unknown as BJState | null;
    if (!state) throw new Error("Nenhuma mão ativa");
    return await settleBJ(userId, state);
  });

export const buyPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ plan: z.enum(["bronze", "silver", "gold"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const config = PLANS[data.plan];
    await supabaseAdmin.from("profiles").update({ plan: data.plan }).eq("id", userId);
    const balance = await adjustCoins(userId, config.monthlyCoins, "plan_grant", undefined, {
      plan: data.plan,
    });
    return { plan: data.plan, balance };
  });

const PACKS = {
  starter: { coins: 1000, price: 500 },
  popular: { coins: 6000, price: 2500 },
  big: { coins: 15000, price: 5000 },
  whale: { coins: 50000, price: 15000 },
  mega: { coins: 200000, price: 50000 },
} as const;

export const buyPack = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ pack: z.enum(["starter", "popular", "big", "whale", "mega"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const pack = PACKS[data.pack];
    const balance = await adjustCoins(userId, pack.coins, "pack_purchase", undefined, {
      pack: data.pack,
    });
    return { balance, coins: pack.coins };
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return await getProfile(context.userId);
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        username: z.string().min(3).max(30).optional(),
        avatar_url: z.string().url().optional().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const profile = await getProfile(userId);

    const updates: Record<string, unknown> = {};

    if (data.avatar_url !== undefined) {
      updates.avatar_url = data.avatar_url || null;
    }

    if (data.username !== undefined && data.username !== profile.username) {
      if (profile.username_changed_at) {
        const lastChange = new Date(profile.username_changed_at);
        const oneYear = 365 * 24 * 60 * 60 * 1000;
        if (Date.now() - lastChange.getTime() < oneYear) {
          const nextDate = new Date(lastChange.getTime() + oneYear);
          throw new Error(
            `Você só pode trocar o nome novamente em ${nextDate.toLocaleDateString("pt-BR")}`,
          );
        }
      }
      updates.username = data.username;
      updates.username_changed_at = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) return profile;

    const { data: updated, error } = await supabaseAdmin
      .from("profiles")
      .update(updates as never)
      .eq("id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return updated;
  });

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, username, coins, plan, avatar_url")
      .order("coins", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data;
  });

// ============ CRASH GAME (VIP Bronze+) ============

const VIP_PLANS = new Set(["bronze", "silver", "gold"]);

function publicCrashState(state: CrashState) {
  return {
    bet: state.bet,
    startedAt: state.startedAt,
    autoCashout: state.autoCashout,
    crashPoint: state.crashPoint,
    serverSeedHash: createSeedHash(state.serverSeed),
    clientSeed: state.clientSeed,
    growth: CRASH_GROWTH,
  };
}

function createSeedHash(seed: string): string {
  // Reveal a hash up-front for provably-fair; full seed shown after settlement.
  // Lightweight hash via Web Crypto-free fallback: simple djb2-ish hex chunk.
  // (Seed itself is 32 hex chars; this just commits to it for the client.)
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const startCrash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        bet: z.number().int().min(50).max(1_000_000),
        autoCashout: z.number().min(1.01).max(1000).nullable().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const profile = await getProfile(userId);
    if (!VIP_PLANS.has(profile.plan as string)) {
      throw new Error("Apenas assinantes VIP (Bronze+) podem jogar Crash.");
    }
    if (profile.active_crash) {
      throw new Error("Você já tem uma rodada em andamento.");
    }
    await adjustCoins(userId, -data.bet, "crash_bet", "crash");
    const { serverSeed, clientSeed } = newCrashSeeds();
    const crashPoint = generateCrashPoint(serverSeed, clientSeed);
    const state: CrashState = {
      serverSeed,
      clientSeed,
      crashPoint,
      bet: data.bet,
      startedAt: Date.now(),
      autoCashout: data.autoCashout ?? null,
    };
    await saveCrash(userId, state);
    const balance = (await getProfile(userId)).coins as number;
    return { ...publicCrashState(state), balance };
  });

export const cashoutCrash = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const profile = await getProfile(userId);
    const state = profile.active_crash as unknown as CrashState | null;
    if (!state) throw new Error("Nenhuma rodada ativa.");
    const elapsed = Date.now() - state.startedAt;
    const currentMult = multiplierAt(elapsed);
    let multiplier = currentMult;
    let result: "win" | "crashed" = "crashed";
    let win = 0;
    // Honor auto-cashout target if set & reached before crash
    if (
      state.autoCashout &&
      state.autoCashout <= state.crashPoint &&
      currentMult >= state.autoCashout
    ) {
      multiplier = state.autoCashout;
      result = "win";
      win = Math.floor(state.bet * multiplier);
    } else if (currentMult < state.crashPoint) {
      result = "win";
      win = Math.floor(state.bet * currentMult);
    } else {
      multiplier = state.crashPoint;
    }
    let balance = Number(profile.coins);
    if (win > 0) {
      balance = await adjustCoins(userId, win, "crash_win", "crash", {
        multiplier,
        crashPoint: state.crashPoint,
      });
    }
    await saveCrash(userId, null);
    return {
      result,
      multiplier: Math.floor(multiplier * 100) / 100,
      crashPoint: state.crashPoint,
      serverSeed: state.serverSeed,
      clientSeed: state.clientSeed,
      bet: state.bet,
      win,
      balance,
    };
  });

export const getActiveCrash = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getProfile(context.userId);
    const state = profile.active_crash as unknown as CrashState | null;
    if (!state) return null;
    return publicCrashState(state);
  });