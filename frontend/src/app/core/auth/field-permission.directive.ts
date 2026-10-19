import {
  AbstractControl,
  NgControl,
} from '@angular/forms';
import {
  Directive,
  ElementRef,
  afterRenderEffect,
  computed,
  contentChildren,
  effect,
  inject,
  input,
  untracked,
} from '@angular/core';
import { ComponentPermissionService } from './component-permission.service';

type FormElement = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
const FORM_ELEMENTS = 'input, select, textarea, button';

/**
 * Privilegio por componente (B2) sobre el mismo formulario para todos los grupos:
 * `<label [appField]="'documento.nuevo.codigo'">…<input …/></label>`.
 *
 * - VISIBLE_EDITABLE: sin cambios.
 * - VISIBLE_READONLY: se muestra con sus controles deshabilitados.
 * - HIDDEN: no se muestra y sus controles quedan deshabilitados (no validan ni viajan en `form.value`).
 *
 * Funciona sobre el propio control o sobre un contenedor; deshabilita los `NgControl` (formularios
 * reactivos y ngModel) y, como respaldo, los elementos nativos, incluidos los de componentes hijos.
 */
@Directive({
  selector: '[appField]',
  host: {
    '[style.display]': "state() === 'HIDDEN' ? 'none' : null",
    '[attr.aria-hidden]': "state() === 'HIDDEN' ? 'true' : null",
    '[class.field-readonly]': "state() === 'VISIBLE_READONLY'",
    '[attr.data-field-state]': 'state()',
    '[attr.title]': "state() === 'VISIBLE_READONLY' ? 'Solo lectura para tu perfil' : null",
  },
})
export class FieldPermissionDirective {
  readonly appField = input.required<string>();
  private readonly permissions = inject(ComponentPermissionService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly ownControl = inject(NgControl, { self: true, optional: true });
  private readonly innerControls = contentChildren(NgControl, { descendants: true });
  private readonly lockedControls = new Set<AbstractControl>();
  private readonly lockedElements = new Set<FormElement>();

  readonly state = computed(() => this.permissions.state(this.appField()));

  constructor() {
    effect(() => {
      const locked = this.state() !== 'VISIBLE_EDITABLE';
      const controls = [this.ownControl, ...this.innerControls()]
        .map((control) => control?.control)
        .filter((control): control is AbstractControl => !!control);
      untracked(() => controls.forEach((control) => this.lockControl(control, locked)));
    });
    afterRenderEffect(() => {
      const locked = this.state() !== 'VISIBLE_EDITABLE';
      untracked(() => this.formElements().forEach((element) => this.lockElement(element, locked)));
    });
  }

  private lockControl(control: AbstractControl, locked: boolean): void {
    if (locked && control.enabled) {
      control.disable();
      this.lockedControls.add(control);
    } else if (!locked && this.lockedControls.delete(control)) {
      control.enable();
    }
  }

  private lockElement(element: FormElement, locked: boolean): void {
    if (locked && !element.disabled) {
      element.disabled = true;
      this.lockedElements.add(element);
    } else if (!locked && this.lockedElements.delete(element)) {
      element.disabled = false;
    }
  }

  private formElements(): FormElement[] {
    const host = this.host.nativeElement;
    const nested = Array.from(host.querySelectorAll<FormElement>(FORM_ELEMENTS));
    return host.matches(FORM_ELEMENTS) ? [host as FormElement, ...nested] : nested;
  }
}
