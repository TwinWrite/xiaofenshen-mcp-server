#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createDefaultDeps } from "./deps.js";
import { createXiaofenshenMcpServer } from "./server.js";

async function main() {
  const server = createXiaofenshenMcpServer(createDefaultDeps());
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
