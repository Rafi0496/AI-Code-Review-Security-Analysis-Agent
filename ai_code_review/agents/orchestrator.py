"""
Multi-Agent Orchestrator
Milestone 2 — Task 3
Runs Code Analysis and Security Vulnerability agents in parallel.
Merges outputs into a single unified findings list.
"""

import asyncio
import time
from concurrent.futures import ThreadPoolExecutor
from agents.code_analysis_agent import CodeAnalysisAgent
from agents.security_vuln_agent import SecurityVulnAgent


class MultiAgentOrchestrator:
    """
    Dispatches the Code Analysis Agent and Security Vulnerability Agent
    in parallel using asyncio + ThreadPoolExecutor.
    Merges and deduplicates results into a unified findings list.
    """

    def __init__(self):
        self.code_agent = CodeAnalysisAgent()
        self.security_agent = SecurityVulnAgent()
        self.executor = ThreadPoolExecutor(max_workers=2)

    async def run(self, submission: dict) -> dict:
        """
        Main orchestration entry point.
        Runs both agents concurrently, merges results.
        Returns unified analysis report.
        """
        start_time = time.time()

        loop = asyncio.get_event_loop()

        # Run both agents in parallel using thread pool
        code_task = loop.run_in_executor(
            self.executor,
            self.code_agent.analyze,
            submission,
        )
        security_task = loop.run_in_executor(
            self.executor,
            self.security_agent.analyze,
            submission,
        )

        # Wait for both to complete
        code_result, security_result = await asyncio.gather(
            code_task,
            security_task,
            return_exceptions=True,
        )

        elapsed = round(time.time() - start_time, 2)

        # Handle errors gracefully
        if isinstance(code_result, Exception):
            print(f"[Orchestrator] Code Analysis Agent error: {code_result}")
            code_result = {
                "agent": "Code Analysis Agent",
                "findings": [],
                "total_findings": 0,
            }

        if isinstance(security_result, Exception):
            print(f"[Orchestrator] Security Agent error: {security_result}")
            security_result = {
                "agent": "Security Vulnerability Agent",
                "findings": [],
                "total_findings": 0,
            }

        # Merge all findings
        merged = self._merge_findings(code_result, security_result)

        return {
            "submission": {
                "language": submission.get("language"),
                "lines": submission.get("lines"),
                "source": submission.get("source"),
                "filename": submission.get("filename", "pasted_code"),
            },
            "execution_time_seconds": elapsed,
            "summary": self._build_summary(merged),
            "findings": merged,
        }

    def run_sync(self, submission: dict) -> dict:
        """Synchronous wrapper for non-async contexts."""
        return asyncio.run(self.run(submission))

    def _merge_findings(
        self,
        code_result: dict,
        security_result: dict,
    ) -> list:
        """
        Combines findings from both agents.
        Tags each finding with its source agent.
        Sorts by severity (Critical first).
        Deduplicates overlapping findings.
        """
        all_findings = []

        for finding in code_result.get("findings", []):
            finding["agent"] = "Code Analysis Agent"
            all_findings.append(finding)

        for finding in security_result.get("findings", []):
            finding["agent"] = "Security Vulnerability Agent"
            all_findings.append(finding)

        # Deduplicate cross-agent (same type on same line)
        seen = set()
        unique = []
        for f in all_findings:
            key = (f.get("type", "")[:40], f.get("line", 0))
            if key not in seen:
                seen.add(key)
                unique.append(f)

        # Sort by severity
        severity_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
        unique.sort(
            key=lambda f: severity_order.get(f.get("severity", "Low"), 3)
        )

        return unique

    def _build_summary(self, findings: list) -> dict:
        """Builds a severity breakdown summary from merged findings."""
        severity_counts = {"Critical": 0, "High": 0, "Medium": 0, "Low": 0}
        category_counts = {}

        for f in findings:
            severity = f.get("severity", "Low")
            severity_counts[severity] = severity_counts.get(severity, 0) + 1

            category = f.get("category", "General")
            category_counts[category] = category_counts.get(category, 0) + 1

        return {
            "total_findings": len(findings),
            "severity_breakdown": severity_counts,
            "category_breakdown": category_counts,
            "risk_level": self._overall_risk(severity_counts),
        }

    def _overall_risk(self, severity_counts: dict) -> str:
        if severity_counts["Critical"] > 0:
            return "Critical"
        elif severity_counts["High"] > 0:
            return "High"
        elif severity_counts["Medium"] > 0:
            return "Medium"
        return "Low"
