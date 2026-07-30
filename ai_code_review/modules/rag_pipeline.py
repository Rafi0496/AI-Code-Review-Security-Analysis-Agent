"""
Secure Coding Knowledge Base + RAG Pipeline
Milestone 1 — Task 4
Indexes OWASP guidelines and secure coding standards into ChromaDB.
Retrieves relevant chunks for agent context and conversational assistant.
"""

import os
import chromadb
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

KNOWLEDGE_BASE_DIR = Path(__file__).parent.parent / "knowledge_base" / "owasp_docs"
CHROMA_COLLECTION_NAME = "secure_coding_kb"


class RAGPipeline:
    """
    Builds and queries the secure coding knowledge base.
    Uses Google Gemini embedding model for text embeddings.
    ChromaDB as the vector store.
    """

    def __init__(self):
        # EphemeralClient = pure in-process SQLite, no server required
        # (replaces deprecated chromadb.Client() which now tries HTTP)
        self.chroma_client = chromadb.EphemeralClient()
        self._doc_count = 0

        # Try Gemini embeddings; fall back to default if unavailable
        self.embedding_fn = None
        try:
            from chromadb.utils import embedding_functions
            self.embedding_fn = embedding_functions.GoogleGenerativeAiEmbeddingFunction(
                api_key=GEMINI_API_KEY,
                model_name="models/text-embedding-004",
            )
        except Exception:
            pass

        if self.embedding_fn:
            self.collection = self.chroma_client.get_or_create_collection(
                name=CHROMA_COLLECTION_NAME,
                embedding_function=self.embedding_fn,
            )
        else:
            self.collection = self.chroma_client.get_or_create_collection(
                name=CHROMA_COLLECTION_NAME,
            )

    def build_knowledge_base(self):
        """
        Reads all OWASP guideline documents from the knowledge base directory,
        chunks them by semantic boundaries (section headers),
        and indexes them into ChromaDB.
        """
        if not KNOWLEDGE_BASE_DIR.exists():
            print(f"[RAG] Knowledge base directory not found: {KNOWLEDGE_BASE_DIR}")
            return

        all_chunks = []
        all_ids = []
        all_metadata = []

        for doc_file in KNOWLEDGE_BASE_DIR.glob("*.txt"):
            content = doc_file.read_text(encoding="utf-8")
            chunks = self._chunk_by_section(content, doc_file.name)

            for i, chunk in enumerate(chunks):
                chunk_id = f"{doc_file.stem}_{i}"
                all_chunks.append(chunk)
                all_ids.append(chunk_id)
                all_metadata.append({
                    "source": doc_file.name,
                    "chunk_index": i,
                })

        if all_chunks:
            self.collection.upsert(
                documents=all_chunks,
                ids=all_ids,
                metadatas=all_metadata,
            )
            self._doc_count = len(all_chunks)
            print(f"[RAG] Indexed {len(all_chunks)} chunks from {KNOWLEDGE_BASE_DIR}")
        else:
            print("[RAG] No documents found to index.")

    def _chunk_by_section(self, content: str, filename: str) -> list:
        """
        Splits document into chunks at section header boundaries.
        Avoids cutting code examples mid-block.
        Falls back to paragraph splitting if no headers found.
        """
        lines = content.splitlines()
        chunks = []
        current_chunk = []

        for line in lines:
            # Section boundary: lines starting with # or numbered like "1." or "---"
            is_boundary = (
                line.startswith("#")
                or (len(line) > 2 and line[0].isdigit() and line[1] in ".)")
                or line.strip() == "---"
            )

            if is_boundary and current_chunk:
                chunk_text = "\n".join(current_chunk).strip()
                if len(chunk_text) > 50:  # skip near-empty chunks
                    chunks.append(chunk_text)
                current_chunk = [line]
            else:
                current_chunk.append(line)

        if current_chunk:
            chunk_text = "\n".join(current_chunk).strip()
            if len(chunk_text) > 50:
                chunks.append(chunk_text)

        # Fallback: if no sections found, split by paragraph
        if not chunks:
            paragraphs = content.split("\n\n")
            chunks = [p.strip() for p in paragraphs if len(p.strip()) > 50]

        return chunks

    def retrieve(self, query: str, top_k: int = 3) -> list:
        """
        Retrieves the top-k most relevant chunks for a given query.
        Returns a list of dicts with 'content' and 'source'.
        """
        # Short-circuit: nothing indexed yet — avoids ONNX model download
        if self._doc_count == 0:
            return []

        try:
            # Clamp top_k to number of indexed docs to avoid ChromaDB error
            actual_k = min(top_k, self._doc_count)
            results = self.collection.query(
                query_texts=[query],
                n_results=actual_k,
            )

            retrieved = []
            if results and results["documents"]:
                for doc, meta in zip(
                    results["documents"][0], results["metadatas"][0]
                ):
                    retrieved.append({
                        "content": doc,
                        "source": meta.get("source", "unknown"),
                    })

            return retrieved
        except Exception as e:
            print(f"[RAG] Retrieve error: {e}")
            return []

    def get_context_string(self, query: str, top_k: int = 3) -> str:
        """
        Returns retrieved chunks as a single formatted string for LLM context.
        """
        chunks = self.retrieve(query, top_k=top_k)
        if not chunks:
            return "No relevant guidelines found in the knowledge base."

        context_parts = []
        for i, chunk in enumerate(chunks, 1):
            context_parts.append(
                f"[Source {i}: {chunk['source']}]\n{chunk['content']}"
            )

        return "\n\n---\n\n".join(context_parts)
