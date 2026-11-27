import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { LANGUAGES, getLanguageOption } from '../../i18n/translations';
import { usePanel } from '../../context/PanelContext';

export function LanguageSelector() {
  const { language, setLanguage, t } = usePanel();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeLang = getLanguageOption(language);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    const timer = setTimeout(() => searchRef.current?.focus(), 40);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      clearTimeout(timer);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div ref={containerRef} className="relative">
      {/* Normal state: Flag + subtle chevron only */}
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setQuery('');
        }}
        aria-label={`Select language (${activeLang.name})`}
        aria-expanded={open}
        title={`${activeLang.name} (${activeLang.nativeName})`}
        className="mx-btn-3d inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl cursor-pointer select-none"
      >
        <span className="text-[17px] leading-none" aria-hidden="true">
          {activeLang.flag}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[#777777] dark:text-zinc-400 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Open state: Flag + Language Name & Native Name list */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className="mx-card-3d absolute end-0 mt-2 w-64 rounded-2xl p-2 z-50"
          >
            <div className="relative mb-2">
              <Search className="w-3.5 h-3.5 text-[#777777] dark:text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('lang.searchPlaceholder')}
                className="mx-input-3d w-full pl-8 pr-3 py-1.5 text-xs rounded-xl text-[#171717] dark:text-zinc-100 placeholder:text-[#777777] dark:placeholder:text-zinc-500"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-0.5 pr-0.5">
              {filtered.length === 0 ? (
                <div className="py-5 text-center text-xs text-[#777777] dark:text-zinc-500">
                  {t('lang.empty')}
                </div>
              ) : (
                filtered.map((item) => {
                  const selected = item.code === activeLang.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      onClick={() => {
                        setLanguage(item.code);
                        setOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left text-xs transition-all cursor-pointer ${
                        selected
                          ? 'mx-nav-active text-[#171717] dark:text-white font-semibold'
                          : 'text-[#3F3F46] dark:text-zinc-300 hover:bg-black/[0.05] dark:hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="text-[17px] leading-none shrink-0" aria-hidden="true">
                          {item.flag}
                        </span>
                        <span className="min-w-0 truncate">
                          <span className="block truncate">{item.nativeName}</span>
                          {item.nativeName !== item.name && (
                            <span className="block text-[10px] font-normal text-[#777777] dark:text-zinc-400 truncate">
                              {item.name}
                            </span>
                          )}
                        </span>
                      </span>
                      {selected && <Check className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
