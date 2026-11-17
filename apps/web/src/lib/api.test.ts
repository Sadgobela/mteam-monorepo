// @vitest-environment node
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fail, readJson } from "./api";

const post = (body: string) => new Request("http://localhost/x", { method: "POST", body });

describe("readJson", () => {
  const schema = z.object({ a: z.number() });

  it("returns a body that fits the schema", async () => {
    expect(await readJson(post('{"a":1}'), schema)).toEqual({ a: 1 });
  });

  it("is null for a body that does not fit, or is not JSON", async () => {
    expect(await readJson(post('{"a":"1"}'), schema)).toBeNull();
    expect(await readJson(post("{"), schema)).toBeNull();
  });
});

describe("fail", () => {
  it("sends the error code with the status", async () => {
    const response = fail("nope", 418);
    expect([response.status, await response.json()]).toEqual([418, { error: "nope" }]);
  });
});
