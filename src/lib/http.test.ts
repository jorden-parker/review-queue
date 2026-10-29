import { describe, expect, it } from "vitest";
import { z } from "zod";
import { parseJsonBody, readJson, searchParam } from "./http";

const EventSchema = z.object({ event: z.enum(["COMMENT", "APPROVE"]) });

function post(body: string) {
  return new Request("http://test/api", { method: "POST", body });
}

describe("readJson", () => {
  it("returns null for a body that is not JSON", async () => {
    expect(await readJson(post("{nope"))).toBeNull();
  });
});

describe("parseJsonBody", () => {
  it("answers 400 for a body that is not JSON", async () => {
    const result = await parseJsonBody(post("{nope"), EventSchema);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it("answers 400 for a body that fails the schema", async () => {
    const result = await parseJsonBody(post('{"event":"NOPE"}'), EventSchema);
    expect((result as Response).status).toBe(400);
  });

  it("returns the parsed body when it fits the schema", async () => {
    expect(await parseJsonBody(post('{"event":"COMMENT"}'), EventSchema)).toEqual({
      event: "COMMENT",
    });
  });
});

describe("searchParam", () => {
  it("returns the named query value or an empty string", () => {
    const request = new Request("http://test/api?sha=abc&path=");
    expect(searchParam(request, "sha")).toBe("abc");
    expect(searchParam(request, "path")).toBe("");
    expect(searchParam(request, "missing")).toBe("");
  });
});
