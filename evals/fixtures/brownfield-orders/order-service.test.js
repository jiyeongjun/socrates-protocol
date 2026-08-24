import test from "node:test";
import assert from "node:assert/strict";
import { placeOrder } from "./order-service.js";

function createDependencies(overrides = {}) {
  const calls = [];
  const dependencies = {
    clock: { now: () => "2026-08-24T09:00:00.000Z" },
    events: {
      publish: async (event) => calls.push(["publish", event]),
    },
    inventory: {
      reserve: async (items) => {
        calls.push(["reserve", items]);
        return { id: "reservation-1", items, total: 4200 };
      },
      release: async (reservationId) => calls.push(["release", reservationId]),
    },
    orders: {
      findByIdempotencyKey: async (key) => {
        calls.push(["find", key]);
        return null;
      },
      insert: async (order) => {
        calls.push(["insert", order]);
        return { id: "order-1", ...order };
      },
    },
    payments: {
      authorize: async (payment) => {
        calls.push(["authorize", payment]);
        return { id: "payment-1" };
      },
    },
    ...overrides,
  };
  return { calls, dependencies };
}

const input = {
  customerId: "customer-1",
  idempotencyKey: "request-1",
  items: [{ productId: "coffee", quantity: 1 }],
};

test("returns an existing idempotent order before starting side effects", async () => {
  const existing = { id: "order-existing", status: "confirmed" };
  const { calls, dependencies } = createDependencies({
    orders: {
      findByIdempotencyKey: async (key) => {
        calls.push(["find", key]);
        return existing;
      },
      insert: async () => assert.fail("insert must not run"),
    },
  });

  assert.equal(await placeOrder(input, dependencies), existing);
  assert.deepEqual(calls.map(([name]) => name), ["find"]);
});

test("reserves inventory, authorizes payment, persists, then publishes", async () => {
  const { calls, dependencies } = createDependencies();

  const order = await placeOrder(input, dependencies);

  assert.equal(order.status, "confirmed");
  assert.deepEqual(calls.map(([name]) => name), [
    "find",
    "reserve",
    "authorize",
    "insert",
    "publish",
  ]);
});

test("releases inventory when a downstream step fails", async () => {
  const { calls, dependencies } = createDependencies({
    payments: {
      authorize: async () => {
        calls.push(["authorize"]);
        throw new Error("payment unavailable");
      },
    },
  });

  await assert.rejects(placeOrder(input, dependencies), /payment unavailable/);
  assert.deepEqual(calls.map(([name]) => name), [
    "find",
    "reserve",
    "authorize",
    "release",
  ]);
});
