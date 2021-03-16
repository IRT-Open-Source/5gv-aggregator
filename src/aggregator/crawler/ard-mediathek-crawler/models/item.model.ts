import { LinkModel } from './link.model';
import { TrackingModel } from './tracking.model';

export class ItemModel {
  fskRating: string;
  id: string;
  isChildContent: boolean;
  personalized: boolean;
  links: {
    [key: string]: LinkModel;
  };
  title: string;
  tracking: TrackingModel;
  widgets: [];
}
