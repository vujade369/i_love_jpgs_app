"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type TopCollection = {
  slug: string;
  name: string;
  imageUrl?: string;
  imageSource: "collection" | "nft" | "none";
  count: number;
  openseaUrl: string;
};

type TasteSignal = {
  category: string;
  label: string;
  nftCount: number;
  collectionCount: number;
  collections: Array<{ slug: string; name: string; count: number }>;
};

type SourceWalletMetadata = {
  id: string;
  input: string;
  address?: string;
  shortWallet?: string;
  displayName?: string;
  username?: string;
  ens?: string;
  avatarUrl?: string;
  status: "included" | "invalid" | "fetch_failed";
  nftCount: number;
  collectionCount: number;
  error?: string;
};

type WalletReadResponse = {
  wallet: string;
  shortWallet: string;
  nftCount: number;
  collectionCount: number;
  topCollections: TopCollection[];
  tasteSignals: TasteSignal[];
  wallets?: string[];
  shortWallets?: string[];
  primaryWallet?: string;
  walletCount?: number;
  includedWalletCount?: number;
  invalidWalletCount?: number;
  failedWalletCount?: number;
  sourceWallets?: SourceWalletMetadata[];
  dedupe?: {
    inputNftCount: number;
    dedupedNftCount: number;
    duplicateNftCount: number;
  };
  debug?: {
    fetchedPages: number;
    chainsChecked: string[];
    chainCounts: Record<string, number>;
    fetchedPagesByChain: Record<string, number>;
    complete: boolean;
    stoppedReason: string;
    maxVisibleNfts: number;
    includeHidden: boolean;
  };
  error?: string;
};

type WalletReadErrorResponse = Partial<WalletReadResponse> & {
  error?: string;
  sourceWallets?: SourceWalletMetadata[];
};

type ReadState = "idle" | "loading" | "success" | "empty" | "error";
type SuggestState = "idle" | "loading" | "ready";
type ActiveWalletView = "combined" | string;

type WalletSuggestion = {
  label: string;
  displayName?: string;
  username?: string;
  ens?: string;
  address?: string;
  avatarUrl?: string;
  source: string;
};

const SAMPLE_WALLET = "0x5ffd8de19910efff95df729c54699aebcee8f747";
const WALLET_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX_WALLETS = 2;

type WalletReadCopy = {
  headline: string;
  body: string;
};

const READ_LABELS: Record<string, string> = {
  Art: "art",
  Generative: "generative art",
  "PFP / Identity": "PFP culture",
  "Meme / Internet Culture": "meme culture",
  "Gaming / Worlds": "gaming and world-building objects",
  "Access / Membership": "access and membership objects",
  Collectibles: "collectibles",
  "Music / Media": "music and media",
  "Unsorted Signals": "visible collection clusters",
};

export default function WalletReadPage() {
  const [wallet, setWallet] = useState("");
  const [walletSet, setWalletSet] = useState<string[]>([]);
  const [activeView, setActiveView] = useState<ActiveWalletView>("combined");
  const [state, setState] = useState<ReadState>("idle");
  const [profile, setProfile] = useState<WalletReadResponse | null>(null);
  const [walletSources, setWalletSources] = useState<SourceWalletMetadata[]>([]);
  const [errorSources, setErrorSources] = useState<SourceWalletMetadata[]>([]);
  const [error, setError] = useState("");
  const [resolvedWallet, setResolvedWallet] = useState("");
  const [selectedSuggestion, setSelectedSuggestion] = useState<WalletSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<WalletSuggestion[]>([]);
  const [suggestState, setSuggestState] = useState<SuggestState>("idle");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeq = useRef(0);
  const didHydrateUrl = useRef(false);

  async function readWalletSet(
    inputs: string[],
    options: { syncUrl?: boolean; activeView?: ActiveWalletView } = {},
  ) {
    const nextInputs = normalizeWalletInputs(inputs);
    const nextActiveView = normalizeActiveWalletView(options.activeView ?? activeView, nextInputs);
    const readInputs = activeReadInputs(nextInputs, nextActiveView);

    if (nextInputs.length === 0) {
      setWalletSet([]);
      setActiveView("combined");
      setState("idle");
      setError("");
      setProfile(null);
      setWalletSources([]);
      setErrorSources([]);
      if (options.syncUrl !== false) updateWalletUrl([]);
      return;
    }

    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setWalletSet(nextInputs);
    setActiveView(nextActiveView);
    if (options.syncUrl !== false) updateWalletUrl(nextInputs);
    setState("loading");
    setError("");
    setProfile(null);
    setErrorSources([]);

    try {
      const params = new URLSearchParams();
      readInputs.forEach((input) => params.append("wallet", input));
      const res = await fetch(`/api/wallet/read?${params.toString()}`);
      const data = (await res.json()) as WalletReadResponse | WalletReadErrorResponse;

      if (requestSeq.current !== requestId) return;

      if (!res.ok || !isWalletReadResponse(data)) {
        setState("error");
        setError(data.error || "The wallet read failed.");
        setErrorSources(data.sourceWallets ?? []);
        setWalletSources((currentSources) =>
          mergeWalletSources(currentSources, data.sourceWallets ?? [], nextInputs),
        );
        return;
      }

      setProfile(data);
      setState(data.nftCount === 0 ? "empty" : "success");
      setErrorSources([]);

      const canonicalReadInputs = canonicalWalletInputsFromResponse(data, readInputs);
      const canonicalInputs =
        nextActiveView === "combined"
          ? canonicalWalletInputsFromResponse(data, nextInputs)
          : replaceActiveWalletInput(nextInputs, nextActiveView, canonicalReadInputs[0] ?? readInputs[0]);
      const canonicalActiveView = normalizeActiveWalletView(
        nextActiveView === "combined" ? "combined" : canonicalReadInputs[0] ?? nextActiveView,
        canonicalInputs,
      );

      setWalletSources((currentSources) =>
        mergeWalletSources(currentSources, data.sourceWallets ?? [], canonicalInputs),
      );
      setActiveView(canonicalActiveView);

      if (!sameWalletInputs(canonicalInputs, nextInputs)) {
        setWalletSet(canonicalInputs);
        if (options.syncUrl !== false) updateWalletUrl(canonicalInputs);
      }
    } catch {
      if (requestSeq.current !== requestId) return;
      setState("error");
      setError("Could not reach the wallet read service.");
      setErrorSources([]);
    }
  }

  useEffect(() => {
    function hydrateFromUrl() {
      const inputs = walletInputsFromSearch(window.location.search);
      void readWalletSet(inputs, { syncUrl: false });
    }

    if (!didHydrateUrl.current) {
      didHydrateUrl.current = true;
      hydrateFromUrl();
    }

    window.addEventListener("popstate", hydrateFromUrl);
    return () => window.removeEventListener("popstate", hydrateFromUrl);
  }, []);

  useEffect(() => {
    const q = wallet.trim();

    if (q.length < 2 || resolvedWallet || WALLET_ADDRESS_RE.test(q) || walletSet.length >= MAX_WALLETS) {
      setSuggestions([]);
      setSuggestState("idle");
      setShowSuggestions(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSuggestState("loading");
      try {
        const res = await fetch(`/api/wallet/suggest?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = (await res.json()) as { suggestions?: WalletSuggestion[] };
        const nextSuggestions = data.suggestions ?? [];
        setSuggestions(nextSuggestions);
        setShowSuggestions(nextSuggestions.length > 0);
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setShowSuggestions(false);
        }
      } finally {
        if (!controller.signal.aborted) setSuggestState("ready");
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [wallet, resolvedWallet, walletSet.length]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowSuggestions(false);

    if (walletSet.length >= MAX_WALLETS) return;

    const candidate = (selectedSuggestion?.address || resolvedWallet || wallet).trim();
    if (!candidate) {
      setState("error");
      setError("Enter a wallet address to read.");
      setProfile(null);
      setErrorSources([]);
      return;
    }

    const nextInputs = normalizeWalletInputs([...walletSet, candidate]);
    setWallet("");
    setResolvedWallet("");
    setSelectedSuggestion(null);
    void readWalletSet(nextInputs);
  }

  function useSampleWallet() {
    setWallet("");
    setResolvedWallet("");
    setSelectedSuggestion(null);
    setShowSuggestions(false);
    void readWalletSet([SAMPLE_WALLET]);
  }

  function handleWalletChange(value: string) {
    setWallet(value);
    setResolvedWallet("");
    setSelectedSuggestion(null);
    setShowSuggestions(
      value.trim().length >= 2 &&
        !WALLET_ADDRESS_RE.test(value.trim()) &&
        walletSet.length < MAX_WALLETS &&
        suggestions.length > 0,
    );
  }

  function selectSuggestion(suggestion: WalletSuggestion) {
    const readableLabel = suggestion.displayName || suggestion.ens || suggestion.username || suggestion.address || suggestion.label;
    setWallet(readableLabel);
    setResolvedWallet(suggestion.address ?? "");
    setSelectedSuggestion(suggestion);
    setShowSuggestions(false);
  }

  function removeWallet(addressOrInput: string) {
    const nextInputs = walletSet.filter((input) => input.toLowerCase() !== addressOrInput.toLowerCase());
    void readWalletSet(nextInputs);
  }

  function switchActiveView(nextActiveView: ActiveWalletView) {
    void readWalletSet(walletSet, { activeView: nextActiveView });
  }

  const sourceWallets = walletSources.length > 0 ? walletSources : profile?.sourceWallets ?? errorSources;
  const includedSources = sourceWallets.filter((source) => source.status === "included");
  const sourceNotices = sourceWallets.filter((source) => source.status !== "included");
  const atWalletLimit = walletSet.length >= MAX_WALLETS;
  const activeReadLabel = readLabelForView(walletSet, activeView);

  return (
    <main className="min-h-screen" style={{ background: "var(--jpgs-bg)", color: "var(--jpgs-text)" }}>
      <section style={{ maxWidth: 920, margin: "0 auto", padding: "72px 24px 40px" }}>
        <p style={{ fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--jpgs-accent)", marginBottom: 20 }}>
          I Like JPGs
        </p>
        <h1 style={{ fontSize: 38, fontWeight: 300, lineHeight: 1.15, marginBottom: 14 }}>
          Read a wallet by what it collects.
        </h1>
        <p style={{ maxWidth: 560, color: "var(--jpgs-muted)", fontSize: 16, lineHeight: 1.7, marginBottom: 28 }}>
          Enter a wallet, ENS, or OpenSea profile to see visible public collection signals across supported chains, grouped plainly.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, alignItems: "stretch", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "1 1 360px", minWidth: 0 }}>
            <input
              value={wallet}
              onChange={(event) => handleWalletChange(event.target.value)}
              onFocus={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                if (suggestions.length > 0 && !atWalletLimit) setShowSuggestions(true);
              }}
              onBlur={() => {
                blurTimer.current = setTimeout(() => setShowSuggestions(false), 120);
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setShowSuggestions(false);
              }}
              placeholder={atWalletLimit ? "Two-wallet reads are the current limit." : "Search name, ENS, OpenSea profile, or wallet address"}
              aria-label="Wallet, ENS, OpenSea username, or OpenSea profile URL"
              aria-expanded={showSuggestions}
              aria-controls="wallet-suggestions"
              disabled={atWalletLimit}
              name="wallet"
              autoComplete="off"
              spellCheck={false}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "var(--jpgs-surface-2)",
                border: "1px solid var(--jpgs-border)",
                borderRadius: 8,
                padding: "15px 16px",
                color: "var(--jpgs-text)",
                fontSize: 14,
                opacity: atWalletLimit ? 0.62 : 1,
              }}
            />
            {suggestState === "loading" && wallet.trim().length >= 2 && !resolvedWallet && !atWalletLimit && (
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  right: 14,
                  top: 17,
                  width: 14,
                  height: 14,
                  border: "1.5px solid var(--jpgs-accent)",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            )}
            {showSuggestions && suggestions.length > 0 && !atWalletLimit && (
              <div
                id="wallet-suggestions"
                role="listbox"
                style={{
                  position: "absolute",
                  zIndex: 20,
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  background: "rgb(18,18,18)",
                  border: "1px solid var(--jpgs-border)",
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: "0 16px 40px rgba(0,0,0,0.35)",
                }}
              >
                {suggestions.map((suggestion) => (
                  <button
                    key={`${suggestion.source}-${suggestion.address ?? suggestion.username ?? suggestion.ens ?? suggestion.label}`}
                    type="button"
                    role="option"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectSuggestion(suggestion);
                    }}
                    onClick={() => selectSuggestion(suggestion)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "34px 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 12px",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid rgba(255,255,255,0.06)",
                      color: "var(--jpgs-text)",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                  >
                    <SuggestionAvatar suggestion={suggestion} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {suggestion.displayName || suggestion.label}
                      </span>
                      <span style={{ display: "block", color: "var(--jpgs-muted)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>
                        {formatSuggestionHandle(suggestion)}
                      </span>
                    </span>
                    <span style={{ color: "var(--jpgs-muted)", fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>
                      {shortWallet(suggestion.address)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={state === "loading" || atWalletLimit}
            style={{
              background: atWalletLimit ? "rgba(255,255,255,0.06)" : "var(--jpgs-accent)",
              border: atWalletLimit ? "1px solid var(--jpgs-border)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "0 18px",
              color: atWalletLimit ? "var(--jpgs-muted)" : "white",
              fontSize: 14,
              minHeight: 50,
              opacity: state === "loading" ? 0.7 : 1,
              cursor: state === "loading" || atWalletLimit ? "not-allowed" : "pointer",
            }}
          >
            {state === "loading" ? "Reading…" : atWalletLimit ? "Limit reached" : walletSet.length > 0 ? "Add wallet" : "Read wallet"}
          </button>
          <button
            type="button"
            onClick={useSampleWallet}
            disabled={state === "loading"}
            style={{
              background: "transparent",
              border: "1px solid var(--jpgs-border)",
              borderRadius: 8,
              padding: "0 14px",
              color: "var(--jpgs-muted)",
              fontSize: 14,
              minHeight: 50,
            }}
          >
            Try sample
          </button>
        </form>

        {(includedSources.length > 0 || sourceNotices.length > 0 || atWalletLimit) && (
          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            {includedSources.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} aria-label="Included wallets">
                {includedSources.map((source, index) => (
                  <WalletChip
                    key={source.id}
                    source={source}
                    isPrimary={index === 0}
                    onRemove={() => removeWallet(source.address || source.input)}
                  />
                ))}
              </div>
            )}
            {sourceNotices.length > 0 && (
              <WalletSourceNotices
                sources={sourceNotices}
                onRemove={(source) => removeWallet(source.address || source.input)}
              />
            )}
            {atWalletLimit && (
              <p style={{ ...mutedTextStyle, fontSize: 12 }}>Two-wallet reads are the current limit.</p>
            )}
            {includedSources.length === MAX_WALLETS && (
              <WalletViewControls
                activeView={activeView}
                walletSet={walletSet}
                onChange={switchActiveView}
              />
            )}
          </div>
        )}
      </section>

      <section style={{ maxWidth: 920, margin: "0 auto", padding: "0 24px 80px" }}>
        {state === "idle" && (
          <Panel>
            <p style={eyebrowStyle}>Ready</p>
            <h2 style={panelTitleStyle}>Start with a public wallet.</h2>
            <p style={mutedTextStyle}>
              The first read stays close to the raw collection data: counts, collection names, images, and simple category signals.
            </p>
          </Panel>
        )}

        {state === "loading" && (
          <Panel>
            <p style={eyebrowStyle}>Reading</p>
            <h2 style={panelTitleStyle}>Fetching visible JPGs.</h2>
            <p style={mutedTextStyle}>This can take a moment while collection metadata is gathered.</p>
          </Panel>
        )}

        {state === "error" && (
          <Panel>
            <p style={{ ...eyebrowStyle, color: "rgb(255, 138, 128)" }}>Error</p>
            <h2 style={panelTitleStyle}>That wallet could not be read.</h2>
            <p style={mutedTextStyle}>{error}</p>
            {sourceNotices.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <WalletSourceNotices
                  sources={sourceNotices}
                  onRemove={(source) => removeWallet(source.address || source.input)}
                />
              </div>
            )}
          </Panel>
        )}

        {state === "empty" && profile && (
          <Panel>
            <WalletHeader profile={profile} readLabel={activeReadLabel} walletSet={walletSet} activeView={activeView} />
            <div style={{ borderTop: "1px solid var(--jpgs-border)", marginTop: 22, paddingTop: 22 }}>
              <h2 style={panelTitleStyle}>No visible JPGs found.</h2>
              <p style={mutedTextStyle}>
                {activeView === "combined" && walletSet.length > 1
                  ? "These wallets did not return visible JPG holdings from the current source."
                  : "This wallet did not return visible JPG holdings from the current source."}
              </p>
            </div>
          </Panel>
        )}

        {state === "success" && profile && (
          <div style={{ display: "grid", gap: 18 }}>
            <Panel>
              <WalletHeader profile={profile} readLabel={activeReadLabel} walletSet={walletSet} activeView={activeView} />
            </Panel>

            <Panel>
              <WalletReadSummary profile={profile} />
            </Panel>

            <Panel>
              <SectionHeading title="Top collections" detail={`${profile.collectionCount} collections found`} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {profile.topCollections.map((collection) => (
                  <a
                    key={collection.slug}
                    href={collection.openseaUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "56px 1fr",
                      gap: 12,
                      alignItems: "center",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--jpgs-border)",
                      borderRadius: 8,
                      padding: 10,
                      textDecoration: "none",
                      color: "var(--jpgs-text)",
                    }}
                  >
                    <CollectionImage collection={collection} />
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {collection.name}
                      </p>
                      <p style={{ color: "var(--jpgs-muted)", fontSize: 12 }}>
                        {collection.count} held
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            </Panel>

            {profile.tasteSignals.length > 0 && (
              <Panel>
                <SectionHeading title="Taste signals" detail="Based on visible metadata" />
                <div style={{ display: "grid", gap: 12 }}>
                  {profile.tasteSignals.slice(0, 6).map((signal) => (
                    <div
                      key={signal.category}
                      style={{
                        border: "1px solid var(--jpgs-border)",
                        borderRadius: 8,
                        padding: 14,
                        background: "rgba(255,255,255,0.025)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 500 }}>{signal.label}</h3>
                        <span style={{ color: "var(--jpgs-muted)", fontSize: 12 }}>
                          {signal.nftCount} JPGs
                        </span>
                      </div>
                      <p style={{ color: "var(--jpgs-muted)", fontSize: 13, lineHeight: 1.6 }}>
                        Seen across{" "}
                        {signal.collections.map((collection) => collection.name).join(", ")}
                      </p>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

function isWalletReadResponse(data: WalletReadResponse | WalletReadErrorResponse): data is WalletReadResponse {
  return (
    typeof data.wallet === "string" &&
    typeof data.shortWallet === "string" &&
    typeof data.nftCount === "number" &&
    Array.isArray(data.topCollections) &&
    Array.isArray(data.tasteSignals)
  );
}

function walletInputsFromSearch(search: string): string[] {
  return normalizeWalletInputs(new URLSearchParams(search).getAll("wallet"));
}

function normalizeActiveWalletView(activeView: ActiveWalletView, walletInputs: string[]): ActiveWalletView {
  if (walletInputs.length < 2) return "combined";
  if (activeView === "combined") return "combined";
  return findWalletInput(walletInputs, activeView) ?? "combined";
}

function activeReadInputs(walletInputs: string[], activeView: ActiveWalletView): string[] {
  if (activeView === "combined") return walletInputs;
  const activeInput = findWalletInput(walletInputs, activeView);
  return activeInput ? [activeInput] : walletInputs;
}

function replaceActiveWalletInput(
  walletInputs: string[],
  activeView: ActiveWalletView,
  replacementInput?: string,
): string[] {
  if (activeView === "combined" || !replacementInput) return walletInputs;
  const nextInputs = walletInputs.map((input) =>
    sameWalletInput(input, activeView) ? replacementInput : input,
  );
  return normalizeWalletInputs(nextInputs);
}

function findWalletInput(walletInputs: string[], target: string): string | undefined {
  return walletInputs.find((input) => sameWalletInput(input, target));
}

function sameWalletInput(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function normalizeWalletInputs(inputs: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const input of inputs) {
    const trimmed = input.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
    if (normalized.length >= MAX_WALLETS) break;
  }

  return normalized;
}

function canonicalWalletInputsFromResponse(profile: WalletReadResponse, fallbackInputs: string[]): string[] {
  const sourceInputs = (profile.sourceWallets ?? [])
    .map((source) => source.address || source.input)
    .filter((input): input is string => Boolean(input?.trim()));

  return normalizeWalletInputs(sourceInputs.length > 0 ? sourceInputs : fallbackInputs);
}

function mergeWalletSources(
  currentSources: SourceWalletMetadata[],
  incomingSources: SourceWalletMetadata[],
  walletInputs: string[],
): SourceWalletMetadata[] {
  const currentByKey = sourceLookup(currentSources);
  const incomingByKey = sourceLookup(incomingSources);

  return walletInputs.map((input) => {
    const key = input.toLowerCase();
    return (
      incomingByKey.get(key) ??
      currentByKey.get(key) ??
      {
        id: `wallet-input:${key}`,
        input,
        status: "included",
        nftCount: 0,
        collectionCount: 0,
      }
    );
  });
}

function sourceLookup(sources: SourceWalletMetadata[]): Map<string, SourceWalletMetadata> {
  const lookup = new Map<string, SourceWalletMetadata>();
  for (const source of sources) {
    [source.input, source.address, source.shortWallet]
      .filter((value): value is string => Boolean(value?.trim()))
      .forEach((value) => lookup.set(value.toLowerCase(), source));
  }
  return lookup;
}

function sameWalletInputs(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((input, index) => input.toLowerCase() === b[index]?.toLowerCase());
}

function readLabelForView(walletInputs: string[], activeView: ActiveWalletView): string {
  if (walletInputs.length > 1 && activeView !== "combined") return "Individual Read";
  if (walletInputs.length > 1) return "Combined Read";
  return "Wallet Read";
}

function readDetailForView(
  profile: WalletReadResponse,
  walletInputs: string[],
  activeView: ActiveWalletView,
): string {
  if (walletInputs.length > 1 && activeView !== "combined") {
    return `Selected wallet from ${walletInputs.length} included wallets.`;
  }

  const walletCount = profile.walletCount ?? 1;
  return walletCount > 1 ? `${walletCount} wallets included in one read.` : profile.wallet;
}

function updateWalletUrl(inputs: string[]) {
  const params = new URLSearchParams();
  normalizeWalletInputs(inputs).forEach((input) => params.append("wallet", input));
  const nextUrl = params.toString() ? `/wallet?${params.toString()}` : "/wallet";
  window.history.replaceState(null, "", nextUrl);
}

function shortWallet(wallet?: string): string {
  if (!wallet) return "";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

function sourceLabel(source: SourceWalletMetadata): string {
  return source.displayName || source.ens || source.username || source.shortWallet || source.address || source.input;
}

function formatSuggestionHandle(suggestion: WalletSuggestion): string {
  const handle = suggestion.ens || suggestion.username;
  const address = shortWallet(suggestion.address);
  if (handle && address) return `${handle} · ${address}`;
  return handle || address || suggestion.source;
}

function SuggestionAvatar({ suggestion }: { suggestion: WalletSuggestion }) {
  if (suggestion.avatarUrl) {
    return (
      <img
        src={suggestion.avatarUrl}
        alt=""
        style={{ width: 34, height: 34, objectFit: "cover", borderRadius: 8, background: "rgba(255,255,255,0.06)" }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: 34,
        height: 34,
        borderRadius: 8,
        display: "grid",
        placeItems: "center",
        background: "rgba(149,117,255,0.12)",
        color: "var(--jpgs-accent)",
        fontSize: 11,
      }}
    >
      {(suggestion.displayName || suggestion.username || suggestion.ens || suggestion.label).slice(0, 2).toUpperCase()}
    </span>
  );
}

function WalletChip({
  source,
  isPrimary,
  onRemove,
}: {
  source: SourceWalletMetadata;
  isPrimary: boolean;
  onRemove: () => void;
}) {
  const label = sourceLabel(source);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        maxWidth: "100%",
        minHeight: 34,
        padding: "6px 8px 6px 10px",
        border: "1px solid var(--jpgs-border)",
        borderRadius: 8,
        background: "rgba(255,255,255,0.03)",
        color: "var(--jpgs-text)",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
          {label}
        </span>
        {isPrimary && (
          <span style={{ display: "block", color: "var(--jpgs-muted)", fontSize: 10, marginTop: 1 }}>
            identity anchor
          </span>
        )}
      </span>
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        style={{
          width: 22,
          height: 22,
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.04)",
          color: "var(--jpgs-muted)",
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </span>
  );
}

function WalletSourceNotices({
  sources,
  onRemove,
}: {
  sources: SourceWalletMetadata[];
  onRemove?: (source: SourceWalletMetadata) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {sources.map((source) => (
        <div
          key={source.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            color: "var(--jpgs-muted)",
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          <span>{sourceLabel(source)} was not included: {source.error || "This wallet could not be read."}</span>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(source)}
              style={{
                border: "1px solid var(--jpgs-border)",
                borderRadius: 6,
                background: "transparent",
                color: "var(--jpgs-muted)",
                cursor: "pointer",
                fontSize: 11,
                padding: "3px 6px",
              }}
            >
              Remove
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function WalletViewControls({
  activeView,
  walletSet,
  onChange,
}: {
  activeView: ActiveWalletView;
  walletSet: string[];
  onChange: (activeView: ActiveWalletView) => void;
}) {
  const options = [
    { label: "Combined", value: "combined" },
    ...walletSet.map((input, index) => ({ label: `Wallet ${index + 1}`, value: input })),
  ];

  return (
    <div style={{ display: "grid", gap: 7, maxWidth: 520 }}>
      <div
        role="group"
        aria-label="Wallet read view"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          padding: 4,
          border: "1px solid var(--jpgs-border)",
          borderRadius: 8,
          background: "rgba(255,255,255,0.025)",
        }}
      >
        {options.map((option) => {
          const isActive =
            option.value === "combined"
              ? activeView === "combined"
              : activeView !== "combined" && sameWalletInput(activeView, option.value);

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(option.value)}
              style={{
                flex: "1 1 120px",
                minHeight: 34,
                border: isActive ? "1px solid rgba(255,255,255,0.16)" : "1px solid transparent",
                borderRadius: 6,
                background: isActive ? "var(--jpgs-accent)" : "transparent",
                color: isActive ? "white" : "var(--jpgs-muted)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p style={{ ...mutedTextStyle, fontSize: 12 }}>
        Combined reads included wallets as one visible collection set. Individual reads isolate one wallet.
      </p>
    </div>
  );
}

function buildWalletRead(profile: WalletReadResponse): WalletReadCopy {
  const subject = profile.walletCount && profile.walletCount > 1 ? "This wallet set" : "This wallet";
  const signalPhrases = profile.tasteSignals
    .slice()
    .sort((a, b) => b.nftCount - a.nftCount)
    .map((signal) => READ_LABELS[signal.label] ?? signal.label.toLowerCase())
    .filter((label) => label !== "visible collection clusters")
    .slice(0, 3);

  const proofCollections = profile.topCollections
    .slice()
    .sort((a, b) => b.count - a.count)
    .map((collection) => collection.name)
    .filter(Boolean)
    .slice(0, 5);

  const fallbackCollections = proofCollections.slice(0, 3);
  const hasMoreCollections = profile.collectionCount > proofCollections.length;

  let headline: string;
  if (signalPhrases.length > 1) {
    headline = `${subject} reads like a collection pattern around ${formatList(signalPhrases)}.`;
  } else if (signalPhrases.length === 1) {
    headline = `${subject} leans toward ${signalPhrases[0]}.`;
  } else if (fallbackCollections.length > 1) {
    headline = `${subject} appears clustered around ${formatList(fallbackCollections)}.`;
  } else if (fallbackCollections.length === 1) {
    headline = `${subject} appears centered on ${fallbackCollections[0]}.`;
  } else {
    headline = `${subject} has a sparse visible collection pattern.`;
  }

  const body =
    proofCollections.length > 0
      ? `The clearest proof is the repetition across ${formatList(proofCollections)}${
          hasMoreCollections ? ", and other visible collection clusters" : ""
        }.`
      : "There is not enough visible collection data to make a more specific read yet.";

  return { headline, body };
}

function formatList(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

function WalletReadSummary({ profile }: { profile: WalletReadResponse }) {
  const read = buildWalletRead(profile);

  return (
    <>
      <p style={eyebrowStyle}>The Read</p>
      <h2 style={panelTitleStyle}>{read.headline}</h2>
      <p style={mutedTextStyle}>{read.body}</p>
    </>
  );
}

function WalletHeader({
  profile,
  readLabel,
  walletSet,
  activeView,
}: {
  profile: WalletReadResponse;
  readLabel: string;
  walletSet: string[];
  activeView: ActiveWalletView;
}) {
  const isCappedRead = profile.debug
    ? !profile.debug.complete || profile.debug.stoppedReason === "max_reached"
    : false;
  const maxVisibleNfts = profile.debug?.maxVisibleNfts.toLocaleString() ?? "1,000";
  const supportedChainNote = profile.debug?.chainsChecked.length
    ? `Across supported chains: ${profile.debug.chainsChecked.join(", ")}.`
    : "Across supported chains.";
  const walletCount = profile.walletCount ?? 1;
  const walletLine = walletCount > 1 ? (profile.shortWallets ?? [profile.shortWallet]).join(", ") : profile.shortWallet;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ minWidth: 0 }}>
          <p style={eyebrowStyle}>{readLabel}</p>
          <h2 style={{ ...panelTitleStyle, fontFamily: "var(--font-geist-mono)" }}>{walletLine}</h2>
          <p style={{ ...mutedTextStyle, fontSize: 12, wordBreak: "break-all" }}>
            {readDetailForView(profile, walletSet, activeView)}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Metric label="JPGs read" value={profile.nftCount} />
          <Metric label="Collections" value={profile.collectionCount} />
        </div>
      </div>
      <p style={{ ...mutedTextStyle, fontSize: 12 }}>{supportedChainNote}</p>
      {profile.dedupe && profile.dedupe.duplicateNftCount > 0 && (
        <p style={{ ...mutedTextStyle, fontSize: 12 }}>
          Duplicate NFTs across included wallets were counted once.
        </p>
      )}
      {isCappedRead && (
        <p style={{ ...mutedTextStyle, fontSize: 12 }}>
          This read is based on the first {maxVisibleNfts} visible NFTs returned by the current source.
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: 108, border: "1px solid var(--jpgs-border)", borderRadius: 8, padding: "12px 14px" }}>
      <p style={{ color: "var(--jpgs-muted)", fontSize: 11, marginBottom: 6 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 500 }}>{value}</p>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--jpgs-surface)", border: "1px solid var(--jpgs-border)", borderRadius: 8, padding: 22 }}>
      {children}
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", marginBottom: 14 }}>
      <h2 style={panelTitleStyle}>{title}</h2>
      <p style={{ color: "var(--jpgs-muted)", fontSize: 12 }}>{detail}</p>
    </div>
  );
}

function CollectionImage({ collection }: { collection: TopCollection }) {
  if (!collection.imageUrl) {
    return (
      <div style={imageFallbackStyle} aria-hidden="true">
        {collection.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={collection.imageUrl}
      alt=""
      style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}
    />
  );
}

const eyebrowStyle: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "var(--jpgs-accent)",
  marginBottom: 10,
};

const panelTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 400,
  lineHeight: 1.25,
  marginBottom: 8,
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 14,
  lineHeight: 1.65,
};

const imageFallbackStyle: React.CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 8,
  display: "grid",
  placeItems: "center",
  background: "rgba(149,117,255,0.14)",
  color: "var(--jpgs-accent)",
  fontSize: 13,
};
