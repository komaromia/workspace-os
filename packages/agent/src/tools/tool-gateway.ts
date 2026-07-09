import type { ActivityLog, Member, Persona, SecretsBroker } from "@workspace-os/core";

export interface ToolInvocationContext {
  /** Secrets brokered for this call. The tool receives them here; they are
   * never part of the model's input, the returned result, or the audit log. */
  credentials: Record<string, string>;
}

export interface ToolResult {
  output: unknown;
}

export interface Tool {
  name: string;
  /** Policy action authorized per-call; defaults to `tool.<name>`. */
  action?: string;
  /** Secret names to broker from the vault and inject into the call. */
  requiredSecrets?: string[];
  invoke(input: unknown, context: ToolInvocationContext): Promise<ToolResult>;
}

/** The authorization decision point. PolicyEngine.authorize satisfies this
 * shape structurally, so the gateway needn't depend on the governance package. */
export interface ToolAuthorizer {
  authorize(
    member: Member,
    actionName: string,
  ): { outcome: string; reason: string; approversRequired?: number };
}

export interface ToolGatewayDeps {
  tools: Tool[];
  authorizer: ToolAuthorizer;
  secrets: SecretsBroker;
  activity: ActivityLog;
}

export interface ToolInvokeRequest {
  member: Member;
  persona: Persona;
  toolName: string;
  input: unknown;
}

export type ToolInvokeStatus = "invoked" | "requires_approval" | "denied";

export interface ToolInvokeOutcome {
  status: ToolInvokeStatus;
  reason?: string;
  result?: ToolResult;
}

export class ToolCredentialError extends Error {
  constructor(
    public readonly toolName: string,
    public readonly secretName: string,
  ) {
    super(`tool ${toolName} requires secret "${secretName}" which is not available`);
    this.name = "ToolCredentialError";
  }
}

/**
 * The gateway every external tool/MCP call passes through (Epic 9) — where the
 * largest credential-risk surface lives. It enforces the persona's allowed-tool
 * allowlist (deny-by-default), authorizes each call against the policy engine
 * (consequential calls route to approval and never execute), brokers required
 * secrets from the vault per-call — injected into the tool but never exposed to
 * the model, returned to the caller, or written to the audit log — and audits
 * every call. Disallowed calls are audited too.
 */
export class ToolGateway {
  private readonly registry: Map<string, Tool>;

  constructor(private readonly deps: ToolGatewayDeps) {
    this.registry = new Map(deps.tools.map((t) => [t.name, t]));
  }

  async invoke(request: ToolInvokeRequest): Promise<ToolInvokeOutcome> {
    const { member, persona, toolName, input } = request;

    // Deny-by-default: the persona must explicitly allow this tool.
    if (!persona.allowsTool(toolName)) {
      await this.audit(member, "tool.denied", toolName, { reason: "not-in-persona" });
      return { status: "denied", reason: "not-in-persona" };
    }

    const tool = this.registry.get(toolName);
    if (!tool) {
      await this.audit(member, "tool.denied", toolName, { reason: "unknown-tool" });
      return { status: "denied", reason: "unknown-tool" };
    }

    const action = tool.action ?? `tool.${toolName}`;
    const decision = this.deps.authorizer.authorize(member, action);
    if (decision.outcome === "deny") {
      await this.audit(member, "tool.denied", toolName, { action, reason: decision.reason });
      return { status: "denied", reason: decision.reason };
    }
    if (decision.outcome === "requires_approval") {
      // Agents propose consequential actions; they never execute them.
      await this.audit(member, "tool.proposed", toolName, { action, reason: decision.reason });
      return { status: "requires_approval", reason: decision.reason };
    }

    // Broker credentials per-call. Never logged; never returned.
    const credentials: Record<string, string> = {};
    for (const secretName of tool.requiredSecrets ?? []) {
      try {
        credentials[secretName] = await this.deps.secrets.get(secretName);
      } catch {
        throw new ToolCredentialError(toolName, secretName);
      }
    }

    const result = await tool.invoke(input, { credentials });
    // Audit records the action and status only — no credentials, no raw input.
    await this.audit(member, "tool.invoke", toolName, { action, status: "invoked" });
    return { status: "invoked", result };
  }

  private async audit(
    member: Member,
    action: string,
    toolName: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.deps.activity.record({
      actor: member,
      action,
      resourceType: "tool",
      resourceId: toolName,
      metadata,
    });
  }
}
