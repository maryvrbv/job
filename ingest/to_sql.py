"""Turn `hh.py details` / `linkedin.py details` JSON into UPDATE statements for Supabase MCP.

    python3 ingest/hh.py details 138221309 | python3 ingest/to_sql.py

Supabase MCP hangs on statements whose string literals contain a semicolon or a raw line break,
so those go in as chr(59) / chr(10). Statements are printed in batches of ~8000 characters,
one batch per line: run each line as one execute_sql call. Only empty descriptions are filled.
"""
import json
import sys

BATCH = 8000


def literal(line):
    line = line.replace("'", "''").replace("\\", "' || chr(92) || '").replace(";", "' || chr(59) || '")
    return "'" + line + "'"


def statement(job):
    lines = []
    for raw in job["description"].split("\n"):
        line = raw.strip()
        if line or (lines and lines[-1]):
            lines.append(line)
    expr = " || chr(10) || ".join(literal(l) for l in lines)
    return f"update jobs set description = {expr} where id = '{job['id']}' and description = ''"


if __name__ == "__main__":
    jobs = [j for j in json.load(sys.stdin) if j.get("description") and not j.get("error")]
    batch = []
    for st in map(statement, jobs):
        if batch and sum(map(len, batch)) + len(st) > BATCH:
            print("; ".join(batch))
            batch = []
        batch.append(st)
    if batch:
        print("; ".join(batch))
