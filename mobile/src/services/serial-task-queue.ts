/**
 * 创建一个轻量串行任务队列，保证本地存储的读改写不会并发覆盖。
 * 单个任务失败不会阻断后续任务，错误仍由原调用方接收。
 */
export function createSerialTaskQueue() {
  let tail: Promise<void> = Promise.resolve();

  return function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = tail.then(task, task);
    tail = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  };
}
