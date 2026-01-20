
export interface ProductContent {
  title: string;
  description: string;
  features: string[];
  suggestedPrice: string;
  category: string;
  tags: string[];
}

export interface ImageAsset {
  id: string;
  url: string;
  type: 'original' | 'generated';
  prompt?: string;
  altText?: string;
}

export interface VideoAsset {
  id: string;
  url: string;
  thumbnailUrl: string;
}

export enum AspectRatio {
  SQUARE = '1:1',
  LANDSCAPE = '16:9',
  PORTRAIT = '9:16',
  THREE_FOUR = '3:4',
  FOUR_THREE = '4:3'
}

export enum ImageSize {
  K1 = '1K',
  K2 = '2K',
  K4 = '4K'
}
