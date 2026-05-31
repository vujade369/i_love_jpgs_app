import { NextRequest, NextResponse } from "next/server";
import {
  discoverWalletsForCollections,
  hydrateAccountIdentities,
  type CollectionRef,
  ACCOUNT_HYDRATION_CONCURRENCY,
} from "@/lib/jpgs/holderDiscovery";
import {
  looksInstitutionalCollector,
  getInstitutionalWalletReason,
} from "@/lib/jpgs/institutionalWallets";

const DISCOVER_COLLECTOR_RESULT_LIMIT = 50;

type DiscoverBody = { collections: CollectionRef[] };

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  const body = await req.json() as DiscoverBody;
  const collections: CollectionRef[] = (body.collections ?? []).filter(
    (c) => c && typeof c.slug === "string" && typeof c.name === "string",
  );

  if (collections.length === 0) {
    return NextResponse.json({ error: "No collections provided" }, { status: 400 });
  }

  const discovery = await discoverWalletsForCollections(collections);
  const returnedWallets = discovery.wallets.slice(0, DISCOVER_COLLECTOR_RESULT_LIMIT);
  const n = Math.max(collections.length, 1);
  const hydration = await hydrateAccountIdentities(
    returnedWallets.map((wallet) => wallet.address),
    {
      limit: returnedWallets.length,
      concurrency: ACCOUNT_HYDRATION_CONCURRENCY,
    },
  );

  const wallets = returnedWallets.map((wallet) => {
    const identity = hydration.identities.get(wallet.address.toLowerCase());
    const profileUrl = identity?.openSeaUrl ?? identity?.openseaProfileUrl ?? `https://opensea.io/${wallet.address}`;
    const score = Math.round(
      Math.min(
        1,
        (wallet.matchedCollectionCount / n) * 0.8 +
          Math.min(1, Math.log2(1 + wallet.totalHeldFromSelected) / Math.log2(26)) * 0.2,
      ) * 100,
    );
    const reason =
      wallet.matchedCollectionCount === 1
        ? "Holds 1 of your selected collections."
        : `Holds ${wallet.matchedCollectionCount} of your selected collections.`;
    const institutionalCandidate = {
      ens: identity?.ens ?? null,
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      openseaUsername: identity?.username ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
      profileImageUrl: identity?.profileImageUrl ?? null,
      imageUrl: identity?.imageUrl ?? null,
      openSeaUrl: profileUrl,
      openseaProfileUrl: profileUrl,
    };

    return {
      address: wallet.address,
      wallet: wallet.address,
      shortWallet: shortenAddress(wallet.address),
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      ens: identity?.ens ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
      profileImageUrl: identity?.profileImageUrl ?? null,
      imageUrl: identity?.imageUrl ?? null,
      openseaUsername: identity?.username ?? null,
      openSeaUrl: profileUrl,
      openseaProfileUrl: profileUrl,
      identitySource: identity?.identitySource ?? "fallback",
      matchedCollections: wallet.matchedCollections,
      matchedCollectionCount: wallet.matchedCollectionCount,
      totalHeldFromSelected: wallet.totalHeldFromSelected,
      score,
      reason,
      isInstitutionalWallet: looksInstitutionalCollector(institutionalCandidate),
      institutionalWalletReason: getInstitutionalWalletReason(institutionalCandidate),
    };
  });

  if (hydration.summary.fail > 0) {
    console.warn("[jpgs/wallets/discover] profile hydration failures:", hydration.summary.failures);
  }

  return NextResponse.json({
    wallets,
    collections,
    ...(debug || process.env.NODE_ENV === "development"
      ? {
          debug: {
            ...discovery.debug,
            hydrationSummary: hydration.summary,
            ...(debug
              ? {
                  identity: wallets.map((wallet) => {
                    const identity = hydration.identities.get(wallet.address.toLowerCase());
                    const debugIdentity = identity?.debug;
                    return {
                      address: wallet.address,
                      cacheHit: debugIdentity?.cacheHit ?? false,
                      cachedIdentitySource: debugIdentity?.cachedIdentitySource ?? null,
                      cachedHadAvatar: debugIdentity?.cachedHadAvatar ?? false,
                      accountFetchAttempted: debugIdentity?.accountFetchAttempted ?? false,
                      accountFetchStatus: debugIdentity?.accountFetchStatus ?? "not_attempted",
                      accountFetchError: debugIdentity?.accountFetchError ?? null,
                      accountFetchHadBody: debugIdentity?.accountFetchHadBody ?? false,
                      accountFetchUsername: debugIdentity?.accountFetchUsername ?? null,
                      accountFetchProfileImageUrl: debugIdentity?.accountFetchProfileImageUrl ?? null,
                      resolveFetchAttempted: debugIdentity?.resolveFetchAttempted ?? false,
                      resolveFetchStatus: debugIdentity?.resolveFetchStatus ?? "not_attempted",
                      resolveFetchError: debugIdentity?.resolveFetchError ?? null,
                      resolveFetchEns: debugIdentity?.resolveFetchEns ?? null,
                      rawAccount: debugIdentity?.rawAccount ?? null,
                      rawResolve: debugIdentity?.rawResolve ?? null,
                      finalUsername: wallet.username,
                      finalDisplayName: wallet.displayName,
                      finalEns: wallet.ens,
                      finalAvatarUrl: wallet.avatarUrl,
                      identitySource: wallet.identitySource,
                      avatarBeforeMapping: debugIdentity?.avatarBeforeMapping ?? false,
                      avatarAfterMapping: Boolean(
                        wallet.avatarUrl || wallet.profileImageUrl || wallet.imageUrl,
                      ),
                    };
                  }),
                }
              : {}),
          },
        }
      : {}),
  });
}
