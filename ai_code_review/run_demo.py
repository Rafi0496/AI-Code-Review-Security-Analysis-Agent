"""
Quick demonstration script — run a full analysis on the vulnerable sample
without needing a running FastAPI server.

Usage:
    python run_demo.py
"""

import os
import sys
import json
from pathlib import Path

# Ensure project root is on path
sys.path.insert(0, str(Path(__file__).parent))

from modules.submission import CodeSubmission
from agents.orchestrator import MultiAgentOrchestrator


def main():
    print("=" * 65)
    print("  AI Code Review & Security Analysis Agent")
    print("  Milestone 2 Demo — Multi-Agent Analysis")
    print("=" * 65)

    # Load the vulnerable sample
    sample_path = Path(__file__).parent / "tests" / "sample_code" / "vulnerable_python.py"
    if not sample_path.exists():
        print(f"[ERROR] Sample not found at: {sample_path}")
        sys.exit(1)

    code = sample_path.read_text(encoding="utf-8")
    print(f"\n[+] Loaded: {sample_path.name} ({len(code.splitlines())} lines)")

    # Submit
    handler = CodeSubmission()
    submission = handler.from_text(code, "python")
    submission["filename"] = sample_path.name
    print(f"[+] Submission validated. Language: {submission['language']}")

    # Analyze
    orchestrator = MultiAgentOrchestrator()
    print("\n[+] Running multi-agent analysis...")
    result = orchestrator.run_sync(submission)

    # Print summary
    summary = result["summary"]
    print(f"\n{'─'*50}")
    print(f"  Analysis Complete in {result['execution_time_seconds']}s")
    print(f"{'─'*50}")
    print(f"  Overall Risk:    {summary['risk_level']}")
    print(f"  Total Findings:  {summary['total_findings']}")
    print()
    breakdown = summary["severity_breakdown"]
    for sev in ("Critical", "High", "Medium", "Low"):
        count = breakdown.get(sev, 0)
        bar = "█" * count
        print(f"  {sev:<10} {count:>3}  {bar}")
    print(f"{'─'*50}")

    # Print top 10 findings
    print(f"\n[+] Top Findings:\n")
    for i, finding in enumerate(result["findings"][:10], 1):
        sev = finding.get("severity", "?")
        sev_icon = {"Critical": "🔴", "High": "🟠", "Medium": "🟡", "Low": "🟢"}.get(sev, "⚪")
        print(f"  {i:>2}. {sev_icon} [{sev}] {finding['type']}")
        print(f"      Line {finding.get('line', '?')} — {finding['description'][:80]}...")
        print(f"      Agent: {finding.get('agent', 'unknown')}")
        print()

    # Save full report
    report_path = Path(__file__).parent / "analysis_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
    print(f"[+] Full report saved to: {report_path.name}")


if __name__ == "__main__":
    main()
