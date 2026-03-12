export class ClientDispatcher {
  constructor({ endpointUrl, fetchImpl = globalThis.fetch }) {
    this.endpointUrl = endpointUrl;
    this.fetchImpl = typeof fetchImpl === "function" ? fetchImpl.bind(globalThis) : fetchImpl;
  }

  async sendValidationRequest(payload) {
    const response = await this.fetchImpl(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Validation request failed with status ${response.status}.`);
    }

    return response.json();
  }
}
