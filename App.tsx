
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BIBLE_BOOKS } from './constants';
import { BibleBook, ReadingProgress, AudioState } from './types';
import { fetchChapterText, generateSpeech, decodeBase64, decodeAudioData } from './services/geminiService';
import { Play, Pause, CheckCircle, RotateCcw, Headphones, Menu, X, BookOpen, ChevronDown, ChevronUp, Search } from 'lucide-react';

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
        console.error("Error loading chapter:", error);
        setChapterContent("載入失敗，請檢查網路連線。");
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
      console.error("Audio playback error:", error);
      setAudioState(AudioState.ERROR);
      alert("音訊生成失敗，請稍後再試。");
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
    
    // 手機端震動回饋 (如果支援)
    if (window.navigator.vibrate) window.navigator.vibrate(10);
  };

  const isCompleted = (bookId: string, chapter: number) => {
    return (progress[bookId] || []).includes(chapter);
  };

  const filteredBooks = BIBLE_BOOKS.filter(b => b.name.includes(sidebarSearch));

  return (
    <div className="flex h-screen overflow-hidden bg-[#fdfaf6] text-slate-800 select-none">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden transition-opacity" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-200 transition-transform duration-300 ease-out transform md:relative md:translate-x-0 shadow-2xl md:shadow-none
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full safe-area-inset-top">
          <div className="p-6 border-b border-slate-100 bg-[#fdfaf6]">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-amber-900 flex items-center gap-2">
                <BookOpen className="text-amber-600" />
                恩典聖經
              </h1>
              <button className="md:hidden text-slate-400 p-1" onClick={() => setIsSidebarOpen(false)}><X size={20}/></button>
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
            <div>
              <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">舊約聖經</div>
              <div className="space-y-1">
                {filteredBooks.filter(b => b.testament === 'Old').map(book => (
                  <button
                    key={book.id}
                    onClick={() => { setSelectedBook(book); setSelectedChapter(1); setIsSidebarOpen(false); }}
                    className={`w-full flex justify-between items-center px-3 py-3 text-sm rounded-xl transition-all active:scale-[0.98] ${selectedBook.id === book.id ? 'bg-amber-100 text-amber-950 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span>{book.name}</span>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-400 font-medium">{(progress[book.id] || []).length}/{book.chapters}</span>
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <div className="px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-widest border-b border-slate-50 mb-2">新約聖經</div>
              <div className="space-y-1">
                {filteredBooks.filter(b => b.testament === 'New').map(book => (
                  <button
                    key={book.id}
                    onClick={() => { setSelectedBook(book); setSelectedChapter(1); setIsSidebarOpen(false); }}
                    className={`w-full flex justify-between items-center px-3 py-3 text-sm rounded-xl transition-all active:scale-[0.98] ${selectedBook.id === book.id ? 'bg-amber-100 text-amber-950 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    <span>{book.name}</span>
                    <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded-full text-slate-400 font-medium">{(progress[book.id] || []).length}/{book.chapters}</span>
                  </button>
                ))}
              </div>
            </div>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full bg-[#fdfaf6] relative">
        {/* Mobile Navigation Header */}
        <div className="md:hidden p-4 pt-12 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-slate-100 sticky top-0 z-20">
           <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-amber-900 bg-amber-50 rounded-full active:scale-90 transition-transform"><Menu size={20}/></button>
           <div className="text-center">
              <h2 className="font-bold text-slate-900">{selectedBook.name}</h2>
              <p className="text-[10px] text-slate-400">第 {selectedChapter} 章</p>
           </div>
           <button 
              onClick={() => toggleChapterProgress(selectedBook.id, selectedChapter)}
              className={`p-2 rounded-full transition-colors active:scale-90 ${isCompleted(selectedBook.id, selectedChapter) ? 'text-green-600 bg-green-50' : 'text-slate-300 bg-slate-50'}`}
           >
              <CheckCircle size={20}/>
           </button>
        </div>

        {/* Desktop Header */}
        <header className="hidden md:flex p-8 bg-white border-b border-slate-200 items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 serif-text">
              {selectedBook.name} 第 {selectedChapter} 章
            </h2>
            <div className="flex items-center gap-2 mt-2 text-slate-500 text-sm">
              <span className="bg-slate-100 px-2 py-0.5 rounded font-medium">{selectedBook.testament === 'Old' ? '舊約' : '新約'}</span>
              <span>•</span>
              <span className="flex items-center gap-1"><CheckCircle size={14} className="text-green-500" /> 已讀 {(progress[selectedBook.id] || []).length} / {selectedBook.chapters} 章</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => toggleChapterProgress(selectedBook.id, selectedChapter)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full border shadow-sm transition-all font-medium ${isCompleted(selectedBook.id, selectedChapter) ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-400'}`}
            >
              <CheckCircle size={20} className={isCompleted(selectedBook.id, selectedChapter) ? 'text-green-500' : 'text-slate-300'} />
              {isCompleted(selectedBook.id, selectedChapter) ? '讀完了' : '記為已讀'}
            </button>
            
            <button 
              onClick={audioState === AudioState.PLAYING ? stopAudio : playAudio}
              disabled={isLoadingContent}
              className={`flex items-center gap-3 px-8 py-2.5 rounded-full shadow-lg shadow-amber-900/10 transition-all transform active:scale-95 font-bold ${audioState === AudioState.PLAYING ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-amber-900 hover:bg-black text-white'} disabled:opacity-50`}
            >
              {audioState === AudioState.LOADING ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : audioState === AudioState.PLAYING ? (
                <Pause size={20} />
              ) : (
                <Headphones size={20} />
              )}
              {audioState === AudioState.LOADING ? '準備音訊...' : audioState === AudioState.PLAYING ? '暫停朗讀' : '朗讀經文'}
            </button>
          </div>
        </header>

        {/* Floating Mobile Play Button */}
        <div className="md:hidden fixed bottom-28 right-6 z-20">
            <button 
              onClick={audioState === AudioState.PLAYING ? stopAudio : playAudio}
              className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all active:scale-90 active:rotate-12 ${audioState === AudioState.PLAYING ? 'bg-amber-600 text-white animate-pulse' : 'bg-amber-900 text-white'}`}
            >
               {audioState === AudioState.LOADING ? (
                 <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
               ) : audioState === AudioState.PLAYING ? (
                 <Pause size={28} />
               ) : (
                 <Headphones size={28} />
               )}
            </button>
        </div>

        {/* Text Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-12 lg:p-20 scroll-smooth">
          <div className="max-w-3xl mx-auto bg-white/60 p-6 md:p-12 rounded-[2.5rem] shadow-sm border border-slate-100 mb-20 md:mb-0">
            {isLoadingContent ? (
              <div className="space-y-6 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto mb-10"></div>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="space-y-3">
                    <div className="h-3 bg-slate-100 rounded w-full"></div>
                    <div className="h-3 bg-slate-100 rounded w-[90%]"></div>
                  </div>
                ))}
              </div>
            ) : (
              <article className="serif-text text-xl md:text-2xl leading-[2.3] text-slate-800 whitespace-pre-wrap selection:bg-amber-200 select-text">
                {chapterContent}
              </article>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <footer className="p-4 md:p-6 bg-white/95 backdrop-blur-md border-t border-slate-200 overflow-x-auto fixed bottom-0 left-0 right-0 md:relative z-10 safe-area-inset-bottom">
          <div className="max-w-6xl mx-auto flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
               <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">章節快速導覽</span>
               <span className="text-[10px] text-slate-400 italic">點擊選章，長按可快速切換讀完</span>
            </div>
            <div className="flex gap-2.5 min-w-max pb-2 scrollbar-hide">
              {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(chap => (
                <div key={chap} className="relative group">
                   <button
                    onClick={() => setSelectedChapter(chap)}
                    className={`
                      w-12 h-12 flex items-center justify-center rounded-2xl border-2 transition-all relative active:scale-90
                      ${selectedChapter === chap ? 'bg-amber-900 border-amber-900 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-500'}
                      ${isCompleted(selectedBook.id, chap) && selectedChapter !== chap ? 'text-green-600 bg-green-50/50 border-green-100' : ''}
                    `}
                  >
                    <span className="relative z-10 font-bold text-sm">{chap}</span>
                    {isCompleted(selectedBook.id, chap) && (
                       <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white ${selectedChapter === chap ? 'bg-white text-amber-900' : 'bg-green-500 text-white'}`}>
                          <CheckCircle size={10} />
                       </div>
                    )}
                  </button>
                  {/* Desktop Hover Quick Toggle */}
                  <button 
                    onClick={(e) => toggleChapterProgress(selectedBook.id, chap, e)}
                    className="hidden md:block absolute -top-1 -left-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white shadow-md border border-slate-200 rounded-full p-1 text-slate-400 hover:text-green-500 z-20"
                  >
                    <CheckCircle size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {/* Progress Dashboard (Desktop Only) */}
      <div className="hidden xl:block fixed top-24 right-8 w-64">
         <div className="bg-white/90 backdrop-blur shadow-2xl border border-white/50 p-6 rounded-[2rem] space-y-5">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <RotateCcw size={16} className="text-amber-600 animate-spin-slow" />
              讀經計劃進度
            </h3>
            
            {(Object.entries(progress) as [string, number[]][]).length > 0 ? (
               <div className="space-y-4">
                  {(Object.entries(progress) as [string, number[]][]).slice(-4).reverse().map(([bookId, chaps]) => {
                     const book = BIBLE_BOOKS.find(b => b.id === bookId);
                     if (!book) return null;
                     const percent = Math.round((chaps.length / book.chapters) * 100);
                     return (
                        <div key={bookId} className="group">
                           <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1.5 px-1">
                              <span>{book.name}</span>
                              <span className="text-amber-600">{percent}%</span>
                           </div>
                           <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                              <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 transition-all duration-1000 ease-out rounded-full" style={{ width: `${percent}%` }}></div>
                           </div>
                        </div>
                     )
                  })}
               </div>
            ) : (
               <div className="text-center py-4">
                  <p className="text-xs text-slate-400 italic">尚未開始記錄<br/>點擊「記為已讀」</p>
               </div>
            )}
            
            <div className="pt-4 border-t border-slate-50 flex items-center justify-center">
               <div className="text-[10px] text-slate-400 font-medium">願神賜你每日的力量</div>
            </div>
         </div>
      </div>
    </div>
  );
};

export default App;
