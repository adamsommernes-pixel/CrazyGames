// Slår sammen supabase/migrations/*.sql til supabase/setup.sql, som limes inn i Supabase → SQL Editor én gang.
//   node scripts/make-setup-sql.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const parts = files.map((f) => `-- ============================================================\n-- ${f}\n-- ============================================================\n\n${readFileSync(`${dir}/${f}`, 'utf8').trim()}\n`);
const header = `-- Repgrade: hele databaseoppsettet i én fil.
-- Lim inn i Supabase → SQL Editor → New query → Run. Trygt å kjøre flere ganger.
-- Generert fra supabase/migrations/ med \`node scripts/make-setup-sql.mjs\`. Ikke rediger for hånd.

`;
writeFileSync('supabase/setup.sql', header + parts.join('\n'));
console.log(`✓ supabase/setup.sql (${files.join(', ')})`);
