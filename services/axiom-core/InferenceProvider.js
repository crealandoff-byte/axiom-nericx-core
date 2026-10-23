/**
 * InferenceProvider — contrat abstrait du substrat d'inférence.
 *
 * ARCHITECTURE.md : « Le choix d'un fournisseur d'inférence externe
 * aujourd'hui est une contrainte technique d'implémentation, pas une
 * décision d'architecture selon laquelle "l'IA centrale serait quelqu'un
 * d'autre". »
 *
 * Conséquence : rien dans le noyau Néricx ne nomme un fournisseur.
 * Le noyau parle à cette interface. Changer de fournisseur = changer
 * l'adaptateur, sans toucher au Core.
 */

export class InferenceProvider {
  /** Identifiant stable du fournisseur. */
  get id() { throw new Error("InferenceProvider.id non implémenté"); }

  /** Version de l'adaptateur (sémantique : majeur.mineur.correctif). */
  get version() { throw new Error("InferenceProvider.version non implémentée"); }

  /** Capacités déclarées, vérifiables par le Core avant tout appel. */
  get capabilities() {
    return { text: false, image: false, audio: false, video: false, streaming: false };
  }

  /** Sonde de santé. Doit répondre sans consommer de tokens si possible. */
  async health() { return { ok: false, reason: "non implémentée" }; }

  /**
   * Estimation de coût AVANT exécution (ARCHITECTURE.md : « Coûts visibles »).
   * Renvoie une estimation en unités arbitraires, plus les détails.
   */
  estimateCost(input) { return { unit: "inconnu", amount: 0, note: "non implémentée" }; }

  /**
   * Appel synchrone. Renvoie { text, usage, provider, model, latencyMs }.
   * `signal` est un AbortSignal : le Core doit pouvoir annuler.
   */
  async run(input, signal) { throw new Error("InferenceProvider.run non implémentée"); }

  /** Tâche longue (image, vidéo). Optionnel : renvoyer null si non supporté. */
  async submitJob(_input) { return null; }
  async getJob(_jobId) { return null; }
  async cancelJob(_jobId) { return false; }
}
