import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("treats the clinical type scale as font sizes, so text colors survive", () => {
    expect(cn("bg-primary text-primary-foreground", "text-body")).toBe("bg-primary text-primary-foreground text-body");
    expect(cn("text-meta font-medium", "text-allow")).toBe("text-meta font-medium text-allow");
  });

  it("still lets a later size or color win over an earlier one", () => {
    expect(cn("text-sm", "text-body")).toBe("text-body");
    expect(cn("text-meta", "text-data")).toBe("text-data");
    expect(cn("text-muted-foreground", "text-block")).toBe("text-block");
  });
});
