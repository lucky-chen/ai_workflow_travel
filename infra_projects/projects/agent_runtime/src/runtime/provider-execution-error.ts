export class ProviderExecutionError extends Error {
  constructor(
    readonly code:
      | "provider_timeout"
      | "provider_transport_error"
      | "provider_empty_response"
      | "provider_malformed_output"
      | "provider_contract_violation"
      | "provider_response_shape_invalid",
    message: string,
  ) {
    super(message);
    this.name = "ProviderExecutionError";
  }
}
