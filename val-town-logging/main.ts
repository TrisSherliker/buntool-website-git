  import sqlite from "https://esm.town/v/std/sqlite@14-main/main.ts";

  const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  export default async function (req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method === "GET") {
      const auth = req.headers.get("Authorization");
      if (auth) {
        const [, encoded] = auth.split(" ");
        const [user, pass] = atob(encoded).split(":");
        if (
          user === Deno.env.get("BASIC_AUTH_USER") &&
          pass === Deno.env.get("BASIC_AUTH_PASS")
        ) {
          const result = await sqlite.execute(
            "SELECT * FROM bundle_log ORDER BY id",
          );
          return Response.json({ columns: result.columns, rows: result.rows }, {
            headers: CORS,
          });
        }
      }
      return new Response("Unauthorized", {
        status: 401,
        headers: { ...CORS, "WWW-Authenticate": 'Basic realm="buntool-logs"' },
      });
    }
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }

    await sqlite.execute(`
      CREATE TABLE IF NOT EXISTS bundle_log (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid         TEXT NOT NULL,
        ts_started   TEXT NOT NULL,
        ts_completed TEXT,
        did_complete INTEGER DEFAULT 0,
        duration_ms  INTEGER,
        file_count   INTEGER,
        page_count   INTEGER,
        ts_errored   TEXT,
        error_type   TEXT,
        error_message TEXT
      )
    `);

    for (const col of [
      "ADD COLUMN ts_errored TEXT",
      "ADD COLUMN error_type TEXT",
      "ADD COLUMN error_message TEXT",
    ]) {
      try { await sqlite.execute(`ALTER TABLE bundle_log ${col}`); } catch {}
    }

    const body = await req.json();

    if (body.event === "start") {
      await sqlite.execute({
        sql:
          `INSERT INTO bundle_log (uuid, ts_started, file_count) VALUES (?, datetime('now'), ?)`,
        args: [body.uuid, body.file_count ?? null],
      });
    } else if (body.event === "complete") {
      await sqlite.execute({
        sql: `UPDATE bundle_log
              SET ts_completed = datetime('now'), did_complete = 1, duration_ms = ?, page_count = ?
              WHERE uuid = ?`,
        args: [body.duration_ms ?? null, body.page_count ?? null, body.uuid],
      });
    } else if (body.event === "error") {
      await sqlite.execute({
        sql: `UPDATE bundle_log
              SET ts_errored = datetime('now'), duration_ms = ?, error_type = ?, error_message = ?
              WHERE uuid = ?`,
        args: [body.duration_ms ?? null, body.error_type ?? null, body.error_message ?? null, body.uuid],
      });
    } else if (body.event === "abandoned") {
      await sqlite.execute({
        sql: `UPDATE bundle_log
              SET ts_errored = datetime('now'), duration_ms = ?, error_type = ?
              WHERE uuid = ?`,
        args: [body.duration_ms ?? null, body.error_type ?? null, body.uuid],
      });
    } else {
      return new Response("Unknown event", { status: 400, headers: CORS });
    }

    return Response.json({ ok: true }, { headers: CORS });
  }