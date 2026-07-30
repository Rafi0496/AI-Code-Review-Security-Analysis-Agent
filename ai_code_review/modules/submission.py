"""
Code Submission Module
Milestone 1 — Task 3
Handles direct code paste and file upload for Python and Java.
Validates syntax before passing to the analysis pipeline.
"""

import ast
import os
from pathlib import Path


SUPPORTED_LANGUAGES = {
    ".py": "python",
    ".java": "java",
}


class CodeSubmissionError(Exception):
    pass


class CodeSubmission:
    """
    Accepts raw code (paste or file upload) for Python and Java.
    Validates syntax and returns a structured payload for the pipeline.
    """

    def from_text(self, code: str, language: str) -> dict:
        """
        Accept pasted code with an explicit language label.
        Returns a submission payload dict.
        """
        language = language.lower().strip()
        if language not in ("python", "java"):
            raise CodeSubmissionError(
                f"Unsupported language '{language}'. Only Python and Java are supported."
            )

        validation_result = self._validate_syntax(code, language)
        if not validation_result["valid"]:
            raise CodeSubmissionError(
                f"Syntax error: {validation_result['error']}"
            )

        return {
            "code": code,
            "language": language,
            "lines": len(code.splitlines()),
            "source": "paste",
        }

    def from_file(self, filepath: str) -> dict:
        """
        Accept an uploaded source file.
        Detects language from file extension.
        """
        path = Path(filepath)
        ext = path.suffix.lower()

        if ext not in SUPPORTED_LANGUAGES:
            raise CodeSubmissionError(
                f"Unsupported file type '{ext}'. Upload a .py or .java file."
            )

        language = SUPPORTED_LANGUAGES[ext]

        with open(filepath, "r", encoding="utf-8") as f:
            code = f.read()

        validation_result = self._validate_syntax(code, language)
        if not validation_result["valid"]:
            raise CodeSubmissionError(
                f"Syntax error in {path.name}: {validation_result['error']}"
            )

        return {
            "code": code,
            "language": language,
            "lines": len(code.splitlines()),
            "filename": path.name,
            "source": "file",
        }

    def _validate_syntax(self, code: str, language: str) -> dict:
        """
        Validates Python syntax using the built-in ast module.
        Java syntax check is basic (checks for common structure).
        """
        if language == "python":
            try:
                ast.parse(code)
                return {"valid": True, "error": None}
            except SyntaxError as e:
                return {
                    "valid": False,
                    "error": f"Line {e.lineno}: {e.msg}",
                }

        if language == "java":
            # Basic Java structure check
            if "class " not in code and "interface " not in code:
                return {
                    "valid": False,
                    "error": "No class or interface definition found.",
                }
            return {"valid": True, "error": None}

        return {"valid": False, "error": "Unknown language."}
