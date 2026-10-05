"""Render the challenge Markdown files to PDF (pip install markdown pygments playwright)."""
import os
import re
from pathlib import Path

import markdown
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
OUT = HERE / "pdf"
DOCS = [
    ("setA-questions.md", "SetA_Questions.pdf", "Set A · Questions"),
    ("setA-answer-key.md", "SetA_AnswerKey.pdf", "Set A · Answer Key (Confidential)"),
    ("setB-questions.md", "SetB_Questions.pdf", "Set B · Questions"),
    ("setB-answer-key.md", "SetB_AnswerKey.pdf", "Set B · Answer Key (Confidential)"),
    ("hackerrank-guide.md", "HackerRank_Contest_Setup_Guide.pdf", "HackerRank Contest Setup Guide"),
]

CSS = """
@page { size: A4; margin: 16mm 14mm 18mm 14mm; }
body { font-family: 'DejaVu Sans', sans-serif; font-size: 10.5pt; line-height: 1.45; color: #1a1a1a; }
h1 { font-size: 19pt; color: #fff; background: #00629B; padding: 12px 14px; border-radius: 6px; margin: 0 0 10px; }
h1:not(:first-child) { margin-top: 22px; }
h2 { font-size: 13pt; color: #00629B; border-bottom: 2px solid #00629B; padding-bottom: 3px; margin: 20px 0 6px; break-after: avoid; }
h3 { font-size: 11.5pt; color: #333; }
p { margin: 4px 0; }
blockquote { background: #eef5fb; border-left: 4px solid #00629B; margin: 8px 0; padding: 6px 12px; }
pre { background: #f6f8fa; border: 1px solid #d0d7de; border-radius: 5px; padding: 8px 10px;
      font-size: 8.8pt; line-height: 1.35; white-space: pre-wrap; break-inside: avoid; }
code { font-family: 'DejaVu Sans Mono', monospace; font-size: 9pt; }
p code, li code, td code { background: #eef1f4; padding: 0 3px; border-radius: 3px; }
table { border-collapse: collapse; margin: 8px 0; width: 100%; font-size: 9.5pt; }
th, td { border: 1px solid #c8d1db; padding: 4px 7px; text-align: left; }
th { background: #00629B; color: #fff; }
tr:nth-child(even) td { background: #f3f7fa; }
hr { border: none; border-top: 1px dashed #aaa; margin: 14px 0; }
strong { color: #0b3d5c; }
"""

LIST = re.compile(r"^\s*([-*]|\d+\.)\s")


def normalize(md: str) -> str:
    """Turn line-oriented Markdown into Python-Markdown friendly blocks."""
    md = md.replace("- [ ]", "- ☐")
    out, in_code = [], False
    for line in md.splitlines():
        if re.match(r"^ {3}([-*]|\d+\.) ", line):
            line = " " + line
        if line.startswith("```"):
            if not in_code and out and out[-1].strip():
                out.append("")
            in_code = not in_code
            out.append(line)
            continue
        if not in_code and out and out[-1].strip() and line.strip() and not out[-1].startswith("```"):
            prev = out[-1]
            same_table = prev.startswith("|") and line.startswith("|")
            same_list = LIST.match(prev) and (LIST.match(line) or line.startswith("   "))
            same_quote = prev.startswith(">") and line.startswith(">")
            if not (same_table or same_list or same_quote):
                out.append("")
        out.append(line)
    return "\n".join(out)


def main():
    OUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("CHROME_PATH") or None)
        page = browser.new_page()
        for src, dst, label in DOCS:
            body = markdown.markdown(normalize((HERE / src).read_text()),
                                     extensions=["fenced_code", "tables", "sane_lists"])
            page.set_content(f"<html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{body}</body></html>")
            footer = (f"<div style='font-size:8px;width:100%;padding:0 14mm;color:#666;display:flex;justify-content:space-between'>"
                      f"<span>IEEE Inter-Society Code Debugging Challenge · {label}</span>"
                      f"<span>Page <span class='pageNumber'></span> / <span class='totalPages'></span></span></div>")
            page.pdf(path=str(OUT / dst), format="A4", print_background=True, display_header_footer=True,
                     header_template="<span></span>", footer_template=footer,
                     margin={"top": "16mm", "bottom": "18mm", "left": "14mm", "right": "14mm"})
            print("wrote", OUT / dst)
        browser.close()


if __name__ == "__main__":
    main()
