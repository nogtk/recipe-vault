import { describe, expect, it } from "vitest";

declare function require(id: string): { readFileSync: (path: string, encoding: "utf8") => string };

const { readFileSync } = require("node:fs");

describe("PR preview workflow", () => {
  it("Workers Preview URLをPRごとに作る設定になっている", () => {
    const workflow = readFileSync(".github/workflows/preview.yml", "utf8");
    const wrangler = readFileSync("wrangler.jsonc", "utf8");
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { devDependencies: Record<string, string> };

    expect(wrangler).toContain('"preview_urls": true');
    expect(pkg.devDependencies.wrangler).toMatch(/^\^4\.(?:[2-9]\d|1\d{2,})\./);
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("npm run check");
    expect(workflow).toContain("versions upload --preview-alias pr-${{ github.event.pull_request.number }}");
    expect(workflow).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(workflow).toContain("actions/github-script@v8");
    expect(workflow).toContain("CLOUDFLARE_API_TOKEN");
    expect(workflow).toContain("CLOUDFLARE_ACCOUNT_ID");
  });
});
