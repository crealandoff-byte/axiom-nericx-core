# Architecture — AXIOM NÉRICX (noyau v0.2)

## Néricx est l'intelligence centrale

Néricx n'est pas une façade devant une collection d'IA indépendantes. C'est
l'identité fonctionnelle du système : orchestration, continuité, mémoire,
évaluation, choix des outils et supervision des résultats. Le modèle de langage
est le substrat d'inférence qui lui permet de produire du langage ; il ne doit
pas être présenté comme une identité concurrente.

### Trois niveaux à ne pas confondre

| Niveau | Où il vit dans le code | Remplaçable ? |
|---|---|---|
| **1. Identité système — Néricx / AXIOM** | `services/axiom-core/NericxCore.js` | Non — c'est la continuité du système |
| **2. Substrat d'inférence LLM** | `providers/text/OpenAIProvider.js` | **Oui** — derrière `InferenceProvider` |
| **3. Capacités connectées** | `providers/*`, `connectors/*` | Oui — chaque adaptateur est isolé |

**Vérification concrète** : `NericxCore.js` ne contient le nom d'aucun
fournisseur. Il parle à `InferenceProvider`. Remplacer le substrat consiste à
écrire un nouvel adaptateur et à l'enregistrer — le Core ne change pas.

## Principes appliqués dans ce code

1. **Noyau indépendant des fournisseurs** — aucune référence à un fournisseur
   dans `axiom-core/`.
2. **Adaptateur remplaçable et versionné** — chaque fournisseur expose `id`,
   `version`, `capabilities`, `health()`, `estimateCost()`, `run()`.
3. **Aucune clé privée dans le navigateur** — la clé est lue depuis
   `process.env` uniquement dans `netlify/functions/` et `providers/`.
4. **Action externe avec permissions et journalisation** — la trace en 9 étapes
   est renvoyée au client ; rien n'est présenté comme magique.
5. **Mémoire avec provenance et correction** — `MemoireAxiom` porte `statut`
   (`fait` / `modele` / `hypothese`), `confiance`, `provenance`, `revision`.
6. **Distinction faits / modèles / hypothèses** — inscrite dans les instructions
   système et dans le schéma de mémoire.
7. **Pas de simulation de conscience** — une règle de vérité explicite
   l'interdit, et un test automatique vérifie que la règle est présente.

## Contrat de connecteur

```js
class InferenceProvider {
  get id()            // identifiant stable
  get version()       // sémantique
  get capabilities()  // { text, image, audio, video, streaming }
  async health()      // sonde, ne consomme pas de tokens
  estimateCost(input) // coût AVANT exécution
  async run(input, signal)          // appel synchrone
  async submitJob(input)            // tâches longues (optionnel)
  async getJob(jobId)               // suivi (optionnel)
  async cancelJob(jobId)            // annulation (optionnel)
}
```

## Boucle de fonctionnement

Implémentée dans `NericxCore.repondre()`, chaque étape est journalisée dans
`trace.etapes` :

1. Recevoir la demande et son contexte.
2. Interpréter l'objectif — une demande vide s'arrête ici, sans appel facturé.
3. Consulter la mémoire pertinente avec provenance.
4. Planifier — vérifier quel substrat est réellement actif.
5. Choisir les capacités et vérifier leurs permissions.
6. Exécuter — **ou s'abstenir** si aucune capacité ne le permet.
7. Vérifier le résultat et son incertitude.
8. Enregistrer les traces utiles.
9. Réviser si le résultat est inexploitable.

## Pourquoi le noyau s'abstient au lieu d'improviser

C'est la conséquence directe de la règle « Ne pas prétendre qu'une capacité
existe avant son implémentation et ses tests ». Concrètement : si
`OPENAI_API_KEY` est absente, `repondre()` renvoie `SUBSTRAT_INDISPONIBLE` avec
un message d'action, et **n'appelle rien**. Deux tests automatiques couvrent ce
comportement.

## Netlify

Netlify sert l'interface et les API rapides. Les fonctions synchrones ont une
durée limitée (`netlify.toml` fixe `timeout = 26` pour `/api/chat`). Les gros
traitements GPU, les serveurs de jeu persistants et les longues sessions temps
réel devront aller sur un service adapté.

## Stratégie moteur graphique

Ne rien cloner du code, des assets, des interfaces ni des marques de Unity,
Godot ou Roblox Studio.

1. Éditeur web original en Three.js (objets, gizmos, caméra, matériaux,
   hiérarchie, sauvegarde JSON).
2. Système de composants, scripts, collisions, import GLTF/GLB, animations.
3. Pont Godot pour les projets exigeant un runtime complet et un export
   multi-plateforme.
4. Runtime propriétaire seulement si besoins, budget, performances et
   maintenance le justifient.
