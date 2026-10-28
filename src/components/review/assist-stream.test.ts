import { describe, expect, it } from "vitest";
import {
  ASSIST_ERROR_MARKER,
  ASSIST_LOOKUP_MARKER,
  type AssistLookup,
} from "@/lib/assist-protocol";
import { parseAssistStream } from "./assist-stream";

const LOOKUP: AssistLookup = {
  tool: "find_references",
  label: "Callers and uses of `loadReview` (2)",
  paths: ["src/app.ts"],
};

const lookupRecord = (lookup: AssistLookup) =>
  `${ASSIST_LOOKUP_MARKER}${JSON.stringify(lookup)}${ASSIST_LOOKUP_MARKER}`;

describe("parseAssistStream", () => {
  it("returns plain text when there are no lookups", () => {
    expect(parseAssistStream("It loads.")).toEqual({
      text: "It loads.",
      lookups: [],
      failure: null,
    });
  });

  it("takes a lookup that comes before the text", () => {
    expect(parseAssistStream(`${lookupRecord(LOOKUP)}Only one caller.`)).toEqual({
      text: "Only one caller.",
      lookups: [LOOKUP],
      failure: null,
    });
  });

  it("takes a lookup between two pieces of text", () => {
    expect(parseAssistStream(`Checking ${lookupRecord(LOOKUP)}then answering.`)).toEqual({
      text: "Checking then answering.",
      lookups: [LOOKUP],
      failure: null,
    });
  });

  it("drops a lookup that has not finished arriving", () => {
    expect(parseAssistStream(`Answer ${ASSIST_LOOKUP_MARKER}{"tool":"find`)).toEqual({
      text: "Answer ",
      lookups: [],
      failure: null,
    });
  });

  it("keeps the text and the failure apart when the stream fails", () => {
    expect(parseAssistStream(`Partial${ASSIST_ERROR_MARKER}Model is not installed`)).toEqual({
      text: "Partial",
      lookups: [],
      failure: "Model is not installed",
    });
  });

  it("drops a lookup whose JSON does not parse and carries on with the text", () => {
    expect(parseAssistStream(`Ok${ASSIST_LOOKUP_MARKER}{nope${ASSIST_LOOKUP_MARKER} then`)).toEqual(
      {
        text: "Ok then",
        lookups: [],
        failure: null,
      },
    );
  });

  it("drops a lookup without a label", () => {
    const withoutLabel = `${ASSIST_LOOKUP_MARKER}{"tool":"search_code","paths":[]}${ASSIST_LOOKUP_MARKER}`;
    expect(parseAssistStream(`${withoutLabel}Done.`)).toEqual({
      text: "Done.",
      lookups: [],
      failure: null,
    });
  });
});
