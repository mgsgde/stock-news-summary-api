// HTTP failures. Throw `new HttpError(status, message)`; app.ts sends that status to the client.
// 502 Bad Gateway = an upstream service (news, OpenAI) failed.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
