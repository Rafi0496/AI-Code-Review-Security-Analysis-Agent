"""
Multi-Agent Orchestrator — Coordinates the sequential execution of:
1. Code Analysis Agent
2. Security Vulnerability Agent
3. Remediation Agent
4. PR Summary Agent

Each agent's output feeds the next agent in the pipeline.
"""
import asyncio
import time
import json
from typing import Optional
from agents.code_analysis_agent import run_code_analysis
from agents.security_agent import run_security_analysis
from agents.remediation_agent import run_remediation
from agents.pr_summary_agent import run_pr_summary


class ReviewPipeline:
    """Sequential multi-agent review pipeline orchestrator."""

    async def run(
        self,
        code: str,
        language: str,
        filename: Optional[str] = None,
    ) -> dict:
        """
        Execute the full multi-agent review pipeline.

        Returns:
            dict with keys: code_analysis, security_analysis, remediation,
                           pr_summary, stats, findings_flat
        """
        start_time = time.time()
        filename = filename or "submitted_code"

        print(f"[Orchestrator] Starting review pipeline for '{filename}' ({language})")

        # Stage 1 & 2: Code Analysis Agent & Security Vulnerability Agent (Parallel)
        print("[Orchestrator] Running Code Analysis & Security Agents concurrently...")
        code_analysis, security_analysis = await asyncio.gather(
            run_code_analysis(code, language),
            run_security_analysis(code, language)
        )

        # Stage 3: Remediation Agent (uses outputs from Stages 1 & 2)
        print("[Orchestrator] Stage 3: Remediation Agent running...")
        remediation = await run_remediation(code, language, code_analysis, security_analysis)

        # Stage 4: PR Summary Agent (uses all prior outputs)
        print("[Orchestrator] Stage 4: PR Summary Agent running...")
        pr_summary = await run_pr_summary(
            code, language, filename, code_analysis, security_analysis, remediation
        )

        processing_time = time.time() - start_time

        # Flatten all findings into a unified list
        findings_flat = self._flatten_findings(code_analysis, security_analysis)

        # Compute aggregated severity counts
        severity_counts = self._count_severities(findings_flat)

        print(f"[Orchestrator] Pipeline complete in {processing_time:.2f}s — {len(findings_flat)} findings")

        return {
            "code_analysis": code_analysis,
            "security_analysis": security_analysis,
            "remediation": remediation,
            "pr_summary": pr_summary,
            "stats": {
                "processing_time_seconds": round(processing_time, 2),
                "total_findings": len(findings_flat),
                **severity_counts,
                "quality_score": code_analysis.get("quality_score", 0),
                "risk_level": security_analysis.get("risk_level", "Unknown"),
            },
            "findings_flat": findings_flat,
        }

    def _flatten_findings(self, code_analysis: dict, security_analysis: dict) -> list:
        """Merge findings from both agents into a unified list."""
        findings = []

        for f in code_analysis.get("findings", []):
            findings.append({
                "agent_type": "code_analysis",
                "severity": f.get("severity", "info"),
                "category": f.get("category", "Code Quality"),
                "title": f.get("title", ""),
                "description": f.get("description", ""),
                "recommendation": f.get("recommendation", ""),
                "line_number": f.get("line_number"),
                "owasp_category": None,
                "code_example": None,
            })

        for v in security_analysis.get("vulnerabilities", []):
            findings.append({
                "agent_type": "security",
                "severity": v.get("severity", "info"),
                "category": v.get("vulnerability_type", "Security"),
                "title": v.get("title", ""),
                "description": v.get("description", ""),
                "recommendation": v.get("recommendation", ""),
                "line_number": v.get("line_number"),
                "owasp_category": v.get("owasp_category"),
                "code_example": v.get("affected_code"),
            })

        return findings

    def _count_severities(self, findings: list) -> dict:
        counts = {"critical_count": 0, "high_count": 0, "medium_count": 0, "low_count": 0, "info_count": 0}
        for f in findings:
            sev = f.get("severity", "info").lower()
            key = f"{sev}_count"
            if key in counts:
                counts[key] += 1
        return counts


# Singleton orchestrator instance
pipeline = ReviewPipeline()
