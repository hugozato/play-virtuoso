import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLANS = {
  free: { price: 0, monthlyCoins: 0, dailyBonus: 50 },
  bronze: { price: 1990, monthlyCoins: 3000, dailyBonus: 200 },
  silver: { price: 4990, monthlyCoins: 10000, dailyBonus: 500 },
  gold: { price: 9990, monthlyCoins: 30000, dailyBonus: 2000 },
} as const;

type Plan = keyof typeof PLANS;

async function getProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function adjustCoins(
  userId: string,
  delta: number,
  kind: string,
  game?: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  meta?: any,
) {
  const profile = await getProfile(userId);
  const newBalance = Number(profile.coins) + delta;
  if (newBalance < 0) throw new Error("Saldo insuficiente");
  const { error: uErr } = await supabaseAdmin
    .from("profiles")
    .update({ coins: newBalance })
    .eq("id", userId);
  if (uErr) throw new Error(uErr.message);
  await supabaseAdmin
    .from("coin_transactions")
    .insert({ user_id: userId, amount: delta, kind, game, meta });
  return newBalance;
}

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
type Card = { rank: string; suit: string };
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];
function newDeck(): Card[] {
  const d: Card[] = [];
  for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}
function handValue(h: Card[]): number {
  let total = 0, aces = 0;
  for (const c of h) {
    if (c.rank === "A") { aces++; total += 11; }
    else if (["K", "Q", "J"].includes(c.rank)) total += 10;
    else total += parseInt(c.rank);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

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