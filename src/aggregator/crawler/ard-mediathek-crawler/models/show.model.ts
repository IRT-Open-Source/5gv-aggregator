import { HomepageReferenceModel } from './homepage-reference.model';
import { ImageModel } from './image.model';
import { PublicationServiceModel } from './publication-service.model';

export class ShowModel {
  id: string;
  coremediaId: number;
  title: string;
  publisher: PublicationServiceModel;
  self: null;
  images: {
    [key: string]: ImageModel;
  };
  shortSynopsis: string;
  synopsis: string;
  longSynopsis: string;
  modificationDate: string;
  assetSource: null;
  groupingType: string;
  homepage: HomepageReferenceModel;
  hasSeasons: boolean;
  seriesDetail: null;
  isChildContent: boolean;
}
