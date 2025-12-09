import React, { useEffect, useState } from 'react';
import { CaptureItem } from '../types';

interface AutocompleteOverlayProps {
  visible: boolean;
  matches: CaptureItem[];
  position: { top: number; left: number };
  onSelect: (content: string) => void;
  onClose: () => void;
}

export const AutocompleteOverlay: React.FC<AutocompleteOverlayProps> = ({
  visible,
  matches,
  position,
  onSelect,
  onClose
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [matches]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!visible) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % matches.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + matches.length) % matches.length);
      } else if (e.key === 'Tab' || e.key === 'Enter') {
        e.preventDefault();
        if (matches[selectedIndex]) {
          onSelect(matches[selectedIndex].content);
        }
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [visible, matches, selectedIndex, onSelect, onClose]);

  if (!visible || matches.length === 0) return null;

  return (
    <div 
      className="fixed z-[9999] w-96 bg-brand-surface border border-brand-accent/30 rounded-lg shadow-2xl overflow-hidden text-brand-text font-sans"
      style={{ top: position.top, left: position.left }}
    >
      <div className="bg-brand-accent/10 px-3 py-2 text-xs font-bold text-brand-accent border-b border-brand-accent/20 flex justify-between items-center">
        <span>SUGGESTED PROMPTS</span>
        <span className="text-[10px] opacity-70">TAB to select</span>
      </div>
      <div className="max-h-60 overflow-y-auto custom-scrollbar">
        {matches.map((item, idx) => (
          <div
            key={item.id}
            onClick={() => onSelect(item.content)}
            className={`px-4 py-3 cursor-pointer border-b border-white/5 text-sm transition-colors duration-150 ${
              idx === selectedIndex 
                ? 'bg-brand-accent text-white' 
                : 'hover:bg-white/5 text-brand-muted'
            }`}
          >
            <p className="line-clamp-2">{item.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
};