"""
RAG Knowledge Base — ChromaDB-backed vector store for secure coding knowledge.
Handles document ingestion, embedding, and semantic similarity search.
"""
import chromadb
from chromadb.config import Settings as ChromaSettings
from typing import Optional
from core.config import settings


class KnowledgeBase:
    """ChromaDB-based vector knowledge base for RAG."""

    def __init__(self):
        self.client: Optional[chromadb.AsyncHttpClient] = None
        self.collection = None

    async def initialize(self):
        """Connect to ChromaDB and get/create collection."""
        try:
            self.client = await chromadb.AsyncHttpClient(
                host=settings.chromadb_host,
                port=settings.chromadb_port,
            )
            self.collection = await self.client.get_or_create_collection(
                name=settings.chromadb_collection,
                metadata={"hnsw:space": "cosine"},
            )
            print(f"[KnowledgeBase] Connected to ChromaDB at {settings.chromadb_host}:{settings.chromadb_port}")
            print(f"[KnowledgeBase] Collection '{settings.chromadb_collection}' ready")
        except Exception as e:
            print(f"[KnowledgeBase] ChromaDB connection failed: {e}")
            print("[KnowledgeBase] Running in local/fallback mode")
            self.client = chromadb.Client()
            self.collection = self.client.get_or_create_collection(
                name=settings.chromadb_collection,
                metadata={"hnsw:space": "cosine"},
            )

    async def add_documents(self, documents: list[dict]):
        """
        Add documents to the knowledge base.
        Each document: {"id": str, "text": str, "metadata": dict}
        """
        if not self.collection:
            await self.initialize()

        ids = [doc["id"] for doc in documents]
        texts = [doc["text"] for doc in documents]
        metadatas = [doc.get("metadata", {}) for doc in documents]

        # Check for existing IDs to avoid duplicates
        try:
            existing = await self.collection.get(ids=ids)
            existing_ids = set(existing["ids"]) if existing["ids"] else set()
        except Exception:
            existing_ids = set()

        # Filter out already-existing documents
        new_docs = [(i, t, m) for i, t, m in zip(ids, texts, metadatas) if i not in existing_ids]
        if not new_docs:
            return

        new_ids, new_texts, new_metas = zip(*new_docs)
        await self.collection.add(
            ids=list(new_ids),
            documents=list(new_texts),
            metadatas=list(new_metas),
        )
        print(f"[KnowledgeBase] Added {len(new_ids)} documents")

    async def query(self, query_text: str, n_results: int = 5) -> list[dict]:
        """
        Semantic similarity search against the knowledge base.
        Returns list of {text, metadata, distance} dicts.
        """
        if not self.collection:
            await self.initialize()

        try:
            results = await self.collection.query(
                query_texts=[query_text],
                n_results=min(n_results, 10),
                include=["documents", "metadatas", "distances"],
            )

            docs = []
            if results and results.get("documents"):
                for text, meta, dist in zip(
                    results["documents"][0],
                    results["metadatas"][0],
                    results["distances"][0],
                ):
                    docs.append({
                        "text": text,
                        "metadata": meta,
                        "relevance_score": round(1 - dist, 3),
                    })
            return docs
        except Exception as e:
            print(f"[KnowledgeBase] Query error: {e}")
            return []

    async def get_count(self) -> int:
        """Return total number of documents in the collection."""
        if not self.collection:
            return 0
        try:
            return await self.collection.count()
        except Exception:
            return 0


# Singleton instance
knowledge_base = KnowledgeBase()
