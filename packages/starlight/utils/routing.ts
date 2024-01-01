import type { GetStaticPathsItem } from 'astro';
import { type CollectionEntry, type ContentCollectionKey, getCollection } from 'astro:content';
import { fileURLToPath } from 'node:url';
import project from 'virtual:starlight/project-context';
import config from 'virtual:starlight/user-config';
import { allRoutesHook } from 'virtual:starlight/hooks';
import {
	type LocaleData,
	localizedId,
	localizedSlug,
	slugToLocaleData,
	slugToParam,
} from './slugs';
import { getFileCommitDate } from './git';
import { validateLogoImports } from './validateLogoImports';

// Validate any user-provided logos imported correctly.
// We do this here so all pages trigger it and at the top level so it runs just once.
validateLogoImports();

type BaseCollectionKey = 'docs' extends ContentCollectionKey ? 'docs' : ContentCollectionKey;

export type StarlightDocsEntry = Omit<CollectionEntry<BaseCollectionKey>, 'slug' | 'collection'> & {
	routeId: string;
	collection: ContentCollectionKey;
	slug: string;
	firstPublished?: Date | undefined;
	lastUpdated?: Date | undefined;
};

export interface Route extends LocaleData {
	/** Content collection entry for the current page. Includes frontmatter at `data`. */
	entry: StarlightDocsEntry;
	/** Locale metadata for the page content. Can be different from top-level locale values when a page is using fallback content. */
	entryMeta: LocaleData;
	/** The slug, a.k.a. permalink, for this page. */
	slug: string;
	/** The unique ID for this page. */
	id: string;
	/** JS Date object representing when this page was last updated if enabled. */
	lastUpdated: Date | undefined;
	/** JS Date object representing when this page was first published if enabled. */
	firstPublished: Date | undefined;
	/** True if this page is untranslated in the current language and using fallback content from the default locale. */
	isFallback?: true;
	[key: string]: unknown;
}

interface Path extends GetStaticPathsItem {
	params: { slug: string | undefined };
	props: Route;
}

/**
 * Astro is inconsistent in its `index.md` slug generation. In most cases,
 * `index` is stripped, but in the root of a collection, we get a slug of `index`.
 * We map that to an empty string for consistent behaviour.
 */
const normalizeIndexSlug = (slug: string) => (slug === 'index' ? '' : slug);

async function getDocsEntries(): Promise<StarlightDocsEntry[]> {
	const collectionsEntries = await Promise.all(
		config.collectionNames.map(async (collectionName, index) => {
			const collection = await getCollection(collectionName);

			return (collection ?? []).map(
				(entry): StarlightDocsEntry => ({
					...entry,
					...getEntryDates(entry),
					routeId: index === 0 ? entry.id : `${collectionName}/${entry.id}`,
					slug:
						index === 0
							? normalizeIndexSlug(entry.slug)
							: `${collectionName}/${normalizeIndexSlug(entry.slug)}`,
				})
			);
		})
	);

	return collectionsEntries.flat(1);
}

/** All entries in the docs content collection. */
const docs: StarlightDocsEntry[] = await getDocsEntries();

function getRoutes(): Route[] {
	const routes: Route[] = docs.map((entry) => ({
		entry,
		slug: entry.slug,
		id: entry.routeId,
		entryMeta: slugToLocaleData(entry.slug),
		...slugToLocaleData(entry.slug),
		firstPublished: entry.firstPublished,
		lastUpdated: entry.lastUpdated,
	}));

	// In multilingual sites, add required fallback routes.
	if (config.isMultilingual) {
		/** Entries in the docs content collection for the default locale. */
		const defaultLocaleDocs = getLocaleDocs(
			config.defaultLocale?.locale === 'root' ? undefined : config.defaultLocale?.locale
		);
		for (const key in config.locales) {
			if (key === config.defaultLocale.locale) continue;
			const localeConfig = config.locales[key];
			if (!localeConfig) continue;
			const locale = key === 'root' ? undefined : key;
			const localeDocs = getLocaleDocs(locale);
			for (const fallback of defaultLocaleDocs) {
				const slug = localizedSlug(fallback.slug, locale);
				const id = localizedId(fallback.id, locale);
				const doesNotNeedFallback = localeDocs.some((doc) => doc.slug === slug);
				if (doesNotNeedFallback) continue;
				routes.push({
					entry: fallback,
					slug,
					id,
					isFallback: true,
					lang: localeConfig.lang || 'en',
					locale,
					dir: localeConfig.dir,
					entryMeta: slugToLocaleData(fallback.slug),
					firstPublished: fallback.firstPublished,
					lastUpdated: fallback.lastUpdated,
				});
			}
		}
	}

	return routes;
}
export const routes = await allRoutesHook(getRoutes());

function getParamRouteMapping(): ReadonlyMap<string | typeof INDEX_SLUG_PARAM, Route> {
	const map = new Map<string | typeof INDEX_SLUG_PARAM, Route>();

	for (const route of routes) {
		map.set(slugToParam(route.slug) ?? INDEX_SLUG_PARAM, route);
	}

	return map;
}
const INDEX_SLUG_PARAM = Symbol('index');
const routesBySlugParam = getParamRouteMapping();

export function getRouteBySlugParam(slugParam: string | undefined): Route | undefined {
	return routesBySlugParam.get(slugParam?.replace(/\/$/, '') ?? INDEX_SLUG_PARAM);
}

function getPaths(): Path[] {
	return routes.map((route) => ({
		params: { slug: slugToParam(route.slug) },
		props: route,
	}));
}
export const paths = getPaths();

/**
 * Get all routes for a specific locale.
 * A locale of `undefined` is treated as the “root” locale, if configured.
 */
export function getLocaleRoutes(locale: string | undefined): Route[] {
	return filterByLocale(routes, locale);
}

/**
 * Get all routes from a specific content collection.
 */
export function getCollectionRoutes(collection: ContentCollectionKey): Route[] {
	return routes.filter((route) => route.entry.collection === collection);
}

/**
 * Get all entries in the docs content collection for a specific locale.
 * A locale of `undefined` is treated as the “root” locale, if configured.
 */
function getLocaleDocs(locale: string | undefined): StarlightDocsEntry[] {
	return filterByLocale(docs, locale);
}

/** Filter an array to find items whose slug matches the passed locale. */
function filterByLocale<T extends { slug: string }>(items: T[], locale: string | undefined): T[] {
	if (config.locales) {
		if (locale && locale in config.locales) {
			return items.filter((i) => i.slug === locale || i.slug.startsWith(locale + '/'));
		} else if (config.locales.root) {
			const langKeys = Object.keys(config.locales).filter((k) => k !== 'root');
			const isLangIndex = new RegExp(`^(${langKeys.join('|')})$`);
			const isLangDir = new RegExp(`^(${langKeys.join('|')})/`);
			return items.filter((i) => !isLangIndex.test(i.slug) && !isLangDir.test(i.slug));
		}
	}
	return items;
}

type EntryDates = {
	firstPublished: Date | undefined;
	lastUpdated: Date | undefined;
};

export function getEntryDates(entry: CollectionEntry<'docs'>): EntryDates {
	const dates: EntryDates = {
		firstPublished: undefined,
		lastUpdated: undefined,
	};

	if (entry.data.lastUpdated ?? config.publicationDates) {
		const currentFilePath = fileURLToPath(new URL('src/content/docs/' + entry.id, project.root));
		if (entry.data.lastUpdated instanceof Date) {
			dates.lastUpdated = entry.data.lastUpdated;
		} else {
			try {
				const { date } = getFileCommitDate(currentFilePath, 'newest');
				dates.lastUpdated = date;
			} catch {}
		}
	}

	if (entry.data.firstPublished ?? config.publicationDates) {
		const currentFilePath = fileURLToPath(new URL('src/content/docs/' + entry.id, project.root));
		if (entry.data.firstPublished instanceof Date) {
			dates.firstPublished = entry.data.firstPublished;
		} else {
			try {
				const { date } = getFileCommitDate(currentFilePath, 'oldest');
				dates.firstPublished = date;
			} catch {}
		}
	}

	return dates;
}
