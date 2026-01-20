
import React, { useState, useRef } from 'react';
import { 
  analyzeProduct, 
  generateProductImage, 
  editProductImage, 
  generateProductVideo 
} from './services/geminiService';
import { ProductContent, ImageAsset, AspectRatio, ImageSize } from './types';
import LoadingOverlay from './components/LoadingOverlay';
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import JSZip from "jszip";
import { translations } from './i18n';

const AiLogo = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M35 25L15 40V60L35 75L50 60V40L35 25Z" fill="#00A3FF" fillOpacity="0.85" />
    <path d="M35 25L50 40V60L35 75L20 60V40L35 25Z" fill="#0085CC" fillOpacity="0.4" />
    <path d="M65 25L85 40V60L65 75L50 60V40L65 25Z" fill="#FF8A00" fillOpacity="0.85" />
    <path d="M65 25L50 40V60L65 75L80 60V40L65 25Z" fill="#CC6E00" fillOpacity="0.4" />
    <path d="M50 25L65 40V60L50 75L35 60V40L50 25Z" fill="white" />
    <path d="M50 25L60 35H40L50 25Z" fill="#333333" />
    <path d="M50 75L60 65H40L50 75Z" fill="#333333" />
    <text x="50" y="54" dominantBaseline="middle" textAnchor="middle" fill="#000000" fontSize="18" fontWeight="900" fontFamily="Plus Jakarta Sans, sans-serif">AI</text>
  </svg>
);

interface UploadSlot {
  id: string;
  dataUrl: string;
  file: File;
}

const App: React.FC = () => {
  const [lang, setLang] = useState<'tr' | 'en'>('tr');
  const t = translations[lang];

  const [loading, setLoading] = useState<string | null>(null);
  const [productContent, setProductContent] = useState<ProductContent | null>(null);
  const [images, setImages] = useState<ImageAsset[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [editPrompt, setEditPrompt] = useState('');
  
  // Yeni oluşturulan görsel önizlemesi
  const [pendingGeneratedImage, setPendingGeneratedImage] = useState<string | null>(null);
  
  const [showImagePrompt, setShowImagePrompt] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [imageAltText, setImageAltText] = useState('');
  
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [imageSize, setImageSize] = useState<ImageSize>(ImageSize.K1);

  // Yükleme slotları
  const [uploadSlots, setUploadSlots] = useState<UploadSlot[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagePromptRef = useRef<HTMLDivElement>(null);
  const productCardRef = useRef<HTMLDivElement>(null);

  const handleResetApp = () => {
    if (window.confirm(t.resetConfirm)) {
      setProductContent(null);
      setImages([]);
      setSelectedImageIndex(0);
      setEditPrompt('');
      setShowImagePrompt(false);
      setImagePrompt('');
      setImageAltText('');
      setVideoUrl(null);
      setUploadSlots([]);
      setPendingGeneratedImage(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newSlots: UploadSlot[] = [];
    for (const file of files) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newSlots.push({ id: Math.random().toString(), dataUrl, file });
    }

    setUploadSlots(prev => [...prev, ...newSlots]);
    e.target.value = '';
  };

  const clearSlot = (id: string) => {
    setUploadSlots(prev => prev.filter(s => s.id !== id));
  };

  const deleteThumbnail = (index: number) => {
    if (window.confirm(lang === 'tr' ? "Görseli silmek istediğinize emin misiniz?" : "Are you sure you want to delete this image?")) {
      setImages(prev => {
        const next = [...prev];
        next.splice(index, 1);
        if (selectedImageIndex >= next.length) {
          setSelectedImageIndex(Math.max(0, next.length - 1));
        }
        return next;
      });
    }
  };

  const triggerAnalysis = async () => {
    if (uploadSlots.length === 0) {
      alert(lang === 'tr' ? "Lütfen en az bir resim yükleyin." : "Please upload at least one image.");
      return;
    }

    setLoading(t.analyzing);
    try {
      const imagesToAnalyze = uploadSlots.map(s => ({
        data: s.dataUrl.split(',')[1],
        mimeType: s.file.type
      }));

      const content = await analyzeProduct(imagesToAnalyze, lang);
      setProductContent(content);
      
      const initialAssets: ImageAsset[] = uploadSlots.map((s, idx) => ({
        id: `init-${idx}-${Date.now()}`,
        url: s.dataUrl,
        type: 'original',
        altText: `${content.title} - ${lang === 'tr' ? 'Ürün Görseli' : 'Product Image'} ${idx + 1}`
      }));

      setImages(initialAssets);
      setSelectedImageIndex(0);
      setImagePrompt(content.title);
      setImageAltText(content.title);
    } catch (error) {
      console.error("Analysis error", error);
      alert(lang === 'tr' ? "Ürün analiz edilemedi. Lütfen tekrar deneyin." : "Could not analyze product. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  const handleCopyContent = () => {
    if (!productContent) return;
    const text = `${lang === 'tr' ? 'Başlık' : 'Title'}: ${productContent.title}\n${lang === 'tr' ? 'Kategori' : 'Category'}: ${productContent.category}\n${lang === 'tr' ? 'Önerilen Fiyat' : 'Suggested Price'}: ${productContent.suggestedPrice}\n\n${lang === 'tr' ? 'Açıklama' : 'Description'}:\n${productContent.description}\n\n${lang === 'tr' ? 'Önemli Özellikler' : 'Key Features'}:\n${productContent.features.map(f => `- ${f}`).join('\n')}\n\n${lang === 'tr' ? 'Etiketler' : 'Tags'}: ${productContent.tags.join(', ')}`;
    navigator.clipboard.writeText(text);
    alert(t.copySuccess);
  };

  const exportPDF = () => {
    if (!productContent) return;
    const doc = new jsPDF();
    doc.setTextColor(0, 0, 0); 
    const margin = 20;
    let y = margin;
    doc.setFontSize(22);
    doc.text(productContent.title, margin, y);
    y += 10;
    doc.setFontSize(12);
    doc.text(`${lang === 'tr' ? 'Kategori' : 'Category'}: ${productContent.category}`, margin, y);
    y += 7;
    doc.text(`${lang === 'tr' ? 'Fiyat' : 'Price'}: ${productContent.suggestedPrice}`, margin, y);
    y += 15;
    doc.setFontSize(14);
    doc.text(lang === 'tr' ? "Açıklama:" : "Description:", margin, y);
    y += 7;
    doc.setFontSize(10);
    const splitDesc = doc.splitTextToSize(productContent.description, 170);
    doc.text(splitDesc, margin, y);
    y += (splitDesc.length * 5) + 10;
    doc.setFontSize(14);
    doc.text(lang === 'tr' ? "Özellikler:" : "Features:", margin, y);
    y += 7;
    doc.setFontSize(10);
    productContent.features.forEach(f => {
      doc.text(`- ${f}`, margin + 5, y);
      y += 5;
    });
    y += 10;
    doc.text(`${lang === 'tr' ? 'Etiketler' : 'Tags'}: ${productContent.tags.join(', ')}`, margin, y);
    doc.save(`${productContent.title.replace(/\s+/g, '_')}_listing.pdf`);
  };

  const exportCardAsPNG = async () => {
    if (!productCardRef.current) return;
    setLoading(t.preparingExport);
    try {
      const canvas = await html2canvas(productCardRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        onclone: (clonedDoc) => {
          // Clone içindeki tüm metinleri zorla siyah yap
          const allText = clonedDoc.querySelectorAll('*');
          allText.forEach((el) => {
            (el as HTMLElement).style.color = '#000000';
            (el as HTMLElement).style.opacity = '1';
          });
        }
      });
      const url = canvas.toDataURL("image/png");
      const link = document.createElement('a');
      link.href = url;
      link.download = `${productContent?.title.replace(/\s+/g, '_')}_card.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadAllImages = async () => {
    if (images.length === 0) return;
    setLoading(t.preparingExport);
    try {
      const zip = new JSZip();
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const base64Data = img.url.split(',')[1];
        zip.file(`product-image-${i + 1}.png`, base64Data, { base64: true });
      }
      const content = await zip.generateAsync({ type: 'blob' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `${productContent?.title.replace(/\s+/g, '_') || 'product'}_all_images.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("ZIP error", error);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadImage = (imageUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `${fileName}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateVariations = async () => {
    if (!productContent || !imagePrompt) return;
    setLoading(t.studioLights);
    try {
      const newUrl = await generateProductImage(imagePrompt, aspectRatio, imageSize);
      setPendingGeneratedImage(newUrl);
      setShowImagePrompt(false);
    } catch (error) {
      console.error("Gen error", error);
      alert(lang === 'tr' ? "Varyasyon oluşturulamadı." : "Could not generate variation.");
    } finally {
      setLoading(null);
    }
  };

  const addPendingToGallery = () => {
    if (!pendingGeneratedImage || !productContent) return;
    const newAsset: ImageAsset = {
      id: Date.now().toString(),
      url: pendingGeneratedImage,
      type: 'generated',
      prompt: imagePrompt,
      altText: imageAltText || productContent.title
    };
    setImages(prev => [...prev, newAsset]);
    setSelectedImageIndex(images.length);
    setPendingGeneratedImage(null);
    setImageAltText('');
  };

  const handleEditImage = async () => {
    const currentImg = images[selectedImageIndex];
    if (!currentImg || !editPrompt) return;

    setLoading(t.pixelsProcessing);
    try {
      const base64 = currentImg.url.split(',')[1];
      const mimeType = "image/png";
      const editedUrl = await editProductImage(base64, mimeType, editPrompt);
      
      setImages(prev => {
        const next = [...prev];
        next[selectedImageIndex] = { ...currentImg, url: editedUrl };
        return next;
      });
      setEditPrompt('');
    } catch (error) {
      console.error("Edit error", error);
      alert(lang === 'tr' ? "Resim düzenlenemedi." : "Could not edit image.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen pb-20 text-black bg-white">
      {loading && <LoadingOverlay message={loading} />}

      <header className="glass-card sticky top-0 z-40 border-b border-white/20">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AiLogo size={48} />
            <div>
              <h1 className="text-xl font-extrabold text-black tracking-tight">{t.appTitle}</h1>
              <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{t.ecommerceIntel}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
               <button 
                 onClick={() => setLang('tr')}
                 className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'tr' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 TR
               </button>
               <button 
                 onClick={() => setLang('en')}
                 className={`px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${lang === 'en' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
               >
                 EN
               </button>
            </div>
            {productContent && (
              <button 
                onClick={handleResetApp}
                className="bg-white/80 hover:bg-red-50 text-black hover:text-red-600 px-5 py-2.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2 border border-slate-200 shadow-sm"
              >
                {t.newProduct}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {!productContent ? (
          <div className="flex flex-col items-center justify-center min-h-[75vh] text-center space-y-12 animate-in fade-in zoom-in-95 duration-700">
            <div className="space-y-4">
              <h2 className="text-5xl font-[900] text-black tracking-tight leading-tight">
                {t.heroTitle.split(' ').map((word, i) => (word === 'Yapay' || word === 'AI') ? <span key={i} className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">{word} </span> : word + ' ')}
              </h2>
              <p className="text-black max-w-xl mx-auto text-lg font-bold leading-relaxed">
                {t.heroDesc}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6 w-full max-w-6xl">
              {uploadSlots.map((slot) => (
                <div key={slot.id} className="relative aspect-square">
                  <div className="w-full h-full rounded-[2rem] overflow-hidden border-4 border-white group relative shadow-xl transition-transform hover:scale-[1.02]">
                    <img src={slot.dataUrl} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={() => clearSlot(slot.id)}
                        className="bg-white text-red-600 p-2.5 rounded-xl shadow-xl hover:scale-110 active:scale-95 transition-all"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square w-full border-2 border-dashed border-slate-400 rounded-[2rem] flex flex-col items-center justify-center gap-2 hover:border-blue-500 hover:bg-blue-50/50 transition-all group bg-white/50"
              >
                <svg className="w-8 h-8 text-black group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-[10px] font-black text-black uppercase tracking-widest">{t.addImg}</span>
              </button>
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden" 
                accept="image/*" 
                multiple
              />
            </div>

            <div className="pt-4">
              <button 
                onClick={triggerAnalysis}
                className="group relative bg-black text-white px-14 py-6 rounded-full font-black text-xl shadow-2xl hover:bg-blue-600 hover:-translate-y-1 active:translate-y-0 transition-all flex items-center gap-4 disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden"
                disabled={uploadSlots.length === 0}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <span className="relative z-10">{t.startAnalysis}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in slide-in-from-bottom-8 duration-1000">
            <div className="space-y-10">
              <div className="glass-card p-4 rounded-[3rem] shadow-2xl relative group overflow-hidden">
                <div className="aspect-square rounded-[2.5rem] overflow-hidden bg-white/40 border border-white/50 relative">
                  {images[selectedImageIndex] && (
                    <img src={images[selectedImageIndex].url} alt={images[selectedImageIndex].altText} className="w-full h-full object-contain p-6" />
                  )}
                  {pendingGeneratedImage && (
                    <div className="absolute inset-0 bg-white/90 z-30 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-500">
                      <p className="text-black font-black uppercase text-xs mb-4">Yeni Görsel Önizleme</p>
                      <img src={pendingGeneratedImage} className="max-w-[80%] max-h-[70%] rounded-2xl shadow-2xl border-4 border-white mb-6" />
                      <div className="flex gap-4">
                        <button onClick={() => setPendingGeneratedImage(null)} className="px-6 py-3 text-black font-black text-sm uppercase">{t.cancel}</button>
                        <button 
                          onClick={addPendingToGallery}
                          className="bg-black text-white px-8 py-3 rounded-full font-black flex items-center gap-2 shadow-xl hover:scale-105 transition-transform"
                        >
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4" /></svg>
                          Galeriye Ekle
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-5 overflow-x-auto pb-4 scrollbar-hide px-2">
                  {images.map((img, idx) => (
                    <div key={img.id} className="relative shrink-0 group/thumb">
                      <button 
                        onClick={() => setSelectedImageIndex(idx)} 
                        className={`w-28 h-28 rounded-3xl overflow-hidden border-4 transition-all ${selectedImageIndex === idx ? 'border-blue-500 scale-110 shadow-lg' : 'border-white'}`}
                      >
                        <img src={img.url} className="w-full h-full object-cover" />
                      </button>
                      <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover/thumb:opacity-100 transition-opacity z-20">
                         <button 
                           onClick={(e) => { e.stopPropagation(); deleteThumbnail(idx); }}
                           className="bg-white text-red-600 p-1.5 rounded-lg shadow-lg border border-red-50 hover:bg-red-50"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                         </button>
                         <button 
                           onClick={(e) => { e.stopPropagation(); handleDownloadImage(img.url, `ai-img-${idx}`); }}
                           className="bg-white text-blue-600 p-1.5 rounded-lg shadow-lg border border-blue-50 hover:bg-blue-50"
                         >
                           <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                         </button>
                      </div>
                    </div>
                  ))}
                  <button 
                    onClick={() => setShowImagePrompt(!showImagePrompt)}
                    className={`w-28 h-28 rounded-3xl border-4 border-dashed shrink-0 flex items-center justify-center transition-all bg-white/50 hover:bg-blue-50/50 ${showImagePrompt ? 'border-blue-500 text-blue-600' : 'border-slate-400 text-black'}`}
                  >
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  </button>
                </div>
                
                <div className="flex gap-4">
                  {images.length > 0 && (
                    <button 
                      onClick={handleDownloadAllImages}
                      className="flex items-center gap-2 text-[10px] font-black text-black bg-white/50 hover:bg-white px-4 py-2 rounded-xl border border-white transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      {t.downloadAll}
                    </button>
                  )}
                </div>

                {showImagePrompt && (
                  <div className="glass-card p-8 rounded-[2.5rem] space-y-5 shadow-xl border border-blue-100">
                    <h4 className="font-black text-black text-xl">{t.imagePromptLabel}</h4>
                    <textarea 
                      placeholder={t.imagePromptPlaceholder}
                      className="w-full bg-white border border-slate-300 rounded-3xl px-6 py-5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 text-black"
                      rows={3}
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                    />
                    <input 
                      type="text" 
                      placeholder={t.imageAltPlaceholder}
                      className="w-full bg-white border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 text-black"
                      value={imageAltText}
                      onChange={(e) => setImageAltText(e.target.value)}
                    />
                    <div className="flex justify-end gap-3">
                      <button onClick={() => setShowImagePrompt(false)} className="px-8 py-3 text-sm font-black text-black">{t.cancel}</button>
                      <button onClick={handleGenerateVariations} className="bg-blue-600 text-white px-10 py-3 rounded-full text-sm font-black shadow-lg shadow-blue-500/20">{t.startProduction}</button>
                    </div>
                  </div>
                )}

                <div className="glass-card p-8 rounded-[2.5rem] space-y-6 shadow-xl">
                  <span className="text-[11px] font-[900] text-black uppercase tracking-[0.2em]">{t.quickEdit}</span>
                  <div className="flex gap-4">
                    <input 
                      type="text" 
                      placeholder={t.editPlaceholder}
                      className="flex-1 bg-white border border-slate-300 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:ring-2 focus:ring-slate-900/10 text-black"
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                    />
                    <button onClick={handleEditImage} className="bg-black text-white px-10 py-4 rounded-2xl text-sm font-black shadow-lg hover:bg-slate-800 transition-colors">{t.apply}</button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div 
                ref={productCardRef} 
                className="glass-card p-12 rounded-[3.5rem] shadow-2xl space-y-10 sticky top-28 border border-white text-black"
                style={{ color: '#000000', backgroundColor: '#ffffff' }}
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-4">
                    <span className="inline-block bg-blue-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase shadow-lg shadow-blue-500/20">{productContent.category}</span>
                    <h2 className="text-4xl font-[900] text-black tracking-tight leading-tight">{productContent.title}</h2>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleCopyContent} className="p-3 bg-white border border-slate-100 rounded-2xl text-black shadow-sm hover:bg-slate-50 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></button>
                    <div className="relative group/export">
                       <button className="p-3 bg-white border border-slate-100 rounded-2xl text-black shadow-sm hover:bg-slate-50 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg></button>
                       <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-2xl opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all p-2 space-y-1 z-50 border border-slate-100">
                         <button onClick={exportPDF} className="w-full text-left px-4 py-2 text-xs font-black hover:bg-slate-50 rounded-lg text-black">{t.exportPdf}</button>
                         <button onClick={exportCardAsPNG} className="w-full text-left px-4 py-2 text-xs font-black hover:bg-slate-50 rounded-lg text-black">{t.exportPng}</button>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex items-center justify-between shadow-inner">
                  <div className="text-3xl font-[900] text-blue-600">{productContent.suggestedPrice}</div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-blue-900 uppercase">{t.suggestedPrice}</p>
                    <p className="text-xs font-black text-black italic">{t.marketAverage}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-black text-black uppercase tracking-widest flex items-center gap-2"><span className="w-6 h-0.5 bg-black"></span>{t.productStory}</h3>
                  <p className="text-black leading-[1.7] text-lg font-black">{productContent.description}</p>
                </div>

                <div className="space-y-6">
                  <h3 className="text-xs font-black text-black uppercase tracking-widest flex items-center gap-2"><span className="w-6 h-0.5 bg-black"></span>{t.topFeatures}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {productContent.features.map((f, i) => (
                      <div key={i} className="flex gap-4 text-sm font-bold text-black bg-white/60 p-5 rounded-3xl border border-white shadow-sm">{f}</div>
                    ))}
                  </div>
                </div>

                <div className="pt-10 border-t border-slate-100 flex justify-between items-center">
                   <div className="flex gap-4">
                      <div className="space-y-2"><label className="text-[10px] uppercase font-black block text-black">{t.format}</label><select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black outline-none text-black"><option value="1:1">1:1</option><option value="16:9">16:9</option></select></div>
                      <div className="space-y-2"><label className="text-[10px] uppercase font-black block text-black">{t.quality}</label><select value={imageSize} onChange={(e) => setImageSize(e.target.value as ImageSize)} className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black outline-none text-black"><option value="1K">1K</option><option value="2K">2K</option></select></div>
                   </div>
                   <div className="text-right"><p className="text-[10px] font-black text-black uppercase tracking-widest">AI Engine</p><p className="text-xs font-bold text-black">Gemini 3.0 Pro</p></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
