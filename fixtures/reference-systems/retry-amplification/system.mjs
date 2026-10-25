export async function callWithAmplifiedRetries(operation) {
  let lastError;
  for (let outer = 0; outer < 3; outer += 1) {
    for (let inner = 0; inner < 3; inner += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
      }
    }
  }
  throw lastError;
}
