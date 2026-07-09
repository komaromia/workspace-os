import { randomUUID } from "node:crypto";
import {
  EmailAlreadyRegisteredError,
  Member,
  type HumanCredentialRepository,
  type MemberRepository,
} from "@workspace-os/core";
import { hashPassword, verifyPassword } from "./password.js";

export interface SignupInput {
  email: string;
  password: string;
  displayName: string;
}

export interface SignupServiceDeps {
  members: MemberRepository;
  credentials: HumanCredentialRepository;
}

/**
 * Local email/password signup for human members (simple profile). Agents do
 * not use this path — they authenticate with short-lived scoped tokens
 * (AgentCredentialService). A new signup becomes a human Member plus a hashed
 * credential; the member's identityRef is `local|<email>`.
 */
export class SignupService {
  constructor(private readonly deps: SignupServiceDeps) {}

  async signup(input: SignupInput): Promise<Member> {
    const email = normalizeEmail(input.email);
    if (await this.deps.credentials.findByEmail(email)) {
      throw new EmailAlreadyRegisteredError(email);
    }

    const member = Member.create({
      id: `m_${randomUUID()}`,
      type: "human",
      identityRef: `local|${email}`,
      displayName: input.displayName,
      roles: [],
    });

    await this.deps.members.save(member);
    // The unique email index is the real guard against a race between the
    // pre-check above and here; it surfaces as EmailAlreadyRegisteredError.
    await this.deps.credentials.save({
      memberId: member.id,
      email,
      passwordHash: await hashPassword(input.password),
    });
    return member;
  }

  async authenticate(email: string, password: string): Promise<Member | null> {
    const record = await this.deps.credentials.findByEmail(normalizeEmail(email));
    if (!record) return null;
    if (!(await verifyPassword(password, record.passwordHash))) return null;
    return this.deps.members.findById(record.memberId);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
