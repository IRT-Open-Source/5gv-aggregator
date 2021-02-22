import { Promise } from 'bluebird';
import { ArdMediathek } from '5gv-dto';
import { RequestBuilder } from './request-builder/request-builder';
import { HttpRequestManagerService } from 'src/aggregator/http-request-manager/http-request-manager.service';
import { TeaserDto } from '5gv-dto/dist/ard-mediathek/impl/teaser.dto';
import { StreamInfo } from '../model/stream-info';
import { Logger } from '@nestjs/common';

export class ArdMediathekCrawler {
  private readonly maxRetry = 3;
  private readonly ARD_API_BASE_URL =
    'https://api.ardmediathek.de/public-gateway';

  private logger = new Logger(ArdMediathekCrawler.name);
  private crawlDepth = 0;
  private timedoutTeaserRequest = [];
  private errorItems: ArdMediathek.ItemDto[];

  constructor(private http: HttpRequestManagerService) {}

  async getStreamUrlsFromHomePage(numMediaItems: number) {
    const what = `Searching for #media-items: ${numMediaItems} on ARD-Mediathek home page`;
    try {
      this.logger.log(`>>> Start: ${what}`);

      this.crawlDepth = 0;
      this.errorItems = [];
      const home = await this.getHome('ard');
      this.logger.log(
        `Retrieved 'home' (#compilations: ${home.data.defaultPage.widgets.length})`,
      );

      const compilations = [].concat(
        ...(await Promise.all(
          home.data.defaultPage.widgets.map(async widget =>
            this.getCompilation(widget.links.self.href),
          ),
        )),
      );

      let teasers: ArdMediathek.TeaserDto[] = [];
      teasers = [].concat(
        ...compilations.map(compilation => compilation.teasers),
      );

      // Remove live streams
      teasers = teasers.filter(teaser => {
        if (teaser.type.toLowerCase() === 'live') {
          this.logger.verbose(`Removed live-stream ${teaser.shortTitle}`);
          return false;
        } else {
          return true;
        }
      });

      let items = [];
      let media = [];
      let streams = [];

      while (streams.length < numMediaItems) {
        this.crawlDepth++;
        this.logger.log(
          `>>> Search on level: ${this.crawlDepth} (so far #media-items: ${streams.length} of ${numMediaItems} found)`,
        );

        this.logger.log(`#teasers (1): ${teasers.length}`);

        // Remove duplicates
        teasers = this.removeDuplicateTeasers(teasers);
        this.logger.log(`#teasers (2): ${teasers.length} (without duplicates)`);

        this.timedoutTeaserRequest = [];
        items = await this.getItems(teasers);

        let numRetry = 0;
        while (
          this.timedoutTeaserRequest.length > 0 &&
          numRetry < this.maxRetry
        ) {
          numRetry += 1;
          this.logger.log(
            `Retry fetching #items: ${this.timedoutTeaserRequest.length} (numRetry: ${numRetry})`,
          );
          const missingTeasers = this.timedoutTeaserRequest;
          this.timedoutTeaserRequest = [];
          items = items.concat(await this.getItems(missingTeasers));
        }

        // Remove 'undefined' items
        items = items.filter(item => typeof item === 'object');
        this.logger.log(`Retrieved #items: ${items.length}`);

        media = [].concat(...items.map(item => this.parseItem(item)));
        this.logger.log(`Parsed #items: ${media.length}`);

        // Only keep relevant teaser data
        media.forEach(item => {
          item.teasers = item.teasers.map((teaser: ArdMediathek.TeaserDto) => ({
            id: teaser.id,
            shortTitle: teaser.shortTitle,
            links: teaser.links,
          }));
        });

        teasers = teasers.concat(...media.map(medium => medium.teasers));
        streams = [].concat(media.map(medium => medium.streamInfo));
        this.logger.log(`#streams (1): ${streams.length} (all items)`);

        streams = streams.filter(
          stream =>
            typeof stream === 'object' &&
            stream !== null &&
            Array.isArray(stream.streamUrls) &&
            stream.streamUrls.length > 0,
        );
        this.logger.log(
          `#streams (2): ${streams.length} (items with stream URLs)`,
        );

        streams.splice(numMediaItems);
        this.logger.log(
          `#streams (3): ${streams.length} (within given limits)`,
        );

        this.logger.log(
          `#streams (4): ${
            [].concat(...streams.map(stream => stream.streamUrls)).length
          } (actual stream URLs)`,
        );
      }
      this.logger.log(`<<< Done: ${what}`);
      return streams;
    } catch (error) {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`getStreamUrlsFromHomePage: ${error}`);
      }
    }
  }

  private removeDuplicateTeasers(teasers: TeaserDto[]) {
    const uniqueTeasers: TeaserDto[] = [];
    teasers.forEach(teaser => {
      if (
        // If there is no teaser in the list with the same 'id',
        // than add the teaser to the list of unique teasers
        !uniqueTeasers.find(
          uTeaser => uTeaser.links.target.href === teaser.links.target.href,
        )
      ) {
        uniqueTeasers.push(teaser);
      } else {
        // this.logger.verbose(`Remove duplicate teaser: ${teaser.shortTitle}`);
      }
    });
    return uniqueTeasers;
  }

  private async getHome(clientName: string): Promise<ArdMediathek.HomeDto> {
    try {
      const reqBuilder = new RequestBuilder();

      reqBuilder.baseUrl = this.ARD_API_BASE_URL;
      reqBuilder.variables = {
        name: 'home',
        client: clientName,
        personalized: false,
      };
      reqBuilder.extensions = {
        persistedQuery: {
          version: 1,
          sha256Hash:
            'e3593c5c5c5095fdc0f68da926dd48234c2aec62a01a4d26eaaa8aded4c6de5e',
        },
      };

      const request = reqBuilder.build();
      this.logger.debug(`getHome(): ${request}`);

      return this.http.get(request, { timeout: 30000 });
    } catch (error) {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`getHome: ${error}`);
      }
    }
  }

  private async getCompilation(
    url: string,
  ): Promise<ArdMediathek.CompilationDto> {
    const compilation = await this.loadCompilation(url);
    this.logger.log(
      `Got compilation ${compilation.links.self.title} (#teasers: ${compilation.teasers.length})`,
    );
    return compilation;
  }

  private async loadCompilation(
    url: string,
  ): Promise<ArdMediathek.CompilationDto> {
    return this.http.get(url, { timeout: 30000 }).catch(error => {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`Failed loading compilation @ ${url}: ${error}`);
      }
    });
  }

  private async getItems(
    teasers: ArdMediathek.TeaserDto[],
  ): Promise<ArdMediathek.ItemDto[]> {
    return [].concat(
      ...(await Promise.map(
        teasers,
        (teaser, i) => {
          //   this.logger.verbose(`Get teaser: ${i + 1}/${teasers.length}`);
          return this.loadItem(teaser);
        },
        {
          concurrency: 127,
        },
      )),
    );
  }

  private async loadItem(teaser: ArdMediathek.TeaserDto) {
    return this.http
      .get(teaser.links.target.href, { timeout: 30000 })
      .catch(error => {
        this.timedoutTeaserRequest.push(teaser);
        this.logger.error(
          `Error retrieving teaser ${teaser.shortTitle} @ ${teaser.links.target.href}: ${error}`,
        );
      });
  }

  private parseItem(item: ArdMediathek.ItemDto) {
    let streamUrls: string[];
    let teasers: ArdMediathek.TeaserDto[] = [];
    let streamInfo: StreamInfo = null;

    try {
      //   this.logger.verbose(`Parse item ${item.title}`);
      item.widgets.forEach(widget => {
        if (widget.hasOwnProperty('mediaCollection')) {
          widget = widget as ArdMediathek.PlayerDto;
          streamUrls = this.parseMediaCollection(widget);
          streamInfo = {
            id: widget.id,
            title: widget.title,
            synopsis: widget.synopsis,
            availableTo: widget.availableTo,
            images: [widget.image],
            streams: [],
            streamUrls,
          };
        } else {
          widget = widget as ArdMediathek.CompilationDto;
          teasers = teasers.concat(widget.teasers);
        }
      });
    } catch (error) {
      let log;
      if (typeof item === 'object') {
        log = {};
        ['fskRating', 'id', 'personalized', 'title'].forEach(prop => {
          if (item.hasOwnProperty(prop)) {
            log[prop] = item[prop];
          }
        });
        if (log.fskRating && log.fskRating.toLowerCase() === 'fsk16') {
          log = `No stream information available for adult content '${log.title}'`;
          this.logger.warn(log);
        } else {
          this.logger.error(`Error parsing ${JSON.stringify(log)}: ${error}`);
          this.errorItems.push(item);
        }
      } else {
        this.logger.error(`Error parsing ${item}: ${error}`);
      }
    }

    return { streamInfo, teasers };
  }

  private parseMediaCollection(mediaInfo: ArdMediathek.PlayerDto): string[] {
    const streamUrls: string[] = [];
    mediaInfo.mediaCollection.embedded._mediaArray.forEach(element => {
      element._mediaStreamArray.forEach(stream => {
        if (Array.isArray(stream._stream)) {
          streamUrls.concat(stream._stream);
        } else {
          streamUrls.push(stream._stream);
        }
      });
    });
    return streamUrls;
  }
}
