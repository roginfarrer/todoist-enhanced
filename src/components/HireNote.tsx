import { useState } from 'react';
import { Icon } from './Icon';
import { Overlay } from './overlays/Overlay';
import { useStore } from '@/store/store';
import { useT } from '@/hooks/useT';
import { HIRE_EMAIL, HIRE_LINKEDIN_URL, hireMailto } from '@/domain/hireNote';
import { copyText } from '@/api/links';
import { AUTHOR_AVATAR_URL } from '@/app-info';

/**
 * One task in the list, for the people who make Todoist.
 *
 * It looks like a task because that is the app's own way of saying
 * something to you, and it is picked out so it cannot be taken for one of
 * yours. It is shown once: the app records that on the account when it first
 * puts the note up (App.tsx), so a closed tab or a second browser does not
 * bring it back. Ticking it, closing it or opening and refusing it only
 * put it away for this visit.
 */
export function HireNote() {
  const { t } = useT();
  const open = useStore((s) => s.hireNote);
  const setHireNote = useStore((s) => s.setHireNote);
  const toast = useStore((s) => s.toast);
  const [detail, setDetail] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const away = () => { setDetail(false); setHireNote(false); };

  return (
    <>
      <div
        className="task hirenote"
        role="button"
        tabIndex={0}
        onClick={() => setDetail(true)}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(true); }
        }}
      >
        <span
          className="check p1"
          role="checkbox"
          aria-checked="false"
          aria-label={t('task.complete')}
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); away(); toast(t('hire.done')); }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault(); e.stopPropagation(); away(); toast(t('hire.done'));
          }}
        >
          <Icon name="check" />
        </span>
        <span className="tmain">
          <span className="ttitle">{t('hire.title')}</span>
          <span className="tdesc">{t('hire.line')}</span>
        </span>
        <span className="trow-end">
          <span className="hiretag">{t('hire.from')}</span>
          <button
            className="iconbtn"
            aria-label={t('hire.dismiss')}
            onClick={(e) => { e.stopPropagation(); away(); }}
          >
            <Icon name="close" size="sm" />
          </button>
        </span>
      </div>

      <Overlay open={detail} onClose={() => setDetail(false)} label={t('hire.title')} size="sm">
        <div className="hirecard">
          <div className="hirecard-cover">
            <button className="iconbtn hirecard-close" aria-label={t('common.close')} onClick={() => setDetail(false)}>
              <Icon name="close" size="sm" />
            </button>
          </div>
          <img className="hirecard-photo" src={AUTHOR_AVATAR_URL} alt="" width={88} height={88} decoding="async" />
          <div className="hirecard-body">
            <h2>{t('hire.name')}</h2>
            <p>{t('hire.bio')}</p>
            <div className="hirecard-links">
              <a className="hirepill" href={HIRE_LINKEDIN_URL} target="_blank" rel="noreferrer noopener" onClick={away}>
                <Icon name="link" size="sm" />
                {t('hire.linkedin')}
              </a>
              <span className="hirepill hirepill-mail">
                <a href={hireMailto(t('hire.subject'))} onClick={away}>
                  <Icon name="mail" size="sm" />
                  {t('hire.email')}
                </a>
                <button
                  type="button"
                  className={`hirepill-copy${copied ? ' copied' : ''}`}
                  aria-label={t('hire.copy')}
                  title={t('hire.copy')}
                  onClick={() => {
                    void copyText(HIRE_EMAIL).then((ok) => {
                      if (!ok) return;
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 1800);
                    });
                  }}
                >
                  <Icon name={copied ? 'check' : 'copy'} size="sm" />
                  <span aria-live="polite">{copied ? t('hire.copied') : ''}</span>
                </button>
              </span>
            </div>
          </div>
        </div>
      </Overlay>
    </>
  );
}
