/**
 * Tests de la mémoire AXIOM.
 * Exécution : node tests/memoire.test.mjs
 * Aucune dépendance externe : le starter n'installe rien de plus.
 */

import assert from "node:assert/strict";
import { MemoireAxiom, STATUTS } from "../services/axiom-core/MemoireAxiom.js";

let passes = 0, echoues = 0;
function test(nom, fn) {
  try {
    fn();
    console.log("  PASS  " + nom);
    passes++;
  } catch (e) {
    console.log("  FAIL  " + nom + " — " + (e && e.message));
    echoues++;
  }
}

console.log("MemoireAxiom");

test("enregistre un episode avec provenance et statut", () => {
  const m = new MemoireAxiom();
  const e = m.enregistrer({
    sujet: "test",
    contenu: "contenu",
    provenance: "unitaire",
    statut: "fait",
    confiance: 0.9,
  });
  assert.equal(e.statut, "fait");
  assert.equal(e.provenance, "unitaire");
  assert.equal(e.confiance, 0.9);
  assert.equal(e.revision, 0);
  assert.ok(e.id.startsWith("E-"));
});

test("refuse un statut inconnu et retombe sur hypothese", () => {
  const m = new MemoireAxiom();
  const e = m.enregistrer({ sujet: "s", contenu: "c", statut: "certitude_absolue" });
  assert.equal(e.statut, "hypothese");
  assert.ok(STATUTS.includes(e.statut));
});

test("borne la confiance entre 0 et 1", () => {
  const m = new MemoireAxiom();
  assert.equal(m.enregistrer({ sujet: "s", contenu: "c", confiance: 5 }).confiance, 1);
  assert.equal(m.enregistrer({ sujet: "s", contenu: "c", confiance: -3 }).confiance, 0);
});

test("reviser incremente la revision et trace le motif", () => {
  const m = new MemoireAxiom();
  const e = m.enregistrer({ sujet: "s", contenu: "avant", statut: "hypothese" });
  const r = m.reviser(e.id, { contenu: "apres", statut: "fait", motif: "verification" });
  assert.equal(r.contenu, "apres");
  assert.equal(r.statut, "fait");
  assert.equal(r.revision, 1);
  assert.equal(r.motifRevision, "verification");
  assert.ok(r.reviseLe !== null);
});

test("reviser un id inconnu renvoie null sans lever", () => {
  const m = new MemoireAxiom();
  assert.equal(m.reviser("E-9999", { contenu: "x" }), null);
});

test("respecte la limite et oublie les plus anciens", () => {
  const m = new MemoireAxiom({ limite: 3 });
  for (let i = 0; i < 6; i++) m.enregistrer({ sujet: "s" + i, contenu: "c" });
  assert.equal(m.taille, 3);
});

test("rechercher trouve par mot et classe par score", () => {
  const m = new MemoireAxiom();
  m.enregistrer({ sujet: "rochel", contenu: "aquarium poisson" });
  m.enregistrer({ sujet: "autre", contenu: "aquarium aquarium aquarium" });
  const r = m.rechercher("aquarium");
  assert.equal(r.length, 2);
  assert.ok(r[0].contenu.includes("aquarium aquarium aquarium"));
});

test("rechercher ignore les mots trop courts", () => {
  const m = new MemoireAxiom();
  m.enregistrer({ sujet: "ab", contenu: "cd" });
  assert.equal(m.rechercher("ab").length, 0);
});

test("rechercher sur requete vide ne renvoie rien", () => {
  const m = new MemoireAxiom();
  m.enregistrer({ sujet: "quelque chose", contenu: "du contenu" });
  assert.equal(m.rechercher("").length, 0);
});

console.log("");
console.log(passes + " réussis, " + echoues + " échoués.");
if (echoues > 0) process.exit(1);
