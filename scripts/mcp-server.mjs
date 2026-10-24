#!/usr/bin/env node

/**
 * Standalone Stdio MCP Server for VideoTimmer
 * Enables local stdio Model Context Protocol communication with Antigravity
 * Protocol Version: 2024-11-05
 */

import readline from 'readline';

const MCP_ENDPOINT = process.env.VIDEOTIMMER_MCP_URL || 'http://localhost:3000/api/mcp';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', async (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  try {
    const rpc = JSON.parse(trimmed);

    // Forward to local Next.js API endpoint
    const response = await fetch(MCP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rpc),
    });

    if (response.status === 204) {
      // Notification, no output
      return;
    }

    const json = await response.json();
    process.stdout.write(JSON.stringify(json) + '\n');
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: `VideoTimmer MCP Bridge Error: ${errorMsg}` },
        id: null,
      }) + '\n'
    );
  }
});
