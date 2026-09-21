export type IconName = 'grid' | 'chart' | 'record' | 'book' | 'search' | 'arrow' | 'clock' | 'layers' | 'list' | 'chevron' | 'sun' | 'moon';
const paths: Record<IconName, string> = {
    grid: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z', chart: 'M4 3v17h17 M7 14l4-5 4 3 5-7', record: 'M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h3', book: 'M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1v15', search: 'M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0', arrow: 'M5 12h14 M13 6l6 6-6 6', clock: 'M12 7v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0', layers: 'M12 3L2 8l10 5 10-5-10-5 M2 12l10 5 10-5 M2 16l10 5 10-5', list: 'M8 5h13 M8 12h13 M8 19h13 M3 5h.01 M3 12h.01 M3 19h.01', chevron: 'M9 5l7 7-7 7', sun: 'M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1 1 M18 18l1 1 M5 19l1-1 M18 6l1-1 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0', moon: 'M20 15A9 9 0 0 1 9 4a9 9 0 1 0 11 11',
};
export function Icon({ name, size = 18 }: {
    name: IconName;
    size?: number;
}) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>; }
export function BrandMark() { return <svg width="28" height="32" viewBox="0 0 28 32" fill="none" aria-hidden="true"><path d="M4 3h20M4 29h20M6 3c0 7 16 19 16 26M22 3C22 10 6 22 6 29" stroke="currentColor" strokeWidth="1.6"/><path d="M8 8h12M10 12h8M10 20h8M8 24h12" stroke="currentColor" strokeWidth="1.2" opacity=".5"/></svg>; }
