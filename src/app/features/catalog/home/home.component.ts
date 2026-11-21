import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { CatalogStore } from '../../../core/services/catalog-store.service';
import { CategoryCard } from '../../../shared/category-card.model';
import { CATEGORY_CARDS } from '../../../shared/consts';

@Component({
    selector: 'app-home',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './home.component.html',
    styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
    private readonly catalogStore = inject(CatalogStore);

    readonly categories: CategoryCard[] = CATEGORY_CARDS;
    readonly loading$: Observable<boolean> = this.catalogStore.loading$;
    readonly error$: Observable<string | null> = this.catalogStore.error$;

    ngOnInit(): void {
        this.catalogStore.loadProducts();
    }
}