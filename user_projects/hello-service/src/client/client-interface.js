export class ClientInterface {
  constructor({ dispatcher, documentRef = globalThis.document }) {
    this.dispatcher = dispatcher;
    this.documentRef = documentRef;
  }

  render() {
    const documentRef = this.documentRef;
    documentRef.body.innerHTML = `
      <main>
        <h1>Text Validation Client</h1>
        <form id="validation-form">
          <label for="input-text">Text</label>
          <input id="input-text" name="input-text" type="text" />
          <button type="submit">Validate</button>
        </form>
        <p id="result"></p>
        <p id="error"></p>
      </main>
    `;

    const form = documentRef.getElementById("validation-form");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const input = documentRef.getElementById("input-text");
      const inputText = input && "value" in input ? input.value : "";
      void this.handleSubmit(String(inputText ?? ""));
    });
  }

  async handleSubmit(inputText) {
    try {
      const response = await this.dispatcher.sendValidationRequest({ text: inputText });
      this.displayResult(response.result);
      this.showError("");
    } catch (error) {
      this.showError(error instanceof Error ? error.message : "Validation request failed.");
    }
  }

  displayResult(resultText) {
    const resultNode = this.documentRef.getElementById("result");
    if (resultNode) {
      resultNode.textContent = resultText;
    }
  }

  showError(errorMessage) {
    const errorNode = this.documentRef.getElementById("error");
    if (errorNode) {
      errorNode.textContent = errorMessage;
    }
  }
}
