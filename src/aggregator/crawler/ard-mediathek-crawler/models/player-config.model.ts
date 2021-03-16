export class PlayerConfigModel {
  embedded: {
    _baseUrl: string;
    _baseAssetUrl: string;
    _autoplay: string;
    _showSubtitelAtStart: boolean;
    _solaAnalyticsEnabled: boolean;
    _solaAnalyticsConfig: string;
    _pixelConfig: object[];
  };
  href: string;
}
