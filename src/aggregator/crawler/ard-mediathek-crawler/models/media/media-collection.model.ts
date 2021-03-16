import { MediaItemModel } from './media-item.model';

export class MediaCollectionModel {
  embedded: {
    _type: string;
    _isLive: boolean;
    _defaultQuality: ('auto' | number)[];
    _previewImage: string;
    _subtitleOffset: number;
    _mediaArray: MediaItemModel[];
    _alternativeMediaArray: MediaItemModel[];
    _sortierArray: number[];
    _duration: number;
    _dvrEnabled: boolean;
    _geoblocked: boolean;
  };
  href: string;
}
