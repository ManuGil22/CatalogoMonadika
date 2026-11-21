import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { BehaviorSubject, combineLatest, map, switchMap } from 'rxjs';
import { CatalogStore } from '../../../core/services/catalog-store.service';
import { Product } from '../../../shared/product.model';
import { environment } from '../../../../environments/environment';

export type SortOption =
    | 'name-asc'
    | 'name-desc'
    | 'price-asc'
    | 'price-desc'

export type SizeFilter = 'all' | 'chico' | 'mediano' | 'grande';

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

    readonly sizeChips: readonly SizeChip[] = [
        { value: 'all', label: 'Todos' },
        { value: 'chico', label: 'Chico' },
        { value: 'mediano', label: 'Mediano' },
        { value: 'grande', label: 'Grande' }
    ];

    readonly loading$ = this.catalogStore.loading$;
    readonly error$ = this.catalogStore.error$;
    readonly currentSort$ = this.sortSubject.asObservable();
    readonly currentSize$ = this.sizeSubject.asObservable();

    readonly viewModel$ = this.route.paramMap.pipe(
        map((params) => params.get('slug') ?? ''),
        switchMap((slug) =>
            combineLatest([
                this.catalogStore.getCategoryNameBySlug(slug),
                this.catalogStore.getProductsByCategorySlug(slug),
                this.currentSort$,
                this.currentSize$
            ]).pipe(
                map(([categoryName, products, sort, sizeFilter]) => {
                    const filteredBySize = this.filterBySize(products, sizeFilter);
                    return {
                        slug,
                        categoryName,
                        sort,
                        sizeFilter,
                        products: this.sortProducts(filteredBySize, sort)
                    };
                })
            )
        )
    );

    ngOnInit(): void {
        this.catalogStore.loadProducts();
    }

    onSortChange(event: Event): void {
        const select = event.target as HTMLSelectElement;
        this.sortSubject.next(select.value as SortOption);
    }

    onSizeSelect(size: SizeFilter): void {
        this.sizeSubject.next(size);
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
        }
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