import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const PLANS = {
  free: { price: 0, monthlyCoins: 0, dailyBonus: 50 },
  bronze: { price: 1990, monthlyCoins: 3000, dailyBonus: 200 },
  silver: { price: 4990, monthlyCoins: 10000, dailyBonus: 500 },
  gold: { price: 9990, monthlyCoins: 30000, dailyBonus: 2000 },
} as const;

export type Plan = keyof typeof PLANS;
export type Card = { rank: string; suit: string };
export type BJState = { deck: Card[]; player: Card[]; dealer: Card[]; bet: number };

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];

export async function getProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function adjustCoins(
  userId: string,
  delta: number,
  kind: string,
  game?: string,
  meta?: unknown,
) {
  const profile = await getProfile(userId);
  const newBalance = Number(profile.coins) + delta;
  if (newBalance < 0) throw new Error("Saldo insuficiente");

  const { error: updateError } = await supabaseAdmin
    .from("profiles")
    .update({ coins: newBalance })
    .eq("id", userId);
  if (updateError) throw new Error(updateError.message);

  await supabaseAdmin
    .from("coin_transactions")
    .insert({ user_id: userId, amount: delta, kind, game, meta: meta as never });

  return newBalance;
}

export function newDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ rank, suit });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function handValue(hand: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const card of hand) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (["K", "Q", "J"].includes(card.rank)) {
      total += 10;
    } else {
      total += Number.parseInt(card.rank, 10);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export async function saveBJ(userId: string, state: BJState | null) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ active_blackjack: state as never })
    .eq("id", userId);
  if (error) throw new Error(error.message);
}

export async function settleBJ(userId: string, state: BJState) {
  const pv = handValue(state.player);
  let dv = handValue(state.dealer);

  if (pv <= 21) {
    while (handValue(state.dealer) < 17) state.dealer.push(state.deck.pop()!);
    dv = handValue(state.dealer);
  }

  let result: "win" | "lose" | "push" | "blackjack" = "lose";
  let win = 0;
  if (pv > 21) result = "lose";
  else if (pv === 21 && state.player.length === 2 && !(dv === 21 && state.dealer.length === 2)) {
    result = "blackjack";
    win = Math.floor(state.bet * 2.5);
  } else if (dv > 21 || pv > dv) {
    result = "win";
    win = state.bet * 2;
  } else if (pv === dv) {
    result = "push";
    win = state.bet;
  }

  let balance = Number((await getProfile(userId)).coins);
  if (win > 0) {
    balance = await adjustCoins(userId, win, "blackjack_win", "blackjack", { result, pv, dv });
  }
  await saveBJ(userId, null);

  return { player: state.player, dealer: state.dealer, pv, dv, result, win, balance, finished: true as const };
}

export { supabaseAdmin };