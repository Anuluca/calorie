import { describe, expect, it } from "vitest";
import { createSerialTaskQueue } from "./serial-task-queue";

describe("createSerialTaskQueue", () => {
  it("按提交顺序执行并发任务", async () => {
    const enqueue = createSerialTaskQueue();
    const order: string[] = [];

    const first = enqueue(async () => {
      await Promise.resolve();
      order.push("first");
    });
    const second = enqueue(async () => {
      order.push("second");
    });

    await Promise.all([first, second]);
    expect(order).toEqual(["first", "second"]);
  });

  it("前一个任务失败后仍继续执行后续任务", async () => {
    const enqueue = createSerialTaskQueue();
    const failed = enqueue(async () => {
      throw new Error("write failed");
    });
    const recovered = enqueue(async () => "saved");

    await expect(failed).rejects.toThrow("write failed");
    await expect(recovered).resolves.toBe("saved");
  });
});
