"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { WalletSearchInput, walletSuggestionValue, type WalletSuggestion } from "@/components/WalletSearchInput";

type CompareRelationshipLabel =
  | "Strong shared signal"
  | "Clear overlap"
  | "Adjacent taste"
  | "Light visible overlap";

type CompareWalletSummary = {
  address: string;
  input?: string;
  displayName?: string | null;
  username?: string | null;
  ens?: string | null;
  avatarUrl?: string | null;
  openSeaUrl?: string | null;
  visibleNftCount: number;
  collectionCount: number;
  topCollections: Array<{
    slug?: string | null;
    name: string;
    imageUrl?: string | null;
    heldCount: number;
    openSeaUrl?: string | null;
  }>;
  tasteSignals: Array<{
    label: string;
    count: number;
    exampleCollections: string[];
  }>;
};

type CompareSharedCollection = {
  key: string;
  slug?: string | null;
  name: string;
  imageUrl?: string | null;
  openSeaUrl?: string | null;
  walletAHeldCount: number;
  walletBHeldCount: number;
  combinedHeldCount: number;
  strengthLabel?: string;
  walletANfts: CompareSharedCollectionNft[];
  walletBNfts: CompareSharedCollectionNft[];
  walletAEnteredMonth: string | null;
  walletBEnteredMonth: string | null;
};

type CompareSharedCollectionNft = {
  key: string;
  name?: string | null;
  imageUrl?: string | null;
  openSeaUrl?: string | null;
  contractAddress?: string | null;
  tokenId?: string | null;
  quantity?: number;
};

type CompareTasteOverlap = {
  label: string;
  walletACount: number;
  walletBCount: number;
  combinedCount: number;
  exampleCollections: string[];
};

type CompareDifferenceSignal = {
  label: string;
  count: number;
  exampleCollections: string[];
};

type CompareResponse = {
  walletA: CompareWalletSummary;
  walletB: CompareWalletSummary;
  relationship: {
    label: CompareRelationshipLabel;
    headline: string;
    summary: string;
    proofPoints: string[];
    confidence?: "low" | "medium" | "high";
  };
  sharedCollections: CompareSharedCollection[];
  tasteOverlap: CompareTasteOverlap[];
  differences: {
    walletAOnly: CompareDifferenceSignal[];
    walletBOnly: CompareDifferenceSignal[];
  };
};

type CompareErrorResponse = {
  error?: string;
};

type CompareState = "idle" | "loading" | "success" | "error";

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

const compareInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--jpgs-surface-2)",
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "14px 15px",
  color: "var(--jpgs-text)",
  fontSize: 14,
  outlineColor: "var(--jpgs-accent)",
};

export default function ComparePage() {
  const [walletAInput, setWalletAInput] = useState("");
  const [walletBInput, setWalletBInput] = useState("");
  const [walletAResolved, setWalletAResolved] = useState("");
  const [walletBResolved, setWalletBResolved] = useState("");
  const [state, setState] = useState<CompareState>("idle");
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [error, setError] = useState("");
  const requestSeq = useRef(0);
  const hydratedFromUrl = useRef(false);

  async function compareWallets(
    nextWalletA: string,
    nextWalletB: string,
    options: { syncUrl?: boolean; displayWalletA?: string; displayWalletB?: string } = {},
  ) {
    const walletA = nextWalletA.trim();
    const walletB = nextWalletB.trim();

    if (!walletA || !walletB) {
      setState("error");
      setResult(null);
      setError("Enter two wallets to compare visible overlap.");
      return;
    }

    const requestId = requestSeq.current + 1;
    requestSeq.current = requestId;
    setState("loading");
    setResult(null);
    setError("");

    if (options.syncUrl !== false) updateCompareUrl(walletA, walletB);

    try {
      const params = new URLSearchParams({ walletA, walletB });
      const response = await fetch(`/api/compare?${params.toString()}`);
      const data = (await response.json()) as CompareResponse | CompareErrorResponse;

      if (requestSeq.current !== requestId) return;

      if (!response.ok || !isCompareResponse(data)) {
        setState("error");
        setResult(null);
        setError(errorMessageForStatus(response.status));
        return;
      }

      setState("success");
      setResult(data);
      setWalletAInput(options.displayWalletA?.trim() || walletA);
      setWalletBInput(options.displayWalletB?.trim() || walletB);
      setWalletAResolved(data.walletA.address);
      setWalletBResolved(data.walletB.address);
    } catch {
      if (requestSeq.current !== requestId) return;
      setState("error");
      setResult(null);
      setError("The compare read could not be reached. Try the wallets again in a moment.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void compareWallets(walletAResolved || walletAInput, walletBResolved || walletBInput, {
      displayWalletA: walletAInput,
      displayWalletB: walletBInput,
    });
  }

  function handleWalletAChange(value: string) {
    setWalletAInput(value);
    setWalletAResolved("");
  }

  function handleWalletBChange(value: string) {
    setWalletBInput(value);
    setWalletBResolved("");
  }

  function selectWalletA(suggestion: WalletSuggestion) {
    setWalletAInput(walletSuggestionValue(suggestion));
    setWalletAResolved(suggestion.address ?? "");
  }

  function selectWalletB(suggestion: WalletSuggestion) {
    setWalletBInput(walletSuggestionValue(suggestion));
    setWalletBResolved(suggestion.address ?? "");
  }

  useEffect(() => {
    if (hydratedFromUrl.current) return;
    hydratedFromUrl.current = true;

    const params = new URLSearchParams(window.location.search);
    const walletA = params.get("walletA")?.trim() ?? "";
    const walletB = params.get("walletB")?.trim() ?? "";

    setWalletAInput(walletA);
    setWalletBInput(walletB);
    setWalletAResolved("");
    setWalletBResolved("");

    if (walletA && walletB) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void compareWallets(walletA, walletB, { syncUrl: false });
    }
  }, []);

  const isLoading = state === "loading";

  return (
    <main style={pageStyle}>
      <section style={heroStyle}>
        <div style={heroGridStyle}>
          <div>
            <p style={eyebrowStyle}>Compare</p>
            <h1 style={heroTitleStyle}>What do two collectors have in common?</h1>
            <p style={heroCopyStyle}>
              Enter two wallets, ENS names, or OpenSea profiles to see where their collections overlap.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={formStyle}>
            <div style={inputGridStyle}>
              <WalletSearchInput
                value={walletAInput}
                onChange={handleWalletAChange}
                onSelect={selectWalletA}
                selectedAddress={walletAResolved}
                label="Wallet A"
                placeholder="ENS, address, or OpenSea profile"
                ariaLabel="Wallet A"
                fieldStyle={fieldStyle}
                labelStyle={labelStyle}
                inputStyle={compareInputStyle}
              />
              <WalletSearchInput
                value={walletBInput}
                onChange={handleWalletBChange}
                onSelect={selectWalletB}
                selectedAddress={walletBResolved}
                label="Wallet B"
                placeholder="ENS, address, or OpenSea profile"
                ariaLabel="Wallet B"
                fieldStyle={fieldStyle}
                labelStyle={labelStyle}
                inputStyle={compareInputStyle}
              />
            </div>
            <button type="submit" disabled={isLoading} style={primaryButtonStyle(isLoading)}>
              {isLoading ? "Reading wallets" : "Compare wallets"}
            </button>
          </form>
        </div>
      </section>

      <section style={bodyStyle}>
        {state === "idle" && (
          <StatePanel
            label="Ready"
            title="Start with two wallets."
            body="Paste any ENS, address, or OpenSea profile to get started."
          />
        )}

        {state === "loading" && (
          <StatePanel
            label="READING"
            title="Looking for shared collections."
            body="Checking both wallets for public NFTs, collection overlap, and a few taste patterns."
          />
        )}

        {state === "error" && (
          <StatePanel
            label="Not read"
            title="The compare read could not be built."
            body={error}
            tone="error"
          />
        )}

        {state === "success" && result && (
          <div style={resultStackStyle}>
            <section style={walletPairStyle}>
              <WalletSummaryCard label="Wallet A" wallet={result.walletA} />
              <WalletSummaryCard label="Wallet B" wallet={result.walletB} />
            </section>

            <SharedCollectionsSection
              collections={result.sharedCollections}
              walletA={result.walletA}
              walletB={result.walletB}
            />

            <TasteOverlapSection overlap={result.tasteOverlap} walletA={result.walletA} walletB={result.walletB} />
          </div>
        )}
      </section>
    </main>
  );
}

function isCompareResponse(data: CompareResponse | CompareErrorResponse): data is CompareResponse {
  return (
    "walletA" in data &&
    "walletB" in data &&
    "relationship" in data &&
    Array.isArray(data.sharedCollections) &&
    Array.isArray(data.tasteOverlap) &&
    typeof data.differences === "object" &&
    Array.isArray(data.differences.walletAOnly) &&
    Array.isArray(data.differences.walletBOnly)
  );
}

function errorMessageForStatus(status: number): string {
  if (status === 400) return "Enter both wallet inputs before starting the compare read.";
  if (status === 422) return "One of those wallet inputs could not be resolved as a supported public wallet.";
  if (status === 502) return "Visible NFT holdings could not be fetched right now.";
  return "The compare read could not be built right now.";
}

function updateCompareUrl(walletA: string, walletB: string) {
  const params = new URLSearchParams({ walletA, walletB });
  window.history.replaceState(null, "", `/compare?${params.toString()}`);
}

function walletTitle(wallet: CompareWalletSummary): string {
  return wallet.displayName || wallet.ens || wallet.username || shortWallet(wallet.address);
}

function walletSubtitle(wallet: CompareWalletSummary): string {
  const proof = shortWallet(wallet.address);
  const handle = wallet.ens || wallet.username;
  return handle && proof ? `${handle} · ${proof}` : handle || proof;
}

function shortWallet(address?: string | null): string {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatCount(count: number): string {
  return NUMBER_FORMATTER.format(count);
}

function domSafeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-");
}

function initialsFor(value: string): string {
  return value
    .replace(/^0x/i, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "JP";
}

function StatePanel({
  label,
  title,
  body,
  tone = "default",
}: {
  label: string;
  title: string;
  body: string;
  tone?: "default" | "error";
}) {
  return (
    <section style={statePanelStyle}>
      <p style={{ ...eyebrowStyle, color: tone === "error" ? "rgb(255, 138, 128)" : "var(--jpgs-accent)" }}>
        {label}
      </p>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <p style={mutedTextStyle}>{body}</p>
    </section>
  );
}

function WalletSummaryCard({
  label,
  wallet,
}: {
  label: "Wallet A" | "Wallet B";
  wallet: CompareWalletSummary;
}) {
  const title = walletTitle(wallet);
  const subtitle = walletSubtitle(wallet);

  return (
    <article style={walletCardStyle}>
      <div style={walletIdentityRowStyle}>
        <WalletAvatar wallet={wallet} title={title} />
        <div style={{ minWidth: 0 }}>
          <p style={eyebrowStyle}>{label}</p>
          {wallet.openSeaUrl ? (
            <a href={wallet.openSeaUrl} target="_blank" rel="noreferrer" style={walletTitleLinkStyle}>
              {title}
            </a>
          ) : (
            <h2 style={walletTitleStyle}>{title}</h2>
          )}
          <p style={walletProofStyle}>{subtitle}</p>
        </div>
      </div>

      <div style={metricRowStyle}>
        <Metric label="JPGs read" value={wallet.visibleNftCount} />
        <Metric label="Collections" value={wallet.collectionCount} />
      </div>

      {wallet.topCollections.length > 0 && (
        <div style={compactCollectionListStyle}>
          {wallet.topCollections.slice(0, 3).map((collection) => (
            <div key={`${wallet.address}-${collection.slug ?? collection.name}`} style={compactCollectionStyle}>
              <CollectionThumb collection={collection} size={34} />
              <span style={compactCollectionNameStyle}>{collection.name}</span>
              <span style={compactCollectionCountStyle}>{formatCount(collection.heldCount)}</span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function WalletAvatar({ wallet, title }: { wallet: CompareWalletSummary; title: string }) {
  if (wallet.avatarUrl) {
    return (
      <img
        src={wallet.avatarUrl}
        alt=""
        width={74}
        height={74}
        style={walletAvatarStyle}
      />
    );
  }

  return (
    <span style={walletAvatarFallbackStyle} aria-hidden="true">
      {initialsFor(title)}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={metricStyle}>
      <p style={metricLabelStyle}>{label}</p>
      <p style={metricValueStyle}>{formatCount(value)}</p>
    </div>
  );
}

function RelationshipRead({ result }: { result: CompareResponse }) {
  return (
    <section style={readSectionStyle}>
      <div style={readLabelRowStyle}>
        <span style={relationshipBadgeStyle(result.relationship.label)}>{result.relationship.label}</span>
        {result.relationship.confidence && (
          <span style={confidenceStyle}>{result.relationship.confidence} confidence</span>
        )}
      </div>
      <h2 style={readTitleStyle}>{result.relationship.headline}</h2>
      <p style={readSummaryStyle}>{result.relationship.summary}</p>
      {result.relationship.proofPoints.length > 0 && (
        <div style={proofPointGridStyle}>
          {result.relationship.proofPoints.map((proofPoint) => (
            <ProofPoint key={proofPoint} proofPoint={proofPoint} />
          ))}
        </div>
      )}
    </section>
  );
}

function SharedCollectionsSection({
  collections,
  walletA,
  walletB,
}: {
  collections: CompareSharedCollection[];
  walletA: CompareWalletSummary;
  walletB: CompareWalletSummary;
}) {
  const [expandedCollectionKey, setExpandedCollectionKey] = useState<string | null>(null);
  const [prevCollections, setPrevCollections] = useState(collections);
  if (prevCollections !== collections) {
    setPrevCollections(collections);
    setExpandedCollectionKey(null);
  }
  const walletAName = walletTitle(walletA);
  const walletBName = walletTitle(walletB);

  return (
    <section style={sectionStyle}>
      <SectionHeading
        title="Shared collections"
        detail={collections.length > 0 ? `${collections.length} visible anchors` : "No shared collection anchors found"}
      />
      {collections.length === 0 ? (
        <EmptySectionCopy>
          These wallets do not visibly meet around shared collection anchors yet. The category read can still point to nearby or different parts of the JPG map.
        </EmptySectionCopy>
      ) : (
        <div style={sharedCollectionGridStyle}>
          {collections.map((collection) => (
            <SharedCollectionCard
              key={collection.key}
              collection={collection}
              walletAName={walletAName}
              walletBName={walletBName}
              isExpanded={expandedCollectionKey === collection.key}
              onToggle={() =>
                setExpandedCollectionKey((currentKey) => (currentKey === collection.key ? null : collection.key))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SharedCollectionCard({
  collection,
  walletAName,
  walletBName,
  isExpanded,
  onToggle,
}: {
  collection: CompareSharedCollection;
  walletAName: string;
  walletBName: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const panelId = `shared-pieces-${domSafeId(collection.key)}`;

  return (
    <article style={sharedCollectionCardStyle}>
      <div style={sharedCollectionSummaryStyle}>
        <CollectionThumb collection={collection} size={82} />
        <div style={sharedCollectionBodyStyle}>
          <div style={sharedCardHeaderStyle}>
            <div style={{ minWidth: 0 }}>
              <h3 style={sharedCollectionTitleStyle}>{collection.name}</h3>
              <p style={sharedCollectionMetaStyle}>
                {formatCount(collection.combinedHeldCount)} visible pieces held together
              </p>
            </div>
            {collection.openSeaUrl && (
              <a href={collection.openSeaUrl} target="_blank" rel="noreferrer" style={openSeaLinkStyle}>
                OpenSea
              </a>
            )}
          </div>

          <div style={sharedDepthGridStyle}>
            <SharedWalletDepth
              walletName={walletAName}
              heldCount={collection.walletAHeldCount}
              enteredMonth={collection.walletAEnteredMonth}
            />
            <SharedWalletDepth
              walletName={walletBName}
              heldCount={collection.walletBHeldCount}
              enteredMonth={collection.walletBEnteredMonth}
            />
          </div>

          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={panelId}
            onClick={onToggle}
            style={revealButtonStyle}
          >
            {isExpanded ? "Hide pieces" : "Reveal pieces"}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div id={panelId} style={sharedRevealStyle}>
          <SharedNftColumn
            walletName={walletAName}
            heldCount={collection.walletAHeldCount}
            nfts={collection.walletANfts}
          />
          <SharedNftColumn
            walletName={walletBName}
            heldCount={collection.walletBHeldCount}
            nfts={collection.walletBNfts}
          />
        </div>
      )}
    </article>
  );
}

function SharedWalletDepth({
  walletName,
  heldCount,
  enteredMonth,
}: {
  walletName: string;
  heldCount: number;
  enteredMonth: string | null;
}) {
  return (
    <div style={sharedWalletDepthStyle}>
      <span style={sharedWalletNameStyle}>{walletName}</span>
      <span style={sharedHeldCountStyle}>{formatCount(heldCount)} held</span>
      {enteredMonth && <span style={sharedSinceStyle}>Since {enteredMonth}</span>}
    </div>
  );
}

function SharedNftColumn({
  walletName,
  heldCount,
  nfts,
}: {
  walletName: string;
  heldCount: number;
  nfts: CompareSharedCollectionNft[];
}) {
  const moreHeldCount = Math.max(heldCount - nfts.length, 0);
  const countContext =
    moreHeldCount > 0
      ? `${formatCount(nfts.length)} shown · ${formatCount(heldCount)} held`
      : `${formatCount(heldCount)} held`;

  return (
    <div style={sharedNftColumnStyle}>
      <div style={sharedNftColumnHeaderStyle}>
        <h4 style={sharedNftColumnTitleStyle}>{walletName}</h4>
        <span style={sharedNftColumnCountStyle}>{countContext}</span>
      </div>

      {nfts.length > 0 ? (
        <div style={sharedNftGridStyle}>
          {nfts.map((nft) => (
            <SharedNftTile key={nft.key} nft={nft} />
          ))}
        </div>
      ) : (
        <p style={sharedNftEmptyStyle}>No preview pieces returned.</p>
      )}

      {moreHeldCount > 0 && <p style={moreHeldStyle}>+ {formatCount(moreHeldCount)} more held</p>}
    </div>
  );
}

function SharedNftTile({ nft }: { nft: CompareSharedCollectionNft }) {
  const name = nft.name || "Visible piece";

  return (
    <div style={sharedNftRowStyle}>
      <NftThumb nft={nft} name={name} />
      <span style={sharedNftNameStyle}>{name}</span>
      {nft.openSeaUrl && (
        <a href={nft.openSeaUrl} target="_blank" rel="noreferrer" style={sharedNftOpenSeaStyle}>
          OpenSea
        </a>
      )}
    </div>
  );
}

function NftThumb({ nft, name }: { nft: CompareSharedCollectionNft; name: string }) {
  if (nft.imageUrl) {
    return (
      <img
        src={nft.imageUrl}
        alt=""
        width={54}
        height={54}
        loading="lazy"
        style={sharedNftImageStyle}
      />
    );
  }

  return (
    <span style={sharedNftFallbackStyle} aria-hidden="true">
      {initialsFor(name)}
    </span>
  );
}

function TasteOverlapSection({
  overlap,
  walletA,
  walletB,
}: {
  overlap: CompareTasteOverlap[];
  walletA: CompareWalletSummary;
  walletB: CompareWalletSummary;
}) {
  const nameA = walletTitle(walletA);
  const nameB = walletTitle(walletB);
  return (
    <section style={sectionStyle}>
      <SectionHeading
        title="Taste overlap"
        detail={overlap.length > 0 ? `${overlap.length} shared signal areas` : "No shared categories found"}
      />
      {overlap.length === 0 ? (
        <EmptySectionCopy>
          The category layer does not show much visible overlap yet. That can still be useful: the wallets may be bringing different objects into view.
        </EmptySectionCopy>
      ) : (
        <div style={signalGridStyle}>
          {overlap.map((signal) => (
            <SignalRow
              key={signal.label}
              signal={signal}
              nameA={nameA}
              nameB={nameB}
              totalA={walletA.visibleNftCount}
              totalB={walletB.visibleNftCount}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function signalLeanTag(nameA: string, nameB: string, pctA: number, pctB: number): string {
  const diff = Math.abs(pctA - pctB);
  if (diff < 4) return "Shared lean";
  if (pctA > 10 && pctB > 10) return "Strong overlap";
  return `${pctA > pctB ? nameA : nameB} leans heavier`;
}

function SignalRow({
  signal,
  nameA,
  nameB,
  totalA,
  totalB,
}: {
  signal: CompareTasteOverlap;
  nameA: string;
  nameB: string;
  totalA: number;
  totalB: number;
}) {
  const pctA = totalA > 0 ? (signal.walletACount / totalA) * 100 : 0;
  const pctB = totalB > 0 ? (signal.walletBCount / totalB) * 100 : 0;
  const tag = signalLeanTag(nameA, nameB, pctA, pctB);

  return (
    <article style={signalRowStyle}>
      <div style={signalCardHeaderStyle}>
        <h3 style={cardTitleStyle}>{signal.label}</h3>
        <span style={signalLeanTagStyle}>{tag}</span>
      </div>
      {signal.exampleCollections.length > 0 && (
        <p style={exampleLineStyle}>Seen around {signal.exampleCollections.join(", ")}</p>
      )}
      <div style={signalBarGridStyle}>
        <SignalBarRow
          name={nameA}
          count={signal.walletACount}
          pct={pctA}
          total={totalA}
          barColor="rgba(149,117,255,0.75)"
        />
        <SignalBarRow
          name={nameB}
          count={signal.walletBCount}
          pct={pctB}
          total={totalB}
          barColor="rgba(116,190,166,0.75)"
        />
      </div>
    </article>
  );
}

const BAR_SCALE_MAX = 30;

function SignalBarRow({
  name,
  count,
  pct,
  total,
  barColor,
}: {
  name: string;
  count: number;
  pct: number;
  total: number;
  barColor: string;
}) {
  const barWidth = Math.min((pct / BAR_SCALE_MAX) * 100, 100);
  return (
    <div style={signalBarRowStyle}>
      <div style={signalBarHeaderStyle}>
        <span style={signalBarNameStyle}>{name}</span>
        <span style={signalBarStatStyle}>
          {Math.round(pct)}% of wallet · {formatCount(count)} / {formatCount(total)} JPGs
        </span>
      </div>
      <div style={signalBarTrackStyle}>
        <div style={{ ...signalBarFillStyle, width: `${barWidth}%`, background: barColor }} />
      </div>
    </div>
  );
}

function DifferencesSection({
  walletA,
  walletB,
  walletAOnly,
  walletBOnly,
}: {
  walletA: CompareWalletSummary;
  walletB: CompareWalletSummary;
  walletAOnly: CompareDifferenceSignal[];
  walletBOnly: CompareDifferenceSignal[];
}) {
  return (
    <section style={sectionStyle}>
      <SectionHeading title="Different expressions" detail="Mostly unique visible signals" />
      <div style={differenceGridStyle}>
        <DifferenceColumn
          walletName={walletTitle(walletA)}
          title={`${walletTitle(walletA)} brings`}
          signals={walletAOnly}
        />
        <DifferenceColumn
          walletName={walletTitle(walletB)}
          title={`${walletTitle(walletB)} brings`}
          signals={walletBOnly}
        />
      </div>
    </section>
  );
}

function DifferenceColumn({
  walletName,
  title,
  signals,
}: {
  walletName: string;
  title: string;
  signals: CompareDifferenceSignal[];
}) {
  return (
    <div style={differenceColumnStyle}>
      <h3 style={differenceColumnTitleStyle}>{title}</h3>
      {signals.length === 0 ? (
        <div style={differenceEmptyStyle}>
          <p style={mutedTextStyle}>{`${walletName}'s visible signal is mostly shared territory in this read.`}</p>
        </div>
      ) : (
        <div style={differenceListStyle}>
          {signals.map((signal) => (
            <article key={signal.label} style={differenceItemStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <h4 style={cardTitleStyle}>{signal.label}</h4>
                <span style={tinyCountStyle}>{formatCount(signal.count)}</span>
              </div>
              {signal.exampleCollections.length > 0 && (
                <p style={exampleLineStyle}>{signal.exampleCollections.join(", ")}</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ProofPoint({ proofPoint }: { proofPoint: string }) {
  const separatorIndex = proofPoint.indexOf(":");
  const label = separatorIndex > 0 ? proofPoint.slice(0, separatorIndex) : "Visible proof";
  const body = separatorIndex > 0 ? proofPoint.slice(separatorIndex + 1).trim() : proofPoint;

  return (
    <div style={proofPointStyle}>
      <span style={proofPointLabelStyle}>{label}</span>
      <p style={proofPointBodyStyle}>{body}</p>
    </div>
  );
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div style={sectionHeadingStyle}>
      <h2 style={sectionTitleStyle}>{title}</h2>
      <p style={sectionDetailStyle}>{detail}</p>
    </div>
  );
}

function EmptySectionCopy({ children }: { children: React.ReactNode }) {
  return (
    <div style={emptySectionStyle}>
      <p style={mutedTextStyle}>{children}</p>
    </div>
  );
}

function CollectionThumb({
  collection,
  size,
}: {
  collection: { name: string; imageUrl?: string | null };
  size: number;
}) {
  if (collection.imageUrl) {
    return (
      <img
        src={collection.imageUrl}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        style={{ ...collectionImageStyle, width: size, height: size }}
      />
    );
  }

  return (
    <span style={{ ...collectionFallbackStyle, width: size, height: size }} aria-hidden="true">
      {initialsFor(collection.name)}
    </span>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "var(--jpgs-bg)",
  color: "var(--jpgs-text)",
};

const heroStyle: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "72px 24px 32px",
};

const heroGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))",
  gap: "clamp(24px, 5vw, 58px)",
  alignItems: "end",
};

const bodyStyle: React.CSSProperties = {
  maxWidth: 1120,
  margin: "0 auto",
  padding: "0 24px 84px",
};

const heroTitleStyle: React.CSSProperties = {
  maxWidth: 680,
  fontSize: "clamp(38px, 7vw, 76px)",
  fontWeight: 300,
  lineHeight: 0.98,
  letterSpacing: 0,
  marginBottom: 18,
  textWrap: "balance",
};

const heroCopyStyle: React.CSSProperties = {
  maxWidth: 560,
  color: "var(--jpgs-muted)",
  fontSize: 16,
  lineHeight: 1.7,
};

const formStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: 14,
  background: "rgba(255,255,255,0.025)",
};

const inputGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 7,
};

const labelStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 12,
};

function primaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    minHeight: 48,
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 8,
    background: disabled ? "rgba(149,117,255,0.52)" : "var(--jpgs-accent)",
    color: "white",
    fontSize: 14,
    cursor: disabled ? "wait" : "pointer",
  };
}

const statePanelStyle: React.CSSProperties = {
  borderTop: "1px solid var(--jpgs-border)",
  paddingTop: 28,
  maxWidth: 720,
};

const resultStackStyle: React.CSSProperties = {
  display: "grid",
  gap: "clamp(28px, 5vw, 52px)",
};

const walletPairStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 14,
};

const walletCardStyle: React.CSSProperties = {
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  background: "var(--jpgs-surface)",
  padding: "clamp(16px, 3vw, 22px)",
  display: "grid",
  gap: 16,
};

const walletIdentityRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "74px minmax(0, 1fr)",
  gap: 14,
  alignItems: "end",
};

const walletAvatarStyle: React.CSSProperties = {
  width: 74,
  height: 74,
  objectFit: "cover",
  borderRadius: 8,
  background: "rgba(255,255,255,0.05)",
};

const walletAvatarFallbackStyle: React.CSSProperties = {
  ...walletAvatarStyle,
  display: "grid",
  placeItems: "center",
  background: "rgba(149,117,255,0.13)",
  color: "var(--jpgs-accent)",
  fontFamily: "var(--font-geist-mono)",
  fontSize: 18,
};

const walletTitleStyle: React.CSSProperties = {
  color: "var(--jpgs-text)",
  fontSize: 23,
  fontWeight: 400,
  lineHeight: 1.18,
  overflowWrap: "anywhere",
};

const walletTitleLinkStyle: React.CSSProperties = {
  ...walletTitleStyle,
  display: "block",
  textDecoration: "none",
};

const walletProofStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 12,
  lineHeight: 1.45,
  marginTop: 5,
  overflowWrap: "anywhere",
};

const metricRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 10,
};

const metricStyle: React.CSSProperties = {
  minHeight: 74,
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "12px 14px",
  display: "grid",
  alignContent: "center",
};

const metricLabelStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 11,
  marginBottom: 4,
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 500,
};

const compactCollectionListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const compactCollectionStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "34px minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
};

const compactCollectionNameStyle: React.CSSProperties = {
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--jpgs-muted)",
  fontSize: 12,
};

const compactCollectionCountStyle: React.CSSProperties = {
  color: "rgba(168,164,157,0.62)",
  fontFamily: "var(--font-geist-mono)",
  fontSize: 11,
};

const readSectionStyle: React.CSSProperties = {
  padding: "clamp(26px, 5vw, 44px)",
  borderRadius: 8,
  background: "rgb(21,21,21)",
  border: "1px solid var(--jpgs-border)",
};

const readLabelRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 16,
};

function relationshipBadgeStyle(label: CompareRelationshipLabel): React.CSSProperties {
  const colors: Record<CompareRelationshipLabel, string> = {
    "Strong shared signal": "rgba(149,117,255,0.24)",
    "Clear overlap": "rgba(116,190,166,0.18)",
    "Adjacent taste": "rgba(235,197,109,0.18)",
    "Light visible overlap": "rgba(255,255,255,0.08)",
  };

  return {
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 999,
    padding: "6px 10px",
    background: colors[label],
    color: "var(--jpgs-text)",
    fontSize: 12,
  };
}

const confidenceStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 12,
};

const readTitleStyle: React.CSSProperties = {
  maxWidth: 820,
  fontSize: "clamp(28px, 4.8vw, 48px)",
  fontWeight: 300,
  lineHeight: 1.08,
  letterSpacing: 0,
  marginBottom: 16,
  textWrap: "balance",
};

const readSummaryStyle: React.CSSProperties = {
  maxWidth: 780,
  color: "var(--jpgs-muted)",
  fontSize: 16,
  lineHeight: 1.72,
};

const proofPointGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))",
  gap: 10,
  marginTop: 22,
};

const proofPointStyle: React.CSSProperties = {
  minHeight: 58,
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8,
  padding: "11px 13px 12px",
  color: "var(--jpgs-text)",
  background: "rgba(255,255,255,0.018)",
};

const proofPointLabelStyle: React.CSSProperties = {
  display: "block",
  color: "var(--jpgs-muted)",
  fontSize: 10,
  lineHeight: 1.2,
  marginBottom: 5,
  textTransform: "uppercase",
};

const proofPointBodyStyle: React.CSSProperties = {
  color: "var(--jpgs-text)",
  fontSize: 13,
  lineHeight: 1.45,
  overflowWrap: "anywhere",
};

const sectionStyle: React.CSSProperties = {
  borderTop: "1px solid var(--jpgs-border)",
  paddingTop: "clamp(22px, 4vw, 32px)",
};

const sectionHeadingStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: "8px 16px",
  flexWrap: "wrap",
  marginBottom: 16,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 400,
  lineHeight: 1.22,
};

const sectionDetailStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 12,
};

const sharedCollectionGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 14,
};

const sharedCollectionCardStyle: React.CSSProperties = {
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "clamp(16px, 3vw, 22px)",
  background: "rgba(255,255,255,0.022)",
  display: "grid",
  gap: 18,
};

const sharedCollectionSummaryStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "82px minmax(0, 1fr)",
  gap: 18,
  alignItems: "start",
};

const sharedCollectionBodyStyle: React.CSSProperties = {
  minWidth: 0,
  display: "grid",
  gap: 14,
};

const sharedCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
  alignItems: "start",
};

const sharedCollectionTitleStyle: React.CSSProperties = {
  color: "var(--jpgs-text)",
  fontSize: "clamp(17px, 2vw, 22px)",
  fontWeight: 400,
  lineHeight: 1.18,
  overflowWrap: "anywhere",
  textWrap: "balance",
};

const sharedCollectionMetaStyle: React.CSSProperties = {
  color: "rgba(168,164,157,0.72)",
  fontSize: 12,
  lineHeight: 1.45,
  marginTop: 6,
};

const cardTitleStyle: React.CSSProperties = {
  color: "var(--jpgs-text)",
  fontSize: 15,
  fontWeight: 500,
  lineHeight: 1.35,
  overflowWrap: "anywhere",
};

const openSeaLinkStyle: React.CSSProperties = {
  flex: "0 0 auto",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 999,
  padding: "6px 9px",
  color: "var(--jpgs-muted)",
  textDecoration: "none",
  fontSize: 11,
  lineHeight: 1.2,
};

const sharedDepthGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
  gap: 10,
};

const sharedWalletDepthStyle: React.CSSProperties = {
  minWidth: 0,
  minHeight: 86,
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 8,
  padding: "12px 13px",
  background: "rgba(255,255,255,0.018)",
  display: "grid",
  alignContent: "center",
};

const sharedWalletNameStyle: React.CSSProperties = {
  display: "block",
  color: "var(--jpgs-muted)",
  fontSize: 12,
  lineHeight: 1.3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sharedHeldCountStyle: React.CSSProperties = {
  display: "block",
  color: "var(--jpgs-text)",
  fontFamily: "var(--font-geist-mono)",
  fontSize: 18,
  lineHeight: 1.25,
  marginTop: 6,
};

const sharedSinceStyle: React.CSSProperties = {
  display: "inline-flex",
  justifySelf: "start",
  color: "rgba(149,117,255,0.9)",
  fontSize: 11,
  lineHeight: 1.35,
  marginTop: 7,
  background: "rgba(149,117,255,0.1)",
  border: "1px solid rgba(149,117,255,0.2)",
  borderRadius: 999,
  padding: "2px 7px",
};

const revealButtonStyle: React.CSSProperties = {
  justifySelf: "start",
  minHeight: 34,
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 999,
  padding: "7px 11px",
  background: "rgba(255,255,255,0.03)",
  color: "var(--jpgs-text)",
  fontSize: 12,
  cursor: "pointer",
  touchAction: "manipulation",
};

const sharedRevealStyle: React.CSSProperties = {
  borderTop: "1px solid rgba(255,255,255,0.06)",
  paddingTop: 18,
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
  gap: 16,
};

const sharedNftColumnStyle: React.CSSProperties = {
  minWidth: 0,
  border: "1px solid rgba(255,255,255,0.055)",
  borderRadius: 8,
  padding: 12,
  background: "rgba(255,255,255,0.01)",
  display: "grid",
  alignContent: "start",
  gap: 10,
};

const sharedNftColumnHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 10,
  paddingBottom: 2,
};

const sharedNftColumnTitleStyle: React.CSSProperties = {
  minWidth: 0,
  color: "var(--jpgs-text)",
  fontSize: 15,
  fontWeight: 400,
  lineHeight: 1.35,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const sharedNftColumnCountStyle: React.CSSProperties = {
  flex: "0 0 auto",
  color: "rgba(168,164,157,0.7)",
  fontFamily: "var(--font-geist-mono)",
  fontSize: 11,
};

const sharedNftGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 8,
};

const sharedNftRowStyle: React.CSSProperties = {
  minWidth: 0,
  border: "1px solid rgba(255,255,255,0.055)",
  borderRadius: 8,
  padding: "8px 9px",
  background: "rgba(255,255,255,0.014)",
  display: "grid",
  gridTemplateColumns: "54px minmax(0, 1fr) auto",
  gap: 10,
  alignItems: "center",
};

const sharedNftImageStyle: React.CSSProperties = {
  width: 54,
  height: 54,
  objectFit: "cover",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
};

const sharedNftFallbackStyle: React.CSSProperties = {
  ...sharedNftImageStyle,
  display: "grid",
  placeItems: "center",
  background: "rgba(149,117,255,0.13)",
  color: "var(--jpgs-accent)",
  fontFamily: "var(--font-geist-mono)",
  fontSize: 10,
};

const sharedNftNameStyle: React.CSSProperties = {
  minWidth: 0,
  color: "rgba(238,235,229,0.88)",
  fontSize: 13,
  lineHeight: 1.35,
  overflow: "hidden",
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
};

const sharedNftOpenSeaStyle: React.CSSProperties = {
  flex: "0 0 auto",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 999,
  padding: "5px 7px",
  color: "var(--jpgs-muted)",
  textDecoration: "none",
  fontSize: 10,
  lineHeight: 1.2,
};

const sharedNftEmptyStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.045)",
  borderRadius: 8,
  padding: "12px 13px",
  color: "var(--jpgs-muted)",
  fontSize: 12,
  lineHeight: 1.45,
  background: "rgba(255,255,255,0.01)",
};

const moreHeldStyle: React.CSSProperties = {
  color: "rgba(168,164,157,0.72)",
  fontSize: 12,
  lineHeight: 1.4,
};

const signalGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const signalRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 12,
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "16px 18px",
  background: "rgba(255,255,255,0.018)",
};

const signalCardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const signalLeanTagStyle: React.CSSProperties = {
  flex: "0 0 auto",
  border: "1px solid rgba(255,255,255,0.09)",
  borderRadius: 999,
  padding: "4px 10px",
  background: "rgba(255,255,255,0.05)",
  color: "rgba(238,235,229,0.72)",
  fontSize: 11,
  whiteSpace: "nowrap",
};

const signalBarGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  marginTop: 4,
};

const signalBarRowStyle: React.CSSProperties = {
  display: "grid",
  gap: 5,
};

const signalBarHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 8,
};

const signalBarNameStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 12,
  flexShrink: 0,
};

const signalBarStatStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 11,
  fontFamily: "var(--font-geist-mono)",
  textAlign: "right",
};

const signalBarTrackStyle: React.CSSProperties = {
  height: 4,
  borderRadius: 99,
  background: "rgba(255,255,255,0.07)",
  overflow: "hidden",
};

const signalBarFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 99,
  transition: "width 0.3s ease",
};

const exampleLineStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 13,
  lineHeight: 1.55,
  marginTop: 5,
};

const differenceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
  gap: 14,
};

const differenceColumnStyle: React.CSSProperties = {
  display: "grid",
  alignContent: "start",
  gap: 12,
};

const differenceColumnTitleStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 13,
  fontWeight: 400,
  lineHeight: 1.45,
  overflowWrap: "anywhere",
};

const differenceListStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const differenceItemStyle: React.CSSProperties = {
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "14px 15px",
  background: "rgba(255,255,255,0.018)",
};

const differenceEmptyStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 8,
  padding: "14px 15px",
  background: "rgba(255,255,255,0.012)",
};

const tinyCountStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontFamily: "var(--font-geist-mono)",
  fontSize: 12,
};

const emptySectionStyle: React.CSSProperties = {
  border: "1px solid var(--jpgs-border)",
  borderRadius: 8,
  padding: "18px 20px",
  background: "rgba(255,255,255,0.018)",
  maxWidth: 760,
};

const collectionImageStyle: React.CSSProperties = {
  objectFit: "cover",
  borderRadius: 8,
  background: "rgba(255,255,255,0.04)",
};

const collectionFallbackStyle: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  borderRadius: 8,
  background: "rgba(149,117,255,0.13)",
  color: "var(--jpgs-accent)",
  fontFamily: "var(--font-geist-mono)",
  fontSize: 11,
};

const mutedTextStyle: React.CSSProperties = {
  color: "var(--jpgs-muted)",
  fontSize: 14,
  lineHeight: 1.65,
};

const eyebrowStyle: React.CSSProperties = {
  color: "var(--jpgs-accent)",
  fontSize: 11,
  letterSpacing: "0.16em",
  lineHeight: 1.3,
  marginBottom: 9,
  textTransform: "uppercase",
};
