"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { BrandLockup } from "@/components/BrandLockup";
import { looksInstitutionalCollector } from "@/lib/jpgs/institutionalWallets";

type CollectionRef = {
  slug: string;
  name: string;
  image_url?: string;
  contract?: string;
};

type MatchedCollection = {
  slug: string;
  name: string;
  image_url?: string;
  heldCount: number;
};

type CollectorWallet = {
  address: string;
  wallet?: string;
  shortWallet?: string;
  displayName?: string | null;
  username?: string | null;
  ens?: string | null;
  avatarUrl?: string | null;
  profileImageUrl?: string | null;
  imageUrl?: string | null;
  openseaUsername?: string | null;
  openSeaUrl?: string;
  openseaProfileUrl: string;
  identitySource?: string;
  matchedCollections: MatchedCollection[];
  matchedCollectionCount: number;
  totalHeldFromSelected: number;
  score: number;
  reason: string;
};

type DiscoverResponse = {
  wallets: CollectorWallet[];
  collections: CollectionRef[];
  debug: {
    partial: boolean;
    errors: string[];
  };
};

const CONTRACT_IDENTIFIER_RE = /^(?:[a-z0-9_-]+:)?0x[a-f0-9]{40}$/i;

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatHeldCount(count: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(count);
}

function isRawContractIdentifier(value?: string | null): boolean {
  return CONTRACT_IDENTIFIER_RE.test((value ?? "").trim());
}

function collectionProofLabel(collection: Pick<MatchedCollection, "name" | "slug">): string {
  const name = collection.name?.trim();
  const slug = collection.slug?.trim();

  if (name && !isRawContractIdentifier(name)) return name;
  if (slug && !isRawContractIdentifier(slug)) return slug.replace(/[-_]+/g, " ");
  return name || slug || "Unknown collection";
}

function ResultsInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [wallets, setWallets] = useState<CollectorWallet[]>([]);
  const [collections, setCollections] = useState<CollectionRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partial, setPartial] = useState(false);
  const [noCollections, setNoCollections] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [hideInstitutional, setHideInstitutional] = useState(false);

  useEffect(() => {
    async function run() {
      // Read full collection objects from sessionStorage; fall back to URL slugs
      let cols: CollectionRef[] | null = null;
      try {
        const raw = sessionStorage.getItem("jpgs_selected_collections");
        if (raw) cols = JSON.parse(raw) as CollectionRef[];
      } catch {
        // ignore parse errors — fall through to URL fallback
      }

      if (!cols || cols.length === 0) {
        const slugsParam = params.get("collections") ?? "";
        const slugs = slugsParam.split(",").filter(Boolean);
        if (slugs.length === 0) {
          setNoCollections(true);
          setLoading(false);
          return;
        }
        cols = slugs.map((slug) => ({ slug, name: slug }));
      }

      setCollections(cols);

      try {
        const res = await fetch("/api/jpgs/wallets/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collections: cols }),
        });
        if (!res.ok) throw new Error(`API error ${res.status}`);
        const data = await res.json() as DiscoverResponse;
        setWallets(data.wallets ?? []);
        setPartial(data.debug?.partial ?? false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Discovery failed.");
      } finally {
        setLoading(false);
      }
    }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sourceWallets = wallets;
  const visibleWallets = hideInstitutional
    ? sourceWallets.filter((wallet) => !looksInstitutionalCollector(wallet))
    : sourceWallets;
  const hiddenInstitutionalCount = sourceWallets.length - visibleWallets.length;

  return (
    <>
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "72px 24px 40px" }}>
        <BrandLockup />
        <h1 style={{ fontSize: 28, fontWeight: 300, letterSpacing: "-0.02em", marginBottom: 10 }}>
          Collectors near this taste
        </h1>
        <p style={{ color: "rgb(168,164,157)", fontSize: 14, marginBottom: 24 }}>
          Wallets with visible overlap across your selected collections.
        </p>

        {collections.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 32 }}>
            {collections.map((col) => (
              <div
                key={col.slug}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 999,
                  padding: "5px 10px 5px 6px",
                  fontSize: 12,
                  color: "rgb(240,237,230)",
                }}
              >
                {col.image_url && (
                  // eslint-disable-next-line @next/next-image/no-img-element
                  <img
                    src={col.image_url}
                    alt=""
                    style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover" }}
                  />
                )}
                {col.name}
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => router.push("/jpgs")}
          style={{ fontSize: 12, color: "rgba(168,164,157,0.7)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          ← Refine selection
        </button>
      </section>

      <section style={{ maxWidth: 640, margin: "0 auto", padding: "0 24px 80px" }}>
        {loading && (
          <div style={{
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "48px 32px",
            textAlign: "center",
          }}>
            <div style={{
              width: 24,
              height: 24,
              border: "2px solid rgb(149,117,255)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }} />
            <p style={{ fontSize: 14, color: "rgb(168,164,157)" }}>Finding collectors near this taste…</p>
          </div>
        )}

        {!loading && noCollections && (
          <div style={{
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: "rgb(168,164,157)", marginBottom: 12 }}>Choose a few collections first.</p>
            <button
              onClick={() => router.push("/jpgs")}
              style={{ fontSize: 12, color: "rgb(149,117,255)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ← Back to picker
            </button>
          </div>
        )}

        {!loading && !noCollections && error && (
          <div style={{
            background: "#161616",
            border: "1px solid rgba(255,80,80,0.2)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: "rgba(255,120,120,0.9)" }}>{error}</p>
          </div>
        )}

        {!loading && !noCollections && !error && wallets.length === 0 && (
          <div style={{
            background: "#161616",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}>
            <p style={{ fontSize: 14, color: "rgb(168,164,157)" }}>No strong overlap found yet. Try a broader or more recognizable collection set.</p>
          </div>
        )}

        {!loading && !noCollections && !error && wallets.length > 0 && (
          <>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                color: "rgba(168,164,157,0.72)",
                fontSize: 12,
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={hideInstitutional}
                onChange={(event) => setHideInstitutional(event.target.checked)}
                style={{ accentColor: "rgb(149,117,255)" }}
              />
              Hide institutional wallets
            </label>
            {hiddenInstitutionalCount > 0 && (
              <p style={{ fontSize: 12, color: "rgba(168,164,157,0.5)", marginBottom: 16 }}>
                Hiding {hiddenInstitutionalCount} likely institutional wallets.
              </p>
            )}
            {partial && (
              <p style={{ fontSize: 12, color: "rgba(168,164,157,0.5)", marginBottom: 16 }}>
                Showing the strongest matches found so far.
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {visibleWallets.slice(0, visibleCount).map((wallet) => (
                <CollectorCard key={wallet.address} wallet={wallet} />
              ))}
            </div>
            {visibleWallets.length > visibleCount && (
              <button
                onClick={() => setVisibleCount((c) => c + 20)}
                style={{
                  marginTop: 16,
                  width: "100%",
                  padding: "12px 0",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  fontSize: 13,
                  color: "rgb(168,164,157)",
                  cursor: "pointer",
                }}
              >
                Show more collectors
              </button>
            )}
          </>
        )}
      </section>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}

function CollectorCard({ wallet }: { wallet: CollectorWallet }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const shortWallet = shortAddress(wallet.address);
  const label = wallet.ens || wallet.displayName || wallet.username || shortWallet;
  const username = wallet.username || wallet.openseaUsername;
  const secondaryIdentity = username ? `${username} · ${shortWallet}` : shortWallet;
  const avatarSrc = avatarFailed
    ? null
    : wallet.avatarUrl || wallet.profileImageUrl || wallet.imageUrl || null;
  const profileIdentifier = username || wallet.ens || wallet.address;
  const openSeaUrl =
    wallet.openSeaUrl ||
    wallet.openseaProfileUrl ||
    `https://opensea.io/${profileIdentifier}`;
  const initials = label.replace(/^0x/i, "").slice(0, 2).toUpperCase();
  const collectionLabel = wallet.matchedCollectionCount === 1 ? "collection" : "collections";
  const overlapSummary = `${wallet.matchedCollectionCount} ${collectionLabel} · ${formatHeldCount(wallet.totalHeldFromSelected)} held`;

  return (
    <div style={{
      background: "#161616",
      border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "18px 20px",
      display: "flex",
      gap: 16,
      alignItems: "flex-start",
    }}>
      <a
        href={openSeaUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: "50%",
          overflow: "hidden",
          background: "rgba(149,117,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textDecoration: "none",
        }}
      >
        {avatarSrc ? (
          // eslint-disable-next-line @next/next-image/no-img-element
          <img
            src={avatarSrc}
            alt=""
            onError={() => setAvatarFailed(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ fontSize: 13, color: "rgb(149,117,255)", fontWeight: 500 }}>{initials}</span>
        )}
      </a>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
          <a
            href={openSeaUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "rgb(240,237,230)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            {label}
          </a>
          <span style={{ fontSize: 11, color: "rgba(168,164,157,0.68)", flexShrink: 0, fontWeight: 500 }}>
            {overlapSummary}
          </span>
        </div>

        {secondaryIdentity && (
          <p style={{ fontSize: 11, color: "rgba(168,164,157,0.62)", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {secondaryIdentity}
          </p>
        )}

        <p style={{ fontSize: 12, color: "rgba(168,164,157,0.6)", marginBottom: 12 }}>
          {wallet.reason}
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {wallet.matchedCollections.map((col) => (
            <CollectorProofChip key={col.slug || col.name} collection={col} />
          ))}
        </div>

        <a
          href={openSeaUrl}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-block",
            marginTop: 10,
            fontSize: 11,
            color: "rgba(168,164,157,0.4)",
            textDecoration: "none",
          }}
        >
          View on OpenSea
        </a>
      </div>
    </div>
  );
}

function CollectorProofChip({ collection }: { collection: MatchedCollection }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = imageFailed ? null : collection.image_url;
  const label = collectionProofLabel(collection);
  const hasHeldCount = Number.isFinite(collection.heldCount);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        maxWidth: "100%",
        minWidth: 0,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 999,
        padding: "3px 8px 3px 4px",
        fontSize: 11,
        color: "rgb(168,164,157)",
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next-image/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setImageFailed(true)}
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            objectFit: "cover",
            flexShrink: 0,
            background: "rgba(255,255,255,0.04)",
          }}
        />
      ) : (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            flexShrink: 0,
            background: "rgba(149,117,255,0.2)",
          }}
          aria-hidden="true"
        />
      )}
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      {hasHeldCount && (
        <span style={{ color: "rgba(168,164,157,0.5)", marginLeft: 2, flexShrink: 0 }}>
          · {formatHeldCount(collection.heldCount)} held
        </span>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#0e0e0e", color: "rgb(240,237,230)" }}>
      <Suspense fallback={
        <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <p style={{ color: "rgb(168,164,157)", fontSize: 14 }}>Loading…</p>
        </div>
      }>
        <ResultsInner />
      </Suspense>
    </main>
  );
}
