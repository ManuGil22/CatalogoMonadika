import { TestBed } from '@angular/core/testing';
import { CatalogApiService } from './catalog-api';

describe('CatalogApi', () => {
  let service: CatalogApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CatalogApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
