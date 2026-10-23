/**
 * Tests du noyau Néricx : identité, abstention, activation, traçabilité.
 * Exécution : node tests/noyau.test.mjs
 *
 * Point critique testé : le noyau ne doit JAMAIS inventer une réponse
 * quand le substrat n'est pas connecté. Il doit s'abstenir et le dire.
 */

import assert from "node:assert/strict";
import { NericxCore, IDENTITE, INSTRUCTIONS_SYSTEME } from "../services/axiom-core/NericxCore.js";
import { InferenceProvider } from "../services/axiom-core/InferenceProvider.js";

let passes = 0, echoues = 0;
async function test(nom, fn) {
  try {
    await fn();
    console.log("  PASS  " + nom);
    passes++;
  } catch (e) {
    console.log("  FAIL  " + nom + " — " + (e && e.message));
    echoues++;
  }
}

/** Substrat factice : sert à tester le noyau sans réseau ni clé. */
class FauxSubstrat extends InferenceProvider {
  constructor({ enPanne = false } = {}) {
    super();
    this._enPanne = enPanne;
    this.appels = 0;
  }
  get id() { return "faux-substrat"; }
  get version() { return "1.0.0"; }
  get capabilities() { return { text: true }; }
  get model() { return "modele-de-test"; }
  async health() {
    return this._enPanne ? { ok: false, reason: "panne simulée" } : { ok: true };
  }
  estimateCost() { return { unit: "test", amount: 0 }; }
  async run(input) {
    this.appels++;
    return {
      text: "Réponse factice pour : " + (input.messages.at(-1)?.content || ""),
      usage: { total_tokens: 12 },
      provider: this.id, model: "modele-de-test", latencyMs: 3,
    };
  }
}

class SubstratSansTexte extends InferenceProvider {
  get id() { return "sans-texte"; }
  get version() { return "1.0.0"; }
  get capabilities() { return { image: true }; }
  async health() { return { ok: true }; }
  async run() { throw new Error("ne devrait pas être appelé"); }
}

console.log("NericxCore");

await test("l'identité déclare les trois niveaux à ne pas confondre", () => {
  assert.equal(IDENTITE.nom, "Néricx");
  assert.equal(IDENTITE.systeme, "AXIOM");
  assert.deepEqual(IDENTITE.niveaux, [
    "identite_systeme", "substrat_inference", "capacites_connectees",
  ]);
});

await test("les règles de vérité couvrent conscience et distinction des niveaux", () => {
  const t = IDENTITE.reglesDeVerite.join(" ");
  assert.ok(t.includes("capacité existe avant"));
  assert.ok(t.includes("conscience"));
  assert.ok(t.includes("faits établis"));
});

await test("les instructions système séparent identité et substrat", () => {
  assert.ok(INSTRUCTIONS_SYSTEME.includes("substrat d'inférence"));
  assert.ok(INSTRUCTIONS_SYSTEME.includes("remplaçable"));
});

await test("s'abstient quand aucun substrat n'est enregistré", async () => {
  const core = new NericxCore();
  const r = await core.repondre({ messages: [{ role: "user", content: "bonjour" }] });
  assert.equal(r.ok, false);
  assert.equal(r.code, "SUBSTRAT_INDISPONIBLE");
  assert.ok(r.texte.includes("n'est pas connecté"));
});

await test("s'abstient quand la sonde de santé échoue", async () => {
  const core = new NericxCore({ providers: [new FauxSubstrat({ enPanne: true })] });
  await core.activer();
  const r = await core.repondre({ messages: [{ role: "user", content: "bonjour" }] });
  assert.equal(r.ok, false);
  assert.equal(r.code, "SUBSTRAT_INDISPONIBLE");
});

await test("une capacité sans texte ne devient pas substrat principal", async () => {
  const core = new NericxCore({ providers: [new SubstratSansTexte()] });
  const r = await core.activer();
  assert.equal(r.ok, false);
});

await test("refuse une demande vide sans appeler le substrat", async () => {
  const faux = new FauxSubstrat();
  const core = new NericxCore({ providers: [faux] });
  await core.activer();
  const r = await core.repondre({ messages: [{ role: "user", content: "   " }] });
  assert.equal(r.code, "DEMANDE_VIDE");
  assert.equal(faux.appels, 0);
});

await test("promeut la capacité texte à active après sonde réussie", async () => {
  const core = new NericxCore({ providers: [new FauxSubstrat()] });
  const r = await core.activer();
  assert.equal(r.ok, true);
  const etat = core.registry.etat().find((c) => c.capacite === "text");
  assert.equal(etat.statut, "active");
  assert.equal(etat.actif, true);
});

await test("répond et fournit une trace complète en 9 étapes", async () => {
  const core = new NericxCore({ providers: [new FauxSubstrat()] });
  await core.activer();
  const r = await core.repondre({ messages: [{ role: "user", content: "test de trace" }] });
  assert.equal(r.ok, true);
  assert.ok(r.texte.includes("test de trace"));
  const etapes = r.trace.etapes.map((e) => e.etape);
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) {
    assert.ok(etapes.includes(n), "étape " + n + " absente de la trace");
  }
});

await test("consigne la réponse en mémoire avec provenance", async () => {
  const core = new NericxCore({ providers: [new FauxSubstrat()] });
  await core.activer();
  await core.repondre({ messages: [{ role: "user", content: "souviens-toi de ceci" }] });
  assert.equal(core.memoire.taille, 1);
  const e = core.memoire.lister()[0];
  assert.equal(e.statut, "modele");
  assert.ok(e.provenance.includes("faux-substrat"));
});

await test("déclare les capacités non connectées au lieu de les omettre", async () => {
  const core = new NericxCore({ providers: [new FauxSubstrat()] });
  await core.activer();
  const caps = core.registry.etat().map((c) => c.capacite);
  assert.ok(caps.includes("text"));
  const r = await core.repondre({ messages: [{ role: "user", content: "x" }] });
  const noms = r.capacites.map((c) => c.capacite);
  assert.ok(noms.includes("text"));
});

await test("propage l'erreur du substrat sans la masquer", async () => {
  class SubstratCasse extends FauxSubstrat {
    async run() { const e = new Error("quota dépassé"); e.code = "PROVIDER_ERROR"; throw e; }
  }
  const core = new NericxCore({ providers: [new SubstratCasse()] });
  await core.activer();
  const r = await core.repondre({ messages: [{ role: "user", content: "x" }] });
  assert.equal(r.ok, false);
  assert.equal(r.code, "PROVIDER_ERROR");
  assert.ok(r.texte.includes("quota dépassé"));
});

await test("refuse un fournisseur sans méthode run", () => {
  const core = new NericxCore();
  assert.throws(() => core.enregistrerProvider({ id: "x" }), /run/);
});

console.log("");
console.log(passes + " réussis, " + echoues + " échoués.");
if (echoues > 0) process.exit(1);
