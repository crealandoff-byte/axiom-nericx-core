/**
 * Client AXIOM Néricx.
 *
 * Règle stricte : ce fichier ne contient AUCUNE clé, AUCUN nom de
 * fournisseur et AUCUN nom de modèle. Il ne connaît que deux routes :
 * /api/health et /api/chat. Tout le reste appartient au serveur.
 */

const messagesEl = document.getElementById("messages");
const form = document.getElementById("chatForm");
const input = document.getElementById("messageInput");
const bouton = document.getElementById("sendButton");
const statusText = document.getElementById("statusText");
const statusBox = document.querySelector(".status");
const pillSubstrat = document.getElementById("pillSubstrat");
const etatCore = document.getElementById("etatCore");
const diagnostic = document.getElementById("diagnostic");
const traceContenu = document.getElementById("traceContenu");

const historique = [];

function bulle(role, nom, texte, meta) {
  const art = document.createElement("article");
  art.className = "message " + role;
  const av = document.createElement("div");
  av.className = "avatar";
  av.textContent = role === "user" ? "TOI" : "AX";
  const corps = document.createElement("div");
  const b = document.createElement("b");
  b.textContent = nom;
  const p = document.createElement("p");
  p.textContent = texte;
  corps.append(b, p);
  if (meta) {
    const m = document.createElement("span");
    m.className = "meta";
    m.textContent = meta;
    corps.append(m);
  }
  art.append(av, corps);
  messagesEl.append(art);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return art;
}

/** Marque une capacité comme « à connecter » si le serveur le dit. */
function appliquerEtat(sante) {
  const connecte = Boolean(sante && sante.ok);
  statusBox.classList.toggle("ok", connecte);
  statusBox.classList.toggle("ko", !connecte);

  if (connecte) {
    statusText.textContent = "Backend connecté";
    pillSubstrat.textContent = "SUBSTRAT ACTIF";
    pillSubstrat.classList.add("actif");
    pillSubstrat.classList.remove("inactif");
    etatCore.textContent = "ACTIF";
  } else {
    statusText.textContent = "Backend en attente de clé";
    pillSubstrat.textContent = "SUBSTRAT INACTIF";
    pillSubstrat.classList.add("inactif");
    pillSubstrat.classList.remove("actif");
    etatCore.textContent = "À CONNECTER";
    if (sante && sante.substrat && sante.substrat.detail) {
      console.info("[AXIOM] Substrat inactif :", sante.substrat.detail);
    }
  }

  // Les capacités non connectées restent affichées comme telles.
  const parNom = {};
  for (const c of (sante && sante.capacites) || []) parNom[c.capacite] = c;
  for (const [nom, id] of [["image", "modImage"], ["audio", "modAudio"], ["video", "modVideo"]]) {
    const el = document.getElementById(id);
    if (!el) continue;
    const small = el.querySelector("small");
    const cap = parNom[nom];
    small.textContent = cap && cap.actif ? "ACTIF" : "À CONNECTER";
  }
}

async function verifierSante() {
  try {
    const r = await fetch("/api/health", { cache: "no-store" });
    const sante = await r.json();
    appliquerEtat(sante);
  } catch (e) {
    statusBox.classList.add("ko");
    statusText.textContent = "Backend injoignable";
    pillSubstrat.textContent = "SUBSTRAT INACTIF";
    pillSubstrat.classList.add("inactif");
    etatCore.textContent = "HORS LIGNE";
  }
}

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const texte = input.value.trim();
  if (!texte) return;

  bulle("user", "Toi", texte);
  historique.push({ role: "user", content: texte });
  input.value = "";
  bouton.disabled = true;
  const attente = bulle("assistant", "Néricx", "…");

  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: historique }),
    });
    const data = await r.json();
    attente.remove();

    if (data.ok) {
      const meta = data.substrat
        ? `latence ${data.substrat.latencyMs} ms · coût estimé ${data.coutEstime ? data.coutEstime.amount : "?"} ${data.coutEstime ? data.coutEstime.unit : ""}`
        : null;
      bulle("assistant", "Néricx", data.texte, meta);
      historique.push({ role: "assistant", content: data.texte });
    } else {
      bulle("erreur", "Néricx — capacité indisponible", data.texte || data.erreur || "Erreur inconnue.");
    }

    // La trace est rendue visible : rien n'est présenté comme magique.
    if (data.trace) {
      diagnostic.hidden = false;
      traceContenu.textContent = JSON.stringify(data.trace, null, 2);
    }
    verifierSante();
  } catch (e) {
    attente.remove();
    bulle("erreur", "Réseau", "Impossible de joindre /api/chat : " + String(e.message || e));
  } finally {
    bouton.disabled = false;
    input.focus();
  }
});

// Entrée envoie, Maj+Entrée fait un retour à la ligne.
input.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.shiftKey) {
    ev.preventDefault();
    form.requestSubmit();
  }
});

verifierSante();
setInterval(verifierSante, 60000);
