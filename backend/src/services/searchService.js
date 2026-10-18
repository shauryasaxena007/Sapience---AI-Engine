import { env } from '../config/env.js';

/** Returns [{title, url, snippet}] or [] when search is not configured or fails. */
export async function webSearch(query, max = 5) {
  if (!env.tavilyKey) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${env.tavilyKey}` },
      body: JSON.stringify({ query, max_results: max }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).slice(0, max).map((r) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: (r.content || '').slice(0, 600),
    }));
  } catch {
    return [];
  }
}
