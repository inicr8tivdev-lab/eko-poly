import { describe, expect, it } from "vitest";
import { isAllowedOrigin, isAllowedSecFetchSite } from "./csrf";

describe("CSRF origin and Sec-Fetch-Site helpers", () => {
  it("allows matching direct request origin", () => {
    const req = new Request("http://localhost:3000/_serverFn/createRoom", {
      method: "POST",
      headers: { Origin: "http://localhost:3000" },
    });
    expect(isAllowedOrigin("http://localhost:3000", req)).toBe(true);
  });

  it("allows matching X-Forwarded-Proto and X-Forwarded-Host behind nginx", () => {
    const req = new Request("http://localhost:3000/_serverFn/createRoom", {
      method: "POST",
      headers: {
        Origin: "https://ais-dev-example.europe-west2.run.app",
        "x-forwarded-host": "ais-dev-example.europe-west2.run.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(isAllowedOrigin("https://ais-dev-example.europe-west2.run.app", req)).toBe(true);
    expect(isAllowedOrigin("https://evil.example", req)).toBe(false);
  });

  it("validates Origin when Sec-Fetch-Site is cross-site inside preview iframe", () => {
    const valid = new Request("http://localhost:3000/_serverFn/createRoom", {
      method: "POST",
      headers: {
        "Sec-Fetch-Site": "cross-site",
        Origin: "https://ais-dev-example.europe-west2.run.app",
        "x-forwarded-host": "ais-dev-example.europe-west2.run.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(isAllowedSecFetchSite("cross-site", valid)).toBe(true);

    const attacker = new Request("http://localhost:3000/_serverFn/createRoom", {
      method: "POST",
      headers: {
        "Sec-Fetch-Site": "cross-site",
        Origin: "https://attacker.example",
        "x-forwarded-host": "ais-dev-example.europe-west2.run.app",
        "x-forwarded-proto": "https",
      },
    });
    expect(isAllowedSecFetchSite("cross-site", attacker)).toBe(false);
  });
});
