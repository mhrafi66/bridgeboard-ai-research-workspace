"""
Scholarly literature search via the OpenAlex API.

OpenAlex (https://openalex.org) is a free, open catalog of scholarly
works. It requires no API key. We use the public "polite pool" by
sending a mailto parameter, which OpenAlex asks for so it can contact
heavy users; it is not a secret.

Lambda has public internet egress by default (this stack does not put
the function in a VPC), so we can reach the HTTPS endpoint directly
with the standard library. No third-party dependency is added.
"""

import json
import urllib.parse
import urllib.request


OPENALEX_ENDPOINT = "https://api.openalex.org/works"

# OpenAlex asks heavy users to identify themselves so it can reach out.
# This is a contact hint, not a credential.
POLITE_MAILTO = "bridgeboard@example.com"

# Keep the request bounded so a single command cannot pull huge payloads.
_TIMEOUT_SECONDS = 12
_MAX_RESULTS = 8


def _reconstruct_abstract(inverted_index):
    """
    OpenAlex stores abstracts as an inverted index:
        {"word": [positions...], ...}
    Rebuild readable text by placing each word at its position(s).
    Returns an empty string when no abstract is available.
    """
    if not isinstance(inverted_index, dict) or not inverted_index:
        return ""

    positioned = []
    for word, positions in inverted_index.items():
        if not isinstance(positions, list):
            continue
        for pos in positions:
            if isinstance(pos, int):
                positioned.append((pos, word))

    if not positioned:
        return ""

    positioned.sort(key=lambda pair: pair[0])
    return " ".join(word for _, word in positioned)


def _parse_work(work):
    """Reduce a raw OpenAlex work object to the fields we display."""
    authorships = work.get("authorships") or []
    authors = [
        (a.get("author") or {}).get("display_name", "")
        for a in authorships
        if isinstance(a, dict)
    ]
    authors = [name for name in authors if name][:8]

    primary = work.get("primary_location") or {}
    source = primary.get("source") or {}
    venue = source.get("display_name", "") if isinstance(source, dict) else ""

    doi = work.get("doi") or ""

    abstract = _reconstruct_abstract(
        work.get("abstract_inverted_index")
    )
    # Keep abstracts bounded before they reach the model prompt.
    abstract = abstract[:1200]

    return {
        "title": work.get("title") or work.get("display_name") or "Untitled",
        "authors": authors,
        "year": work.get("publication_year"),
        "venue": venue,
        "doi": doi,
        "url": doi or (work.get("id") or ""),
        "citedBy": work.get("cited_by_count", 0),
        "abstract": abstract,
    }


def search_papers(query, max_results=_MAX_RESULTS):
    """
    Search OpenAlex for works matching the query, ordered by
    citation count so the most influential papers surface first.

    Returns (papers, error). On success error is "". On failure
    papers is [] and error is a human-readable message.
    """
    query = (query or "").strip()
    if not query:
        return [], "A search topic is required."

    try:
        count = int(max_results)
    except (TypeError, ValueError):
        count = _MAX_RESULTS
    count = max(1, min(count, 25))

    params = {
        "search": query,
        "per_page": count,
        "sort": "cited_by_count:desc",
        "mailto": POLITE_MAILTO,
        # Only request the fields we actually use.
        "select": (
            "id,title,display_name,publication_year,"
            "cited_by_count,doi,authorships,primary_location,"
            "abstract_inverted_index"
        ),
    }

    url = f"{OPENALEX_ENDPOINT}?{urllib.parse.urlencode(params)}"

    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": f"BridgeBoard/1.0 (mailto:{POLITE_MAILTO})",
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(
            request, timeout=_TIMEOUT_SECONDS
        ) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except Exception as err:  # noqa: BLE001 - surface any network/parse error
        return [], f"Scholarly search failed: {err}"

    results = payload.get("results")
    if not isinstance(results, list) or not results:
        return [], "No papers were found for that topic."

    papers = [_parse_work(work) for work in results if isinstance(work, dict)]
    return papers, ""
