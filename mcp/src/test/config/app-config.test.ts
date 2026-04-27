import { createConfig } from "../../config/index.js";

describe("createConfig", () => {
  it("parses PAT auth env vars when provided", () => {
    const config = createConfig(
      {
        name: "rentify-mcp",
        version: "1.0.0",
      },
      {
        RENTIFY_API_BASE_URL: "http://localhost:8040/",
        RENTIFY_API_TIMEOUT_MS: "7000",
        RENTIFY_PAT: "rpat_1234567890abcdef123456_abcdef123456abcdef123456abcdef123456abcdef123456",
      },
    );

    expect(config.apiBaseUrl).toBe("http://localhost:8040");
    expect(config.apiTimeoutMs).toBe(7000);
    expect(config.auth).toEqual({
      personalAccessToken:
        "rpat_1234567890abcdef123456_abcdef123456abcdef123456abcdef123456abcdef123456",
    });
  });

  it("keeps public-only mode working when auth env vars are absent", () => {
    const config = createConfig({
      name: "rentify-mcp",
      version: "1.0.0",
    });

    expect(config.auth).toEqual({
      personalAccessToken: undefined,
    });
  });

  it("rejects empty auth values when configured", () => {
    expect(() =>
      createConfig(
        {
          name: "rentify-mcp",
          version: "1.0.0",
        },
        {
          RENTIFY_PAT: "   ",
        },
      ),
    ).toThrow("RENTIFY_PAT must not be empty when configured.");
  });
});
