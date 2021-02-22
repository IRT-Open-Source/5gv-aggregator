import { Test, TestingModule } from '@nestjs/testing';
import { HttpRequestManagerService } from './http-request-manager.service';

describe('HttpRequestManagerService', () => {
  let service: HttpRequestManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HttpRequestManagerService],
    }).compile();

    service = module.get<HttpRequestManagerService>(HttpRequestManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
