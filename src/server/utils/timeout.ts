// Timeout helper for Gemini / External APIs
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`O limite de tempo operacional de ${timeoutMs / 1000}s para a inteligência artificial ('${operationName}') foi excedido. Por favor, simplifique o texto de entrada ou tente novamente.`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
