#!/usr/bin/env python3
"""
page_audit.py: fetch pages and extract on-page and technical SEO signals to JSON.

Covers title/meta, canonical, robots (meta + X-Robots-Tag), hreflang, lang/dir,
headings, word count, Arabic text ratio, images/alt, links, JSON-LD types,
Open Graph, viewport, basic weight proxies, robots.txt rules for search and AI
crawlers, llms.txt presence, sitemap discovery and sampling, and (with
--compare-agents) what a browser, Googlebot, Bingbot and AI crawlers each receive. Adds a first-pass `issues` list
for each page and across pages (such as duplicate titles). Read the data yourself
before reporting; the flags are only prompts to look closer.

Usage examples:
  python page_audit.py https://example.com/ar/ --out crawl.json
  python page_audit.py https://example.com/ --sitemap-sample 20 --out crawl.json
  python page_audit.py --urls-file urls.txt --out crawl.json
  python page_audit.py https://example.com/ar/ --compare-agents 3 --out agents.json
  python page_audit.py --html-file saved.html --base-url https://example.com/page --out crawl.json

Safe fetching: every URL, including each redirect hop and every URL taken from a
sitemap, must be http(s) on port 80 or 443 (or a port you gave on the command
line), carry no credentials, and resolve only to public IP addresses. The check is
repeated when the socket connects, so a DNS answer that changes between the check
and the connection is caught too. Responses are capped at 15 MB. Sitemap samples
stay on the site being audited. --allow-private lets you audit a staging site on a
private network or localhost; cloud metadata and other link-local addresses stay
blocked. Behind an HTTP proxy the proxy resolves names, so the connect-time check
can't run; the per-hop check still does.

Needs: requests, beautifulsoup4 (pip install requests beautifulsoup4 lxml).
"""
import argparse
import ipaddress
import json
import random
import re
import socket
import sys
import time
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from urllib.parse import unquote, urljoin, urlparse

try:
    import requests
    from bs4 import BeautifulSoup
except ImportError:
    sys.exit("Missing dependency. Install with: pip install requests beautifulsoup4 lxml")

# ---------------------------------------------------------------------------
# Safe fetching (SSRF protection)
# ---------------------------------------------------------------------------
ALLOWED_SCHEMES = {"http", "https"}
ALLOWED_PORTS = {80, 443}          # main() adds ports the user gave explicitly
MAX_REDIRECTS = 10
MAX_BYTES = 15 * 1024 * 1024
ALLOW_PRIVATE = False              # --allow-private
BLOCKED_NAMES = ("localhost", "metadata", "metadata.google.internal")
BLOCKED_SUFFIXES = (".localhost", ".local", ".internal", ".home.arpa", ".lan", ".intranet")
NAT64 = ipaddress.ip_network("64:ff9b::/96")
THIS_NETWORK = ipaddress.ip_network("0.0.0.0/8")


class UnsafeURL(requests.RequestException):
    """Raised when a URL or a resolved address is not allowed."""


def _embedded_ipv4(ip):
    """IPv4 addresses hidden inside IPv6 forms (mapped, 6to4, NAT64, Teredo)."""
    out = []
    if ip.version == 6:
        if ip.ipv4_mapped:
            out.append(ip.ipv4_mapped)
        if ip.sixtofour:
            out.append(ip.sixtofour)
        if ip.teredo:
            out.append(ip.teredo[1])
        if ip in NAT64:
            out.append(ipaddress.IPv4Address(int(ip) & 0xFFFFFFFF))
    return out


def ip_blocked(addr):
    """Return a reason string if this address must not be fetched, else None."""
    try:
        ip = ipaddress.ip_address(str(addr).split("%", 1)[0])
    except ValueError:
        return f"unparseable address {addr!r}"
    for cand in [ip] + _embedded_ipv4(ip):
        # Always blocked: link-local (cloud metadata such as 169.254.169.254), multicast,
        # unspecified, "this network" (0.0.0.0/8) and reserved ranges.
        if (cand.is_link_local or cand.is_multicast or cand.is_unspecified
                or (cand.version == 4 and cand in THIS_NETWORK)):
            return f"{addr} is link-local, multicast or unspecified"
        if cand.is_loopback:
            if not ALLOW_PRIVATE:
                return f"{addr} is a loopback address (use --allow-private for your own staging site)"
            continue
        if cand.is_reserved:
            return f"{addr} is in a reserved range"
        if not cand.is_global and not ALLOW_PRIVATE:
            return f"{addr} is not a public address (use --allow-private for your own staging site)"
    return None


def _proxy_endpoints():
    """(host, port) of configured HTTP proxies. The connect-time check skips these,
    because behind a proxy the proxy, not this script, resolves the target."""
    eps = set()
    for url in urllib.request.getproxies().values():
        try:
            u = urlparse(url if "://" in url else "http://" + url)
            if u.hostname:
                eps.add((u.hostname.lower(), u.port or (443 if u.scheme == "https" else 80)))
        except ValueError:
            continue
    return eps


PROXY_ENDPOINTS = set()


def check_url(url):
    """Validate one URL before it is requested. Raises UnsafeURL."""
    try:
        u = urlparse(url)
        port = u.port
    except ValueError as e:
        raise UnsafeURL(f"invalid URL {url!r}: {e}")
    scheme = (u.scheme or "").lower()
    if scheme not in ALLOWED_SCHEMES:
        raise UnsafeURL(f"scheme {scheme!r} not allowed: {url}")
    if u.username or u.password:
        raise UnsafeURL(f"credentials in URL not allowed: {url}")
    host = (u.hostname or "").rstrip(".").lower()
    if not host:
        raise UnsafeURL(f"no host in URL: {url}")
    port = port or (443 if scheme == "https" else 80)
    if port not in ALLOWED_PORTS:
        raise UnsafeURL(f"port {port} not allowed (allowed: {sorted(ALLOWED_PORTS)}): {url}")
    if not ALLOW_PRIVATE and (host in BLOCKED_NAMES or host.endswith(BLOCKED_SUFFIXES)):
        raise UnsafeURL(f"local host name not allowed: {host}")
    try:
        infos = socket.getaddrinfo(host, port, 0, socket.SOCK_STREAM)
    except socket.gaierror as e:
        # A literal IP always resolves, so this is a name. Behind a proxy the proxy
        # resolves it; without one the request would fail anyway.
        if PROXY_ENDPOINTS:
            return
        raise UnsafeURL(f"DNS lookup failed for {host}: {e}")
    for info in infos:
        why = ip_blocked(info[4][0])
        if why:
            raise UnsafeURL(f"{host} resolves to a blocked address: {why}")


def _install_connect_guard():
    """Re-check the address at connect time, then connect to that vetted address,
    so a DNS answer that changes after check_url() cannot reach an internal host."""
    import urllib3.util.connection as u3conn
    if getattr(u3conn, "_seo_guard_installed", False):
        return
    original = u3conn.create_connection

    def guarded(address, *args, **kwargs):
        host, port = address
        if (str(host).lower(), port) in PROXY_ENDPOINTS:
            return original(address, *args, **kwargs)
        infos = socket.getaddrinfo(host, port, 0, socket.SOCK_STREAM)
        for info in infos:
            why = ip_blocked(info[4][0])
            if why:
                raise UnsafeURL(f"connect blocked for {host}: {why}")
        last = None
        for info in infos:
            try:
                return original((info[4][0], port), *args, **kwargs)
            except OSError as e:
                last = e
        raise last or OSError(f"could not connect to {host}")

    u3conn.create_connection = guarded
    u3conn._seo_guard_installed = True


def _read_capped(r):
    """Read at most MAX_BYTES of the body and make it available as r.content."""
    buf = bytearray()
    truncated = False
    for chunk in r.iter_content(65536):
        buf += chunk
        if len(buf) > MAX_BYTES:
            truncated = True
            break
    r.close()
    r._content = bytes(buf[:MAX_BYTES])
    r._content_consumed = True
    r.truncated = truncated
    return r


def safe_get(session, url, allow_redirects=True):
    """GET with manual redirects: every hop is checked before it is requested.
    Returns (response, redirect_chain). Raises requests.RequestException."""
    chain, current = [], url
    for _ in range(MAX_REDIRECTS + 1):
        check_url(current)
        r = session.get(current, timeout=TIMEOUT, allow_redirects=False, stream=True)
        if allow_redirects and r.is_redirect:
            chain.append({"url": current, "status": r.status_code})
            nxt = urljoin(current, r.headers.get("location", ""))
            r.close()
            current = nxt
            continue
        return _read_capped(r), chain
    raise requests.TooManyRedirects(f"more than {MAX_REDIRECTS} redirects starting at {url}")


UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 SEO-audit")
TIMEOUT = 20

# Crawlers to report robots.txt access for. Purpose notes live in the skill references.
BOTS = [
    "Googlebot", "Bingbot",
    "OAI-SearchBot", "ChatGPT-User", "GPTBot",
    "Claude-SearchBot", "Claude-User", "ClaudeBot",
    "PerplexityBot", "Perplexity-User", "Google-Agent",
    "Google-Extended", "Applebot-Extended", "CCBot", "Bytespider", "meta-externalagent",
]

ARABIC_RE = re.compile(r"[؀-ۿݐ-ݿࢠ-ࣿ]")
LATIN_RE = re.compile(r"[A-Za-z]")


def parser_name():
    try:
        import lxml  # noqa: F401
        return "lxml"
    except ImportError:
        return "html.parser"


def decode(r):
    """Decode a response body. requests falls back to ISO-8859-1 when the header has no
    charset, which garbles Arabic, so read <meta charset> first, then try UTF-8."""
    ctype = r.headers.get("content-type", "").lower()
    if "charset=" in ctype:
        return r.text
    m = re.search(rb"""<meta[^>]+charset=["']?\s*([A-Za-z0-9_\-]+)""", r.content[:4096], re.I)
    for enc in ([m.group(1).decode("ascii", "ignore")] if m else []) + ["utf-8"]:
        try:
            return r.content.decode(enc)
        except (LookupError, UnicodeDecodeError):
            pass
    return r.content.decode(r.apparent_encoding or "utf-8", errors="replace")


def fetch(session, url):
    """GET a URL and record the redirect chain, status, headers, and timing."""
    t0 = time.time()
    try:
        r, chain = safe_get(session, url)
    except requests.RequestException as e:
        return {"requested_url": url, "error": f"{type(e).__name__}: {e}"}
    return {
        "requested_url": url,
        "final_url": r.url,
        "status": r.status_code,
        "redirect_chain": chain,
        "truncated": bool(getattr(r, "truncated", False)),
        "elapsed_ms": int((time.time() - t0) * 1000),
        "headers": {k.lower(): v for k, v in r.headers.items()
                    if k.lower() in ("content-type", "x-robots-tag", "content-language",
                                     "last-modified", "cache-control", "link", "server")},
        "html": decode(r) if "html" in r.headers.get("content-type", "").lower() else "",
        "bytes": len(r.content),
    }


def text_of(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)) if el else ""


def extract(html, base_url):
    soup = BeautifulSoup(html, parser_name())
    head = soup.head or soup
    host = urlparse(base_url).netloc.lower().removeprefix("www.")

    def meta(name=None, prop=None):
        if name:
            el = head.find("meta", attrs={"name": re.compile(f"^{re.escape(name)}$", re.I)})
        else:
            el = head.find("meta", attrs={"property": re.compile(f"^{re.escape(prop)}$", re.I)})
        return el.get("content", "").strip() if el else None

    html_tag = soup.find("html")
    title_el = soup.find("title")
    title = text_of(title_el) if title_el else None

    canon = [l.get("href") for l in soup.find_all("link", rel=True, href=True)
             if "canonical" in [r.lower() for r in l.get("rel")]]
    hreflang = [{"hreflang": l.get("hreflang"), "href": urljoin(base_url, l.get("href", ""))}
                for l in soup.find_all("link", hreflang=True)]

    # Structured data
    jsonld_types, jsonld_errors = [], 0
    for s in soup.find_all("script", type=re.compile("ld\\+json", re.I)):
        try:
            data = json.loads(s.string or s.get_text() or "{}")
        except Exception:
            jsonld_errors += 1
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                t = node.get("@type")
                if t:
                    jsonld_types.extend(t if isinstance(t, list) else [t])
                for v in node.values():
                    if isinstance(v, (dict, list)):
                        stack.append(v)
            elif isinstance(node, list):
                stack.extend(node)
    microdata = len(soup.find_all(attrs={"itemtype": True}))

    # Body text (scripts/styles/nav noise removed)
    body = soup.body or soup
    for t in body.find_all(["script", "style", "noscript", "template", "svg"]):
        t.decompose()
    body_text = text_of(body)
    words = body_text.split()
    ar_chars = len(ARABIC_RE.findall(body_text))
    lat_chars = len(LATIN_RE.findall(body_text))
    letters = ar_chars + lat_chars

    headings = {f"h{i}": [text_of(h)[:150] for h in soup.find_all(f"h{i}")] for i in range(1, 4)}

    imgs = soup.find_all("img")
    missing_alt = [i.get("src") or i.get("data-src") for i in imgs if not (i.get("alt") or "").strip()]

    internal, external, nofollow = 0, 0, 0
    internal_urls = set()
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.startswith(("#", "mailto:", "tel:", "javascript:", "whatsapp:")):
            continue
        absu = urljoin(base_url, href)
        h = urlparse(absu).netloc.lower().removeprefix("www.")
        if "nofollow" in [r.lower() for r in (a.get("rel") or [])]:
            nofollow += 1
        if h == host:
            internal += 1
            internal_urls.add(absu.split("#")[0])
        else:
            external += 1

    return {
        "lang": html_tag.get("lang") if html_tag else None,
        "dir": html_tag.get("dir") if html_tag else None,
        "title": title,
        "title_length": len(title) if title else 0,
        "meta_description": meta(name="description"),
        "meta_description_length": len(meta(name="description") or ""),
        "meta_robots": meta(name="robots"),
        "canonical": [urljoin(base_url, c) for c in canon],
        "hreflang": hreflang,
        "viewport": meta(name="viewport"),
        "og": {"title": meta(prop="og:title"), "description": meta(prop="og:description"),
               "image": meta(prop="og:image"), "locale": meta(prop="og:locale")},
        "headings": headings,
        "h1_count": len(headings["h1"]),
        "word_count": len(words),
        "arabic_letter_ratio": round(ar_chars / letters, 2) if letters else 0.0,
        "images": len(imgs),
        "images_missing_alt": len(missing_alt),
        "images_missing_alt_examples": [u for u in missing_alt if u][:5],
        "links_internal": internal,
        "links_external": external,
        "links_nofollow": nofollow,
        "internal_link_sample": sorted(internal_urls)[:50],
        "jsonld_types": sorted(set(jsonld_types)),
        "jsonld_parse_errors": jsonld_errors,
        "microdata_items": microdata,
        "scripts": len(soup.find_all("script")),
        "stylesheets": len(soup.find_all("link", rel=lambda r: r and "stylesheet" in [x.lower() for x in r])),
    }


def page_issues(p):
    """First-pass flags. Each says what was seen; severity is decided in the report."""
    out = []
    if p.get("error"):
        return [f"fetch failed: {p['error']}"]
    st = p.get("status")
    if st and st >= 400:
        out.append(f"HTTP {st}")
    if len(p.get("redirect_chain", [])) > 1:
        out.append(f"redirect chain of {len(p['redirect_chain'])} hops")
    if p.get("truncated"):
        out.append("response over 15 MB: only the first 15 MB was parsed")
    if not p.get("html_parsed"):
        return out + ["non-HTML response"]
    x = p["data"]
    robots = " ".join(filter(None, [x.get("meta_robots"), p["headers"].get("x-robots-tag")])).lower()
    if "noindex" in robots:
        out.append("noindex (meta robots or X-Robots-Tag)")
    if not x["title"]:
        out.append("missing <title>")
    elif x["title_length"] > 65:
        out.append(f"title long ({x['title_length']} chars)")
    elif x["title_length"] < 15:
        out.append(f"title short ({x['title_length']} chars)")
    if not x["meta_description"]:
        out.append("missing meta description")
    if x["h1_count"] == 0:
        out.append("no H1")
    elif x["h1_count"] > 1:
        out.append(f"{x['h1_count']} H1s")
    canon = x["canonical"]
    if not canon:
        out.append("no canonical")
    elif len(canon) > 1:
        out.append("multiple canonicals")
    elif canon[0].rstrip("/") != p["final_url"].rstrip("/"):
        out.append(f"canonical points elsewhere: {canon[0]}")
    if not x["lang"]:
        out.append("missing <html lang>")
    if x["arabic_letter_ratio"] >= 0.5:
        if (x["dir"] or "").lower() != "rtl":
            out.append("mostly Arabic text but <html dir> is not rtl")
        if x["lang"] and not x["lang"].lower().startswith("ar"):
            out.append(f"mostly Arabic text but lang='{x['lang']}'")
    if x["hreflang"]:
        codes = [h["hreflang"] for h in x["hreflang"]]
        hrefs = [h["href"].rstrip("/") for h in x["hreflang"]]
        if p["final_url"].rstrip("/") not in hrefs:
            out.append("hreflang set lacks self-reference")
        if "x-default" not in [c.lower() for c in codes if c]:
            out.append("hreflang without x-default")
        bad = [c for c in codes if c and c.lower() != "x-default"
               and not re.fullmatch(r"[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|\d{3}))?", c)]
        if bad:
            out.append(f"suspicious hreflang codes: {bad}")
    if not x["viewport"]:
        out.append("no viewport meta")
    if not x["jsonld_types"] and not x["microdata_items"]:
        out.append("no structured data found")
    if x["jsonld_parse_errors"]:
        out.append(f"{x['jsonld_parse_errors']} JSON-LD block(s) failed to parse")
    if x["images_missing_alt"]:
        out.append(f"{x['images_missing_alt']}/{x['images']} images missing alt")
    if x["word_count"] < 150:
        out.append(f"low visible text in raw HTML ({x['word_count']} words): thin page or JS-rendered")
    return out


def parse_robots(body):
    """Groups of (user-agent tokens, [(allow, pattern)]) per RFC 9309."""
    groups, agents, rules = [], [], []
    for raw in body.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        k, v = (x.strip() for x in line.split(":", 1))
        k = k.lower()
        if k == "user-agent":
            if rules:
                groups.append((agents, rules))
                agents, rules = [], []
            agents.append(v.lower())
        elif k in ("allow", "disallow") and agents:
            rules.append((k == "allow", v))
    if agents:
        groups.append((agents, rules))
    return groups


def robots_allowed(groups, token, url):
    """RFC 9309: exact product-token group match (else '*'), longest matching rule wins,
    allow wins ties. Python's robotparser does neither, so it isn't used."""
    t = token.lower()
    rules = [r for a, rs in groups if t in a for r in rs]
    if not any(t in a for a, _ in groups):
        rules = [r for a, rs in groups if "*" in a for r in rs]
    u = urlparse(url)
    path = unquote(u.path or "/") + (("?" + u.query) if u.query else "")
    best = None
    for allow, pat in rules:
        if not pat:
            continue
        rx = "^" + re.escape(unquote(pat)).replace(r"\*", ".*")
        if rx.endswith(r"\$"):
            rx = rx[:-2] + "$"
        if re.match(rx, path):
            if best is None or len(pat) > best[0] or (len(pat) == best[0] and allow and not best[1]):
                best = (len(pat), allow)
    return True if best is None else best[1]


def robots_report(session, origin):
    url = urljoin(origin, "/robots.txt")
    res = {"url": url, "groups": []}
    try:
        r, _ = safe_get(session, url)
        res["status"] = r.status_code
    except requests.RequestException as e:
        res["error"] = str(e)
        res["interpretation"] = "unreachable: result unknown (Google treats an unreachable robots.txt as a temporary full block)"
        res["homepage_allowed"] = None
        return res
    body = decode(r) if r.status_code == 200 else ""
    if r.status_code == 200 and "html" in r.headers.get("content-type", "").lower() or body.lstrip()[:15].lower().startswith(("<!doctype", "<html")):
        res["interpretation"] = "robots.txt returned HTML (bot challenge or misconfiguration): rules unknown, check manually"
        res["homepage_allowed"] = None
        return res
    if 400 <= r.status_code < 500:
        res["interpretation"] = f"HTTP {r.status_code}: no robots.txt, so crawlers may fetch everything"
    elif r.status_code >= 500:
        res["interpretation"] = f"HTTP {r.status_code}: server error; Google treats this as a temporary full block"
        res["homepage_allowed"] = None
        return res
    else:
        res["interpretation"] = "parsed (RFC 9309 matching)"
    res["sitemaps_declared"] = re.findall(r"(?im)^\s*sitemap:\s*(\S+)", body)
    res["raw_excerpt"] = body[:3000]
    groups = parse_robots(body)
    res["groups"] = groups
    home = urljoin(origin, "/")
    res["homepage_allowed"] = {b: robots_allowed(groups, b, home) for b in BOTS}
    named = {a for ag, _ in groups for a in ag}
    res["bots_named_explicitly"] = [b for b in BOTS if b.lower() in named]
    res["note"] = ("ChatGPT-User, Perplexity-User and Google-Agent fetch on a user's request and may not follow "
                   "robots.txt; Google-Extended and Applebot-Extended are control tokens only and never appear in logs.")
    return res


# User agents for --compare-agents. The product token (GPTBot, ClaudeBot, ...) is what
# robots.txt and most bot rules match on; full strings follow each operator's published format.
AGENTS = {
    "browser": UA,
    "Googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot)",
    "ChatGPT-User": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0; +https://openai.com/bot)",
    "GPTBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.4; +https://openai.com/gptbot)",
    "Claude-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)",
    "ClaudeBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)",
    "Claude-User": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Claude-User/1.0; +Claude-User@anthropic.com)",
    "PerplexityBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)",
    "Perplexity-User": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; Perplexity-User/1.0; +https://perplexity.ai/perplexity-user)",
    "Google-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko; compatible; Google-Agent; +https://developers.google.com/crawling/docs/crawlers-fetchers/google-agent) Chrome/130.0.0.0 Safari/537.36",
}
CHALLENGE_RE = re.compile(r"captcha|cf-chl|challenge-platform|attention required|access denied|"
                          r"verify you are human|are you a robot|request blocked", re.I)


def compare_agents(url, delay=0.5):
    """Fetch one URL as each agent and summarise what each receives."""
    rows = []
    for name, ua in AGENTS.items():
        sess = requests.Session()
        sess.headers.update({"User-Agent": ua, "Accept-Language": "ar,en;q=0.8"})
        p = fetch(sess, url)
        html = p.pop("html", "")
        row = {"agent": name, "status": p.get("status"), "error": p.get("error"),
               "final_url": p.get("final_url"), "bytes": p.get("bytes")}
        if html:
            d = extract(html, p["final_url"])
            row.update({"lang": d["lang"], "title": d["title"], "h1_count": d["h1_count"],
                        "word_count": d["word_count"], "jsonld_types": len(d["jsonld_types"]),
                        "canonical": (d["canonical"] or [None])[0],
                        "challenge_page": bool(CHALLENGE_RE.search(html[:20000])) and d["word_count"] < 300})
        rows.append(row)
        time.sleep(delay)
    base = rows[0]
    flags = []
    for r in rows[1:]:
        if r.get("status") != base.get("status"):
            flags.append(f"{r['agent']}: HTTP {r.get('status')} vs browser {base.get('status')}")
        if r.get("challenge_page"):
            flags.append(f"{r['agent']}: looks like a bot challenge/block page")
        for k in ("lang", "title", "canonical"):
            if r.get(k) != base.get(k) and r.get("status") == 200:
                flags.append(f"{r['agent']}: {k} differs ({r.get(k)!r} vs browser {base.get(k)!r})")
        bw, rw = base.get("word_count") or 0, r.get("word_count") or 0
        if r.get("status") == 200 and bw and abs(rw - bw) > max(150, 0.3 * bw):
            flags.append(f"{r['agent']}: {rw} words vs browser {bw}")
        if r.get("status") == 200 and (r.get("jsonld_types") or 0) != (base.get("jsonld_types") or 0):
            flags.append(f"{r['agent']}: {r.get('jsonld_types')} JSON-LD types vs browser {base.get('jsonld_types')}")
    return {"url": url, "agents": rows, "differences": flags,
            "note": "Spoofed user agents; CDNs may verify real bots by IP, so treat differences as Inferred and confirm in logs or CDN settings."}


def llms_txt_check(session, origin):
    url = urljoin(origin, "/llms.txt")
    try:
        r, _ = safe_get(session, url)
    except requests.RequestException as e:
        return {"url": url, "error": str(e)}
    ctype = r.headers.get("content-type", "")
    text = decode(r) if r.status_code == 200 else ""
    looks_md = r.status_code == 200 and "html" not in ctype.lower() and text.lstrip().startswith("#")
    return {"url": url, "status": r.status_code, "content_type": ctype, "bytes": len(r.content),
            "looks_like_llms_txt": looks_md, "excerpt": text[:600] if looks_md else ""}


def sitemap_urls(session, sitemap_url, limit=5000, depth=0):
    """Return (page_urls, notes). Follows sitemap indexes one level deep."""
    notes, urls = [], []
    try:
        r, _ = safe_get(session, sitemap_url)
    except requests.RequestException as e:
        return [], [f"{sitemap_url}: {e}"]
    if r.status_code != 200:
        return [], [f"{sitemap_url}: HTTP {r.status_code}"]
    locs = re.findall(r"<loc>\s*(.*?)\s*</loc>", r.text, re.S)
    lastmods = re.findall(r"<lastmod>\s*(.*?)\s*</lastmod>", r.text, re.S)
    if "<sitemapindex" in r.text[:2000] and depth == 0:
        notes.append(f"{sitemap_url}: sitemap index with {len(locs)} child sitemaps")
        for child in locs[:20]:
            u, n = sitemap_urls(session, child, limit, depth + 1)
            urls += u
            notes += n
            if len(urls) >= limit:
                break
    else:
        xmlish = [l for l in locs if l.lower().endswith((".xml", ".xml.gz"))]
        if xmlish:
            notes.append(f"{sitemap_url}: {len(xmlish)} <url> entries point to .xml files "
                         f"(sitemaps listed as pages?) e.g. {xmlish[:2]}")
        if lastmods and len(set(lastmods)) == 1 and len(lastmods) > 5:
            notes.append(f"{sitemap_url}: all {len(lastmods)} lastmod values identical ({lastmods[0]})")
        notes.append(f"{sitemap_url}: {len(locs)} URLs")
        urls += locs
    return urls[:limit], notes


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("urls", nargs="*", help="URLs to audit")
    ap.add_argument("--urls-file", help="text file, one URL per line")
    ap.add_argument("--html-file", help="audit a saved HTML file instead of fetching (use with --base-url)")
    ap.add_argument("--base-url", help="URL the saved HTML came from")
    ap.add_argument("--sitemap-sample", type=int, default=0,
                    help="also audit N URLs sampled from the site's sitemap(s)")
    ap.add_argument("--max-pages", type=int, default=40)
    ap.add_argument("--delay", type=float, default=0.7, help="seconds between requests")
    ap.add_argument("--no-site-checks", action="store_true", help="skip robots.txt, llms.txt and sitemap checks")
    ap.add_argument("--compare-agents", nargs="?", type=int, const=3, default=0, metavar="N",
                    help="fetch the first N URLs (default 3) as a browser, Googlebot, Bingbot and AI crawlers, and compare")
    ap.add_argument("--allow-private", action="store_true",
                    help="allow private and loopback addresses (your own staging site); link-local stays blocked")
    ap.add_argument("--out", default="crawl.json")
    a = ap.parse_args()

    result = {"generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
              "tool": "page_audit.py", "pages": [], "site": {}, "cross_page_issues": []}

    if a.html_file:
        if not a.base_url:
            print("WARNING: --html-file without --base-url: canonical and hreflang self-reference checks are skipped.", file=sys.stderr)
        if a.compare_agents:
            print("NOTE: --compare-agents needs live URLs and is ignored with --html-file.", file=sys.stderr)
        base = a.base_url or "https://example.invalid/"
        html = open(a.html_file, encoding="utf-8", errors="replace").read()
        p = {"requested_url": base, "final_url": base, "status": None, "redirect_chain": [],
             "headers": {}, "bytes": len(html.encode()), "source": f"file:{a.html_file}"}
        p["data"], p["html_parsed"] = extract(html, base), True
        p["issues"] = page_issues(p)
        if not a.base_url:
            p["issues"] = [i for i in p["issues"] if not i.startswith(("canonical points elsewhere", "hreflang set lacks self-reference"))]
        result["pages"].append(p)
        json.dump(result, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        print(f"Wrote {a.out} (1 page from file)")
        return

    urls = list(a.urls)
    if a.urls_file:
        urls += [l.strip() for l in open(a.urls_file, encoding="utf-8") if l.strip() and not l.startswith("#")]
    if not urls:
        ap.error("give at least one URL, --urls-file, or --html-file")

    global ALLOW_PRIVATE, PROXY_ENDPOINTS
    ALLOW_PRIVATE = a.allow_private
    if ALLOW_PRIVATE:
        print("WARNING: --allow-private: private and loopback addresses can be fetched. "
              "Use it only for a site you own.", file=sys.stderr)
    for u in urls:  # ports the user typed are allowed; redirects to other ports are not
        try:
            if urlparse(u).port:
                ALLOWED_PORTS.add(urlparse(u).port)
        except ValueError:
            pass
    PROXY_ENDPOINTS = _proxy_endpoints()
    _install_connect_guard()

    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "ar,en;q=0.8"})

    origins = sorted({f"{urlparse(u).scheme}://{urlparse(u).netloc}" for u in urls})
    if not a.no_site_checks:
        for origin in origins:
            rb = robots_report(s, origin)
            sm_candidates = rb.get("sitemaps_declared") or [urljoin(origin, "/sitemap.xml")]
            all_sm_urls, notes = [], []
            for sm in sm_candidates[:5]:
                u, n = sitemap_urls(s, sm)
                all_sm_urls += u
                notes += n
            result["site"][origin] = {"robots": rb, "llms_txt": llms_txt_check(s, origin), "sitemap_notes": notes,
                                      "sitemap_url_count": len(all_sm_urls)}
            if a.sitemap_sample and all_sm_urls:
                site_host = urlparse(origin).netloc.lower().removeprefix("www.")
                pages_only = [u for u in all_sm_urls if not u.lower().endswith((".xml", ".xml.gz"))
                              and urlparse(u).netloc.lower().removeprefix("www.") == site_host]
                skipped = len([u for u in all_sm_urls if not u.lower().endswith((".xml", ".xml.gz"))]) - len(pages_only)
                if skipped:
                    notes.append(f"{skipped} sitemap URL(s) on other hosts not sampled")
                random.seed(7)
                urls += random.sample(pages_only, min(a.sitemap_sample, len(pages_only)))

    seen, queue = set(), []
    for u in urls:
        if u not in seen:
            seen.add(u)
            queue.append(u)
    queue = queue[: a.max_pages]

    for i, u in enumerate(queue):
        p = fetch(s, u)
        html = p.pop("html", "")
        p["html_parsed"] = bool(html)
        if html:
            p["data"] = extract(html, p["final_url"])
        p["issues"] = page_issues(p)
        result["pages"].append(p)
        print(f"[{i+1}/{len(queue)}] {p.get('status', 'ERR')} {u}  issues={len(p['issues'])}", file=sys.stderr)
        time.sleep(a.delay)

    # robots.txt check on every crawled URL, not only the homepage
    blocked = defaultdict(list)
    for p in result["pages"]:
        u = p.get("final_url") or p.get("requested_url")
        origin = f"{urlparse(u).scheme}://{urlparse(u).netloc}"
        groups = (result["site"].get(origin) or {}).get("robots", {}).get("groups")
        if groups:
            for b in BOTS:
                if not robots_allowed(groups, b, u):
                    blocked[b].append(u)
    result["robots_blocked_crawled_urls"] = dict(blocked)

    if a.compare_agents:
        result["agent_comparison"] = []
        for u in queue[: a.compare_agents]:
            print(f"comparing agents: {u}", file=sys.stderr)
            result["agent_comparison"].append(compare_agents(u, delay=a.delay))

    # Cross-page checks
    titles, descs = defaultdict(list), defaultdict(list)
    for p in result["pages"]:
        d = p.get("data") or {}
        if d.get("title"):
            titles[d["title"]].append(p["final_url"])
        if d.get("meta_description"):
            descs[d["meta_description"]].append(p["final_url"])
    for t, us in titles.items():
        if len(us) > 1:
            result["cross_page_issues"].append({"issue": "duplicate title", "value": t, "urls": us})
    for t, us in descs.items():
        if len(us) > 1:
            result["cross_page_issues"].append({"issue": "duplicate meta description", "value": t[:160], "urls": us})

    # hreflang return-tag check among crawled pages
    by_url = {p["final_url"].rstrip("/"): p for p in result["pages"] if p.get("data")}
    for url, p in by_url.items():
        for h in p["data"]["hreflang"]:
            tgt = by_url.get(h["href"].rstrip("/"))
            if tgt and h["href"].rstrip("/") != url:
                back = [x["href"].rstrip("/") for x in tgt["data"]["hreflang"]]
                if url not in back:
                    result["cross_page_issues"].append(
                        {"issue": "hreflang missing return tag", "from": url, "to": h["href"]})

    json.dump(result, open(a.out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # Short human summary
    c = Counter(re.sub(r"\b\d+\b", "N", i.split(":")[0].split("(")[0]).strip()
                for p in result["pages"] for i in p["issues"])
    print(f"\nWrote {a.out}: {len(result['pages'])} pages")
    for origin, info in result["site"].items():
        rb = info["robots"]
        ha = rb.get("homepage_allowed")
        hb = "unknown" if ha is None else ([b for b, ok in ha.items() if not ok] or "none")
        print(f"{origin}: robots.txt HTTP {rb.get('status')} ({rb.get('interpretation')}); sitemap URLs {info['sitemap_url_count']}; "
              f"bots blocked from homepage: {hb}")
        lt = info.get("llms_txt", {})
        print(f"  llms.txt: HTTP {lt.get('status')} ({'present' if lt.get('looks_like_llms_txt') else 'not found or not Markdown'})")
        for n in info["sitemap_notes"]:
            print(f"  sitemap: {n}")
    for b, us in result.get("robots_blocked_crawled_urls", {}).items():
        print(f"  robots.txt blocks {b} on {len(us)} crawled URL(s), e.g. {us[0]}")
    print("Most common page issues:")
    for k, v in c.most_common(15):
        print(f"  {v:>3}  {k}")
    for ci in result["cross_page_issues"][:10]:
        print(f"  cross-page: {ci['issue']} -> {ci.get('value', ci.get('to', ''))[:80]}")
    for comp in result.get("agent_comparison", []):
        print(f"\nAgent comparison: {comp['url']}")
        for r in comp["agents"]:
            print(f"  {r['agent']:<17} HTTP {r.get('status')!s:<4} lang={r.get('lang')!s:<6} words={r.get('word_count')!s:<6} "
                  f"jsonld={r.get('jsonld_types')!s:<3} {'CHALLENGE ' if r.get('challenge_page') else ''}{r.get('error') or ''}")
        for f in comp["differences"] or ["no differences from the browser fetch"]:
            print(f"  -> {f}")


if __name__ == "__main__":
    main()
