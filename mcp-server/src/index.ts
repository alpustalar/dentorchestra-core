import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { allTools, executeTool } from './tools';

// MCP Server Tanımı
const server = new Server(
  {
    name: 'mederp-mcp-server',
    version: '1.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool Tanımlarını Listele (Modüler havuz)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allTools.map(({ handler, ...toolSchema }) => toolSchema),
  };
});

// Gelen Tool Çağrılarını Yönet
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const resultText = await executeTool(name, args);
    return {
      content: [
        {
          type: 'text',
          text:
            typeof resultText === 'string'
              ? resultText
              : JSON.stringify(resultText, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Tool çalıştırılırken hata oluştu: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// run (STDIO üzerinden iletişim)
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    'MedErp Modüler MCP Server başarıyla STDIO üzerinde çalışıyor...'
  );
}

run();
