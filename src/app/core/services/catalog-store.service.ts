import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, finalize, map, take } from 'rxjs';
import { CatalogApiService } from './catalog-api';
import { CategoryCard } from '../../shared/category-card.model';
import { Product } from '../../shared/product.model';

@Injectable({
    providedIn: 'root'
})
export class CatalogStore {
    private readonly catalogApi = inject(CatalogApiService);

    private readonly productsSubject = new BehaviorSubject<Product[]>([]);
    private readonly loadingSubject = new BehaviorSubject<boolean>(false);
    private readonly errorSubject = new BehaviorSubject<string | null>(null);
    private hasLoaded = false;

    readonly products$: Observable<Product[]> = this.productsSubject.asObservable();
    readonly loading$: Observable<boolean> = this.loadingSubject.asObservable();
    readonly error$: Observable<string | null> = this.errorSubject.asObservable();

    readonly categoryCards$: Observable<CategoryCard[]> = this.products$.pipe(
        map((products) => this.buildCategoryCards(products))
    );

    loadProducts(forceRefresh = false): void {
        if (this.hasLoaded && !forceRefresh) {
            return;
        }

        this.loadingSubject.next(true);
        this.errorSubject.next(null);

        this.catalogApi
            .getProducts()
            .pipe(
                take(1),
                finalize(() => this.loadingSubject.next(false))
            )
            .subscribe({
                next: (products) => {
                    const validProducts = (products ?? []).filter(
                        (item) => this.isValidProduct(item) && item.available !== false
                    );
                    this.productsSubject.next(validProducts);
                    this.hasLoaded = true;
                },
                error: () => {
                    this.errorSubject.next('No se pudieron cargar los productos del catálogo.');
                }
            });
    }

    getProductsByCategorySlug(slug: string): Observable<Product[]> {
        const normalizedSlug = this.toSlug(slug);

        return this.products$.pipe(
            map((products) =>
                products.filter(
                    (product) =>
                        this.toSlug(product.category) === normalizedSlug ||
                        this.toSlug(product.size ?? '') === normalizedSlug
                )
            )
        );
    }

    getCategoryNameBySlug(slug: string): Observable<string> {
        const normalizedSlug = this.toSlug(slug);

        return this.categoryCards$.pipe(
            map((cards) => {
                const found = cards.find((card) => card.slug === normalizedSlug);
                return found ? found.name : slug.replace(/-/g, ' ');
            })
        );
    }

    toSlug(value: string): string {
        return (value ?? '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    private isValidProduct(product: Product | null | undefined): product is Product {
        if (!product) {
            return false;
        }

        const hasValidStrings =
            typeof product.name === 'string' && product.name.trim().length > 0 &&
            typeof product.category === 'string' && product.category.trim().length > 0 &&
            typeof product.imageUrl === 'string' && product.imageUrl.trim().length > 0;

        const hasValidSize =
            product.size === undefined ||
            product.size === null ||
            typeof product.size === 'string';

        const numericPrice = Number(product.price);
        const hasValidPrice = Number.isFinite(numericPrice) && numericPrice > 0;

        return hasValidStrings && hasValidSize && hasValidPrice;
    }

    private buildCategoryCards(products: Product[]): CategoryCard[] {
        const categoriesMap = new Map<string, CategoryCard>();

        for (const product of products) {
            const image = product.imageUrl.trim();
            const candidateNames = [product.category?.trim(), product.size?.trim()].filter(
                (name): name is string => Boolean(name)
            );

            for (const cleanName of candidateNames) {
                const slug = this.toSlug(cleanName);
                if (!slug) {
                    continue;
                }

                const existing = categoriesMap.get(slug);
                if (!existing) {
                    categoriesMap.set(slug, {
                        name: cleanName,
                        slug,
                        coverImage: image
                    });
                } else if (!existing.coverImage && image) {
                    existing.coverImage = image;
                }
            }
        }

        return Array.from(categoriesMap.values());
    }
}