import { BaseRepository } from "@/features/base/base.repository";

class TestRepository extends BaseRepository {
  run<T>(
    operation: () => Promise<T>,
    options?: Parameters<BaseRepository["executeAsync"]>[1],
  ): Promise<T> {
    return this.executeAsync(operation, options);
  }

  runTransaction<T>(
    operation: Parameters<BaseRepository["executeTransaction"]>[0],
    options?: Parameters<BaseRepository["executeTransaction"]>[1],
  ): Promise<T> {
    return this.executeTransaction(operation, options);
  }
}

describe("BaseRepository", () => {
  const originalWarn = console.warn;

  afterEach(() => {
    console.warn = originalWarn;
  });

  it("logs retry attempts with operation labels for transient database errors", async () => {
    const warn = jest.fn();
    console.warn = warn;
    const repository = new TestRepository({} as never);
    const transientError = Object.assign(new Error("connection dropped"), {
      code: "ECONNRESET",
    });
    const operation = jest
      .fn()
      .mockRejectedValueOnce(transientError)
      .mockResolvedValueOnce("ok");

    await expect(
      repository.run(operation, {
        initialDelayMs: 1,
        jitterMs: 0,
        maxRetries: 1,
        operationName: "testOperation",
      }),
    ).resolves.toBe("ok");

    expect(operation).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[DATABASE RETRY] operation=TestRepository.testOperation"),
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("errorCode=ECONNRESET"));
  });

  it("wraps Prisma transactions in the shared execution helper", async () => {
    const transaction = { marker: "transaction" };
    const database = {
      $transaction: jest.fn(async (callback: (tx: typeof transaction) => Promise<string>) =>
        callback(transaction),
      ),
    };
    const repository = new TestRepository(database as never);

    await expect(
      repository.runTransaction(async (tx) => {
        expect(tx).toBe(transaction);
        return "committed";
      }),
    ).resolves.toBe("committed");

    expect(database.$transaction).toHaveBeenCalledTimes(1);
  });
});

