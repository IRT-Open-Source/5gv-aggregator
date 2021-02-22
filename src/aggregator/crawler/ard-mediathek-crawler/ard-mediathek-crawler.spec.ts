import { ArdMediathekCrawler } from './ard-mediathek-crawler';
import { HttpService } from '@nestjs/common';

describe('ArdMediathekCrawler', () => {
  it('should be defined', () => {
    expect(new ArdMediathekCrawler(new HttpService())).toBeDefined();
  });
});
