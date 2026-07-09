import type { Member } from "../domain/member.js";

export interface MemberRepository {
  /** Insert or update a member by id. */
  save(member: Member): Promise<void>;
  findById(id: string): Promise<Member | null>;
  findByIdentityRef(identityRef: string): Promise<Member | null>;
}
