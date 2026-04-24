// Shared PubMed E-utilities client (NCBI public API)
// Docs: https://www.ncbi.nlm.nih.gov/books/NBK25500/

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  year: string;
  url: string;
  abstract: string;
}

const ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";
const EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";
const TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, ms = TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

/** Search PubMed and return up to `limit` PMIDs ordered by relevance. */
export async function searchPubMedIds(query: string, limit = 5): Promise<string[]> {
  const params = new URLSearchParams({
    db: "pubmed",
    term: query,
    retmode: "json",
    retmax: String(limit),
    sort: "relevance",
  });
  const res = await fetchWithTimeout(`${ESEARCH}?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data?.esearchresult?.idlist ?? [];
}

/** Fetch metadata + abstracts for a list of PMIDs. */
export async function fetchPubMedArticles(pmids: string[]): Promise<PubMedArticle[]> {
  if (!pmids.length) return [];

  // ESummary for structured metadata
  const sumParams = new URLSearchParams({
    db: "pubmed",
    id: pmids.join(","),
    retmode: "json",
  });
  const [sumRes, absRes] = await Promise.all([
    fetchWithTimeout(`${ESUMMARY}?${sumParams}`),
    fetchWithTimeout(
      `${EFETCH}?${new URLSearchParams({
        db: "pubmed",
        id: pmids.join(","),
        rettype: "abstract",
        retmode: "text",
      })}`
    ),
  ]);

  let summaries: Record<string, any> = {};
  if (sumRes.ok) {
    const sumJson = await sumRes.json();
    summaries = sumJson?.result ?? {};
  }

  // Parse plain-text abstracts (one block per article separated by blank lines)
  let abstractText = "";
  if (absRes.ok) abstractText = await absRes.text();

  const abstractsByPmid = parseAbstractsByPmid(abstractText, pmids);

  return pmids
    .map((pmid) => {
      const s = summaries[pmid];
      if (!s) return null;
      const authors = (s.authors ?? [])
        .map((a: any) => a?.name)
        .filter(Boolean)
        .slice(0, 4);
      return {
        pmid,
        title: s.title ?? "",
        authors,
        journal: s.fulljournalname || s.source || "",
        year: (s.pubdate || "").slice(0, 4),
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        abstract: abstractsByPmid[pmid] || "",
      } as PubMedArticle;
    })
    .filter((a): a is PubMedArticle => !!a);
}

/** Combined helper: search + fetch in one call. */
export async function searchPubMed(
  query: string,
  limit = 5
): Promise<PubMedArticle[]> {
  const ids = await searchPubMedIds(query, limit);
  return fetchPubMedArticles(ids);
}

function parseAbstractsByPmid(text: string, pmids: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  if (!text) return out;
  // EFetch text format: blocks separated by blank lines, each block contains "PMID: XXXX"
  const blocks = text.split(/\n\n(?=\d+:\s)/);
  for (const block of blocks) {
    const pmidMatch = block.match(/PMID:\s*(\d+)/);
    if (!pmidMatch) continue;
    const pmid = pmidMatch[1];
    if (!pmids.includes(pmid)) continue;
    // Abstract is typically between the title block and the "PMID:" line.
    // Strip header lines and "Author information" segments crudely.
    const cleaned = block
      .replace(/PMID:[\s\S]*$/m, "")
      .replace(/Author information:[\s\S]*?(?=\n\n)/g, "")
      .trim();
    out[pmid] = cleaned.slice(0, 1500);
  }
  return out;
}
