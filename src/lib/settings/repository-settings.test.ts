import { describe, expect, it } from "vitest";
import { SessionStore } from "@/lib/session/store";
import {
  REPOSITORY_LIMIT,
  RepositoriesSchema,
  saveRepositories,
  savedRepositories,
} from "./repository-settings";

describe("RepositoriesSchema", () => {
  it("accepts owner/name pairs and trims them", () => {
    expect(RepositoriesSchema.parse([" acme/app ", "acme/my.repo-2"])).toEqual([
      "acme/app",
      "acme/my.repo-2",
    ]);
  });

  it("rejects names that are not owner/name", () => {
    expect(RepositoriesSchema.safeParse(["acme"]).success).toBe(false);
    expect(RepositoriesSchema.safeParse(["acme/app/extra"]).success).toBe(false);
    expect(RepositoriesSchema.safeParse(["acme/ap p"]).success).toBe(false);
  });

  it("caps the number of repositories", () => {
    const repositories = Array.from(
      { length: REPOSITORY_LIMIT + 1 },
      (value, index) => `acme/r${index}`,
    );
    expect(RepositoriesSchema.safeParse(repositories).success).toBe(false);
  });
});

describe("savedRepositories", () => {
  it("is empty until repositories are saved", () => {
    expect(savedRepositories(new SessionStore(":memory:"))).toEqual([]);
  });

  it("returns what was saved", () => {
    const store = new SessionStore(":memory:");
    saveRepositories(store, ["acme/app", "acme/lib"]);
    expect(savedRepositories(store)).toEqual(["acme/app", "acme/lib"]);
  });

  it("is empty when the stored value does not fit the schema", () => {
    const store = new SessionStore(":memory:");
    store.setSetting("repositories", JSON.stringify(["not a repository"]));
    expect(savedRepositories(store)).toEqual([]);
  });
});
