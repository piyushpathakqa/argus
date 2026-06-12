import Anthropic from '@anthropic-ai/sdk';

/** The narrow slice of the Anthropic SDK the agent loop depends on. */
export interface AnthropicLike {
  messages: {
    create(body: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

/** Real client. Reads ANTHROPIC_API_KEY from the environment. */
export function createAnthropicClient(): AnthropicLike {
  return new Anthropic();
}
