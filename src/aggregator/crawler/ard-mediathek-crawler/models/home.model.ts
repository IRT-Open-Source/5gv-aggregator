import { GridListWidgetModel } from './widgets/grid-list-widget.model';
import { LinkModel } from './link.model';
import { StageWidgetModel } from './widgets/stage-widget.model';
import { TrackingModel } from './tracking.model';

export class HomeModel {
  id: string;
  isChildContent: boolean;
  personalized: boolean;
  links: {
    [key: string]: LinkModel;
  };
  title: 'ARD Mediathek · Start';
  tracking: TrackingModel;
  widgets: (StageWidgetModel | GridListWidgetModel)[];
}
