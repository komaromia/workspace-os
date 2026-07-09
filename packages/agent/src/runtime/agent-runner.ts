import type { ActivityLog, Member, Persona, WorkItem } from "@workspace-os/core";
import type { ModelGateway } from "../model/model-gateway.js";

/** The board operations the runner needs: claim the next eligible item and
 * persist lifecycle transitions. Kept minimal so the concrete Postgres
 * repository (or an in-memory fake) can satisfy it. */
export interface AgentTaskBoard {
  claimNext(agent: Member): Promise<WorkItem | null>;
  save(item: WorkItem): Promise<void>;
}

export interface AgentRunnerDeps {
  agent: Member;
  persona: Persona;
  board: AgentTaskBoard;
  gateway: ModelGateway;
  activity: ActivityLog;
  /** The gateway routing task used for the reasoning step. */
  task?: string;
}

export type AgentRunStatus = "idle" | "completed";

export interface AgentRunResult {
  status: AgentRunStatus;
  workItemId?: string;
  output?: string;
}

/**
 * One turn of the owned agent loop (Epic 7): perceive → reason → act → report.
 * The agent claims a work item, reasons about it through the model gateway
 * under its persona, produces output, and reports completion — every step
 * attributed to the agent via the activity log. Deterministic given a
 * deterministic model provider, which is what makes it testable offline.
 *
 * Durable checkpointing / crash-safe replay (DBOS workflows, "wait for
 * approval" as a first-class step) is the next layer on top of this loop and
 * is deliberately not built in here yet.
 */
export class AgentRunner {
  constructor(private readonly deps: AgentRunnerDeps) {}

  async runOnce(): Promise<AgentRunResult> {
    // Perceive: claim the next eligible item from the board.
    const claimed = await this.deps.board.claimNext(this.deps.agent);
    if (!claimed) {
      return { status: "idle" };
    }
    await this.report("work.claim", claimed);

    // Reason: run the persona's system prompt + the task through the gateway.
    const completion = await this.deps.gateway.complete({
      memberId: this.deps.agent.id,
      task: this.deps.task ?? "reasoning",
      messages: [
        { role: "system", content: this.deps.persona.systemPrompt },
        { role: "user", content: describeTask(claimed) },
      ],
    });

    // Act + report: drive the item to done and record the outcome.
    const done = claimed.start().complete();
    await this.deps.board.save(done);
    await this.report("work.complete", done, { outputPreview: preview(completion.content) });

    return { status: "completed", workItemId: done.id, output: completion.content };
  }

  private async report(
    action: string,
    item: WorkItem,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.deps.activity.record({
      actor: this.deps.agent,
      action,
      resourceType: "work_item",
      resourceId: item.id,
      metadata,
    });
  }
}

function describeTask(item: WorkItem): string {
  return item.description ? `${item.title}\n\n${item.description}` : item.title;
}

function preview(text: string): string {
  return text.length > 500 ? `${text.slice(0, 500)}…` : text;
}
