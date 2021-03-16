import { ImageModel } from '../image.model';
import { LinkModel } from '../link.model';

export class TeaserModel {
  id: string;
  images: {
    [key: string]: ImageModel;
  };
  isChildContent: boolean;
  longTitle: string;
  mediumTitle: string;
  personalized: boolean;
  playtime: number;
  links: {
    [key: string]: LinkModel;
  };
  shortTitle: string;
  titleVisible: boolean;
  type: string;

  static Type = {
    SHOW: 'show',
    POSTER: 'poster',
    ONDEMAND: 'ondemand',
    LIVE: 'live',
    COMPILATION: 'compilation',
    EDITORIAL_PAGE: 'editorialPage',
  };
}
