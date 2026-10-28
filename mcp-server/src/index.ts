import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { allTools, executeTool } from './tools';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Sırlar mcp-server/.env'den okunur (git'e girmez). Yol çalışma dizininden değil
// dosya konumundan çözülür: sunucu proje kökünden ya da Claude Desktop'tan başlatılabilir.
// Gerçek ortam değişkeni .env'den önceliklidir. quiet: STDIO kanalına log karışmasın.
dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });

// MCP Server Tanımı
const server = new Server(
  {
    name: 'dentorchestra-mcp-server',
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
    'Dentorchestra Modüler MCP Server başarıyla STDIO üzerinde çalışıyor...'
  );
}

run();
