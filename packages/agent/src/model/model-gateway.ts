import type { ModelCompletionResult, ModelMessage, ModelProvider } from "@workspace-os/core";

export interface RegisteredProvider {
  provider: ModelProvider;
  /** True if calls to this provider leave the box/tenant. Refused under
   * no-egress mode (Epic 8's genuine "no external providers" guarantee). */
  external: boolean;
}

export interface ModelRoute {
  providerName: string;
  model: string;
}

export interface ModelGatewayConfig {
  providers: Record<string, RegisteredProvider>;
  /** Task name → which provider/model handles it. Unrouted tasks are denied. */
  routing: Record<string, ModelRoute>;
  noEgress?: boolean;
  /** Optional cap on total tokens a single member may spend. */
  quotaTokensPerMember?: number;
}

export interface GatewayCompletionRequest {
  memberId: string;
  task: string;
  messages: ModelMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface MemberUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export class UnknownTaskError extends Error {
  constructor(public readonly task: string) {
    super(`no route configured for task: ${task}`);
    this.name = "UnknownTaskError";
  }
}

export class NoEgressViolationError extends Error {
  constructor(public readonly providerName: string) {
    super(`no-egress mode refuses external provider: ${providerName}`);
    this.name = "NoEgressViolationError";
  }
}

export class QuotaExceededError extends Error {
  constructor(public readonly memberId: string) {
    super(`token quota exceeded for member: ${memberId}`);
    this.name = "QuotaExceededError";
  }
}

/**
 * The single abstraction over all LLM access (Epic 8). Task-based routing
 * (cheap model for triage, strong model for coding), per-member token metering
 * feeding the quota system, and a no-egress mode that provably blocks any
 * external provider. Swapping local vs cloud models is a config change here,
 * not a code change anywhere else.
 */
export class ModelGateway {
  private readonly usage = new Map<string, MemberUsage>();

  constructor(private readonly config: ModelGatewayConfig) {}

  async complete(request: GatewayCompletionRequest): Promise<ModelCompletionResult> {
    const route = this.config.routing[request.task];
    if (!route) {
      throw new UnknownTaskError(request.task);
    }
    const registered = this.config.providers[route.providerName];
    if (!registered) {
      throw new Error(`route "${request.task}" points at unknown provider "${route.providerName}"`);
    }
    if (this.config.noEgress && registered.external) {
      throw new NoEgressViolationError(route.providerName);
    }
    if (
      this.config.quotaTokensPerMember !== undefined &&
      this.usageFor(request.memberId).totalTokens >= this.config.quotaTokensPerMember
    ) {
      throw new QuotaExceededError(request.memberId);
    }

    const result = await registered.provider.complete({
      model: route.model,
      messages: request.messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
    });

    this.meter(request.memberId, result);
    return result;
  }

  usageFor(memberId: string): MemberUsage {
    return this.usage.get(memberId) ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }

  private meter(memberId: string, result: ModelCompletionResult): void {
    const current = this.usageFor(memberId);
    const promptTokens = current.promptTokens + result.usage.promptTokens;
    const completionTokens = current.completionTokens + result.usage.completionTokens;
    this.usage.set(memberId, {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    });
  }
}
