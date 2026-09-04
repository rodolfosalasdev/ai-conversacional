# AI Conversacional

Chat conversacional com **grafo de decisão** para contratação de financiamento.
O usuário conversa em linguagem natural; quando o passo admite mais de uma
resposta válida, a IA devolve os caminhos possíveis como **cartões clicáveis** e
segue executando até chegar ao contrato assinado e enviado por e-mail.

Stack idêntica à do `mock-flow` e do `quote-generator`: Next.js 16, React 19,
Tailwind v4 (CSS-first) e shadcn/ui no estilo `base-nova` sobre `@base-ui/react`.

---

## Como rodar

```bash
npm install
npm run dev
```

Abra <http://localhost:3000>. **Não é necessário configurar nada** — sem chaves
de API o app roda com o motor determinístico e a jornada funciona de ponta a
ponta, incluindo emissão do contrato e "envio" do e-mail em modo preview.

Para ligar um LLM de verdade, copie `.env.example` para `.env.local` e preencha
uma chave (veja [LLM](#llm-e-a-questão-do-gpt-gratuito)).

### Serviço de RAG em Python (opcional)

```bash
cd rag-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

E no `.env.local`: `RAG_SERVICE_URL=http://localhost:8000`.
Sem ele, a busca usa o retriever BM25 escrito em TypeScript. Detalhes em
[`rag-service/README.md`](./rag-service/README.md).

---

## A tela

Três colunas, sem nenhuma etapa anterior de cadastro:

| Coluna    | Conteúdo                                                                 |
| --------- | ------------------------------------------------------------------------ |
| Esquerda  | **Cliente** já carregado (renda, score, dívidas) + **biblioteca de prompts** |
| Centro    | Conversa, cartões de ramificação e o composer                             |
| Direita   | **Grafo** de decisão ao vivo, inspetor do **RAG** e o **contrato** gerado  |

O composer replica o do Cursor: textarea que cresce com o conteúdo, troca de
**modo** (Agent / Plan / Ask), troca de **modelo** (GPT / Sonnet), botão de
anexo (aceita drag-and-drop) e botão de enviar. `Enter` envia, `Shift+Enter`
quebra linha.

### Modos

- **Agent** — executa a jornada e avança o grafo.
- **Plan** — só descreve os passos restantes; nenhum nó é executado.
- **Ask** — responde dúvidas pelo RAG sem alterar o estado da jornada.

No modo Agent, se você fizer uma pergunta no meio do fluxo ("o que é CET?"), o
assistente responde pela base de conhecimento e **devolve as opções do passo**
para você continuar de onde parou.

### Trocar de perfil

Os três presets na aba **Cliente** reiniciam a conversa e exercitam ramos
diferentes do grafo:

| Preset            | Score | O que acontece                                        |
| ----------------- | ----- | ----------------------------------------------------- |
| Perfil aprovado   | 812   | Caminho feliz até o contrato                          |
| Perfil condicional| 612   | Cai em **Remediação** e volta para a análise (loop)   |
| Perfil negado     | 452   | Termina no nó **Crédito negado**                      |

---

## O grafo de decisão

O fluxo é um grafo declarativo em
[`src/lib/graph/financing-graph.ts`](./src/lib/graph/financing-graph.ts).
Adicionar um nó lá o faz aparecer automaticamente no painel lateral, porque a
visualização é gerada a partir da mesma estrutura.

```
start → purpose → asset → credit_check ─┬─ aprovado ──→ offers → term → insurance
                     ▲                  ├─ condicional → remediation ──┘ (volta)
                     │                  └─ negado ─────→ denied ✗
                     │
   due_day → review → authorize ─┬─ autorizado → sign → deliver → done ✓
                        ▲        ├─ ajustar ──→ offers (volta)
                        └────────┴─ cancelar ─→ cancelled ✗
```

Tipos de nó: `start`, `collect` (texto livre), `choice` (ramifica em cartões),
`compute` (análise de crédito, conferência), `authorize`, `action` (emitir
contrato, enviar e-mail) e `terminal`.

A engine ([`engine.ts`](./src/lib/graph/engine.ts)) é determinística: ela caminha
sozinha pelos nós automáticos e só para quando precisa do usuário. Isso garante
que a jornada sempre termina, com ou sem LLM.

### Como a IA entra

1. **Interpretação** — o texto livre é casado com as opções do nó atual. Primeiro
   por heurística (rápida e grátis); se ficar ambíguo, um classificador LLM
   decide. Se ainda assim empatar, a UI mostra os cartões para clicar. É
   exatamente o comportamento pedido: *mais de uma resposta possível → escolha
   clicável*.
2. **Redação** — a engine produz o texto canônico com os números corretos e o
   modelo reescreve de forma natural. Antes de aceitar a reescrita, o servidor
   **confere que todos os números do original sobreviveram**
   (`preservesNumbers` em [`orchestrator.ts`](./src/server/chat/orchestrator.ts));
   se algum sumiu, o texto canônico prevalece. O modelo nunca inventa uma taxa.
3. **RAG** — nos modos Ask e nas perguntas soltas, a resposta é fundamentada nos
   trechos recuperados e as fontes ficam visíveis na mensagem.

---

## LLM e a questão do GPT gratuito

A OpenAI **não tem camada gratuita permanente** de API. Mas o app fala o dialeto
OpenAI, então dá para usar provedores gratuitos sem trocar uma linha de código:

| Provedor     | Grátis | Variável              | Observação                                    |
| ------------ | ------ | --------------------- | --------------------------------------------- |
| **Groq**     | ✅     | `GROQ_API_KEY`        | Sem cartão. Serve `gpt-oss`, de pesos abertos da OpenAI. É a opção mais rápida de começar. |
| **Gemini**   | ✅     | `GEMINI_API_KEY`      | Contexto longo, cota generosa                  |
| **OpenRouter** | ✅   | `OPENROUTER_API_KEY`  | Um token para dezenas de modelos `:free`       |
| **Cerebras** | ✅     | `CEREBRAS_API_KEY`    | ~1M tokens/dia                                 |
| OpenAI       | ❌     | `OPENAI_API_KEY`      | Pago                                           |
| Anthropic    | ❌     | `ANTHROPIC_API_KEY`   | Pago                                           |
| Ollama       | ✅     | `OLLAMA_BASE_URL`     | Modelo local                                   |

O seletor da interface expõe dois **modelos lógicos**, e cada um tem sua ordem de
preferência (`src/server/llm/providers.ts`):

- **GPT** → OpenAI → Groq → Gemini → OpenRouter → Cerebras → Ollama
- **Sonnet** → Anthropic → OpenRouter → Groq → Gemini → Cerebras → Ollama

Vence o primeiro com chave configurada. Sem nenhuma, o app usa o motor
determinístico e o badge do cabeçalho mostra "Determinístico".

Recomendação para testar de graça: crie uma chave em
<https://console.groq.com/keys> e coloque `GROQ_API_KEY=` no `.env.local`.

---

## RAG e base de conhecimento

A base são arquivos Markdown em [`knowledge-base/`](./knowledge-base) com front
matter (`title`, `source`, `tags`). São 7 documentos sobre política de crédito,
CET, seguro prestamista, documentos exigidos, produtos, quitação antecipada e
direitos do consumidor/LGPD.

Cada arquivo é quebrado por cabeçalho (seções acima de 900 caracteres viram
vários chunks). Título, cabeçalho e tags entram no índice com peso extra.

Existem **duas implementações** do retriever, com a mesma interface:

- **TypeScript** (`src/server/rag/local-retriever.ts`) — BM25 puro, roda dentro
  do Next, sem dependências. É o padrão.
- **Python** (`rag-service/`) — FastAPI com ranking híbrido: BM25 (65%) +
  TF-IDF de bigramas (35%). Instalando `sentence-transformers`, o segundo sinal
  vira embeddings de verdade; se o import falhar, ele volta sozinho para TF-IDF.

O Next tenta o serviço Python quando `RAG_SERVICE_URL` está definido e cai para o
BM25 local se ele não responder. A aba **RAG** no painel direito mostra os
documentos indexados e permite testar consultas na hora.

---

## Contrato e e-mail

Ao autorizar, o nó `sign` gera o contrato com 10 cláusulas (objeto, condições
financeiras, pagamento, entrada, seguro, quitação antecipada, arrependimento,
LGPD, assinatura eletrônica e foro) e um hash SHA-256 do conteúdo como
"assinatura". O nó `deliver` envia a cópia.

Transportes, na ordem de tentativa:

1. **Resend** — se `RESEND_API_KEY` estiver definida (3.000 e-mails/mês grátis).
2. **SMTP** — se `SMTP_HOST` estiver definido (via nodemailer).
3. **Ethereal** — caixa de teste online criada na hora com `EMAIL_TRANSPORT=ethereal`.
4. **Preview** — padrão. O HTML fica em `/api/contracts/<id>/preview` e o link
   aparece na própria conversa e na aba **Contrato**.

---

## APIs

Todas em Next.js, prontas para serem extraídas depois para um serviço à parte.

| Método | Rota                             | Descrição                                            |
| ------ | -------------------------------- | ---------------------------------------------------- |
| POST   | `/api/conversations`             | Abre a conversa com o cadastro carregado e dá o 1º turno |
| GET    | `/api/conversations/[id]`        | Estado e histórico da conversa                        |
| POST   | `/api/chat`                      | Um turno: interpreta, caminha o grafo, devolve mensagens |
| GET    | `/api/graph`                     | Definição e layout do grafo                           |
| GET    | `/api/knowledge`                 | Documentos indexados                                  |
| POST   | `/api/knowledge/search`          | Busca no RAG (Python com fallback local)              |
| POST   | `/api/upload`                    | Anexos do composer                                    |
| GET    | `/api/contracts/[id]/preview`    | HTML do e-mail como o cliente recebeu                 |
| GET    | `/api/health`                    | Provedor de LLM, RAG e transporte de e-mail ativos    |

Exemplo de turno completo:

```bash
ID=$(curl -s -X POST localhost:3000/api/conversations -H 'Content-Type: application/json' \
  -d '{"clientPresetId":"premium"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["conversation"]["id"])')

curl -s -X POST localhost:3000/api/chat -H 'Content-Type: application/json' -d "{
  \"conversationId\": \"$ID\", \"mode\": \"agent\", \"model\": \"gpt\",
  \"input\": { \"kind\": \"text\", \"text\": \"quero financiar um carro de 92 mil com 25 mil de entrada\" }
}"
```

---

## Estrutura

```
knowledge-base/            Markdown da base de conhecimento (fonte do RAG)
rag-service/               FastAPI: knowledge.py, retriever.py, main.py
src/
├── app/
│   ├── api/               Rotas REST
│   ├── layout.tsx         Geist + ThemeProvider + TooltipProvider + Toaster
│   └── page.tsx           Renderiza o ChatWorkspace
├── components/
│   ├── ui/                shadcn base-nova
│   └── chat/              composer, mensagens, cartões, grafo, painéis
├── hooks/use-conversation.ts
├── lib/
│   ├── graph/             financing-graph, engine, credit-policy, layout
│   ├── prompts/           biblioteca de prompts e system prompts
│   ├── schemas/           validação Zod
│   ├── types/             tipos de domínio
│   └── mocks/client.ts    cadastro pré-carregado
└── server/
    ├── chat/              orquestrador e interpretador de intenção
    ├── contract/          geração e template do contrato
    ├── email/             transportes de envio
    ├── llm/               providers e cliente unificado
    ├── rag/               retriever local e cliente do serviço Python
    └── store/             persistência das conversas em .data/
```

## Scripts

| Comando            | O que faz                       |
| ------------------ | ------------------------------- |
| `npm run dev`      | Servidor de desenvolvimento     |
| `npm run build`    | Build de produção               |
| `npm run lint`     | ESLint                          |
| `npm run format`   | Prettier                        |

---

## Aviso

Instituição, taxas, cláusulas e dados de cliente são fictícios. O contrato
gerado não tem efeito jurídico — é uma demonstração técnica.
