import { DiscoveryService } from '@nestjs/core';
import { AiToolRegistry } from './ai-tool.registry';
import { AiToolExecutor } from './ai-tool-executor.service';
import { IAiSubToolHandler } from '@common/ai-tools';
import {
  AiToolContext,
  AiToolDefinition,
  AiToolResult,
} from '@common/ai-tools';
import { QuoteOptionRejectedException } from '@modules/crm/health-tourism/shared/domain/quote-option/quote-option-rejected.exception';

/**
 * Command+Strategy çekirdeği: registry adları toplar/çakışmayı reddeder; dispatcher
 * bilinmeyen aracı ve araç hatasını tek yerde sarmalar, tanımları aktarır. (Bootstrap'ta
 * araçlar DiscoveryService ile keşfedilir; testlerde registerAll ile doğrudan beslenir.)
 */
describe('AiTool dispatch (registry + executor)', () => {
  const ctx = {} as AiToolContext;

  const tool = (
    name: string,
    exec: () => Promise<AiToolResult>
  ): IAiSubToolHandler => ({
    name,
    definition: {
      name,
      description: `${name} aracı`,
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    } satisfies AiToolDefinition,
    execute: exec,
  });

  const buildRegistry = (tools: IAiSubToolHandler[]): AiToolRegistry => {
    const registry = new AiToolRegistry({} as DiscoveryService);
    registry.registerAll(tools);
    return registry;
  };

  it('registry aynı adlı iki aracı reddeder (bootstrap hatası)', () => {
    const registry = new AiToolRegistry({} as DiscoveryService);
    expect(() =>
      registry.registerAll([
        tool('dup', async () => ({ content: 'a' })),
        tool('dup', async () => ({ content: 'b' })),
      ])
    ).toThrow(/Yinelenen/);
  });

  it('getToolDefinitions kayıtlı tüm araçların tanımını döner', () => {
    const registry = buildRegistry([
      tool('x', async () => ({ content: 'x' })),
      tool('y', async () => ({ content: 'y' })),
    ]);
    const executor = new AiToolExecutor(registry);
    expect(executor.getToolDefinitions().map((d) => d.name)).toEqual([
      'x',
      'y',
    ]);
  });

  it('bilinmeyen araç → "Bilinmeyen araç" mesajı', async () => {
    const executor = new AiToolExecutor(buildRegistry([]));
    const res = await executor.execute({ name: 'yok', input: {} }, ctx);
    expect(res.content).toContain('Bilinmeyen araç');
  });

  it('aracı çözer ve çalıştırır (mutlu yol)', async () => {
    const registry = buildRegistry([
      tool('ping', async () => ({ content: 'pong' })),
    ]);
    const executor = new AiToolExecutor(registry);
    const res = await executor.execute({ name: 'ping', input: {} }, ctx);
    expect(res.content).toBe('pong');
  });

  /**
   * Araç sonucu hastaya gider. Teknik hatanın metni (bağlantı dizgesi, tablo adı,
   * sağlayıcı yanıtı) o kanala kopyalanmamalı; akış da bozulmamalı.
   */
  it('araç teknik hata fırlatırsa akış bozulmaz ama hata METNİ hastaya gitmez', async () => {
    const registry = buildRegistry([
      tool('boom', async () => {
        throw new Error('relation "invoices" does not exist');
      }),
    ]);
    const executor = new AiToolExecutor(registry);
    const res = await executor.execute({ name: 'boom', input: {} }, ctx);
    expect(res.content).toContain('gerçekleştirilemedi');
    expect(res.content).not.toContain('invoices');
    expect(res.content).toContain('Teknik bir sorun');
  });

  it('domain hatasının mesajı hastaya AKTARILIR (kullanıcı için yazılmıştır)', async () => {
    const registry = buildRegistry([
      tool('reject', async () => {
        throw new QuoteOptionRejectedException('HOTEL', 'CLINIC_MISMATCH');
      }),
    ]);
    const executor = new AiToolExecutor(registry);
    const res = await executor.execute({ name: 'reject', input: {} }, ctx);
    expect(res.content).toContain('tekrar arama');
  });
});
