"""Check document links, fences and known GitHub math compatibility hazards.

This is a source check. It cannot replace a browser typesetting check.
"""
from pathlib import Path
import json
import re
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]


def check_navigation(errors):
    """Keep the theme-independent catalog aligned with the actual chapters."""
    try:
        nav = json.loads((ROOT / "navigation.json").read_text())
    except (OSError, ValueError) as exc:
        errors.append(f"navigation.json: {exc}")
        return
    if nav.get("schema_version") != 1:
        errors.append("navigation.json: unsupported schema version")
    groups = nav.get("groups", [])
    ids, paths, group_ids = set(), set(), set()
    pages = list(nav.get("reference_pages", []))
    for group in groups:
        group_id = group.get("id")
        if not group_id or group_id in group_ids:
            errors.append(f"navigation.json: missing or duplicate group ID {group_id}")
        group_ids.add(group_id)
        if not group.get("title") or not group.get("pages"):
            errors.append(f"navigation.json: empty group {group_id}")
        pages.extend(group.get("pages", []))
    for page in pages:
        page_id, path = page.get("id"), page.get("path", "")
        if not page_id or page_id in ids:
            errors.append(f"navigation.json: missing or duplicate page ID {page_id}")
        if not path or path in paths:
            errors.append(f"navigation.json: missing or duplicate path {path}")
        ids.add(page_id)
        paths.add(path)
        target = (ROOT / path).resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            errors.append(f"navigation.json: invalid file {path}")
            continue
        title = target.read_text().splitlines()[0].removeprefix("# ")
        if page.get("title") != title:
            errors.append(f"navigation.json: title mismatch for {path}")
        if not page.get("summary"):
            errors.append(f"navigation.json: missing summary for {path}")
        if not page.get("label"):
            errors.append(f"navigation.json: missing readable label for {path}")
    chapters = {str(p.relative_to(ROOT)) for p in (ROOT / "docs").rglob("*.md")}
    if paths != chapters:
        errors.append(f"navigation.json: document coverage mismatch {paths ^ chapters}")
    expected_sections = {p.name for p in (ROOT / "docs").iterdir() if p.is_dir()}
    if group_ids != expected_sections or len(groups) != 12:
        errors.append("navigation.json: must preserve all twelve existing sections")
    for group in groups:
        expected = [f"docs/{group['id']}/README.md"] + sorted(
            p for p in chapters if p.startswith(f"docs/{group['id']}/") and p != f"docs/{group['id']}/README.md")
        actual = [p["path"] for p in group["pages"]]
        if actual != expected:
            errors.append(f"navigation.json: incorrect reading order in {group['id']}")
    print(f"Navigation groups: {len(groups)}; source documents: {len(chapters)}")


def check_formula(formula, location, errors):
    if "<" in formula:
        errors.append(f"{location}: literal less-than in TeX; write explicit history or a supported macro")
    if r"\operatorname" in formula:
        errors.append(f"{location}: unsupported operator macro")
    depth = 0
    for index, char in enumerate(formula):
        if char not in "{}":
            continue
        preceding = 0
        j = index - 1
        while j >= 0 and formula[j] == "\\":
            preceding += 1
            j -= 1
        if preceding % 2:
            continue
        depth += 1 if char == "{" else -1
        if depth < 0:
            errors.append(f"{location}: unmatched close brace")
            return
    if depth:
        errors.append(f"{location}: unmatched open brace")


def main():
    errors = []
    check_navigation(errors)
    display_count = inline_count = 0
    # Only maintained sources, not Bundler/vendor files or generated site output.
    files = sorted([
        *ROOT.glob("*.md"),
        *(ROOT / "docs").rglob("*.md"),
        *(ROOT / "maintenance").rglob("*.md"),
        *(ROOT / "templates").rglob("*.md"),
    ])
    for path in files:
        if ".git" in path.parts:
            continue
        text = path.read_text()
        if re.match(r"\d\d-", path.name) and re.search(r"^## .*?(练习|自测|手算|算例|动手实验)", text, re.M):
            errors.append(f"{path.relative_to(ROOT)}: teaching task in knowledge chapter")
        # Exact copy/paste guard, not a semantic or technical correctness check.
        prose = re.sub(r"```.*?```", "", text, flags=re.S)
        seen_headings, seen_paragraphs = set(), set()
        for heading in re.findall(r"^#{1,6} (.+)$", prose, re.M):
            if heading in seen_headings:
                errors.append(f"{path.relative_to(ROOT)}: duplicate heading {heading}")
            seen_headings.add(heading)
        if re.match(r"\d\d-", path.name):
            for paragraph in prose.split("\n\n"):
                paragraph = " ".join(paragraph.split())
                if len(paragraph) < 120 or paragraph.startswith(("#", "|")):
                    continue
                if paragraph in seen_paragraphs:
                    errors.append(f"{path.relative_to(ROOT)}: repeated paragraph {paragraph[:40]}")
                seen_paragraphs.add(paragraph)
        fence = None
        math_lines = []
        start_line = 0
        for number, line in enumerate(text.splitlines(), 1):
            if line.startswith("```"):
                if fence is None:
                    fence = line[3:].strip()
                    start_line = number
                    math_lines = []
                else:
                    if fence == "math":
                        display_count += 1
                        check_formula("\n".join(math_lines), f"{path.relative_to(ROOT)}:{start_line}", errors)
                    fence = None
                continue
            if fence is not None:
                if fence == "math":
                    math_lines.append(line)
                continue
            if line.strip() == "$$":
                errors.append(f"{path.relative_to(ROOT)}:{number}: use a math fence")
            if line.startswith("|") and "$" in line:
                errors.append(f"{path.relative_to(ROOT)}:{number}: table depends on math parsing")
            for formula in re.findall(r"\$`([^`]+)`\$", line):
                inline_count += 1
                check_formula(formula, f"{path.relative_to(ROOT)}:{number}", errors)
        if fence is not None:
            errors.append(f"{path.relative_to(ROOT)}: unclosed fence")
        for link in re.findall(r"\]\(([^)]+)\)", text):
            if link.startswith(("https://", "http://", "#", "mailto:")):
                continue
            target = unquote(link.split("#")[0])
            if target and not (path.parent / target).exists():
                errors.append(f"{path.relative_to(ROOT)}: broken link {link}")
    if errors:
        print("\n".join(errors))
        raise SystemExit(1)
    print(f"Markdown files: {len(files)}")
    print(f"Display formulas: {display_count}; inline formulas: {inline_count}")
    print("Source links, fences and known math hazards passed.")


if __name__ == "__main__":
    main()
