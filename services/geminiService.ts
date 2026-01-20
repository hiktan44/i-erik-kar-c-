
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { MODELS, SYSTEM_PROMPTS } from "../constants";
import { ProductContent, AspectRatio, ImageSize } from "../types";

export const analyzeProduct = async (images: { data: string; mimeType: string }[], lang: string = 'tr'): Promise<ProductContent> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const imageParts = images.map(img => ({
    inlineData: { data: img.data, mimeType: img.mimeType }
  }));

  const response = await ai.models.generateContent({
    model: MODELS.ANALYSIS,
    contents: {
      parts: [
        ...imageParts,
        { text: `Analyze these product images comprehensively for e-commerce. Create a professional listing by combining details from all images. If possible, add competitive pricing details based on current market trends. Return results in ${lang === 'tr' ? 'Turkish' : 'English'}.` }
      ]
    },
    config: {
      systemInstruction: SYSTEM_PROMPTS.PRODUCT_ANALYZER(lang),
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          features: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedPrice: { type: Type.STRING },
          category: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["title", "description", "features", "suggestedPrice", "category", "tags"]
      }
    }
  });

  return JSON.parse(response.text || '{}');
};

export const generateProductImage = async (
  basePrompt: string, 
  aspectRatio: AspectRatio = AspectRatio.SQUARE,
  imageSize: ImageSize = ImageSize.K1
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const response = await ai.models.generateContent({
    model: MODELS.IMAGE_GEN,
    contents: {
      parts: [{ text: `Professional studio e-commerce photography: ${basePrompt}. High quality, clean background, product photography style.` }]
    },
    config: {
      imageConfig: {
        aspectRatio,
        imageSize
      }
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to generate image");
};

export const editProductImage = async (
  imageBase64: string, 
  mimeType: string, 
  editPrompt: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const response = await ai.models.generateContent({
    model: MODELS.IMAGE_EDIT,
    contents: {
      parts: [
        { inlineData: { data: imageBase64, mimeType } },
        { text: `Edit the image according to this instruction: ${editPrompt}` }
      ]
    }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
  }
  throw new Error("Failed to edit image");
};

export const generateProductVideo = async (
  imageBase64: string, 
  mimeType: string,
  prompt: string,
  duration: '5s' | '12s' = '5s',
  musicStyle: string = 'None',
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  const enhancedPrompt = `Product promotion: ${prompt}. ${musicStyle !== 'None' ? `Music style: ${musicStyle}.` : ''} Professional e-commerce ad, smooth camera movements.`;

  let operation = await ai.models.generateVideos({
    model: MODELS.VIDEO_GEN,
    prompt: enhancedPrompt,
    image: {
      imageBytes: imageBase64,
      mimeType
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio
    }
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  if (duration === '12s') {
    const previousVideo = operation.response?.generatedVideos?.[0]?.video;
    
    operation = await ai.models.generateVideos({
      model: 'veo-3.1-generate-preview',
      prompt: "Video continues, keep showing the product from different angles.",
      video: previousVideo,
      config: {
        numberOfVideos: 1,
        resolution: '720p',
        aspectRatio: aspectRatio,
      }
    });

    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 10000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};
