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
  softTerms: Set<string>;
  addressLikeWeakProfile: boolean;
  weakProfile: boolean;
};

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
];

const SOFT_INSTITUTIONAL_TERMS = [
  "treasury",
  "fund",
  "multisig",
  "multi-sig",
  "dao",
  "team wallet",
  "project wallet",
  "official wallet",
  "cold wallet",
  "storage",
  "holdings",
  "reserve",
  "vault",
  "safe",
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

export function looksInstitutionalCollector(candidate: InstitutionalWalletCandidate): boolean {
  return scoreInstitutionalSignals(candidate).score >= 2;
}

export function getInstitutionalWalletReason(
  candidate: InstitutionalWalletCandidate,
): string | null {
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
  if (signal.softTerms.has("treasury") || signal.softTerms.has("fund")) {
    return "treasury/fund language";
  }
  if (
    (signal.softTerms.has("storage") ||
      signal.softTerms.has("vault") ||
      signal.softTerms.has("safe")) &&
    signal.weakProfile
  ) {
    return "storage/vault language with weak profile";
  }
  if (signal.addressLikeWeakProfile) return "address-like profile with weak human signal";

  return null;
}

function scoreInstitutionalSignals(candidate: InstitutionalWalletCandidate): InstitutionalSignal {
  const searchableText = collectSearchableText(candidate).join(" ").toLowerCase();
  const hardTerms = matchingTerms(searchableText, HARD_INSTITUTIONAL_TERMS);
  const softTerms = matchingTerms(searchableText, SOFT_INSTITUTIONAL_TERMS);
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

  let score = 0;
  if (hardTerms.size > 0) score += 2;
  if (softTerms.size > 0) score += 1;
  if (addressLikeWeakProfile) score += 1;
  if (weakProfile && !hasReadableProfileName && !hasHumanBio) score += 1;

  return {
    score,
    hardTerms,
    softTerms,
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
