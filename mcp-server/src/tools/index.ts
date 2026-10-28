import { linearTools } from './linear.tools.js';
import { prismaTools } from './prisma.tools.js';

export const allTools = [...linearTools, ...prismaTools];

export async function executeTool(name: string, args: any) {
  const tool = allTools.find((t) => t.name === name);
  if (!tool) {
    throw new Error(`Bilinmeyen tool: ${name}`);
  }
  return await tool.handler(args);
}
