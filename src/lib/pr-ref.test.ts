import { describe, expect, it } from "vitest";
import { parsePullRequestRef, prKey } from "./pr-ref";

describe("parsePullRequestRef", () => {
  it.each([
    ["https://github.com/acme/app/pull/12", { owner: "acme", repo: "app", number: 12 }],
    ["https://github.com/acme/app/pull/12/files", { owner: "acme", repo: "app", number: 12 }],
    ["acme/app#12", { owner: "acme", repo: "app", number: 12 }],
    ["  acme/my.repo#3 ", { owner: "acme", repo: "my.repo", number: 3 }],
  ])("parses %s", (text, ref) => {
    expect(parsePullRequestRef(text)).toEqual(ref);
  });

  it("rejects anything else", () => {
    expect(parsePullRequestRef("12")).toBeNull();
    expect(parsePullRequestRef("../../x#1")).toBeNull();
  });

  it("builds a stable key", () => {
    expect(prKey({ owner: "acme", repo: "app", number: 1 })).toBe("acme/app#1");
  });
});
