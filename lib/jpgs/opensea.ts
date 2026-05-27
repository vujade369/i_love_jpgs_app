import { findKnownByQuery, getMeaningfulTokens, type KnownCollection } from "./knownCollections";

const OPENSEA_BASE = "https://api.opensea.io/api/v2";

function apiKey(): string {
  const k = process.env.OPENSEA_API_KEY;
  if (!k) throw new Error("OPENSEA_API_KEY is not set");
  return k;
}

async function osGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${OPENSEA_BASE}${path}`, {
    cache: "no-store",
    ...init,
    headers: { "X-API-KEY": apiKey(), Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`OpenSea ${res.status} on ${path}`);
  return res.json() as Promise<T>;
}

// ─── Collection search ────────────────────────────────────────────────────────

export type OsCollection = {
  collection: string;
  slug?: string;
  name: string;
  description?: string;
  image_url?: string;
  banner_image_url?: string;
  opensea_url?: string;
  safelist_status?: string;
  safelist_request_status?: string;
  is_disabled?: boolean;
  is_nsfw?: boolean;
  contracts?: Array<{ address: string; chain?: string }>;
};

// ─── Field normalizers ────────────────────────────────────────────────────────

export function getCollectionSlug(c: OsCollection): string {
  return c.collection ?? c.slug ?? "";
}

export function getCollectionName(c: OsCollection): string {
  return c.name ?? "";
}

export function getSafelistStatus(c: OsCollection): string {
  return c.safelist_status ?? c.safelist_request_status ?? "";
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const ZERO_X_RE = /^0x[0-9a-f]{10,}/i;

function isZeroXLike(s: string): boolean {
  return ZERO_X_RE.test(s.trim());
}

function toSlugForm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export type RankedCollection = OsCollection & {
  collection: string;
  _score: number;
  _relevanceScore: number;
  _qualityScore: number;
  _knownBoost: number;
};

// Explicit boost applied to known curated collections.
// Must exceed the maximum possible organic score (max rel ~275 + max qual ~35 = 310).
const KNOWN_COLLECTION_BOOST = 400;

export function calcRelevanceScore(col: OsCollection, query: string): number {
  const slug = getCollectionSlug(col).toLowerCase();
  const name = getCollectionName(col).toLowerCase().trim();
  const normalizedQuery = query.toLowerCase().trim();
  const querySlugForm = toSlugForm(query);

  const meaningfulTokens = getMeaningfulTokens(normalizedQuery);

  // Stopword-only query: only exact slug or name earns relevance
  if (meaningfulTokens.length === 0) {
    if (slug === querySlugForm || name === normalizedQuery) return 120;
    return 0;
  }

  const isShortQuery = normalizedQuery.replace(/\s+/g, "").length < 4;

  // Slug match — use else-if so a single signal earns one bonus, not several stacked
  let slugScore = 0;
  if (slug === querySlugForm) {
    slugScore = 120;
  } else if (querySlugForm && slug.startsWith(querySlugForm)) {
    slugScore = 90;
  } else if (!isShortQuery && querySlugForm && slug.includes(querySlugForm)) {
    slugScore = 65;
  } else if (isShortQuery && querySlugForm) {
    // Short queries: only token-prefix inside slug (no mid-word substring)
    const slugTokens = slug.split("-");
    if (slugTokens.some((t) => t.startsWith(querySlugForm))) slugScore = 50;
  }

  // Name match — same non-stacking tiers
  let nameScore = 0;
  if (name === normalizedQuery) {
    nameScore = 110;
  } else if (normalizedQuery && name.startsWith(normalizedQuery)) {
    nameScore = 85;
  } else if (!isShortQuery && normalizedQuery && name.includes(normalizedQuery)) {
    nameScore = 60;
  } else if (isShortQuery && normalizedQuery) {
    const nameTokens = name.split(/[\s\-_]+/);
    if (nameTokens.some((t) => t.startsWith(normalizedQuery))) nameScore = 45;
  }

  // Meaningful-token match (non-short queries only; additive but separate signal)
  let tokenScore = 0;
  if (!isShortQuery && meaningfulTokens.length > 0) {
    const slugNorm = slug.replace(/-/g, " ");
    if (meaningfulTokens.every((w) => name.includes(w) || slugNorm.includes(w))) {
      tokenScore = 45;
    }
  }

  return slugScore + nameScore + tokenScore;
}

export function calcQualityScore(col: OsCollection): number {
  let score = 0;
  const safelist = getSafelistStatus(col);
  if (safelist === "verified" || safelist === "approved") score += 25;
  if (col.image_url) score += 5;
  if (col.contracts && col.contracts.length > 0) score += 5;
  return score;
}

export function rankCollectionSearchResult(
  col: OsCollection,
  query: string,
): number {
  if (col.is_disabled) return -Infinity;
  const slug = getCollectionSlug(col).toLowerCase();
  const name = getCollectionName(col).toLowerCase().trim();
  if (isZeroXLike(name) && isZeroXLike(slug)) return -Infinity;

  const rel = calcRelevanceScore(col, query);
  const qual = calcQualityScore(col);
  let score = rel + qual;
  if (slug.startsWith("0x")) score -= 100;
  if (isZeroXLike(name)) score -= 25;
  if (!col.image_url && !col.description) score -= 15;

  return score;
}

function knownToOsCollection(k: KnownCollection, merge?: OsCollection): OsCollection {
  return {
    collection: k.slug,
    name: k.name,
    image_url: merge?.image_url ?? k.image_url,
    banner_image_url: merge?.banner_image_url,
    opensea_url: k.openseaUrl,
    description: merge?.description,
    safelist_status: merge ? getSafelistStatus(merge) : undefined,
    safelist_request_status: merge?.safelist_request_status,
    is_disabled: merge?.is_disabled,
    is_nsfw: merge?.is_nsfw,
    contracts: merge?.contracts?.length ? merge.contracts : [{ address: k.contract }],
  };
}

// Separate fetch for enrichment: avoids cache:'no-store' + next.revalidate conflict
async function fetchBySlugWithTimeout(
  slug: string,
  timeoutMs: number,
): Promise<OsCollection | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${OPENSEA_BASE}/collections/${encodeURIComponent(slug)}`,
      {
        signal: controller.signal,
        next: { revalidate: 300 },
        headers: { "X-API-KEY": apiKey(), Accept: "application/json" },
      } as RequestInit,
    );
    if (!res.ok) return null;
    return res.json() as Promise<OsCollection>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type RankResult = {
  collections: RankedCollection[];
  slugFallbackUsed: boolean;
  slugFallbackSuppressed: string | null;
  meaningfulTokens: string[];
};

export async function rankAndFilterCollections(
  rawCollections: OsCollection[],
  query: string,
): Promise<RankResult> {
  const bySlug = new Map<string, RankedCollection>();

  const normalizedQuery = query.toLowerCase().trim();
  const meaningfulTokens = getMeaningfulTokens(normalizedQuery);

  // Score organic OpenSea results; require relevance > 0 to pass
  for (const col of rawCollections) {
    if (col.is_disabled) continue;
    const slug = getCollectionSlug(col).toLowerCase();
    const name = getCollectionName(col).toLowerCase().trim();
    if (isZeroXLike(name) && isZeroXLike(slug)) continue;

    const rel = calcRelevanceScore(col, query);
    if (rel <= 0) continue; // quality alone cannot admit a result

    const qual = calcQualityScore(col);
    let score = rel + qual;
    if (slug.startsWith("0x")) score -= 100;
    if (isZeroXLike(name)) score -= 25;
    if (!col.image_url && !col.description) score -= 15;
    if (!isFinite(score)) continue;

    const existing = bySlug.get(slug);
    if (!existing || score > existing._score) {
      bySlug.set(slug, {
        ...col,
        collection: slug,
        _score: score,
        _relevanceScore: rel,
        _qualityScore: qual,
        _knownBoost: 0,
      });
    }
  }

  // Resolve known matches before deciding on slug-direct fallback
  const knownMatches = findKnownByQuery(query);
  const hasKnownMatches = knownMatches.length > 0;

  // Slug-direct fallback: only when organic results are empty, no known matches exist,
  // and the query has meaningful (non-stopword) tokens.
  // This preserves exact-slug lookups (cryptopunks, azuki, autoglyphs) while preventing
  // a raw slug like "no-bad" from outranking the known curated "No Bad Trippers."
  let slugFallbackUsed = false;
  let slugFallbackSuppressed: string | null = null;

  if (bySlug.size === 0 && meaningfulTokens.length > 0) {
    const querySlugForm = toSlugForm(query);
    if (querySlugForm.length > 2) {
      if (hasKnownMatches) {
        slugFallbackSuppressed = `skipped: ${knownMatches.map((k) => k.slug).join(", ")} already matched as known`;
      } else {
        const direct = await fetchBySlugWithTimeout(querySlugForm, 1000);
        if (direct && !direct.is_disabled) {
          const directSlug = getCollectionSlug(direct) || querySlugForm;
          const directName = getCollectionName(direct);
          const slugMatches = directSlug.toLowerCase() === querySlugForm;
          const nameMatches = directName.toLowerCase() === normalizedQuery;
          if (slugMatches || nameMatches) {
            const rel = calcRelevanceScore({ ...direct, collection: directSlug }, query);
            if (rel > 0) {
              const qual = calcQualityScore(direct);
              bySlug.set(directSlug, {
                ...direct,
                collection: directSlug,
                _score: rel + qual,
                _relevanceScore: rel,
                _qualityScore: qual,
                _knownBoost: 0,
              });
              slugFallbackUsed = true;
            }
          }
        }
      }
    }
  }

  // Enrich known collection matches with OpenSea display metadata and pin them above organic
  if (hasKnownMatches) {
    const enriched = await Promise.all(
      knownMatches.map((k) => fetchBySlugWithTimeout(k.slug, 1000)),
    );
    for (let i = 0; i < knownMatches.length; i++) {
      const known = knownMatches[i];
      const osData = enriched[i];
      const existing = bySlug.get(known.slug);
      const merged = knownToOsCollection(known, osData ?? existing);
      const rel = calcRelevanceScore({ ...merged, collection: known.slug }, query);
      const qual = calcQualityScore(merged);
      bySlug.set(known.slug, {
        ...merged,
        collection: known.slug,
        _score: rel + qual + KNOWN_COLLECTION_BOOST,
        _relevanceScore: rel,
        _qualityScore: qual,
        _knownBoost: KNOWN_COLLECTION_BOOST,
      });
    }
  }

  const ranked = Array.from(bySlug.values()).sort((a, b) => b._score - a._score);
  const positive = ranked.filter((c) => c._score > 0);
  const collections = positive.length > 0 ? positive : ranked.slice(0, 3);

  return { collections, slugFallbackUsed, slugFallbackSuppressed, meaningfulTokens };
}

export type OsSearchHit = {
  slug: string;
  name: string;
  image_url?: string;
  opensea_url?: string;
  is_disabled?: boolean;
  is_nsfw?: boolean;
};

// Calls the OpenSea /search endpoint which actually performs ranked text search
// (unlike /collections?q= which ignores the query param).
export async function osSearch(query: string, limit = 15): Promise<OsSearchHit[]> {
  if (!query.trim()) return [];
  try {
    const data = await osGet<{
      results: Array<{
        type: string;
        collection?: OsCollection & { collection: string };
      }>;
    }>(
      `/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      { next: { revalidate: 60 } } as RequestInit,
    );
    return (data.results ?? [])
      .filter(
        (r): r is { type: string; collection: NonNullable<(typeof r)["collection"]> } =>
          r.type === "collection" &&
          r.collection != null &&
          typeof r.collection.collection === "string" &&
          r.collection.collection.length > 0,
      )
      .map((r) => ({
        slug: r.collection.collection,
        name: r.collection.name ?? "",
        image_url: r.collection.image_url,
        opensea_url: r.collection.opensea_url,
        is_disabled: r.collection.is_disabled ?? false,
        is_nsfw: r.collection.is_nsfw ?? false,
      }))
      .filter((r) => !r.is_disabled);
  } catch {
    return [];
  }
}

export async function fetchCollectionBySlug(
  slug: string,
  timeoutMs = 5000,
): Promise<OsCollection | null> {
  return fetchBySlugWithTimeout(slug, timeoutMs);
}

// ─── Holder fetching ──────────────────────────────────────────────────────────

type OsOwner = { address: string; quantity: number };
type OsNft = { owners?: OsOwner[] };
type NftsResponse = { nfts: OsNft[]; next?: string };

export async function fetchCollectionHolders(
  slug: string,
  maxNfts = 100,
): Promise<{ holders: Map<string, number>; nftSampleCount: number }> {
  const holders = new Map<string, number>();
  let cursor: string | undefined;
  let fetched = 0;
  const pageSize = 50;

  while (fetched < maxNfts) {
    const qs = `?limit=${pageSize}${cursor ? `&next=${encodeURIComponent(cursor)}` : ""}`;
    const data = await osGet<NftsResponse>(
      `/collection/${encodeURIComponent(slug)}/nfts${qs}`,
    );
    for (const nft of data.nfts ?? []) {
      for (const owner of nft.owners ?? []) {
        if (owner.address) {
          holders.set(
            owner.address.toLowerCase(),
            (holders.get(owner.address.toLowerCase()) ?? 0) + (owner.quantity ?? 1),
          );
        }
      }
    }
    fetched += data.nfts?.length ?? 0;
    cursor = data.next;
    if (!cursor || !data.nfts?.length) break;
  }

  return { holders, nftSampleCount: fetched };
}

// ─── Wallet NFT fetching ─────────────────────────────────────────────────────

export const WALLET_READ_CHAINS = [
  "ethereum",
  "base",
  "polygon",
  "arbitrum",
  "optimism",
  "zora",
] as const;

export type WalletReadChain = (typeof WALLET_READ_CHAINS)[number];

export type OsWalletNft = {
  identifier?: string;
  collection?: string;
  chain?: WalletReadChain;
  contract?: string;
  token_standard?: "ERC721" | "ERC1155" | string;
  name?: string;
  description?: string;
  image_url?: string;
  display_image_url?: string;
  display_animation_url?: string;
  animation_url?: string;
  opensea_url?: string;
  traits?: Array<{
    trait_type?: string;
    value?: string | number;
  }>;
  owners?: OsOwner[];
  quantity?: number;
};

type AccountNftsResponse = {
  nfts?: OsWalletNft[];
  next?: string;
};

export type FetchWalletNftsResult = {
  nfts: OsWalletNft[];
  fetchedPages: number;
  chainsChecked: WalletReadChain[];
  chainCounts: Record<WalletReadChain, number>;
  fetchedPagesByChain: Record<WalletReadChain, number>;
  complete: boolean;
  stoppedReason: "exhausted" | "max_reached" | "rate_limited" | "http_error" | "error";
  includeHidden: false;
};

export async function fetchWalletNfts(
  wallet: string,
  maxNfts = 200,
  chains: readonly WalletReadChain[] = WALLET_READ_CHAINS,
): Promise<FetchWalletNftsResult> {
  const nfts: OsWalletNft[] = [];
  let fetchedPages = 0;
  let stoppedReason: FetchWalletNftsResult["stoppedReason"] = "exhausted";
  const chainsChecked: WalletReadChain[] = [];
  const chainCounts = Object.fromEntries(
    WALLET_READ_CHAINS.map((chain) => [chain, 0]),
  ) as Record<WalletReadChain, number>;
  const fetchedPagesByChain = Object.fromEntries(
    WALLET_READ_CHAINS.map((chain) => [chain, 0]),
  ) as Record<WalletReadChain, number>;
  const pageSize = 50;

  for (const chain of chains) {
    if (nfts.length >= maxNfts) {
      stoppedReason = "max_reached";
      break;
    }

    chainsChecked.push(chain);
    let cursor: string | undefined;

    while (nfts.length < maxNfts) {
      const params = new URLSearchParams({
        include_hidden: "false",
        limit: String(Math.min(pageSize, maxNfts - nfts.length)),
      });
      if (cursor) params.set("next", cursor);

      try {
        const data = await osGet<AccountNftsResponse>(
          `/chain/${chain}/account/${encodeURIComponent(wallet)}/nfts?${params.toString()}`,
        );
        const rows = (data.nfts ?? []).map((nft) => ({ ...nft, chain }));
        nfts.push(...rows);
        chainCounts[chain] += rows.length;
        fetchedPages++;
        fetchedPagesByChain[chain]++;

        if (!data.next || rows.length === 0) break;
        cursor = data.next;

        if (nfts.length >= maxNfts) {
          stoppedReason = "max_reached";
          break;
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        stoppedReason = message.includes("OpenSea 429")
          ? "rate_limited"
          : message.includes("OpenSea")
            ? "http_error"
            : "error";
        break;
      }
    }

    if (stoppedReason !== "exhausted") break;

    if (nfts.length >= maxNfts) {
      stoppedReason = "max_reached";
      break;
    }
  }

  return {
    nfts,
    fetchedPages,
    chainsChecked,
    chainCounts,
    fetchedPagesByChain,
    complete: stoppedReason === "exhausted",
    stoppedReason,
    includeHidden: false,
  };
}

// ─── Account profiles ─────────────────────────────────────────────────────────

export type OsAccount = {
  address: string;
  username?: string;
  display_name?: string;
  ens?: string;
  ens_name?: string;
  profile_image_url?: string;
  image_url?: string;
  avatar_url?: string;
  avatar?: string;
};

export async function fetchAccount(address: string): Promise<OsAccount | null> {
  try {
    return await osGet<OsAccount>(
      `/accounts/${address}`,
      { next: { revalidate: 300 } } as RequestInit,
    );
  } catch {
    return null;
  }
}

export type WalletIdentitySuggestion = {
  label: string;
  displayName?: string;
  username?: string;
  ens?: string;
  address?: string;
  avatarUrl?: string;
  source: "opensea";
};

const WALLET_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const ETH_SUFFIX_RE = /\.eth$/i;
const CURATED_IDENTITY_SEARCH_ALIASES: Record<string, string[]> = {
  vuja: ["vuja_de", "vuja-de", "vuja de"],
};

function normalizeAddress(address?: string): string | undefined {
  const trimmed = address?.trim();
  return trimmed && WALLET_ADDRESS_RE.test(trimmed) ? trimmed.toLowerCase() : undefined;
}

export function shortAddress(address?: string): string | undefined {
  const normalized = normalizeAddress(address);
  return normalized ? `${normalized.slice(0, 6)}...${normalized.slice(-4)}` : undefined;
}

type NormalizedIdentityText = {
  normalized: string;
  compact: string;
  tokens: string[];
};

function normalizeIdentityText(value?: string): NormalizedIdentityText {
  const normalized = (value ?? "")
    .toLowerCase()
    .trim()
    .replace(ETH_SUFFIX_RE, "")
    .replace(/[_\-\s]+/g, " ")
    .trim();

  return {
    normalized,
    compact: normalized.replace(/\s+/g, ""),
    tokens: normalized.split(" ").filter(Boolean),
  };
}

function avatarFromAccount(account: OsAccount): string | undefined {
  return (
    account.profile_image_url ||
    account.image_url ||
    account.avatar_url ||
    account.avatar ||
    undefined
  );
}

function accountToSuggestion(account: OsAccount): WalletIdentitySuggestion | null {
  const address = normalizeAddress(account.address);
  const username = account.username?.trim() || undefined;
  const ens = account.ens?.trim() || account.ens_name?.trim() || undefined;
  const displayName = account.display_name?.trim() || username || ens || shortAddress(address);
  const label = displayName || address;

  if (!label) return null;

  return {
    label,
    displayName,
    username,
    ens,
    address,
    avatarUrl: avatarFromAccount(account),
    source: "opensea",
  };
}

export function extractOpenSeaProfileIdentifier(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (host !== "opensea.io") return null;
    const [firstSegment] = url.pathname.split("/").filter(Boolean);
    if (!firstSegment) return null;
    if (["assets", "collection", "rankings", "activity"].includes(firstSegment.toLowerCase())) {
      return null;
    }
    return decodeURIComponent(firstSegment);
  } catch {
    return null;
  }
}

export function normalizeWalletIdentityInput(input: string): string {
  const trimmed = input.trim();
  return extractOpenSeaProfileIdentifier(trimmed) ?? trimmed;
}

function identitySearchCandidates(input: string): string[] {
  const normalizedInput = normalizeWalletIdentityInput(input);
  const base = normalizedInput.trim().replace(ETH_SUFFIX_RE, "");
  const normalized = normalizeIdentityText(base).normalized;
  const candidates = new Set<string>();
  const add = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) candidates.add(trimmed);
  };

  add(normalizedInput);
  add(base);
  if (normalized) {
    add(normalized.replace(/\s+/g, "-"));
    add(normalized.replace(/\s+/g, "_"));
    add(normalized);
    for (const alias of CURATED_IDENTITY_SEARCH_ALIASES[normalized.replace(/\s+/g, "")] ?? []) {
      add(alias);
    }
  }

  return Array.from(candidates).slice(0, 4);
}

function identityResolveCandidates(input: string): string[] {
  const candidates = new Set(identitySearchCandidates(input));
  const normalizedInput = normalizeWalletIdentityInput(input).trim();
  const rawAddress = normalizeAddress(normalizedInput);

  if (!rawAddress && normalizedInput && !ETH_SUFFIX_RE.test(normalizedInput)) {
    candidates.add(`${normalizedInput}.eth`);
  }

  return Array.from(candidates).slice(0, 5);
}

function suggestionDedupKey(suggestion: WalletIdentitySuggestion): string {
  const address = normalizeAddress(suggestion.address);
  if (address) return `address:${address}`;

  const username = suggestion.username?.trim().toLowerCase();
  if (username) return `username:${username}`;

  const ens = suggestion.ens?.trim().toLowerCase();
  if (ens) return `ens:${ens}`;

  return `label:${suggestion.label.trim().toLowerCase()}`;
}

function mergeSuggestionField(current?: string, next?: string): string | undefined {
  const trimmedNext = next?.trim();
  if (!current?.trim()) return trimmedNext || undefined;
  return current;
}

function mergeWalletSuggestions(
  current: WalletIdentitySuggestion,
  next: WalletIdentitySuggestion,
): WalletIdentitySuggestion {
  return {
    label: mergeSuggestionField(current.label, next.label) ?? next.label,
    displayName: mergeSuggestionField(current.displayName, next.displayName),
    username: mergeSuggestionField(current.username, next.username),
    ens: mergeSuggestionField(current.ens, next.ens),
    address: normalizeAddress(current.address) ?? normalizeAddress(next.address),
    avatarUrl: mergeSuggestionField(current.avatarUrl, next.avatarUrl),
    source: current.source,
  };
}

async function enrichMissingSuggestionAvatars(
  suggestions: WalletIdentitySuggestion[],
): Promise<WalletIdentitySuggestion[]> {
  const missingAvatarAddresses = Array.from(
    new Set(
      suggestions
        .filter((suggestion) => !suggestion.avatarUrl)
        .map((suggestion) => normalizeAddress(suggestion.address))
        .filter((address): address is string => Boolean(address)),
    ),
  );

  if (missingAvatarAddresses.length === 0) return suggestions;

  const accounts = await Promise.all(
    missingAvatarAddresses.map(async (address) => {
      const account = await fetchAccount(address);
      return account ? accountToSuggestion(account) : null;
    }),
  );
  const byAddress = new Map<string, WalletIdentitySuggestion>();

  for (const accountSuggestion of accounts) {
    const address = normalizeAddress(accountSuggestion?.address);
    if (!address || !accountSuggestion) continue;
    const existing = byAddress.get(address);
    byAddress.set(
      address,
      existing ? mergeWalletSuggestions(existing, accountSuggestion) : accountSuggestion,
    );
  }

  return suggestions.map((suggestion) => {
    if (suggestion.avatarUrl) return suggestion;
    const address = normalizeAddress(suggestion.address);
    const accountSuggestion = address ? byAddress.get(address) : undefined;
    return accountSuggestion ? mergeWalletSuggestions(suggestion, accountSuggestion) : suggestion;
  });
}

function suggestionTextParts(suggestion: WalletIdentitySuggestion): string[] {
  return [
    suggestion.displayName,
    suggestion.username,
    suggestion.ens,
    suggestion.address,
    suggestion.label,
  ].filter((part): part is string => Boolean(part?.trim()));
}

function includesAnyQuerySignal(query: NormalizedIdentityText, suggestion: WalletIdentitySuggestion): boolean {
  if (!query.normalized && !query.compact) return true;

  return suggestionTextParts(suggestion).some((part) => {
    const candidate = normalizeIdentityText(part);
    return (
      (query.normalized && candidate.normalized.includes(query.normalized)) ||
      (query.compact && candidate.compact.includes(query.compact)) ||
      query.tokens.some((token) => candidate.tokens.includes(token) || candidate.compact.includes(token))
    );
  });
}

export function rankWalletSuggestion(
  query: string,
  suggestion: WalletIdentitySuggestion,
): number {
  const normalizedQueryInput = normalizeWalletIdentityInput(query);
  const queryText = normalizeIdentityText(normalizedQueryInput);
  const queryAddress = normalizeAddress(normalizedQueryInput);
  const address = normalizeAddress(suggestion.address);
  let score = 0;

  if (queryAddress && address === queryAddress) score += 1000;

  const ens = normalizeIdentityText(suggestion.ens);
  if (queryText.normalized && ens.normalized === queryText.normalized) score += 900;
  if (queryText.normalized && ens.normalized.startsWith(queryText.normalized)) score += 800;

  const username = normalizeIdentityText(suggestion.username);
  if (queryText.normalized && username.normalized === queryText.normalized) score += 760;
  if (queryText.normalized && username.normalized.startsWith(queryText.normalized)) score += 700;

  const displayName = normalizeIdentityText(suggestion.displayName);
  if (queryText.normalized && displayName.normalized === queryText.normalized) score += 650;
  if (queryText.normalized && displayName.normalized.startsWith(queryText.normalized)) score += 600;

  const fields = suggestionTextParts(suggestion).map(normalizeIdentityText);
  if (queryText.normalized && fields.some((field) => field.normalized === queryText.normalized)) {
    score += 550;
  }
  if (queryText.normalized && fields.some((field) => field.normalized.startsWith(queryText.normalized))) {
    score += 500;
  }
  if (queryText.compact && fields.some((field) => field.compact.startsWith(queryText.compact))) {
    score += 450;
  }
  if (
    queryText.tokens.length > 0 &&
    fields.some(
      (field) =>
        field.normalized.startsWith(queryText.normalized) &&
        field.tokens.length === queryText.tokens.length,
    )
  ) {
    score += 80;
  }

  const aggregateText = normalizeIdentityText(suggestionTextParts(suggestion).join(" "));
  if (
    queryText.tokens.length > 0 &&
    queryText.tokens.every(
      (token) => aggregateText.tokens.includes(token) || aggregateText.compact.includes(token),
    )
  ) {
    score += 300;
  }

  if (suggestion.avatarUrl) score += 15;
  if (address) score += 15;
  if (suggestion.source === "opensea") score += 5;
  if (!address) score -= 100;
  if (!includesAnyQuerySignal(queryText, suggestion)) score -= 200;

  return score;
}

export async function resolveWalletIdentity(input: string): Promise<WalletIdentitySuggestion | null> {
  const identifier = normalizeWalletIdentityInput(input);
  if (!identifier) return null;

  const rawAddress = normalizeAddress(identifier);
  if (rawAddress) {
    const account = await fetchAccount(rawAddress);
    return accountToSuggestion(account ?? { address: rawAddress });
  }

  try {
    const account = await osGet<OsAccount>(
      `/accounts/resolve/${encodeURIComponent(identifier)}`,
      { next: { revalidate: 300 } } as RequestInit,
    );
    return accountToSuggestion(account);
  } catch {
    try {
      const account = await osGet<OsAccount>(
        `/accounts/${encodeURIComponent(identifier)}`,
        { next: { revalidate: 300 } } as RequestInit,
      );
      return accountToSuggestion(account);
    } catch {
      return null;
    }
  }
}

export async function searchWalletIdentities(
  query: string,
  limit = 6,
): Promise<WalletIdentitySuggestion[]> {
  const normalizedQuery = normalizeWalletIdentityInput(query);
  if (normalizedQuery.trim().length < 2) return [];

  const suggestions = new Map<string, WalletIdentitySuggestion>();
  const addSuggestion = (suggestion: WalletIdentitySuggestion | null) => {
    if (!suggestion) return;
    const key = suggestionDedupKey(suggestion);
    const existing = suggestions.get(key);
    suggestions.set(key, existing ? mergeWalletSuggestions(existing, suggestion) : suggestion);
  };

  const resolveCandidates = identityResolveCandidates(normalizedQuery);
  const resolved = await Promise.all(
    resolveCandidates.map((candidate) => resolveWalletIdentity(candidate)),
  );
  resolved.forEach(addSuggestion);

  const searchCandidates = identitySearchCandidates(normalizedQuery);
  const searchLimit = Math.max(limit * 8, 50);
  await Promise.all(
    searchCandidates.map(async (candidate) => {
      try {
        const data = await osGet<{
          results?: Array<{
            type: string;
            account?: OsAccount;
          }>;
        }>(
          `/search?query=${encodeURIComponent(candidate)}&asset_types=account&limit=${searchLimit}`,
          { next: { revalidate: 60 } } as RequestInit,
        );

        for (const row of data.results ?? []) {
          if (row.type !== "account" || !row.account) continue;
          addSuggestion(accountToSuggestion(row.account));
        }
      } catch {
        // Other candidates and exact resolution can still produce suggestions.
      }
    }),
  );

  const rankedSuggestions = Array.from(suggestions.values())
    .sort((a, b) => rankWalletSuggestion(normalizedQuery, b) - rankWalletSuggestion(normalizedQuery, a))
    .slice(0, limit);

  return enrichMissingSuggestionAvatars(rankedSuggestions);
}
