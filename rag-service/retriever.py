"""Retriever híbrido: BM25 léxico + similaridade densa opcional.

Sem dependências pesadas obrigatórias. Se `sentence-transformers` estiver
instalado, o serviço adiciona um sinal semântico ao ranking; caso contrário,
usa TF-IDF de bigramas como aproximação e o BM25 continua carregando o peso.
"""

from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter
from typing import Dict, List, Optional, Sequence, Tuple

from knowledge import Chunk

K1 = 1.5
B = 0.75
BM25_WEIGHT = 0.65
DENSE_WEIGHT = 0.35

STOPWORDS = {
    "a", "ao", "aos", "as", "às", "com", "como", "da", "das", "de", "dela",
    "dele", "do", "dos", "e", "ela", "ele", "em", "entre", "essa", "esse",
    "esta", "este", "eu", "foi", "há", "isso", "já", "mais", "mas", "me",
    "mesmo", "meu", "minha", "muito", "na", "nas", "no", "nos", "não", "num",
    "numa", "o", "os", "ou", "para", "pela", "pelo", "por", "qual", "quando",
    "que", "quem", "se", "sem", "ser", "seu", "sua", "são", "só", "também",
    "te", "tem", "um", "uma", "você", "sobre",
}


def _strip_accents(text: str) -> str:
    normalized = unicodedata.normalize("NFD", text)
    return "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")


def tokenize(text: str) -> List[str]:
    lowered = _strip_accents(text.lower())
    raw = re.sub(r"[^a-z0-9\s%]", " ", lowered).split()
    return [token for token in raw if len(token) > 2 and token not in STOPWORDS]


def _bigrams(tokens: Sequence[str]) -> List[str]:
    return ["{}_{}".format(tokens[i], tokens[i + 1]) for i in range(len(tokens) - 1)]


class HybridRetriever:
    """Índice em memória reconstruído a cada reindex."""

    def __init__(self, chunks: List[Chunk], use_embeddings: bool = True) -> None:
        self.chunks = chunks
        self.tokenized: List[List[str]] = []
        self.frequencies: List[Counter] = []
        self.lengths: List[int] = []
        self.document_frequency: Counter = Counter()
        self.tfidf_vectors: List[Dict[str, float]] = []
        self.embeddings = None
        self.embedding_model_name: Optional[str] = None

        for chunk in chunks:
            # Título, cabeçalho e tags entram no índice com peso extra.
            enriched = "{} {} {} {} {}".format(
                chunk.title, chunk.title, chunk.heading, " ".join(chunk.tags), chunk.text
            )
            tokens = tokenize(enriched)
            self.tokenized.append(tokens)
            self.frequencies.append(Counter(tokens))
            self.lengths.append(len(tokens))
            for token in set(tokens):
                self.document_frequency[token] += 1

        self.total_docs = max(len(chunks), 1)
        self.average_length = (
            sum(self.lengths) / self.total_docs if self.lengths else 1.0
        )

        self._build_tfidf()
        if use_embeddings:
            self._try_build_embeddings()

    # -- BM25 -----------------------------------------------------------------

    def _bm25_scores(self, query_tokens: Sequence[str]) -> List[float]:
        scores = [0.0] * len(self.chunks)

        for index, frequencies in enumerate(self.frequencies):
            score = 0.0
            length = self.lengths[index] or 1
            for token in query_tokens:
                frequency = frequencies.get(token, 0)
                if not frequency:
                    continue
                df = self.document_frequency.get(token, 0)
                idf = math.log(1 + (self.total_docs - df + 0.5) / (df + 0.5))
                denominator = frequency + K1 * (
                    1 - B + B * length / self.average_length
                )
                score += idf * (frequency * (K1 + 1) / denominator)
            scores[index] = score

        return scores

    # -- TF-IDF de bigramas (proxy semântico sem dependências) ----------------

    def _build_tfidf(self) -> None:
        grams_per_doc: List[List[str]] = []
        document_frequency: Counter = Counter()

        for tokens in self.tokenized:
            grams = tokens + _bigrams(tokens)
            grams_per_doc.append(grams)
            for gram in set(grams):
                document_frequency[gram] += 1

        self._gram_document_frequency = document_frequency

        for grams in grams_per_doc:
            counts = Counter(grams)
            vector: Dict[str, float] = {}
            for gram, count in counts.items():
                df = document_frequency.get(gram, 1)
                idf = math.log(1 + self.total_docs / df)
                vector[gram] = (1 + math.log(count)) * idf
            norm = math.sqrt(sum(value * value for value in vector.values())) or 1.0
            self.tfidf_vectors.append(
                {gram: value / norm for gram, value in vector.items()}
            )

    def _tfidf_scores(self, query_tokens: Sequence[str]) -> List[float]:
        grams = list(query_tokens) + _bigrams(query_tokens)
        counts = Counter(grams)
        query_vector: Dict[str, float] = {}

        for gram, count in counts.items():
            df = self._gram_document_frequency.get(gram, 1)
            idf = math.log(1 + self.total_docs / df)
            query_vector[gram] = (1 + math.log(count)) * idf

        norm = math.sqrt(sum(value * value for value in query_vector.values())) or 1.0
        query_vector = {gram: value / norm for gram, value in query_vector.items()}

        scores = []
        for vector in self.tfidf_vectors:
            # Itera sobre o menor dos dois vetores esparsos.
            if len(query_vector) < len(vector):
                score = sum(
                    weight * vector.get(gram, 0.0)
                    for gram, weight in query_vector.items()
                )
            else:
                score = sum(
                    weight * query_vector.get(gram, 0.0)
                    for gram, weight in vector.items()
                )
            scores.append(score)

        return scores

    # -- Embeddings opcionais -------------------------------------------------

    def _try_build_embeddings(self) -> None:
        try:
            from sentence_transformers import SentenceTransformer  # type: ignore
        except Exception:
            return

        try:
            model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
            self._model = SentenceTransformer(model_name)
            texts = [
                "{} {} {}".format(chunk.title, chunk.heading, chunk.text)
                for chunk in self.chunks
            ]
            self.embeddings = self._model.encode(
                texts, normalize_embeddings=True, show_progress_bar=False
            )
            self.embedding_model_name = model_name
        except Exception:
            self.embeddings = None
            self.embedding_model_name = None

    def _embedding_scores(self, query: str) -> Optional[List[float]]:
        if self.embeddings is None:
            return None
        try:
            vector = self._model.encode([query], normalize_embeddings=True)[0]
            return [float(row.dot(vector)) for row in self.embeddings]
        except Exception:
            return None

    # -- Busca ----------------------------------------------------------------

    def search(self, query: str, top_k: int = 4) -> List[Tuple[Chunk, float, Dict[str, float]]]:
        query_tokens = tokenize(query)
        if not query_tokens or not self.chunks:
            return []

        lexical = _normalize(self._bm25_scores(query_tokens))
        dense = self._embedding_scores(query)
        dense = _normalize(dense) if dense else _normalize(self._tfidf_scores(query_tokens))

        combined = [
            BM25_WEIGHT * lexical[i] + DENSE_WEIGHT * dense[i]
            for i in range(len(self.chunks))
        ]

        ranked = sorted(
            range(len(combined)), key=lambda i: combined[i], reverse=True
        )

        results = []
        for index in ranked[:top_k]:
            if combined[index] <= 0:
                continue
            results.append(
                (
                    self.chunks[index],
                    round(combined[index], 4),
                    {
                        "lexical": round(lexical[index], 4),
                        "dense": round(dense[index], 4),
                    },
                )
            )

        return results


def _normalize(values: List[float]) -> List[float]:
    if not values:
        return values
    highest = max(values)
    if highest <= 0:
        return [0.0 for _ in values]
    return [value / highest for value in values]
