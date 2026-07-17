import { createServer } from "http";
import { handler } from "../dist/server.js";

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-cron-secret");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  await handler(req, res);
});

server.listen(3000, () => {
  console.log("EVIDIQ Notary MCP server running on http://localhost:3000");
});