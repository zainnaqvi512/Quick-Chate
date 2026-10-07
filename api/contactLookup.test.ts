import { describe, it, expect } from "vitest";
import { contactLookup } from "./contactLookup";
describe("Exact contact identity", () => {
  it("canonicalizes complete usernames", () => {
    expect(contactLookup(" @Alice_123 ")).toEqual({ username: "alice_123" });
  });
  it("rejects display names, wildcards, short names and ambiguous local numbers", () => {
    for (const value of [
      "Alice Smith",
      "%",
      "alice%",
      "a",
      "al",
      "_alice",
      "2025550101",
      "",
    ])
      expect(contactLookup(value)).toBeNull();
  });
  it("normalizes international and explicitly selected country numbers", () => {
    expect(contactLookup("+1 (202) 555-0101")).toEqual({
      phone: "+12025550101",
    });
    expect(contactLookup("2025550101", "+1")).toEqual({
      phone: "+12025550101",
    });
    expect(contactLookup("+123")).toBeNull();
  });
});
