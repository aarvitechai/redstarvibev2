import { ChangeDetectionStrategy, Component, ElementRef, OnInit, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { ApiError } from '../../core/http/api';
import { ToastService } from '../../core/ui/toast';
import { ProductsApi, imageSrc } from '../products/products-api';
import { AdminApi, AdminProduct } from './admin-api';
import { Modal } from './modal';

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Create or edit a product (plan 14.5): a modal Reactive form, plus image upload.
// Client checks are for quick feedback only; the API checks everything again (including the image's real bytes).
@Component({
  selector: 'app-product-form-dialog',
  imports: [ReactiveFormsModule, Modal],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-modal [title]="product() ? 'Edit ' + product()!.name : 'New product'" (closed)="closed.emit()">
      @if (!categories()) {
        <p role="status">Loading…</p>
      } @else {
        <form class="form" [formGroup]="form" (ngSubmit)="submit()" novalidate [attr.aria-label]="product() ? 'Edit product' : 'New product'">
          <div class="field"><label for="p-name">Name</label>
            <input #nameInput id="p-name" formControlName="name" [attr.aria-invalid]="err('name') ? true : null" />
            @if (err('name'); as e) { <small role="alert" class="field-error">{{ e }}</small> }</div>
          <div class="field"><label for="p-desc">Description</label><input id="p-desc" formControlName="description" /></div>
          <div class="field"><label for="p-price">Price (₹)</label>
            <input id="p-price" type="number" step="0.01" min="0.01" formControlName="price" [attr.aria-invalid]="err('price') ? true : null" />
            @if (err('price'); as e) { <small role="alert" class="field-error">{{ e }}</small> }</div>
          <div class="field"><label for="p-cat">Category</label>
            <select id="p-cat" formControlName="categoryId" [attr.aria-invalid]="err('categoryId') ? true : null">
              <option [ngValue]="null">Choose…</option>
              @for (c of categories(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
            </select>
            @if (err('categoryId'); as e) { <small role="alert" class="field-error">{{ e }}</small> }</div>
          <label class="check"><input type="checkbox" formControlName="isActive" /> For sale (active)</label>
          <div class="field"><label for="p-image">Image (JPEG, PNG or WebP, up to 2 MB)</label>
            @if (product()?.imageUrl && !file()) { <img class="preview" [src]="imageSrc(product()!.imageUrl)" alt="" width="160" height="90" /> }
            <input id="p-image" type="file" [accept]="imageTypes" (change)="chooseFile($event)" [attr.aria-invalid]="fileError() ? true : null" />
            @if (fileError()) { <small role="alert" class="field-error">{{ fileError() }}</small> }</div>
          <div class="actions">
            <button type="submit" class="primary" [disabled]="saving() || !!fileError()">{{ saving() ? 'Saving…' : product() ? 'Save changes' : 'Create product' }}</button>
            <button type="button" class="btn" (click)="closed.emit()" [disabled]="saving()">Cancel</button>
          </div>
        </form>
      }
    </app-modal>
  `,
  styleUrl: './admin.scss',
})
export class ProductFormDialog implements OnInit {
  readonly product = input<AdminProduct | null>(null);
  readonly closed = output<void>();

  private readonly admin = inject(AdminApi);
  private readonly toast = inject(ToastService);
  // The categories are shared and cached (shareReplay), and the form renders only once they're here,
  // so the <select> never mounts without its options (that lost the product's category in React, until fixed)
  protected readonly categories = toSignal(inject(ProductsApi).categories$);
  protected readonly imageSrc = imageSrc;
  protected readonly imageTypes = IMAGE_TYPES.join(',');

  protected readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    description: ['', Validators.maxLength(500)],
    price: [null as number | null, [Validators.required, Validators.min(0.01), Validators.max(100000)]],
    categoryId: [null as number | null, Validators.required],
    isActive: [true],
  });
  protected readonly file = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly saving = signal(false);
  private readonly submitted = signal(false);

  // The form appears only AFTER the categories load, i.e. after the modal already tried to move the focus.
  // So focus the first field as soon as it exists (a bug the tests caught).
  private readonly nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  private readonly focusName = effect(() => this.nameInput()?.nativeElement.focus());

  ngOnInit(): void {
    const p = this.product();
    if (p) this.form.reset({ name: p.name, description: p.description, price: p.price, categoryId: p.categoryId, isActive: p.isActive });
  }

  protected err(field: 'name' | 'price' | 'categoryId'): string | null {
    const c = this.form.controls[field];
    if (!c.errors || !(c.touched || this.submitted())) return null;
    if (c.errors['server']) return c.errors['server'] as string;
    return { name: 'Name must be 2 to 100 characters.', price: 'Price must be between 0.01 and 100000.', categoryId: 'Choose a category.' }[field];
  }

  protected chooseFile(event: Event): void {
    const chosen = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fileError.set(null);
    if (chosen && !IMAGE_TYPES.includes(chosen.type)) return this.fileError.set('Choose a JPEG, PNG or WebP image.');
    if (chosen && chosen.size > MAX_IMAGE_BYTES) return this.fileError.set('The image must be 2 MB or smaller.');
    this.file.set(chosen);
  }

  protected submit(): void {
    this.submitted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const body = { name: v.name!.trim(), description: (v.description ?? '').trim(), price: Number(v.price), categoryId: Number(v.categoryId), isActive: !!v.isActive };
    const existing = this.product();
    const save$: Observable<AdminProduct> = existing
      ? this.admin.updateProduct(existing.id, { ...body, rowVersion: existing.rowVersion }) // the version we LOADED
      : this.admin.createProduct(body);

    this.saving.set(true);
    save$
      .pipe(switchMap((saved) => (this.file() ? this.admin.uploadImage(saved.id, this.file()!) : of(saved)))) // then the image
      .subscribe({
        next: (saved) => {
          this.toast.success(existing ? `Saved "${saved.name}".` : `Created "${saved.name}".`);
          this.closed.emit();
        },
        error: (e: ApiError) => {
          this.saving.set(false);
          if (e.status === 409) {
            this.toast.error(e.message); // someone else saved first: close; the table refetches
            this.closed.emit();
            return;
          }
          if (!e.fieldErrors) return this.toast.error(e.message);
          for (const [field, messages] of Object.entries(e.fieldErrors)) {
            if (field === 'file') this.fileError.set(messages[0]);
            else this.form.get(field)?.setErrors({ server: messages[0] });
          }
        },
      });
  }
}
