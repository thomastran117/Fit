import { createRentingsToolHandlers } from "../../domains/rentings/index.js";

function readFirstText(result: { content: Array<{ type: string } & Record<string, unknown>> }): string {
  const textBlock = result.content.find(
    (entry): entry is { type: "text"; text: string } => entry.type === "text",
  );

  return textBlock?.text ?? "";
}

describe("createRentingsToolHandlers", () => {
  it("maps list_my_rentings to the protected rentings API", async () => {
    const apiClient = {
      listMyRentings: jest.fn().mockResolvedValue({
        rentings: [
          {
            id: "renting_1",
            status: "confirmed",
            posting: {
              id: "post_1",
              name: "Lake House",
            },
          },
        ],
        pagination: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }),
    } as never;
    const handlers = createRentingsToolHandlers(apiClient);

    const result = await handlers.listMyRentings({
      status: "confirmed",
    });

    expect((apiClient as { listMyRentings: jest.Mock }).listMyRentings).toHaveBeenCalledWith({
      status: "confirmed",
    });
    expect(result.structuredContent).toMatchObject({
      rentings: [{ id: "renting_1" }],
    });
    expect(readFirstText(result)).toContain("Fetched 1 renting(s)");
  });

  it("maps get_renting to the protected renting detail API", async () => {
    const apiClient = {
      getRenting: jest.fn().mockResolvedValue({
        id: "renting_1",
        status: "confirmed",
        posting: {
          id: "post_1",
          name: "Lake House",
        },
      }),
    } as never;
    const handlers = createRentingsToolHandlers(apiClient);

    const result = await handlers.getRenting({
      id: "renting_1",
    });

    expect((apiClient as { getRenting: jest.Mock }).getRenting).toHaveBeenCalledWith("renting_1");
    expect(result.structuredContent).toMatchObject({
      id: "renting_1",
      status: "confirmed",
    });
    expect(readFirstText(result)).toContain("Fetched renting renting_1");
  });
});
