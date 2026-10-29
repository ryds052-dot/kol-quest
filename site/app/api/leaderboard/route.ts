export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard, refreshLeaderboardData } from "@/lib/leaderboard-aggregator";
import { checkOrigin } from "@/lib/assert-origin";
import type { LeaderboardChain, LeaderboardQuery } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET /api/leaderboard — fetch leaderboard with optional filters/pagination
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
const viableWallets = data.filter((wallet) => {
  // 1. Must be active within the last 24 hours (86400 seconds)
  const isRecentlyActive = wallet.last_active < 86400; 

  // 2. Not tagged as a wash trader
  const notWashTrader = !wallet.tags?.includes('wash_trader');

  // 3. Not a massive influencer / megaphone (under 150 trackers to prevent front-running)
  const notOvercrowded = (wallet.followers || wallet.tracking || 0) < 150;

  // 4. Balanced trade execution (not just dumping presales)
  const realisticWinRate = wallet.win_rate >= 0.55 && wallet.win_rate <= 0.85;

  return isRecentlyActive && notWashTrader && notOvercrowded && realisticWinRate;
});
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

  const data = await getLeaderboard(query);

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}

// POST /api/leaderboard — trigger a cache refresh (cron job only)
export async function POST(req: NextRequest) {
  const originError = checkOrigin(req);
  if (originError) return originError;

  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await refreshLeaderboardData();
  return NextResponse.json({ success: true, message: "Leaderboard cache refreshed." });
}
