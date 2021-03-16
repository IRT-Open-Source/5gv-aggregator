import { HttpRequestManagerService } from 'src/aggregator/http-request-manager/http-request-manager.service';
import { HomeModel } from './models/home.model';
import { Logger } from '@nestjs/common';
import { OnDemandTeaserModel } from './models/teasers/ondemand-teaser.model';
import { TeaserModel } from './models/teasers/teaser.model';
import { StageWidgetModel } from './models/widgets/stage-widget.model';
import { GridListWidgetModel } from './models/widgets/grid-list-widget.model';
import { Promise } from 'bluebird';
import { ItemModel } from './models/item.model';
import { OnDemandVideoWidgetModel } from './models/widgets/ondemand-video-widget.model';
import { WidgetModel } from './models/widgets/widget.model';
import { StreamInfo } from '../model/stream-info';

const MEDIATHEK_HOME =
  'https://api.ardmediathek.de/page-gateway/pages/ard/home?embedded=true';

export class ArdMediathekCrawler {
  private logger = new Logger(ArdMediathekCrawler.name);
  constructor(private http: HttpRequestManagerService) {}

  async getStreamUrlsFromHomePage(limit: number): Promise<StreamInfo[]> {
    const what = `Searching for #media-items: ${limit} on ARD-Mediathek home page`;
    try {
      this.logger.log(`>>> Start: ${what}`);

      this.logger.warn(`

            Current implementation does only look for VoD
            items on home and does not dig any deeper. 
            Number of videos may not meet specified requirements.
        `);

      // 1. Get Home Page
      const homeData = await this.loadHomePage();
      this.logger.log(`Loaded home page data`);

      // 2. Parse on-demand teasers data from home page widgets
      const onDemandTeasers = this.parseOnDemandTeasers(
        homeData.widgets,
        limit
      );
      this.logger.log(`Found ${onDemandTeasers.length} VoD teasers`);

      // 3. Load item pages
      const items = await this.loadItemPages(onDemandTeasers);
      this.logger.log(`Loaded VoD teaser data pages`);

      // 4. Get on-demand player data
      const playerWidgets = this.parseOnDemandPlayerWidgets(items, limit);
      this.logger.log(`Found ${playerWidgets.length} VoD data sets`);

      // 5. To stream info
      const streams = [].concat(
        ...playerWidgets.map(widget =>
          this.convertPlayerWidgetToStreamInfo(widget),
        ),
      );

      this.logger.log(`<<< Done: ${what}`);
      return streams;
    } catch (error) {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`getStreamUrlsFromHomePage(): ${error}`);
      }
    }
  }

  /**
   * Loads home page data for ARD-Mediathek
   */
  private async loadHomePage(): Promise<HomeModel> {
    try {
      this.logger.debug(`getHomePage(): ${MEDIATHEK_HOME}`);
      return this.http.get(MEDIATHEK_HOME, { timeout: 30000 });
    } catch (error) {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`getHomePage(): ${error}`);
      }
    }
  }

  /**
   * Returns the first `limit` teasers from a list of widgets.
   * Returns less if less contained.
   * @param home
   * @param limit
   */
  private parseOnDemandTeasers(
    widgets: (StageWidgetModel | GridListWidgetModel)[],
    limit?: number,
  ): OnDemandTeaserModel[] {
    this.logger.debug(`parseOnDemandTeasers()`);
    return []
      .concat(...widgets.map(widget => widget.teasers))
      .filter(teaser => teaser.type === TeaserModel.Type.ONDEMAND)
      .slice(0, limit || Infinity);
  }

  /**
   * Loads of item data for list of ondemand teasers
   * @param teaser
   */
  private async loadItemPages(
    teasers: OnDemandTeaserModel[],
  ): Promise<ItemModel[]> {
    return [].concat(
      ...(await Promise.map(
        teasers,
        teaser => {
          return this.loadItemPage(teaser);
        },
        {
          concurrency: 127,
        },
      )),
    );
  }

  /**
   * Loads item data for ondemand teaser
   * @param teaser
   */
  private async loadItemPage(teaser: OnDemandTeaserModel): Promise<ItemModel> {
    const url = teaser.links.target.href;
    this.logger.debug(`loadTeaser(): ${url}`);
    return this.http.get(url, { timeout: 30000 }).catch(error => {
      if (this.http.isCancel(error)) {
        throw error;
      } else {
        this.logger.error(`Failed loading compilation @ ${url}: ${error}`);
      }
    });
  }

  /**
   * Returns the first `limit` on-demand video widget data sets from a list of items.
   * Returns less if less contained.
   * @param items
   * @param limit
   */
  private parseOnDemandPlayerWidgets(
    items: ItemModel[],
    limit: number,
  ): OnDemandVideoWidgetModel[] {
    return []
      .concat(...items.map(item => item.widgets))
      .filter(widget => widget.type === WidgetModel.Type.ONDEMAND)
      .slice(0, limit || Infinity);
  }

  private convertPlayerWidgetToStreamInfo(
    playerWidgets: OnDemandVideoWidgetModel,
  ): StreamInfo {
    const streamUrls = [];

    playerWidgets.mediaCollection.embedded._mediaArray.forEach(element => {
      element._mediaStreamArray.forEach(stream => {
        if (Array.isArray(stream._stream)) {
          streamUrls.concat(stream._stream);
        } else {
          streamUrls.push(stream._stream);
        }
      });
    });

    return {
      id: playerWidgets.id,
      title: playerWidgets.title,
      synopsis: playerWidgets.synopsis,
      images: [playerWidgets.image],
      availableTo: playerWidgets.availableTo,
      streams: [],
      streamUrls: streamUrls,
    };
  }
}
