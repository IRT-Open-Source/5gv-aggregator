export class RequestBuilder {
  baseUrl: string;
  variables = {};
  extensions = {};

  build() {
    return `${this.baseUrl}?variables=${JSON.stringify(
      this.variables,
    )}&extensions=${JSON.stringify(this.extensions)}`;
  }
}
