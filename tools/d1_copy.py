"""Copy a Cloudflare D1 database into another one (tables, indexes, rows) through the D1 HTTP API.
Used to move databases to a closer region (D1's region is fixed when a database is created).
Usage: CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... python3 tools/d1_copy.py <from_uuid> <to_uuid> [table,table,...]
Only tables listed (default: all) are copied; Cloudflare's internal tables (_cf_*) and sqlite_* are skipped."""
import json, os, subprocess, sys

TOK, ACC = os.environ['CLOUDFLARE_API_TOKEN'], os.environ['CLOUDFLARE_ACCOUNT_ID']


def q(db, sql, params=None):
    body = {'sql': sql}
    if params is not None: body['params'] = params
    out = subprocess.run(['curl', '-sS', '--max-time', '60', '-X', 'POST', '-H', 'Authorization: Bearer ' + TOK, '-H', 'content-type: application/json',
                          f'https://api.cloudflare.com/client/v4/accounts/{ACC}/d1/database/{db}/query', '-d', json.dumps(body)], capture_output=True, text=True).stdout
    r = json.loads(out)
    if not r.get('success'): raise SystemExit(f'D1 error on {sql[:80]}: {r.get("errors")}')
    return r['result'][0]['results']


def main():
    src, dst = sys.argv[1], sys.argv[2]
    only = set(sys.argv[3].split(',')) if len(sys.argv) > 3 else None
    objs = q(src, "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type DESC")
    tables = [o for o in objs if o['type'] == 'table' and (not only or o['name'] in only)]
    for t in tables:
        q(dst, t['sql'].replace('CREATE TABLE ', 'CREATE TABLE IF NOT EXISTS ', 1))
    for o in objs:
        if o['type'] == 'index' and (not only or o['tbl_name'] in only):
            q(dst, o['sql'].replace('CREATE INDEX ', 'CREATE INDEX IF NOT EXISTS ', 1).replace('CREATE UNIQUE INDEX ', 'CREATE UNIQUE INDEX IF NOT EXISTS ', 1))
    for t in tables:
        name = t['name']; rows = q(src, f'SELECT * FROM "{name}"')
        for r in rows:
            cols = list(r.keys())
            q(dst, f'INSERT OR REPLACE INTO "{name}" ({", ".join(chr(34) + c + chr(34) for c in cols)}) VALUES ({", ".join("?" for _ in cols)})', [r[c] for c in cols])
        n_dst = q(dst, f'SELECT COUNT(*) AS n FROM "{name}"')[0]['n']
        print(f'{name:12} {len(rows):5} copied -> {n_dst} in target')


if __name__ == '__main__':
    main()
