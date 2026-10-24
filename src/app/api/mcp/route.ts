import { NextRequest, NextResponse } from 'next/server';
import { mcpToolService } from '@/lib/services/mcpToolService';

export const dynamic = 'force-dynamic';

function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, mcp-session-id',
  };
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
}

export async function GET(req: NextRequest) {
  const accept = req.headers.get('accept') || '';

  // If client requests Server-Sent Events (SSE) stream
  if (accept.includes('text/event-stream')) {
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 10);
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        const endpointEvent = `event: endpoint\ndata: /api/mcp?sessionId=${sessionId}\n\n`;
        controller.enqueue(encoder.encode(endpointEvent));
      },
    });

    return new NextResponse(stream, {
      headers: {
        ...getCorsHeaders(),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  }

  // Standard JSON status / inspection view
  const tools = mcpToolService.getTools();
  return NextResponse.json(
    {
      status: 'online',
      protocolVersion: '2024-11-05',
      name: 'videotimmer-threads-mcp',
      description: 'Model Context Protocol (MCP) server for Threads and Instagram scheduling and publishing.',
      endpoint: '/api/mcp',
      fullUrl: `${req.nextUrl.origin}/api/mcp`,
      toolsCount: tools.length,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
      antigravityConfig: {
        mcpServers: {
          videotimmer: {
            url: `${req.nextUrl.origin}/api/mcp`,
          },
        },
      },
    },
    {
      headers: getCorsHeaders(),
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error: Invalid JSON was received by the server.' },
          id: null,
        },
        { status: 400, headers: getCorsHeaders() }
      );
    }

    // Process batch or single JSON-RPC 2.0 requests
    if (Array.isArray(body)) {
      const responses = await Promise.all(body.map((item) => handleRpcItem(item)));
      return NextResponse.json(responses, { headers: getCorsHeaders() });
    }

    const response = await handleRpcItem(body);
    // If it was a notification without id, return empty 204 or 200
    if (response === null) {
      return new NextResponse(null, { status: 204, headers: getCorsHeaders() });
    }

    return NextResponse.json(response, { headers: getCorsHeaders() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        jsonrpc: '2.0',
        error: { code: -32603, message: `Internal server error: ${msg}` },
        id: null,
      },
      { status: 500, headers: getCorsHeaders() }
    );
  }
}

async function handleRpcItem(rpc: any): Promise<any | null> {
  const { jsonrpc, id, method, params } = rpc || {};

  // Standard JSON-RPC notification (e.g. notifications/initialized)
  if (method === 'notifications/initialized' || method === 'initialized') {
    return null;
  }

  // Ping check
  if (method === 'ping') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {},
    };
  }

  // Initialize handshake
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: 'videotimmer-threads-mcp',
          version: '1.0.0',
        },
      },
    };
  }

  // List tools
  if (method === 'tools/list') {
    const rawTools = mcpToolService.getTools();
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        tools: rawTools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.parameters,
        })),
      },
    };
  }

  // Call tool
  if (method === 'tools/call') {
    const toolName = params?.name;
    const toolArgs = params?.arguments || {};

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        error: { code: -32602, message: 'Invalid params: "name" is required for tools/call' },
      };
    }

    try {
      const data = await mcpToolService.executeTool(toolName, toolArgs);
      const textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);

      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          content: [
            {
              type: 'text',
              text: textContent,
            },
          ],
          isError: false,
        },
      };
    } catch (toolError: unknown) {
      const errorMsg = toolError instanceof Error ? toolError.message : String(toolError);
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          content: [
            {
              type: 'text',
              text: `Tool Execution Error: ${errorMsg}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  // Unknown method
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: {
      code: -32601,
      message: `Method "${method}" not found or not supported.`,
    },
  };
}
