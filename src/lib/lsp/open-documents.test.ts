import { describe, expect, it } from "vitest";
import { OpenDocuments } from "./open-documents";

function recordingSync(failingOpen?: string) {
  const calls: string[] = [];
  let failure = failingOpen;
  return {
    calls,
    sync: {
      open: async (file: string) => {
        if (file === failure) {
          failure = undefined;
          throw new Error(`cannot open ${file}`);
        }
        calls.push(`open ${file}`);
      },
      close: async (file: string) => {
        calls.push(`close ${file}`);
      },
    },
  };
}

async function pinAndRelease(documents: OpenDocuments, file: string): Promise<void> {
  const release = await documents.pin([file]);
  await release();
}

describe("OpenDocuments", () => {
  it("opens a document once while several pins hold it", async () => {
    const { calls, sync } = recordingSync();
    const documents = new OpenDocuments(sync, 1);
    const first = await documents.pin(["a.ts"]);
    const second = await documents.pin(["a.ts"]);
    await first();
    await second();
    expect(calls).toEqual(["open a.ts"]);
  });

  it("keeps pinned documents open past the idle limit", async () => {
    const { calls, sync } = recordingSync();
    const documents = new OpenDocuments(sync, 1);
    await documents.pin(["a.ts", "b.ts", "c.ts"]);
    expect(calls).toEqual(["open a.ts", "open b.ts", "open c.ts"]);
  });

  it("closes the least recently released document beyond the idle limit", async () => {
    const { calls, sync } = recordingSync();
    const documents = new OpenDocuments(sync, 2);
    for (const file of ["a.ts", "b.ts", "c.ts"]) await pinAndRelease(documents, file);
    expect(calls).toEqual(["open a.ts", "open b.ts", "open c.ts", "close a.ts"]);
  });

  it("keeps a document pinned again before eviction and makes it the most recent", async () => {
    const { calls, sync } = recordingSync();
    const documents = new OpenDocuments(sync, 2);
    await pinAndRelease(documents, "a.ts");
    await pinAndRelease(documents, "b.ts");
    const repin = await documents.pin(["a.ts"]);
    await repin();
    await pinAndRelease(documents, "c.ts");
    expect(calls).toEqual(["open a.ts", "open b.ts", "open c.ts", "close b.ts"]);
  });

  it("reopens a document that eviction closed", async () => {
    const { calls, sync } = recordingSync();
    const documents = new OpenDocuments(sync, 1);
    await pinAndRelease(documents, "a.ts");
    await pinAndRelease(documents, "b.ts");
    await pinAndRelease(documents, "a.ts");
    expect(calls).toEqual(["open a.ts", "open b.ts", "close a.ts", "open a.ts", "close b.ts"]);
  });

  it("pins a 300-file batch and leaves only the idle limit open afterwards", async () => {
    const { calls, sync } = recordingSync();
    const documents = new OpenDocuments(sync, 50);
    const files = Array.from({ length: 300 }, (_, index) => `f${index}.ts`);
    const release = await documents.pin(files);
    await release();
    expect(calls.filter((call) => call.startsWith("open"))).toHaveLength(300);
    expect(calls.filter((call) => call.startsWith("close"))).toHaveLength(250);
  });

  it("releases the documents a failed pin had already opened", async () => {
    const { calls, sync } = recordingSync("x.ts");
    const documents = new OpenDocuments(sync, 0);
    await expect(documents.pin(["a.ts", "x.ts"])).rejects.toThrow("cannot open x.ts");
    expect(calls).toEqual(["open a.ts", "close a.ts"]);
  });

  it("sends didOpen again for a document whose didOpen failed", async () => {
    const { calls, sync } = recordingSync("x.ts");
    const documents = new OpenDocuments(sync, 5);
    await expect(documents.pin(["x.ts"])).rejects.toThrow("cannot open x.ts");
    await pinAndRelease(documents, "x.ts");
    expect(calls).toEqual(["open x.ts"]);
  });
});
