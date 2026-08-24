import { describe, expect, it, vi } from "vitest";
import {
  estimateFoodWithZhipu,
  ZHIPU_MODEL
} from "../src/zhipu";

function apiResponse(content: string, status = 200): Response {
  return Response.json(
    {
      request_id: "test-request",
      choices: [{ message: { content } }]
    },
    { status }
  );
}

describe("estimateFoodWithZhipu", () => {
  it("normalizes a whole-serving estimate and downgrades vague high confidence", async () => {
    const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit) =>
      apiResponse(`\`\`\`json
      {
        "recognized": true,
        "foodName": "牛肉面加鸡蛋",
        "quantityText": "1碗加2个鸡蛋",
        "grams": 600,
        "totalCalories": 743,
        "confidence": "high",
        "uncertaintyPercent": 10
      }
      \`\`\``)
    );
    const fetcher = fetchMock as unknown as typeof fetch;

    const result = await estimateFoodWithZhipu(
      "test-key",
      "一碗牛肉面加两个鸡蛋",
      fetcher
    );

    expect(result.grams).toBe(600);
    expect(result.kcalPer100g).toBeCloseTo(123.83, 2);
    expect(result.confidence).toBe("medium");
    expect(result.uncertaintyPercent).toBe(20);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const request = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body)) as Record<string, unknown>;
    expect(body.model).toBe(ZHIPU_MODEL);
    expect(body.response_format).toEqual({ type: "json_object" });
  });

  it("keeps explicit weight confidence and supports zero calories", async () => {
    const fetcher = vi.fn(async () =>
      apiResponse(
        JSON.stringify({
          recognized: true,
          foodName: "水",
          quantityText: "500毫升",
          grams: 500,
          totalCalories: 0,
          confidence: "high",
          uncertaintyPercent: 5
        })
      )
    ) as unknown as typeof fetch;

    const result = await estimateFoodWithZhipu(
      "test-key",
      "500毫升水",
      fetcher
    );

    expect(result.kcalPer100g).toBe(0);
    expect(result.confidence).toBe("high");
    expect(result.uncertaintyPercent).toBe(10);
  });

  it("accepts the model's minimal non-food response", async () => {
    const fetcher = vi.fn(async () =>
      apiResponse(JSON.stringify({ recognized: false }))
    ) as unknown as typeof fetch;

    const result = await estimateFoodWithZhipu(
      "test-key",
      "帮我写一段JavaScript代码",
      fetcher
    );

    expect(result).toMatchObject({
      recognized: false,
      grams: 0,
      kcalPer100g: 0,
      confidence: "low",
      uncertaintyPercent: 50
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("repairs malformed model output once", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(apiResponse("这不是JSON"))
      .mockResolvedValueOnce(
        apiResponse(
          JSON.stringify({
            recognized: true,
            foodName: "苹果",
            quantityText: "1个",
            grams: 200,
            totalCalories: 106,
            confidence: "medium",
            uncertaintyPercent: 20
          })
        )
      ) as unknown as typeof fetch;

    const result = await estimateFoodWithZhipu("test-key", "一个苹果", fetcher);

    expect(result.foodName).toBe("苹果");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("corrects an implausibly high beverage estimate once", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse(
          JSON.stringify({
            recognized: true,
            foodName: "全糖珍珠奶茶",
            quantityText: "500毫升",
            grams: 500,
            totalCalories: 2215,
            confidence: "high",
            uncertaintyPercent: 15
          })
        )
      )
      .mockResolvedValueOnce(
        apiResponse(
          JSON.stringify({
            recognized: true,
            foodName: "全糖珍珠奶茶",
            quantityText: "500毫升",
            grams: 500,
            totalCalories: 500,
            confidence: "medium",
            uncertaintyPercent: 25
          })
        )
      ) as unknown as typeof fetch;

    const result = await estimateFoodWithZhipu(
      "test-key",
      "一杯500毫升全糖珍珠奶茶",
      fetcher
    );

    expect(result.grams).toBe(500);
    expect(result.kcalPer100g).toBe(100);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("rejects soup-sized hot dry noodles and corrects the estimate", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        apiResponse(
          JSON.stringify({
            recognized: true,
            foodName: "热干面",
            quantityText: "一碗",
            grams: 600,
            totalCalories: 1500,
            confidence: "medium",
            uncertaintyPercent: 20
          })
        )
      )
      .mockResolvedValueOnce(
        apiResponse(
          JSON.stringify({
            recognized: true,
            foodName: "热干面",
            quantityText: "一碗",
            grams: 300,
            totalCalories: 555,
            confidence: "medium",
            uncertaintyPercent: 20
          })
        )
      ) as unknown as typeof fetch;

    const result = await estimateFoodWithZhipu(
      "test-key",
      "一碗热干面",
      fetcher
    );

    expect(result.grams).toBe(300);
    expect((result.grams * result.kcalPer100g) / 100).toBe(555);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("maps rate limits to a typed error", async () => {
    const fetcher = vi.fn(async () => apiResponse("", 429)) as unknown as typeof fetch;

    await expect(
      estimateFoodWithZhipu("test-key", "一个苹果", fetcher)
    ).rejects.toMatchObject({
      code: "RATE_LIMIT",
      status: 429
    });
  });

  it("rejects an empty API key before sending a request", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;

    await expect(
      estimateFoodWithZhipu("", "一个苹果", fetcher)
    ).rejects.toMatchObject({ code: "CONFIGURATION" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
