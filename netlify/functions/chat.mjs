/**
 * POST /api/chat — point d'entrée de la conversation.
 *
 * La clé API vit uniquement ici, côté serveur (ARCHITECTURE.md
 * principe 3 : « Aucune clé privée dans le navigateur ou le dépôt »).
 * Le client n'envoie que du texte ; il ne peut pas choisir le modèle
 * ni lire la configuration.
 */

import { NericxCore } from "../../services/axiom-core/NericxCore.js";
import { ProviderRegistry } from "../../services/axiom-core/ProviderRegistry.js";
import { MemoireAxiom } from "../../services/axiom-core/MemoireAxiom.js";
import { OpenAIProvider } from "../../providers/text/OpenAIProvider.js";

const LIMITE_ENTREE = 12000;
const LIMITE_MESSAGES = 40;

// Mémoire partagée le temps de vie de l'instance de fonction.
// Persistante = étape suivante (base relationnelle).
const memoirePartagee = new MemoireAxiom({ limite: 300 });

let core = null;

async function obtenirCore() {
  if (core) return core;
  const registry = new ProviderRegistry();
  const substrat = new OpenAIProvider();
  core = new NericxCore({ registry, providers: [substrat], memoire: memoirePartagee });
  await core.activer();
  return core;
}

function repondre(code, corps) {
  return {
    statusCode: code,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(corps),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: { Allow: "POST, OPTIONS" }, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return repondre(405, { ok: false, erreur: "Méthode non autorisée. Utilise POST." });
  }

  let charge = null;
  try {
    charge = JSON.parse(event.body || "{}");
  } catch {
    return repondre(400, { ok: false, erreur: "Corps JSON illisible." });
  }

  // Validation stricte des entrées : le serveur ne fait pas confiance au client.
  let messages = Array.isArray(charge.messages) ? charge.messages : [];
  if (charge.message && typeof charge.message === "string") {
    messages = messages.concat([{ role: "user", content: charge.message }]);
  }

  messages = messages
    .filter((m) => m && typeof m.content === "string")
    .slice(-LIMITE_MESSAGES)
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content.slice(0, LIMITE_ENTREE),
    }));

  if (messages.length === 0) {
    return repondre(400, { ok: false, erreur: "Aucun message exploitable." });
  }

  try {
    const moteur = await obtenirCore();
    const resultat = await moteur.repondre({
      messages,
      maxOutputTokens: Math.min(Number(charge.maxOutputTokens) || 1200, 4000),
    });

    // Le noyau ne renvoie `capacites` que dans le chemin nominal :
    // en cas d'abstention, on interroge le registre pour que le client
    // affiche toujours l'etat reel des capacites, jamais un tableau vide
    // qu'il interpreterait comme "aucune capacite".
    const capacites = Array.isArray(resultat.capacites) && resultat.capacites.length
      ? resultat.capacites
      : moteur.registry.etat().map((c) => ({
          capacite: c.capacite, provider: c.provider,
          statut: c.statut, actif: c.actif, contrat: c.contrat,
        }));

    // On renvoie la trace : rien n'est présenté comme magique.
    return repondre(resultat.ok ? 200 : 503, {
      ok: resultat.ok,
      texte: resultat.texte || "",
      code: resultat.code || null,
      substrat: resultat.substrat || null,
      usage: resultat.usage || null,
      coutEstime: resultat.coutEstime || null,
      capacites,
      trace: resultat.trace || null,
    });
  } catch (e) {
    return repondre(500, {
      ok: false,
      erreur: "Erreur interne du noyau : " + String(e && e.message ? e.message : e),
    });
  }
}
