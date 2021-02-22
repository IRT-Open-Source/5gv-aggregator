import { Module, HttpModule } from '@nestjs/common';
import { AggregatorService } from './aggregator/aggregator.service';
import { HttpRequestManagerService } from './aggregator/http-request-manager/http-request-manager.service';

@Module({
  imports: [HttpModule],
  controllers: [],
  providers: [AggregatorService, HttpRequestManagerService],
})
export class AppModule {}
