"""Turn the JSON line printed by portfolio_stats.py into one upsert for Supabase MCP.

    python3 ingest/stats_to_sql.py < snapshot.json

Same escaping as to_sql.py: no raw semicolons or line breaks inside the literal.
"""
import json
import sys

snap = json.loads(sys.stdin.read())
text = json.dumps(snap, ensure_ascii=False, separators=(",", ":")).replace("'", "''").replace(";", "' || chr(59) || '")
print("insert into portfolio_stats (id, data, updated_at) values ('snapshot', ('" + text + "')::jsonb, now()) "
      "on conflict (id) do update set data = excluded.data, updated_at = now() returning id, updated_at")
