# AXIOM NÉRICX Platform — Noyau v0.2

Néricx est l'intelligence centrale fonctionnelle du système AXIOM. Le modèle
de langage est son **substrat d'inférence** — un composant technique
remplaçable — et non l'identité du système. Les moteurs image, audio, vidéo et
jeux sont des **capacités connectées**, subordonnées au noyau.

Ce paquet est une **v0.2** : le noyau, les adaptateurs, les tests et l'interface
sont réels et exécutables. Les capacités image / audio / vidéo restent
déclarées « à connecter » — ni simulées, ni présentées comme disponibles.

## Ce qui fonctionne réellement ici

Ces éléments ont été **exécutés** dans un environnement Node.js :

- `NericxCore` — orchestration en 9 étapes, avec trace de décision complète.
- `InferenceProvider` — contrat abstrait du substrat, sans nom de fournisseur.
- `OpenAIProvider` — adaptateur réel (Responses API), clé lue côté serveur.
- `ProviderRegistry` — état des capacités ; une capacité n'est `active`
  qu'après une sonde de santé réussie.
- `MemoireAxiom` — traces avec provenance, statut épistémique et révision.
- **30 tests automatiques**, tous verts.
- `/api/health` et `/api/chat` — fonctions Netlify vérifiées en exécution réelle.
- Interface web : page, styles, client du chat.

## Ce qui n'est PAS connecté

| Capacité | Statut | Ce qu'il faudrait |
|---|---|---|
| `text` | **à connecter** | `OPENAI_API_KEY` dans l'environnement Netlify |
| `image` | à connecter | adaptateur + fournisseur + contrat documenté |
| `audio` | à connecter | adaptateur STT/TTS/musique |
| `video` | à connecter | adaptateur + gestion de tâches asynchrones |
| Game Lab | prototype futur | éditeur Three.js original |

Le noyau ne prétend jamais qu'une de ces capacités existe : `/api/health` les
renvoie toutes en `a_connecter` tant qu'aucun adaptateur ne les fournit.

## Tests — résultats réels

```
$ npm test

MemoireAxiom
  9 réussis, 0 échoués.

NericxCore
  13 réussis, 0 échoués.

ProviderRegistry
  8 réussis, 0 échoués.
```

Trois de ces tests vérifient les règles d'identité plutôt que du code ordinaire :

- **« s'abstient quand aucun substrat n'est enregistré »** — sans clé, le
  noyau répond `SUBSTRAT_INDISPONIBLE` et n'invente rien.
- **« refuse une demande vide sans appeler le substrat »** — aucun appel
  facturé pour une requête vide.
- **« déclare les capacités non connectées au lieu de les omettre »** — la
  règle AXIOM « une fonction manquante est affichée comme à connecter ».

## Déploiement

1. Importer ce dépôt dans Netlify.
2. **Site configuration → Environment variables** :
   - `OPENAI_API_KEY` — obligatoire pour que le chat réponde.
   - `AXIOM_MODEL` — optionnel ; un défaut est appliqué si absent.
   - `AXIOM_BASE_URL` — optionnel ; utile pour un proxy.
3. Déployer. `publish = public`, `functions = netlify/functions`.
4. Ouvrir `/` et vérifier l'indicateur : il passe au vert si la clé est valide.

**La clé API ne doit jamais apparaître dans le navigateur ni dans Git.**
`.gitignore` exclut `.env`. Le client ne connaît que `/api/chat` et
`/api/health` : il n'envoie que du texte et ne peut pas choisir le modèle.

## Développement local

```bash
npm install
export OPENAI_API_KEY="..."   # jamais dans un fichier commité
npx netlify dev
```

## Structure

```
services/axiom-core/
  InferenceProvider.js   contrat du substrat (aucun fournisseur nommé)
  NericxCore.js          orchestration, identité, règles de vérité, trace
  ProviderRegistry.js    état des capacités
  MemoireAxiom.js        traces, provenance, statut épistémique, révision
providers/text/
  OpenAIProvider.js      adaptateur Responses API
netlify/functions/
  chat.mjs               POST /api/chat
  health.mjs             GET /api/health
public/
  index.html  styles.css  app.js
tests/
  memoire.test.mjs  noyau.test.mjs  registre.test.mjs
```

## Limites honnêtes de cette version

- **Pas d'authentification** : toute personne ayant l'URL peut consommer l'API.
- **Pas de rate limiting ni de quota** : un usage abusif coûte de l'argent réel.
- **Mémoire en RAM** : elle ne survit pas au redémarrage de la fonction.
  Le format est correct et testé ; la base relationnelle est l'étape suivante.
- **Pas de journalisation persistante** ni de contrôle de coût cumulé.
- **Pas de `InferenceProvider` image/audio/vidéo** : le registre les déclare
  absents plutôt que de les simuler.
- **Pas de Game Lab**, pas de pont Godot, pas d'éditeur 3D.
- L'estimation de coût utilise un tarif d'ordre de grandeur, à recalibrer.

**Ne pas exposer publiquement sans authentification et limitation de débit.**

## Prochaines étapes, dans l'ordre

1. Authentification + sessions + base de données.
2. Rate limiting, quotas, journalisation, contrôle des coûts.
3. Mémoire persistante avec recherche sémantique et correction versionnée.
4. Registre d'outils avec permissions, schémas JSON et confirmation avant
   action sensible.
5. Adaptateurs image et audio (audio avant vidéo).
6. Éditeur de scènes 3D web original (Three.js).
7. Pont Godot pour le runtime de jeu complet.
8. Évaluation d'un modèle spécialisé, seulement avec un corpus licite et un
   budget définis.
