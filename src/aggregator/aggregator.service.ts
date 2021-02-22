import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Promise } from 'bluebird';
import { Subscription } from 'rxjs';
import * as hls from 'hls-parser';
import { Messenger } from 'messenger';
import { Aggregator } from '5gv-dto';
import { ArdCoreCrawler } from './crawler/ard-core-crawler/ard-core-crawler';
import { ArdMediathekCrawler } from './crawler/ard-mediathek-crawler/ard-mediathek-crawler';
import { HttpRequestManagerService } from './http-request-manager/http-request-manager.service';
import { ServiceConfig } from '../config/service-config';
import { StreamInfo } from './crawler/model/stream-info';
import { type } from 'os';

@Injectable()
export class AggregatorService implements OnModuleDestroy {
  private readonly videoTypeFilter = {
    MP4: /\.mp4$|\.mp4[^\d\w\-_\.~,]/,
    F4M: '.f4m',
    HLS: '.m3u8',
    DASH: '.mpd',
  };
  private readonly UNWANTED_STREAM_URLS = [
    this.videoTypeFilter.MP4,
    this.videoTypeFilter.F4M,
  ];
  private readonly logger = new Logger(AggregatorService.name);
  private messenger = Messenger.getInstance(AggregatorService.name);
  private connectStateSub: Subscription; // TODO: unsubscribe
  private newConfigSub: any;
  private ardCoreCrawler: ArdCoreCrawler;
  private ardMediathekCrawler: ArdMediathekCrawler;
  private currentConfigUrl: string;
  private procTimeout = null;

  constructor(private http: HttpRequestManagerService) {
    this.logger.log('Create');
    this.connectStateSub = this.messenger.onConnectionChange.subscribe({
      next: connectState => this.handleConnectStateChange(connectState),
    });
    this.ardCoreCrawler = new ArdCoreCrawler(this.http);
    this.ardMediathekCrawler = new ArdMediathekCrawler(this.http);
    // TODO: close connections
    // TODO: Handle close
  }

  private async handleConnectStateChange(connectState: number) {
    if (connectState === Messenger.CONNECTED) {
      this.newConfigSub = this.messenger.subscribe('new-aggregator-config');
      this.newConfigSub.on('message', message => this.handleNewConfig(message));
    }
  }

  onModuleDestroy() {
    this.connectStateSub.unsubscribe();
  }

  private async handleNewConfig(message: any) {
    this.logger.debug(
      `'new-aggregator-config': [${message.getSequence()}]: ${message.getData()}`,
    );

    this.currentConfigUrl = message.getData();
    this.scheduleProcessConfig();
  }

  private async scheduleProcessConfig() {
    const config = await this.http.get(this.currentConfigUrl);
    const delay = this.checkExecute(config);

    if (this.procTimeout === null) {
      clearTimeout(this.procTimeout);
      this.procTimeout = null;
    }

    if (delay >= 0) {
      this.procTimeout = setTimeout(async () => {
        await this.proc(config);
        this.scheduleProcessConfig();
      }, delay);
    }
  }

  private async proc(config) {
    // Cancel all pending requests
    this.http.cancel();
    await this.processConfig(config);
  }

  /**
   * Checks when a given configuration should be executed. Compares time elapsed
   * since configuration has last been processed with cron job interval value in
   * configuration. Return value 0 means the configuration should be processed
   * immediately. A positive return value indicates the time to wait until the
   * configuration should be processed. A negative value indicates the configuration
   * should not be processed, as it already has been processed and cron job is not
   * activated for this configuration.
   * @param config
   * @returns {number}
   */
  private checkExecute(config: {
    cronJobActive: boolean;
    cronJobInterval: number;
    lastProcessed: number;
  }): number {
    let timeelapsed = 0;

    // TODO: Implement proper validity check
    if (!config.hasOwnProperty('cronJobActive')) {
      this.logger.log('Do NOT process config: invalid config');
      return -1;
    }

    if (config.lastProcessed) {
      timeelapsed = this.millisToHours(Date.now() - config.lastProcessed);
    } else {
      this.logger.log(
        'Process config now as it seams it has never been processed before',
      );
      return 0;
    }

    if (config.cronJobActive && timeelapsed > config.cronJobInterval) {
      this.logger.log(
        `Process config now (time elapsed since last execution: ${timeelapsed} hours, cron job interval: ${config.cronJobInterval} hours)`,
      );
      return 0;
    } else if (config.cronJobActive && timeelapsed <= config.cronJobInterval) {
      const delay = this.hoursToMillis(config.cronJobInterval - timeelapsed);
      this.logger.log(
        `Delay processing of config for ${delay} milliseconds (time elapsed since last execution: ${timeelapsed} hours, cron job interval: ${config.cronJobInterval} hours)`,
      );
      return delay;
    } else {
      this.logger.log(
        'Do NOT process config as it seams it has already been processed and no cron job is specified.',
      );
      return -1;
    }
  }

  private millisToHours(milliS: number): number {
    return milliS / 1000 / 60 / 60;
  }

  private hoursToMillis(hours: number): number {
    return hours * 60 * 60 * 1000;
  }

  private async processConfig(config: Aggregator.ConfigDto) {
    let mediaItems: StreamInfo[];

    try {
      mediaItems = [].concat(
        ...(await Promise.all(
          config.configItems.map(item => {
            if (item.criterion === 'latest') {
              return this.ardCoreCrawler.getStreamsUrlsForLatestPublications(
                item.value,
              );
            } else if (item.criterion === 'ard-mediathek-home') {
              return this.ardMediathekCrawler.getStreamUrlsFromHomePage(
                item.value,
              );
            }
          }),
        )),
      );

      this.logger.log(`#mediaItems (1): ${mediaItems.length}`);

      mediaItems = this.removeDuplicateMediaItems(mediaItems);
      this.logger.log(
        `#mediaItems (2): ${mediaItems.length} (without duplicates)`,
      );

      mediaItems = this.removeUnwantedUrls(mediaItems);

      // Set master stream urls
      mediaItems.map(item => {
        item.streams = item.streamUrls.map(url => ({
          url,
          type: this.detectVideoType(url),
        }));
      });

      await Promise.map(mediaItems, item => this.explodeHlsUrls(item));

      // Remove invalid
      mediaItems = mediaItems.map(item => {
        item.streamUrls = item.streamUrls.filter(
          url => typeof url === 'string',
        );
        return item;
      });

      this.logger.log(
        `#mediaItems (3): ${
          [].concat(...mediaItems.map(item => item.streamUrls)).length
        } (stream URLs, incl. ABRS segments)`,
      );

      await this.http.post('http://state-api:3000/cache-state', mediaItems);
      this.logger.debug('Sent new cache-state config');

      await this.setLastProcessed(config);
    } catch (error) {
      if (this.http.isCancel(error)) {
        this.logger.log('--- CANCELED RUNNING PROCESS ---');
      } else {
        this.logger.error(error);
      }
    }
  }

  async setLastProcessed(config) {
    const path = `http://state-api:3000/aggregator/config/${config.name}/lastprocessed`;
    const lastProcessed = Date.now();
    this.logger.debug(`Updating last processed: ${lastProcessed}`);
    await this.http.patch(path, { lastProcessed });
  }

  detectVideoType(url: string): 'mp4' | 'hls' | 'dash' | 'f4m' {
    if (url.match(this.videoTypeFilter.MP4)) {
      return 'mp4';
    } else if (url.match(this.videoTypeFilter.HLS)) {
      return 'hls';
    } else if (url.match(this.videoTypeFilter.DASH)) {
      return 'dash';
    } else if (url.match(this.videoTypeFilter.F4M)) {
      return 'f4m';
    } else {
      return null;
    }
  }

  private removeUnwantedUrls(mediaItems: StreamInfo[]): StreamInfo[] {
    return mediaItems.map(item => {
      item.streamUrls = item.streamUrls.filter(url =>
        this.UNWANTED_STREAM_URLS.reduce(
          (result, pattern) => !url.match(pattern) && result,
          true,
        ),
      );
      return item;
    });
  }

  private async explodeHlsUrls(mediaItem: StreamInfo) {
    const hlsManifests = mediaItem.streamUrls.filter(
      url => url.match('m3u8') !== null,
    );
    const segs = await Promise.map(hlsManifests, url =>
      this.getHlsSegmentUrls(url),
    );
    mediaItem.streamUrls = mediaItem.streamUrls.concat(...segs);
    this.logger.verbose(
      `Found #streamUrls: ${mediaItem.streamUrls.length} for ${mediaItem.title}`,
    );
  }

  private async getHlsSegmentUrls(manifestUrl: string): Promise<string[]> {
    try {
      let master = await this.http.get(this.rectifyUrl(manifestUrl));
      master = hls.parse(master);

      try {
        const segments: any[] = await Promise.all(
          master.variants.map(v => this.http.get(this.rectifyUrl(v.uri))),
        );
        const segs = [].concat(
          ...segments.map(segment =>
            (hls.parse(segment) as hls.types.MediaPlaylist).segments.map(
              s => s.uri,
            ),
          ),
        );
        return segs;
      } catch (error) {
        if (this.http.isCancel(error)) {
          throw error;
        } else {
          this.logger.error(
            `Failed getting segment URLs for ${manifestUrl}: ${error}`,
          );
        }
      }
    } catch (error) {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(
          `Failed parsing master manfifest for ${manifestUrl}: ${error}`,
        );
      }
    }
  }

  private rectifyUrl(url: string): string {
    // return url.replace(/(^[a-z]+:)?\/\//, this.DEFAULT_PROTOCOL + '://');
    return url.replace(/(^[a-z]+:)?\/\//, 'https://');
  }

  private removeDuplicateMediaItems(mediaItems: StreamInfo[]) {
    const uniqueRefs: StreamInfo[] = [];
    mediaItems.forEach(mediaItem => {
      if (
        // If there is no item in the list with the same id,
        // than add item to the list of unique refs
        !uniqueRefs.find(item => item.id === mediaItem.id)
      ) {
        uniqueRefs.push(mediaItem);
      } else {
        this.logger.verbose(`Remove duplicate streamUrl: ${mediaItem.title}`);
      }
    });
    return uniqueRefs;
  }
}
