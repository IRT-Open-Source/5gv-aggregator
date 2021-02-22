export class StreamInfo {
  id: string;
  title: string;
  synopsis: string;
  availableTo: string;
  images: Array<{
    alt: string;
    src: string;
    title: string;
  }>;
  streams: Array<{
    url: string;
    type: 'mp4' | 'hls' | 'dash' | 'f4m';
  }>;
  streamUrls: string[];
}
