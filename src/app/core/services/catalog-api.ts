import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Product } from '../../shared/product.model';

interface SheetProductDto {
  id?: number | string;
  nombre?: string;
  precio?: number | string;
  categoria?: string;
  tamano?: string;
  disponible?: string | boolean;
  imagen?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CatalogApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.catalogApiUrl;

  getProducts(): Observable<Product[]> {
    return this.http.get<SheetProductDto[]>(this.apiUrl).pipe(
      map((items) =>
        (items ?? []).map((item, index) => {
          const rawAvailable = item.disponible;
          const available =
            typeof rawAvailable === 'boolean'
              ? rawAvailable
              : String(rawAvailable ?? '').trim().toUpperCase() === 'SI';

          return {
            id: item.id ?? index + 1,
            name: String(item.nombre ?? '').trim(),
            category: String(item.categoria ?? '').trim(),
            size: String(item.tamano ?? '').trim(),
            price: Number(item.precio) || 0,
            imageUrl: String(item.imagen ?? '').trim(),
            available
          };
        })
      )
    );
  }
}