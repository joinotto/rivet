export async function processOrder(message, gateway) {
  await gateway.reserve(message.orderId);
  return gateway.charge(message.orderId, message.amount);
}

export function applyStatus(order, event) {
  order.status = event.status;
  order.sequence = event.sequence;
  return order;
}
