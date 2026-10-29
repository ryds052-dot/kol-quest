import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, refreshLeaderboardData } from "@/lib/leaderboard-aggregator";
import { checkOrigin } from "@/lib/assert-origin";
import type { LeaderboardChain, LeaderboardQuery } from "@/lib/types";

// Force Next.js to evaluate this route dynamically on every request
export const dynamic = "force-dynamic";

// GET /api/leaderboard — fetch leaderboard with optional filters/pagination
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  // 1. Build the query object
  const query: LeaderboardQuery = {
    chain: (searchParams.get("chain") ?? "all") as LeaderboardChain | "all",
    timeframe: (searchParams.get("timeframe") ?? "7d") as LeaderboardQuery["timeframe"],
    category: (searchParams.get("category") ?? "overall") as LeaderboardQuery["category"],
    sort: (searchParams.get("sort") ?? "composite") as LeaderboardQuery["sort"],
    order: (searchParams.get("order") ?? "desc") as "asc" | "desc",
    page: Math.max(1, Number(searchParams.get("page") ?? 1)),
    limit: Math.min(200, Math.max(1, Number(searchParams.get("limit") ?? 50))),
    search: searchParams.get("search") ?? undefined,
    minPnl: searchParams.has("minPnl") ? Number(searchParams.get("minPnl")) : undefined,
    minWinRate: searchParams.has("minWinRate")
      ? Number(searchParams.get("minWinRate"))
      : undefined,
    activeInDays: searchParams.has("activeInDays")
      ? Number(searchParams.get("activeInDays"))
      : undefined,
    verifiedOnly: searchParams.get("verifiedOnly") === "true",
  };

  // 2. Fetch the raw data FIRST
  let data = await getLeaderboard(query);

  // 3. Extract the array of wallets (handles different pagination response structures)
  let walletsArray = Array.isArray(data) ? data : (data.items || data.wallets || data.data || []);

  // 4. Apply the smart copy-trade filters
  const viableWallets = walletsArray.filter((wallet: any) => {
    // Must be active within the last 24 hours (86400 seconds)
    const isRecentlyActive = wallet.last_active < 86400; 

    // Not tagged as a wash trader
    const notWashTrader = !wallet.tags?.includes('wash_trader');

    // Not an overcrowded influencer (under 150 trackers)
    const notOvercrowded = (wallet.followers || wallet.tracking || 0) < 150;

    // Balanced trade execution (win rate normalized between 0.55 and 0.85)
    // Handles APIs that return win_rate as 0.70 or 70
    const winRate = wallet.win_rate > 1 ? wallet.win_rate / 100 : wallet.win_rate;
    const realisticWinRate = winRate >= 0.55 && winRate <= 0.85;

    return isRecentlyActive && notWashTrader && notOvercrowded && realisticWinRate;
  });

  // 5. Re-assign the filtered wallets back to the response object
  if (Array.isArray(data)) {
    data = viableWallets;
  } else if (data.items) {
    data.items = viableWallets;
  } else if (data.wallets) {
    data.wallets = viableWallets;
  } else if (data.data) {
    data.data = viableWallets;
  }

  // 6. Return JSON with caching completely disabled
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  });
}

// POST /api/leaderboard — trigger a cache refresh (cron job only)
export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return originError;

  const authHeader = req.headers.get("