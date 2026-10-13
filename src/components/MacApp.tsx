import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useT } from '@/hooks/useT';
import { archFromHint, isMacComputer, type MacArch } from '@/domain/macApp';
import {
  MAC_APP_DOWNLOAD_URL, MAC_APP_INSTALL_URL, MAC_APP_RELEASES_URL, MAC_APP_URL,
} from '@/app-info';

/** What Chromium offers beyond the standard `navigator`. */
interface UserAgentData {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ architecture?: string }>;
}

/**
 * Whether this is a Mac, and which file it needs when the browser can say.
 *
 * `arch` stays null when it cannot: Safari and Firefox do not tell, and the
 * user agent says Intel on Apple silicon too. Nothing is shown inside the
 * desktop app itself, which sets `desktop-app` on <html> and would only be
 * offering itself.
 */
function useMacApp() {
  const [mac] = useState(() => {
    const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
    return isMacComputer({ uaPlatform: data?.platform, platform: navigator.platform, maxTouchPoints: navigator.maxTouchPoints });
  });
  const [arch, setArch] = useState<MacArch | null>(null);

  useEffect(() => {
    if (!mac) return;
    const data = (navigator as Navigator & { userAgentData?: UserAgentData }).userAgentData;
    let live = true;
    data?.getHighEntropyValues?.(['architecture'])
      .then((values) => { if (live) setArch(archFromHint(values.architecture)); })
      .catch(() => { /* not sure: both files are offered */ });
    return () => { live = false; };
  }, [mac]);

  const inDesktopApp = document.documentElement.classList.contains('desktop-app');
  return { mac, arch, inDesktopApp };
}

/**
 * The "Mac app" card in Settings, About.
 *
 * The button does not download: it opens a call-out under itself that says
 * what macOS will ask for the first time, and the download is in there. The
 * page then scrolls to put the call-out in the middle, so the steps and the
 * button are both in view without hunting for them.
 */
export function MacAppCard() {
  const { t } = useT();
  const { mac, arch, inDesktopApp } = useMacApp();
  const [open, setOpen] = useState(false);
  const callout = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Once it has finished growing: centred while it is still folded would aim at nothing.
    const timer = window.setTimeout(
      () => callout.current?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }),
      reduced ? 0 : 380,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  if (inDesktopApp) return null;

  return (
    <div className="macapp" id="mac-app">
      <div className="macapp-text">
        <strong>{t('macApp.title')}</strong>
        <span>{t('macApp.about')}</span>
      </div>
      {mac ? (
        <>
          <div className="macapp-actions">
            <button
              type="button"
              className="btn primary"
              aria-expanded={open}
              aria-controls="mac-app-callout"
              onClick={() => setOpen((v) => !v)}
            >
              {t('macApp.download')}
              <Icon name={open ? 'caret-up' : 'caret'} size="sm" />
            </button>
          </div>
          {/* React 18's types do not know `inert` yet; the browser does. */}
          <div className={`macfold${open ? ' open' : ''}`} {...({ inert: open ? undefined : '' } as object)}>
            <div className="macfold-in">
              <div className="maccallout" id="mac-app-callout" ref={callout}>
                <strong>{t('macApp.steps')}</strong>
                <ol className="macapp-steps">
                  <li>{t('macApp.step1')}</li>
                  <li>{t('macApp.step2')}</li>
                  <li>{t('macApp.step3')}</li>
                </ol>
                <div className="macapp-actions">
                  {arch ? (
                    <a className="btn primary" href={MAC_APP_DOWNLOAD_URL[arch]}>{t('macApp.downloadFile')}</a>
                  ) : (
                    <>
                      <a className="btn primary" href={MAC_APP_DOWNLOAD_URL.arm64}>{t('macApp.appleSilicon')}</a>
                      <a className="btn soft" href={MAC_APP_DOWNLOAD_URL.x64}>{t('macApp.intel')}</a>
                    </>
                  )}
                </div>
                <p className="macapp-help">
                  {arch
                    ? <a href={MAC_APP_RELEASES_URL} target="_blank" rel="noreferrer noopener">{t('macApp.otherMac')}</a>
                    : t('macApp.notSure')}
                  {' · '}
                  <a href={MAC_APP_INSTALL_URL} target="_blank" rel="noreferrer noopener">{t('macApp.moreDetails')}</a>
                </p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="macapp-actions">
          <a className="btn soft" href={MAC_APP_URL} target="_blank" rel="noreferrer noopener">
            <Icon name="external" size="sm" />
            {t('macApp.onGitHub')}
          </a>
        </div>
      )}
    </div>
  );
}

/**
 * One quiet line under the sign-in buttons. Macs only.
 *
 * It points at the app's own page rather than at a file: a download straight
 * from here would skip the steps the card in Settings puts first.
 */
export function MacAppLine() {
  const { t } = useT();
  const { mac, inDesktopApp } = useMacApp();
  if (!mac || inDesktopApp) return null;

  return (
    <p className="macapp-line">
      {t('macApp.title')}
      {' · '}
      <a href={MAC_APP_URL} target="_blank" rel="noreferrer noopener">{t('macApp.lineLink')}</a>
    </p>
  );
}
