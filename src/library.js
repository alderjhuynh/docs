import { DurableObject } from "cloudflare:workers";

// Each doc is stored as an opaque JSON string, split into ~500k-char chunks so
// no single SQLite row gets anywhere near the 8 MB row limit. The server never
// parses doc bodies (keeps CPU low); metadata arrives separately from the client.
const CHUNK = 500_000;

export class Library extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS docs (
        id       TEXT PRIMARY KEY,
        title    TEXT NOT NULL DEFAULT '',
        created  INTEGER NOT NULL DEFAULT 0,
        modified INTEGER NOT NULL,
        size     INTEGER NOT NULL DEFAULT 0,
        parts    INTEGER NOT NULL DEFAULT 0,
        deleted  INTEGER NOT NULL DEFAULT 0
      )`);
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        doc_id TEXT    NOT NULL,
        part   INTEGER NOT NULL,
        data   TEXT    NOT NULL,
        PRIMARY KEY (doc_id, part)
      )`);
  }

  async manifest() {
    return this.sql
      .exec("SELECT id, title, created, modified, size, deleted FROM docs ORDER BY modified DESC")
      .toArray();
  }

  async get(id) {
    const meta = this.sql.exec("SELECT * FROM docs WHERE id = ?", id).toArray()[0];
    if (!meta || meta.deleted) return null;
    const rows = this.sql.exec("SELECT data FROM chunks WHERE doc_id = ? ORDER BY part", id).toArray();
    return { meta, body: rows.map((r) => r.data).join("") };
  }

  async put(id, body, { title, created, modified, force }) {
    const cur = this.sql.exec("SELECT modified FROM docs WHERE id = ?", id).toArray()[0];
    if (cur && !force && cur.modified > modified) {
      return { ok: false, error: "cloud_newer", cloudModified: cur.modified };
    }
    const parts = Math.max(1, Math.ceil(body.length / CHUNK));
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM chunks WHERE doc_id = ?", id);
      for (let i = 0; i < parts; i++) {
        this.sql.exec("INSERT INTO chunks (doc_id, part, data) VALUES (?, ?, ?)", id, i, body.slice(i * CHUNK, (i + 1) * CHUNK));
      }
      this.sql.exec(
        `INSERT INTO docs (id, title, created, modified, size, parts, deleted) VALUES (?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET title = excluded.title, created = excluded.created,
           modified = excluded.modified, size = excluded.size, parts = excluded.parts, deleted = 0`,
        id, title, created, modified, body.length, parts,
      );
    });
    return { ok: true, modified, size: body.length, parts };
  }

  // Tombstone, so a doc deleted in the cloud isn't resurrected by the next push.
  async remove(id) {
    const now = Date.now();
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM chunks WHERE doc_id = ?", id);
      this.sql.exec(
        `INSERT INTO docs (id, title, created, modified, size, parts, deleted) VALUES (?, '', 0, ?, 0, 0, 1)
         ON CONFLICT(id) DO UPDATE SET title = '', modified = excluded.modified, size = 0, parts = 0, deleted = 1`,
        id, now,
      );
    });
    return { ok: true, modified: now };
  }
}
