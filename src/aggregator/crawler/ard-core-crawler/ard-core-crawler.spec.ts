import { ArdCoreCrawler } from './ard-core-crawler';
import { HttpService } from '@nestjs/common';

describe('ArdCoreCrawler', () => {
  it('should be defined', () => {
    expect(new ArdCoreCrawler(new HttpService())).toBeDefined();
  });
});
