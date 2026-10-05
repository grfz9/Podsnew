import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronRight, Minus, Plus, X } from 'lucide-react';
import { TAJWEED_RULES, type QuranWord, type TajweedPart } from '../api/quranCom';
import { TRANSLATIONS, type TranslationId } from '../api/quran';
import { Tabs } from './common';
import { useLibrary } from '../store/library';

/**
 * Texte arabe d'un verset : simple, avec les couleurs du tajwid, ou mot par mot
 * (phonétique et sens de chaque mot au survol, ou affichés sous chaque mot).
 */
export function ArabicText({ text, tajweed, words, inline }: { text: string; tajweed?: TajweedPart[]; words?: QuranWord[]; inline?: boolean }) {
  if (words?.length) {
    return (
      <>
        {words.map((w, i) => (
          <Fragment key={i}>
          <span className={`qw ${inline ? 'qw--inline' : ''}`} tabIndex={0}>
            <span className="qw__ar">{w.text}</span>
            {inline ? (
              <span className="qw__under" dir="ltr">
                <span>{w.translit}</span>
                <span>{w.meaning}</span>
              </span>
            ) : (
              <span className="qw__tip" dir="ltr" role="tooltip">
                <strong>{w.translit}</strong>
                <span>{w.meaning}</span>
              </span>
            )}
          </span>{' '}
          </Fragment>
        ))}
      </>
    );
  }
  if (tajweed?.length) {
    return (
      <>
        {tajweed.map((p, i) =>
          p.rule ? (
            <span key={i} className={`tj tj--${p.rule}`}>
              {p.text}
            </span>
          ) : (
            p.text
          ),
        )}
      </>
    );
  }
  return <>{text}</>;
}

export const SIZES = [22, 26, 30, 34, 40, 46];
export const DEFAULT_SIZE = 30;
const TRANSLATION_SIZES = [14, 16, 18, 20, 22];

/** Réglages de lecture (comme quran.com) : écriture, tajwid, mot par mot, traduction, tailles, récitateur. */
export function ReaderSettings({ onClose, reciter }: { onClose: () => void; reciter?: { id: number; name: string; moshafId: number; surah: number } }) {
  const library = useLibrary();
  const quran = library.settings.quran;
  const set = (patch: Partial<typeof quran>) => library.setSettings({ quran: { ...library.settings.quran, ...patch } });
  const [tab, setTab] = useState<'arabic' | 'translation' | 'words'>('arabic');
  const size = quran.readerSize ?? DEFAULT_SIZE;
  const sizeIndex = Math.max(0, SIZES.indexOf(size));
  const tSize = quran.translationSize ?? 16;
  const tIndex = Math.max(0, TRANSLATION_SIZES.indexOf(tSize));
  const translation: TranslationId = quran.translation === 'rashid' ? 'rashid' : 'hamidullah';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const stepper = (value: string, onMinus: () => void, onPlus: () => void, minDisabled: boolean, maxDisabled: boolean, label: string) => (
    <span className="read-size" role="group" aria-label={label}>
      <button className="icon-btn" onClick={onMinus} disabled={minDisabled} aria-label={`${label} : plus petit`}>
        <Minus size={16} />
      </button>
      <span className="small">{value}</span>
      <button className="icon-btn" onClick={onPlus} disabled={maxDisabled} aria-label={`${label} : plus grand`}>
        <Plus size={16} />
      </button>
    </span>
  );

  return (
    <div className="reader-settings-backdrop" onClick={onClose}>
      <aside className="reader-settings" role="dialog" aria-modal="true" aria-label="Réglages de lecture" onClick={(e) => e.stopPropagation()}>
        <header className="reader-settings__head">
          <h2>Réglages de lecture</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </header>
        <Tabs
          tabs={[
            { id: 'arabic', label: 'Arabe' },
            { id: 'translation', label: 'Traduction' },
            { id: 'words', label: 'Mot par mot' },
          ]}
          value={tab}
          onChange={setTab}
        />

        {tab === 'arabic' && (
          <div className="reader-settings__body">
            <p className="reader-settings__preview" lang="ar" dir="rtl" style={{ fontSize: Math.min(size, 40) }}>
              <ArabicText
                text="بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ"
                tajweed={
                  quran.script === 'tajweed'
                    ? [
                        { text: 'بِسْمِ ' },
                        { text: 'ٱ', rule: 'ham_wasl' },
                        { text: 'للَّهِ ' },
                        { text: 'ٱ', rule: 'ham_wasl' },
                        { text: 'ل', rule: 'laam_shamsiyah' },
                        { text: 'رَّحْمَ' },
                        { text: 'ـٰ', rule: 'madda_normal' },
                        { text: 'نِ ' },
                        { text: 'ٱ', rule: 'ham_wasl' },
                        { text: 'ل', rule: 'laam_shamsiyah' },
                        { text: 'رَّح' },
                        { text: 'ِي', rule: 'madda_permissible' },
                        { text: 'مِ' },
                      ]
                    : undefined
                }
              />
            </p>
            <div className="segmented" role="group" aria-label="Écriture">
              <button className={quran.script !== 'tajweed' ? 'is-on' : ''} onClick={() => set({ script: 'uthmani' })}>
                Uthmani
              </button>
              <button className={quran.script === 'tajweed' ? 'is-on' : ''} onClick={() => set({ script: 'tajweed' })}>
                Tajwid en couleurs
              </button>
            </div>
            {quran.script === 'tajweed' && (
              <ul className="tajweed-legend">
                {TAJWEED_RULES.map((r) => (
                  <li key={r.rule}>
                    <span className={`tajweed-legend__dot tj--${r.rule}`} /> {r.label}
                  </li>
                ))}
              </ul>
            )}
            <div className="reader-settings__line">
              <span>Taille du texte arabe</span>
              {stepper(String(sizeIndex + 1), () => set({ readerSize: SIZES[sizeIndex - 1] }), () => set({ readerSize: SIZES[sizeIndex + 1] }), sizeIndex === 0, sizeIndex === SIZES.length - 1, 'Taille de l’arabe')}
            </div>
            {reciter && (
              <Link to={`/coran/${reciter.id}/${reciter.surah}?m=${reciter.moshafId}`} className="reader-settings__reciter" onClick={onClose}>
                <span>
                  <span className="small muted">Récitateur sélectionné</span>
                  <strong>{reciter.name}</strong>
                </span>
                <ChevronRight size={18} />
              </Link>
            )}
            <p className="small muted">Texte tajwid : quran.com (édition Uthmani). Pour apprendre le tajwid, rien ne remplace un professeur.</p>
          </div>
        )}

        {tab === 'translation' && (
          <div className="reader-settings__body">
            <label className="reader-settings__line">
              <span>Traduction</span>
              <select className="input settings-select" value={translation} onChange={(e) => set({ translation: e.target.value as TranslationId })}>
                {TRANSLATIONS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="reader-settings__line">
              <span>Taille de la traduction</span>
              {stepper(String(tIndex + 1), () => set({ translationSize: TRANSLATION_SIZES[tIndex - 1] }), () => set({ translationSize: TRANSLATION_SIZES[tIndex + 1] }), tIndex === 0, tIndex === TRANSLATION_SIZES.length - 1, 'Taille de la traduction')}
            </div>
            <p className="small muted">{TRANSLATIONS.find((t) => t.id === translation)?.source}</p>
          </div>
        )}

        {tab === 'words' && (
          <div className="reader-settings__body">
            <label className="reader-settings__line">
              <span>
                Mot par mot
                <span className="small muted"> — phonétique et sens au survol (ou en touchant le mot)</span>
              </span>
              <input type="checkbox" className="switch" checked={!!quran.wordByWord} onChange={(e) => set({ wordByWord: e.target.checked })} />
            </label>
            <label className="reader-settings__line">
              <span>Afficher sous chaque mot</span>
              <input type="checkbox" className="switch" checked={!!quran.wordInline} disabled={!quran.wordByWord} onChange={(e) => set({ wordInline: e.target.checked })} />
            </label>
            <p className="small muted">
              Phonétique et sens des mots fournis par quran.com, <strong>en anglais</strong> : il n’existe pas de mot par mot en français vérifié. Pour le sens
              des versets, fiez-vous à la traduction officielle et, pour l’explication, à un savant.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}
