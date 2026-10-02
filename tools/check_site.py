"""Validate actual Jekyll output, including project baseurl and edit sources."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
BASE = "/distributed-storage-notes"


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.path = path
        self.ids = set()
        self.links = []
        self.edit_links = []
        self.h1_count = 0
        self.math_count = 0
        self.diagram_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"Duplicate ID: {self.path}: {attrs['id']}"
            self.ids.add(attrs["id"])
        self.h1_count += tag == "h1"
        self.math_count += "data-tex" in attrs
        self.diagram_count += "mermaid" in attrs.get("class", "").split()
        for key in ("href", "src"):
            if attrs.get(key):
                self.links.append(attrs[key])
        if "doc-head__edit" in attrs.get("class", "").split():
            self.edit_links.append(attrs["href"])


def main():
    assert SITE.is_dir(), "Run bundle exec jekyll build first"
    pages = {}
    for file in SITE.rglob("*.html"):
        if "assets" in file.relative_to(SITE).parts:
            continue
        page = Page(file)
        page.feed(file.read_text())
        assert page.h1_count == 1, f"Expected one H1: {file}"
        pages[file.resolve()] = page
    nav = json.loads((ROOT / "navigation.json").read_text())
    expected = [p for g in nav["groups"] for p in g["pages"]] + nav["reference_pages"]
    for item in expected:
        relative = Path(item["path"]).with_suffix("")
        if relative.name == "README":
            relative = relative.parent
        file = SITE / relative / "index.html"
        assert file.resolve() in pages, f"Missing route: {item['path']}"
        assert pages[file.resolve()].edit_links == [f"https://github.com/miauyle/distributed-storage-notes/edit/master/{item['path']}"], f"Wrong edit link: {file}"
        source = (ROOT / item["path"]).read_text()
        assert pages[file.resolve()].math_count == len(re.findall(r"^```math\s*$|\$`[^`]+`\$", source, re.M)), f"Lost math: {file}"
        assert pages[file.resolve()].diagram_count == source.count("```mermaid"), f"Lost diagram: {file}"
    for file, page in pages.items():
        for link in page.links:
            url = urlsplit(link)
            if url.scheme or url.netloc:
                continue
            if url.path.startswith("/"):
                assert url.path == BASE or url.path.startswith(BASE + "/"), f"Escaped baseurl: {file}: {link}"
                target = SITE / unquote(url.path.removeprefix(BASE)).lstrip("/")
            else:
                target = file.parent / unquote(url.path)
            if target.is_dir():
                target /= "index.html"
            assert target.is_file(), f"Broken output link: {file}: {link}"
            if url.fragment and target.resolve() in pages:
                assert unquote(url.fragment) in pages[target.resolve()].ids, f"Broken anchor: {file}: {link}"
    index = json.loads((SITE / "search.json").read_text())
    assert len(index) == len(expected)
    expected_urls = {BASE + "/" + str(Path(p["path"]).parent if Path(p["path"]).name == "README.md" else Path(p["path"]).with_suffix("")) + "/" for p in expected}
    assert {p["url"] for p in index} == expected_urls, "Search coverage differs from actual sources"
    for item in index:
        assert item["content"] and item["category"] and item["url"].startswith(BASE + "/docs/")
    assert any("Checkpoint" in item["content"] for item in index), "Search truncated deep content"
    assert not (SITE / "maintenance").exists(), "Maintenance leaked into knowledge site"
    print(f"Site: {len(pages)} HTML pages; {len(index)} searchable documents; routes, anchors, edit links, math and diagrams OK")


if __name__ == "__main__":
    main()
