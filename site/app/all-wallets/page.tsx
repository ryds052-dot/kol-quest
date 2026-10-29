import { getAllWallets } from "@/lib/data";
import UnifiedTable from "@/app/components/UnifiedTable";

export const revalidate = 3600;

export async function generateMetadata() {
  return {
    title: "All Wallets | KolQuest",
    description:
      "Every tracked smart money wallet in one view — KolScan KOLs, GMGN smart degens, snipers, fresh wallets, top devs, and Polymarket prediction traders across all chains.",
  };
}

interface PageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function AllWalletsPage({ searchParams }: PageProps) {
  // Await searchParams to satisfy Next.js dynamic API standards
  const resolvedParams = searchParams ? await searchParams : {};
  const chainFilter = typeof resolvedParams.chain === "string" ? resolvedParams.chain : "sol";

  let data: Awaited<ReturnType<typeof getAllWallets>> = [];
  let fetchError: string | null = null;

  try {
    data = await getAllWallets();
  } catch (err: unknown) {
    console.error("Failed to load wallets:", err);
    fetchError = err instanceof Error ? err.message : "Failed to load database records.";
  }

  // Handle database query failure gracefully
  if (fetchError) {
    return (
      <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-200">
          <h2 className="text-xl font-semibold mb-2">Error Loading Wallets</h2>
          <p className="text-sm opacity-90">{fetchError}</p>
          <p className="text-xs text-neutral-400 mt-4">
            Ensure your Neon database connection string is properly configured and migrations have completed.
          </p>
        </div>
      </main>
    );
  }

  // Tally counts per data source
  const sources = data.reduce<Record<string, number>>((acc, w) => {
    const src = w.source || "Unknown";
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});

  const sourceEntries = Object.entries(sources).sort((a, b) => b[1] - a[1]);
  const sourceParts = sourceEntries
    .map(([src, n]) => `${n.toLocaleString()} ${src}`)
    .join(" · ");

  return (
    <main className="min-h-screen px-4 py-8 max-w-7xl mx-auto space-y-6">
      <header className="space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              All Tracked Wallets
            </h1>
            <p className="text-sm text-neutral-400 mt-1">
              {data.length.toLocaleString()} total wallets monitored across Solana and multi-chain protocols.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {sourceEntries.slice(0, 4).map(([src, count]) => (
              <span
                key={src}
                className="px-2.5 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 font-mono"
              >
                {src}: <strong className="text-white">{count.toLocaleString()}</strong>
              </span>
            ))}
          </div>
        </div>
      </header>

      <UnifiedTable
        data={data}
        title="All Wallets"
        subtitle={sourceParts || `${data.length.toLocaleString()} wallets active`}
        showSource={true}
        showCategory={true}
        chain={chainFilter}
      />
    </main>
  );
}