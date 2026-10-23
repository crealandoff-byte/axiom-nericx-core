/**
 * Tests du registre de capacités.
 * Exécution : node tests/registre.test.mjs
 */

import assert from "node:assert/strict";
import { ProviderRegistry } from "../services/axiom-core/ProviderRegistry.js";
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

class P extends InferenceProvider {
  constructor(id, sante) { super(); this._id = id; this._sante = sante; }
  get id() { return this._id; }
  get version() { return "2.1.0"; }
  async health() { return this._sante; }
  async run() { return { text: "ok" }; }
}

console.log("ProviderRegistry");

await test("refuse un fournisseur sans identifiant", () => {
  const r = new ProviderRegistry();
  assert.throws(() => r.enregistrer({}), /identifiant/);
});

await test("une capacité enregistrée a_connecter n'est pas active", () => {
  const r = new ProviderRegistry();
  r.enregistrer(new P("p1", { ok: true }), { capacite: "text", statut: "a_connecter" });
  const c = r.etat()[0];
  assert.equal(c.actif, false);
  assert.equal(c.statut, "a_connecter");
});

await test("seule une capacité active est marquée actif", () => {
  const r = new ProviderRegistry();
  r.enregistrer(new P("p1", { ok: true }), { capacite: "text", statut: "active" });
  assert.equal(r.etat()[0].actif, true);
});

await test("la sonde agrège sans jamais lever", async () => {
  const r = new ProviderRegistry();
  r.enregistrer(new P("bon", { ok: true }), { capacite: "text", statut: "active" });
  r.enregistrer(new P("mauvais", { ok: false, reason: "clé absente" }), { capacite: "image", statut: "a_connecter" });
  const s = await r.sonder();
  assert.equal(s.bon.ok, true);
  assert.equal(s.mauvais.ok, false);
  assert.equal(s.mauvais.reason, "clé absente");
});

await test("la sonde capture une exception de health()", async () => {
  const r = new ProviderRegistry();
  class Explose extends P {
    async health() { throw new Error("réseau coupé"); }
  }
  r.enregistrer(new Explose("casse", null), { capacite: "text" });
  const s = await r.sonder();
  assert.equal(s.casse.ok, false);
  assert.ok(s.casse.reason.includes("réseau coupé"));
});

await test("l'état expose la version du contrat", () => {
  const r = new ProviderRegistry();
  r.enregistrer(new P("p1", { ok: true }), { capacite: "text", statut: "active", contrat: "InferenceProvider v1" });
  assert.equal(r.etat()[0].version, "2.1.0");
  assert.equal(r.etat()[0].contrat, "InferenceProvider v1");
});

await test("l'état est trié par nom de capacité", () => {
  const r = new ProviderRegistry();
  r.enregistrer(new P("p1", { ok: true }), { capacite: "video" });
  r.enregistrer(new P("p2", { ok: true }), { capacite: "audio" });
  r.enregistrer(new P("p3", { ok: true }), { capacite: "image" });
  assert.deepEqual(r.etat().map((c) => c.capacite), ["audio", "image", "video"]);
});

await test("obtenir renvoie null pour un id inconnu", () => {
  const r = new ProviderRegistry();
  assert.equal(r.obtenir("fantome"), null);
});

console.log("");
console.log(passes + " réussis, " + echoues + " échoués.");
if (echoues > 0) process.exit(1);
