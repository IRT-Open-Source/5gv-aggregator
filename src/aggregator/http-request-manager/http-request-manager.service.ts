import { Injectable, Logger } from '@nestjs/common';
import * as axios from 'axios';
import { HttpRequestOptions } from './http-request-options';

@Injectable()
export class HttpRequestManagerService {
  logger = new Logger(HttpRequestManagerService.name);
  private cancelTokenMap: Record<string, axios.CancelTokenSource> = {};

  constructor() {}

  async get(url: string, options?: HttpRequestOptions): Promise<any> {
    const cToken = this.createCancelToken();
    return axios.default
      .get(url, {
        cancelToken: cToken.source.token,
        timeout: (options && options.timeout) || 0,
      })
      .then(response => response.data)
      .catch(thrown => {
        if (axios.default.isCancel(thrown)) {
          this.logger.verbose(`Cancelled request: ${url}`);
        }
        throw thrown;
      })
      .finally(() => this.deleteCancelToken(cToken));
  }

  async post(url: string, data: any) {
    return axios.default.post(url, data);
  }

  async patch(url: string, data: any) {
    return axios.default.patch(url, data);
  }

  private createCancelToken(): {
    key: string;
    source: axios.CancelTokenSource;
  } {
    const source = axios.default.CancelToken.source();
    const key = Date.now().toString() + Math.round(Math.random() * 1000);
    this.cancelTokenMap[key] = source;
    return { key, source };
  }

  private deleteCancelToken(cToken: {
    key: string;
    source: axios.CancelTokenSource;
  }) {
    delete this.cancelTokenMap[cToken.key];
  }

  cancel() {
    if (typeof this.cancelTokenMap === 'object') {
      const keys = Object.keys(this.cancelTokenMap);
      if (keys.length > 0) {
        keys.map(key => this.cancelTokenMap[key].cancel());
        this.logger.log(`Canceling ${keys.length} pending requests`);
      } else {
        this.logger.log('No pending requests');
      }
    } else {
      this.logger.log('No pending requests');
    }
  }

  isCancel(error: any) {
    return axios.default.isCancel(error);
  }
}
