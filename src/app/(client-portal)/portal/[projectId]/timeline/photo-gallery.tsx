'use client';

import { useState } from 'react';
import { X, ZoomIn, ChevronLeft, ChevronRight } from 'lucide-react';

export function PhotoGallery({ images }: { images: { id: string; thumbnailUrl: string; fullUrl?: string; description?: string }[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return <p className="text-sm text-gray-500">Belum ada foto progres yang diterbitkan.</p>;
  }

  const openLightbox = (index: number) => setSelectedIndex(index);
  const closeLightbox = () => setSelectedIndex(null);
  
  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };
  
  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (selectedIndex !== null && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        {images.slice(0, 6).map((img, idx) => (
          <button 
            key={img.id} 
            onClick={() => openLightbox(idx)}
            className="group relative aspect-square overflow-hidden rounded-lg bg-[#2A2A2A] w-full text-left focus:outline-none focus:ring-2 focus:ring-white/50"
          >
            {img.thumbnailUrl && (
              <img src={img.thumbnailUrl} alt="Bukti progres" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110" />
            )}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300 flex items-center justify-center">
              <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" size={24} />
            </div>
          </button>
        ))}
      </div>

      {selectedIndex !== null && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          <div className="absolute top-4 right-4 z-50">
            <button 
              onClick={closeLightbox}
              className="p-2 text-gray-400 hover:text-white bg-black/50 rounded-full transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="relative w-full h-full max-w-5xl max-h-[80vh] flex flex-col items-center justify-center p-4">
            {selectedIndex > 0 && (
              <button 
                onClick={handlePrev}
                className="absolute left-4 p-3 text-gray-400 hover:text-white bg-black/50 rounded-full transition-colors z-50"
              >
                <ChevronLeft size={32} />
              </button>
            )}
            
            <img 
              src={images[selectedIndex]?.fullUrl || images[selectedIndex]?.thumbnailUrl} 
              alt="Foto Diperbesar" 
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            {images[selectedIndex]?.description && (
              <div 
                className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-lg w-full bg-black/80 backdrop-blur-md p-4 rounded-xl text-center"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-sm text-white">{images[selectedIndex]?.description}</p>
              </div>
            )}
            
            {selectedIndex < images.length - 1 && (
              <button 
                onClick={handleNext}
                className="absolute right-4 p-3 text-gray-400 hover:text-white bg-black/50 rounded-full transition-colors z-50"
              >
                <ChevronRight size={32} />
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
