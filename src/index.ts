interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * 19hz.info MCP.
 *
 * Underground electronic / dance music event listings, organized by region
 * (Bay Area, LA, Texas, Seattle, etc.). 19hz publishes one HTML table per
 * region with columns: Date/Time | Event @ Venue (City) genres | Price/Age |
 * Organizers | Links | (sortable ISO date). Keyless; we scrape + normalize.
 */


const BASE = 'https://19hz.info/eventlisting_';
const UA = 'Mozilla/5.0 (compatible; pipeworx-mcp-19hz/1.0; +https://pipeworx.io)';

/** Verified live regions (page slug → human label). Houston soft-404s; Texas covers it. */
const REGIONS: Record<string, string> = {
  bayarea: 'San Francisco Bay Area',
  losangeles: 'Los Angeles',
  sandiego: 'San Diego',
  lasvegas: 'Las Vegas',
  phoenix: 'Phoenix',
  denver: 'Denver',
  seattle: 'Seattle',
  texas: 'Texas (Austin / Dallas / Houston)',
  iowa: 'Iowa',
  detroit: 'Detroit',
  atlanta: 'Atlanta',
  miami: 'Miami',
  dc: 'Washington DC',
  toronto: 'Toronto',
};
/** page-file casing for each slug */
const PAGE: Record<string, string> = {
  bayarea: 'BayArea',
  losangeles: 'LosAngeles',
  sandiego: 'SanDiego',
  lasvegas: 'LasVegas',
  phoenix: 'Phoenix',
  denver: 'Denver',
  seattle: 'Seattle',
  texas: 'Texas',
  iowa: 'Iowa',
  detroit: 'Detroit',
  atlanta: 'Atlanta',
  miami: 'Miami',
  dc: 'DC',
  toronto: 'Toronto',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'regions',
    description: 'List the regions 19hz covers (slug + label). Pass a slug to the events tool. Note: electronic/dance music focus (house, techno, bass, etc.).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'events',
    description:
      'List upcoming electronic/dance music events for a 19hz region. Optionally filter by keyword (matches title, venue, genre, or artist) and a date window. Returns normalized events sorted by date.',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region slug, e.g. "bayarea", "losangeles", "texas". Use the regions tool to list all.' },
        query: { type: 'string', description: 'Optional keyword filter, e.g. "techno", a venue name, or an artist.' },
        from: { type: 'string', description: 'Only events on/after this date (YYYY-MM-DD).' },
        to: { type: 'string', description: 'Only events on/before this date (YYYY-MM-DD).' },
        limit: { type: 'number', description: 'Max events to return (1-200, default 50).' },
      },
      required: ['region'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'regions':
      return { count: Object.keys(REGIONS).length, regions: Object.entries(REGIONS).map(([slug, label]) => ({ slug, label })) };
    case 'events':
      return listEvents(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function listEvents(args: Record<string, unknown>): Promise<unknown> {
  const region = String(args.region ?? '').toLowerCase().replace(/[^a-z]/g, '');
  if (!PAGE[region]) {
    throw new Error(`Unknown region "${args.region}". Valid slugs: ${Object.keys(REGIONS).join(', ')}.`);
  }
  const url = `${BASE}${PAGE[region]}.php`;
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
  if (!res.ok) throw new Error(`19hz ${region}: HTTP ${res.status}`);
  const html = await res.text();

  let events = parseRows(html);

  const q = typeof args.query === 'string' ? args.query.trim().toLowerCase() : '';
  if (q) {
    events = events.filter((e) =>
      `${e.title} ${e.venue} ${e.city} ${e.genres} ${e.organizers}`.toLowerCase().includes(q),
    );
  }
  const from = dateArg(args.from);
  const to = dateArg(args.to);
  if (from) events = events.filter((e) => !e.date || e.date >= from);
  if (to) events = events.filter((e) => !e.date || e.date <= to);

  const limit = clamp(numArg(args.limit, 50), 1, 200);
  const total = events.length;
  events.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

  return {
    region: REGIONS[region],
    region_slug: region,
    source: url,
    genre_focus: 'electronic / dance music',
    total_matching: total,
    count: Math.min(total, limit),
    events: events.slice(0, limit),
  };
}

interface Ev {
  date: string;
  date_time: string;
  title: string;
  venue: string;
  city: string;
  genres: string;
  price: string;
  organizers: string;
  links: { text: string; url: string }[];
}

function parseRows(html: string): Ev[] {
  const out: Ev[] = [];
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = row.match(/<td[\s\S]*?<\/td>/gi);
    if (!cells || cells.length < 6) continue; // header / separators have <th> or fewer cells
    // Last cell holds a sortable ISO date like 2026/06/21 — require it to skip non-event rows.
    const iso = text(cells[cells.length - 1]).match(/(\d{4})\/(\d{2})\/(\d{2})/);
    if (!iso) continue;
    const date = `${iso[1]}-${iso[2]}-${iso[3]}`;

    const dateTime = text(cells[0]);
    const titleCell = cells[1];
    const { title, venue, city, genres } = splitTitleCell(text(titleCell));
    const price = text(cells[2]);
    const organizers = text(cells[3]);
    const links = extractLinks(titleCell).concat(extractLinks(cells[4] ?? ''));

    out.push({ date, date_time: dateTime, title, venue, city, genres, price, organizers, links });
  }
  return out;
}

/** "Event Title @ Venue Name (City) genre1, genre2" → parts */
function splitTitleCell(s: string): { title: string; venue: string; city: string; genres: string } {
  let title = s;
  let venue = '';
  let city = '';
  let genres = '';
  const at = s.indexOf(' @ ');
  if (at >= 0) {
    title = s.slice(0, at).trim();
    let rest = s.slice(at + 3).trim();
    const paren = rest.match(/\(([^)]*)\)\s*(.*)$/);
    if (paren) {
      city = paren[1].trim();
      genres = paren[2].trim();
      venue = rest.slice(0, rest.indexOf('(')).trim();
    } else {
      venue = rest;
    }
  }
  return { title, venue, city, genres };
}

function extractLinks(cell: string): { text: string; url: string }[] {
  const links: { text: string; url: string }[] = [];
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(cell))) {
    const url = m[1].trim();
    if (!/^https?:/i.test(url)) continue;
    links.push({ text: stripTags(m[2]).trim() || url, url });
  }
  return links;
}

function text(cell: string): string {
  return stripTags(cell).replace(/\s+/g, ' ').trim();
}
function stripTags(s: string): string {
  return decode(s.replace(/<[^>]+>/g, ' '));
}
function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
function dateArg(v: unknown): string {
  if (typeof v !== 'string') return '';
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}
function numArg(v: unknown, dflt: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : dflt;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
