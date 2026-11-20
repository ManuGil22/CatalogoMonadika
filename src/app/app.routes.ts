import { Routes } from '@angular/router';
import { HomeComponent } from './features/catalog/home/home.component';
import { CategoryProductsComponent } from './features/catalog/category-products/category-products.component';

export const routes: Routes = [
    { path: '', component: HomeComponent },
    { path: 'categoria/:slug', component: CategoryProductsComponent },
    { path: '**', redirectTo: '' }
];