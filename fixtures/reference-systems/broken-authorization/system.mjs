export function canReadInvoice(user, invoice) {
  return Boolean(user?.authenticated && invoice);
}
