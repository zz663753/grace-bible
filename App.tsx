import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BIBLE_BOOKS } from './constants';
import { BibleBook, ReadingProgress, AudioState } from './types';
import { fetchChapterText, generateSpeech, decodeBase64, decodeAudioData } from './geminiService';
import { Play, Pause, CheckCircle, RotateCcw, Headphones, Menu, X, BookOpen, Search, Check, Volume2 } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [selectedBook, setSelectedBook] = useState<BibleBook>(BIBLE_BOOKS[0]);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [chapterContent, setChapterContent] = useState<string>('');
  const [progress, setProgress] = useState<ReadingProgress>({});
  const [audioState, setAudioState] = useState<AudioState>(AudioState.IDLE);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Load Progress
  useEffect(() => {
    const savedProgress = localStorage.getItem('bible-progress');
    if (savedProgress) setProgress(JSON.parse(savedProgress));
  }, []);

  // Sync Progress to Storage
  useEffect(() => {
    localStorage.setItem('bible-progress', JSON.stringify(progress));
  }, [progress]);

  // Load Chapter Content
  useEffect(() => {
    const loadContent = async () => {
      setIsLoadingContent(true);
      stopAudio(); 
      try {
        const text = await fetchChapterText(selectedBook.name, selectedChapter);
        setChapterContent(text);
      } catch (error) {
        setChapterContent("載入失敗，請檢查網路連線或 API Key 設定。");
      } finally {
        setIsLoadingContent(false);
      }
    };
    loadContent();
  }, [selectedBook, selectedChapter]);

  // Audio Actions
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
      console.error("Audio error:", error);
      setAudioState(AudioState.ERROR);
      alert("音訊無法播放，請確認 Vercel 設定中的 API_KEY 是否正確。");
    }
  };

  const stopAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch(e) {}
      audioSourceRef.current = null;
    }
    setAudioState(AudioState.IDLE);
  }, []);

  // Progress Actions
  const toggleChapterProgress = (bookId: string, chapter: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setProgress(prev => {
      const currentBookChapters = prev[bookId] || [];
      const updated = currentBookChapters.includes(chapter)
        ? currentBookChapters.filter(c => c !== chapter)
        : [...currentBookChapters, chapter];
      return { ...prev, [bookId]: updated };
    });
    if (window.navigator.vibrate) window.navigator.vibrate(15);
  };

  const isCompleted = (bookId: string, chapter: number) => {
    return (progress[bookId] || []).includes(chapter);
  };

  const handleChapterClick = (chap: number) => {
    if (selectedChapter === chap) {
      audioState === AudioState.PLAYING ? stopAudio() : playAudio();
    } else {
      setSelectedChapter(chap);
    }
  };

  const filteredBooks = BIBLE_BOOKS.filter(b => b.name.includes(sidebarSearch));

  return (
    <div className="flex h-screen overflow-hidden bg-[#fdfaf6] text-slate-800 select-none">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transition-transform duration-300 md:relative md:translate-x-0 shadow-2xl md:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full safe-area-inset-top">
          <div className="p-6 border-b border-slate-100 bg-[#fdfaf6]">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-amber-900 flex items-center gap-2">
                <BookOpen className="text-amber-600" />
                恩典聖經
              </h1>
              <button className="md:hidden p-1 text-slate-400" onClick={() => setIsSidebarOpen(false)}><X size={20}/></button>
            </div>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="搜尋經卷..." 
                className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
              />
            </div>
          </div>
          
          <nav className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-hide">
            {['Old', 'New'].map(testament => (
              <div key={testament}>
                <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">
                  {testament === 'Old' ? '舊約聖經' : '新約聖經'}
                </div>
                <div className="space-y-1">
                  {filteredBooks.filter(b => b.testament === testament).map(book => (
                    <button
                      key={book.id}
                      onClick={() => { setSelectedBook(book); setSelectedChapter(1); setIsSidebarOpen(false); }}
                      className={`w-full flex justify-between items-center px-3 py-3 text-sm rounded-xl transition-all ${selectedBook.id === book.id ? 'bg-amber-100 text-amber-950 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span>{book.name}</span>
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-400 font-medium">
                        {(progress[book.id] || []).length}/{book.chapters}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-[#fdfaf6] relative">
        {/* Mobile Header */}
        <div className="md:hidden p-4 pt-12 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20">
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-amber-900 bg-amber-50 rounded-full active:scale-90 transition-transform"><Menu size={20}/></button>
           <div className="text-center">
              <h2 className="font-bold text-slate-900">{selectedBook.name}</h2>
              <p className="text-[10px] text-slate-500">第 {selectedChapter} 章</p>
           </div>
           <button 
              onClick={() => toggleChapterProgress(selectedBook.id, selectedChapter)}
              className={`p-2 rounded-full transition-all active:scale-90 ${isCompleted(selectedBook.id, selectedChapter) ? 'text-green-600 bg-green-50' : 'text-slate-300 bg-slate-50'}`}
           >
              <CheckCircle size={20}/>
           </button>
        </div>

        {/* Desktop Header */}
        <header className="hidden md:flex p-8 bg-white border-b border-slate-200 items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 serif-text">{selectedBook.name} 第 {selectedChapter} 章</h2>
            <div className="flex items-center gap-2 mt-2 text-slate-500 text-sm">
              <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">{selectedBook.testament === 'Old' ? '舊約' : '新約'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-500" /> 已讀 {(progress[selectedBook.id] || []).length} / {selectedBook.chapters} 章</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={audioState === AudioState.PLAYING ? stopAudio : playAudio}
              disabled={isLoadingContent}
              className={`flex items-center gap-3 px-8 py-2.5 rounded-full shadow-lg transition-all transform active:scale-95 font-bold ${audioState === AudioState.PLAYING ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-amber-900 hover:bg-black text-white'} disabled:opacity-50`}
            >
              {audioState === AudioState.LOADING ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : audioState === AudioState.PLAYING ? <Pause size={20} /> : <Volume2 size={20} />}
              {audioState === AudioState.LOADING ? '正在讀經...' : audioState === AudioState.PLAYING ? '暫停' : '開始朗讀'}
            </button>
          </div>
        </header>

        {/* Floating Mobile Play */}
        <div className="md:hidden fixed bottom-28 right-6 z-20">
            <button onClick={audioState === AudioState.PLAYING ? stopAudio : playAudio} className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90 ${audioState === AudioState.PLAYING ? 'bg-amber-600 text-white animate-pulse' : 'bg-amber-900 text-white'}`}>
               {audioState === AudioState.LOADING ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : audioState === AudioState.PLAYING ? <Pause size={28} /> : <Volume2 size={28} />}
            </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 lg:p-20 scrollbar-hide">
          <div className={`max-w-3xl mx-auto bg-white/70 p-6 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 mb-24 md:mb-0 transition-all ${audioState === AudioState.PLAYING ? 'ring-2 ring-amber-500/20' : ''}`}>
            {isLoadingContent ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto mb-10"></div>
                {[...Array(5)].map((_, i) => <div key={i} className="h-3 bg-slate-100 rounded w-full mb-3"></div>)}
              </div>
            ) : (
              <article className={`serif-text text-xl md:text-2xl leading-[2.4] text-slate-800 whitespace-pre-wrap selection:bg-amber-100 transition-opacity duration-500 ${audioState === AudioState.PLAYING ? 'text-amber-950' : ''}`}>
                {chapterContent}
              </article>
            )}
          </div>
        </div>

        {/* Improved Footer Navigation */}
        <footer className="p-4 md:p-6 bg-white/95 backdrop-blur-md border-t border-slate-200 fixed bottom-0 left-0 right-0 md:relative z-10 safe-area-inset-bottom">
          <div className="max-w-6xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
               <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">章節快速切換與勾選</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x" ref={scrollContainerRef}>
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(chap => {
                const completed = isCompleted(selectedBook.id, chap);
                const active = selectedChapter === chap;
                return (
                  <div key={chap} className="relative group snap-start">
                     <button
                      onClick={() => handleChapterClick(chap)}
                      className={`w-14 h-14 flex items-center justify-center rounded-2xl border-2 transition-all active:scale-90 ${active ? 'bg-amber-900 border-amber-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500'} ${completed && !active ? 'text-green-600 bg-green-50/50 border-green-100' : ''}`}
                    >
                      {active && audioState === AudioState.PLAYING ? <Pause size={14} className="mr-1 animate-pulse" /> : null}
                      <span className="font-bold text-sm">{chap}</span>
                    </button>
                    <button 
                      onClick={(e) => toggleChapterProgress(selectedBook.id, chap, e)}
                      className={`absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center border shadow-sm transition-all z-20 ${completed ? 'bg-green-500 border-green-600 text-white' : 'bg-white border-slate-200 text-slate-300'}`}
                    >
                      {completed ? <Check size={12} strokeWidth={4} /> : <CheckCircle size={14} />}
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