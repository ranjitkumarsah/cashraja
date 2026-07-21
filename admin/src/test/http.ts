/** Test helpers for the mocked axios instance (used inside test bodies). */

/** Resolve an axios-style success envelope. */
export function ok<T>(data: T) {
  return Promise.resolve({ data });
}

/** Reject an axios-style error that the client's apiErrorMessage understands. */
export function fail(status: number, message: string) {
  return Promise.reject({
    isAxiosError: true,
    config: { url: '' },
    response: { status, data: { message, statusCode: status } },
  });
}
