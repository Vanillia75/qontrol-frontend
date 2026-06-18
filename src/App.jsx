import { useState } from "react";

// ──────────────────────────────────────────────────────────
// URL du backend Qontrol (Railway, production)
// ──────────────────────────────────────────────────────────
const API_BASE = "https://adorable-charisma-production-a90f.up.railway.app";

const STEPS = ["connexion", "upload", "resultats"];

export default function App() {
  const [step, setStep] = useState("connexion");
  const [sessionId, setSessionId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [slug, setSlug] = useState("");
  const [secretKey, setSecretKey] = useState("");

  const [files, setFiles] = useState([]);
  const [matches, setMatches] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [attachedCount, setAttachedCount] = useState(null);

  const stepIndex = STEPS.indexOf(step);

  async function handleConnect(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_slug: slug,
          secret_key: secretKey,
        }),
      });
      if (!res.ok) throw new Error(`Connexion refusée (code ${res.status})`);
      const data = await res.json();
      setSessionId(data.session_id || data.id);
      setStep("upload");
    } catch (err) {
      setError(err.message || "Impossible de se connecter à Qonto.");
    } finally {
      setLoading(false);
    }
  }

  async function handleUploadAndMatch(e) {
    e.preventDefault();
    setError("");
    if (!files.length) {
      setError("Ajoutez au moins une facture PDF.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      for (const f of files) form.append("files", f);

      const uploadRes = await fetch(
        `${API_BASE}/sessions/${sessionId}/invoices/upload`,
        { method: "POST", body: form }
      );
      if (!uploadRes.ok)
        throw new Error(`Échec de l'envoi des factures (code ${uploadRes.status})`);

      const matchRes = await fetch(
        `${API_BASE}/sessions/${sessionId}/match`,
        { method: "POST" }
      );
      if (!matchRes.ok)
        throw new Error(`Échec du rapprochement (code ${matchRes.status})`);

      const data = await matchRes.json();
      setMatches(data.matches || data.results || data || []);
      setStep("resultats");
    } catch (err) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAttach() {
    setAttaching(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}/attach`, {
        method: "POST",
      });
      if (!res.ok) throw new Error(`Échec de l'attachement (code ${res.status})`);
      const data = await res.json();
      setAttachedCount(data.attached_count ?? data.count ?? null);
    } catch (err) {
      setError(err.message || "Impossible d'attacher les justificatifs.");
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div style={styles.page}>
      <style>{globalCss}</style>

      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoMark}>⟡</span> Qontrol
        </div>
        <ol style={styles.stepper}>
          {STEPS.map((s, i) => (
            <li
              key={s}
              style={{
                ...styles.stepItem,
                ...(i === stepIndex ? styles.stepItemActive : {}),
                ...(i < stepIndex ? styles.stepItemDone : {}),
              }}
            >
              <span style={styles.stepDot}>{i < stepIndex ? "✓" : i + 1}</span>
              {s === "connexion" && "Connexion"}
              {s === "upload" && "Factures"}
              {s === "resultats" && "Résultats"}
            </li>
          ))}
        </ol>
      </header>

      <main style={styles.main}>
        {error && <div style={styles.errorBanner}>{error}</div>}

        {step === "connexion" && (
          <form style={styles.card} onSubmit={handleConnect}>
            <h1 style={styles.title}>Connecter votre compte Qonto</h1>
            <p style={styles.subtitle}>
              Vos identifiants ne sont utilisés que pour cette session de rapprochement.
            </p>

            <label style={styles.label}>
              Identifiant d'organisation (slug)
              <input
                style={styles.input}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="ex : vanillia-sarl-12345"
                required
              />
            </label>

            <label style={styles.label}>
              Clé secrète API
              <input
                style={styles.input}
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="••••••••••••••••"
                required
              />
            </label>

            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? "Connexion…" : "Se connecter"}
            </button>
          </form>
        )}

        {step === "upload" && (
          <form style={styles.card} onSubmit={handleUploadAndMatch}>
            <h1 style={styles.title}>Déposez vos factures</h1>
            <p style={styles.subtitle}>
              Qontrol va les rapprocher automatiquement de vos transactions Qonto
              sans justificatif.
            </p>

            <label style={styles.dropZone}>
              <input
                type="file"
                accept="application/pdf"
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files))}
                style={{ display: "none" }}
              />
              <span style={styles.dropZoneIcon}>＋</span>
              <span>
                {files.length
                  ? `${files.length} facture${files.length > 1 ? "s" : ""} sélectionnée${files.length > 1 ? "s" : ""}`
                  : "Cliquez pour choisir vos PDF"}
              </span>
            </label>

            <button style={styles.button} type="submit" disabled={loading}>
              {loading ? "Rapprochement en cours…" : "Lancer le rapprochement"}
            </button>
          </form>
        )}

        {step === "resultats" && (
          <div style={styles.card}>
            <h1 style={styles.title}>Résultats du rapprochement</h1>
            <p style={styles.subtitle}>
              {matches.length} transaction{matches.length > 1 ? "s" : ""} analysée
              {matches.length > 1 ? "s" : ""}.
            </p>

            <div style={styles.matchList}>
              {matches.map((m, i) => {
                const confidence = Math.round(
                  (m.confidence ?? m.score ?? 0) <= 1
                    ? (m.confidence ?? m.score ?? 0) * 100
                    : m.confidence ?? m.score ?? 0
                );
                const tier =
                  confidence >= 85 ? "high" : confidence >= 50 ? "mid" : "low";
                return (
                  <div key={i} style={styles.matchRow}>
                    <div style={styles.matchSide}>
                      <span style={styles.matchLabel}>Transaction</span>
                      <span style={styles.matchValue}>
                        {m.transaction_label || m.label || "—"}
                      </span>
                      <span style={styles.matchAmount}>
                        {m.transaction_amount ?? m.amount ?? "—"} €
                      </span>
                    </div>

                    <div
                      style={{
                        ...styles.matchBridge,
                        ...(tier === "high"
                          ? styles.bridgeHigh
                          : tier === "mid"
                          ? styles.bridgeMid
                          : styles.bridgeLow),
                      }}
                    >
                      {confidence}%
                    </div>

                    <div style={styles.matchSide}>
                      <span style={styles.matchLabel}>Facture</span>
                      <span style={styles.matchValue}>
                        {m.invoice_filename || m.invoice || "Aucune correspondance"}
                      </span>
                      <span style={styles.matchAmount}>
                        {m.invoice_amount ?? "—"} €
                      </span>
                    </div>
                  </div>
                );
              })}
              {matches.length === 0 && (
                <p style={styles.subtitle}>Aucun résultat à afficher.</p>
              )}
            </div>

            <button
              style={styles.button}
              onClick={handleAttach}
              disabled={attaching || attachedCount !== null}
            >
              {attachedCount !== null
                ? `${attachedCount} justificatif${attachedCount > 1 ? "s" : ""} attaché${attachedCount > 1 ? "s" : ""} ✓`
                : attaching
                ? "Attachement en cours…"
                : "Attacher les justificatifs sur Qonto"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
// Design tokens
// ──────────────────────────────────────────────────────────
const ink = "#161A22";
const paper = "#EEF1F4";
const cardBg = "#FFFFFF";
const line = "#D7DCE3";
const accent = "#3730A2";
const success = "#1E7A52";
const mid = "#B8742A";
const low = "#B23B3B";

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
`;

const styles = {
  page: {
    minHeight: "100vh",
    background: paper,
    color: ink,
    fontFamily: "'Inter', system-ui, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "40px 20px",
  },
  header: { width: "100%", maxWidth: 560, marginBottom: 32 },
  logo: {
    fontFamily: "'Fraunces', serif",
    fontSize: 22,
    fontWeight: 600,
    marginBottom: 20,
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  logoMark: { color: accent },
  stepper: {
    display: "flex",
    listStyle: "none",
    padding: 0,
    margin: 0,
    gap: 24,
  },
  stepItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#8A93A3",
    fontWeight: 500,
  },
  stepItemActive: { color: ink },
  stepItemDone: { color: success },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: `1px solid ${line}`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
  },
  main: { width: "100%", maxWidth: 560 },
  errorBanner: {
    background: "#FBEAEA",
    color: low,
    border: `1px solid #E8C4C4`,
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 14,
    marginBottom: 16,
  },
  card: {
    background: cardBg,
    border: `1px solid ${line}`,
    borderRadius: 12,
    padding: 32,
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontSize: 24,
    fontWeight: 600,
    margin: "0 0 8px",
  },
  subtitle: { fontSize: 14, color: "#5B6573", margin: "0 0 24px", lineHeight: 1.5 },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
    color: "#3D4452",
    marginBottom: 16,
  },
  input: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 14,
    padding: "10px 12px",
    borderRadius: 8,
    border: `1px solid ${line}`,
    outline: "none",
  },
  dropZone: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    border: `1.5px dashed ${line}`,
    borderRadius: 10,
    padding: "36px 16px",
    marginBottom: 20,
    cursor: "pointer",
    fontSize: 14,
    color: "#5B6573",
  },
  dropZoneIcon: { fontSize: 22, color: accent },
  button: {
    width: "100%",
    background: accent,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  matchList: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 },
  matchRow: {
    display: "flex",
    alignItems: "center",
    border: `1px solid ${line}`,
    borderRadius: 10,
    overflow: "hidden",
  },
  matchSide: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    padding: "12px 14px",
  },
  matchLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#9098A6",
  },
  matchValue: { fontSize: 13, fontWeight: 500 },
  matchAmount: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
    color: "#5B6573",
  },
  matchBridge: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: 13,
    fontWeight: 600,
    padding: "6px 10px",
    borderLeft: `1px solid ${line}`,
    borderRight: `1px solid ${line}`,
  },
  bridgeHigh: { background: "#E7F4ED", color: success },
  bridgeMid: { background: "#FBF1E3", color: mid },
  bridgeLow: { background: "#FBEAEA", color: low },
};
