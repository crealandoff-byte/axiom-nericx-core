/**
 * MemoireAxiom — traces avec provenance et statut épistémique.
 *
 * ARCHITECTURE.md principe 5 : « Mémoire avec provenance, date, niveau
 * de confiance, statut épistémique et possibilité de correction. »
 *
 * Cette implémentation est en mémoire vive : elle ne survit pas au
 * redémarrage de la fonction. Elle rend le FORMAT correct et testable
 * dès maintenant ; le passage à une base relationnelle est l'étape
 * suivante et ne change pas ce contrat.
 *
 * Statuts épistémiques (IDENTITE_NERICX.md : « Préserver la distinction
 * entre faits établis, modèles fonctionnels et hypothèses ») :
 *   fait | modele | hypothese
 */

export const STATUTS = ["fait", "modele", "hypothese"];

export class MemoireAxiom {
  constructor({ limite = 200 } = {}) {
    this._episodes = [];
    this._limite = limite;
    this._compteur = 0;
  }

  /**
   * @param {object} entree
   * @param {string} entree.sujet       — de quoi il s'agit
   * @param {string} entree.contenu     — le contenu mémorisé
   * @param {string} entree.provenance  — d'où vient l'information
   * @param {string} entree.statut      — fait | modele | hypothese
   * @param {number} entree.confiance   — 0..1
   */
  enregistrer(entree) {
    const statut = STATUTS.includes(entree.statut) ? entree.statut : "hypothese";
    const confiance = Number.isFinite(entree.confiance)
      ? Math.min(1, Math.max(0, entree.confiance))
      : 0.5;

    const episode = {
      id: "E-" + String(++this._compteur).padStart(4, "0"),
      sujet: String(entree.sujet || "").slice(0, 200),
      contenu: String(entree.contenu || "").slice(0, 4000),
      provenance: String(entree.provenance || "inconnue").slice(0, 200),
      statut,
      confiance,
      creeLe: new Date().toISOString(),
      reviseLe: null,
      revision: 0,
    };

    this._episodes.push(episode);
    if (this._episodes.length > this._limite) this._episodes.shift();
    return episode;
  }

  /** Correction : on ne supprime pas, on révise et on trace. */
  reviser(id, { contenu, statut, confiance, motif }) {
    const e = this._episodes.find((x) => x.id === id);
    if (!e) return null;
    if (contenu !== undefined) e.contenu = String(contenu).slice(0, 4000);
    if (statut !== undefined && STATUTS.includes(statut)) e.statut = statut;
    if (confiance !== undefined) e.confiance = Math.min(1, Math.max(0, Number(confiance)));
    e.reviseLe = new Date().toISOString();
    e.revision += 1;
    e.motifRevision = String(motif || "").slice(0, 300);
    return e;
  }

  /**
   * Recherche lexicale. La recherche sémantique est l'étape suivante.
   *
   * Le score pondère la fréquence d'occurrence (bornée à 5 pour éviter
   * qu'une répétition artificielle ne domine) et non la simple présence :
   * un épisode qui mentionne trois fois le terme passe devant un épisode
   * qui ne le mentionne qu'une fois à score de présence égal.
   * À égalité, le plus récent passe devant.
   */
  rechercher(requete, limite = 8) {
    const mots = String(requete || "").toLowerCase().split(/\s+/).filter((m) => m.length > 2);
    if (mots.length === 0) return [];

    const occurrences = (texte, mot) => {
      let n = 0, i = 0;
      while ((i = texte.indexOf(mot, i)) !== -1) { n++; i += mot.length; }
      return Math.min(n, 5);
    };

    return this._episodes
      .map((e, index) => {
        const texte = (e.sujet + " " + e.contenu).toLowerCase();
        const presence = mots.reduce((n, m) => n + (texte.includes(m) ? 1 : 0), 0);
        const frequence = mots.reduce((n, m) => n + occurrences(texte, m), 0);
        return { episode: e, presence, frequence, index };
      })
      .filter((x) => x.presence > 0)
      .sort((a, b) =>
        b.presence - a.presence ||
        b.frequence - a.frequence ||
        b.index - a.index)
      .slice(0, limite)
      .map((x) => x.episode);
  }

  lister(limite = 50) { return this._episodes.slice(-limite); }

  get taille() { return this._episodes.length; }
}
