import { LinkModel } from '../link.model';
import { PaginationModel } from '../pagination.model';
import { CompilationTeaserModel } from '../teasers/compilation-teaser.model';
import { EditorialPageTeaserModel } from '../teasers/editorial-page-teaser.model';
import { LiveTeaserModel } from '../teasers/live-teaser.model';
import { OnDemandTeaserModel } from '../teasers/ondemand-teaser.model';
import { PosterTeaserModel } from '../teasers/poster-teaser.model';
import { ShowTeaserModel } from '../teasers/show-teaser.model';
import { WidgetModel } from './widget.model';

export class StageWidgetModel extends WidgetModel {
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
  type: 'stage';
}
