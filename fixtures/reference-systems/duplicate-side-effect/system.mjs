export async function processPayment(message, provider) {
  return provider.charge(message.customerId, message.amount);
}
