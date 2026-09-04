# RAG Service (Python / FastAPI)

Serviço de recuperação sobre a base de conhecimento em `../knowledge-base`.
O app Next.js funciona **sem** este serviço — nesse caso usa o retriever BM25 em
TypeScript (`src/server/rag/local-retriever.ts`). Suba o serviço quando quiser o
ranking híbrido e, opcionalmente, embeddings.

## Como rodar

```bash
cd rag-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Depois aponte o Next para ele:

```bash
# .env.local na raiz do projeto
RAG_SERVICE_URL=http://localhost:8000
```

## Embeddings (opcional)

O ranking padrão é híbrido léxico: BM25 (65%) + TF-IDF de bigramas (35%), tudo em
Python puro. Para trocar o segundo sinal por embeddings reais:

```bash
pip install sentence-transformers
```

O `HybridRetriever` detecta a biblioteca no boot e carrega
`paraphrase-multilingual-MiniLM-L12-v2`. Se o download ou o import falhar, ele
volta sozinho para o TF-IDF. Para desligar explicitamente:

```bash
RAG_USE_EMBEDDINGS=0 uvicorn main:app --port 8000
```

## Endpoints

| Método | Rota         | Descrição                                        |
| ------ | ------------ | ------------------------------------------------ |
| GET    | `/health`    | Status, nº de documentos, chunks e modelo ativo   |
| GET    | `/documents` | Metadados de cada documento indexado              |
| POST   | `/search`    | `{ "query": "o que é CET", "top_k": 4 }`          |
| POST   | `/reindex`   | Recarrega o Markdown e reconstrói o índice        |
| GET    | `/docs`      | Swagger UI gerado pelo FastAPI                    |

## Como a base é indexada

`knowledge.py` lê cada `.md`, separa o front matter (`title`, `source`, `tags`) e
quebra o corpo por cabeçalho. Seções acima de 900 caracteres são divididas por
parágrafo. Título, cabeçalho e tags entram no índice com peso extra, então uma
pergunta como "documentos para financiar veículo" casa com a seção certa mesmo
sem repetir o vocabulário exato do texto.

## Variáveis de ambiente

| Variável              | Padrão               | Descrição                          |
| --------------------- | -------------------- | ---------------------------------- |
| `KNOWLEDGE_DIR`       | `../knowledge-base`  | Diretório dos Markdown             |
| `RAG_USE_EMBEDDINGS`  | `1`                  | `0` desativa o modelo denso        |
| `RAG_ALLOWED_ORIGINS` | `*`                  | Origens liberadas no CORS          |
