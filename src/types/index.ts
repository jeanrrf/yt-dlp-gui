export interface YtdlpStatus {
  installed: boolean;
  version: string;
  path: string;
}

export interface DenoStatus {
  installed: boolean;
  version: string;
  path: string;
}

export interface DownloadProgress {
  percent: number;
  downloaded: number;
  total: number;
}

export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution: string;
  height: number | null;
  width: number | null;
  fps: number | null;
  vcodec: string;
  acodec: string;
  filesize: number | null;
  filesize_approx: number | null;
  format_note: string;
  tbr: number | null;
  abr: number | null;
}

export interface ExtraOptions {
  embedSubs: boolean;
  embedThumbnail: boolean;
  embedMetadata: boolean;
  noMerge: boolean;
  recodeFormat: string;
  limitRate: string;
}

export interface VideoInfo {
  title: string;
  thumbnail: string;
  duration: number;
  uploader: string;
  view_count: number;
  upload_date: string;
  description: string;
  formats: VideoFormat[];
  subtitles: Record<string, { ext: string; url: string; name?: string }[]>;
  automatic_captions: Record<
    string,
    { ext: string; url: string; name?: string }[]
  >;
}
