/**
 * GET /api/health — état réel du système.
 *
 * Répond à la règle AXIOM : « Une fonction manquante est affichée
 * comme "à connecter", pas comme déjà opérationnelle. »
 * Cette fonction ne prétend rien : elle sonde et rapporte.
 */

import { ProviderRegistry } from "../../services/axiom-core/ProviderRegistry.js";
import { OpenAIProvider } from "../../providers/text/OpenAIProvider.js";
import { IDENTITE } from "../../services/axiom-core/NericxCore.js";

export async function handler(event) {
  if (event.httpMethod !== "GET" && event.httpMethod !== "OPTIONS") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, erreur: "Utilise GET." }),
    };
  }

  const registry = new ProviderRegistry();
  const substrat = new OpenAIProvider();
  registry.enregistrer(substrat, { capacite: "text", statut: "a_connecter", contrat: "InferenceProvider v1" });

  let sante;
  try {
    sante = await substrat.health();
  } catch (e) {
    sante = { ok: false, reason: String(e && e.message ? e.message : e) };
  }
  if (sante.ok) {
    registry.enregistrer(substrat, { capacite: "text", statut: "active", contrat: "InferenceProvider v1" });
  }

  const capacitesDeclarees = registry.etat().map((c) => ({
    capacite: c.capacite,
    provider: c.provider,
    statut: c.statut,
    actif: c.actif,
    contrat: c.contrat,
  }));

  // Les capacités non connectées sont déclarées comme telles,
  // pas omises ni présentées comme disponibles.
  for (const nom of ["image", "audio", "video"]) {
    if (!capacitesDeclarees.find((c) => c.capacite === nom)) {
      capacitesDeclarees.push({
        capacite: nom,
        provider: null,
        statut: "a_connecter",
        actif: false,
        contrat: null,
      });
    }
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify({
      ok: sante.ok,
      systeme: IDENTITE.systeme,
      noyau: IDENTITE.nom,
      role: IDENTITE.role,
      substrat: {
        id: substrat.id,
        version: substrat.version,
        model: substrat.model,
        connecte: Boolean(sante.ok),
        detail: sante.reason || null,
      },
      capacites: capacitesDeclarees,
      horodatage: new Date().toISOString(),
    }),
  };
}
