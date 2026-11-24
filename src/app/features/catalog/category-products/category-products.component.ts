import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, switchMap, tap } from 'rxjs';
import { CatalogStore } from '../../../core/services/catalog-store.service';
import { Product } from '../../../shared/product.model';
import { environment } from '../../../../environments/environment';

export type SortOption =
    | 'name-asc'
    | 'name-desc'
    | 'price-asc'
    | 'price-desc';

export type SizeFilter = 'all' | 'chico' | 'mediano' | 'grande';
export type PageSizeOption = 10 | 20 | 50 | 100;

interface SizeChip {
    value: SizeFilter;
    label: string;
}

@Component({
    selector: 'app-category-products',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './category-products.component.html',
    styleUrl: './category-products.component.scss'
})
export class CategoryProductsComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly catalogStore = inject(CatalogStore);
    private readonly sortSubject = new BehaviorSubject<SortOption>('name-asc');
    private readonly sizeSubject = new BehaviorSubject<SizeFilter>('all');
    private readonly pageSubject = new BehaviorSubject<number>(1);
    private readonly pageSizeSubject = new BehaviorSubject<PageSizeOption>(20);
    private readonly categoriesWithoutSizeFilter = new Set<string>(['argollas']);
    private readonly zoomSteps = [1, 1.75, 2.5] as const;

    private isDragging = false;
    private dragStartX = 0;
    private dragStartY = 0;

    lightboxProduct: Product | null = null;
    zoomLevel = 1;
    panX = 0;
    panY = 0;

    readonly sizeChips: readonly SizeChip[] = [
        { value: 'all', label: 'Todos' },
        { value: 'chico', label: 'Chico' },
        { value: 'mediano', label: 'Mediano' },
        { value: 'grande', label: 'Grande' }
    ];

    readonly pageSizeOptions: readonly PageSizeOption[] = [10, 20, 50, 100];
    readonly skeletonItems: readonly number[] = Array.from({ length: 8 }, (_, i) => i);

    readonly loading$ = this.catalogStore.loading$;
    readonly error$ = this.catalogStore.error$;
    readonly currentSort$ = this.sortSubject.asObservable();
    readonly currentSize$ = this.sizeSubject.asObservable();
    readonly currentPage$ = this.pageSubject.asObservable();
    readonly currentPageSize$ = this.pageSizeSubject.asObservable();

    readonly viewModel$ = this.route.paramMap.pipe(
        map((params) => params.get('slug') ?? ''),
        tap(() => {
            this.pageSubject.next(1);
            this.sizeSubject.next('all');
        }),
        switchMap((slug) =>
            combineLatest([
                this.catalogStore.getCategoryNameBySlug(slug),
                this.catalogStore.getProductsByCategorySlug(slug),
                this.currentSort$,
                this.currentSize$,
                this.currentPage$,
                this.currentPageSize$
            ]).pipe(
                map(([categoryName, products, sort, sizeFilter, page, pageSize]) => {
                    const normalizedSlug = this.normalizeText(slug);
                    const normalizedCat = this.normalizeText(categoryName);
                    const hideSizeFilter =
                        this.categoriesWithoutSizeFilter.has(normalizedSlug) ||
                        this.categoriesWithoutSizeFilter.has(normalizedCat);

                    const effectiveSizeFilter: SizeFilter = hideSizeFilter ? 'all' : sizeFilter;
                    const filteredBySize = this.filterBySize(products, effectiveSizeFilter);
                    const sortedProducts = this.sortProducts(filteredBySize, sort);

                    const totalItems = sortedProducts.length;
                    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
                    const safePage = Math.min(Math.max(1, page), totalPages);
                    const startIndex = (safePage - 1) * pageSize;
                    const endIndex = Math.min(startIndex + pageSize, totalItems);

                    return {
                        slug,
                        categoryName,
                        hideSizeFilter,
                        sort,
                        sizeFilter: effectiveSizeFilter,
                        totalItems,
                        pageSize,
                        currentPage: safePage,
                        totalPages,
                        startItem: totalItems === 0 ? 0 : startIndex + 1,
                        endItem: endIndex,
                        products: sortedProducts.slice(startIndex, endIndex)
                    };
                })
            )
        )
    );

    ngOnInit(): void {
        this.catalogStore.loadProducts();
    }

    @HostListener('document:keydown.escape')
    onEscapeKey(): void {
        if (this.lightboxProduct) {
            this.closeLightbox();
        }
    }

    openLightbox(product: Product): void {
        this.lightboxProduct = product;
        this.resetZoom();
    }

    closeLightbox(): void {
        this.lightboxProduct = null;
        this.isDragging = false;
        this.resetZoom();
    }

    resetZoom(): void {
        this.zoomLevel = 1;
        this.panX = 0;
        this.panY = 0;
    }

    zoomIn(): void {
        const next = this.zoomSteps.find((step) => step > this.zoomLevel + 0.01);
        if (next) {
            this.zoomLevel = next;
        }
    }

    zoomOut(): void {
        const prev = [...this.zoomSteps].reverse().find((step) => step < this.zoomLevel - 0.01);
        this.zoomLevel = prev ?? 1;
        if (this.zoomLevel === 1) {
            this.panX = 0;
            this.panY = 0;
        }
    }

    toggleZoomOnImage(event: MouseEvent): void {
        event.stopPropagation();
        if (this.isDragging) {
            return;
        }

        if (this.zoomLevel > 1) {
            this.resetZoom();
        } else {
            this.zoomLevel = 2;
        }
    }

    onImagePointerDown(event: PointerEvent): void {
        if (this.zoomLevel <= 1) {
            return;
        }

        this.isDragging = true;
        this.dragStartX = event.clientX - this.panX;
        this.dragStartY = event.clientY - this.panY;
        (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }

    onImagePointerMove(event: PointerEvent): void {
        if (!this.isDragging || this.zoomLevel <= 1) {
            return;
        }

        const maxPan = (this.zoomLevel - 1) * 140;
        this.panX = Math.min(maxPan, Math.max(-maxPan, event.clientX - this.dragStartX));
        this.panY = Math.min(maxPan, Math.max(-maxPan, event.clientY - this.dragStartY));
    }

    onImagePointerUp(event: PointerEvent): void {
        if (!this.isDragging) {
            return;
        }

        this.isDragging = false;
        if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) {
            (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
        }
    }

    onImageError(event: Event, product: Product): void {
        const img = event.target as HTMLImageElement;
        if (!img || img.dataset['fallbackApplied'] === 'true') {
            return;
        }

        img.dataset['fallbackApplied'] = 'true';
        const driveIdMatch = (product.imageUrl ?? '').match(/\/d\/([a-zA-Z0-9_-]+)/);

        if (driveIdMatch?.[1] && !img.src.includes('drive.google.com/thumbnail')) {
            img.src = `https://drive.google.com/thumbnail?id=${driveIdMatch[1]}&sz=w800`;
            return;
        }

        img.src = 'assets/placeholder-product.png';
    }

    onSortChange(event: Event): void {
        const select = event.target as HTMLSelectElement;
        this.sortSubject.next(select.value as SortOption);
        this.pageSubject.next(1);
    }

    onSizeSelect(size: SizeFilter): void {
        this.sizeSubject.next(size);
        this.pageSubject.next(1);
    }

    onPageSizeChange(event: Event): void {
        const select = event.target as HTMLSelectElement;
        this.pageSizeSubject.next(Number(select.value) as PageSizeOption);
        this.pageSubject.next(1);
    }

    goToPage(page: number, totalPages: number): void {
        const nextPage = Math.min(Math.max(1, page), totalPages);
        if (nextPage === this.pageSubject.value) {
            return;
        }

        this.pageSubject.next(nextPage);
        if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    getInstagramUrl(_product?: Product): string {
        const instagramUsername = environment.instagramUsername?.replace(/^@/, '').trim();
        if (!instagramUsername) {
            return '';
        }

        return `https://ig.me/m/${instagramUsername}`;
    }

    isMobileViewport(): boolean {
        return typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    }

    askOnInstagram(product: Product, event?: Event): void {
        const url = this.getInstagramUrl(product);
        if (!url) {
            return;
        }

        if (!this.isMobileViewport()) {
            event?.preventDefault();
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        const username = environment.instagramUsername?.replace(/^@/, '').trim();
        if (!username) {
            return;
        }

        const profileUrl = `https://www.instagram.com/${username}/`;
        const fallbackTimer = window.setTimeout(() => {
            if (!document.hidden) {
                window.location.replace(profileUrl);
            }
        }, 1800);

        const clearFallback = () => window.clearTimeout(fallbackTimer);
        document.addEventListener('visibilitychange', clearFallback, { once: true });
        window.addEventListener('pagehide', clearFallback, { once: true });
    }

    isCharmsCategory(slug: string, categoryName: string): boolean {
        return (
            this.normalizeText(slug) === 'charms' ||
            this.normalizeText(categoryName) === 'charms'
        );
    }

    private filterBySize(products: Product[], sizeFilter: SizeFilter): Product[] {
        if (sizeFilter === 'all') {
            return products;
        }

        return products.filter(
            (product) => this.normalizeText(product.size) === sizeFilter
        );
    }

    private normalizeText(value: string | undefined): string {
        return String(value ?? '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '');
    }

    private sortProducts(products: Product[], sort: SortOption): Product[] {
        const copy = [...products];

        switch (sort) {
            case 'name-asc':
                return copy.sort((a, b) =>
                    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
                );
            case 'name-desc':
                return copy.sort((a, b) =>
                    b.name.localeCompare(a.name, 'es', { sensitivity: 'base' })
                );
            case 'price-asc':
                return copy.sort((a, b) => Number(a.price) - Number(b.price));
            case 'price-desc':
                return copy.sort((a, b) => Number(b.price) - Number(a.price));
            default:
                return copy;
        }
    }
}