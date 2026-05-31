import { NextRequest, NextResponse } from "next/server";
import {
  discoverWalletsForCollections,
  hydrateAccountIdentities,
  type CollectionRef,
} from "@/lib/jpgs/holderDiscovery";
import {
  looksInstitutionalCollector,
  getInstitutionalWalletReason,
} from "@/lib/jpgs/institutionalWallets";

const MAX_COLLECTIONS = 22;
const MAX_COLLECTORS = 20;
const MIN_SHARED_COLLECTIONS = 2;
const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;

type SimilarCollectorsBody = {
  sourceWallets?: string[];
  collections?: Array<{
    slug?: string;
    name?: string;
    imageUrl?: string;
    image_url?: string;
  }>;
};

function shortWallet(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function normalizeWallet(address: string): string | null {
  const trimmed = address.trim().toLowerCase();
  return WALLET_RE.test(trimmed) ? trimmed : null;
}

function collectionRefsFromBody(body: SimilarCollectorsBody): CollectionRef[] {
  const seen = new Set<string>();
  const refs: CollectionRef[] = [];

  for (const collection of body.collections ?? []) {
    const slug = collection.slug?.trim();
    if (!slug) continue;

    const key = slug.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    refs.push({
      slug,
      name: collection.name?.trim() || slug.replace(/-/g, " "),
      image_url: collection.image_url || collection.imageUrl,
    });

    if (refs.length >= MAX_COLLECTIONS) break;
  }

  return refs;
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1";
  let body: SimilarCollectorsBody;
  try {
    body = (await req.json()) as SimilarCollectorsBody;
  } catch {
    return NextResponse.json({ collectors: [] });
  }

  const collections = collectionRefsFromBody(body);
  const collectionsReceived = body.collections?.length ?? 0;

  if (collections.length < 2) {
    return NextResponse.json({ collectors: [] });
  }

  const excludedWallets = new Set(
    (body.sourceWallets ?? [])
      .map(normalizeWallet)
      .filter((address): address is string => Boolean(address)),
  );

  const discovery = await discoverWalletsForCollections(collections, {
    maxCollections: MAX_COLLECTIONS,
  }).catch(() => null);

  if (!discovery) {
    return NextResponse.json({ collectors: [] });
  }

  const matches = discovery.wallets
    .filter((wallet) => !excludedWallets.has(wallet.address.toLowerCase()))
    .filter((wallet) => wallet.matchedCollectionCount >= MIN_SHARED_COLLECTIONS)
    .slice(0, MAX_COLLECTORS);
  const collectionsWithUsableHolders = discovery.debug.collectionsFetched.filter(
    (collection) => collection.fetchedCount > 0,
  );
  const contributingCollectionSlugs = Array.from(
    new Set(
      matches.flatMap((wallet) =>
        wallet.matchedCollections.map((collection) => collection.slug),
      ),
    ),
  );

  const hydration = await hydrateAccountIdentities(
    matches.map((wallet) => wallet.address),
    { limit: MAX_COLLECTORS },
  );

  const collectors = matches.map((wallet) => {
    const identity = hydration.identities.get(wallet.address.toLowerCase());
    const profileUrl = identity?.openSeaUrl ?? identity?.openseaProfileUrl ?? `https://opensea.io/${wallet.address}`;
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
      shortWallet: shortWallet(wallet.address),
      displayName: identity?.displayName ?? null,
      username: identity?.username ?? null,
      ens: identity?.ens ?? null,
      avatarUrl: identity?.avatarUrl ?? null,
      profileImageUrl: identity?.profileImageUrl ?? null,
      imageUrl: identity?.imageUrl ?? null,
      openSeaUrl: profileUrl,
      openseaProfileUrl: profileUrl,
      identitySource: identity?.identitySource ?? "fallback",
      matchedCollections: wallet.matchedCollections,
      sharedCollectionCount: wallet.matchedCollectionCount,
      totalHeldFromSelected: wallet.totalHeldFromSelected,
      reason:
        wallet.matchedCollectionCount === 1
          ? "Seen across 1 shared collection"
          : `Seen across ${wallet.matchedCollectionCount} shared collections`,
      isInstitutionalWallet: looksInstitutionalCollector(institutionalCandidate),
      institutionalWalletReason: getInstitutionalWalletReason(institutionalCandidate),
    };
  });

  return NextResponse.json({
    collectors,
    ...(process.env.NODE_ENV === "development" || debug
      ? {
          debug: {
            collectionsAttempted: collections.length,
            collectionsReceived,
            maxCollections: MAX_COLLECTIONS,
            collectionsWithUsableHolders: collectionsWithUsableHolders.length,
            partial: discovery.debug.partial,
            errors: discovery.debug.errors,
            collectionsFetched: discovery.debug.collectionsFetched.length,
            collectionsCompleted: discovery.debug.collectionsFetched.filter((collection) => collection.complete).length,
            collectionsContributingToResults: contributingCollectionSlugs.length,
            contributingCollectionSlugs,
            hydrationSummary: hydration.summary,
            ...(debug
              ? {
                  identity: collectors.map((collector) => {
                    const identity = hydration.identities.get(collector.address.toLowerCase());
                    const debugIdentity = identity?.debug;
                    return {
                      address: collector.address,
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
                      finalUsername: collector.username,
                      finalDisplayName: collector.displayName,
                      finalEns: collector.ens,
                      finalAvatarUrl: collector.avatarUrl,
                      identitySource: collector.identitySource,
                      avatarBeforeMapping: debugIdentity?.avatarBeforeMapping ?? false,
                      avatarAfterMapping: Boolean(
                        collector.avatarUrl || collector.profileImageUrl || collector.imageUrl,
                      ),
                    };
                  }),
                }
              : {}),
            partialCollections: discovery.debug.collectionsFetched
              .filter((collection) => !collection.complete)
              .map((collection) => ({
                slug: collection.slug,
                stoppedReason: collection.stoppedReason,
                fetchedCount: collection.fetchedCount,
              })),
          },
        }
      : {}),
  });
}
