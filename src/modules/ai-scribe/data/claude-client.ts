import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { InfraError } from '@/core/errors/app-error';

/**
 * The one place `@anthropic-ai/sdk` is imported (ADR 0020 SS1). Server-side
 * only -- this file has no 'use client' path to it, and nothing under
 * src/app or any module's components folder ever imports it directly.
 *
 * USD-per-million-token pricing, hardcoded per model rather than fetched --
 * Anthropic's pricing API is not a thing; this is the same "concrete number,
 * flagged for correction if it drifts" treatment as the budget cap itself.
 * A rough, fixed USD->IDR rate converts to the Rupiah bigint every cost
 * column in this codebase requires (CLAUDE.md law 0.1) -- exchange-rate
 * accuracy is not the point, staying roughly in budget is.
 */
const USD_TO_IDR_RATE = 16_000;

const PRICING_PER_MILLION_TOKENS_USD: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
};

function estimateCostRupiah(model: string, inputTokens: number, outputTokens: number): bigint {
  const pricing = PRICING_PER_MILLION_TOKENS_USD[model];
  if (pricing === undefined) {
    throw new InfraError(`No pricing entry for Claude model "${model}" -- add one to claude-client.ts`, {
      meta: { model },
    });
  }

  const usd = (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  return BigInt(Math.ceil(usd * USD_TO_IDR_RATE));
}

let client: Anthropic | undefined;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey === undefined || apiKey === '') {
    throw new InfraError('ANTHROPIC_API_KEY is not set', { meta: {} });
  }
  client ??= new Anthropic({ apiKey });
  return client;
}

export type ClaudeCompletion = {
  readonly text: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costAmount: bigint;
};

export async function completeWithClaude(input: {
  model: string;
  maxTokens: number;
  system: string;
  prompt: string;
}): Promise<ClaudeCompletion> {
  const message = await getClient().messages.create({
    model: input.model,
    max_tokens: input.maxTokens,
    system: input.system,
    messages: [{ role: 'user', content: input.prompt }],
  });

  const text = message.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return {
    text,
    model: input.model,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
    costAmount: estimateCostRupiah(input.model, message.usage.input_tokens, message.usage.output_tokens),
  };
}
