import {
  loadKnowledgeBase,
  type KnowledgeChunk,
} from "@/server/rag/knowledge-base";
import type { Citation } from "@/lib/types/chat";

/**
 * Retriever BM25 em memória. É o plano B quando o serviço Python de RAG não
 * está de pé, para que a aplicação Next funcione sozinha.
 */

const STOPWORDS = new Set([
  "a", "ao", "aos", "as", "às", "com", "como", "da", "das", "de", "dela",
  "dele", "do", "dos", "e", "ela", "ele", "em", "entre", "essa", "esse",
  "esta", "este", "eu", "foi", "há", "isso", "já", "mais", "mas", "me",
  "mesmo", "meu", "minha", "muito", "na", "nas", "no", "nos", "não", "num",
  "numa", "o", "os", "ou", "para", "pela", "pelo", "por", "qual", "quando",
  "que", "quem", "se", "sem", "ser", "seu", "sua", "são", "só", "também",
  "te", "tem", "um", "uma", "vc", "você", "sobre", "the", "of",
]);

const K1 = 1.5;
const B = 0.75;

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function tokenize(text: string): string[] {
  return normalize(text)
    .replace(/[^a-z0-9\s%]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

interface IndexedChunk {
  chunk: KnowledgeChunk;
  tokens: string[];
  frequencies: Map<string, number>;
  length: number;
}

let index: {
  chunks: IndexedChunk[];
  documentFrequency: Map<string, number>;
  averageLength: number;
} | null = null;

async function buildIndex() {
  if (index && process.env.NODE_ENV === "production") return index;

  const { chunks } = await loadKnowledgeBase();

  const indexed: IndexedChunk[] = chunks.map((chunk) => {
    // Título, cabeçalho e tags entram no índice com peso extra.
    const tokens = tokenize(
      `${chunk.title} ${chunk.title} ${chunk.heading} ${chunk.heading} ${chunk.tags.join(" ")} ${chunk.text}`
    );
    const frequencies = new Map<string, number>();
    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    }
    return { chunk, tokens, frequencies, length: tokens.length };
  });

  const documentFrequency = new Map<string, number>();
  for (const item of indexed) {
    for (const token of new Set(item.tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  const averageLength =
    indexed.reduce((total, item) => total + item.length, 0) /
    Math.max(indexed.length, 1);

  index = { chunks: indexed, documentFrequency, averageLength };
  return index;
}

export async function searchLocal(
  query: string,
  topK = 4
): Promise<Citation[]> {
  const built = await buildIndex();
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const totalDocs = built.chunks.length;

  const scored = built.chunks.map((item) => {
    let score = 0;

    for (const token of queryTokens) {
      const frequency = item.frequencies.get(token);
      if (!frequency) continue;

      const df = built.documentFrequency.get(token) ?? 0;
      const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
      const denominator =
        frequency + K1 * (1 - B + (B * item.length) / built.averageLength);

      score += idf * ((frequency * (K1 + 1)) / denominator);
    }

    return { item, score };
  });

  const best = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const maxScore = best[0]?.score ?? 1;

  return best.map((entry) => ({
    docId: entry.item.chunk.docId,
    title: `${entry.item.chunk.title} — ${entry.item.chunk.heading}`,
    snippet: entry.item.chunk.text.slice(0, 480),
    score: Number((entry.score / maxScore).toFixed(3)),
    source: entry.item.chunk.source,
  }));
}
