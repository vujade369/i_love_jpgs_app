import { NextRequest, NextResponse } from "next/server";
import { classifyNftTaste, type NormalizedNft } from "@/lib/jpgs/classifyNftTaste";
import { TASTE_CATEGORY_LABELS, type TasteCategory } from "@/lib/jpgs/tasteCategories";
import {
  fetchCollectionBySlug,
  fetchWalletNfts,
  resolveWalletIdentity,
  type OsCollection,
  type OsWalletNft,
} from "@/lib/jpgs/opensea";

const WALLET_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_WALLETS = 2;
const MAX_VISIBLE_NFTS = 3333;
const MAX_COLLECTIONS_TO_ENRICH = 20;
const TOP_COLLECTION_LIMIT = 12;

type TopCollection = {
  slug: string;
  name: string;
  imageUrl?: string;
  imageSource: "collection" | "nft" | "none";
  count: number;
  openseaUrl: string;
};

type TasteSignal = {
  category: TasteCategory;
  label: string;
  nftCount: number;
  collectionCount: number;
  collections: Array<{ slug: string; name: string; count: number }>;
};

type SourceWalletStatus = "included" | "invalid" | "fetch_failed";

type SourceWalletMetadata = {
  id: string;
  input: string;
  address?: string;
  shortWallet?: string;
  displayName?: string;
  username?: string;
  ens?: string;
  avatarUrl?: string;
  status: SourceWalletStatus;
  nftCount: number;
  collectionCount: number;
  error?: string;
};

type SourceWalletRef = {
  address: string;
  shortWallet: string;
  label: string;
};

type EnrichedWalletNft = OsWalletNft & {
  sourceWallets: SourceWalletRef[];
};

type WalletFetchSuccess = {
  source: SourceWalletMetadata & {
    address: string;
    shortWallet: string;
    status: "included";
  };
  nfts: EnrichedWalletNft[];
  fetchedPages: number;
  chainsChecked: string[];
  chainCounts: Record<string, number>;
  fetchedPagesByChain: Record<string, number>;
  complete: boolean;
  stoppedReason: string;
  includeHidden: boolean;
};

function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function collectionSlug(nft: OsWalletNft): string {
  return nft.collection?.trim() || "unknown";
}

function collectionName(slug: string, collection?: OsCollection | null): string {
  return collection?.name?.trim() || slug.replace(/-/g, " ");
}

function nftImage(nft: OsWalletNft): string | undefined {
  return nft.display_image_url || nft.image_url;
}

function nftBalance(nft: OsWalletNft): number {
  const quantity = nft.quantity ?? nft.owners?.[0]?.quantity ?? 1;
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function walletDisplayLabel(source: {
  displayName?: string;
  ens?: string;
  username?: string;
  shortWallet?: string;
  address?: string;
}): string {
  return source.displayName || source.ens || source.username || source.shortWallet || source.address || "Wallet";
}

function walletId(address: string): string {
  return `wallet:${address}`;
}

function sourceCollectionCount(nfts: OsWalletNft[]): number {
  return new Set(nfts.map(collectionSlug)).size;
}

function nftDedupeKey(nft: OsWalletNft): string | null {
  const chain = nft.chain?.trim().toLowerCase();
  const contract = nft.contract?.trim().toLowerCase();
  const identifier = nft.identifier?.trim();

  if (chain && contract && identifier) {
    return `${chain}:${contract}:${identifier}`;
  }

  const stableUrl = nft.opensea_url?.trim().toLowerCase();
  return stableUrl ? `opensea:${stableUrl}` : null;
}

function dedupeNfts(nfts: EnrichedWalletNft[]): EnrichedWalletNft[] {
  const deduped: EnrichedWalletNft[] = [];
  const keyed = new Map<string, EnrichedWalletNft>();

  for (const nft of nfts) {
    const key = nftDedupeKey(nft);
    if (!key) {
      deduped.push(nft);
      continue;
    }

    const existing = keyed.get(key);
    if (!existing) {
      keyed.set(key, nft);
      deduped.push(nft);
      continue;
    }

    const existingSources = new Set(existing.sourceWallets.map((source) => source.address));
    for (const source of nft.sourceWallets) {
      if (!existingSources.has(source.address)) {
        existing.sourceWallets.push(source);
        existingSources.add(source.address);
      }
    }
  }

  return deduped;
}

function toNormalizedNft(
  nft: EnrichedWalletNft,
  collection?: OsCollection | null,
): NormalizedNft {
  const tokenStandard =
    nft.token_standard === "ERC721" || nft.token_standard === "ERC1155"
      ? nft.token_standard
      : "UNKNOWN";

  return {
    name: nft.name,
    description: nft.description,
    collectionSlug: collectionSlug(nft),
    collectionName: collectionName(collectionSlug(nft), collection),
    collectionDescription: collection?.description,
    tokenStandard,
    imageUrl: nftImage(nft),
    animationUrl: nft.display_animation_url || nft.animation_url,
    contractAddress: nft.contract,
    chain: nft.chain,
    balance: 1,
    traits: (nft.traits ?? [])
      .filter((trait) => trait.trait_type && trait.value !== undefined)
      .map((trait) => ({
        trait_type: String(trait.trait_type),
        value: trait.value as string | number,
      })),
  };
}

async function enrichCollections(slugs: string[]): Promise<Map<string, OsCollection | null>> {
  const limited = slugs.slice(0, MAX_COLLECTIONS_TO_ENRICH);
  const rows = await Promise.all(limited.map((slug) => fetchCollectionBySlug(slug, 1500)));
  return new Map(limited.map((slug, index) => [slug, rows[index]]));
}

function walletParams(req: NextRequest): { inputs: string[]; ignoredInputs: string[] } {
  const rawInputs = req.nextUrl.searchParams.getAll("wallet");
  const inputs = rawInputs.map((input) => input.trim()).filter(Boolean);

  if (inputs.length === 0) {
    const legacy = req.nextUrl.searchParams.get("wallet")?.trim();
    if (legacy) inputs.push(legacy);
  }

  return {
    inputs: inputs.slice(0, MAX_WALLETS),
    ignoredInputs: inputs.slice(MAX_WALLETS),
  };
}

async function resolveInput(input: string): Promise<SourceWalletMetadata> {
  const resolved = await resolveWalletIdentity(input);
  const address = resolved?.address?.toLowerCase();
  if (!address || !WALLET_RE.test(address)) {
    return {
      id: `invalid:${input.toLowerCase()}`,
      input,
      displayName: resolved?.displayName,
      username: resolved?.username,
      ens: resolved?.ens,
      avatarUrl: resolved?.avatarUrl,
      status: "invalid",
      nftCount: 0,
      collectionCount: 0,
      error: "Enter a valid Ethereum wallet address.",
    };
  }

  return {
    id: walletId(address),
    input,
    address,
    shortWallet: shortWallet(address),
    displayName: resolved?.displayName,
    username: resolved?.username,
    ens: resolved?.ens,
    avatarUrl: resolved?.avatarUrl,
    status: "included",
    nftCount: 0,
    collectionCount: 0,
  };
}

async function fetchIncludedWallet(
  source: SourceWalletMetadata & { address: string; shortWallet: string; status: "included" },
  maxVisibleNfts: number,
): Promise<WalletFetchSuccess | SourceWalletMetadata> {
  const visible = await fetchWalletNfts(source.address, maxVisibleNfts);

  if (
    visible.nfts.length === 0 &&
    !["exhausted", "max_reached"].includes(visible.stoppedReason)
  ) {
    return {
      ...source,
      status: "fetch_failed",
      nftCount: 0,
      collectionCount: 0,
      error: "Visible NFT holdings could not be fetched right now.",
    };
  }

  const sourceRef: SourceWalletRef = {
    address: source.address,
    shortWallet: source.shortWallet,
    label: walletDisplayLabel(source),
  };
  const nfts = visible.nfts.map((nft) => ({ ...nft, sourceWallets: [sourceRef] }));

  return {
    source: {
      ...source,
      nftCount: visible.nfts.length,
      collectionCount: sourceCollectionCount(visible.nfts),
    },
    nfts,
    fetchedPages: visible.fetchedPages,
    chainsChecked: visible.chainsChecked,
    chainCounts: visible.chainCounts,
    fetchedPagesByChain: visible.fetchedPagesByChain,
    complete: visible.complete,
    stoppedReason: visible.stoppedReason,
    includeHidden: visible.includeHidden,
  };
}

export async function GET(req: NextRequest) {
  const { inputs, ignoredInputs } = walletParams(req);

  if (inputs.length === 0) {
    return NextResponse.json({ error: "Wallet address is required." }, { status: 400 });
  }

  const resolvedSources = await Promise.all(inputs.map(resolveInput));
  const sourceWallets: SourceWalletMetadata[] = [];
  const seenAddresses = new Set<string>();
  const includedSources: Array<SourceWalletMetadata & { address: string; shortWallet: string; status: "included" }> = [];

  for (const source of resolvedSources) {
    if (source.status !== "included" || !source.address || !source.shortWallet) {
      sourceWallets.push(source);
      continue;
    }

    if (seenAddresses.has(source.address)) continue;

    seenAddresses.add(source.address);
    sourceWallets.push(source as SourceWalletMetadata & { address: string; shortWallet: string; status: "included" });
    includedSources.push(source as SourceWalletMetadata & { address: string; shortWallet: string; status: "included" });
  }

  if (includedSources.length === 0) {
    return NextResponse.json(
      {
        error: "Enter a valid Ethereum wallet address.",
        sourceWallets,
      },
      { status: 400 },
    );
  }

  const fetchRows: Array<WalletFetchSuccess | SourceWalletMetadata> = [];
  let remainingVisibleNfts = MAX_VISIBLE_NFTS;

  for (const source of includedSources) {
    const row = await fetchIncludedWallet(source, remainingVisibleNfts);
    fetchRows.push(row);

    if ("source" in row) {
      remainingVisibleNfts = Math.max(0, remainingVisibleNfts - row.nfts.length);
    }
  }
  const allNfts: EnrichedWalletNft[] = [];
  const finalSourceWallets = sourceWallets.map((source) => {
    const fetched = fetchRows.find((row) =>
      "source" in row ? row.source.address === source.address : row.address === source.address,
    );

    if (!fetched) return source;
    if ("source" in fetched) {
      allNfts.push(...fetched.nfts);
      return fetched.source;
    }

    return fetched;
  });

  const includedWallets = finalSourceWallets.filter(
    (source): source is SourceWalletMetadata & { address: string; shortWallet: string; status: "included" } =>
      source.status === "included" && Boolean(source.address && source.shortWallet),
  );

  if (includedWallets.length === 0) {
    return NextResponse.json(
      {
        error: "Visible NFT holdings could not be fetched right now.",
        sourceWallets: finalSourceWallets,
      },
      { status: 502 },
    );
  }

  const isSingleWalletRead = includedWallets.length === 1;
  const dedupedNfts = dedupeNfts(allNfts);
  const nftsForRead = isSingleWalletRead ? allNfts : dedupedNfts;
  const collections = new Map<
    string,
    { slug: string; count: number; firstNftImage?: string }
  >();

  // Single-wallet reads preserve the original balance-based API counts.
  // Combined reads count deduped token identities so duplicates across wallets do not inflate the read.
  const countNft = (nft: EnrichedWalletNft) => (isSingleWalletRead ? nftBalance(nft) : 1);

  for (const nft of nftsForRead) {
    const slug = collectionSlug(nft);
    const existing = collections.get(slug);
    const count = countNft(nft);
    if (existing) {
      existing.count += count;
      existing.firstNftImage ||= nftImage(nft);
    } else {
      collections.set(slug, {
        slug,
        count,
        firstNftImage: nftImage(nft),
      });
    }
  }

  const sortedCollectionRows = Array.from(collections.values()).sort((a, b) => b.count - a.count);
  const enriched = await enrichCollections(sortedCollectionRows.map((row) => row.slug));

  const topCollections: TopCollection[] = sortedCollectionRows.slice(0, TOP_COLLECTION_LIMIT).map((row) => {
    const meta = enriched.get(row.slug);
    const imageUrl = meta?.image_url || row.firstNftImage;
    return {
      slug: row.slug,
      name: collectionName(row.slug, meta),
      imageUrl,
      imageSource: meta?.image_url ? "collection" : imageUrl ? "nft" : "none",
      count: row.count,
      openseaUrl: meta?.opensea_url || `https://opensea.io/collection/${row.slug}`,
    };
  });

  const signalBuckets = new Map<
    TasteCategory,
    { nftCount: number; collections: Map<string, { name: string; count: number }> }
  >();

  for (const nft of nftsForRead) {
    const slug = collectionSlug(nft);
    const classification = classifyNftTaste(toNormalizedNft(nft, enriched.get(slug)));
    const category = classification.primaryCategory;
    const bucket =
      signalBuckets.get(category) ?? { nftCount: 0, collections: new Map() };
    const count = countNft(nft);
    bucket.nftCount += count;
    const meta = enriched.get(slug);
    const name = collectionName(slug, meta);
    const collectionBucket = bucket.collections.get(slug) ?? { name, count: 0 };
    collectionBucket.count += count;
    bucket.collections.set(slug, collectionBucket);
    signalBuckets.set(category, bucket);
  }

  const tasteSignals: TasteSignal[] = Array.from(signalBuckets.entries())
    .map(([category, bucket]) => {
      const signalCollections = Array.from(bucket.collections.entries())
        .map(([slug, row]) => ({ slug, name: row.name, count: row.count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);

      return {
        category,
        label: TASTE_CATEGORY_LABELS[category],
        nftCount: bucket.nftCount,
        collectionCount: bucket.collections.size,
        collections: signalCollections,
      };
    })
    .sort((a, b) => b.nftCount - a.nftCount);

  const primary = includedWallets[0];
  const wallets = includedWallets.map((source) => source.address);
  const shortWallets = includedWallets.map((source) => source.shortWallet);
  const invalidWalletCount = finalSourceWallets.filter((source) => source.status === "invalid").length;
  const failedWalletCount = finalSourceWallets.filter((source) => source.status === "fetch_failed").length;
  const inputNftCount = allNfts.length;
  const dedupedNftCount = dedupedNfts.length;
  const nftCount = nftsForRead.reduce((sum, nft) => sum + countNft(nft), 0);
  const incompleteFetch = fetchRows.find((row) => "source" in row && row.stoppedReason !== "exhausted");

  return NextResponse.json({
    wallet: primary.address,
    shortWallet: primary.shortWallet,
    nftCount,
    collectionCount: collections.size,
    topCollections,
    tasteSignals,
    wallets,
    shortWallets,
    primaryWallet: primary.address,
    walletCount: wallets.length,
    includedWalletCount: includedWallets.length,
    invalidWalletCount,
    failedWalletCount,
    sourceWallets: finalSourceWallets,
    dedupe: {
      inputNftCount,
      dedupedNftCount,
      duplicateNftCount: inputNftCount - dedupedNftCount,
    },
    ...(process.env.NODE_ENV === "development"
      ? {
          debug: {
            source: "opensea /api/v2/chain/{chain}/account/{wallet}/nfts",
            fetchedNfts: inputNftCount,
            fetchedPages: fetchRows.reduce((sum, row) => sum + ("source" in row ? row.fetchedPages : 0), 0),
            chainsChecked: Array.from(new Set(fetchRows.flatMap((row) => ("source" in row ? row.chainsChecked : [])))),
            chainCounts: fetchRows.reduce<Record<string, number>>((acc, row) => {
              if (!("source" in row)) return acc;
              for (const [chain, count] of Object.entries(row.chainCounts)) {
                acc[chain] = (acc[chain] ?? 0) + count;
              }
              return acc;
            }, {}),
            fetchedPagesByChain: fetchRows.reduce<Record<string, number>>((acc, row) => {
              if (!("source" in row)) return acc;
              for (const [chain, count] of Object.entries(row.fetchedPagesByChain)) {
                acc[chain] = (acc[chain] ?? 0) + count;
              }
              return acc;
            }, {}),
            complete: fetchRows.every((row) => !("source" in row) || row.complete),
            stoppedReason: incompleteFetch && "source" in incompleteFetch ? incompleteFetch.stoppedReason : "exhausted",
            maxVisibleNfts: MAX_VISIBLE_NFTS,
            includeHidden: false,
            enrichedCollections: enriched.size,
            maxWallets: MAX_WALLETS,
            ignoredWalletInputs: ignoredInputs.length,
            walletFetches: fetchRows.map((row) =>
              "source" in row
                ? {
                    wallet: row.source.address,
                    fetchedNfts: row.nfts.length,
                    fetchedPages: row.fetchedPages,
                    chainsChecked: row.chainsChecked,
                    chainCounts: row.chainCounts,
                    complete: row.complete,
                    stoppedReason: row.stoppedReason,
                  }
                : {
                    wallet: row.address,
                    status: row.status,
                    error: row.error,
                  },
            ),
          },
        }
      : {}),
  });
}
