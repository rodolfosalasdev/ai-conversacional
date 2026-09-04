"""Carregamento e chunking da base de conhecimento em Markdown.

Espelha o comportamento de src/server/rag/knowledge-base.ts para que o resultado
do serviço Python e o do fallback em TypeScript sejam comparáveis.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Tuple

MAX_CHUNK_CHARS = 900


@dataclass
class Chunk:
    id: str
    doc_id: str
    title: str
    source: str
    heading: str
    text: str
    tags: List[str] = field(default_factory=list)


@dataclass
class Document:
    id: str
    title: str
    source: str
    tags: List[str]
    chunk_count: int
    characters: int


def _parse_front_matter(raw: str) -> Tuple[Dict[str, object], str]:
    if not raw.startswith("---"):
        return {}, raw

    end = raw.find("\n---", 3)
    if end == -1:
        return {}, raw

    header = raw[3:end]
    body = raw[end + 4 :].lstrip()
    front: Dict[str, object] = {}

    for line in header.split("\n"):
        match = re.match(r"^(\w+):\s*(.*)$", line)
        if not match:
            continue
        key, value = match.group(1), match.group(2).strip()
        if key == "tags":
            front[key] = [
                tag.strip() for tag in value.strip("[]").split(",") if tag.strip()
            ]
        else:
            front[key] = value

    return front, body


def _chunk_by_heading(body: str) -> List[Tuple[str, str]]:
    sections: List[Tuple[str, List[str]]] = []
    current_heading = "Introdução"
    current_lines: List[str] = []

    for line in body.split("\n"):
        heading = re.match(r"^#{1,3}\s+(.*)$", line)
        if heading:
            if "".join(current_lines).strip():
                sections.append((current_heading, current_lines))
            current_heading = heading.group(1).strip()
            current_lines = []
            continue
        current_lines.append(line)

    if "".join(current_lines).strip():
        sections.append((current_heading, current_lines))

    chunks: List[Tuple[str, str]] = []
    for heading, lines in sections:
        text = "\n".join(lines).strip()
        if not text:
            continue

        if len(text) <= MAX_CHUNK_CHARS:
            chunks.append((heading, text))
            continue

        buffer = ""
        for paragraph in re.split(r"\n{2,}", text):
            if len(buffer) + len(paragraph) > MAX_CHUNK_CHARS and buffer:
                chunks.append((heading, buffer.strip()))
                buffer = ""
            buffer += paragraph + "\n\n"
        if buffer.strip():
            chunks.append((heading, buffer.strip()))

    return chunks


def load_knowledge_base(directory: str) -> Tuple[List[Chunk], List[Document]]:
    chunks: List[Chunk] = []
    documents: List[Document] = []

    if not os.path.isdir(directory):
        return chunks, documents

    for filename in sorted(os.listdir(directory)):
        if not filename.endswith(".md"):
            continue

        path = os.path.join(directory, filename)
        with open(path, "r", encoding="utf-8") as handle:
            raw = handle.read()

        front, body = _parse_front_matter(raw)
        doc_id = filename[:-3]
        title = str(front.get("title", doc_id))
        source = str(front.get("source", "Base de conhecimento interna"))
        tags = list(front.get("tags", []))  # type: ignore[arg-type]

        doc_chunks = _chunk_by_heading(body)
        for index, (heading, text) in enumerate(doc_chunks):
            chunks.append(
                Chunk(
                    id="{}#{}".format(doc_id, index),
                    doc_id=doc_id,
                    title=title,
                    source=source,
                    heading=heading,
                    text=text,
                    tags=tags,
                )
            )

        documents.append(
            Document(
                id=doc_id,
                title=title,
                source=source,
                tags=tags,
                chunk_count=len(doc_chunks),
                characters=len(body),
            )
        )

    return chunks, documents
