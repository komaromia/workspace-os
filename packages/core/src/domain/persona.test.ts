import { describe, expect, it } from "vitest";
import { InvalidPersonaError, Persona } from "./persona.js";

describe("Persona", () => {
  const base = {
    personaId: "persona_analyst",
    name: "Data Analyst",
    role: "data-analyst",
    systemPrompt: "You analyze data and produce reports.",
    allowedTools: ["duckdb.query", "artifact.write"],
    model: { modelId: "claude-sonnet-5", temperature: 0.2, maxTokens: 4096 },
  };

  it("constructs a persona at version 1 with all fields", () => {
    const persona = Persona.create(base);

    expect(persona.personaId).toBe("persona_analyst");
    expect(persona.name).toBe("Data Analyst");
    expect(persona.role).toBe("data-analyst");
    expect(persona.systemPrompt).toBe("You analyze data and produce reports.");
    expect(persona.allowedTools.sort()).toEqual(["artifact.write", "duckdb.query"]);
    expect(persona.model).toEqual({
      modelId: "claude-sonnet-5",
      temperature: 0.2,
      maxTokens: 4096,
    });
    expect(persona.version).toBe(1);
  });

  it("checks whether a tool is allowed", () => {
    const persona = Persona.create(base);

    expect(persona.allowsTool("duckdb.query")).toBe(true);
    expect(persona.allowsTool("git.push")).toBe(false);
  });

  it("exposes allowedTools as an immutable copy", () => {
    const persona = Persona.create(base);
    persona.allowedTools.push("git.push");

    expect(persona.allowsTool("git.push")).toBe(false);
  });

  it("revising bumps the version and applies the change while preserving the rest", () => {
    const v1 = Persona.create(base);

    const v2 = v1.revise({ systemPrompt: "Updated instructions." });

    expect(v2).not.toBe(v1);
    expect(v2.version).toBe(2);
    expect(v2.systemPrompt).toBe("Updated instructions.");
    expect(v2.personaId).toBe(v1.personaId);
    expect(v2.role).toBe(v1.role);
    expect(v2.allowedTools.sort()).toEqual(v1.allowedTools.sort());
    // The prior version is untouched — versions are immutable.
    expect(v1.version).toBe(1);
    expect(v1.systemPrompt).toBe("You analyze data and produce reports.");
  });

  it("revising can change tools and model config together", () => {
    const v2 = Persona.create(base).revise({
      allowedTools: ["git.branch", "git.commit"],
      model: { modelId: "claude-opus-4-8" },
    });

    expect(v2.version).toBe(2);
    expect(v2.allowsTool("git.branch")).toBe(true);
    expect(v2.allowsTool("duckdb.query")).toBe(false);
    expect(v2.model.modelId).toBe("claude-opus-4-8");
  });

  it("bumps the version on each successive revision", () => {
    const v3 = Persona.create(base)
      .revise({ name: "Senior Data Analyst" })
      .revise({ role: "senior-data-analyst" });

    expect(v3.version).toBe(3);
    expect(v3.name).toBe("Senior Data Analyst");
    expect(v3.role).toBe("senior-data-analyst");
  });

  it("de-duplicates allowedTools", () => {
    const persona = Persona.create({ ...base, allowedTools: ["a", "a", "b"] });

    expect(persona.allowedTools.sort()).toEqual(["a", "b"]);
  });

  it("allows a persona with no tools", () => {
    const persona = Persona.create({ ...base, allowedTools: [] });

    expect(persona.allowedTools).toEqual([]);
  });

  it("rejects blank name, role, systemPrompt, or personaId", () => {
    expect(() => Persona.create({ ...base, name: "" })).toThrow(InvalidPersonaError);
    expect(() => Persona.create({ ...base, role: " " })).toThrow(InvalidPersonaError);
    expect(() => Persona.create({ ...base, systemPrompt: "" })).toThrow(InvalidPersonaError);
    expect(() => Persona.create({ ...base, personaId: "" })).toThrow(InvalidPersonaError);
  });

  it("rejects an invalid model config", () => {
    expect(() => Persona.create({ ...base, model: { modelId: "" } })).toThrow(InvalidPersonaError);
    expect(() => Persona.create({ ...base, model: { modelId: "m", temperature: -1 } })).toThrow(
      InvalidPersonaError,
    );
    expect(() => Persona.create({ ...base, model: { modelId: "m", maxTokens: 0 } })).toThrow(
      InvalidPersonaError,
    );
  });

  it("rejects a version below 1 when rehydrating", () => {
    expect(() => Persona.create({ ...base, version: 0 })).toThrow(InvalidPersonaError);
  });

  it("round-trips through toJSON/create preserving the version", () => {
    const v2 = Persona.create(base).revise({ name: "Renamed" });
    const rebuilt = Persona.create(v2.toJSON());

    expect(rebuilt.version).toBe(2);
    expect(rebuilt.name).toBe("Renamed");
    expect(rebuilt.personaId).toBe(v2.personaId);
  });
});
