"""Serviço de RAG da aplicação AI Conversacional.

Expõe busca híbrida sobre a base de conhecimento em Markdown compartilhada com
o app Next.js. Rode com:

    uvicorn main:app --reload --port 8000

e aponte RAG_SERVICE_URL=http://localhost:8000 no .env do Next.
"""

from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import Dict, List, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from knowledge import load_knowledge_base
from retriever import HybridRetriever

KNOWLEDGE_DIR = os.environ.get(
    "KNOWLEDGE_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "knowledge-base"),
)
USE_EMBEDDINGS = os.environ.get("RAG_USE_EMBEDDINGS", "1") not in {"0", "false"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    _build_index()
    yield


app = FastAPI(
    title="AI Conversacional — RAG Service",
    description="Busca híbrida (BM25 + densa) na base de conhecimento de crédito.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("RAG_ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2, description="Pergunta em linguagem natural")
    top_k: int = Field(4, ge=1, le=20)


class SearchResult(BaseModel):
    doc_id: str
    title: str
    snippet: str
    score: float
    source: str
    signals: Dict[str, float]


class SearchResponse(BaseModel):
    query: str
    engine: str
    took_ms: float
    results: List[SearchResult]


class DocumentInfo(BaseModel):
    id: str
    title: str
    source: str
    tags: List[str]
    chunk_count: int
    characters: int


class HealthResponse(BaseModel):
    status: str
    documents: int
    chunks: int
    embedding_model: Optional[str]
    knowledge_dir: str


class State:
    retriever: Optional[HybridRetriever] = None
    documents: List = []


state = State()


def _build_index() -> None:
    chunks, documents = load_knowledge_base(os.path.abspath(KNOWLEDGE_DIR))
    state.retriever = HybridRetriever(chunks, use_embeddings=USE_EMBEDDINGS)
    state.documents = documents


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    retriever = state.retriever
    return HealthResponse(
        status="ok" if retriever and retriever.chunks else "empty",
        documents=len(state.documents),
        chunks=len(retriever.chunks) if retriever else 0,
        embedding_model=retriever.embedding_model_name if retriever else None,
        knowledge_dir=os.path.abspath(KNOWLEDGE_DIR),
    )


@app.get("/documents", response_model=List[DocumentInfo])
def documents() -> List[DocumentInfo]:
    return [
        DocumentInfo(
            id=document.id,
            title=document.title,
            source=document.source,
            tags=document.tags,
            chunk_count=document.chunk_count,
            characters=document.characters,
        )
        for document in state.documents
    ]


@app.post("/reindex", response_model=HealthResponse)
def reindex() -> HealthResponse:
    _build_index()
    return health()


@app.post("/search", response_model=SearchResponse)
def search(payload: SearchRequest) -> SearchResponse:
    started = time.perf_counter()
    retriever = state.retriever

    if retriever is None:
        _build_index()
        retriever = state.retriever

    hits = retriever.search(payload.query, payload.top_k) if retriever else []

    results = [
        SearchResult(
            doc_id=chunk.doc_id,
            title="{} — {}".format(chunk.title, chunk.heading),
            snippet=chunk.text[:480],
            score=score,
            source=chunk.source,
            signals=signals,
        )
        for chunk, score, signals in hits
    ]

    engine = "hybrid-embeddings" if retriever and retriever.embeddings is not None else "hybrid-lexical"

    return SearchResponse(
        query=payload.query,
        engine=engine,
        took_ms=round((time.perf_counter() - started) * 1000, 2),
        results=results,
    )
