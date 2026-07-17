import { handler } from "./dist/server.js";
import { createServer } from "http";

const PORT = process.env.PORT || 3000;

const server = createServer(async (req, res) => {
  if (req.url?.startsWith("/mcp")) {
    return handler(req, res);
  }
  res.writeHead(404);
  res.end("Not Found");
});

server.listen(3000, () => {
  console.log(`EVIDIQ Notary MCP server running on port 3000`);
  console.log(`MCP endpoint: http://localhost:3000/mcp`);
});