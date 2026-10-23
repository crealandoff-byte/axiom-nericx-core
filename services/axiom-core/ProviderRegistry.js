/**
 * ProviderRegistry — annuaire des capacités connectées.
 *
 * Règle AXIOM : « Une fonction manquante est affichée comme
 * "à connecter", pas comme déjà opérationnelle. »
 *
 * Ce registre est donc la source unique de vérité de l'interface :
 * le client demande l'état réel, il ne le suppose pas.
 */

export class ProviderRegistry {
  constructor() {
    this._fournisseurs = new Map();
    this._capacites = new Map(); // capacité -> { providerId, statut, contrat }
  }

  enregistrer(provider, { capacite, statut = "a_connecter", contrat = null } = {}) {
    if (!provider || !provider.id) throw new Error("Fournisseur sans identifiant");
    this._fournisseurs.set(provider.id, provider);
    if (capacite) {
      this._capacites.set(capacite, {
        providerId: provider.id,
        statut,
        contrat,
        version: provider.version,
      });
    }
    return provider;
  }

  obtenir(id) { return this._fournisseurs.get(id) || null; }

  /**
   * État déclaré, vérifiable. `actif` reste false tant qu'aucun test
   * reproductible n'a confirmé la capacité — conformément à la
   * « Definition of done » de la roadmap.
   */
  etat() {
    const liste = [];
    for (const [capacite, info] of this._capacites.entries()) {
      liste.push({
        capacite,
        provider: info.providerId,
        version: info.version,
        statut: info.statut,
        actif: info.statut === "active",
        contrat: info.contrat,
      });
    }
    liste.sort((a, b) => a.capacite.localeCompare(b.capacite));
    return liste;
  }

  /** Sonde chaque fournisseur enregistré. Ne lève jamais : agrège. */
  async sonder() {
    const resultats = {};
    for (const [id, p] of this._fournisseurs.entries()) {
      try {
        resultats[id] = await p.health();
      } catch (e) {
        resultats[id] = { ok: false, reason: String(e && e.message ? e.message : e) };
      }
    }
    return resultats;
  }
}
