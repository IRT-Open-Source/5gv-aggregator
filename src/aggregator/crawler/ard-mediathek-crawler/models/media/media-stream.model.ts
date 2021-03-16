export class MediaStreamModel {
  _quality: 'auto' | number;
  _server?: string;
  _cdn?: string;
  _width?: number;
  _height?: number;
  _stream: string | string[];
}
