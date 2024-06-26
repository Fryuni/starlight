import type { MarkdownHeading } from 'astro';
import project from 'virtual:starlight/project-context';
import config from 'virtual:starlight/user-config';
import { sidebarHook, routeDataHook } from 'virtual:starlight/hooks';
import { generateToC, type TocItem } from './generateToC';
import { getPrevNextLinks, getSidebar, type SidebarEntry } from './navigation';
import { ensureTrailingSlash } from './path';
import type { Route } from './routing';
import { localizedId } from './slugs';
import { useTranslations } from './translations';

export interface PageProps extends Route {
	headings: MarkdownHeading[];
	remarkPluginFrontmatter: Record<string, unknown>;
}

export interface StarlightRouteData extends Route {
	/** Array of Markdown headings extracted from the current page. */
	headings: MarkdownHeading[];
	/** Site navigation sidebar entries for this page. */
	sidebar: SidebarEntry[];
	/** Whether or not the sidebar should be displayed on this page. */
	hasSidebar: boolean;
	/** Links to the previous and next page in the sidebar if enabled. */
	pagination: ReturnType<typeof getPrevNextLinks>;
	/** Table of contents for this page if enabled. */
	toc: { minHeadingLevel: number; maxHeadingLevel: number; items: TocItem[] } | undefined;
	/** URL object for the address where this page can be edited if enabled. */
	editUrl: URL | undefined;
	/** Record of UI strings localized for the current page. */
	labels: ReturnType<ReturnType<typeof useTranslations>['all']>;
}

export async function generateRouteData({
	props,
	url,
}: {
	props: PageProps;
	url: URL;
}): Promise<StarlightRouteData> {
	const { entry, locale } = props;
	const { remarkPluginFrontmatter, ...routeProps } = props;
	const sidebar = await sidebarHook(props, getSidebar(url.pathname, locale));

	entry.data = {
		...remarkPluginFrontmatter,
		...entry.data,
	};

	return routeDataHook({
		...routeProps,
		sidebar,
		hasSidebar: entry.data.template !== 'splash',
		pagination: getPrevNextLinks(sidebar, config.pagination, entry.data),
		toc: getToC(props),
		editUrl: getEditUrl(props),
		labels: useTranslations(locale).all(),
	});
}

export function getToC({ entry, locale, headings }: PageProps) {
	const tocConfig =
		entry.data.template === 'splash'
			? false
			: entry.data.tableOfContents !== undefined
			? entry.data.tableOfContents
			: config.tableOfContents;
	if (!tocConfig) return;
	const t = useTranslations(locale);
	return {
		...tocConfig,
		items: generateToC(headings, {
			...tocConfig,
			title: tocConfig.overviewLabel ?? t('tableOfContents.overview'),
		}),
	};
}

function getEditUrl({ entry, id, isFallback }: PageProps): URL | undefined {
	const { editUrl } = entry.data;
	// If frontmatter value is false, editing is disabled for this page.
	if (editUrl === false) return;

	let url: string | undefined;
	if (typeof editUrl === 'string') {
		// If a URL was provided in frontmatter, use that.
		url = editUrl;
	} else if (config.editLink.baseUrl) {
		const srcPath = project.srcDir.replace(project.root, '');
		const filePath = isFallback ? localizedId(id, config.defaultLocale.locale) : id;
		// If a base URL was added in Starlight config, synthesize the edit URL from it.
		url = ensureTrailingSlash(config.editLink.baseUrl) + srcPath + 'content/docs/' + filePath;
	}
	return url ? new URL(url) : undefined;
}
