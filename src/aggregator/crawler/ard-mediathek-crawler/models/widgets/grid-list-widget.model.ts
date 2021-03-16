import { CompilationTeaserModel } from '../teasers/compilation-teaser.model';
import { EditorialPageTeaserModel } from '../teasers/editorial-page-teaser.model';
import { LiveTeaserModel } from '../teasers/live-teaser.model';
import { OnDemandTeaserModel } from '../teasers/ondemand-teaser.model';
import { PosterTeaserModel } from '../teasers/poster-teaser.model';
import { ShowTeaserModel } from '../teasers/show-teaser.model';
import { StageWidgetModel } from './stage-widget.model';
import { WidgetModel } from './widget.model';

export class GridListWidgetModel extends WidgetModel {
  compilationType: string;
  teasers: (
    | CompilationTeaserModel
    | EditorialPageTeaserModel
    | LiveTeaserModel
    | OnDemandTeaserModel
    | PosterTeaserModel
    | ShowTeaserModel
  )[];
  titleVisible: boolean;
  size: string;
  swipeable: boolean;
  type: 'gridlist';
}
