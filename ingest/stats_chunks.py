"""Split the portfolio snapshot printed by portfolio_stats.py into small SQL statements (fallback path only).

    python3 ingest/stats_chunks.py snapshot.json OUT_DIR

A single 60 KB execute_sql is held back by Supabase with a question that never reaches Masha, so the snapshot
goes in parts: the small keys merged with ||, each period with jsonb_set, the tags, history entries and guests
set first and then appended. Statements are grouped into files OUT_DIR/w_0.sql, w_1.sql, ... of about 7 KB;
each file is one query. Every statement has where id = 'snapshot'. Literals keep no raw ; or line
breaks (json.dumps escapes line breaks; a ; inside a value is written as chr(59)).
"""
import json
import os
import sys

src, out_dir = sys.argv[1], sys.argv[2]
d = json.load(open(src))
LIM = 6500
W = " where id = 'snapshot'"


def lit(o):
    s = json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("'", "''").replace(";", "' || chr(59) || '")
    return "('" + s + "')"


st = []
small = {k: d[k] for k in ["totals", "daily", "countries", "devices", "reading"] if k in d}
st.append("update portfolio_stats set updated_at=now(), data = data || " + lit(small) + "::jsonb" + W)
for p, v in d.get("periods", {}).items():
    st.append(f"update portfolio_stats set data = jsonb_set(data, '{{periods,{p}}}', {lit(v)}::jsonb)" + W)


def array_parts(path, items, append_all=False):
    """set the array with the first part, then append the rest (or append every part, when it was emptied before)"""
    out, cur, first = [], [], not append_all

    def flush():
        nonlocal cur, first
        if first:
            out.append(f"update portfolio_stats set data = jsonb_set(data, '{{{path}}}', {lit(cur)}::jsonb)" + W)
        else:
            out.append(f"update portfolio_stats set data = jsonb_set(data, '{{{path}}}', (data #> '{{{path}}}') || {lit(cur)}::jsonb)" + W)
        cur, first = [], False

    for x in items:
        if cur and len(lit(cur + [x])) > LIM:
            flush()
        cur.append(x)
    flush()
    return out


st += array_parts("tags", d.get("tags", []))
h = d.get("history", {"entries": []})
st.append("update portfolio_stats set data = jsonb_set(data, '{history}', " + lit({k: v for k, v in h.items() if k != "entries"} | {"entries": []}) + "::jsonb)" + W)
st += array_parts("history,entries", h.get("entries", []), append_all=True)

cur, first = {}, True


def guests_flush():
    global cur, first
    if first:
        st.append("update portfolio_stats set data = jsonb_set(data, '{guests}', " + lit(cur) + "::jsonb)" + W)
    else:
        st.append("update portfolio_stats set data = jsonb_set(data, '{guests}', (data->'guests') || " + lit(cur) + "::jsonb)" + W)
    cur, first = {}, False


for k, v in d.get("guests", {}).items():
    if cur and len(lit(cur | {k: v})) > LIM:
        guests_flush()
    cur[k] = v
guests_flush()

os.makedirs(out_dir, exist_ok=True)
for f in os.listdir(out_dir):
    if f.startswith("w_") and f.endswith(".sql"):
        os.remove(os.path.join(out_dir, f))
chunks, c = [], []
for s in st:
    if c and sum(map(len, c)) + len(s) > 7300:
        chunks.append(c)
        c = []
    c.append(s)
chunks.append(c)
for i, c in enumerate(chunks):
    open(os.path.join(out_dir, f"w_{i}.sql"), "w").write("; ".join(c))
    print(f"{out_dir}/w_{i}.sql", sum(map(len, c)), "chars,", len(c), "statements")
