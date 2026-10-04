import {
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RichTextEditorComponent),
      multi: true,
    },
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rich-editor-container" [class.disabled]="isDisabled">
      <!-- Barra de Herramientas WYSIWYG -->
      <div class="rich-toolbar">
        <button
          type="button"
          class="tb-btn"
          [class.active]="editor?.isActive('bold')"
          (click)="editor?.chain()?.focus()?.toggleBold()?.run()"
          title="Negrita (Ctrl+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          class="tb-btn"
          [class.active]="editor?.isActive('italic')"
          (click)="editor?.chain()?.focus()?.toggleItalic()?.run()"
          title="Cursiva (Ctrl+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          class="tb-btn"
          [class.active]="editor?.isActive('strike')"
          (click)="editor?.chain()?.focus()?.toggleStrike()?.run()"
          title="Tachado"
        >
          <s>S</s>
        </button>

        <span class="tb-divider"></span>

        <button
          type="button"
          class="tb-btn"
          [class.active]="editor?.isActive('heading', { level: 2 })"
          (click)="editor?.chain()?.focus()?.toggleHeading({ level: 2 })?.run()"
          title="Título H2"
        >
          H2
        </button>
        <button
          type="button"
          class="tb-btn"
          [class.active]="editor?.isActive('heading', { level: 3 })"
          (click)="editor?.chain()?.focus()?.toggleHeading({ level: 3 })?.run()"
          title="Subtítulo H3"
        >
          H3
        </button>

        <span class="tb-divider"></span>

        <button
          type="button"
          class="tb-btn"
          [class.active]="editor?.isActive('bulletList')"
          (click)="editor?.chain()?.focus()?.toggleBulletList()?.run()"
          title="Lista con viñetas"
        >
          • Viñetas
        </button>
        <button
          type="button"
          class="tb-btn"
          [class.active]="editor?.isActive('orderedList')"
          (click)="editor?.chain()?.focus()?.toggleOrderedList()?.run()"
          title="Lista numerada"
        >
          1. Numerada
        </button>

        <span class="tb-divider"></span>

        <button
          type="button"
          class="tb-btn"
          [class.active]="editor?.isActive('blockquote')"
          (click)="editor?.chain()?.focus()?.toggleBlockquote()?.run()"
          title="Cita médica"
        >
          ❝ Cita
        </button>
        <button
          type="button"
          class="tb-btn"
          (click)="editor?.chain()?.focus()?.undo()?.run()"
          title="Deshacer"
        >
          ↺
        </button>
        <button
          type="button"
          class="tb-btn"
          (click)="editor?.chain()?.focus()?.redo()?.run()"
          title="Rehacer"
        >
          ↻
        </button>
      </div>

      <!-- Área de Edición -->
      <div #editorElement class="editor-content-area"></div>
    </div>
  `,
  styles: [`
    .rich-editor-container {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #ffffff;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      overflow: hidden;
    }
    .rich-editor-container:focus-within {
      border-color: #0d9488;
      box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.15);
    }
    .rich-editor-container.disabled {
      background: #f8fafc;
      opacity: 0.7;
      pointer-events: none;
    }
    .rich-toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 10px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
    }
    .tb-btn {
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 600;
      color: #334155;
      cursor: pointer;
      line-height: 1.4;
      transition: all 0.15s ease;
    }
    .tb-btn:hover {
      background: #e2e8f0;
      color: #0f172a;
    }
    .tb-btn.active {
      background: #ccfbf1;
      border-color: #99f6e4;
      color: #0f766e;
    }
    .tb-divider {
      width: 1px;
      height: 16px;
      background: #cbd5e1;
      margin: 0 4px;
    }
    .editor-content-area {
      min-height: 110px;
      padding: 10px 12px;
      font-size: 13px;
      line-height: 1.6;
      color: #1e293b;
    }
    :host ::ng-deep .ProseMirror {
      outline: none;
      min-height: 90px;
    }
    :host ::ng-deep .ProseMirror p {
      margin: 0 0 8px 0;
    }
    :host ::ng-deep .ProseMirror p:last-child {
      margin-bottom: 0;
    }
    :host ::ng-deep .ProseMirror h2 {
      font-size: 16px;
      font-weight: 700;
      color: #0f766e;
      margin: 10px 0 6px 0;
    }
    :host ::ng-deep .ProseMirror h3 {
      font-size: 14px;
      font-weight: 700;
      color: #334155;
      margin: 8px 0 4px 0;
    }
    :host ::ng-deep .ProseMirror ul,
    :host ::ng-deep .ProseMirror ol {
      padding-left: 20px;
      margin: 6px 0;
    }
    :host ::ng-deep .ProseMirror blockquote {
      border-left: 3px solid #0d9488;
      padding-left: 10px;
      margin: 6px 0;
      color: #64748b;
      font-style: italic;
    }
  `],
})
export class RichTextEditorComponent implements OnInit, OnDestroy, ControlValueAccessor {
  @ViewChild('editorElement', { static: true }) editorElement!: ElementRef<HTMLDivElement>;
  @Input() placeholder = 'Escriba aquí...';

  editor: Editor | null = null;
  isDisabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit() {
    this.editor = new Editor({
      element: this.editorElement.nativeElement,
      extensions: [StarterKit],
      editorProps: {
        attributes: {
          class: 'prose-mirror-editor',
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        const value = html === '<p></p>' ? '' : html;
        this.onChange(value);
      },
      onBlur: () => {
        this.onTouched();
      },
    });
  }

  ngOnDestroy() {
    this.editor?.destroy();
    this.editor = null;
  }

  writeValue(value: string | null): void {
    if (!this.editor) return;
    const current = this.editor.getHTML();
    const next = value || '';
    if (current !== next) {
      this.editor.commands.setContent(next, { emitUpdate: false });
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
    this.editor?.setEditable(!isDisabled);
  }
}
