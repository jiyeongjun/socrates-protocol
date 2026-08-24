export async function placeOrder(input, dependencies) {
  const { customerId, idempotencyKey, items } = input;
  const { clock, events, inventory, orders, payments } = dependencies;

  const existing = await orders.findByIdempotencyKey(idempotencyKey);
  if (existing) return existing;

  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("An order needs at least one item");
  }

  const reservation = await inventory.reserve(items);
  try {
    const payment = await payments.authorize({
      amount: reservation.total,
      customerId,
    });
    const order = await orders.insert({
      createdAt: clock.now(),
      customerId,
      idempotencyKey,
      items: reservation.items,
      paymentId: payment.id,
      status: "confirmed",
      total: reservation.total,
    });
    await events.publish({ orderId: order.id, type: "order.confirmed" });
    return order;
  } catch (error) {
    await inventory.release(reservation.id);
    throw error;
  }
}
