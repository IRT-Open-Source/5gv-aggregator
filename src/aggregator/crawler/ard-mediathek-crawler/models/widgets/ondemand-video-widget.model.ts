import { ImageModel } from '../image.model';
import { PublicationServiceModel } from '../publication-service.model';
import { WidgetModel } from './widget.model';
import { MediaCollectionModel } from '../media/media-collection.model';
import { PlayerConfigModel } from '../player-config.model';

export class OnDemandVideoWidgetModel extends WidgetModel {
  availableTo: string;
  blockedByFsk: boolean;
  broadcastedOn: string;
  embeddable: boolean;
  geoblocked: boolean;
  image: ImageModel;
  maturityContentRating: string;
  mediaCollection: MediaCollectionModel;
  playerConfig: PlayerConfigModel;
  publicationService: PublicationServiceModel;
  show: {
    id: string;
    title: string;
    image: ImageModel;
  };
  synopsis: string;
  type: 'player_ondemand';
}
