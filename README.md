# ATLAS-Enterprise-AI

An enterprise RAG assistant built on FastAPI, Amazon Bedrock (Titan embeddings + Nova Lite), Pinecone, and PostgreSQL, orchestrated with LangGraph.

## Prerequisites

- [Conda](https://docs.conda.io/en/latest/miniconda.html) (Anaconda or Miniconda)
- An AWS account with Bedrock access to:
  - `amazon.titan-embed-text-v2:0`
  - Amazon Nova Lite
- A [Pinecone](https://www.pinecone.io/) account and API key
- A PostgreSQL database

## 1. Set up the environment

```bash
conda create -n atlas python=3.12 -y
conda activate atlas
pip install -r requirements.txt
```

> Always run commands with the `atlas` env active. If you see `ModuleNotFoundError`, check `which python` points to `.../envs/atlas/bin/python`, and select that interpreter in your editor.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Then fill in `.env`:

| Variable | Description |
| --- | --- |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials with Bedrock (and S3) permissions |
| `AWS_REGION` | AWS region, e.g. `ap-south-1` |
| `S3_BUCKET` | Bucket for uploaded documents |
| `BEDROCK_EMBED_MODEL` | `amazon.titan-embed-text-v2:0` |
| `BEDROCK_CHAT_MODEL` | Nova Lite inference profile for your region (see below) |
| `EMBED_DIM` | Embedding size, `1024` |
| `PINECONE_API_KEY` | Pinecone API key |
| `DATABASE_URL` | e.g. `postgresql://user:password@localhost:5432/atlas` |
| `RIUS_*` | Observability settings; set `RIUS_DISABLED=true` to turn off |

**Bedrock model IDs:**

- Model IDs use dots, not colons: `amazon.titan-embed-text-v2:0`.
- Nova Lite has to be called through a cross-region inference profile. Prefix the model ID to match your region:
  - APAC (e.g. `ap-south-1`): `apac.amazon.nova-lite-v1:0`
  - US: `us.amazon.nova-lite-v1:0`
  - EU: `eu.amazon.nova-lite-v1:0`

**`.env` formatting:** don't put spaces around `=`. Wrap a value in quotes if it contains spaces or `#`.

## 3. Verify Bedrock access

```bash
python test/bedrock_test.py
```

Expected output:

```
Embedding dimension: 1024
Nova Response: RAG stands for Retrieval-Augmented Generation, ...
```

### Troubleshooting

| Error | Fix |
| --- | --- |
| `ModuleNotFoundError: No module named 'boto3'` | Wrong Python. Run `conda activate atlas`. |
| `The provided model identifier is invalid` | Typo in the model ID (e.g. `amazon:` instead of `amazon.`). |
| `on-demand throughput isn't supported` | Use the inference profile ID (`apac.` / `us.` / `eu.` prefix). |
| `AccessDeniedException` | Your IAM user lacks Bedrock permissions, or the model isn't enabled for your account in that region. |

## 4. Run the application

> 🚧 **Work in progress:** the modules below are scaffolded but not implemented yet. These are the intended commands.

```bash
# Create database tables (infra/schema.sql)
python scripts/init_db.py

# Ingest documents into Pinecone
python -m worker.ingest

# Start the web app
uvicorn app.main:app --reload
```

Then open http://localhost:8000.

## Project structure

```
app/            FastAPI backend (RAG, LangGraph, guardrails, memory, observability)
  templates/    HTML templates
  static/       CSS and JS
worker/         Document ingestion worker
scripts/        Utility scripts (DB init)
infra/          Database schema
docs/           Additional documentation
test/           Connectivity tests
```
