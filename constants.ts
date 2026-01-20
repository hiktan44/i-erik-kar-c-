
export const MODELS = {
  ANALYSIS: 'gemini-3-pro-preview',
  SEARCH: 'gemini-3-flash-preview',
  IMAGE_GEN: 'gemini-3-pro-image-preview',
  IMAGE_EDIT: 'gemini-2.5-flash-image',
  VIDEO_GEN: 'veo-3.1-fast-generate-preview'
};

export const SYSTEM_PROMPTS = {
  PRODUCT_ANALYZER: (lang: string) => `You are an expert e-commerce product specialist. 
  Analyze the provided image and create optimized product content for platforms like Amazon, Etsy, or eBay.
  Prepare all content in ${lang === 'tr' ? 'TURKISH' : 'ENGLISH'}.
  Return the response in this JSON format: title, description, features (array), suggestedPrice, category, and tags (array).`
};
