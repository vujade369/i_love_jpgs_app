export type InstitutionalWalletCandidate = {
  ens?: string | null;
  displayName?: string | null;
  username?: string | null;
  openseaUsername?: string | null;
  address?: string | null;
  wallet?: string | null;
  bio?: string | null;
  bioDisplay?: string | null;
  description?: string | null;
  openSeaUrl?: string | null;
  openseaProfileUrl?: string | null;
  socialLinks?: unknown[] | null;
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
  imageUrl?: string | null;
};

type InstitutionalSignal = {
  score: number;
  hardTerms: Set<string>;
  conditionalTerms: Set<string>;
  conditionalWeakProfile: boolean;
  addressLikeWeakProfile: boolean;
  weakProfile: boolean;
};

// Known non-human project/infrastructure wallets that won't match keyword heuristics.
// Matched by lowercase address, username, or ENS — checked before scoring.
type KnownNonHumanWallet = {
  addresses?: string[];
  usernames?: string[];
  ens?: string[];
  reason: string;
};

const KNOWN_NON_HUMAN_WALLETS: KnownNonHumanWallet[] = [
  {
    usernames: ["the-barn"],
    ens: ["barn.harv.eth"],
    reason: "known project burn wallet",
  },
];

const KNOWN_NON_HUMAN_WALLET_MAP = new Map<string, string>();
for (const entry of KNOWN_NON_HUMAN_WALLETS) {
  for (const address of entry.addresses ?? []) {
    KNOWN_NON_HUMAN_WALLET_MAP.set(address.toLowerCase(), entry.reason);
  }
  for (const username of entry.usernames ?? []) {
    KNOWN_NON_HUMAN_WALLET_MAP.set(username.toLowerCase(), entry.reason);
  }
  for (const ens of entry.ens ?? []) {
    KNOWN_NON_HUMAN_WALLET_MAP.set(ens.toLowerCase(), entry.reason);
  }
}

const HARD_INSTITUTIONAL_TERMS = [
  "marketplace",
  "exchange",
  "opensea",
  "blur",
  "looksrare",
  "x2y2",
  "delegate",
  "delegation",
  "escrow",
  "staking",
  "auction",
  "bulk",
  "museum",
  "treasury",
  "fund",
  "multisig",
  "multi-sig",
  "dao",
  "team wallet",
  "project wallet",
  "official wallet",
  "reserve",
  "burn wallet",
  "burn address",
  "sink wallet",
];

// Only contribute score when no profile image AND (address-like name OR no readable human name).
// Bio is intentionally excluded — many real collectors have no bio.
const CONDITIONAL_INSTITUTIONAL_TERMS = [
  "vault",
  "safe",
  "storage",
  "holdings",
  "cold wallet",
];

const GENERIC_URL_SEGMENTS = new Set([
  "asset",
  "assets",
  "collection",
  "collections",
  "item",
]);

const ADDRESS_LIKE_RE = /^0x[a-f0-9]{4}/i;
const GENERIC_BIO_RE = /^(no bio found|no bio|bio unavailable)$/i;

function knownNonHumanWalletReason(candidate: InstitutionalWalletCandidate): string | null {
  const identities = [
    candidate.address,
    candidate.wallet,
    candidate.username,
    candidate.openseaUsername,
    candidate.ens,
  ];
  for (const value of identities) {
    const normalized = value?.trim().toLowerCase();
    if (normalized) {
      const reason = KNOWN_NON_HUMAN_WALLET_MAP.get(normalized);
      if (reason) return reason;
    }
  }
  return null;
}

export function looksInstitutionalCollector(candidate: InstitutionalWalletCandidate): boolean {
  if (knownNonHumanWalletReason(candidate)) return true;
  return scoreInstitutionalSignals(candidate).score >= 2;
}

export function getInstitutionalWalletReason(
  candidate: InstitutionalWalletCandidate,
): string | null {
  const knownReason = knownNonHumanWalletReason(candidate);
  if (knownReason) return knownReason;

  const signal = scoreInstitutionalSignals(candidate);

  if (signal.score < 2) return null;
  if (
    signal.hardTerms.has("marketplace") ||
    signal.hardTerms.has("exchange") ||
    signal.hardTerms.has("opensea") ||
    signal.hardTerms.has("blur") ||
    signal.hardTerms.has("looksrare") ||
    signal.hardTerms.has("x2y2") ||
    signal.hardTerms.has("delegate") ||
    signal.hardTerms.has("delegation") ||
    signal.hardTerms.has("escrow") ||
    signal.hardTerms.has("staking") ||
    signal.hardTerms.has("auction") ||
    signal.hardTerms.has("bulk")
  ) {
    return "marketplace/delegate signal";
  }
  if (signal.hardTerms.has("museum")) return "museum/institutional signal";
  if (
    signal.hardTerms.has("treasury") ||
    signal.hardTerms.has("fund") ||
    signal.hardTerms.has("reserve")
  ) {
    return "treasury/fund language";
  }
  if (
    signal.hardTerms.has("dao") ||
    signal.hardTerms.has("multisig") ||
    signal.hardTerms.has("multi-sig") ||
    signal.hardTerms.has("team wallet") ||
    signal.hardTerms.has("project wallet") ||
    signal.hardTerms.has("official wallet")
  ) {
    return "project/org language";
  }
  if (signal.conditionalTerms.size > 0 && signal.conditionalWeakProfile) {
    return "storage/vault language with weak profile";
  }
  if (signal.addressLikeWeakProfile) return "address-like profile with weak human signal";

  return null;
}

function scoreInstitutionalSignals(candidate: InstitutionalWalletCandidate): InstitutionalSignal {
  const searchableText = collectSearchableText(candidate).join(" ").toLowerCase();
  const hardTerms = matchingTerms(searchableText, HARD_INSTITUTIONAL_TERMS);
  const conditionalTerms = matchingTerms(searchableText, CONDITIONAL_INSTITUTIONAL_TERMS);
  const hasProfileImage = Boolean(
    textValue(candidate.avatarUrl) ||
      textValue(candidate.profileImageUrl) ||
      textValue(candidate.imageUrl),
  );
  const hasSocialPresence = Array.isArray(candidate.socialLinks) && candidate.socialLinks.length > 0;
  const hasReadableProfileName = [
    candidate.ens,
    candidate.displayName,
    candidate.username,
    candidate.openseaUsername,
  ].some((value) => {
    const text = textValue(value);
    return Boolean(text && !isAddressLike(text));
  });
  const hasHumanBio = [candidate.bio, candidate.bioDisplay, candidate.description].some((value) => {
    const text = textValue(value);
    return Boolean(text && !GENERIC_BIO_RE.test(text));
  });
  const addressLikeWeakProfile =
    !hasProfileImage &&
    [candidate.displayName, candidate.username, candidate.openseaUsername, candidate.ens].some((value) =>
      isAddressLike(textValue(value)),
    );
  const weakProfile = !hasProfileImage && !hasSocialPresence;
  // Conditional terms only score when the profile is clearly non-human: no avatar plus
  // address-like identity or no readable name. Bio is excluded from this check.
  const conditionalWeakProfile =
    addressLikeWeakProfile || (!hasProfileImage && !hasReadableProfileName);

  let score = 0;
  if (hardTerms.size > 0) score += 2;
  if (conditionalTerms.size > 0 && conditionalWeakProfile) score += 1;
  if (addressLikeWeakProfile) score += 1;
  if (weakProfile && !hasReadableProfileName && !hasHumanBio) score += 1;

  return {
    score,
    hardTerms,
    conditionalTerms,
    conditionalWeakProfile,
    addressLikeWeakProfile,
    weakProfile,
  };
}

function collectSearchableText(candidate: InstitutionalWalletCandidate): string[] {
  return [
    candidate.ens,
    candidate.displayName,
    candidate.username,
    candidate.openseaUsername,
    candidate.address,
    candidate.wallet,
    candidate.bio,
    candidate.bioDisplay,
    candidate.description,
    ...meaningfulUrlSegments(candidate.openSeaUrl),
    ...meaningfulUrlSegments(candidate.openseaProfileUrl),
  ]
    .map(textValue)
    .filter((value): value is string => Boolean(value));
}

function meaningfulUrlSegments(value?: string | null): string[] {
  const text = textValue(value);
  if (!text) return [];

  try {
    const url = new URL(text.includes("://") ? text : `https://${text}`);
    return url.pathname
      .split("/")
      .map((segment) => segment.trim().toLowerCase())
      .filter((segment) => segment && !GENERIC_URL_SEGMENTS.has(segment));
  } catch {
    return text
      .replace(/^https?:\/\//i, "")
      .split("/")
      .slice(1)
      .map((segment) => segment.trim().toLowerCase())
      .filter((segment) => segment && !GENERIC_URL_SEGMENTS.has(segment));
  }
}

function matchingTerms(text: string, terms: string[]): Set<string> {
  const matches = new Set<string>();
  for (const term of terms) {
    if (text.includes(term)) matches.add(term);
  }
  return matches;
}

function isAddressLike(value?: string): boolean {
  return Boolean(value && ADDRESS_LIKE_RE.test(value.trim()));
}

function textValue(value?: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}
