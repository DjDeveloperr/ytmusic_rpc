import { Client } from "https://deno.land/x/discord_rpc@0.3.2/mod.ts";

const client = new Client({
  id: Deno.env.get("CLIENT_ID") ?? "1087446802099339265",
});

await client.connect();
console.log(`Connected! User: ${client.userTag}`);

const DEFAULT_OPTIONS = {
  headers: {
    "Access-Control-Allow-Origin": "*",
  },
};

let timer: number | undefined;

async function handleHttp(conn: Deno.Conn) {
  for await (const e of Deno.serveHttp(conn)) {
    try {
      const url = new URL(e.request.url);
      if (url.pathname === "/activity" && e.request.method === "POST") {
        const body = await e.request.json();
        const payload = await client.setActivity(body);
        e.respondWith(Response.json(payload, DEFAULT_OPTIONS));
        if (timer) {
          clearTimeout(timer);
        }
        timer = setTimeout(
          () => {
            timer = undefined;
            client.clearActivity();
          },
          body.timestamps?.end
            ? Math.max(0, body.timestamps?.end - Date.now())
            : 5 * 60 * 1000,
        );
      } else if (
        url.pathname === "/activity" && e.request.method === "DELETE"
      ) {
        if (timer) {
          clearTimeout(timer);
          timer = undefined;
        }
        await client.clearActivity();
        e.respondWith(
          new Response(null, DEFAULT_OPTIONS),
        );
      } else if (
        url.pathname === "/activity" && e.request.method === "OPTIONS"
      ) {
        e.respondWith(
          new Response(null, {
            ...DEFAULT_OPTIONS,
            headers: {
              ...DEFAULT_OPTIONS.headers,
              "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type",
            },
          }),
        );
      } else {
        e.respondWith(
          new Response("Not Found", {
            status: 404,
            ...DEFAULT_OPTIONS,
          }),
        );
      }
    } catch (error) {
      console.log("Error:", error.message);
      e.respondWith(
        new Response(error.message, {
          status: 500,
          ...DEFAULT_OPTIONS,
        }),
      );
    }
  }
}

const port = parseInt(Deno.env.get("PORT") || "6587");
const server = Deno.listen({ port });

console.log(`Listening on port ${port}`);

for await (const conn of server) {
  handleHttp(conn);
}
