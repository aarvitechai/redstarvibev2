import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ApiError, toApiError } from '../../core/http/api';
import { ToastService } from '../../core/ui/toast';
import { imageSrc } from '../products/products-api';
import { AdminApi, AdminProduct } from './admin-api';
import { Modal } from './modal';
import { ProductFormDialog } from './product-form-dialog';

// Project 9 (Angular): manage products. Every change bumps the products version, so the table refetches itself.
@Component({
  selector: 'app-admin-products-page',
  imports: [CurrencyPipe, Modal, ProductFormDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section aria-labelledby="admin-products-title">
      <div class="title-row">
        <h1 id="admin-products-title">Products</h1>
        <button type="button" class="primary" (click)="editing.set('new')">New product</button>
      </div>
      <label class="search">Search
        <input type="search" [value]="q() ?? ''" (input)="onSearch($event)" placeholder="product name" />
      </label>

      @if (loadError()) { <p role="alert" class="form-error">{{ loadError() }}</p> }
      @if (!data()) {
        <p class="muted">Loading…</p>
      } @else {
        @let d = data()!;
        <div class="table-wrap">
          <table class="table" [attr.aria-busy]="list.isLoading()">
            <caption class="muted">{{ d.totalCount }} products</caption>
            <thead><tr><th scope="col">Image</th><th scope="col">Name</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
            <tbody>
              @for (p of d.items; track p.id) {
                <tr [attr.aria-label]="p.name">
                  <td>@if (p.imageUrl) { <img class="thumb" [src]="imageSrc(p.imageUrl)" alt="" width="48" height="27" /> } @else { <span class="muted">—</span> }</td>
                  <td>{{ p.name }}</td>
                  <td>{{ p.categoryName }}</td>
                  <td>{{ p.price | currency: 'INR' : 'symbol' : '1.2-2' : 'en-IN' }}</td>
                  <td><span [class]="p.isActive ? 'active' : 'inactive'">{{ p.isActive ? 'Active' : 'Inactive' }}</span></td>
                  <td class="row-actions">
                    <button type="button" class="btn" (click)="editing.set(p)">Edit</button>
                    @if (p.isActive) { <button type="button" class="danger" (click)="confirming.set(p)">Delete</button> }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (editing(); as e) {
        <app-product-form-dialog [product]="e === 'new' ? null : e" (closed)="editing.set(null)" />
      }
      @if (confirming(); as c) {
        <app-modal title="Delete product?" (closed)="confirming.set(null)">
          <p>"{{ c.name }}" will be removed from the shop. Past orders keep their copy of it.</p>
          <div class="actions">
            <button type="button" class="danger" (click)="remove(c)" [disabled]="deleting()">{{ deleting() ? 'Deleting…' : 'Delete' }}</button>
            <button type="button" class="btn" (click)="confirming.set(null)">Keep it</button>
          </div>
        </app-modal>
      }
    </section>
  `,
  styleUrl: './admin.scss',
})
export class AdminProductsPage {
  private readonly admin = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly page = input<string>();
  readonly q = input<string>();
  private readonly query = computed(() => ({ page: Math.max(1, Number(this.page()) || 1), search: this.q() ?? '' }));
  protected readonly list = this.admin.products(this.query);
  protected readonly data = computed(() => (this.list.hasValue() ? this.list.value() : undefined));
  protected readonly loadError = computed(() => (this.list.error() ? toApiError(this.list.error()).message : null));
  protected readonly imageSrc = imageSrc;

  protected readonly editing = signal<AdminProduct | 'new' | null>(null);
  protected readonly confirming = signal<AdminProduct | null>(null);
  protected readonly deleting = signal(false);

  protected onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value.trim();
    this.router.navigate([], { queryParams: { q: value || null, page: null }, replaceUrl: true });
  }

  protected remove(p: AdminProduct): void {
    this.deleting.set(true);
    this.admin.deleteProduct(p.id).subscribe({
      next: () => {
        this.toast.success(`"${p.name}" is no longer for sale.`);
        this.done();
      },
      error: (e: ApiError) => {
        this.toast.error(e.message);
        this.done();
      },
    });
  }

  private done(): void {
    this.deleting.set(false);
    this.confirming.set(null);
  }
}
