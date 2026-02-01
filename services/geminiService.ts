
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { MODELS, SYSTEM_PROMPTS } from "../constants";
import { ProductContent, AspectRatio, ImageSize } from "../types";

export const analyzeProduct = async (
  images: { data: string; mimeType: string }[],
  context: {
    lang: string;
    productName?: string;
    description?: string;
    technicalDocs?: { data: string; mimeType: string }[];
  }
): Promise<ProductContent> => {
  // Runtime environment variable (Netlify injects this)
  const apiKey = (window as any).ENV_VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set. Please add it to your .env file or Netlify environment variables.');
  }

  const ai = new GoogleGenAI({ apiKey });

  const imageParts = images.map(img => ({
    inlineData: { data: img.data, mimeType: img.mimeType }
  }));

  const docParts = (context.technicalDocs || []).map(doc => ({
    inlineData: { data: doc.data, mimeType: doc.mimeType }
  }));

  let promptText = `Analyze these product images comprehensively for e-commerce. Create a professional listing by combining details from all images. If possible, add competitive pricing details based on current market trends. Return results in ${context.lang === 'tr' ? 'Turkish' : 'English'}.`;

  if (context.productName) {
    promptText += `\nProduct Name: ${context.productName}`;
  }
  if (context.description) {
    promptText += `\nAdditional User Description: ${context.description}`;
  }
  if (docParts.length > 0) {
    promptText += `\nRefer to the attached technical documents for specifications.`;
  }

  try {
    const response = await ai.models.generateContent({
      model: MODELS.ANALYSIS,
      contents: {
        parts: [
          ...imageParts,
          ...docParts,
          { text: promptText }
        ]
      },
      config: {
        systemInstruction: SYSTEM_PROMPTS.PRODUCT_ANALYZER(context.lang),
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

    const result = JSON.parse(response.text || '{}');
    console.log('✅ Product analysis successful:', result);
    return result;
  } catch (error: any) {
    console.error('❌ Product analysis failed:', {
      message: error.message,
      status: error.status,
      statusText: error.statusText,
      details: error.details || error.error,
      fullError: error
    });

    // Kullanıcı dostu hata mesajları
    let userMessage = 'Ürün analiz edilemedi. ';

    if (error.message?.includes('API key')) {
      userMessage += 'API anahtarı geçersiz. Lütfen .env dosyasını kontrol edin.';
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      userMessage += 'API kullanım limitine ulaşıldı. Lütfen daha sonra tekrar deneyin.';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      userMessage += 'İnternet bağlantınızı kontrol edin.';
    } else if (error.status === 400) {
      userMessage += 'Geçersiz istek. Lütfen resim formatını kontrol edin.';
    } else if (error.status === 403) {
      userMessage += 'API erişim izni yok. API anahtarınızı kontrol edin.';
    } else if (error.status === 404) {
      userMessage += 'Model bulunamadı. Lütfen model adını kontrol edin.';
    } else if (error.status === 500) {
      userMessage += 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
    } else {
      userMessage += `Hata: ${error.message || 'Bilinmeyen hata'}`;
    }

    throw new Error(userMessage);
  }
};

export const generateProductImage = async (
  basePrompt: string,
  aspectRatio: AspectRatio = AspectRatio.SQUARE,
  imageSize: ImageSize = ImageSize.K1
): Promise<string> => {
  const apiKey = (window as any).ENV_VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });

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
    // Handle both naming conventions: inlineData (camelCase) and inline_data (snake_case)
    const imageData = (part as any).inlineData || (part as any).inline_data;
    if (imageData) {
      return `data:image/png;base64,${imageData.data}`;
    }
  }
  throw new Error("Failed to generate image");
};

export const editProductImage = async (
  imageBase64: string,
  mimeType: string,
  editPrompt: string
): Promise<string> => {
  // Gemini 3.0 Pro resim düzenleme desteklemiyor
  // Bunun yerine Pollinations.ai kullanıyoruz (free & high quality)

  const styleSuffix = "professional product photography, cinematic lighting, 8k resolution, highly detailed, commercial aesthetics, sharp focus, hyperrealistic, studio quality";
  const finalPrompt = `${editPrompt}, ${styleSuffix}`;

  const seed = Math.floor(Math.random() * 1000000);
  const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(finalPrompt)}?width=1024&height=1024&seed=${seed}&nologo=true`;

  // Görseli fetch edip base64'e çevir
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error("Failed to generate image from Pollinations.ai");
  }

  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const generateProductVideo = async (
  imageBase64: string,
  mimeType: string,
  prompt: string,
  duration: '5s' | '12s' = '5s',
  musicStyle: string = 'None',
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<string> => {
  const apiKey = (window as any).ENV_VITE_GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY environment variable is not set.');
  }

  const ai = new GoogleGenAI({ apiKey });

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
  const videoResponse = await fetch(`${downloadLink}&key=${import.meta.env.VITE_GEMINI_API_KEY}`);
  const blob = await videoResponse.blob();
  return URL.createObjectURL(blob);
};
