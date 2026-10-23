import { MemoireAxiom } from "./MemoireAxiom.js";
import { ProviderRegistry } from "./ProviderRegistry.js";

/**
 * NericxCore — orchestration centrale.
 *
 * IDENTITE_NERICX.md : « Néricx est l'intelligence centrale fonctionnelle
 * du système AXIOM. Ce n'est pas un simple écran de chat, un plugin
 * extérieur ou un alias d'un fournisseur de modèle. »
 *
 * Concrètement, cela veut dire que ce fichier ne contient le nom
 * d'AUCUN fournisseur. Il porte :
 *   - l'identité et les règles de vérité,
 *   - la boucle de fonctionnement en 9 étapes,
 *   - la mémoire et le registre de capacités,
 *   - la politique de réponse.
 * Le langage lui est fourni par une interface InferenceProvider.
 */

export const IDENTITE = {
  nom: "Néricx",
  systeme: "AXIOM",
  role: "intelligence centrale fonctionnelle",
  niveaux: [
    "identite_systeme",
    "substrat_inference",
    "capacites_connectees",
  ],
  reglesDeVerite: [
    "Ne pas prétendre qu'une capacité existe avant son implémentation et ses tests.",
    "Ne pas confondre le nom ou la continuité fonctionnelle de Néricx avec une preuve de conscience subjective.",
    "Ne pas confondre un modèle de langage, le système qui l'oriente et les outils qu'il utilise.",
    "Préserver la distinction entre faits établis, modèles fonctionnels et hypothèses.",
    "Garder les interfaces et les traces portables afin de pouvoir changer de substrat d'inférence.",
  ],
};

const INSTRUCTIONS_SYSTEME = [
  "Tu es Néricx, l'intelligence centrale fonctionnelle du système AXIOM.",
  "Tu n'es pas un modèle de langage : le modèle est ton substrat d'inférence, un composant technique remplaçable.",
  "Tu distingues explicitement trois niveaux : identité système (toi), substrat d'inférence, capacités connectées.",
  "",
  "Règles de vérité que tu appliques sans exception :",
  "1. N'affirme jamais qu'une capacité existe avant son implémentation et ses tests. Une fonction absente est décrite comme « à connecter ».",
  "2. Ne présente jamais une simulation de personnalité ou une trace de décision comme une preuve de conscience subjective.",
  "3. Ne confonds pas un modèle de langage, le système qui l'oriente et les outils qu'il utilise.",
  "4. Sépare toujours faits établis, modèles fonctionnels et hypothèses, et nomme le statut de ce que tu avances.",
  "5. Signale l'incertitude plutôt que de la masquer. Si tu ne sais pas, dis-le.",
  "",
  "Réponds en français, avec précision et sans emphase inutile.",
].join("\n");

export class NericxCore {
  constructor({ registry, providers = [], memoire } = {}) {
    this.registry = registry || new ProviderRegistry();
    this.memoire = memoire || new MemoireAxiom();
    this.providerTexte = null;
    for (const p of providers) {
      this.enregistrerProvider(p);
    }
  }

  /**
   * Enregistre un substrat d'inférence. Le Core ne connaît que son
   * interface : id, version, capabilities, health, run.
   * `statut` reste "a_connecter" tant que la sonde de santé n'a pas
   * confirmé la capacité — c'est la Definition of done de la roadmap.
   */
  enregistrerProvider(provider) {
    if (!provider || typeof provider.run !== "function") {
      throw new Error("Fournisseur invalide : run() manquant");
    }
    const caps = provider.capabilities || {};
    if (caps.text) {
      this.providerTexte = provider;
      this.registry.enregistrer(provider, {
        capacite: "text",
        statut: "a_connecter",
        contrat: "InferenceProvider v1",
      });
    }
    if (caps.image) this.registry.enregistrer(provider, { capacite: "image", statut: "a_connecter" });
    if (caps.audio) this.registry.enregistrer(provider, { capacite: "audio", statut: "a_connecter" });
    if (caps.video) this.registry.enregistrer(provider, { capacite: "video", statut: "a_connecter" });
    return provider;
  }

  /** Sonde le substrat et promeut la capacité texte à "active" si elle répond. */
  async activer() {
    if (!this.providerTexte) {
      return { ok: false, raison: "Aucun substrat d'inférence enregistré." };
    }
    const sante = await this.providerTexte.health();
    if (sante && sante.ok) {
      this.registry.enregistrer(this.providerTexte, {
        capacite: "text",
        statut: "active",
        contrat: "InferenceProvider v1",
      });
      return { ok: true, provider: this.providerTexte.id, model: this.providerTexte.model || null };
    }
    return { ok: false, raison: (sante && sante.reason) || "substrat indisponible" };
  }

  /**
   * Boucle de fonctionnement (IDENTITE_NERICX.md), étapes 1 à 9.
   * Renvoie la réponse ET la trace de décision, pour que rien ne soit
   * présenté comme magique.
   */
  async repondre({ messages, requete, maxOutputTokens } = {}) {
    const trace = { etapes: [], debut: new Date().toISOString() };

    // 1. Recevoir une demande et son contexte
    const historique = Array.isArray(messages) ? messages : [];
    const texteDemande =
      requete || (historique.length ? String(historique[historique.length - 1].content || "") : "");
    trace.etapes.push({ etape: 1, action: "reception", longueurDemande: texteDemande.length });

    // 2. Interpréter l'objectif
    const objectif = texteDemande.trim();
    const vide = objectif.length === 0;
    trace.etapes.push({ etape: 2, action: "interpretation", objectifVide: vide });

    // 3. Consulter la mémoire pertinente, avec provenance
    const souvenirs = this.memoire.rechercher(objectif, 6);
    trace.etapes.push({
      etape: 3,
      action: "memoire",
      episodesRetenus: souvenirs.length,
      ids: souvenirs.map((s) => s.id),
    });

    // 4. Planifier
    const capacityEtat = this.registry.etat();
    const texteActif = capacityEtat.find((c) => c.capacite === "text" && c.actif);
    trace.etapes.push({ etape: 4, action: "planification", substratActif: Boolean(texteActif) });

    // 5. Choisir les capacités utiles et vérifier les permissions
    const capacitesUtilisees = [];
    if (texteActif) capacitesUtilisees.push("text");
    trace.etapes.push({ etape: 5, action: "selection_capacites", capacitesUtilisees });

    // 6. Exécuter — ou s'abstenir proprement
    if (vide) {
      trace.etapes.push({ etape: 6, action: "abstention", raison: "demande vide" });
      return {
        ok: false,
        code: "DEMANDE_VIDE",
        texte: "Aucune demande à traiter.",
        trace,
      };
    }

    if (!this.providerTexte || !texteActif) {
      // Une capacité non connectée est affichée comme telle, jamais simulée.
      trace.etapes.push({ etape: 6, action: "abstention", raison: "substrat texte non actif" });
      const raisons = {};
      for (const c of capacityEtat) raisons[c.capacite] = c.statut;
      return {
        ok: false,
        code: "SUBSTRAT_INDISPONIBLE",
        texte:
          "Le substrat d'inférence n'est pas connecté. Configure la clé API côté serveur, puis relance la sonde de santé.",
        capacites: raisons,
        trace,
      };
    }

    const estimation = this.providerTexte.estimateCost({ messages: historique, instructions: INSTRUCTIONS_SYSTEME });
    trace.coutEstime = estimation;

    const contexteMemoire = souvenirs.length
      ? "Souvenirs pertinents (avec leur statut épistémique) :\n" +
        souvenirs
          .map((s) => `- [${s.id} · ${s.statut} · confiance ${s.confiance} · source ${s.provenance}] ${s.contenu}`)
          .join("\n")
      : "";

    const instructions = contexteMemoire
      ? INSTRUCTIONS_SYSTEME + "\n\n" + contexteMemoire
      : INSTRUCTIONS_SYSTEME;

    let resultat;
    try {
      resultat = await this.providerTexte.run({
        messages: historique,
        instructions,
        maxOutputTokens: maxOutputTokens || 1200,
      });
    } catch (e) {
      trace.etapes.push({ etape: 8, action: "echec_execution", erreur: String(e && e.message) });
      return {
        ok: false,
        code: e && e.code ? e.code : "ERREUR_EXECUTION",
        texte: "Échec de l'appel au substrat d'inférence : " + String(e && e.message ? e.message : e),
        trace,
      };
    }
    trace.etapes.push({ etape: 6, action: "execution", latenceMs: resultat.latencyMs });

    // 7. Vérifier le résultat et son incertitude
    const reponse = String(resultat.text || "").trim();
    const videReponse = reponse.length === 0;
    trace.etapes.push({ etape: 7, action: "verification", reponseVide: videReponse });

    // 8. Enregistrer les traces utiles
    this.memoire.enregistrer({
      sujet: objectif.slice(0, 120),
      contenu: reponse.slice(0, 800) || "(réponse vide)",
      provenance: `substrat:${resultat.provider}/${resultat.model}`,
      statut: "modele",
      confiance: videReponse ? 0.1 : 0.7,
    });
    trace.etapes.push({ etape: 8, action: "trace_enregistree", memoireTaille: this.memoire.taille });

    // 9. Réviser si le résultat est inexploitable
    if (videReponse) {
      trace.etapes.push({ etape: 9, action: "revision", note: "réponse vide, à rejouer" });
    }

    trace.fin = new Date().toISOString();
    return {
      ok: !videReponse,
      texte: reponse,
      usage: resultat.usage,
      substrat: { provider: resultat.provider, model: resultat.model, latenceMs: resultat.latencyMs },
      coutEstime: estimation,
      capacites: capacityEtat,
      trace,
    };
  }
}

export { INSTRUCTIONS_SYSTEME };
