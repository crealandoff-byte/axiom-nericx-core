import { InferenceProvider } from "../../services/axiom-core/InferenceProvider.js";

/**
 * Adaptateur OpenAI (Responses API).
 *
 * Ne contient AUCUNE règle d'identité : il traduit un appel générique
 * en appel HTTP. C'est le Core qui décide quoi dire et à qui.
 * La clé vient de l'environnement serveur, jamais du client.
 */

const DEFAULT_MODEL = process.env.AXIOM_MODEL || "gpt-6.1-sol";
const DEFAULT_BASE = process.env.AXIOM_BASE_URL || "https://api.openai.com/v1";

export class OpenAIProvider extends InferenceProvider {
  constructor({ apiKey, model, baseUrl } = {}) {
    super();
    this._apiKey = apiKey || process.env.OPENAI_API_KEY || "";
    this._model = model || DEFAULT_MODEL;
    this._baseUrl = baseUrl || DEFAULT_BASE;
  }

  get id() { return "openai-responses"; }
  get version() { return "1.0.0"; }

  get capabilities() {
    return { text: true, image: false, audio: false, video: false, streaming: true };
  }

  get model() { return this._model; }

  async health() {
    if (!this._apiKey) {
      return { ok: false, reason: "OPENAI_API_KEY absente de l'environnement serveur" };
    }
    return { ok: true, provider: this.id, model: this._model };
  }

  estimateCost(input) {
    // Estimation grossière et annoncée comme telle : ~4 caractères par token.
    const texte = this._aplatir(input);
    const tokensEntree = Math.ceil(texte.length / 4);
    const tokensSortie = Math.min(input?.maxOutputTokens || 1200, 1200);
    // Tarif d'ordre de grandeur, à recalibrer avec les vrais tarifs du compte.
    const montant = (tokensEntree * 0.0000025) + (tokensSortie * 0.00001);
    return {
      unit: "USD_estime",
      amount: Number(montant.toFixed(6)),
      tokensEntree,
      tokensSortie,
      note: "Estimation indicative, non contractuelle.",
    };
  }

  _aplatir(input) {
    if (!input) return "";
    if (typeof input === "string") return input;
    const morceaux = [];
    if (input.instructions) morceaux.push(input.instructions);
    for (const m of input.messages || []) {
      morceaux.push(typeof m.content === "string" ? m.content : JSON.stringify(m.content));
    }
    return morceaux.join("\n");
  }

  _construireCorps(input) {
    const corps = {
      model: this._model,
      input: (input.messages || []).map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
      })),
    };
    if (input.instructions) corps.instructions = input.instructions;
    if (input.maxOutputTokens) corps.max_output_tokens = input.maxOutputTokens;
    if (input.temperature !== undefined) corps.temperature = input.temperature;
    return corps;
  }

  _extraireTexte(donnees) {
    if (!donnees) return "";
    if (typeof donnees.output_text === "string" && donnees.output_text) {
      return donnees.output_text;
    }
    const sorties = donnees.output || [];
    const textes = [];
    for (const bloc of sorties) {
      for (const c of bloc.content || []) {
        if (typeof c.text === "string") textes.push(c.text);
        else if (c.type === "output_text" && typeof c.text === "string") textes.push(c.text);
      }
    }
    return textes.join("\n").trim();
  }

  async run(input, signal) {
    if (!this._apiKey) {
      const err = new Error("Clé API absente côté serveur : OPENAI_API_KEY n'est pas configurée.");
      err.code = "NO_API_KEY";
      throw err;
    }

    const debut = Date.now();
    const reponse = await fetch(this._baseUrl + "/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + this._apiKey,
      },
      body: JSON.stringify(this._construireCorps(input)),
      signal,
    });

    const texteBrut = await reponse.text();
    let donnees = null;
    try { donnees = JSON.parse(texteBrut); } catch { /* réponse non JSON */ }

    if (!reponse.ok) {
      const message =
        (donnees && donnees.error && donnees.error.message) ||
        texteBrut.slice(0, 400) ||
        "Erreur HTTP " + reponse.status;
      const err = new Error(message);
      err.code = "PROVIDER_ERROR";
      err.status = reponse.status;
      throw err;
    }

    return {
      text: this._extraireTexte(donnees),
      usage: (donnees && donnees.usage) || null,
      provider: this.id,
      model: this._model,
      latencyMs: Date.now() - debut,
    };
  }
}
