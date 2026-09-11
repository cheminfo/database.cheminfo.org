/**
 * The application shell: the family's header, the pages beside the brand, the
 * routed page, and the footer that links every sister site.
 *
 * The page a visitor is on is state — `state.view.tab` — and the address is a
 * mirror of it, kept in step by `startRouter`. A link written for a course
 * frames the tool with `?embed`, and the chrome is then not rendered at all:
 * what a host page frames already carries its own navigation.
 */

import { useSignals } from '@preact/signals-react/runtime';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import type { NavItem } from 'react-cheminfo/ui';
import {
  EcosystemButton,
  HiddenPartsProvider,
  NavLink,
  ShareButton,
  ShareDialog,
  SiteFooter,
  SiteHeader,
  SiteMark,
  SiteTheme,
  useCompactHeader,
} from 'react-cheminfo/ui';

import { About } from './pages/About.tsx';
import { Browse } from './pages/Browse.tsx';
import { Cheatsheet } from './pages/Cheatsheet.tsx';
import { Exercises } from './pages/Exercises.tsx';
import { Playground } from './pages/Playground.tsx';
import { Schema } from './pages/Schema.tsx';
import { Tutorial } from './pages/Tutorial.tsx';
import type { TabId } from './routes.ts';
import {
  REPOSITORY,
  ROUTES,
  SITE_ID,
  SITE_NAME,
  routeForTab,
} from './routes.ts';
import { navigate, router, startRouter, state } from './state/index.ts';
import { SHARE_VOCABULARY } from './state/shareConfig.ts';

/** About is a utility, so it is not one of the pages listed beside the brand. */
const ABOUT_TAB: TabId = 'about';

/**
 * The whole application: chrome, and the one page the address names.
 * @returns The shell.
 */
export function App(): ReactElement {
  useSignals();
  const tab = state.view.tab.value;
  const itemId = state.view.itemId.value;
  const share = state.view.share.value;
  const [isSharing, setIsSharing] = useState(false);
  const compact = useCompactHeader();

  useEffect(startRouter, []);

  return (
    <HiddenPartsProvider hidden={share.hidden}>
      <SiteTheme siteId={SITE_ID} />

      <SiteHeader
        siteId={SITE_ID}
        embedded={share.embed}
        activeId={tab}
        nav={navItems()}
        onHome={() => {
          navigate('playground');
        }}
        markSize={24}
        actions={
          <>
            {/* About leads the utilities on every site of the family, and is a
                real address rather than a dialog: a page is indexed, linkable
                and printable. */}
            <NavLink
              item={{
                id: ABOUT_TAB,
                label: (
                  <>
                    <SiteMark siteId={SITE_ID} size={14} />
                    {compact ? null : 'About'}
                  </>
                ),
                href: '/about',
                title: `What ${SITE_NAME} is, and where its data comes from`,
                onSelect: () => {
                  navigate(ABOUT_TAB);
                },
              }}
              active={tab === ABOUT_TAB}
            />
            <EcosystemButton currentSiteId={SITE_ID} compact={compact} />
            <ShareButton
              compact={compact}
              onClick={() => {
                setIsSharing(true);
              }}
            />
          </>
        }
      />

      <main
        className={share.embed ? 'app-shell app-shell--embedded' : 'app-shell'}
        data-testid={`page-${tab}`}
      >
        <PageBody tab={tab} itemId={itemId} />
      </main>

      <SiteFooter
        siteId={SITE_ID}
        embedded={share.embed}
        heading="The rest of the cheminfo family"
      >
        <p className="app-footer-note">
          Open source, MIT licensed —{' '}
          <a href={REPOSITORY} target="_blank" rel="noreferrer noopener">
            the sources of this site
          </a>
          . Every query here is a link you can hand out or frame in a course
          page.
        </p>
      </SiteFooter>

      <ShareDialog
        isOpen={isSharing}
        onClose={() => {
          setIsSharing(false);
        }}
        vocabulary={SHARE_VOCABULARY}
        title={`${routeForTab(tab).label} — ${SITE_NAME}`}
        frameTitle={`${routeForTab(tab).label} — ${SITE_NAME}`}
      />
    </HiddenPartsProvider>
  );
}

/**
 * The pages, in the order the bar lists them.
 *
 * Each is a real address as well as an action, so a crawler walks the site and
 * a middle click opens the page in a tab of its own.
 * @returns One entry per page, About excepted.
 */
function navItems(): NavItem[] {
  const items: NavItem[] = [];
  for (const route of ROUTES) {
    if (route.tab === ABOUT_TAB) continue;
    items.push({
      id: route.tab,
      label: route.label,
      href: router.format({ tab: route.tab }),
      onSelect: () => {
        navigate(route.tab);
      },
    });
  }
  return items;
}

function PageBody(props: { tab: TabId; itemId: string | null }): ReactNode {
  const { tab, itemId } = props;

  if (tab === 'browse') return <Browse />;
  if (tab === 'tutorial') return <Tutorial step={itemId} />;
  if (tab === 'exercises') return <Exercises exerciseId={itemId} />;
  if (tab === 'schema') return <Schema />;
  if (tab === 'cheatsheet') return <Cheatsheet />;
  if (tab === ABOUT_TAB) return <About />;
  return <Playground />;
}
