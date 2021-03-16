import { LinkModel } from '../link.model';
import { PaginationModel } from '../pagination.model';

export class WidgetModel {
  id: string;
  isChildContent: boolean;
  pagination: PaginationModel;
  personalized: boolean;
  links: {
    [key: string]: LinkModel;
  };
  title: string;
  type: string;

  static Type = {
    STAGE: 'stage',
    ONDEMAND: 'player_ondemand',
    GRIDLIST: 'gridlist',
  };
}
