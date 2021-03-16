import { LinkModel } from '../link.model';
import { PublicationServiceModel } from '../publication-service.model';
import { ShowModel } from '../show.model';
import { TeaserModel } from './teaser.model';

export class OnDemandTeaserModel extends TeaserModel {
  availableTo: string;
  broadcastedOn: string;
  decor: string;
  duration: number;
  maturityContentRating: string;
  publicationService: PublicationServiceModel;
  links: {
    [key in 'self' | 'target']: LinkModel;
  };
  show: ShowModel;
  subtitled: boolean;
  titleVisible: boolean;
  type: 'ondemand';
}
