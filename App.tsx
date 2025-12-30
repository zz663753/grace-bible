import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BIBLE_BOOKS } from './constants';
import { BibleBook, ReadingProgress, AudioState } from './types';
import { fetchChapterText, generateSpeech, decodeBase64, decodeAudioData } from './geminiService';
import { Play, Pause, CheckCircle, Menu, X, BookOpen, Search, Check, Volume2, Loader2, ChevronRight, List, Type } from 'lucide-react';

const App: React.FC = () => {
  // --- States ---
  const [selectedBook, setSelectedBook] = useState<BibleBook>(BIBLE_BOOKS[0]);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [chapterContent, setChapterContent] = useState<string>('');
  const [progress, setProgress] = useState<ReadingProgress>({});
  const [audioState, setAudioState] = useState<AudioState>(AudioState.IDLE);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [fontSize, setFontSize] = useState(20); // Default font size in px

  // --- Refs ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // --- Persistence ---
  useEffect(() => {
    const savedProgress = localStorage.getItem('bible-progress');
    if (savedProgress) setProgress(JSON.parse(savedProgress));
    
    const savedFontSize = localStorage.getItem('bible-font-size');
    if (savedFontSize) setFontSize(parseInt(savedFontSize, 10));
  }, []);

  useEffect(() => {
    localStorage.setItem('bible-progress', JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    localStorage.setItem('bible-font-size', fontSize.toString());
  }, [fontSize]);

  // --- Data Loading ---
  useEffect(() => {
    const loadContent = async () => {
      setIsLoadingContent(true);
      stopAudio(); 
      try {
        const text = await fetchChapterText(selectedBook.name, selectedChapter);
        setChapterContent(text);
      } catch (error) {
        setChapterContent("載入經文失敗，請檢查 API 設定或網路連線。");
      } finally {
        setIsLoadingContent(false);
      }
    };
    loadContent();
  }, [selectedBook, selectedChapter]);

  // --- Audio Control ---
  const initAudio = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  };

  const playAudio = async () => {
    if (!chapterContent || audioState === AudioState.LOADING) return;
    try {
      setAudioState(AudioState.LOADING);
      initAudio();
      const base64 = await generateSpeech(chapterContent);
      const audioData = decodeBase64(base64);
      const buffer = await decodeAudioData(audioData, audioContextRef.current!);
      
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch(e) {}
      }
      
      const source = audioContextRef.current!.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current!.destination);
      source.onended = () => setAudioState(AudioState.IDLE);
      source.start(0);
      audioSourceRef.current = source;
      setAudioState(AudioState.PLAYING);
    } catch (error) {
      setAudioState(AudioState.ERROR);
      alert("播放失敗，請確認網路或 API_KEY。");
    }
  };

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
      audioSourceRef.current = null;
    }
    setAudioState(AudioState.IDLE);
  }, []);

  // --- Progress Handling ---
  const toggleChapterProgress = (bookId: string, chapter: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProgress(prev => {
      const currentBookChapters = prev[bookId] || [];
      const updated = currentBookChapters.includes(chapter)
        ? currentBookChapters.filter(c => c !== chapter)
        : [...currentBookChapters, chapter];
      return { ...prev, [bookId]: updated };
    });
  };

  const isCompleted = (bookId: string, chapter: number) => {
    return (progress[bookId] || []).includes(chapter);
  };

  const handleChapterClick = (chap: number) => {
    setSelectedChapter(chap);
    if (window.innerWidth < 768) {
      document.getElementById('content-area')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const adjustFontSize = (delta: number) => {
    setFontSize(prev => Math.min(48, Math.max(14, prev + delta)));
  };

  const filteredBooks = BIBLE_BOOKS.filter(b => b.name.includes(sidebarSearch));

  return (
    <div className="flex h-screen w-full bg-[#fdfaf6] text-slate-800 overflow-hidden font-sans">
      {/* Sidebar Overlay (Mobile) */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar / Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-full sm:w-80 bg-white border-r border-slate-200 transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full safe-area-top">
          <div className="p-6 border-b border-slate-100 bg-[#fdfaf6] flex items-center justify-between">
            <h1 className="text-xl font-bold text-amber-900 flex items-center gap-2">
              <BookOpen className="text-amber-600" size={24} />
              恩典聖經 目錄
            </h1>
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-full" onClick={() => setIsSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>

          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="搜尋經卷名稱..." 
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-4 scrollbar-hide">
            {['Old', 'New'].map(testament => (
              <div key={testament} className="px-2">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-2">
                  {testament === 'Old' ? '舊約全書' : '新約全書'}
                </h3>
                <div className="grid grid-cols-1 gap-1">
                  {filteredBooks.filter(b => b.testament === testament).map(book => (
                    <button
                      key={book.id}
                      onClick={() => { setSelectedBook(book); setSelectedChapter(1); setIsSidebarOpen(false); }}
                      className={`flex justify-between items-center px-4 py-3 rounded-xl transition-all ${selectedBook.id === book.id ? 'bg-amber-100 text-amber-950 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span>{book.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">
                          {(progress[book.id] || []).length}/{book.chapters}
                        </span>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Container */}
      <main className="flex-1 flex flex-col h-full bg-[#fdfaf6] relative">
        {/* Sticky Top Header */}
        <header className="flex flex-col bg-white/95 backdrop-blur-md border-b border-slate-200 z-30 shadow-sm safe-area-top">
          <div className="flex items-center justify-between p-2 sm:p-4">
            <div className="flex items-center gap-1 sm:gap-3">
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-xl transition-all active:scale-90"
                title="開啟目錄"
              >
                <List size={22} />
              </button>
              <div className="flex flex-col">
                <h2 className="font-bold text-slate-900 text-sm sm:text-lg leading-tight serif-text truncate max-w-[120px] sm:max-w-none">
                  {selectedBook.name} {selectedChapter}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-3">
              {/* Font Size Adjusters */}
              <div className="flex items-center bg-slate-100 rounded-full px-1 sm:px-2">
                <button onClick={() => adjustFontSize(-2)} className="p-1.5 sm:p-2 text-slate-500 hover:text-amber-900 active:scale-90" title="小字">
                  <span className="text-xs font-bold">A-</span>
                </button>
                <div className="w-[1px] h-4 bg-slate-200"></div>
                <button onClick={() => adjustFontSize(2)} className="p-1.5 sm:p-2 text-slate-500 hover:text-amber-900 active:scale-90" title="大字">
                  <span className="text-sm font-bold">A+</span>
                </button>
              </div>

              {/* Main Play Button */}
              <button 
                onClick={audioState === AudioState.PLAYING ? stopAudio : playAudio}
                disabled={isLoadingContent}
                className={`flex items-center gap-1.5 px-3 sm:px-5 py-2 rounded-full shadow-md transition-all active:scale-95 font-bold text-sm ${
                  audioState === AudioState.PLAYING 
                    ? 'bg-amber-600 text-white' 
                    : 'bg-amber-900 text-white'
                } disabled:opacity-50`}
              >
                {audioState === AudioState.LOADING 
                  ? <Loader2 size={18} className="animate-spin" /> 
                  : audioState === AudioState.PLAYING 
                    ? <Pause size={18} /> 
                    : <Volume2 size={18} />
                }
                <span className="hidden sm:inline">
                  {audioState === AudioState.LOADING ? '處理中' : audioState === AudioState.PLAYING ? '暫停' : '朗讀'}
                </span>
              </button>

              {/* Status Mark Button */}
              <button 
                onClick={() => toggleChapterProgress(selectedBook.id, selectedChapter)}
                className={`p-2 rounded-full transition-all active:scale-90 shadow-sm border ${
                  isCompleted(selectedBook.id, selectedChapter) 
                    ? 'bg-green-500 border-green-600 text-white' 
                    : 'bg-white border-slate-100 text-slate-300'
                }`}
              >
                <Check size={18} strokeWidth={3} />
              </button>
            </div>
          </div>
        </header>

        {/* Content Area - Minimized Padding as requested */}
        <div id="content-area" className="flex-1 overflow-y-auto scroll-smooth">
          <div className="w-full mx-auto px-[2ch] pt-6 pb-32">
            <div className="max-w-4xl mx-auto">
              {isLoadingContent ? (
                <div className="space-y-6 animate-pulse">
                  {[...Array(15)].map((_, i) => (
                    <div key={i} className="h-4 bg-slate-100 rounded-full w-full mb-4"></div>
                  ))}
                </div>
              ) : (
                <article 
                  className={`serif-text text-slate-800 whitespace-pre-wrap transition-all duration-700 ${audioState === AudioState.PLAYING ? 'text-amber-950 font-medium' : ''}`}
                  style={{ fontSize: `${fontSize}px`, lineHeight: 2.2 }}
                >
                  {chapterContent}
                </article>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Navigation for Chapters */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 safe-area-bottom shadow-lg">
          <div className="max-w-6xl mx-auto p-2 sm:p-4">
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x px-1">
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(chap => {
                const completed = isCompleted(selectedBook.id, chap);
                const active = selectedChapter === chap;
                return (
                  <div key={chap} className="relative snap-start shrink-0">
                     <button 
                      onClick={() => handleChapterClick(chap)}
                      className={`
                        w-12 h-12 sm:w-14 sm:h-14 flex items-center justify-center rounded-xl border transition-all active:scale-95
                        ${active ? 'bg-amber-900 border-amber-900 text-white shadow-md' : 'bg-white border-slate-100 text-slate-500'}
                        ${completed && !active ? 'text-green-600 bg-green-50/50 border-green-100' : ''}
                      `}
                    >
                      <span className="font-bold text-sm sm:text-base">{chap}</span>
                    </button>
                    <button 
                      onClick={(e) => toggleChapterProgress(selectedBook.id, chap, e)}
                      className={`
                        absolute -top-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border shadow-sm transition-all z-20
                        ${completed ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-slate-200 text-slate-300'}
                      `}
                    >
                      {completed ? <Check size={10} strokeWidth={4} /> : <CheckCircle size={12} />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;