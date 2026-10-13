import { describe, expect, it } from "vitest";
import { parseDisplay } from "@/lib/display";

describe("parseDisplay", () => {
  it("defaults to the system theme and comfortable density", () => {
    expect(parseDisplay(null)).toEqual({ theme: "system", density: "comfortable" });
  });

  it("keeps known values and drops anything else", () => {
    expect(parseDisplay('{"theme":"dark","density":"compact"}')).toEqual({ theme: "dark", density: "compact" });
    expect(parseDisplay('{"theme":"neon","density":7}')).toEqual({ theme: "system", density: "comfortable" });
    expect(parseDisplay("not json")).toEqual({ theme: "system", density: "comfortable" });
  });
});
