import { ArdMediathekCrawler } from './old-ard-mediathek-crawler';
import { HttpService } from '@nestjs/common';
import { HttpRequestManagerService } from 'src/aggregator/http-request-manager/http-request-manager.service';

describe('ArdMediathekCrawler', () => {
  it('should be defined', () => {
    expect(
      new ArdMediathekCrawler(new HttpRequestManagerService()),
    ).toBeDefined();
  });
});
