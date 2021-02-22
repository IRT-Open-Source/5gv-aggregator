import * as jsonfile from 'jsonfile';
import { Messenger } from 'messenger';
import { ArdCore } from '5gv-dto';
import { HttpRequestManagerService } from 'src/aggregator/http-request-manager/http-request-manager.service';
import { ServiceConfig } from '../../../config/service-config';
import { StreamInfo } from '../model/stream-info';
import { Logger } from '@nestjs/common';

export class ArdCoreCrawler {
  private readonly DEFAULT_PROTOCOL = 'http';
  private readonly TYPE_VIDEO_BINARY = 'VideoBinaryResource';
  private readonly ARD_CORE_LATEST =
    'https://api-beta.ardmediathek.de/asset-api/publications/latest/created';
  private logger = new Logger(ArdCoreCrawler.name);
  private terminators: Array<() => void> = null;

  private procStart: number;

  constructor(private http: HttpRequestManagerService) {}

  async getStreamsUrlsForLatestPublications(amount: number) {
    const pubRefs = await this.getLatestPublications(amount);
    this.logger.log(`Retrieved #${pubRefs.length} publications`);
    const streams = await this.processPublications(pubRefs);
    this.logger.log(`#streamUrls: ${streams.length}`);
    jsonfile.writeFileSync('./db/ard-core-data.json', streams, {
      spaces: 2,
    });
    return streams;
  }

  private async getLatestPublications(
    amount: number,
  ): Promise<ArdCore.PublicationReferenceDto[]> {
    let latest: ArdCore.PublicationReferenceDto[] = [];
    let pageCount = 0;

    try {
      this.logger.log(`Attempting to retrieve latest #${amount} publications`);
      let pubSet: ArdCore.PublicationSetDto = await this.http.get(
        this.ARD_CORE_LATEST,
      );
      this.logger.log(`Retrieved page #${++pageCount}`);

      latest = latest.concat(pubSet.elements);
      while (latest.length < amount) {
        pubSet = await this.http.get(pubSet.next.href);
        latest = latest.concat(pubSet.elements);
        this.logger.log(`Retrieved page #${++pageCount}`);
      }
      // Make sure array length equals amount
      latest.splice(amount, latest.length - amount);
    } catch (error) {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`getLatestPublications: ${error}`);
      }
    }

    return latest;
  }

  private async processPublications(
    pubRefs: ArdCore.PublicationReferenceDto[],
  ): Promise<StreamInfo[]> {
    this.procStart = Date.now();
    this.logger.log(this.procTime() + ': Start');

    const streams: StreamInfo[] = await Promise.all(
      pubRefs.map(pubRef => this.getStreamsForPublication(pubRef)),
    );

    this.logger.log(
      this.procTime() +
        ': Fetched #video_binaries: ' +
        [].concat(...streams.map(stream => stream.streamUrls)).length,
    );

    return streams;
  }

  private async getStreamsForPublication(
    pubRef: ArdCore.PublicationReferenceDto,
  ) {
    const streamInfo = new StreamInfo();
    try {
      const publication: ArdCore.PublicationDto = await this.http.get(
        pubRef.href,
      );
      streamInfo.availableTo = publication.availableTo;
      streamInfo.id = publication.id;
      streamInfo.title = publication.title;
      streamInfo.synopsis = publication.plotSummary;
      // TODO: Get image(s) from publication info (not available in API response at the moment)
      streamInfo.images = [];
      this.logger.log(
        this.procTime() + ': Fetched publication: ' + publication.title,
      );

      streamInfo.streamUrls = []
        .concat(
          ...(await Promise.all(
            publication.binaries.map(binRef => this.getBinary(binRef)),
          )),
        )
        .filter(binary => binary._type === this.TYPE_VIDEO_BINARY)
        .map(binary => binary.href);

      this.logger.log(
        `${this.procTime()}: Fetched ${
          streamInfo.streamUrls.length
        } binaries for: ${streamInfo.title}`,
      );
      return streamInfo;
    } catch (error) {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`getBinariesForPublication: ${error}`);
      }
    }
  }

  private async getBinary(
    binRef: ArdCore.BinaryReferenceDto,
  ): Promise<ArdCore.BinaryDto> {
    try {
      return this.http.get(binRef.href);
    } catch (error) {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`getBinary: ${error}`);
      }
    }
  }

  private procTime() {
    return Date.now() - this.procStart;
  }
}
